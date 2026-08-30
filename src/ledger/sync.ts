/**
 * Sync — how the local log becomes `intake/events.jsonl` in wiki-brain.
 *
 * The capture layer is here; the ledger is that repository's, and `bin/intake`
 * is the tool that reads it. This module is the only thing that crosses between
 * them, and it crosses in both directions: events written on a phone go up,
 * events written by the CLI or Special:Intake come down, and all three
 * interfaces converge on one file.
 *
 * ---- the interlock, which is the important part of this file -----------------
 *
 * That repository held its ledger data in `.gitignore` for months because it
 * was public and a consumption record is not something to publish by accident.
 * Those lines protected the CLI and the local app and did **nothing at all for
 * this module**: `.gitignore` governs `git add`, and this writes through
 * GitHub's contents API from a browser with no working tree anywhere in the
 * loop. That API commits an ignored path without complaint.
 *
 * So the guard lives here instead, and it does not consult `.gitignore`:
 * `sync()` reads the repository's visibility and **refuses to push while it is
 * public**. Make the repo public again and this stops writing rather than
 * quietly publishing a night's events. It is checked once per session and
 * cached, because it is a property of the repository rather than of the write.
 *
 * ---- why a union is always safe ----------------------------------------------
 *
 * Because the log is append-only and every event carries a ULID, merging two
 * copies is set union by id. There is no last-writer-wins, no field-level
 * conflict, and nothing that can be lost by two devices writing at once — the
 * worst case is that one of them has to read and retry.
 *
 * ---- one file, and the megabyte -----------------------------------------------
 *
 * Upstream is a single `intake/events.jsonl`, so this portal writes a single
 * file rather than the monthly shards it used to. That reintroduces a limit
 * worth naming: the contents API returns at most a megabyte of content inline,
 * which is somewhere around four thousand events. Past that it answers with an
 * empty `content` and the blob's sha, so `readFile` falls back to the Git blobs
 * API, which goes to a hundred. Writing has no such cap.
 */

import { readFile, repoIsPrivate, writeFile, SOURCE_REPO } from '../wiki/publish'
import { mergeLogs, orderLog, parseJsonl, toJsonl, type LedgerEvent } from './events.ts'
import { project, type Ledger } from './project.ts'
import { appendLocal, clearFromOutbox, loadLocal, outbox, rememberSync, replaceLog } from './store.ts'

/** Upstream's paths. Not this portal's to choose. */
export const DIR = 'intake'
export const LOG = `${DIR}/events.jsonl`
export const SUBSTANCES = `${DIR}/substances.json`

export type SyncReport = {
  at: string
  pushed: number
  pulled: number
  /**
   * Set while the ledger is running local-only, which is the normal mode
   * against a public wiki-brain. Not an error and not a failure — the tool is
   * complete without the network, and this says which mode it is in.
   */
  localOnly: string | null
  problems: string[]
}

/**
 * Push what is local, pull what is not, in one pass.
 *
 * Never throws for a network, credential or visibility failure: the local log
 * is complete and correct without any of this, and a capture tool that shows an
 * error page because GitHub is unreachable has misunderstood which half is
 * important. Failures are returned and shown as a badge.
 */
export async function sync(): Promise<SyncReport> {
  const at = new Date().toISOString()
  const report: SyncReport = { at, pushed: 0, pulled: 0, localOnly: null, problems: [] }

  const local = await loadLocal()
  report.problems.push(...local.problems.map((p) => `local log: ${p}`))

  let priv: boolean
  try {
    priv = await repoIsPrivate(SOURCE_REPO)
  } catch (error) {
    report.problems.push((error as Error).message)
    return report
  }

  if (!priv) {
    // Local-only, and that is a working configuration rather than a fault.
    //
    // `${SOURCE_REPO}` is public. Nothing about this ledger is going into a
    // public repository — not by this path and not by any other — so the push
    // does not happen and the tool carries on doing the thing it is actually
    // for. Everything is in IndexedDB, every figure and every report is
    // computed from there, and EXPORT hands the whole log back in exactly the
    // format `bin/intake` appends, so merging it is a `cat` and a `rebuild`
    // whenever you want the two joined.
    //
    // This used to read as a refusal, which made a working tool look broken.
    // The only thing the public repo actually costs is automatic device-to-
    // device sync; it costs nothing else, and the badge now says so in those
    // terms.
    report.localOnly = 'not syncing — the wiki repo is public. EXPORT to merge by hand.'
    return report
  }

  try {
    const result = await reconcile(local.events)
    report.pushed = result.pushed
    report.pulled = result.pulled.length
    if (result.pulled.length) await replaceLog(toJsonl(mergeLogs(local.events, result.pulled)))
    if (result.confirmed.length) await clearFromOutbox(result.confirmed)
  } catch (error) {
    report.problems.push((error as Error).message)
    return report
  }

  await rememberSync(at)
  return report
}

/** Read, merge, write — retrying a stale sha up to three times. */
async function reconcile(
  mine: LedgerEvent[],
): Promise<{ pushed: number; pulled: LedgerEvent[]; confirmed: string[] }> {
  for (let attempt = 0; attempt < 3; attempt++) {
    const remote = await readFile(SOURCE_REPO, LOG)
    const theirs = parseJsonl(remote?.text ?? '')
    const upstream = new Set(theirs.events.map((e) => e.id))
    const held = new Set(mine.map((e) => e.id))

    const pulled = theirs.events.filter((e) => !held.has(e.id))
    const pushing = mine.filter((e) => !upstream.has(e.id))

    if (!pushing.length) return { pushed: 0, pulled, confirmed: mine.map((e) => e.id) }

    // `bin/intake` appends and never rewrites, so the merged file has to keep
    // upstream's own bytes for every row it already had — a reordering would
    // show up as a whole-file diff on every sync and lose the append-only
    // reading of `git log`. Ours go on the end, in order.
    const text = (remote?.text ?? '') + toJsonl(orderLog(pushing))
    const written = await writeFile(
      SOURCE_REPO,
      LOG,
      text,
      `intake: ${pushing.length} event${pushing.length === 1 ? '' : 's'} from the portal`,
      remote?.sha ?? null,
    )
    if (written === 'conflict') continue // somebody else wrote; re-read and merge again

    return { pushed: pushing.length, pulled, confirmed: mine.map((e) => e.id) }
  }
  throw new Error('three writers collided on the ledger — try again')
}

// ---------------------------------------------------------------------------
// the substance catalogue

export type Substance = { id: string; name: string; category?: string; default_unit?: string }

let catalogue: Promise<Substance[]> | null = null

/**
 * `intake/substances.json`, which upstream calls the select box.
 *
 * `bin/intake` rejects a substance that is not in it rather than creating one
 * on the fly, "because silently creating one is how a select box degrades back
 * into free text". This portal offers the same list for the same reason, and
 * falls back to an empty one when the file cannot be read — a picker with
 * nothing in it is recoverable; a unit filed under a substance id upstream does
 * not recognise is not.
 */
export function substances(): Promise<Substance[]> {
  catalogue ??= readFile(SOURCE_REPO, SUBSTANCES)
    .then((file) => {
      if (!file) return []
      const parsed = JSON.parse(file.text) as { substances?: Substance[] }
      return parsed.substances ?? []
    })
    .catch(() => {
      catalogue = null
      return []
    })
  return catalogue
}

// ---------------------------------------------------------------------------
// what the app actually calls

export type LedgerState = {
  ledger: Ledger
  problems: string[]
  waiting: number
}

/** The local log, folded. Instant, offline, and complete on its own. */
export async function loadLedger(): Promise<LedgerState> {
  const { events, problems } = await loadLocal()
  return { ledger: project(events), problems, waiting: (await outbox()).length }
}

/**
 * Write events and return the new state, without waiting on the network.
 *
 * The caller is a button press and the event is already durable by the time
 * this resolves.
 */
export async function record(events: LedgerEvent[]): Promise<LedgerState> {
  await appendLocal(events)
  return loadLedger()
}
