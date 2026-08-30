/**
 * The capture surface — active units, and the one button that matters.
 *
 * A unit card is a standing inventory item: what it is, when it arrived, how
 * much of it the log can speak for, and how much is at most left. The LOG
 * INTAKE button is deliberately the largest thing on it. Everything else on
 * this screen — opening a unit, closing one, recording a spill — happens a
 * handful of times per unit. Logging happens dozens of times, in a hurry, and
 * every other affordance is arranged around not being in its way.
 *
 * ---- what the card will not say ---------------------------------------------
 *
 * No progress bar reading "68% consumed", because that is only true if the log
 * is complete. The bar here is labelled *accounted for* and measures exactly
 * what it says: quantified intake over initial quantity. When unquantified
 * events stand against the unit, the remainder is printed with a `≤` and the
 * component that renders it cannot drop the sign.
 */

import { useEffect, useMemo, useState } from 'react'
import { adjustUnit, openUnit } from './commands.ts'
import { exportLog } from './store.ts'
import { substances, type Substance } from './sync.ts'
import { nowLocal, type LedgerEvent } from './events.ts'
import { CODES, format } from './uom.ts'
import type { UnitRecord } from './project.ts'
import { Bound, Coverage, Instant, pluralise, since } from './bits.tsx'

export function UnitCard({
  unit,
  onLog,
  onClose,
  onSpill,
  onOpenReport,
}: {
  unit: UnitRecord
  onLog: () => void
  onClose: () => void
  onSpill: (events: LedgerEvent[]) => void
  onOpenReport: () => void
}) {
  const [spilling, setSpilling] = useState(false)
  const last = unit.intakes.filter((i) => !i.voided).at(-1)

  return (
    <article className="lg__card">
      <header className="lg__card-head">
        <h3 className="lg__card-name">{unit.substance}</h3>
        <span className="lg__card-size">
          {format(unit.quantity, unit.uom)} {unit.uom}
        </span>
      </header>

      <dl className="lg__card-facts">
        <div>
          <dt>Received</dt>
          <dd>
            <Instant iso={unit.receivedAt} /> · {since(unit.receivedAt)}
          </dd>
        </div>
        <div>
          <dt>Events</dt>
          <dd>
            {unit.tally.events}
            {unit.tally.unquantified > 0 && (
              <span className="lg__card-aside">
                {unit.tally.unquantified} without a figure
              </span>
            )}
          </dd>
        </div>
        <div>
          <dt>At most left</dt>
          <dd>
            <Bound
              value={unit.tally.remainingAtMost}
              uom={unit.uom}
              exact={unit.tally.remainingExact}
            />
          </dd>
        </div>
        <div>
          <dt>Last</dt>
          <dd>{last ? since(last.occurredAt) : <span className="lg__blank">none yet</span>}</dd>
        </div>
      </dl>

      <Coverage tally={unit.tally} />

      <button type="button" className="lg__log" onClick={onLog}>
        LOG INTAKE
      </button>

      <div className="lg__card-actions">
        <button type="button" className="lg__linkish" onClick={onOpenReport}>
          REPORT
        </button>
        <button type="button" className="lg__linkish" onClick={() => setSpilling((s) => !s)}>
          SPILL / GIVE AWAY
        </button>
        <button type="button" className="lg__linkish lg__linkish--end" onClick={onClose}>
          CLOSE UNIT
        </button>
      </div>

      {spilling && (
        <Spill
          unit={unit}
          onDone={(events) => {
            setSpilling(false)
            onSpill(events)
          }}
          onCancel={() => setSpilling(false)}
        />
      )}
    </article>
  )
}

/**
 * Material that left the unit without being taken.
 *
 * Kept out of the dose statistics entirely and subtracted from the remainder,
 * which is the whole reason it is a separate event type rather than a dose with
 * a note on it. A spill logged as a dose would show up in the mean forever.
 */
function Spill({
  unit,
  onDone,
  onCancel,
}: {
  unit: UnitRecord
  onDone: (events: LedgerEvent[]) => void
  onCancel: () => void
}) {
  const [text, setText] = useState('')
  const [reason, setReason] = useState('')
  const quantity = Number(text.trim().replace(/,/g, '.'))
  const ready = Number.isFinite(quantity) && quantity > 0 && reason.trim().length > 0

  return (
    <div className="lg__inline">
      <p className="lg__hint">
        Not a dose. Subtracted from what is left and kept out of every dose statistic.
      </p>
      <div className="lg__inline-row">
        <input
          className="lg__field lg__field--qty"
          value={text}
          onChange={(e) => setText(e.target.value)}
          inputMode="decimal"
          placeholder="0.00"
          aria-label="Quantity"
        />
        <span className="lg__inline-uom">{unit.uom}</span>
        <input
          className="lg__field"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="what happened — required"
          aria-label="Reason"
        />
      </div>
      <div className="lg__inline-actions">
        <button
          type="button"
          className="lg__save lg__save--small"
          disabled={!ready}
          onClick={() =>
            onDone([
              adjustUnit({ unit: unit.id, quantity, uom: unit.uom, kind: 'spill', reason }),
            ])
          }
        >
          RECORD
        </button>
        <button type="button" className="lg__linkish" onClick={onCancel}>
          CANCEL
        </button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------

/**
 * Opening a unit.
 *
 * Three fields, and only three are required: what, how much, in what. The
 * received time defaults to now and is worth changing only when it is not —
 * the whole duration figure on the report hangs off it, so it is offered
 * rather than buried.
 */
export function NewUnit({ onDone }: { onDone: (events: LedgerEvent[], unit: string) => void }) {
  const [open, setOpen] = useState(false)
  const [substance, setSubstance] = useState('')
  const [text, setText] = useState('')
  const [uom, setUom] = useState('g')
  const [origin, setOrigin] = useState('')
  const [receivedAt, setReceivedAt] = useState<string | null>(null)
  const [catalogue, setCatalogue] = useState<Substance[]>([])

  // `intake/substances.json` upstream — what `bin/intake` calls the select box,
  // and what it resolves a substance against rather than creating one on the
  // fly, "because silently creating one is how a select box degrades back into
  // free text". Offered here for the same reason. An unreachable catalogue
  // leaves the field as free text rather than blocking a unit.
  useEffect(() => {
    if (open) void substances().then(setCatalogue)
  }, [open])

  /** The catalogue row this text names, by id or by name, case-folded. */
  const matched = useMemo(() => {
    const q = substance.trim().toLowerCase()
    if (!q) return null
    return catalogue.find((s) => s.id.toLowerCase() === q || s.name.toLowerCase() === q) ?? null
  }, [substance, catalogue])

  // Picking a known substance adopts the unit it is normally measured in. Only
  // until the box is touched — an override stands.
  const [uomTouched, setUomTouched] = useState(false)
  useEffect(() => {
    if (matched?.default_unit && !uomTouched) setUom(matched.default_unit)
  }, [matched, uomTouched])

  const quantity = Number(text.trim().replace(/,/g, '.'))
  const ready = substance.trim().length > 0 && Number.isFinite(quantity) && quantity > 0

  const create = () => {
    const { event, unit } = openUnit({
      substance: matched?.name ?? substance,
      substanceId: matched?.id,
      category: matched?.category,
      quantity,
      uom,
      origin,
      receivedAt: receivedAt ?? undefined,
    })
    setSubstance('')
    setText('')
    setOrigin('')
    setReceivedAt(null)
    setOpen(false)
    onDone([event], unit)
  }

  if (!open) {
    return (
      <button type="button" className="lg__new-toggle" onClick={() => setOpen(true)}>
        + NEW UNIT
      </button>
    )
  }

  return (
    <section className="lg__new">
      <div className="lg__sheet-head">
        <b className="lg__sheet-title">NEW UNIT</b>
        <button type="button" className="lg__x" onClick={() => setOpen(false)} aria-label="Cancel">
          ✕
        </button>
      </div>

      <label className="lg__label" htmlFor="lg-substance">
        What is it?
      </label>
      <input
        id="lg-substance"
        className="lg__field"
        list="lg-substances"
        value={substance}
        onChange={(e) => setSubstance(e.target.value)}
        placeholder="cocaine, bupropion, nicotine — anything with a finite amount"
        autoComplete="off"
      />
      <datalist id="lg-substances">
        {catalogue.map((s) => (
          <option key={s.id} value={s.name}>
            {s.category}
          </option>
        ))}
      </datalist>
      {substance.trim() && !matched && catalogue.length > 0 && (
        <p className="lg__hint">
          Not in <code>intake/substances.json</code>. The unit files fine and every figure
          works, but <code>bin/intake</code> groups by catalogue id — add it there with{' '}
          <code>bin/intake substance add</code> to have it counted with the rest.
        </p>
      )}

      <label className="lg__label" htmlFor="lg-qty">
        Quantity received
      </label>
      <div className="lg__qty">
        <input
          id="lg-qty"
          className="lg__qty-field"
          value={text}
          onChange={(e) => setText(e.target.value)}
          inputMode="decimal"
          placeholder="3.5"
          autoComplete="off"
        />
        <select
          className="lg__uom"
          value={uom}
          onChange={(e) => {
            setUomTouched(true)
            setUom(e.target.value)
          }}
          aria-label="Unit of measure"
        >
          {CODES.map((code) => (
            <option key={code} value={code}>
              {code}
            </option>
          ))}
        </select>
      </div>

      <label className="lg__label" htmlFor="lg-when">
        When did it arrive?
      </label>
      <input
        id="lg-when"
        className="lg__field"
        type="datetime-local"
        value={(receivedAt ?? nowLocal()).slice(0, 16)}
        onChange={(e) =>
          setReceivedAt(e.target.value ? `${e.target.value}:00${nowLocal().slice(-6)}` : null)
        }
      />
      <p className="lg__hint">
        Every duration on the report is measured from here, so it is worth correcting when
        the unit did not arrive the moment it was entered.
      </p>

      <input
        className="lg__field"
        value={origin}
        onChange={(e) => setOrigin(e.target.value)}
        placeholder="where it came from — optional"
        aria-label="Origin"
      />

      <div className="lg__sheet-actions">
        <button type="button" className="lg__save" disabled={!ready} onClick={create}>
          CREATE UNIT
        </button>
      </div>
    </section>
  )
}

/**
 * Hand the whole log back, as the file it already is.
 *
 * `store.ts` keeps the local copy as JSONL rather than as rows precisely so
 * that this is a download and not a serialiser — what comes out is
 * byte-identical to what goes upstream, and it opens in anything.
 *
 * This is not a debugging affordance. A tool that holds a record like this one
 * and cannot give it back is a trap, and the person most likely to want it out
 * is the person least likely to be in a position to ask nicely.
 */
export function Export() {
  const [state, setState] = useState<'idle' | 'empty'>('idle')

  const download = async () => {
    const text = await exportLog()
    if (!text.trim()) {
      setState('empty')
      return
    }
    const url = URL.createObjectURL(new Blob([text], { type: 'application/x-ndjson' }))
    const link = document.createElement('a')
    link.href = url
    link.download = `intake-ledger-${new Date().toISOString().slice(0, 10)}.jsonl`
    link.click()
    // Revoking immediately races the download in Safari; a tick is enough and
    // the object is a few hundred kilobytes at worst.
    setTimeout(() => URL.revokeObjectURL(url), 10_000)
  }

  return (
    <button
      type="button"
      className="lg__linkish"
      onClick={() => void download()}
      title="the whole log, as the JSONL file it already is"
    >
      {state === 'empty' ? 'NOTHING TO EXPORT' : 'EXPORT'}
    </button>
  )
}

export const emptyMessage = (closed: number) =>
  closed > 0
    ? `No unit is open. ${pluralise(closed, 'closed unit')} in the record.`
    : 'Nothing is being tracked yet. Open a unit and the log starts.'
