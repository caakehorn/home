/**
 * THE UNIT REPORT — what one finite object turned out to be.
 *
 * Received, closed, and everything in between: how long it lasted, how many
 * times it was reached for, how big those times were when anybody measured, and
 * — the question a finite unit is actually interesting for — whether it went
 * faster at the end than at the start.
 *
 * ---- what is printed, and what is refused ------------------------------------
 *
 * Every figure here is a count, a date, a length, or a mean or median of those,
 * which is the standing rule for anything that draws this corpus (CLAUDE.md §2).
 * There is no score, no severity, no "heavy" or "light", and no threshold
 * chosen for what it would surface. The one span the report picks — the width
 * of the densest-window search — is printed beside the answer, because a
 * six-hour window and a twelve-hour window find different nights and a reader
 * who cannot see which was used is reading an opinion.
 *
 * Where the log cannot answer, the cell is blank and says why on hover. The
 * table never prints a zero standing in for a null, and never divides the unit
 * by the event count to produce an average the evidence does not support.
 *
 * ---- the event list ----------------------------------------------------------
 *
 * Every intake, including the voided ones, struck through and still legible.
 * A corrected row shows the figure it carries now and what it was corrected
 * from, because "0.05 g, entered as 0.5 g, decimal slip" is a different and
 * more trustworthy record than "0.05 g".
 */

import { useState } from 'react'
import { correctIntake, reopenUnit, voidIntake } from './commands.ts'
import type { LedgerEvent } from './events.ts'
import { duration, reportOn, WINDOW_HOURS } from './analyze.ts'
import { live, type IntakeRecord, type UnitRecord } from './project.ts'
import { format, quantity as withUnit } from './uom.ts'
import { Amount, Blank, Bound, Class, Figure, Instant, Span, pluralise, when } from './bits.tsx'

const DISPOSITION: Record<string, string> = {
  consumed: 'Fully consumed',
  lost: 'Lost or discarded',
  transferred: 'Given or traded away',
  unknown: 'Unknown',
  other: 'Other',
}

const RECONCILIATION: Record<string, string> = {
  'final-intake-estimated': 'a last dose, estimated at closing',
  'attributed-to-unquantified': 'attributed to the events logged without a figure',
  discrepancy: 'a discrepancy — nobody knows',
  lost: 'spilled, dropped or thrown out',
  transferred: 'somebody else took it',
  other: 'other',
}

export function Report({
  unit,
  onCommit,
  onBack,
}: {
  unit: UnitRecord
  onCommit: (events: LedgerEvent[]) => void
  onBack: () => void
}) {
  const r = reportOn(unit)
  const closed = unit.closure

  return (
    <article className="lg__report">
      <button type="button" className="lg__linkish" onClick={onBack}>
        ← ALL UNITS
      </button>

      <header className="lg__report-head">
        <h2 className="lg__report-name">{unit.substance}</h2>
        <span className="lg__report-size">
          {format(unit.quantity, unit.uom)} {unit.uom}
        </span>
        <span className={`lg__report-state lg__report-state--${unit.status}`}>
          {unit.status === 'active' ? 'OPEN' : 'CLOSED'}
        </span>
      </header>

      {unit.origin && <p className="lg__report-origin">{unit.origin}</p>}

      <table className="lg__table">
        <tbody>
          <Row label="Received">
            <Instant iso={unit.receivedAt} />
          </Row>
          <Row label={closed ? 'Closed' : 'Open since'}>
            {closed ? <Instant iso={closed.closedAt} /> : <Instant iso={unit.receivedAt} />}
          </Row>
          <Row label={closed ? 'Duration' : 'Open for'}>
            <Span ms={r.duration} />
          </Row>

          <Gap />

          <Row label="Consumption events">{r.events}</Row>
          <Row label="Quantified events" note="a weight, or a stated estimate">
            {r.quantifiedEvents}
          </Row>
          <Row label="Logged without a figure" note="counted everywhere, summed nowhere">
            {r.unquantifiedEvents}
          </Row>
          {r.voidedEvents > 0 && (
            <Row label="Voided" note="withdrawn; out of every total, still in the log">
              {r.voidedEvents}
            </Row>
          )}

          <Gap />

          <Row label="Quantified intake" note={`over ${pluralise(r.quantifiedEvents, 'event')}`}>
            <Figure value={r.quantified} uom={unit.uom} why="nothing quantified yet" />
          </Row>
          <Row label="Of which weighed">
            <Figure value={r.measured} uom={unit.uom} why="nothing weighed yet" />
          </Row>
          <Row label="At most remaining" note={unit.tally.remainingExact ? 'exact' : 'an upper bound'}>
            <Bound
              value={unit.tally.remainingAtMost}
              uom={unit.uom}
              exact={unit.tally.remainingExact}
            />
          </Row>
          <Row label="Accounted for">{Math.round(r.coverage * 100)}%</Row>

          <Gap />

          <Row label="Mean quantified dose" note={`÷ ${r.quantifiedEvents}, not ÷ ${r.events}`}>
            <Figure value={r.meanDose} uom={unit.uom} why="no quantified dose to average" />
          </Row>
          <Row label="Median">
            <Figure value={r.medianDose} uom={unit.uom} why="no quantified dose" />
          </Row>
          <Row label="Smallest">
            <Figure value={r.smallestDose} uom={unit.uom} why="no quantified dose" />
          </Row>
          <Row label="Largest">
            <Figure value={r.largestDose} uom={unit.uom} why="no quantified dose" />
          </Row>
          <Row label="Spread" note="standard deviation">
            <Figure value={r.doseSpread} uom={unit.uom} why="fewer than two quantified doses" />
          </Row>

          <Gap />

          <Row label="Mean interval">
            <Span ms={r.meanInterval} why="fewer than two events" />
          </Row>
          <Row label="Median interval">
            <Span ms={r.medianInterval} why="fewer than two events" />
          </Row>
          <Row label="Shortest">
            <Span ms={r.shortestInterval} why="fewer than two events" />
          </Row>
          <Row label="Longest">
            <Span ms={r.longestInterval} why="fewer than two events" />
          </Row>
          <Row label={`Densest ${r.windowHours}h`} note="the window holding the most events">
            {r.window ? (
              <span>
                {pluralise(r.window.events, 'event')} <br />
                <span className="lg__table-sub">from {when(r.window.start)}</span>
              </span>
            ) : (
              <Blank why="no events" />
            )}
          </Row>

          {unit.tally.adjustedOut > 0 && (
            <>
              <Gap />
              <Row label="Spilled or given away" note="never taken; out of every dose statistic">
                <Amount value={unit.tally.adjustedOut} uom={unit.uom} />
              </Row>
            </>
          )}

          {unit.tally.unconvertible > 0 && (
            <Row label="Unconvertible events" note={`logged in a unit that will not reduce to ${unit.uom}`}>
              {unit.tally.unconvertible}
            </Row>
          )}

          {closed && (
            <>
              <Gap />
              <Row label="How it ended">{DISPOSITION[closed.disposition] ?? closed.disposition}</Row>
              {closed.reconciliation && (
                <Row label="The difference" note={RECONCILIATION[closed.reconciliation]}>
                  {closed.unaccounted !== null ? (
                    <Amount value={Math.abs(closed.unaccounted)} uom={closed.uom ?? unit.uom} />
                  ) : (
                    <Blank why="nothing was unaccounted for" />
                  )}
                </Row>
              )}
              {r.impliedUnquantifiedDose !== null && (
                <Row
                  label="Implied unquantified dose"
                  note="derived at closing, not measured — kept out of the mean above"
                >
                  <Amount value={r.impliedUnquantifiedDose} uom={unit.uom} />
                </Row>
              )}
              {closed.note && <Row label="Note">{closed.note}</Row>}
            </>
          )}
        </tbody>
      </table>

      {closed && (
        <Reopen unit={unit} onCommit={onCommit} />
      )}

      {r.quarters && (
        <section className="lg__quarters">
          <h3 className="lg__h3">HOW IT WENT</h3>
          <p className="lg__hint">
            Quarters of the {withUnit(r.quantified, unit.uom)} the log accounts for — not of the
            whole unit, which would be undefined for any unit the log does not reach the end
            of, and defining it would mean inventing the missing material.
          </p>
          <ol className="lg__quarter-list">
            {r.quarters.map((q) => (
              <li key={q.label}>
                <b>{q.label}</b>
                <span>{duration(q.elapsed)}</span>
                <span>{pluralise(q.events, 'event')}</span>
                <span className="lg__quarter-bar" aria-hidden="true">
                  <span
                    style={{
                      width: `${Math.round(
                        (q.elapsed / Math.max(1, Math.max(...r.quarters!.map((x) => x.elapsed)))) * 100,
                      )}%`,
                    }}
                  />
                </span>
              </li>
            ))}
          </ol>
        </section>
      )}

      <Events unit={unit} onCommit={onCommit} />
    </article>
  )
}

/**
 * Putting a closed unit back.
 *
 * Closed by mistake, or the material turned up. The closure stays on the record
 * either way — a unit that was closed and reopened is a different history from
 * one that was never closed, and the report goes on showing how it ended.
 */
function Reopen({
  unit,
  onCommit,
}: {
  unit: UnitRecord
  onCommit: (events: LedgerEvent[]) => void
}) {
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState('')

  if (!open) {
    return (
      <button type="button" className="lg__linkish" onClick={() => setOpen(true)}>
        REOPEN THIS UNIT
      </button>
    )
  }

  return (
    <div className="lg__inline">
      <p className="lg__hint">
        The closure stays on the record. A unit that was closed and reopened is a different
        history from one that was never closed.
      </p>
      <div className="lg__inline-row">
        <input
          className="lg__field"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="why — required"
          aria-label="Reason for reopening"
          autoFocus
        />
      </div>
      <div className="lg__inline-actions">
        <button
          type="button"
          className="lg__save lg__save--small"
          disabled={!reason.trim()}
          onClick={() => {
            setOpen(false)
            onCommit([reopenUnit(unit.id, reason)])
          }}
        >
          REOPEN
        </button>
        <button type="button" className="lg__linkish" onClick={() => setOpen(false)}>
          CANCEL
        </button>
      </div>
    </div>
  )
}

const Row = ({
  label,
  note,
  children,
}: {
  label: string
  note?: string
  children: React.ReactNode
}) => (
  <tr>
    <th scope="row">
      {label}
      {note && <em>{note}</em>}
    </th>
    <td>{children}</td>
  </tr>
)

const Gap = () => (
  <tr className="lg__table-gap">
    <td colSpan={2} />
  </tr>
)

// ---------------------------------------------------------------------------

/** Every event against the unit, with its provenance reachable. */
function Events({
  unit,
  onCommit,
}: {
  unit: UnitRecord
  onCommit: (events: LedgerEvent[]) => void
}) {
  const [editing, setEditing] = useState<string | null>(null)
  const rows = [...unit.intakes].reverse()

  return (
    <section className="lg__events">
      <h3 className="lg__h3">
        THE LOG — {pluralise(live(unit).length, 'event')}
        {unit.tally.voided > 0 && ` · ${unit.tally.voided} voided`}
      </h3>
      {rows.length === 0 && <p className="lg__hint">Nothing logged against this unit yet.</p>}
      <ol className="lg__event-list">
        {rows.map((intake) => (
          <li key={intake.id} className={intake.voided ? 'lg__event lg__event--void' : 'lg__event'}>
            <div className="lg__event-main">
              <Instant iso={intake.occurredAt} />
              <span className="lg__event-qty">
                {intake.quantity !== null && intake.uom ? (
                  <Amount value={intake.quantity} uom={intake.uom} />
                ) : (
                  <span className="lg__event-words">{intake.descriptor ?? 'no figure'}</span>
                )}
              </span>
              <Class measurement={intake.measurement} confidence={intake.confidence} />
              {!intake.voided && (
                <button
                  type="button"
                  className="lg__linkish lg__linkish--end"
                  onClick={() => setEditing(editing === intake.id ? null : intake.id)}
                >
                  FIX
                </button>
              )}
            </div>

            {intake.note && <p className="lg__event-note">{intake.note}</p>}

            {intake.corrections.map((c, i) => (
              <p key={i} className="lg__event-prov">
                corrected {when(c.at)} — {c.reason}
                {'quantity' in c.before && c.before.quantity !== undefined && (
                  <> · was {String(c.before.quantity)}</>
                )}
              </p>
            ))}
            {intake.voided && (
              <p className="lg__event-prov">
                voided {when(intake.voided.at)} — {intake.voided.reason}
              </p>
            )}

            {editing === intake.id && (
              <Fix
                intake={intake}
                onDone={(events) => {
                  setEditing(null)
                  onCommit(events)
                }}
                onCancel={() => setEditing(null)}
              />
            )}
          </li>
        ))}
      </ol>
    </section>
  )
}

/**
 * Correcting or withdrawing a row.
 *
 * Both write a new event carrying the reason, and the reason is required by
 * `commands.ts` rather than by this form — a correction with no reason is
 * indistinguishable from a revision, and the difference between those two is
 * the entire value of an append-only log.
 */
function Fix({
  intake,
  onDone,
  onCancel,
}: {
  intake: IntakeRecord
  onDone: (events: LedgerEvent[]) => void
  onCancel: () => void
}) {
  const [text, setText] = useState(intake.quantity !== null ? String(intake.quantity) : '')
  const [reason, setReason] = useState('')
  const quantity = Number(text.trim().replace(/,/g, '.'))
  const usable = Number.isFinite(quantity) && quantity > 0
  const said = reason.trim().length > 0

  return (
    <div className="lg__inline">
      <div className="lg__inline-row">
        <input
          className="lg__field lg__field--qty"
          value={text}
          onChange={(e) => setText(e.target.value)}
          inputMode="decimal"
          aria-label="Corrected quantity"
        />
        <span className="lg__inline-uom">{intake.uom ?? ''}</span>
        <input
          className="lg__field"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="why — required"
          aria-label="Reason"
        />
      </div>
      <div className="lg__inline-actions">
        <button
          type="button"
          className="lg__save lg__save--small"
          disabled={!usable || !said}
          onClick={() => onDone([correctIntake(intake.id, { quantity }, reason)])}
        >
          CORRECT
        </button>
        <button
          type="button"
          className="lg__linkish"
          disabled={!said}
          onClick={() => onDone([voidIntake(intake.id, reason)])}
        >
          THIS DID NOT HAPPEN
        </button>
        <button type="button" className="lg__linkish" onClick={onCancel}>
          CANCEL
        </button>
      </div>
      <p className="lg__hint">
        Neither of these deletes anything. The original figure stays in the log with the
        reason beside it, and the report shows both.
      </p>
    </div>
  )
}

export { WINDOW_HOURS }
