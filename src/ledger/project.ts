/**
 * The projection — the event log read forward into the state a screen can show.
 *
 * `events.ts` holds what happened. This holds what is therefore true right now,
 * and it is rebuilt from the log every time rather than stored. That is the
 * whole reason the log is append-only: any bug in this file is a bug in a
 * derivation, fixable by fixing the derivation, and no history is lost to it.
 *
 * ---- the one rule this file exists to enforce ------------------------------
 *
 * A quantity that is not known is not estimated here, ever.
 *
 * The tempting arithmetic is `remaining = initial − (initial ÷ events × events)`
 * or any of its cousins, and every one of them manufactures a number out of a
 * shape. So the tally below carries `remainingAtMost` rather than `remaining`,
 * and `remainingExact` beside it saying whether the bound is tight. When a unit
 * has unquantified events against it, the material left is *at most* the
 * subtraction — those events took an unknown positive amount and the ledger
 * declines to guess which. The UI is required to render the bound as a bound.
 *
 * Same reason there is no `averageDose` here at all. There is
 * `quantifiedQuantity` and there is a count of quantified events, and the mean
 * of those two is computed in `analyze.ts` where it can be labelled with the
 * denominator it actually used.
 *
 * ---- corrections -----------------------------------------------------------
 *
 * `intake_corrected` and `intake_voided` point at an earlier event's id. They
 * are applied here in log order, and the value they replaced is kept on the
 * record as provenance rather than discarded — so a screen can show 0.05 g and
 * still answer "this was entered as 0.5 g and corrected as a decimal slip".
 */

import {
  instant,
  type Confidence,
  type Disposition,
  type LedgerEvent,
  type Measurement,
  type Reconciliation,
} from './events.ts'
import { convert } from './uom.ts'

// ---------------------------------------------------------------------------
// shapes

export type Correction = {
  at: string
  reason: string
  /** The fields as they stood before this correction landed. */
  before: Record<string, unknown>
}

export type IntakeRecord = {
  id: string
  unit: string
  occurredAt: string
  loggedAt: string
  measurement: Measurement
  quantity: number | null
  uom: string | null
  confidence: Confidence | null
  descriptor: string | null
  note: string | null
  corrections: Correction[]
  /** Set when the event was withdrawn. Kept in the record, out of every total. */
  voided: { at: string; reason: string } | null
}

export type AdjustmentRecord = {
  id: string
  occurredAt: string
  quantity: number
  uom: string
  direction: 'out' | 'in'
  kind: string
  reason: string
}

export type Closure = {
  at: string
  closedAt: string
  disposition: Disposition
  reconciliation: Reconciliation | null
  unaccounted: number | null
  uom: string | null
  note: string | null
}

/**
 * Everything the log accounts for, and — separately — everything it does not.
 *
 * Read the field names as a claim about evidence, because that is what they
 * are. `measuredQuantity` came off a scale. `quantifiedQuantity` includes
 * numbers somebody produced by looking. `unquantified` is a count of events
 * that contributed nothing to either and happened anyway.
 */
export type Tally = {
  events: number
  measured: number
  estimated: number
  unquantified: number
  voided: number
  measuredQuantity: number
  quantifiedQuantity: number
  adjustedOut: number
  adjustedIn: number
  /** initial − quantified − adjustedOut + adjustedIn, floored at zero. */
  remainingAtMost: number
  /** True only when nothing unquantified stands against this unit. */
  remainingExact: boolean
  /** Quantified events whose uom could not be converted into the unit's own. */
  unconvertible: number
  /** quantifiedQuantity ÷ initial — how much of the unit the log can speak for. */
  coverage: number
}

export type UnitRecord = {
  id: string
  substance: string
  quantity: number
  uom: string
  receivedAt: string
  openedAt: string
  origin: string | null
  note: string | null
  status: 'active' | 'closed'
  closure: Closure | null
  amendments: Correction[]
  /** Live intakes, oldest first. Voided ones are here too, flagged. */
  intakes: IntakeRecord[]
  adjustments: AdjustmentRecord[]
  tally: Tally
}

export type Ledger = {
  units: UnitRecord[]
  /** Events that referred to something the log never opened. */
  orphans: { id: string; type: string; unit?: string; target?: string }[]
}

// ---------------------------------------------------------------------------
// the reduction

const byOccurrence = (a: { occurredAt: string }, b: { occurredAt: string }) =>
  instant(a.occurredAt) - instant(b.occurredAt)

/**
 * Fold the log.
 *
 * Events are sorted by `loggedAt` before folding, not by `occurredAt`: a
 * correction has to land after the thing it corrects, and a dose backdated to
 * yesterday was still recorded today. Ordering by when the world was told is
 * the only ordering under which the fold is deterministic.
 */
export function project(events: LedgerEvent[]): Ledger {
  const ordered = [...events].sort(
    (a, b) => instant(a.loggedAt) - instant(b.loggedAt) || a.id.localeCompare(b.id),
  )

  const units = new Map<string, UnitRecord>()
  const intakeIndex = new Map<string, { unit: string; record: IntakeRecord }>()
  const orphans: Ledger['orphans'] = []

  for (const event of ordered) {
    switch (event.type) {
      case 'unit_opened': {
        if (units.has(event.unit)) break
        units.set(event.unit, {
          id: event.unit,
          substance: event.substance,
          quantity: event.quantity,
          uom: event.uom,
          receivedAt: event.receivedAt,
          openedAt: event.loggedAt,
          origin: event.origin ?? null,
          note: event.note ?? null,
          status: 'active',
          closure: null,
          amendments: [],
          intakes: [],
          adjustments: [],
          tally: emptyTally(),
        })
        break
      }

      case 'intake_logged': {
        const unit = units.get(event.unit)
        if (!unit) {
          orphans.push({ id: event.id, type: event.type, unit: event.unit })
          break
        }
        const record: IntakeRecord = {
          id: event.id,
          unit: event.unit,
          occurredAt: event.occurredAt,
          loggedAt: event.loggedAt,
          measurement: event.measurement,
          quantity: event.quantity ?? null,
          uom: event.uom ?? null,
          confidence: event.confidence ?? null,
          descriptor: event.descriptor ?? null,
          note: event.note ?? null,
          corrections: [],
          voided: null,
        }
        unit.intakes.push(record)
        intakeIndex.set(event.id, { unit: event.unit, record })
        break
      }

      case 'intake_corrected': {
        const found = intakeIndex.get(event.target)
        if (!found) {
          orphans.push({ id: event.id, type: event.type, target: event.target })
          break
        }
        const { record } = found
        const before: Record<string, unknown> = {}
        for (const key of Object.keys(event.patch) as (keyof typeof event.patch)[]) {
          const value = event.patch[key]
          if (value === undefined) continue
          before[key] = record[key as keyof IntakeRecord]
          // A patch may null a field out — that is how "it was an estimate, it
          // is actually unquantified" is expressed.
          ;(record as unknown as Record<string, unknown>)[key] = value
        }
        record.corrections.push({ at: event.loggedAt, reason: event.reason, before })
        break
      }

      case 'intake_voided': {
        const found = intakeIndex.get(event.target)
        if (!found) {
          orphans.push({ id: event.id, type: event.type, target: event.target })
          break
        }
        found.record.voided = { at: event.loggedAt, reason: event.reason }
        break
      }

      case 'unit_adjusted': {
        const unit = units.get(event.unit)
        if (!unit) {
          orphans.push({ id: event.id, type: event.type, unit: event.unit })
          break
        }
        unit.adjustments.push({
          id: event.id,
          occurredAt: event.occurredAt,
          quantity: event.quantity,
          uom: event.uom,
          direction: event.direction,
          kind: event.kind,
          reason: event.reason,
        })
        break
      }

      case 'unit_amended': {
        const unit = units.get(event.unit)
        if (!unit) {
          orphans.push({ id: event.id, type: event.type, unit: event.unit })
          break
        }
        const before: Record<string, unknown> = {}
        for (const key of Object.keys(event.patch) as (keyof typeof event.patch)[]) {
          const value = event.patch[key]
          if (value === undefined) continue
          before[key] = unit[key as keyof UnitRecord]
          ;(unit as unknown as Record<string, unknown>)[key] = value
        }
        unit.amendments.push({ at: event.loggedAt, reason: event.reason, before })
        break
      }

      case 'unit_closed': {
        const unit = units.get(event.unit)
        if (!unit) {
          orphans.push({ id: event.id, type: event.type, unit: event.unit })
          break
        }
        unit.status = 'closed'
        unit.closure = {
          at: event.loggedAt,
          closedAt: event.closedAt,
          disposition: event.disposition,
          reconciliation: event.reconciliation ?? null,
          unaccounted: event.unaccounted ?? null,
          uom: event.uom ?? null,
          note: event.note ?? null,
        }
        break
      }

      case 'unit_reopened': {
        const unit = units.get(event.unit)
        if (!unit) {
          orphans.push({ id: event.id, type: event.type, unit: event.unit })
          break
        }
        unit.status = 'active'
        // The closure stays on the record — a unit that was closed and reopened
        // is a different history from one that was never closed, and the report
        // says so.
        break
      }
    }
  }

  const list = [...units.values()]
  for (const unit of list) {
    unit.intakes.sort(byOccurrence)
    unit.adjustments.sort(byOccurrence)
    unit.tally = tally(unit)
  }
  // Newest unit first: the active one is nearly always the one being looked at.
  list.sort((a, b) => instant(b.receivedAt) - instant(a.receivedAt))

  return { units: list, orphans }
}

// ---------------------------------------------------------------------------
// the tally

const emptyTally = (): Tally => ({
  events: 0,
  measured: 0,
  estimated: 0,
  unquantified: 0,
  voided: 0,
  measuredQuantity: 0,
  quantifiedQuantity: 0,
  adjustedOut: 0,
  adjustedIn: 0,
  remainingAtMost: 0,
  remainingExact: true,
  unconvertible: 0,
  coverage: 0,
})

/** Live intakes only — voided events are history, not evidence. */
export const live = (unit: UnitRecord) => unit.intakes.filter((i) => !i.voided)

export function tally(unit: UnitRecord): Tally {
  const out = emptyTally()

  for (const intake of unit.intakes) {
    if (intake.voided) {
      out.voided++
      continue
    }
    out.events++
    if (intake.measurement === 'unquantified') {
      out.unquantified++
      continue
    }
    if (intake.measurement === 'measured') out.measured++
    else out.estimated++

    const amount =
      intake.quantity !== null && intake.uom ? convert(intake.quantity, intake.uom, unit.uom) : null
    if (amount === null) {
      // Counted, named, and kept out of every sum. A gram of something logged
      // against a unit measured in tablets is a real event and an unusable
      // number, and the report prints both facts.
      out.unconvertible++
      continue
    }
    out.quantifiedQuantity += amount
    if (intake.measurement === 'measured') out.measuredQuantity += amount
  }

  for (const adjustment of unit.adjustments) {
    const amount = convert(adjustment.quantity, adjustment.uom, unit.uom)
    if (amount === null) {
      out.unconvertible++
      continue
    }
    if (adjustment.direction === 'out') out.adjustedOut += amount
    else out.adjustedIn += amount
  }

  const spent = out.quantifiedQuantity + out.adjustedOut - out.adjustedIn
  out.remainingAtMost = Math.max(0, unit.quantity - spent)
  // The bound is tight only when nothing untallied stands against the unit.
  out.remainingExact = out.unquantified === 0 && out.unconvertible === 0
  out.coverage = unit.quantity > 0 ? out.quantifiedQuantity / unit.quantity : 0

  return out
}

/**
 * The gap between the unit and everything the log can speak for, at closing.
 *
 * Positive means material the ledger cannot account for. Negative means the log
 * claims more was taken than the unit ever held, which is a real and useful
 * signal — it means a dose was double-logged, or the initial quantity was
 * wrong, or the scale was.
 */
export const unaccounted = (unit: UnitRecord) =>
  unit.quantity - (unit.tally.quantifiedQuantity + unit.tally.adjustedOut - unit.tally.adjustedIn)

export const active = (ledger: Ledger) => ledger.units.filter((u) => u.status === 'active')
export const closed = (ledger: Ledger) => ledger.units.filter((u) => u.status === 'closed')
