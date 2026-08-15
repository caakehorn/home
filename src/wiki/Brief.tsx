import { useId, useMemo, useState, type CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import { InlineMarkdown } from './inline'
import { MARKS, STATUS, STATUS_GLYPH } from './palette'
import { topFigures, type Brief, type BriefDate, type FactKind } from './brief'
import { useWidth } from './useWidth'
import './brief.css'

/**
 * The visualiser for the wiki's compressed blocks.
 *
 * A quick brief is written to be swallowed by a machine in one gulp: every
 * date, name and number in the page's history, packed into one paragraph with
 * no seams. This takes that paragraph apart — the dates onto a rail, the
 * numbers into a stat row, the people into a cast, the state words into
 * flags, the sentences into cards you can take one at a time — and keeps the
 * original text one click away, because the prose is the record and the
 * visualisation is a reading of it.
 */

/** Every fact wears a word, so the card's kind never rests on colour. */
const KIND_LABEL: Record<FactKind, string> = {
  status: 'STATE',
  time: 'DATED',
  figure: 'FIGURE',
  link: 'LINKED',
  note: 'NOTE',
}

const DOMAIN_KANA: Record<string, string> = {
  people: '人', interests: '趣味', mind: '心', timeline: '年表',
  self: '自己', work: '仕事', places: '場所', health: '健康', legal: '法',
}

export function Brief({ brief, anchor }: { brief: Brief; anchor?: string }) {
  const [view, setView] = useState<'visual' | 'text'>('visual')
  const [focus, setFocus] = useState<number | null>(null)
  const figures = useMemo(() => topFigures(brief.figures), [brief.figures])

  return (
    <section className="brief" id={anchor ?? brief.id} aria-label={brief.heading}>
      <header className="brief__head">
        <h2 className="brief__title">{brief.heading}</h2>
        <span className="brief__toggle" role="group" aria-label="View as">
          {(['visual', 'text'] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              className={`brief__tab${view === mode ? ' brief__tab--on' : ''}`}
              aria-pressed={view === mode}
              onClick={() => setView(mode)}
            >
              {mode.toUpperCase()}
            </button>
          ))}
        </span>
      </header>

      <p className="brief__meta">
        {brief.lede && <span className="brief__lede">{brief.lede}</span>}
        {brief.words} words · {brief.facts.length} facts
        {brief.dates.length > 0 && ` · ${brief.dates.length} dated`}
        {brief.entities.length > 0 && ` · ${brief.entities.length} linked`}
      </p>

      {view === 'text' ? (
        <div className="brief__raw">
          {brief.source.split(/\n{2,}/).map((para, i) => (
            <p key={i}>
              <InlineMarkdown text={para} />
            </p>
          ))}
        </div>
      ) : (
        <div className="brief__panels">
          {figures.length > 0 && (
            <ul className="brief__figures" aria-label="Figures in this brief">
              {figures.map((f) => (
                <li
                  key={`${f.value}${f.label}`}
                  className={`brief__figure${focus === f.fact ? ' brief__figure--on' : ''}`}
                  onMouseEnter={() => setFocus(f.fact)}
                  onMouseLeave={() => setFocus(null)}
                >
                  <b className="brief__figure-value">{f.value}</b>
                  {f.label && <span className="brief__figure-label">{f.label}</span>}
                </li>
              ))}
            </ul>
          )}

          {brief.dates.length > 1 && (
            <Rail dates={brief.dates} focus={focus} onFocus={setFocus} facts={brief.facts} />
          )}

          {brief.flags.length > 0 && (
            <ul className="brief__flags" aria-label="State">
              {brief.flags.map((flag) => (
                <li
                  key={flag.label}
                  className={`brief__flag${focus === flag.fact ? ' brief__flag--on' : ''}`}
                  style={{ '--tone': STATUS[flag.tone] } as CSSProperties}
                  title={`${flag.label} — ${flag.tone}`}
                  onMouseEnter={() => setFocus(flag.fact)}
                  onMouseLeave={() => setFocus(null)}
                >
                  {/* glyph differs per tone, so the state never rests on hue */}
                  <span className="brief__flag-glyph" aria-hidden="true">
                    {STATUS_GLYPH[flag.tone]}
                  </span>
                  {flag.label}
                </li>
              ))}
            </ul>
          )}

          {brief.entities.length > 0 && (
            <div className="brief__cast">
              <h3 className="brief__sub">Cast</h3>
              <ul className="brief__chips">
                {brief.entities.map((e) => (
                  <li key={e.slug}>
                    <Link
                      to={`/brain/${e.slug}`}
                      className={`brief__chip${
                        focus !== null && !e.facts.includes(focus) ? ' brief__chip--dim' : ''
                      }`}
                      onMouseEnter={() => setFocus(e.facts[0])}
                      onMouseLeave={() => setFocus(null)}
                    >
                      <span className="jp" aria-hidden="true">
                        {DOMAIN_KANA[e.domain] ?? '書'}
                      </span>
                      {e.label}
                      {e.mentions > 1 && <b className="brief__chip-n">×{e.mentions}</b>}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <ol className="brief__facts">
            {brief.facts.map((fact) => (
              <li
                key={fact.index}
                id={`${anchor ?? brief.id}-fact-${fact.index}`}
                className={`brief__fact${focus === fact.index ? ' brief__fact--on' : ''}`}
                data-kind={fact.kind}
                onMouseEnter={() => setFocus(fact.index)}
                onMouseLeave={() => setFocus(null)}
              >
                <span className="brief__fact-kind">{KIND_LABEL[fact.kind]}</span>
                <p className="brief__fact-text">
                  <InlineMarkdown text={fact.text} />
                </p>
              </li>
            ))}
          </ol>
        </div>
      )}
    </section>
  )
}

// ---------------------------------------------------------------------------
// the timeline rail

const RAIL = { top: 30, axis: 62, height: 92, padX: 16 }

/** Years wide enough to breathe, so a decade and a fortnight both read. */
function niceYears(min: number, max: number) {
  const width = Math.max(max - min, 0.5)
  const step = [0.25, 0.5, 1, 2, 5, 10, 20, 25, 50].find((s) => width / s <= 6) ?? 100
  const ticks: number[] = []
  for (let y = Math.ceil(min / step) * step; y <= max + 1e-6; y += step) ticks.push(Math.round(y * 100) / 100)
  return ticks
}

const tickLabel = (year: number) =>
  Number.isInteger(year) ? String(year) : String(Math.floor(year))

/**
 * The dates of the brief on one axis.
 *
 * One hue: this is a sequence, not a set of categories, so nothing here is
 * colour-coded by kind — position carries the meaning and the label carries
 * the identity. Spans draw as bars, instants as dots, and each mark is tied
 * to the sentence it came from, which lights up as you move across the rail.
 */
function Rail({
  dates,
  focus,
  onFocus,
  facts,
}: {
  dates: BriefDate[]
  focus: number | null
  onFocus: (fact: number | null) => void
  facts: Brief['facts']
}) {
  const [ref, width] = useWidth<HTMLDivElement>()
  const titleId = useId()

  const min = Math.min(...dates.map((d) => d.start))
  const max = Math.max(...dates.map((d) => d.end))
  const ticks = niceYears(min, max)
  const lo = Math.min(min, ticks[0] ?? min)
  const hi = Math.max(max, ticks[ticks.length - 1] ?? max)

  const plotW = Math.max(80, width - RAIL.padX * 2)
  const x = (year: number) => RAIL.padX + ((year - lo) / Math.max(hi - lo, 1e-6)) * plotW

  // Direct-label what fits: walk left to right, keep a label only when the
  // last one it would collide with is far enough behind, and alternate the
  // survivors between two lanes so near-misses still clear each other.
  const labelled = new Map<number, number>()
  let lastLabelX = -Infinity
  dates.forEach((d, i) => {
    const at = x(d.start)
    if (at - lastLabelX < 72) return
    labelled.set(i, labelled.size % 2 === 0 ? RAIL.top : RAIL.top - 13)
    lastLabelX = at
  })

  const last = Math.floor(max - 1e-6)
  const summary = `${dates.length} dates from ${tickLabel(min)} to ${last}: ${dates
    .map((d) => d.label)
    .join(', ')}`

  return (
    <figure className="rail" ref={ref}>
      <figcaption className="brief__sub" id={titleId}>
        Timeline <span className="rail__range">{tickLabel(min)} → {last}</span>
      </figcaption>
      <svg
        className="rail__svg"
        viewBox={`0 0 ${width} ${RAIL.height}`}
        width="100%"
        height={RAIL.height}
        role="img"
        aria-labelledby={titleId}
        aria-describedby={`${titleId}-desc`}
      >
        <desc id={`${titleId}-desc`}>{summary}</desc>

        <line
          className="rail__axis"
          x1={RAIL.padX}
          x2={width - RAIL.padX}
          y1={RAIL.axis}
          y2={RAIL.axis}
        />
        {ticks.map((t) => (
          <g key={t}>
            <line className="rail__tick" x1={x(t)} x2={x(t)} y1={RAIL.axis} y2={RAIL.axis + 5} />
            <text className="rail__tick-label" x={x(t)} y={RAIL.axis + 18} textAnchor="middle">
              {tickLabel(t)}
            </text>
          </g>
        ))}

        {dates.map((d, i) => {
          const on = focus === d.fact
          const start = x(d.start)
          const end = x(d.end)
          const span = d.precision === 'span'
          const lane = labelled.get(i)
          // Keep the label inside the box; only the middle ones can centre.
          const edge = 46
          const anchor = start < edge ? 'start' : start > width - edge ? 'end' : 'middle'
          const labelX = start < edge ? RAIL.padX : start > width - edge ? width - RAIL.padX : start
          return (
            <g
              key={`${d.label}-${i}`}
              className={`rail__mark${on ? ' rail__mark--on' : ''}`}
              onMouseEnter={() => onFocus(d.fact)}
              onMouseLeave={() => onFocus(null)}
            >
              <title>{`${d.label} — ${facts[d.fact]?.text.replace(/\s+/g, ' ').slice(0, 140) ?? ''}`}</title>
              {/* an oversized transparent target, so a 10px dot is still hoverable */}
              <rect
                className="rail__hit"
                x={Math.min(start, end) - 10}
                y={RAIL.top - 18}
                width={Math.abs(end - start) + 20}
                height={RAIL.axis - RAIL.top + 24}
              />
              {span ? (
                <rect
                  className="rail__span"
                  x={start}
                  y={RAIL.axis - 9}
                  width={Math.max(4, end - start)}
                  height={6}
                  rx={3}
                  fill={MARKS[0]}
                />
              ) : (
                <circle className="rail__dot" cx={start} cy={RAIL.axis - 6} r={5} fill={MARKS[0]} />
              )}
              <line
                className="rail__stem"
                x1={start}
                x2={start}
                y1={RAIL.axis - 11}
                y2={lane === undefined ? RAIL.axis - 14 : lane + 3}
              />
              {lane !== undefined && (
                <text className="rail__label" x={labelX} y={lane} textAnchor={anchor}>
                  {d.label}
                </text>
              )}
            </g>
          )
        })}
      </svg>
    </figure>
  )
}
