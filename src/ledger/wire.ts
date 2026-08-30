/**
 * The wire format — `bin/intake`'s file, written from a browser.
 *
 * This module exists because two people built the same ledger at the same time.
 * `caakehorn/wiki-brain` landed `bin/intake` with its own on-disk shape; this
 * portal was built against a shape of its own. Only one of them can be the
 * format, and it is not this one: that repository owns the data, its tool is
 * merged, and the standing instruction was to adapt to an established data
 * architecture rather than invent a competing taxonomy. Two folds of the same
 * night that disagree is precisely what that rule is for.
 *
 * So the file this portal reads and writes is `intake/events.jsonl` in that
 * repository, byte-compatible with what `bin/intake` appends, and the
 * translation lives here rather than being smeared through the app.
 *
 * ---- why an adapter and not a rewrite ---------------------------------------
 *
 * The internal types in `events.ts` are what `project.ts` and `analyze.ts`
 * reduce over, and they are typed, discriminated and flat in a way a
 * `data: Record<string, unknown>` envelope is not. Translating once at the
 * serialisation boundary keeps that, keeps every downstream module unchanged,
 * and leaves exactly one file to check against the Python.
 *
 * The local IndexedDB copy is stored in wire format too, so the local file and
 * the upstream file are the same bytes and a merge is a comparison rather than
 * a conversion.
 *
 * ---- what was given up to stop forking --------------------------------------
 *
 * One idea did not survive the merge and it is worth naming rather than
 * quietly dropping: this portal had a fifth reconciliation, "the events logged
 * without a figure took the remainder", which derives a mean for those events
 * alone and keeps it apart from the measured mean. `bin/intake` has five
 * resolutions and that is not one of them. Adding it would fork the format for
 * one feature, so it is gone; the unaccounted amount and the unquantified count
 * are both still on every report, which is the honest half of what it did.
 *
 * Vocabulary that did change rather than disappear:
 *
 *   - `lost` as a disposition is `discarded` upstream
 *   - an adjustment's direction is carried by its `kind` — `found` is the way
 *     material comes back, everything else takes it away
 *   - amending a unit is an `event_corrected` aimed at its `unit_created` row
 */

import type {
  AdjustmentKind,
  Confidence,
  Disposition,
  LedgerEvent,
  Measurement,
  Reconciliation,
} from './events.ts'

/** What `bin/intake` stamps on every row. `interface` is the discriminator. */
export const SOURCE = {
  application: 'wiki-brain',
  tool: 'intake-ledger',
  interface: 'portal',
} as const

type Wire = {
  id: string
  type: string
  timestamp: string
  occurred_at: string
  unit_id: string | null
  data: Record<string, unknown>
  source: Record<string, unknown>
}

/** Keys in a fixed order, so a diff of the log shows what changed. */
const ORDER = ['id', 'type', 'timestamp', 'occurred_at', 'unit_id', 'data', 'source']

/** Drop undefined, keep explicit nulls — upstream writes `null`, not absence. */
const clean = (data: Record<string, unknown>) => {
  const out: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(data)) if (value !== undefined) out[key] = value
  return out
}

// ---------------------------------------------------------------------------
// out

export function toWire(event: LedgerEvent): Wire {
  const base = { id: event.id, timestamp: event.loggedAt, source: { ...SOURCE } }

  switch (event.type) {
    case 'unit_opened':
      return {
        ...base,
        type: 'unit_created',
        occurred_at: event.receivedAt,
        unit_id: event.unit,
        data: clean({
          substance: event.substance,
          substance_id: event.substanceId ?? null,
          category: event.category ?? null,
          quantity: event.quantity,
          unit: event.uom,
          source_context: event.origin ?? null,
          note: event.note ?? null,
        }),
      }

    case 'intake_logged':
      return {
        ...base,
        type: 'intake_logged',
        occurred_at: event.occurredAt,
        unit_id: event.unit,
        data: clean({
          quantity: event.quantity ?? null,
          unit: event.uom ?? null,
          measurement_type: event.measurement,
          confidence: event.confidence ?? null,
          descriptor: event.descriptor ?? null,
          note: event.note ?? null,
        }),
      }

    case 'intake_corrected':
      return {
        ...base,
        type: 'event_corrected',
        occurred_at: event.loggedAt,
        unit_id: event.unit ?? null,
        data: clean({
          target: event.target,
          fields: patchToWire(event.patch),
          reason: event.reason,
        }),
      }

    case 'intake_voided':
      return {
        ...base,
        type: 'event_voided',
        occurred_at: event.loggedAt,
        unit_id: event.unit ?? null,
        data: clean({ target: event.target, reason: event.reason }),
      }

    case 'unit_adjusted':
      return {
        ...base,
        type: 'unit_adjusted',
        occurred_at: event.occurredAt,
        unit_id: event.unit,
        data: clean({
          // Direction is not a field upstream; it is which kind you picked.
          kind: event.direction === 'in' ? 'found' : event.kind,
          quantity: event.quantity,
          unit: event.uom,
          note: event.reason,
        }),
      }

    case 'unit_amended':
      return {
        ...base,
        type: 'event_corrected',
        occurred_at: event.loggedAt,
        unit_id: event.unit,
        data: clean({
          target: event.target,
          fields: clean({
            substance: event.patch.substance,
            quantity: event.patch.quantity,
            unit: event.patch.uom,
            source_context: event.patch.origin,
            note: event.patch.note,
          }),
          reason: event.reason,
        }),
      }

    case 'unit_closed':
      return {
        ...base,
        type: 'unit_closed',
        occurred_at: event.closedAt,
        unit_id: event.unit,
        data: clean({
          disposition: event.disposition,
          reconciliation: {
            resolution: event.reconciliation ?? 'balanced',
            unaccounted: event.unaccounted ?? 0,
            quantity_unit: event.uom ?? null,
            overdrawn: (event.unaccounted ?? 0) < 0,
          },
          note: event.note ?? null,
        }),
      }

    case 'unit_reopened':
      return {
        ...base,
        type: 'unit_reopened',
        occurred_at: event.loggedAt,
        unit_id: event.unit,
        data: clean({ reason: event.reason }),
      }
  }
}

function patchToWire(patch: Record<string, unknown>) {
  const map: Record<string, string> = { uom: 'unit', measurement: 'measurement_type' }
  const out: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined) continue
    // Upstream strips nulls out of a correction's `fields`, so a patch that
    // clears something has nothing to say in this format.
    if (value === null) continue
    out[map[key] ?? key] = value
  }
  return out
}

export function serialize(event: LedgerEvent): string {
  const wire = toWire(event) as unknown as Record<string, unknown>
  const out: Record<string, unknown> = {}
  for (const key of ORDER) if (wire[key] !== undefined) out[key] = wire[key]
  return JSON.stringify(out)
}

// ---------------------------------------------------------------------------
// in

const str = (v: unknown) => (typeof v === 'string' && v ? v : undefined)
const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : undefined)

/**
 * A row from the file, as an internal event — or null for one this portal has
 * no use for.
 *
 * `substance_added` is the catalogue rather than the record, and a
 * `event_corrected` whose target this reader has never seen is somebody else's
 * problem; both come back null and are counted, not thrown.
 */
export function fromWire(row: unknown): LedgerEvent | null {
  if (!row || typeof row !== 'object') return null
  const w = row as Partial<Wire>
  const id = str(w.id)
  const type = str(w.type)
  const at = str(w.timestamp)
  if (!id || !type || !at) return null
  // After the guard, not before it: computed above, `occurred` keeps `at`'s
  // pre-narrowing `string | undefined` and every field it feeds goes optional.
  const occurred = str(w.occurred_at) ?? at
  const data = (w.data ?? {}) as Record<string, unknown>
  const unit = str(w.unit_id)
  const base = { id, loggedAt: at, source: { ...SOURCE } }

  switch (type) {
    case 'substance_added':
      return null

    case 'unit_created':
      if (!unit) return null
      return {
        ...base,
        type: 'unit_opened',
        unit,
        substance: str(data.substance) ?? 'unknown',
        substanceId: str(data.substance_id),
        category: str(data.category),
        quantity: num(data.quantity) ?? 0,
        uom: str(data.unit) ?? 'g',
        receivedAt: occurred,
        origin: str(data.source_context),
        note: str(data.note),
      }

    case 'intake_logged': {
      if (!unit) return null
      const measurement = str(data.measurement_type) as Measurement | undefined
      return {
        ...base,
        type: 'intake_logged',
        unit,
        occurredAt: occurred,
        measurement: measurement ?? 'unquantified',
        quantity: measurement === 'unquantified' ? undefined : num(data.quantity),
        uom: measurement === 'unquantified' ? undefined : str(data.unit),
        confidence: str(data.confidence) as Confidence | undefined,
        descriptor: str(data.descriptor),
        note: str(data.note),
      }
    }

    case 'event_corrected': {
      const target = str(data.target)
      if (!target) return null
      const fields = (data.fields ?? {}) as Record<string, unknown>
      // Upstream aims one event type at both an intake and a unit. Which one it
      // meant is readable from the fields it carries.
      const amendsUnit = 'substance' in fields || 'source_context' in fields
      if (amendsUnit && unit) {
        return {
          ...base,
          type: 'unit_amended',
          unit,
          target,
          reason: str(data.reason) ?? 'corrected upstream',
          patch: {
            substance: str(fields.substance),
            quantity: num(fields.quantity),
            uom: str(fields.unit),
            origin: str(fields.source_context),
            note: str(fields.note),
          },
        }
      }
      return {
        ...base,
        type: 'intake_corrected',
        unit,
        target,
        reason: str(data.reason) ?? 'corrected upstream',
        patch: {
          quantity: num(fields.quantity),
          uom: str(fields.unit),
          measurement: str(fields.measurement_type) as Measurement | undefined,
          confidence: str(fields.confidence) as Confidence | undefined,
          descriptor: str(fields.descriptor),
          note: str(fields.note),
          occurredAt: str(fields.occurred_at),
        },
      }
    }

    case 'event_voided': {
      const target = str(data.target)
      if (!target) return null
      return {
        ...base,
        type: 'intake_voided',
        unit,
        target,
        reason: str(data.reason) ?? 'voided upstream',
      }
    }

    case 'unit_adjusted': {
      if (!unit) return null
      const kind = str(data.kind) ?? 'loss'
      return {
        ...base,
        type: 'unit_adjusted',
        unit,
        occurredAt: occurred,
        quantity: num(data.quantity) ?? 0,
        uom: str(data.unit) ?? 'g',
        direction: kind === 'found' ? 'in' : 'out',
        kind: kind as AdjustmentKind,
        reason: str(data.note) ?? kind,
      }
    }

    case 'unit_closed': {
      if (!unit) return null
      const rec = (data.reconciliation ?? {}) as Record<string, unknown>
      const resolution = str(rec.resolution)
      return {
        ...base,
        type: 'unit_closed',
        unit,
        closedAt: occurred,
        disposition: (str(data.disposition) ?? 'unknown') as Disposition,
        reconciliation:
          resolution && resolution !== 'balanced' ? (resolution as Reconciliation) : undefined,
        unaccounted: num(rec.unaccounted),
        uom: str(rec.quantity_unit),
        note: str(data.note),
      }
    }

    case 'unit_reopened':
      if (!unit) return null
      return {
        ...base,
        type: 'unit_reopened',
        unit,
        reason: str(data.reason) ?? 'reopened upstream',
      }

    default:
      return null
  }
}
