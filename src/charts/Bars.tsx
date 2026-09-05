import { useId } from 'react'
import { canDraw, commas, extentOf, refusalsFor } from './series'
import type { Series } from './series'
import './charts.css'

/**
 * The bar primitive — and the reason it is HTML rather than canvas.
 *
 * §1.1's largest single defect is `truncated-labels`, 131 tables, and its
 * cause is one line: `src/wiki/Chart.tsx:143` cuts a bar's category at fifteen
 * characters. That is what measuring text in a fixed-width canvas gutter makes
 * you do — the label has nowhere to go, so it gets cut.
 *
 * Given a grid row per bar the label has somewhere to go: it wraps, the row
 * grows, and the truncation defect cannot be reintroduced by a later change,
 * because there is no code anywhere in this file that shortens a string.
 * `foundation`'s clause is "no truncated labels", and the way to keep a
 * promise like that is to build something structurally incapable of breaking
 * it rather than to be careful.
 *
 * It also gets three things free that the canvas charts each had to earn:
 * every label is real selectable text, a screen reader gets a table it can
 * actually read, and the page scrolls under a finger because nothing here
 * claims a gesture (`CLAUDE.md` §5 — a view that takes the browser's pan away
 * owes the reader a replacement, so this one does not take it).
 */
export function Bars({
  series,
  caption,
  note,
}: {
  series: Series[]
  /** What the chart is of. Printed above it. */
  caption: string
  /** How these numbers were arrived at, if the frame is not already saying so. */
  note?: string
}) {
  const id = useId()

  // Refuse first, and say why. The reader gets the reason rather than a blank
  // space, because "this was not drawable" is itself a fact about the corpus.
  if (!canDraw(series)) return <Refused series={series} caption={caption} />

  const extent = extentOf(series)!
  const span = extent.max - extent.min || 1
  const unit = series[0].unit

  return (
    <figure className="ck" aria-labelledby={`${id}-cap`}>
      <figcaption className="ck__cap" id={`${id}-cap`}>
        {caption}
        <span className="ck__unit">{unit}</span>
      </figcaption>

      {series.map((s) => (
        <div className="ck__series" key={s.id}>
          {series.length > 1 && <h4 className="ck__series-label">{s.label}</h4>}
          <ol className="ck__bars">
            {s.points.map((p, i) => (
              <li className="ck__row" key={`${s.id}-${i}`}>
                {/* Wraps. Nothing in this file shortens it. */}
                <span className="ck__label">{p.label}</span>
                <span className="ck__track">
                  {p.value === null ? (
                    // A gap in the record, hatched at its real width rather
                    // than drawn as a zero. `CLAUDE.md` §2.
                    <span className="ck__gap" title="no record covers this position" />
                  ) : (
                    <span
                      className="ck__bar"
                      style={{ width: `${Math.max(((p.value - extent.min) / span) * 100, 0.6)}%` }}
                    />
                  )}
                </span>
                <span className="ck__value">
                  {p.value === null ? <i className="ck__none">no record</i> : commas(p.value, s.kind)}
                </span>
              </li>
            ))}
          </ol>

          {/* §2 — "the n printed on every rate". Not optional, and not a tooltip. */}
          {s.kind === 'rate' && s.n !== undefined && (
            <p className="ck__n">
              over n = {commas(s.n)}
            </p>
          )}
        </div>
      ))}

      {note && <p className="ck__note">{note}</p>}
    </figure>
  )
}

/**
 * What a refusal looks like from the reader's side.
 *
 * It prints the rule that stopped the chart, in a sentence, above the data it
 * declined to draw. This is the half that makes "refuses rather than warns"
 * honest: a silent refusal and a missing chart are the same thing on the page,
 * and only one of them tells the reader that a decision was taken.
 */
function Refused({ series, caption }: { series: Series[]; caption: string }) {
  const refusals = refusalsFor(series)
  return (
    <figure className="ck ck--refused">
      <figcaption className="ck__cap">
        {caption}
        <span className="ck__unit ck__unit--refused">NOT DRAWN</span>
      </figcaption>
      <ul className="ck__refusals">
        {refusals.map((r) => (
          <li key={r.code + r.says}>
            <span className="ck__refusal-code">{r.code}</span>
            {r.says}
          </li>
        ))}
      </ul>
      <p className="ck__note">
        The numbers are below, unchanged. A chart the site cannot draw truthfully is left as the
        figures it was going to be drawn from.
      </p>
      <ol className="ck__plain">
        {series.map((s) => (
          <li key={s.id}>
            <b>{s.label}</b>
            {s.unit ? ` · ${s.unit}` : ''}
            <ul>
              {s.points.map((p, i) => (
                <li key={i}>
                  {/* Raw, deliberately. The note above says these are the figures
                      unchanged, and a refusal is often a refusal *about* what
                      kind of number this is — so formatting one as a count here
                      would be the renderer asserting the very thing the chart
                      just declined to assert. */}
                  {p.label} — {p.value === null ? 'no record' : String(p.value)}
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ol>
    </figure>
  )
}
