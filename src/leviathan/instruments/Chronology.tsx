import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Frame } from '../Frame'
import { useSet, type ChronologySet, type Instrument } from '../core'
import { useWidth } from '../../wiki/useWidth'
import '../chronology.css'

const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC']

const PLOT = { top: 20, bottom: 26, height: 250 }

/**
 * II · THE CHRONOLOGY
 *
 * The wiki's own sense of time, taken out of its prose rather than off its
 * timeline pages: every date any page names, binned by year. What it shows is
 * not when things happened — it is when the record says things happened, which
 * is a different and more honest object. The quiet years are part of the
 * reading.
 *
 * One hue, magnitude by height. Pick a year and it opens: the months inside
 * it, and every page that named it, with the exact date each one wrote.
 */
export function Chronology({ instrument }: { instrument: Instrument }) {
  const { data, error, loading } = useSet<ChronologySet>('chronology.json')
  const [ref, width] = useWidth<HTMLDivElement>(760, 260)
  const [picked, setPicked] = useState<number | null>(null)
  const [hover, setHover] = useState<number | null>(null)

  const shown = hover ?? picked
  const year = useMemo(() => data?.years.find((y) => y.year === shown) ?? null, [data, shown])
  const openYear = useMemo(() => data?.years.find((y) => y.year === picked) ?? null, [data, picked])

  const months = useMemo(() => {
    if (!data || picked === null) return null
    const own = data.months.filter((m) => m.year === picked)
    if (!own.length) return null
    return MONTHS.map((label, i) => ({
      label,
      month: i,
      count: own.find((m) => m.month === i)?.count ?? 0,
      pages: own.find((m) => m.month === i)?.pages ?? [],
    }))
  }, [data, picked])

  if (loading) return <Frame instrument={instrument}><p className="inst__state">reading the dates…</p></Frame>
  if (error || !data)
    return (
      <Frame instrument={instrument}>
        <p className="inst__state">
          The dataset is missing ({error}). Run <code>npm run leviathan</code> and rebuild.
        </p>
      </Frame>
    )

  const first = data.years[0].year
  const last = data.years[data.years.length - 1].year
  const span = last - first + 1
  const peak = Math.max(...data.years.map((y) => y.count))
  const plotH = PLOT.height - PLOT.top - PLOT.bottom
  const step = width / span
  const barW = Math.max(1.5, step - 1)
  const xOf = (y: number) => (y - first) * step
  const counts = new Map(data.years.map((y) => [y.year, y]))

  const walk = (delta: number) => {
    const at = picked ?? last
    for (let y = at + delta; y >= first && y <= last; y += delta) {
      if (counts.has(y)) {
        setPicked(y)
        return
      }
    }
  }

  const monthPeak = months ? Math.max(1, ...months.map((m) => m.count)) : 1

  return (
    <Frame
      instrument={instrument}
      controls={
        picked !== null && (
          <button type="button" className="chron__clear" onClick={() => setPicked(null)}>
            {picked} ×
          </button>
        )
      }
      footer={
        <p className="inst__note">
          A date is counted once per page that names it, so a page repeating 2015 forty times does
          not outvote forty pages naming it once. Spans count at their start; a range from 2015 to
          2026 is a claim about its endpoints, not about every month between them.
        </p>
      }
    >
      <p className="chron__lede">
        <b>{data.mentions.toLocaleString()}</b> dated mentions · {first} → {last} ·{' '}
        <b>{data.years.length}</b> years named
      </p>

      <div
        className="chron__plot"
        ref={ref}
        tabIndex={0}
        role="application"
        aria-label={`Dated mentions per year, ${first} to ${last}. Arrow keys move between years, Escape clears.`}
        onKeyDown={(e) => {
          if (e.key === 'ArrowRight') {
            e.preventDefault()
            walk(1)
          } else if (e.key === 'ArrowLeft') {
            e.preventDefault()
            walk(-1)
          } else if (e.key === 'Escape') {
            setPicked(null)
          }
        }}
        onMouseLeave={() => setHover(null)}
      >
        <svg width="100%" height={PLOT.height} viewBox={`0 0 ${width} ${PLOT.height}`} role="img"
          aria-label={`Peak ${peak} mentions in ${data.years.reduce((a, b) => (b.count > a.count ? b : a)).year}`}>
          {/* one reference: the tallest year, so a bar can be read as a number */}
          <line className="chron__peak" x1={0} x2={width} y1={PLOT.top} y2={PLOT.top} />
          <text className="chron__peak-label" x={width} y={PLOT.top - 6} textAnchor="end">
            {peak} mentions
          </text>

          {/* decade rules, recessive */}
          {Array.from({ length: Math.ceil(span / 10) + 1 }, (_, i) => first - (first % 10) + i * 10)
            .filter((y) => y >= first && y <= last)
            .map((y) => (
              <g key={y}>
                <line className="chron__rule" x1={xOf(y)} x2={xOf(y)} y1={PLOT.top} y2={PLOT.top + plotH} />
                <text className="chron__tick" x={xOf(y)} y={PLOT.height - 8} textAnchor="middle">
                  {y}
                </text>
              </g>
            ))}

          {data.years.map((y) => {
            const h = Math.max(1.5, (y.count / peak) * plotH)
            const on = y.year === shown
            return (
              <rect
                key={y.year}
                className={`chron__bar${on ? ' chron__bar--on' : ''}`}
                x={xOf(y.year)}
                y={PLOT.top + plotH - h}
                width={barW}
                height={h}
                rx={Math.min(1.5, barW / 2)}
                opacity={on ? 1 : 0.42 + 0.58 * (y.count / peak)}
                onMouseEnter={() => setHover(y.year)}
                onClick={() => setPicked(y.year === picked ? null : y.year)}
              >
                <title>{`${y.year} — ${y.count} mentions across ${y.pages} pages`}</title>
              </rect>
            )
          })}
        </svg>

        {year && (
          <p className="chron__readout" aria-live="polite">
            <b>{year.year}</b> · {year.count} mentions · {year.pages} pages
            {picked === null && <span className="chron__hint"> — click to open</span>}
          </p>
        )}
      </div>

      {openYear && (
        <div className="chron__open">
          {months && (
            <ol className="chron__months" aria-label={`Months named in ${openYear.year}`}>
              {months.map((m) => (
                <li key={m.label} className={m.count ? '' : 'chron__month--empty'}>
                  <span className="chron__month-bar" style={{ height: `${(m.count / monthPeak) * 100}%` }} />
                  <span className="chron__month-label">{m.label}</span>
                  <span className="chron__month-count">{m.count || ''}</span>
                </li>
              ))}
            </ol>
          )}

          <section className="chron__pages">
            <h2>
              Pages naming {openYear.year}
              <span className="chron__scope">
                {openYear.sample.length < openYear.pages &&
                  ` · first ${openYear.sample.length} of ${openYear.pages}`}
              </span>
            </h2>
            <ul>
              {openYear.sample.map((p, i) => (
                <li key={`${p.slug}-${i}`}>
                  <Link to={`/brain/${p.slug}`}>{p.title}</Link>
                  <code>
                    {p.label}
                    {p.dates > 1 && ` +${p.dates - 1}`}
                  </code>
                </li>
              ))}
            </ul>
          </section>
        </div>
      )}
    </Frame>
  )
}
