/**
 * CLOSE UNIT — the screen that refuses to do the arithmetic for you.
 *
 * A unit begins at 3.5 g. Ten events account for 2.84 g. The unit is gone. The
 * obvious build closes it and reports an average dose of 0.35 g, and that
 * number is a fabrication: 0.66 g of the unit is unexplained, and dividing the
 * *whole unit* by the *logged events* silently assumes the log is complete when
 * the only thing anybody knows for certain is that it is not.
 *
 * So closing asks two questions instead of none. How did it end — which may not
 * be "consumed" at all. And, when the log does not reach the whole unit, what
 * should be done with the difference. There is no default on the second, and
 * `SAVE` stays disabled until it is answered, because a default here is the
 * assumption this entire tool exists to refuse.
 *
 * The four answers are genuinely different facts, and the reports treat them as
 * different facts afterwards:
 *
 *   - a final intake nobody logged  → writes a real, low-confidence estimated
 *     dose, so it lands in the dose statistics where it belongs
 *   - the unquantified events took it → derives a mean for those events, kept
 *     apart from the quantified mean and labelled as derived
 *   - a discrepancy → derives nothing at all, and the gap stays on the report
 *     as a gap
 *   - lost, or transferred → the material left the unit without being taken,
 *     and no dose statistic should ever see it
 *
 * A negative difference — the log claiming more than the unit ever held — is a
 * real and useful signal rather than an error to clamp. It means a dose was
 * double-logged, or the initial weight was wrong, or the scale was. It is
 * shown, said plainly, and closing is not blocked on it.
 */

import { useState } from 'react'
import { closeUnit } from './commands.ts'
import type { Disposition, LedgerEvent, Reconciliation } from './events.ts'
import { unaccounted, type UnitRecord } from './project.ts'
import { format, quantity as withUnit } from './uom.ts'
import { Amount, pluralise } from './bits.tsx'

const ENDINGS: { value: Disposition; label: string; hint: string }[] = [
  { value: 'consumed', label: 'Fully consumed', hint: 'nothing left' },
  { value: 'lost', label: 'Lost or discarded', hint: 'it went, but not into anybody' },
  { value: 'transferred', label: 'Given or traded away', hint: 'somebody else has it' },
  { value: 'unknown', label: 'Unknown', hint: 'it is gone and the reason is not recorded' },
  { value: 'other', label: 'Other', hint: 'say so in the note' },
]

export function Closing({
  unit,
  onDone,
  onCancel,
}: {
  unit: UnitRecord
  onDone: (events: LedgerEvent[]) => void
  onCancel: () => void
}) {
  const [disposition, setDisposition] = useState<Disposition>('consumed')
  const [reconciliation, setReconciliation] = useState<Reconciliation | null>(null)
  const [note, setNote] = useState('')

  const gap = unaccounted(unit)
  // Below a thousandth of the unit's own smallest sensible division there is
  // nothing to reconcile — that is float noise, not missing material.
  const settled = Math.abs(gap) < 1e-6
  const over = gap < 0

  const choices: { value: Reconciliation; label: string; hint: string }[] = [
    {
      value: 'final-intake-estimated',
      label: `A last dose of about ${withUnit(Math.abs(gap), unit.uom)}, never logged`,
      hint: 'writes a real estimated dose, low confidence, into the dose statistics',
    },
    ...(unit.tally.unquantified > 0
      ? [
          {
            value: 'attributed-to-unquantified' as const,
            label: `The ${pluralise(unit.tally.unquantified, 'event')} logged without a figure took it`,
            hint: `derives a mean of ${withUnit(Math.abs(gap) / unit.tally.unquantified, unit.uom)} for those events, kept apart from the measured ones`,
          },
        ]
      : []),
    {
      value: 'discrepancy',
      label: 'Nobody knows — the scale and the log disagree',
      hint: 'derives nothing; the gap stays on the report as a gap',
    },
    { value: 'lost', label: 'Spilled, dropped or thrown out', hint: 'never taken, so no dose statistic sees it' },
    { value: 'transferred', label: 'Somebody else took it', hint: 'the same, and says who if you note it' },
    { value: 'other', label: 'Other — see the note', hint: '' },
  ]

  const needsReconciliation = !settled && disposition === 'consumed'
  const ready = !needsReconciliation || reconciliation !== null

  const save = () =>
    onDone(
      closeUnit({
        unit: unit.id,
        disposition,
        reconciliation: needsReconciliation ? (reconciliation ?? undefined) : undefined,
        unaccounted: settled ? undefined : gap,
        uom: unit.uom,
        note,
      }),
    )

  return (
    <div className="lg__sheet" role="dialog" aria-modal="true" aria-label={`Close unit — ${unit.substance}`}>
      <div className="lg__sheet-head">
        <div>
          <b className="lg__sheet-title">CLOSE UNIT</b>
          <span className="lg__sheet-sub">
            {unit.substance} · {format(unit.quantity, unit.uom)} {unit.uom}
          </span>
        </div>
        <button type="button" className="lg__x" onClick={onCancel} aria-label="Cancel">
          ✕
        </button>
      </div>

      <table className="lg__recon">
        <tbody>
          <tr>
            <th scope="row">Initial quantity</th>
            <td>
              <Amount value={unit.quantity} uom={unit.uom} />
            </td>
          </tr>
          <tr>
            <th scope="row">Quantified intake</th>
            <td>
              <Amount value={unit.tally.quantifiedQuantity} uom={unit.uom} />
              <span className="lg__recon-note">
                over {pluralise(unit.tally.measured + unit.tally.estimated, 'event')}
              </span>
            </td>
          </tr>
          {unit.tally.adjustedOut > 0 && (
            <tr>
              <th scope="row">Spilled or given away</th>
              <td>
                <Amount value={unit.tally.adjustedOut} uom={unit.uom} />
              </td>
            </tr>
          )}
          {unit.tally.unquantified > 0 && (
            <tr>
              <th scope="row">Logged without a figure</th>
              <td>
                {pluralise(unit.tally.unquantified, 'event')}
                <span className="lg__recon-note">took an unknown amount</span>
              </td>
            </tr>
          )}
          <tr className={`lg__recon-gap${over ? ' lg__recon-gap--over' : ''}`}>
            <th scope="row">{over ? 'Logged beyond the unit' : 'Unaccounted difference'}</th>
            <td>
              <Amount value={Math.abs(gap)} uom={unit.uom} />
            </td>
          </tr>
        </tbody>
      </table>

      {over && (
        <p className="lg__warn">
          The log accounts for more than this unit ever held. That is worth knowing rather
          than rounding away: a dose was logged twice, or the initial weight was wrong. You
          can close it anyway — or cancel, correct the row, and come back.
        </p>
      )}

      <fieldset className="lg__fieldset">
        <legend>How did this unit end?</legend>
        {ENDINGS.map((ending) => (
          <label key={ending.value} className="lg__radio">
            <input
              type="radio"
              name="disposition"
              checked={disposition === ending.value}
              onChange={() => setDisposition(ending.value)}
            />
            <span>
              {ending.label}
              <em>{ending.hint}</em>
            </span>
          </label>
        ))}
      </fieldset>

      {needsReconciliation && (
        <fieldset className="lg__fieldset lg__fieldset--recon">
          <legend>
            What happened to the {withUnit(Math.abs(gap), unit.uom)} the log cannot account for?
          </legend>
          <p className="lg__hint">
            There is no default here on purpose. The automatic answer is always “assume it was
            consumed”, and that is the invented number this ledger exists to not produce.
          </p>
          {choices.map((choice) => (
            <label key={choice.value} className="lg__radio">
              <input
                type="radio"
                name="reconciliation"
                checked={reconciliation === choice.value}
                onChange={() => setReconciliation(choice.value)}
              />
              <span>
                {choice.label}
                {choice.hint && <em>{choice.hint}</em>}
              </span>
            </label>
          ))}
        </fieldset>
      )}

      <input
        className="lg__field"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="note — optional"
        aria-label="Note"
      />

      <div className="lg__sheet-actions">
        <button type="button" className="lg__save" disabled={!ready} onClick={save}>
          CLOSE UNIT
        </button>
        {!ready && <span className="lg__hint">choose what happened to the difference</span>}
      </div>
    </div>
  )
}
