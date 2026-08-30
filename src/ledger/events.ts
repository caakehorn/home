/**
 * THE INTAKE LEDGER — the event log, and nothing else.
 *
 * A finite object enters the record. Every known disposition of that object is
 * recorded against it. At closure the ledger reconciles what is known, preserves
 * what is unknown, and computes only what the evidence actually supports.
 *
 * That sentence is the whole design, and this file is the part of it that has to
 * be right first: the append-only log every other module is a reading of.
 *
 * ---- why events rather than rows -------------------------------------------
 *
 * The obvious build stores `remaining: 2.14` and updates it. That number is a
 * conclusion wearing the clothes of a fact — it cannot say how it got there, it
 * cannot be re-derived after a bug, and correcting it destroys the thing it was
 * corrected from. So nothing here is ever updated in place. A mistyped dose is
 * not edited; it is followed by an `intake_corrected` carrying the old value and
 * a reason. A dose logged twice is followed by an `intake_voided`. The
 * projection in `project.ts` applies both and shows the corrected figure, and
 * the provenance survives underneath it where somebody can look.
 *
 * This matters more here than it would in most ledgers. The corpus this feeds
 * exists because recollection is the least reliable witness available about this
 * particular subject, and a log that can be quietly rewritten to agree with a
 * memory is worth nothing against one. An append-only log cannot be argued with.
 *
 * ---- three programs read this shape ----------------------------------------
 *
 *   1. `project.ts` here — the reducer the UI renders.
 *   2. `scripts/check-ledger.mjs` here — the contract check, which fails the
 *      build rather than letting a format drift ship.
 *   3. `bin/wiki-intake` in caakehorn/wiki-brain — the analysis side, which
 *      parses these lines in Python with no shared code whatsoever.
 *
 * The third is the reason the format is boring on purpose: one JSON object per
 * line, flat, no dates that need a library, every enum a literal string. Change
 * the shape in all three or in none.
 *
 * ---- why the imports in this directory carry `.ts` --------------------------
 *
 * Nothing else in `src/` writes `./events.ts` rather than `./events`. These
 * modules do, because `scripts/check-ledger.mjs` runs them under Node's type
 * stripping rather than through Vite, and Node's resolver will not guess an
 * extension. `allowImportingTsExtensions` is already on for exactly this. The
 * alternative is a contract check that cannot import the thing it checks.
 *
 * ---- on timestamps ----------------------------------------------------------
 *
 * Every instant is an ISO 8601 string carrying an explicit offset — never a bare
 * local time, and never a UTC instant with the offset thrown away. Time-of-day
 * is one of the few things this dataset can answer well, and `03:40-04:00` and
 * `07:40Z` are the same instant but not the same fact about a night. Keeping the
 * offset means the local hour is recoverable by reading two characters, with no
 * timezone database anywhere in the stack.
 */

/** Bumped only for a change the readers above cannot absorb silently. */
export const LOG_VERSION = 1

/**
 * What the log calls this writer.
 *
 * `bin/intake`'s own shape, with `interface: 'portal'` — that field is upstream's
 * discriminator between its CLI, the local app's Special:Intake, and this. The
 * value is re-exported from `wire.ts`, which owns the format.
 */
export { SOURCE } from './wire.ts'

// ---------------------------------------------------------------------------
// the vocabulary

/**
 * How well a quantity is known. The distinction is the point of the tool.
 *
 * `measured` came off a scale. `estimated` is a number somebody produced from
 * looking at it. `unquantified` is a real event with no number at all — "one
 * line", "a bump" — which still happened, still gets a timestamp, and still
 * counts toward every behavioural statistic, while contributing nothing to the
 * arithmetic. Dropping those events would make the record cleaner and false.
 */
export type Measurement = 'measured' | 'estimated' | 'unquantified'

export type Confidence = 'low' | 'medium' | 'high'

/** How a unit left the record. */
export type Disposition = 'consumed' | 'discarded' | 'transferred' | 'unknown' | 'other'

/**
 * What the closer says happened to the difference between the initial quantity
 * and everything the log accounts for.
 *
 * There is no default and no automatic choice, because the automatic choice is
 * always "assume it was consumed", which is precisely the invented precision
 * this ledger exists to refuse.
 */
export type Reconciliation =
  /** A last intake nobody logged, recorded now as an estimate of that size. */
  | 'final_intake'
  /** The scale and the log disagree and nobody knows why. Recorded as unknown. */
  | 'discrepancy'
  | 'lost'
  | 'transferred'
  | 'other'

/** Why material left a unit without being taken. */
export type AdjustmentKind =
  | 'spill'
  | 'loss'
  | 'transfer'
  | 'seizure'
  | 'disposal'
  /** The one that puts material back. Carries the direction upstream. */
  | 'found'
  | 'correction'

// ---------------------------------------------------------------------------
// the events

type Base = {
  id: string
  /** When the row was written down, which is not when the thing happened. */
  loggedAt: string
  source: { application: string; tool: string; interface: string }
}

/**
 * Anything the four dedicated fields do not have a slot for.
 *
 * Substance, amount, unit of measure and time are the four a dose cannot be
 * read without, and they are columns. Everything else about a dose is
 * open-ended and nobody knows the list in advance — route, who was there, what
 * it was cut with, how it landed — so it is a bag of strings rather than a
 * schema somebody has to keep amending.
 *
 * It rides inside `data.extra` on the wire, which `bin/intake` reads past
 * without complaint: that program validates the event `type` strictly and
 * ignores keys in `data` it does not know. So this extends the record without
 * forking the format, which a new event type would do immediately.
 */
export type Extra = Record<string, string>

/** A finite object enters the record. */
export type UnitOpened = Base & {
  type: 'unit_opened'
  unit: string
  substance: string
  /** The catalogue id from `intake/substances.json`, which upstream resolves. */
  substanceId?: string
  category?: string
  quantity: number
  uom: string
  receivedAt: string
  /** Where it came from, in whatever words. Free text on purpose. */
  origin?: string
  note?: string
  extra?: Extra
  /**
   * A unit of one: opened, consumed and closed in a single action.
   *
   * Set by `singleDose()`. It is a real unit and every dose statistic counts
   * it, but it is excluded from statistics *about units* — a single dose has a
   * lifetime of zero by construction, and a hundred of them would drag the
   * median unit life to nothing while saying nothing true about how long a
   * unit lasts.
   */
  single?: boolean
}

/** One consumption event against one unit. */
export type IntakeLogged = Base & {
  type: 'intake_logged'
  unit: string
  occurredAt: string
  measurement: Measurement
  /** Absent exactly when `measurement` is `unquantified`. */
  quantity?: number
  uom?: string
  /** Meaningful for `estimated`; the honest half of an estimate. */
  confidence?: Confidence
  /** The words used when there was no number: "one line", "two hits". */
  descriptor?: string
  note?: string
  extra?: Extra
}

/** What a correction may change. Anything absent is left as it was. */
export type IntakePatch = {
  occurredAt?: string
  measurement?: Measurement
  quantity?: number | null
  uom?: string | null
  confidence?: Confidence | null
  descriptor?: string | null
  note?: string | null
}

/**
 * A logged intake was wrong.
 *
 * The corrected value goes in `patch`; the original stays where it always was,
 * one line above in the same file. `reason` is required because a correction
 * with no reason is indistinguishable from a revision, and the difference
 * between those two is the entire value of this log.
 */
export type IntakeCorrected = Base & {
  type: 'intake_corrected'
  target: string
  /** Carried only so the wire envelope's `unit_id` can be filled in. */
  unit?: string
  reason: string
  patch: IntakePatch
}

/** A logged intake did not happen — a double tap, a wrong unit. */
export type IntakeVoided = Base & {
  type: 'intake_voided'
  target: string
  unit?: string
  reason: string
}

/** Material left the unit without being taken, or came back. */
export type UnitAdjusted = Base & {
  type: 'unit_adjusted'
  unit: string
  occurredAt: string
  quantity: number
  uom: string
  direction: 'out' | 'in'
  kind: AdjustmentKind
  reason: string
}

/** The unit's own particulars were wrong. */
export type UnitAmended = Base & {
  type: 'unit_amended'
  unit: string
  /** Upstream aims one `event_corrected` at the unit's own `unit_created` row. */
  target: string
  reason: string
  patch: {
    substance?: string
    quantity?: number
    uom?: string
    receivedAt?: string
    origin?: string | null
    note?: string | null
  }
}

/** The unit is finished, one way or another. */
export type UnitClosed = Base & {
  type: 'unit_closed'
  unit: string
  closedAt: string
  disposition: Disposition
  /** Required when the log does not account for the whole unit. */
  reconciliation?: Reconciliation
  /** The difference as it stood at closing, in the unit's own uom. */
  unaccounted?: number
  uom?: string
  note?: string
}

/** Closed by mistake, or material turned up. */
export type UnitReopened = Base & {
  type: 'unit_reopened'
  unit: string
  reason: string
}

export type LedgerEvent =
  | UnitOpened
  | IntakeLogged
  | IntakeCorrected
  | IntakeVoided
  | UnitAdjusted
  | UnitAmended
  | UnitClosed
  | UnitReopened

export const EVENT_TYPES: LedgerEvent['type'][] = [
  'unit_opened',
  'intake_logged',
  'intake_corrected',
  'intake_voided',
  'unit_adjusted',
  'unit_amended',
  'unit_closed',
  'unit_reopened',
]

// ---------------------------------------------------------------------------
// identifiers

const CROCKFORD = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'

/**
 * ULID-shaped ids: 10 characters of millisecond timestamp, 16 of randomness.
 *
 * Sortable by creation, which makes the log readable in a `tail`, and unique
 * without coordination — which is the property that actually matters. Two
 * devices can both be offline, both append, and merge later without a
 * collision or a renumbering pass. A counter (`unit_001`) cannot do that, and
 * the first time it fails it fails by silently overwriting a real unit.
 */
export function ulid(at: Date = new Date(), random = randomBytes): string {
  let time = ''
  let ms = at.getTime()
  for (let i = 0; i < 10; i++) {
    time = CROCKFORD[ms % 32] + time
    ms = Math.floor(ms / 32)
  }
  const bytes = random(16)
  let tail = ''
  for (let i = 0; i < 16; i++) tail += CROCKFORD[bytes[i] % 32]
  return time + tail
}

function randomBytes(n: number): Uint8Array {
  const out = new Uint8Array(n)
  crypto.getRandomValues(out)
  return out
}

// The prefixes are upstream's. A reader that greps `intake_unit_` out of the
// log must not miss the rows this portal wrote.
export const unitId = (at?: Date) => `intake_unit_${ulid(at)}`
export const eventId = (at?: Date) => `intake_evt_${ulid(at)}`

// ---------------------------------------------------------------------------
// instants

/** ISO 8601 to the second, with an explicit offset or `Z`. Nothing else parses. */
export const INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/

/**
 * Now, as a local instant that remembers where it was local.
 *
 * `toISOString()` would be one line and would throw the offset away, taking
 * every time-of-day question in `analyze.ts` with it.
 */
export function nowLocal(at: Date = new Date()): string {
  const offset = -at.getTimezoneOffset()
  const sign = offset < 0 ? '-' : '+'
  const abs = Math.abs(offset)
  const pad = (n: number) => String(n).padStart(2, '0')
  return (
    `${at.getFullYear()}-${pad(at.getMonth() + 1)}-${pad(at.getDate())}` +
    `T${pad(at.getHours())}:${pad(at.getMinutes())}:${pad(at.getSeconds())}` +
    `${sign}${pad(Math.floor(abs / 60))}:${pad(abs % 60)}`
  )
}

/** Milliseconds since epoch. The one place an instant becomes a number. */
export const instant = (iso: string) => Date.parse(iso)

/**
 * The hour of the clock on the wall where it happened, 0–23.
 *
 * Two characters, because the offset was kept. A UTC instant would need a
 * timezone database to answer this and would still get it wrong across a DST
 * boundary.
 */
export const localHour = (iso: string) => Number(iso.slice(11, 13))

/** 0 = Sunday, in local time, by reconstructing the wall clock as if it were UTC. */
export function localDay(iso: string): number {
  return new Date(`${iso.slice(0, 19)}Z`).getUTCDay()
}

// ---------------------------------------------------------------------------
// the file

/**
 * One event, one line — in `bin/intake`'s format, not this module's.
 *
 * The translation is `wire.ts`, and the reason it is not here is that it is the
 * one file that has to be diffed against a Python program in another repository
 * when either end moves.
 */
import { fromWire, serialize } from './wire.ts'

export { serialize }

export const toJsonl = (events: LedgerEvent[]) =>
  events.length ? events.map(serialize).join('\n') + '\n' : ''

/**
 * Order the log the same way every time, on every device.
 *
 * By `timestamp`, then by id. Without a total order, two devices holding
 * exactly the same events would serialise different bytes, each would see the
 * other's file as changed, and they would take turns rewriting it forever.
 *
 * `bin/intake` appends in wall-clock order and never rewrites, so a file it
 * wrote is already in this order and re-ordering it is a no-op.
 */
export const orderLog = (events: LedgerEvent[]) =>
  [...events].sort((a, b) => instant(a.loggedAt) - instant(b.loggedAt) || a.id.localeCompare(b.id))

/**
 * Union two copies of the log by event id.
 *
 * This is the whole merge, and it is total: the log is append-only and every
 * event carries a ULID, so there is no last-writer-wins, no field-level
 * conflict, and nothing that two devices writing at once can lose. First
 * occurrence wins on a duplicate id, which only matters if a byte was corrupted
 * in transit, and either copy is equally good then.
 */
export function mergeLogs(a: LedgerEvent[], b: LedgerEvent[]): LedgerEvent[] {
  const byId = new Map<string, LedgerEvent>()
  for (const event of [...a, ...b]) if (!byId.has(event.id)) byId.set(event.id, event)
  return orderLog([...byId.values()])
}

export type ParseResult = { events: LedgerEvent[]; problems: string[] }

/**
 * Read the log, naming every line it could not use.
 *
 * A parser that skips bad lines quietly is how a ledger loses a week and still
 * renders a confident total. Problems are returned rather than thrown so one
 * corrupt line does not cost the other four thousand.
 */
export function parseJsonl(text: string): ParseResult {
  const events: LedgerEvent[] = []
  const problems: string[] = []
  const seen = new Set<string>()

  text.split('\n').forEach((line, i) => {
    const trimmed = line.trim()
    if (!trimmed) return
    let parsed: unknown
    try {
      parsed = JSON.parse(trimmed)
    } catch {
      problems.push(`line ${i + 1}: not JSON`)
      return
    }
    const event = fromWire(parsed)
    if (!event) {
      // `substance_added` is the catalogue rather than the record, and this
      // reader has no use for it. Silence is right for that and wrong for
      // everything else, so the row's own type decides which it gets.
      const type = (parsed as { type?: string })?.type
      if (type !== 'substance_added') problems.push(`line ${i + 1}: unusable ${type ?? 'row'}`)
      return
    }
    const problem = validate(event)
    if (problem) {
      problems.push(`line ${i + 1}: ${problem}`)
      return
    }
    // Appending the same file from two devices can duplicate a line. The id is
    // the identity, so the second copy is dropped rather than double-counted.
    if (seen.has(event.id)) return
    seen.add(event.id)
    events.push(event)
  })

  return { events, problems }
}

// ---------------------------------------------------------------------------
// validation

const isString = (v: unknown): v is string => typeof v === 'string' && v.length > 0
const isFinitePositive = (v: unknown) => typeof v === 'number' && Number.isFinite(v) && v > 0

/**
 * Whether a parsed object is an event this ledger can act on.
 *
 * Returns the reason it is not, or null. Strict about the things the projection
 * would otherwise have to guess at — a missing `unit`, a quantity that is a
 * string, an instant with no offset — because every one of those becomes a
 * wrong number three modules downstream rather than an error here.
 */
export function validate(value: unknown): string | null {
  if (!value || typeof value !== 'object') return 'not an object'
  const e = value as Record<string, unknown>

  if (!isString(e.id)) return 'no id'
  if (!isString(e.type)) return 'no type'
  if (!EVENT_TYPES.includes(e.type as LedgerEvent['type'])) return `unknown type ${e.type}`
  if (!isString(e.loggedAt) || !INSTANT.test(e.loggedAt)) return 'loggedAt is not an ISO instant'

  const instantField = (key: string) =>
    !isString(e[key]) || !INSTANT.test(e[key] as string) ? `${key} is not an ISO instant` : null

  switch (e.type) {
    case 'unit_opened': {
      if (!isString(e.unit)) return 'no unit'
      if (!isString(e.substance)) return 'no substance'
      if (!isFinitePositive(e.quantity)) return 'quantity must be a positive number'
      if (!isString(e.uom)) return 'no uom'
      return instantField('receivedAt')
    }
    case 'intake_logged': {
      if (!isString(e.unit)) return 'no unit'
      const bad = instantField('occurredAt')
      if (bad) return bad
      if (e.measurement !== 'measured' && e.measurement !== 'estimated' && e.measurement !== 'unquantified')
        return `bad measurement ${String(e.measurement)}`
      if (e.measurement === 'unquantified') {
        // The whole point of the category: no number, and nothing that could be
        // mistaken for one later.
        if (e.quantity !== undefined) return 'an unquantified intake carries no quantity'
      } else {
        if (!isFinitePositive(e.quantity)) return 'quantity must be a positive number'
        if (!isString(e.uom)) return 'a quantified intake needs a uom'
      }
      return null
    }
    case 'intake_corrected': {
      if (!isString(e.target)) return 'no target'
      if (!isString(e.reason)) return 'a correction needs a reason'
      if (!e.patch || typeof e.patch !== 'object') return 'no patch'
      return null
    }
    case 'intake_voided': {
      if (!isString(e.target)) return 'no target'
      if (!isString(e.reason)) return 'voiding needs a reason'
      return null
    }
    case 'unit_adjusted': {
      if (!isString(e.unit)) return 'no unit'
      const bad = instantField('occurredAt')
      if (bad) return bad
      if (!isFinitePositive(e.quantity)) return 'quantity must be a positive number'
      if (!isString(e.uom)) return 'no uom'
      if (e.direction !== 'out' && e.direction !== 'in') return 'direction must be out or in'
      if (!isString(e.reason)) return 'an adjustment needs a reason'
      return null
    }
    case 'unit_amended': {
      if (!isString(e.unit)) return 'no unit'
      if (!isString(e.reason)) return 'an amendment needs a reason'
      if (!e.patch || typeof e.patch !== 'object') return 'no patch'
      return null
    }
    case 'unit_closed': {
      if (!isString(e.unit)) return 'no unit'
      const bad = instantField('closedAt')
      if (bad) return bad
      if (!isString(e.disposition)) return 'no disposition'
      return null
    }
    case 'unit_reopened': {
      if (!isString(e.unit)) return 'no unit'
      if (!isString(e.reason)) return 'reopening needs a reason'
      return null
    }
    default:
      return `unknown type ${e.type}`
  }
}
