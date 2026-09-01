/**
 * Reading a window of time out of something a person typed.
 *
 * Three shapes, because those are the three ways anybody actually says it:
 *
 *   all                     everything the database holds
 *   90 days · 6 months      a window ending now
 *   1 nov 2018 - 1 dec 2022 a window with both ends named
 *
 * ---- why the result is a pair of date strings ------------------------------
 *
 * `Range` carries `from`/`to` as plain `YYYY-MM-DD` strings, or a relative
 * expression, and never a `Date`. Two reasons, and both of them are bugs that
 * were avoidable:
 *
 * A `Date` built here would be built in the browser's timezone and then
 * compared, in the emitted SQL, against a timestamp rendered in the Mac's
 * timezone. Those are usually the same and occasionally are not, and when they
 * are not the window silently slides by a day at each end. Keeping it as the
 * date the reader named, and doing the comparison against the locally-rendered
 * date on the far side, means the window means what they said in the place it
 * is applied.
 *
 * And `compose` must be deterministic — the build gate composes every fixture
 * twice and diffs. A relative window resolved here would bake today's date into
 * the script and fail that check the first time midnight passed mid-session.
 * So a relative window stays relative all the way into the SQL, where sqlite's
 * own `'now'` resolves it at the moment the reader actually runs the command,
 * which is also the moment they meant.
 */

export type Range =
  /** No date filter at all. */
  | { kind: 'all' }
  /** A window ending at the moment the command runs. `n` units back from now. */
  | { kind: 'relative'; n: number; unit: 'days' | 'months' | 'years' }
  /** Both ends named, inclusive, in the reader's own local dates. */
  | { kind: 'absolute'; from: string; to: string }

const MONTHS: Record<string, number> = {
  jan: 1, january: 1,
  feb: 2, february: 2,
  mar: 3, march: 3,
  apr: 4, april: 4,
  may: 5,
  jun: 6, june: 6,
  jul: 7, july: 7,
  aug: 8, august: 8,
  sep: 9, sept: 9, september: 9,
  oct: 10, october: 10,
  nov: 11, november: 11,
  dec: 12, december: 12,
}

const pad = (n: number) => String(n).padStart(2, '0')

/** Days in a month, Gregorian, so 31 February is rejected rather than rolled. */
const monthLength = (y: number, m: number) =>
  [31, (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0 ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][m - 1]

/**
 * One end of an absolute range. Accepts `2018-11-01`, `1 nov 2018`,
 * `nov 1 2018`, `1/11/2018` is deliberately NOT accepted — it means two
 * different days on two sides of an ocean, and guessing which is worse than
 * asking again.
 */
export function parseDay(raw: string): string | null {
  const text = raw.trim().toLowerCase().replace(/,/g, ' ').replace(/\s+/g, ' ')
  if (!text) return null

  let y: number | null = null
  let m: number | null = null
  let d: number | null = null

  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(text)
  if (iso) {
    y = Number(iso[1])
    m = Number(iso[2])
    d = Number(iso[3])
  } else {
    const parts = text.split(' ')
    if (parts.length !== 3) return null
    const named = parts.findIndex((p) => p in MONTHS)
    if (named === -1) return null
    m = MONTHS[parts[named]]
    const rest = parts.filter((_, i) => i !== named)
    // The four-digit one is the year; whichever is left is the day.
    const yearAt = rest.findIndex((p) => /^\d{4}$/.test(p))
    if (yearAt === -1) return null
    y = Number(rest[yearAt])
    const dayText = rest[1 - yearAt]
    if (!/^\d{1,2}$/.test(dayText)) return null
    d = Number(dayText)
  }

  if (y === null || m === null || d === null) return null
  if (y < 1970 || y > 2999) return null
  if (m < 1 || m > 12) return null
  if (d < 1 || d > monthLength(y, m)) return null
  return `${y}-${pad(m)}-${pad(d)}`
}

/**
 * Parse a whole window. Returns the range, or the complaint to print — never
 * a half-understood range, because a date filter that quietly means something
 * other than what was typed produces an export that looks complete and is not.
 */
export function parseRange(raw: string): { range: Range } | { error: string } {
  const text = raw.trim().toLowerCase().replace(/\s+/g, ' ')
  if (!text) return { error: 'nothing to read. try `all`, `90 days`, or `1 nov 2018 - 1 dec 2022`.' }

  if (text === 'all' || text === 'everything' || text === '*') return { range: { kind: 'all' } }

  const rel = /^(?:last\s+|past\s+)?(\d{1,5})\s*(day|days|d|week|weeks|w|month|months|mo|year|years|y)$/.exec(text)
  if (rel) {
    const n = Number(rel[1])
    if (n < 1) return { error: 'a window has to be at least one day wide.' }
    const u = rel[2]
    // Weeks are days underneath — sqlite's date modifiers have no week unit,
    // and multiplying here keeps the emitted SQL to modifiers sqlite has.
    if (u.startsWith('w')) return { range: { kind: 'relative', n: n * 7, unit: 'days' } }
    const unit = u.startsWith('d') ? 'days' : u.startsWith('y') ? 'years' : 'months'
    return { range: { kind: 'relative', n, unit } }
  }

  // An en dash is what a Mac types when you meant a hyphen, and `to` is what
  // people write. Both are the same separator.
  const split = text.split(/\s+(?:-|–|—|to|until|through)\s+/)
  if (split.length === 2) {
    const from = parseDay(split[0])
    const to = parseDay(split[1])
    if (!from) return { error: `cannot read a date out of "${split[0]}". try \`1 nov 2018\` or \`2018-11-01\`.` }
    if (!to) return { error: `cannot read a date out of "${split[1]}". try \`1 dec 2022\` or \`2022-12-01\`.` }
    if (from > to) return { error: `${from} is after ${to}. a window runs forwards.` }
    return { range: { kind: 'absolute', from, to } }
  }

  // One bare date is ambiguous — is it a start, an end, or a single day? Say so
  // rather than picking.
  if (parseDay(text)) {
    return {
      error:
        'that is one date, and a window needs two ends. write it as `1 nov 2018 - 1 dec 2022`, ' +
        'or say `all`.',
    }
  }

  return { error: `cannot read "${raw.trim()}" as a window. try \`all\`, \`90 days\`, or \`1 nov 2018 - 1 dec 2022\`.` }
}

/** How the chosen window reads back to the reader, in the summary. */
export function describeRange(range: Range): string {
  if (range.kind === 'all') return 'everything in the database'
  if (range.kind === 'relative') return `the last ${range.n} ${range.unit}`
  return `${range.from} to ${range.to} inclusive, in your Mac's own timezone`
}

/** The serialised form an answer carries, so `compose` stays pure over strings. */
export function encodeRange(range: Range): string {
  if (range.kind === 'all') return 'all'
  if (range.kind === 'relative') return `rel:${range.n}:${range.unit}`
  return `abs:${range.from}:${range.to}`
}

export function decodeRange(value: string): Range {
  if (value.startsWith('rel:')) {
    const [, n, unit] = value.split(':')
    return { kind: 'relative', n: Number(n), unit: unit as 'days' | 'months' | 'years' }
  }
  if (value.startsWith('abs:')) {
    const [, from, to] = value.split(':')
    return { kind: 'absolute', from, to }
  }
  return { kind: 'all' }
}
