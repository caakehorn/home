/**
 * The query.
 *
 * Everything difficult about this tool is in this file. The shell asks four or
 * five easy questions; turning those into a statement that returns the right
 * rows out of chat.db, in the right order, once each, is where the work is.
 *
 * ---- the four traps --------------------------------------------------------
 *
 * 1. TWO DATE ENCODINGS. See `appleEpoch` in schema.ts. A query that assumes
 *    one of them dates a decade of messages to 1970.
 *
 * 2. ROW MULTIPLICATION. A message can belong to more than one chat, and to
 *    more than one attachment. Joining `chat_message_join` and
 *    `message_attachment_join` directly multiplies rows, and an export with
 *    silent duplicates looks exactly like a correct one. Both are resolved with
 *    correlated subqueries instead — the chat by `min(chat_id)`, which is
 *    arbitrary but DETERMINISTIC, and the attachments by aggregation. A
 *    `GROUP BY` with bare columns would also collapse the rows, but sqlite is
 *    free to pick any row's value for the bare columns, and this build asserts
 *    determinism.
 *
 * 3. WHICH SIDE THE FILTER GOES ON. `message.handle_id` is the other party in
 *    BOTH directions, so filtering on it gets a one-to-one thread whole. It
 *    also gets nothing from any group chat, because a group message's handle is
 *    whoever sent it. Filtering through `chat_handle_join` instead gets the
 *    whole conversation including groups — and also every other group that
 *    person happens to be in. There is no right answer, so the tool asks.
 *
 * 4. THE TEXT IS OFTEN NOT IN THE TEXT COLUMN. See `body.ts`.
 *
 * ---- the rule this file follows -------------------------------------------
 *
 * No value the reader supplied is ever concatenated into this SQL. Everything
 * goes through `sq()` from the shell's quote module, and identifiers are fixed
 * strings written here. A phone number pasted out of a contact card is exactly
 * as untrusted as anything else.
 */

import { sq } from '../../shell/quote'
import { appleEpoch } from './schema'
import { SQLITE_TEXT_GUESS } from './body'
import type { Range } from '../../shell/dates'

export type Scope = 'conversation' | 'handle'

/** A person to pull, and optionally the name to stamp on their rows. */
export type Target = { handle: string; name?: string }

export type QueryPlan = {
  /** Empty means everybody in the database. */
  targets: Target[]
  scope: Scope
  range: Range
}

/* ==========================================================================
   MATCHING A PERSON

   handle.id is not written consistently. The same person is +15550104477 in
   one row and 5550104477 in another depending on which device and which year
   wrote it, and an Apple ID can differ in case. So a target matches on the
   last ten digits of whatever digits it contains, or on a lowercased exact
   email — never on string equality with what was typed.

   Ten digits is a North American assumption and is stated as one on the
   instrument: it is the length that makes +1 555 010 4477, (555) 010-4477 and
   5550104477 the same person. A longer international number still matches,
   because its last ten digits are still unique to it within one address book;
   a shorter one — a five-digit shortcode — matches on its own full length.
   ========================================================================== */

const isEmail = (value: string) => value.includes('@')

/** Just the digits, which is the only part of a phone number that is stable. */
export const digitsOf = (value: string) => value.replace(/\D+/g, '')

/** The tail used for matching: ten digits, or the whole thing if it is shorter. */
export const matchTail = (value: string) => {
  const d = digitsOf(value)
  return d.length > 10 ? d.slice(-10) : d
}

/** Strip formatting from handle.id inside SQL, so the comparison is digits-to-digits. */
const SQL_DIGITS = (col: string) =>
  [`'+'`, `'-'`, `' '`, `'('`, `')'`, `'.'`, `' '`]
    .reduce((expr, ch) => `replace(${expr}, ${ch}, '')`, col)

/** One target, as a predicate over a handle table alias. */
function handleMatches(alias: string, target: Target): string {
  const value = target.handle.trim()
  if (isEmail(value)) return `lower(${alias}.id) = ${sq(value.toLowerCase())}`

  const tail = matchTail(value)
  // A target with no digits and no @ cannot match anything. Emitting `0` rather
  // than dropping it keeps the count of predicates equal to the count of
  // targets, so a typo produces an empty export rather than silently widening
  // the query to everybody.
  if (!tail) return '0'
  return `${SQL_DIGITS(`${alias}.id`)} LIKE ${sq(`%${tail}`)}`
}

const anyTarget = (alias: string, targets: Target[]) =>
  targets.map((t) => handleMatches(alias, t)).join(' OR ')

/* ==========================================================================
   THE WINDOW

   A relative window stays relative: sqlite resolves `now` when the reader runs
   the command, which is when they meant. An absolute window is compared against
   the LOCALLY RENDERED date rather than against an epoch computed here, so
   "1 nov 2018" means the first of November where the Mac is, not where the
   browser that generated the command happened to be.
   ========================================================================== */

function windowPredicate(range: Range, ts: string): string | null {
  if (range.kind === 'all') return null
  if (range.kind === 'relative') {
    return `${ts} >= strftime('%s', 'now', ${sq(`-${range.n} ${range.unit}`)})`
  }
  return `date(${ts}, 'unixepoch', 'localtime') BETWEEN ${sq(range.from)} AND ${sq(range.to)}`
}

/* ==========================================================================
   THE STATEMENT
   ========================================================================== */

const TS = appleEpoch('m.date')
const TS_READ = appleEpoch('m.date_read')

/**
 * A CASE that stamps a chosen name onto each row, when contacts are loaded.
 *
 * Built from the same matcher as the filter, so a contact that resolves in the
 * WHERE clause resolves in the name column too — the alternative is an export
 * that contains a person's messages under a blank name, which is the worst of
 * both.
 */
function nameColumn(targets: Target[]): string {
  const named = targets.filter((t) => t.name?.trim())
  if (!named.length) return `'' AS contact_name`
  const arms = named
    .map((t) => `    WHEN ${handleMatches('h', t)} THEN ${sq(t.name!.trim())}`)
    .join('\n')
  return `CASE\n${arms}\n    ELSE ''\n  END AS contact_name`
}

/**
 * Build the SELECT.
 *
 * `withBody` decides whether the raw attributedBody blob comes along as hex for
 * the precise decoder, or whether the approximate in-SQL recovery is used
 * instead. The emitted script runs one or the other depending on what it finds
 * on the machine — see `script.ts`.
 */
export function buildQuery(plan: QueryPlan, withBody: boolean): string {
  const where: string[] = []

  if (plan.targets.length) {
    const predicate = anyTarget('h', plan.targets)
    if (plan.scope === 'handle') {
      where.push(`(${predicate})`)
    } else {
      // The whole conversation: any chat this message is in that has the target
      // as a participant. This is what picks up group threads, and what a
      // reader asking for "my messages with X" almost always means.
      // `hh` rather than `h`: the outer query already joins `handle h`, and
      // while an inner `h` would correctly shadow it, this script is one the
      // reader is told to read before running. A predicate whose meaning turns
      // on a shadowing rule is one they cannot check.
      where.push(`EXISTS (
    SELECT 1
      FROM chat_message_join j
      JOIN chat_handle_join chj ON chj.chat_id = j.chat_id
      JOIN handle hh ON hh.ROWID = chj.handle_id
     WHERE j.message_id = m.ROWID
       AND (${anyTarget('hh', plan.targets)})
  )`)
    }
  }

  const window = windowPredicate(plan.range, TS)
  if (window) where.push(window)

  const text = withBody
    ? `COALESCE(m.text, '') AS text,
  CASE
    WHEN (m.text IS NULL OR m.text = '') AND m.attributedBody IS NOT NULL
    THEN hex(m.attributedBody)
    ELSE ''
  END AS body_hex`
    : `COALESCE(NULLIF(m.text, ''), ${SQLITE_TEXT_GUESS}, '') AS text`

  return `SELECT
  m.ROWID AS row_id,
  COALESCE(m.guid, '') AS guid,
  datetime(${TS}, 'unixepoch', 'localtime') AS sent_at_local,
  datetime(${TS}, 'unixepoch') AS sent_at_utc,
  ${TS} AS sent_epoch,
  CASE m.is_from_me WHEN 1 THEN 'SENT' ELSE 'RECEIVED' END AS direction,
  COALESCE(h.id, '') AS counterparty,
  ${nameColumn(plan.targets)},
  COALESCE(h.service, m.service, '') AS service,
  COALESCE(c.chat_identifier, '') AS chat_id,
  COALESCE(c.display_name, '') AS chat_name,
  CASE WHEN c.style = 43 THEN 1 ELSE 0 END AS is_group,
  COALESCE(m.cache_has_attachments, 0) AS has_attachment,
  COALESCE((
    SELECT group_concat(t.n, ' | ') FROM (
      SELECT a.transfer_name AS n
        FROM message_attachment_join maj
        JOIN attachment a ON a.ROWID = maj.attachment_id
       WHERE maj.message_id = m.ROWID
       ORDER BY a.ROWID
    ) t
  ), '') AS attachments,
  COALESCE(m.thread_originator_guid, '') AS reply_to_guid,
  COALESCE(m.associated_message_type, 0) AS tapback_type,
  COALESCE(m.associated_message_guid, '') AS tapback_on,
  COALESCE(m.is_read, 0) AS is_read,
  CASE
    WHEN m.date_read IS NULL OR m.date_read = 0 THEN ''
    ELSE datetime(${TS_READ}, 'unixepoch', 'localtime')
  END AS read_at_local,
  ${text}
FROM message m
LEFT JOIN handle h ON h.ROWID = m.handle_id
-- One chat per message, chosen deterministically. A message in two chats would
-- otherwise come back twice; see trap 2 at the top of this file.
LEFT JOIN chat c ON c.ROWID = (
  SELECT min(j2.chat_id) FROM chat_message_join j2 WHERE j2.message_id = m.ROWID
)
${where.length ? `WHERE ${where.join('\n  AND ')}` : ''}
ORDER BY sent_epoch ASC, m.ROWID ASC;`
}

/**
 * The same predicate, as a count.
 *
 * The emitted script runs this after writing the file and compares it against
 * the rows it actually wrote. A truncated export — a disk that filled, a pipe
 * that broke, a decoder that died halfway — looks exactly like a complete one
 * on disk, and this is what makes the difference visible. See CLAUDE.md §3.
 */
export function buildCount(plan: QueryPlan): string {
  const query = buildQuery(plan, false)
  const body = query.slice(query.indexOf('\nFROM message m'))
  return `SELECT count(*) FROM (SELECT m.ROWID${body.replace(/\nORDER BY[^;]*;$/, '')});`
}
