/**
 * The local log — where an intake is written the instant the button is pressed.
 *
 * This exists because of one requirement that outranks every other one in the
 * tool: logging has to take no time and never fail. A dose is logged at four in
 * the morning, in a hurry, on a phone, possibly with no signal. If the button
 * waits on a network round trip, some fraction of events never get logged at
 * all — and a ledger with holes in it is worse than no ledger, because the
 * holes are invisible and the totals still look confident.
 *
 * So the write path is: append to IndexedDB, return, render. The network is
 * somebody else's problem — `sync.ts`, later, in the background, retrying. The
 * log is the source of truth on this device until it is also the source of
 * truth upstream, and both copies are the same append-only file.
 *
 * ---- why the whole log is one string ---------------------------------------
 *
 * An object store with one record per event is the textbook shape and it buys
 * nothing here. The file format *is* JSONL, so keeping it as JSONL means the
 * append is a string concatenation with no parse, no serialisation of the
 * existing rows, and no schema to migrate; the local copy is byte-identical to
 * what goes upstream; and a merge is one comparison instead of a cursor walk.
 * At ten thousand events this is about two megabytes and parses in a few
 * milliseconds, which is well past any plausible use of it.
 *
 * ---- the outbox ------------------------------------------------------------
 *
 * Events are appended locally and their ids pushed to an outbox. Sync removes
 * an id only once that event is confirmed present upstream. The outbox is
 * therefore the honest answer to "is any of this only on this phone", which is
 * the question the header badge asks.
 */

import { parseJsonl, serialize, type LedgerEvent } from './events.ts'

const DB = 'intake-ledger'
const STORE = 'log'
const VERSION = 1

const KEY_LOG = 'events'
const KEY_OUTBOX = 'outbox'
const KEY_SHARDS = 'shards'
const KEY_SYNCED = 'lastSync'

// ---------------------------------------------------------------------------
// IndexedDB, wrapped just enough

let opened: Promise<IDBDatabase> | null = null

function open(): Promise<IDBDatabase> {
  opened ??= new Promise((resolve, reject) => {
    const request = indexedDB.open(DB, VERSION)
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE)) request.result.createObjectStore(STORE)
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('could not open the local ledger'))
    request.onblocked = () => reject(new Error('the local ledger is open in another tab'))
  })
  return opened
}

function read<T>(key: string): Promise<T | undefined> {
  return open().then(
    (db) =>
      new Promise((resolve, reject) => {
        const request = db.transaction(STORE, 'readonly').objectStore(STORE).get(key)
        request.onsuccess = () => resolve(request.result as T | undefined)
        request.onerror = () => reject(request.error)
      }),
  )
}

/**
 * Read, transform, write — inside one transaction.
 *
 * Two log buttons pressed a hundred milliseconds apart is not a hypothetical,
 * and a read-then-write across two transactions loses one of them. IndexedDB
 * serialises `readwrite` transactions on the same store, so doing both halves
 * inside one is what makes concurrent appends safe.
 */
function mutate<T>(key: string, change: (current: T | undefined) => T): Promise<T> {
  return open().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(STORE, 'readwrite')
        const store = tx.objectStore(STORE)
        const request = store.get(key)
        let next: T
        request.onsuccess = () => {
          next = change(request.result as T | undefined)
          store.put(next, key)
        }
        tx.oncomplete = () => resolve(next)
        tx.onerror = () => reject(tx.error)
        tx.onabort = () => reject(tx.error ?? new Error('the local write was aborted'))
      }),
  )
}

// ---------------------------------------------------------------------------
// the log

/** The whole local log as JSONL. Empty string when there is none yet. */
export const readLog = () => read<string>(KEY_LOG).then((t) => t ?? '')

/** The log, parsed, with any unusable lines named rather than dropped. */
export const loadLocal = () => readLog().then(parseJsonl)

/**
 * Append events and remember that they are not upstream yet.
 *
 * Returns once the transaction has committed, so a caller that awaits this
 * knows the event survives a closed tab. That await is the only thing the log
 * button waits for.
 */
export async function appendLocal(events: LedgerEvent[]): Promise<void> {
  if (!events.length) return
  const lines = events.map(serialize).join('\n') + '\n'
  await mutate<string>(KEY_LOG, (current) => (current ?? '') + lines)
  const ids = events.map((e) => e.id)
  await mutate<string[]>(KEY_OUTBOX, (current) => [...(current ?? []), ...ids])
}

/**
 * Replace the log wholesale, after a merge has produced a better version of it.
 *
 * Only `sync.ts` calls this, and only with a superset of what was there — the
 * merge is a union by event id, so nothing local is ever dropped by it.
 */
export const replaceLog = (text: string) => mutate<string>(KEY_LOG, () => text).then(() => undefined)

// ---------------------------------------------------------------------------
// the outbox and the sync bookkeeping

export const outbox = () => read<string[]>(KEY_OUTBOX).then((ids) => ids ?? [])

/** Drop ids now confirmed upstream. Anything not confirmed stays waiting. */
export const clearFromOutbox = (confirmed: string[]) => {
  const done = new Set(confirmed)
  return mutate<string[]>(KEY_OUTBOX, (current) => (current ?? []).filter((id) => !done.has(id)))
}

/** Last-known blob sha per shard, so a write can refuse to clobber. */
export const shardShas = () => read<Record<string, string>>(KEY_SHARDS).then((m) => m ?? {})

export const rememberShard = (shard: string, sha: string) =>
  mutate<Record<string, string>>(KEY_SHARDS, (current) => ({ ...(current ?? {}), [shard]: sha }))

export const lastSync = () => read<string>(KEY_SYNCED)

export const rememberSync = (at: string) => mutate<string>(KEY_SYNCED, () => at)

/**
 * Everything, as one JSONL file, for a person who wants their data out.
 *
 * A tool that holds a record like this one and cannot hand it back is a trap,
 * so the export is a first-class operation rather than a debugging affordance.
 */
export const exportLog = readLog
