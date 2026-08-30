/**
 * Commands — the only place an event is ever constructed.
 *
 * A screen says "log 0.18 g against this unit". This turns that into a row for
 * the append-only log, stamps it, gives it an id, and validates it before it
 * can reach storage. Every write in the tool goes through one of these eight
 * functions, which is what makes the guarantees in `events.ts` guarantees
 * rather than conventions a future component might not know about.
 *
 * Two things are enforced here rather than left to the caller:
 *
 *   1. **A quantity of zero is not a dose of zero.** An empty box means the
 *      amount is unknown, which is `unquantified` with whatever words were
 *      used — not `measured: 0`, which would drag every mean downward with a
 *      number nobody measured. `intake()` does that conversion itself so no
 *      screen can get it wrong.
 *   2. **Nothing is destroyed.** There is no `deleteIntake`. A wrong row is
 *      corrected or voided, both of which are new events that carry the reason
 *      and leave the original in place.
 *
 * Every command throws on an event its own validator would reject. That is a
 * programming error rather than a user error — the forms are expected to have
 * checked first — and it is better as a loud failure at the boundary than as a
 * line the Python side quietly skips six weeks later.
 */

import {
  eventId,
  nowLocal,
  SOURCE,
  unitId,
  validate,
  type Confidence,
  type Disposition,
  type IntakePatch,
  type LedgerEvent,
  type Measurement,
  type Reconciliation,
  type AdjustmentKind,
} from './events.ts'

/**
 * One event minus the three fields every event gets stamped with here.
 *
 * Written as a distributive conditional rather than a plain
 * `Omit<LedgerEvent, …>`: `Omit` over a union collapses it to the fields the
 * members have in common, which would let `seal` accept a `unit_reopened` with
 * no `unit` on it. Distributing keeps the eight shapes eight shapes.
 */
type Body<T = LedgerEvent> = T extends LedgerEvent ? Omit<T, 'id' | 'loggedAt' | 'source'> : never

/** Stamp, identify, check. Anything that fails here never reaches the log. */
function seal(body: Body): LedgerEvent {
  const event = {
    id: eventId(),
    loggedAt: nowLocal(),
    source: { ...SOURCE },
    ...body,
  } as LedgerEvent
  const problem = validate(event)
  if (problem) throw new Error(`refusing to log a malformed ${body.type}: ${problem}`)
  return event
}

/** Trim to null, so an empty box is an absent field rather than an empty one. */
const text = (value: string | undefined | null) => {
  const trimmed = (value ?? '').trim()
  return trimmed.length ? trimmed : undefined
}

// ---------------------------------------------------------------------------

export type NewUnit = {
  substance: string
  quantity: number
  uom: string
  receivedAt?: string
  origin?: string
  note?: string
}

/** A finite object enters the record. Returns the event and the unit's id. */
export function openUnit(draft: NewUnit): { event: LedgerEvent; unit: string } {
  const unit = unitId()
  const event = seal({
    type: 'unit_opened' as const,
    unit,
    substance: draft.substance.trim(),
    quantity: draft.quantity,
    uom: draft.uom,
    receivedAt: draft.receivedAt ?? nowLocal(),
    origin: text(draft.origin),
    note: text(draft.note),
  })
  return { event, unit }
}

export type NewIntake = {
  unit: string
  /** Null or undefined means the amount is not known. */
  quantity?: number | null
  uom?: string
  /** `measured` unless said otherwise; ignored when there is no quantity. */
  measurement?: Measurement
  confidence?: Confidence
  /** The words used when there is no number. */
  descriptor?: string
  occurredAt?: string
  note?: string
}

/**
 * One consumption event.
 *
 * The measurement class is derived from what is actually present rather than
 * taken on trust: no usable number means `unquantified`, whatever the form
 * said. That is the one place in the tool where the code overrides the input,
 * and it overrides it in the direction of claiming less.
 */
export function intake(draft: NewIntake): LedgerEvent {
  const quantified =
    typeof draft.quantity === 'number' && Number.isFinite(draft.quantity) && draft.quantity > 0

  if (!quantified) {
    return seal({
      type: 'intake_logged' as const,
      unit: draft.unit,
      occurredAt: draft.occurredAt ?? nowLocal(),
      measurement: 'unquantified' as const,
      descriptor: text(draft.descriptor),
      note: text(draft.note),
    })
  }

  const measurement = draft.measurement === 'estimated' ? 'estimated' : 'measured'
  return seal({
    type: 'intake_logged' as const,
    unit: draft.unit,
    occurredAt: draft.occurredAt ?? nowLocal(),
    measurement,
    quantity: draft.quantity as number,
    uom: draft.uom ?? 'g',
    // An estimate with no stated confidence is a number pretending to be a
    // measurement; default it to the honest middle rather than leaving it off.
    confidence: measurement === 'estimated' ? (draft.confidence ?? 'medium') : undefined,
    descriptor: text(draft.descriptor),
    note: text(draft.note),
  })
}

/** The figure was wrong. The old one stays on the record. */
export const correctIntake = (target: string, patch: IntakePatch, reason: string) =>
  seal({ type: 'intake_corrected' as const, target, patch, reason: reason.trim() })

/** It did not happen. Out of every total, still in the log. */
export const voidIntake = (target: string, reason: string) =>
  seal({ type: 'intake_voided' as const, target, reason: reason.trim() })

/** Material left the unit without being taken — a spill, a share, a discard. */
export const adjustUnit = (draft: {
  unit: string
  quantity: number
  uom: string
  direction?: 'out' | 'in'
  kind?: AdjustmentKind
  reason: string
  occurredAt?: string
}) =>
  seal({
    type: 'unit_adjusted' as const,
    unit: draft.unit,
    occurredAt: draft.occurredAt ?? nowLocal(),
    quantity: draft.quantity,
    uom: draft.uom,
    direction: draft.direction ?? 'out',
    kind: draft.kind ?? 'other',
    reason: draft.reason.trim(),
  })

/** The unit's own particulars were wrong — the wrong weight, the wrong name. */
export const amendUnit = (
  unit: string,
  patch: {
    substance?: string
    quantity?: number
    uom?: string
    receivedAt?: string
    origin?: string | null
    note?: string | null
  },
  reason: string,
) => seal({ type: 'unit_amended' as const, unit, patch, reason: reason.trim() })

export type Closing = {
  unit: string
  disposition: Disposition
  /** Required whenever the log does not account for the whole unit. */
  reconciliation?: Reconciliation
  unaccounted?: number
  uom?: string
  closedAt?: string
  note?: string
}

/**
 * The unit is finished.
 *
 * `unaccounted` is recorded as it stood at closing rather than recomputed
 * later, because it is a claim about what was known at the time — a correction
 * filed next week changes the arithmetic but must not silently change what the
 * closer was looking at when they chose how to reconcile it.
 */
export function closeUnit(draft: Closing): LedgerEvent[] {
  const events: LedgerEvent[] = []

  // "Fully consumed, and the missing material was a last dose of about this
  // much" is two facts: a dose, and a closure. Recording it as one would bury a
  // consumption event inside a closure where no dose statistic would ever see
  // it, which is exactly the sort of quiet loss this ledger is built against.
  if (
    draft.reconciliation === 'final-intake-estimated' &&
    typeof draft.unaccounted === 'number' &&
    draft.unaccounted > 0 &&
    draft.uom
  ) {
    events.push(
      intake({
        unit: draft.unit,
        quantity: draft.unaccounted,
        uom: draft.uom,
        measurement: 'estimated',
        confidence: 'low',
        occurredAt: draft.closedAt ?? nowLocal(),
        note: 'reconstructed at closing from the unaccounted remainder',
      }),
    )
  }

  events.push(
    seal({
      type: 'unit_closed' as const,
      unit: draft.unit,
      closedAt: draft.closedAt ?? nowLocal(),
      disposition: draft.disposition,
      reconciliation: draft.reconciliation,
      unaccounted: draft.unaccounted,
      uom: draft.uom,
      note: text(draft.note),
    }),
  )

  return events
}

export const reopenUnit = (unit: string, reason: string) =>
  seal({ type: 'unit_reopened' as const, unit, reason: reason.trim() })
