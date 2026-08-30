/**
 * ACROSS UNITS — the part that stops being a diary and starts being a dataset.
 *
 * One unit report answers "how did that one go". This answers the questions
 * that need dozens of them: how long a given quantity actually lasts, whether
 * the dose size has moved over months, what hour of the clock the events
 * cluster in, and how much of any of it the log can actually speak for.
 *
 * ---- every mark is a count, a date or a length -------------------------------
 *
 * The bars here encode event counts and elapsed times and nothing else. There
 * is no weighting, no smoothing, no severity axis and no colour that means
 * anything — one accent, used for every series, because the comparison is
 * between the lengths of the bars and not between their hues. (Two of the five
 * palettes collapse the accent ramp anyway, so a five-colour chart would be a
 * three-colour chart in two themes.)
 *
 * ---- the histogram is equal-width, on purpose --------------------------------
 *
 * Equal-width bins rather than equal-count, because a quantile histogram hides
 * exactly the thing a dose distribution gets looked at for: whether the mass
 * sits in one place or in two.
 *
 * ---- what is deliberately absent ---------------------------------------------
 *
 * No trend line, no fit, no projection. A mean dose per unit is plotted at the
 * date the unit arrived and the reader can see the shape; drawing a regression
 * through fourteen points would be an instrument making a judgement, which is
 * the one thing this rack is not allowed to do.
 */

import { useMemo } from 'react'
import { byHour, byWeekday, bySubstance, duration, histogram, quantile } from './analyze.ts'
import type { Ledger } from './project.ts'
import { quantity as withUnit } from './uom.ts'
import { Blank, Figure, Span, pluralise, when } from './bits.tsx'

const DAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']

export function Trends({ ledger }: { ledger: Ledger }) {
  const substances = useMemo(() => bySubstance(ledger), [ledger])
  const hours = useMemo(() => byHour(ledger), [ledger])
  const days = useMemo(() => byWeekday(ledger), [ledger])
  const events = hours.reduce((a, b) => a + b, 0)

  if (!ledger.units.length) {
    return <p className="lg__empty">Nothing to compare yet. Open a unit and the log starts.</p>
  }

  return (
    <div className="lg__trends">
      <p className="lg__hint">
        {pluralise(events, 'event')} across {pluralise(ledger.units.length, 'unit')}.
        Every figure below is a count, a date or a length taken over the whole log — nothing
        weighted, nothing smoothed, nothing scored.
      </p>

      {substances.map((s) => (
        <section key={s.substance} className="lg__trend-block">
          <h3 className="lg__h3">{s.substance.toUpperCase()}</h3>

          <dl className="lg__stats">
            <Stat label="Units" value={String(s.units)} note={`${s.closedUnits} closed`} />
            <Stat label="Events" value={String(s.events)} note={`${s.unquantifiedEvents} without a figure`} />
            <Stat
              label="Quantified"
              value={s.quantified > 0 ? withUnit(s.quantified, s.uom) : '—'}
              note={`across units measured in ${s.uom}`}
            />
            <Stat
              label="Mean dose"
              value={s.meanDose !== null ? withUnit(s.meanDose, s.uom) : '—'}
              note={`÷ ${s.doses.length} quantified`}
            />
            <Stat
              label="Median dose"
              value={s.medianDose !== null ? withUnit(s.medianDose, s.uom) : '—'}
              note="the middle one"
            />
            <Stat
              label="Median unit life"
              value={s.medianUnitDuration !== null ? duration(s.medianUnitDuration) : '—'}
              note={s.closedUnits ? `over ${pluralise(s.closedUnits, 'closed unit')}` : 'none closed yet'}
            />
            <Stat
              label="Gone in a day"
              value={s.closedUnits ? `${s.withinADay} of ${s.closedUnits}` : '—'}
              note="closed units whose whole life was under 24h"
            />
            <Stat
              label="Dose spread"
              value={
                s.doses.length > 3
                  ? `${withUnit(quantile(s.doses, 0.25)!, s.uom)} – ${withUnit(quantile(s.doses, 0.75)!, s.uom)}`
                  : '—'
              }
              note="the middle half"
            />
          </dl>

          {s.doses.length > 3 && (
            <DoseHistogram doses={s.doses} uom={s.uom} />
          )}

          {s.trend.length > 1 && (
            <section className="lg__trend-table">
              <h4 className="lg__h4">UNIT BY UNIT</h4>
              <table className="lg__table lg__table--wide">
                <thead>
                  <tr>
                    <th scope="col">Received</th>
                    <th scope="col">Lasted</th>
                    <th scope="col">Mean dose</th>
                  </tr>
                </thead>
                <tbody>
                  {s.trend.map((t) => (
                    <tr key={t.unit}>
                      <td>{when(t.receivedAt)}</td>
                      <td>
                        <Span ms={t.duration} />
                      </td>
                      <td>
                        <Figure value={t.meanDose} uom={s.uom} why="nothing quantified on that unit" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          )}
        </section>
      ))}

      <section className="lg__trend-block">
        <h3 className="lg__h3">WHEN</h3>
        <Bars
          title="BY HOUR OF THE LOCAL CLOCK"
          bars={hours.map((count, hour) => ({
            label: hour % 6 === 0 ? String(hour).padStart(2, '0') : '',
            value: count,
            title: `${pluralise(count, 'event')} between ${String(hour).padStart(2, '0')}:00 and ${String(hour).padStart(2, '0')}:59`,
          }))}
        />
        <p className="lg__hint">
          The hour on the clock where each event happened, taken from the offset stored with
          it — so four in the morning stays four in the morning when this is read from
          somewhere else.
        </p>
        <Bars
          title="BY DAY OF THE WEEK"
          bars={days.map((count, day) => ({
            label: DAYS[day],
            value: count,
            title: `${pluralise(count, 'event')} on a ${DAYS[day]}`,
          }))}
        />
      </section>
    </div>
  )
}

const Stat = ({ label, value, note }: { label: string; value: string; note?: string }) => (
  <div className="lg__stat">
    <dt>{label}</dt>
    <dd>
      {value === '—' ? <Blank why="the log cannot answer this yet" /> : value}
      {note && <em>{note}</em>}
    </dd>
  </div>
)

/**
 * The distribution of quantified dose sizes.
 *
 * Only every few bins is labelled. Fourteen labels under fourteen bars on a
 * phone is one illegible smear of digits — which looks like precision and reads
 * as nothing — so the axis is thinned to the ends and a handful between, and
 * every bar keeps its exact range in its `title` and its accessible name.
 */
function DoseHistogram({ doses, uom }: { doses: number[]; uom: string }) {
  const count = Math.min(14, Math.max(6, Math.round(doses.length / 3)))
  const bins = histogram(doses, count)
  const every = Math.max(1, Math.ceil(bins.length / 5))
  return (
    <Bars
      title={`DOSE SIZES — ${pluralise(doses.length, 'quantified event')}`}
      bars={bins.map((bin, i) => ({
        label:
          i % every === 0 || i === bins.length - 1
            ? withUnit(bin.from, uom).replace(` ${uom}`, '')
            : '',
        value: bin.count,
        title: `${pluralise(bin.count, 'dose')} between ${withUnit(bin.from, uom)} and ${withUnit(bin.to, uom)}`,
      }))}
    />
  )
}

/**
 * A row of bars, scaled to the tallest.
 *
 * Bare `<div>`s rather than an SVG or a library: the whole chart is one number
 * per bar and a title on each, so anything more is a dependency and a rendering
 * mode to get wrong. The counts are in the `title` and in the accessible name,
 * so the figure is readable without seeing it.
 */
function Bars({
  title,
  bars,
}: {
  title: string
  bars: { label: string; value: number; title: string }[]
}) {
  const top = Math.max(1, ...bars.map((b) => b.value))
  return (
    <figure className="lg__chart">
      <figcaption>{title}</figcaption>
      <div className="lg__chart-bars" role="img" aria-label={bars.map((b) => b.title).join('; ')}>
        {bars.map((bar, i) => (
          <span key={i} className="lg__chart-col" title={bar.title}>
            <span className="lg__chart-bar" style={{ height: `${(bar.value / top) * 100}%` }} />
            <span className="lg__chart-label">{bar.label}</span>
          </span>
        ))}
      </div>
      <span className="lg__chart-scale">peak {top}</span>
    </figure>
  )
}
