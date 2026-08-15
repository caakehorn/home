import { useId, useState } from 'react'
import { formatValue, type ChartSpec, type TableData } from './table'
import { MARKS } from './palette'
import { useWidth } from './useWidth'
import './chart.css'

const PAD = { top: 18, right: 20, bottom: 34, left: 54 }

function niceTicks(max: number, count = 4) {
  if (max <= 0) return [0]
  const raw = max / count
  const mag = 10 ** Math.floor(Math.log10(raw))
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? mag * 10
  const ticks: number[] = []
  for (let v = 0; v <= max + step * 0.001; v += step) ticks.push(Math.round(v * 1000) / 1000)
  return ticks
}

type Hover = { row: number; seriesIndex: number; x: number; y: number } | null

export function Chart({ spec, table, caption }: { spec: ChartSpec; table: TableData; caption?: string }) {
  const [view, setView] = useState<'chart' | 'table'>('chart')
  const [wrapRef, width] = useWidth<HTMLDivElement>()
  const [hover, setHover] = useState<Hover>(null)
  const titleId = useId()

  const multi = spec.series.length > 1
  const values = spec.series.flatMap((s) => s.values.filter((v): v is number => v !== null))
  const max = Math.max(0, ...values)
  const ticks = niceTicks(max)
  const top = ticks[ticks.length - 1] || 1

  const rows = spec.labels.length
  const height =
    spec.form === 'bar'
      ? PAD.top + PAD.bottom + rows * (multi ? 20 * spec.series.length + 16 : 30)
      : 260

  const plotW = Math.max(40, width - PAD.left - PAD.right)
  const plotH = height - PAD.top - PAD.bottom

  const label = `${spec.labelHeader} — ${spec.series.map((s) => s.name).join(', ')}`

  return (
    <figure className="chart" ref={wrapRef}>
      <figcaption className="chart__head">
        <span className="chart__title" id={titleId}>
          {caption ?? label}
        </span>
        <span className="chart__toggle" role="group" aria-label="View as">
          {(['chart', 'table'] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              className={`chart__tab${view === mode ? ' chart__tab--on' : ''}`}
              aria-pressed={view === mode}
              onClick={() => setView(mode)}
            >
              {mode.toUpperCase()}
            </button>
          ))}
        </span>
      </figcaption>

      {/* Identity is never colour-alone: a legend is present for 2+ series. */}
      {multi && (
        <ul className="chart__legend">
          {spec.series.map((s, i) => (
            <li key={s.name} className="chart__legend-item">
              <span className="chart__swatch" style={{ background: MARKS[i] }} aria-hidden="true" />
              {s.name}
            </li>
          ))}
        </ul>
      )}

      {view === 'table' ? (
        <div className="chart__tablewrap">
          <table className="chart__table">
            <thead>
              <tr>
                <th scope="col">{spec.labelHeader}</th>
                {spec.series.map((s) => (
                  <th key={s.name} scope="col">
                    {s.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {spec.labels.map((l, r) => (
                <tr key={l + r}>
                  <th scope="row">{l}</th>
                  {spec.series.map((s) => (
                    <td key={s.name}>{s.values[r] === null ? '—' : formatValue(s.values[r]!, spec.unit)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="chart__plot">
          <svg
            width={width}
            height={height}
            role="img"
            aria-labelledby={titleId}
            onPointerLeave={() => setHover(null)}
          >
            {/* recessive grid + one axis; never two scales */}
            {spec.form === 'line'
              ? ticks.map((t) => {
                  const y = PAD.top + plotH - (t / top) * plotH
                  return (
                    <g key={t}>
                      <line className="chart__grid" x1={PAD.left} x2={PAD.left + plotW} y1={y} y2={y} />
                      <text className="chart__axis" x={PAD.left - 8} y={y + 4} textAnchor="end">
                        {formatValue(t, spec.unit)}
                      </text>
                    </g>
                  )
                })
              : ticks.map((t) => {
                  const x = PAD.left + (t / top) * plotW
                  return (
                    <g key={t}>
                      <line className="chart__grid" x1={x} x2={x} y1={PAD.top} y2={PAD.top + plotH} />
                      <text className="chart__axis" x={x} y={height - 12} textAnchor="middle">
                        {formatValue(t, spec.unit)}
                      </text>
                    </g>
                  )
                })}

            {spec.form === 'bar'
              ? spec.labels.map((l, r) => {
                  const band = plotH / rows
                  const groupTop = PAD.top + r * band
                  const barH = multi ? Math.min(14, (band - 10) / spec.series.length) : Math.min(16, band - 12)
                  return (
                    <g key={l + r}>
                      <text
                        className="chart__cat"
                        x={PAD.left - 8}
                        y={groupTop + band / 2 + 4}
                        textAnchor="end"
                      >
                        {l.length > 16 ? `${l.slice(0, 15)}…` : l}
                      </text>
                      {spec.series.map((s, si) => {
                        const v = s.values[r]
                        if (v === null) return null
                        // 2px gap between adjacent fills
                        const y = groupTop + (band - barH * spec.series.length - 2 * (spec.series.length - 1)) / 2 + si * (barH + 2)
                        const w = Math.max(2, (v / top) * plotW)
                        const on = hover?.row === r && hover?.seriesIndex === si
                        return (
                          <g key={s.name}>
                            <rect
                              className={`chart__bar${on ? ' chart__bar--on' : ''}`}
                              x={PAD.left}
                              y={y}
                              width={w}
                              height={barH}
                              rx={4}
                              fill={MARKS[si]}
                              onPointerEnter={() => setHover({ row: r, seriesIndex: si, x: PAD.left + w, y: y + barH / 2 })}
                            />
                            {/* selective direct labels — single series only */}
                            {!multi && (
                              <text className="chart__value" x={PAD.left + w + 6} y={y + barH - 2}>
                                {formatValue(v, spec.unit)}
                              </text>
                            )}
                          </g>
                        )
                      })}
                    </g>
                  )
                })
              : spec.series.map((s, si) => {
                  const step = rows > 1 ? plotW / (rows - 1) : 0
                  const pts = s.values
                    .map((v, i) =>
                      v === null ? null : { x: PAD.left + i * step, y: PAD.top + plotH - (v / top) * plotH, v, i },
                    )
                    .filter((p): p is { x: number; y: number; v: number; i: number } => p !== null)
                  return (
                    <g key={s.name}>
                      <polyline
                        className="chart__line"
                        points={pts.map((p) => `${p.x},${p.y}`).join(' ')}
                        stroke={MARKS[si]}
                      />
                      {pts.map((p) => (
                        <circle
                          key={p.i}
                          className={`chart__dot${hover?.row === p.i && hover.seriesIndex === si ? ' chart__dot--on' : ''}`}
                          cx={p.x}
                          cy={p.y}
                          r={hover?.row === p.i && hover.seriesIndex === si ? 6 : 4}
                          fill={MARKS[si]}
                          onPointerEnter={() => setHover({ row: p.i, seriesIndex: si, x: p.x, y: p.y })}
                        />
                      ))}
                    </g>
                  )
                })}

            {spec.form === 'line' &&
              spec.labels.map((l, i) => {
                const step = rows > 1 ? plotW / (rows - 1) : 0
                // thin out x labels so they never collide
                const every = Math.ceil((rows * 52) / Math.max(1, plotW))
                if (i % every !== 0 && i !== rows - 1) return null
                return (
                  <text
                    key={l + i}
                    className="chart__axis"
                    x={PAD.left + i * step}
                    y={height - 12}
                    textAnchor="middle"
                  >
                    {l}
                  </text>
                )
              })}
          </svg>

          {hover && (
            <div
              className="chart__tip"
              style={{ left: `${Math.min(hover.x + 10, width - 150)}px`, top: `${hover.y - 6}px` }}
              role="status"
            >
              <b>{spec.labels[hover.row]}</b>
              <span>
                {spec.series[hover.seriesIndex].name}:{' '}
                {formatValue(spec.series[hover.seriesIndex].values[hover.row] ?? 0, spec.unit)}
              </span>
              {spec.notes[hover.row] && <em>{spec.notes[hover.row]}</em>}
            </div>
          )}
        </div>
      )}

      {/* the original table is always one click away, per accessibility pass */}
      <span className="chart__source">
        {table.rows.length} rows · drawn from the table in this page
      </span>
    </figure>
  )
}
