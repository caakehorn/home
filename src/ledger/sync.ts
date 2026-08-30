/**
 * Sync — how the local log becomes part of the corpus.
 *
 * The capture layer is here; the long-term memory is `caakehorn/wiki-brain`,
 * which is where every other durable fact about this subject already lives.
 * This module is the only thing that crosses between them, and it crosses in
 * both directions: events written on a phone go up, events written on a laptop
 * come down, and both copies converge on the same file.
 *
 * ---- why a union is always safe --------------------------------------------
 *
 * Because the log is append-only and every event carries a ULID, merging two
 * copies is set union by id. There is no last-writer-wins, no field-level
 * conflict, and nothing that can be lost by two devices writing at once — the
 * worst case is that one of them has to read and retry. This is the property
 * the event-sourced design was chosen for, and it is worth more here than it
 * looks: the alternative shape, a mutable `units` table synced by timestamp,
 * would silently drop a dose logged offline the moment another device wrote.
 *
 * ---- monthly shards ---------------------------------------------------------
 *
 * `data/intake/events-YYYY-MM.jsonl`, sharded by the month an event was
 * *logged* rather than the month it occurred. Three reasons, in order of how
 * much they matter:
 *
 *   1. GitHub's contents API returns at most a megabyte, and there is no append
 *      — every write is a whole-file PUT. Unsharded, the log eventually stops
 *      being readable by the thing that writes it.
 *   2. Sharding on `loggedAt` means a closed month is never rewritten, so the
 *      only file two devices can collide on is the current one.
 *   3. A month of a life is a legible unit in a `git log`.
 *
 * ---- what this does not do --------------------------------------------------
 *
 * It does not fire `repository_dispatch` at the portal the way saving a wiki
 * page does. The portal's sync only reads `wiki/**`, `sage/questions/**` and
 * `plain/**`, so a dispatch would rebuild the site for a file it does not look
 * at. The ledger reads its own data live through this module instead, which is
 * also why intake data never enters `public/` or the deployed bundle.
 */

import { readFile, listDir, writeFile, SOURCE_REPO } from '../wiki/publish'
import {
  mergeLogs,
  orderLog,
  parseJsonl,
  SHARD,
  shardOf,
  toJsonl,
  type LedgerEvent,
} from './events.ts'
import { project, type Ledger } from './project.ts'
import {
  appendLocal,
  clearFromOutbox,
  loadLocal,
  outbox,
  rememberShard,
  rememberSync,
  replaceLog,
} from './store.ts'

export const DIR = 'data/intake'
const INDEX = `${DIR}/units.json`

// The shard naming, the total order and the union are all facts about the log
// file rather than about syncing it, so they live in `events.ts` where the
// contract check can reach them without pulling a browser in behind them.
export { SHARD, shardOf } from './events.ts'

export type SyncReport = {
  at: string
  pushed: number
  pulled: number
  shards: string[]
  /** Named rather than thrown: one bad shard must not cost the others. */
  problems: string[]
}

/**
 * Push what is local, pull what is not, in one pass.
 *
 * Never throws for a network or credential failure: the local log is complete
 * and correct without any of this, and a capture tool that shows an error page
 * because GitHub is unreachable has misunderstood which half is important. The
 * failure is returned in `problems` and shown as a badge.
 */
export async function sync(): Promise<SyncReport> {
  const at = new Date().toISOString()
  const report: SyncReport = { at, pushed: 0, pulled: 0, shards: [], problems: [] }

  const local = await loadLocal()
  report.problems.push(...local.problems.map((p) => `local log: ${p}`))

  let remoteShards: string[] = []
  try {
    remoteShards = (await listDir(SOURCE_REPO, DIR)).map((f) => f.name).filter((n) => SHARD.test(n))
  } catch (error) {
    report.problems.push(`could not list ${DIR}: ${(error as Error).message}`)
    return report
  }

  const localShards = new Set(local.events.map(shardOf))
  const shards = [...new Set([...remoteShards, ...localShards])].sort()
  const pulled: LedgerEvent[] = []
  const confirmed: string[] = []

  for (const shard of shards) {
    try {
      const result = await reconcile(shard, local.events.filter((e) => shardOf(e) === shard))
      report.shards.push(shard)
      report.pushed += result.pushed
      pulled.push(...result.pulled)
      confirmed.push(...result.confirmed)
    } catch (error) {
      report.problems.push(`${shard}: ${(error as Error).message}`)
    }
  }

  if (pulled.length) {
    // Rewrite the local file from the merged whole rather than appending, so
    // the two copies stay byte-identical and the next comparison is cheap.
    const whole = mergeLogs(local.events, pulled)
    await replaceLog(toJsonl(whole))
    report.pulled = pulled.length
  }
  if (confirmed.length) await clearFromOutbox(confirmed)

  // The derived index is a convenience for anything reading the repository
  // without folding the log. It is never read back by this app, so a failure
  // to write it is not a failure to sync.
  try {
    const events = pulled.length ? mergeLogs(local.events, pulled) : local.events
    await writeIndex(events)
  } catch (error) {
    report.problems.push(`units.json: ${(error as Error).message}`)
  }

  await rememberSync(at)
  return report
}

/** One shard, read-merge-write, retrying a stale sha up to three times. */
async function reconcile(
  shard: string,
  mine: LedgerEvent[],
): Promise<{ pushed: number; pulled: LedgerEvent[]; confirmed: string[] }> {
  const path = `${DIR}/${shard}`

  for (let attempt = 0; attempt < 3; attempt++) {
    const remote = await readFile(SOURCE_REPO, path)
    const theirs = parseJsonl(remote?.text ?? '')
    const upstream = new Set(theirs.events.map((e) => e.id))
    const held = new Set(mine.map((e) => e.id))

    const pulled = theirs.events.filter((e) => !held.has(e.id))
    const pushing = mine.filter((e) => !upstream.has(e.id))

    if (!pushing.length) {
      // Nothing of ours is missing upstream, so everything of ours is confirmed.
      if (remote) await rememberShard(shard, remote.sha)
      return { pushed: 0, pulled, confirmed: mine.map((e) => e.id) }
    }

    const text = toJsonl(mergeLogs(theirs.events, mine))
    const written = await writeFile(
      SOURCE_REPO,
      path,
      text,
      `intake: ${pushing.length} event${pushing.length === 1 ? '' : 's'} (${shard.slice(7, 14)})`,
      remote?.sha ?? null,
    )
    if (written === 'conflict') continue // somebody else wrote; re-read and merge again

    await rememberShard(shard, written.sha)
    return { pushed: pushing.length, pulled, confirmed: mine.map((e) => e.id) }
  }

  throw new Error('three writers collided on this shard — try again')
}

/**
 * The derived snapshot: current state of every unit, without the event log.
 *
 * Deterministic on purpose — no `generatedAt`, no wall clock anywhere in it —
 * so it is rewritten only when a unit actually changed rather than on every
 * sync, and so two devices produce identical bytes from identical logs. The
 * "as of" is `throughEvent`, which is a fact about the log rather than about
 * when somebody happened to open the page.
 */
async function writeIndex(events: LedgerEvent[]) {
  if (!events.length) return
  const all = orderLog(events)
  const ledger = project(all)
  const body = {
    schema: 'intake-ledger/units@1',
    throughEvent: all[all.length - 1].id,
    events: all.length,
    units: ledger.units.map((unit) => ({
      id: unit.id,
      substance: unit.substance,
      quantity: unit.quantity,
      uom: unit.uom,
      receivedAt: unit.receivedAt,
      status: unit.status,
      closedAt: unit.closure?.closedAt ?? null,
      disposition: unit.closure?.disposition ?? null,
      reconciliation: unit.closure?.reconciliation ?? null,
      events: unit.tally.events,
      measured: unit.tally.measured,
      estimated: unit.tally.estimated,
      unquantified: unit.tally.unquantified,
      voided: unit.tally.voided,
      measuredQuantity: round(unit.tally.measuredQuantity),
      quantifiedQuantity: round(unit.tally.quantifiedQuantity),
      adjustedOut: round(unit.tally.adjustedOut),
      remainingAtMost: round(unit.tally.remainingAtMost),
      remainingExact: unit.tally.remainingExact,
      coverage: round(unit.tally.coverage),
    })),
  }
  const text = JSON.stringify(body, null, 2) + '\n'
  const current = await readFile(SOURCE_REPO, INDEX)
  if (current?.text === text) return
  await writeFile(SOURCE_REPO, INDEX, text, 'intake: refresh the derived unit index', current?.sha ?? null)
}

/** Six places is past any scale in use and short of float noise in the diff. */
const round = (n: number) => Math.round(n * 1e6) / 1e6

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
 * The sync is started and deliberately not awaited: the caller is a button
 * press and the event is already durable by the time this resolves.
 */
export async function record(events: LedgerEvent[]): Promise<LedgerState> {
  await appendLocal(events)
  return loadLedger()
}
