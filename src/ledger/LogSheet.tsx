/**
 * LOG INTAKE — the one screen whose speed decides whether the dataset exists.
 *
 * Everything else here can be slow. This cannot. It is opened in a hurry, often
 * at an hour when nobody is careful, and every second of friction is a fraction
 * of events that never get logged at all — which does not show up as missing
 * data, it shows up as a confident total that is wrong. So:
 *
 *   - The quantity field is focused on open and takes Enter as SAVE. The whole
 *     interaction can be: tap LOG, type `.18`, Enter.
 *   - The quick picks are one tap and no typing. They are drawn from this
 *     unit's own history — the last dose and the median of the quantified ones
 *     — because those are the two numbers most likely to be right again, and
 *     both are arithmetic over the record rather than a guess about habits.
 *   - `NO FIGURE` is a first-class button beside SAVE, not a checkbox to find.
 *     An event logged without a number is worth far more than an event not
 *     logged, and the design has to make the honest path the fast one or it
 *     will get a fabricated number instead.
 *
 * ---- the input mode ---------------------------------------------------------
 *
 * `inputMode="decimal"` rather than `type="number"`: a number input on iOS
 * rejects a leading `.`, silently drops the value on a stray character, and
 * comes with steppers nobody wants at this size. The text is parsed here
 * instead, where a refusal can say what it refused.
 */

import { useEffect, useMemo, useRef, useState } from 'react'
import { intake } from './commands.ts'
import { nowLocal, type Extra, type LedgerEvent } from './events.ts'
import { median, quantifiedDoses } from './analyze.ts'
import { CODES, commensurable, format } from './uom.ts'
import type { UnitRecord } from './project.ts'
import { Instant } from './bits.tsx'
import { ExtrasEditor } from './Extras.tsx'

/** A local instant, to the minute, in the shape `<input type="datetime-local">` wants. */
const forInput = (iso: string) => iso.slice(0, 16)

/**
 * Back from that input, keeping the offset the device is on.
 *
 * The control hands back a wall-clock string with no zone at all. Re-attaching
 * the current offset is right for the overwhelmingly common case — correcting a
 * dose by an hour or two on the same day — and wrong only for a time entered
 * across a DST boundary, which is an hour of error on a backdated row rather
 * than a lost one.
 */
const fromInput = (value: string) => `${value}:00${nowLocal().slice(-6)}`

export function LogSheet({
  unit,
  onDone,
  onCancel,
}: {
  unit: UnitRecord
  onDone: (events: LedgerEvent[]) => void
  onCancel: () => void
}) {
  const [text, setText] = useState('')
  const [uom, setUom] = useState(unit.uom)
  const [estimated, setEstimated] = useState(false)
  const [descriptor, setDescriptor] = useState('')
  const [note, setNote] = useState('')
  const [extra, setExtra] = useState<Extra>({})
  const [at, setAt] = useState<string | null>(null)
  const [showTime, setShowTime] = useState(false)
  const field = useRef<HTMLInputElement>(null)

  useEffect(() => {
    field.current?.focus()
  }, [])

  // Escape closes. A sheet over the one screen that has to be fast should not
  // need a reach for the corner.
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel()
    }
    window.addEventListener('keydown', key)
    return () => window.removeEventListener('keydown', key)
  }, [onCancel])

  /**
   * Two numbers this unit has already produced, offered as one tap each.
   *
   * The last dose and the median of the quantified ones, deduplicated. Both are
   * counts over the record. Nothing here suggests a size — a suggestion would
   * be an instrument making a judgement, which is the one thing forbidden.
   */
  const picks = useMemo(() => {
    const doses = quantifiedDoses(unit)
    if (!doses.length) return []
    const last = doses[doses.length - 1].amount
    const mid = median(doses.map((d) => d.amount))
    const out: { value: number; label: string }[] = [{ value: last, label: 'last' }]
    if (mid !== null && Math.abs(mid - last) > 1e-9) out.push({ value: mid, label: 'median' })
    return out
  }, [unit])

  const parsed = (() => {
    const cleaned = text.trim().replace(/,/g, '.')
    if (!cleaned) return null
    const value = Number(cleaned)
    return Number.isFinite(value) && value > 0 ? value : NaN
  })()

  const mismatched = !commensurable(uom, unit.uom)
  const bad = Number.isNaN(parsed)

  const save = (quantity: number | null) => {
    onDone([
      intake({
        unit: unit.id,
        quantity,
        uom,
        measurement: estimated ? 'estimated' : 'measured',
        descriptor: quantity === null ? descriptor : undefined,
        note,
        occurredAt: at ?? undefined,
        extra,
      }),
    ])
  }

  return (
    <div className="lg__sheet" role="dialog" aria-modal="true" aria-label={`Log intake — ${unit.substance}`}>
      <div className="lg__sheet-head">
        <div>
          <b className="lg__sheet-title">LOG INTAKE</b>
          <span className="lg__sheet-sub">
            {unit.substance} · {format(unit.quantity, unit.uom)} {unit.uom}
          </span>
        </div>
        <button type="button" className="lg__x" onClick={onCancel} aria-label="Cancel">
          ✕
        </button>
      </div>

      {picks.length > 0 && (
        <div className="lg__picks">
          <span className="lg__picks-label">AGAIN</span>
          {picks.map((pick) => (
            <button
              key={pick.label}
              type="button"
              className="lg__pick"
              onClick={() => save(pick.value)}
            >
              {format(pick.value, unit.uom)} {unit.uom}
              <em>{pick.label}</em>
            </button>
          ))}
        </div>
      )}

      <div className="lg__qty">
        <input
          ref={field}
          className={`lg__qty-field${bad ? ' lg__qty-field--bad' : ''}`}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && parsed && !bad && !mismatched) save(parsed)
          }}
          inputMode="decimal"
          autoComplete="off"
          spellCheck={false}
          placeholder="0.00"
          aria-label="Quantity"
        />
        <select
          className="lg__uom"
          value={uom}
          onChange={(e) => setUom(e.target.value)}
          aria-label="Unit of measure"
        >
          {CODES.map((code) => (
            <option key={code} value={code}>
              {code}
            </option>
          ))}
        </select>
      </div>

      {mismatched && (
        <p className="lg__warn">
          {uom} cannot be subtracted from a unit measured in {unit.uom}. The event will be
          recorded and counted; it will not be added to any total.
        </p>
      )}

      <label className="lg__check">
        <input type="checkbox" checked={estimated} onChange={(e) => setEstimated(e.target.checked)} />
        <span>
          this is an estimate, not a weight
          <em>kept apart from measured doses in every statistic</em>
        </span>
      </label>

      <input
        className="lg__field"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="note — optional"
        aria-label="Note"
      />

      <ExtrasEditor value={extra} onChange={setExtra} />

      <div className="lg__time">
        {showTime ? (
          <input
            className="lg__field"
            type="datetime-local"
            value={forInput(at ?? nowLocal())}
            onChange={(e) => setAt(e.target.value ? fromInput(e.target.value) : null)}
            aria-label="When it happened"
          />
        ) : (
          <button type="button" className="lg__linkish" onClick={() => setShowTime(true)}>
            NOW — <Instant iso={nowLocal()} dateless /> · change
          </button>
        )}
      </div>

      <div className="lg__sheet-actions">
        <button
          type="button"
          className="lg__save"
          disabled={!parsed || bad}
          onClick={() => parsed && save(parsed)}
        >
          SAVE
        </button>
        <button
          type="button"
          className="lg__nofigure"
          onClick={() => save(null)}
          title="record that it happened, with no quantity claimed"
        >
          NO FIGURE
        </button>
      </div>

      {!parsed && (
        <div className="lg__descriptor">
          <input
            className="lg__field"
            value={descriptor}
            onChange={(e) => setDescriptor(e.target.value)}
            placeholder='in words — "one line", "two hits"'
            aria-label="Descriptor"
          />
          <p className="lg__hint">
            An event with no number still counts toward every interval, every time-of-day
            figure and every event total. It contributes nothing to the arithmetic, and the
            reports say so rather than spreading the difference around.
          </p>
        </div>
      )}
    </div>
  )
}
