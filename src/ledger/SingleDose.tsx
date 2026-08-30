/**
 * SINGLE DOSE — one dose, no unit behind it.
 *
 * The unit-based model assumes a finite quantity arrived and is being drawn
 * down. Plenty of doses do not work that way: somebody hands you something, or
 * you take one out of a bottle nobody is counting. Before this, the only ways
 * to record that were to skip the event or to open a fake unit to hold it, and
 * the second corrupts every unit statistic it touches.
 *
 * So this writes a **unit of one** — opened at the dose's own size, consumed,
 * and closed, in three events written together by `singleDose()`. It counts
 * toward every dose figure and is excluded from every figure about units.
 *
 * The four dedicated fields are the same four as everywhere else — substance,
 * amount, unit of measure, time — because the whole point of them being
 * dedicated is that one query reaches every dose in the ledger regardless of
 * how it was logged. Anything else goes in the extras bag.
 */

import { useEffect, useMemo, useRef, useState } from 'react'
import { singleDose } from './commands.ts'
import { nowLocal, type Extra, type LedgerEvent } from './events.ts'
import { substances, type Substance } from './sync.ts'
import { CODES } from './uom.ts'
import { ExtrasEditor } from './Extras.tsx'
import { Instant } from './bits.tsx'

const forInput = (iso: string) => iso.slice(0, 16)
const fromInput = (value: string) => `${value}:00${nowLocal().slice(-6)}`

export function SingleDoseSheet({
  onDone,
  onCancel,
}: {
  onDone: (events: LedgerEvent[]) => void
  onCancel: () => void
}) {
  const [substance, setSubstance] = useState('')
  const [text, setText] = useState('')
  const [uom, setUom] = useState('mg')
  const [estimated, setEstimated] = useState(false)
  const [descriptor, setDescriptor] = useState('')
  const [note, setNote] = useState('')
  const [extra, setExtra] = useState<Extra>({})
  const [at, setAt] = useState<string | null>(null)
  const [showTime, setShowTime] = useState(false)
  const [catalogue, setCatalogue] = useState<Substance[]>([])
  const field = useRef<HTMLInputElement>(null)

  useEffect(() => {
    field.current?.focus()
    void substances().then(setCatalogue)
  }, [])

  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel()
    }
    window.addEventListener('keydown', key)
    return () => window.removeEventListener('keydown', key)
  }, [onCancel])

  const matched = useMemo(() => {
    const q = substance.trim().toLowerCase()
    if (!q) return null
    return catalogue.find((s) => s.id.toLowerCase() === q || s.name.toLowerCase() === q) ?? null
  }, [substance, catalogue])

  const [uomTouched, setUomTouched] = useState(false)
  useEffect(() => {
    if (matched?.default_unit && !uomTouched) setUom(matched.default_unit)
  }, [matched, uomTouched])

  const parsed = (() => {
    const cleaned = text.trim().replace(/,/g, '.')
    if (!cleaned) return null
    const value = Number(cleaned)
    return Number.isFinite(value) && value > 0 ? value : NaN
  })()
  const bad = Number.isNaN(parsed)
  const named = substance.trim().length > 0

  const save = (quantity: number | null) =>
    onDone(
      singleDose({
        substance,
        substanceId: matched?.id,
        category: matched?.category,
        quantity,
        uom,
        measurement: estimated ? 'estimated' : 'measured',
        descriptor: quantity === null ? descriptor : undefined,
        occurredAt: at ?? undefined,
        note,
        extra,
      }).events,
    )

  return (
    <div className="lg__sheet" role="dialog" aria-modal="true" aria-label="Log a single dose">
      <div className="lg__sheet-head">
        <div>
          <b className="lg__sheet-title">SINGLE DOSE</b>
          <span className="lg__sheet-sub">no unit behind it — logged and closed at once</span>
        </div>
        <button type="button" className="lg__x" onClick={onCancel} aria-label="Cancel">
          ✕
        </button>
      </div>

      <label className="lg__label" htmlFor="lg-sd-substance">
        What was it?
      </label>
      <input
        id="lg-sd-substance"
        ref={field}
        className="lg__field"
        list="lg-sd-substances"
        value={substance}
        onChange={(e) => setSubstance(e.target.value)}
        placeholder="anything — it does not need to be tracked"
        autoComplete="off"
      />
      <datalist id="lg-sd-substances">
        {catalogue.map((s) => (
          <option key={s.id} value={s.name}>
            {s.category}
          </option>
        ))}
      </datalist>

      <label className="lg__label" htmlFor="lg-sd-qty">
        How much
      </label>
      <div className="lg__qty">
        <input
          id="lg-sd-qty"
          className={`lg__qty-field${bad ? ' lg__qty-field--bad' : ''}`}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && named && parsed && !bad) save(parsed)
          }}
          inputMode="decimal"
          autoComplete="off"
          placeholder="0.00"
          aria-label="Amount"
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

      <label className="lg__check">
        <input type="checkbox" checked={estimated} onChange={(e) => setEstimated(e.target.checked)} />
        <span>
          this is an estimate, not a weight
          <em>kept apart from measured doses in every statistic</em>
        </span>
      </label>

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

      <input
        className="lg__field"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="note — optional"
        aria-label="Note"
      />

      <ExtrasEditor value={extra} onChange={setExtra} />

      <div className="lg__sheet-actions">
        <button
          type="button"
          className="lg__save"
          disabled={!named || !parsed || bad}
          onClick={() => parsed && save(parsed)}
        >
          SAVE
        </button>
        <button
          type="button"
          className="lg__nofigure"
          disabled={!named}
          onClick={() => save(null)}
          title="record that it happened, with no quantity claimed"
        >
          NO FIGURE
        </button>
      </div>

      {!named && <p className="lg__hint">Name it first — a dose of nothing is not an event.</p>}

      {named && !parsed && (
        <div className="lg__descriptor">
          <input
            className="lg__field"
            value={descriptor}
            onChange={(e) => setDescriptor(e.target.value)}
            placeholder='in words — "one line", "half a tab"'
            aria-label="Descriptor"
          />
          <p className="lg__hint">
            Counted in every event total, interval and time-of-day figure, and summed into
            nothing. The unit it opens is one <code>dose</code> so the arithmetic has
            somewhere to hang; no total ever reads that 1 as an amount.
          </p>
        </div>
      )}
    </div>
  )
}
