import { useMemo, useState } from 'react'
import { Frame } from '../Frame'
import { useSet, type AccretionSet as Data, type Instrument } from '../core'
import '../accretion.css'

/**
 * VI · THE ACCRETION — the wiki growing, plotted against real time.
 *
 * Every other instrument reads the snapshot: the corpus as it stands. This one
 * reads the commit history behind it, which is the only source that knows what
 * the corpus *was*. `public/wiki/` is one frame; git is the film.
 *
 * ---- why four lanes and not one chart --------------------------------
 *
 * Pages are hundreds, bytes are millions. On a shared axis the byte curve is
 * the chart and everything else is a flat line along the floor — which would
 * hide the finding, because the finding is that the four series **disagree**.
 * So each lane is scaled to its own maximum and that maximum is printed beside
 * it, the same arrangement THE PEN uses. Lanes are comparable in *shape*, never
 * in height, and the axis labels say so.
 *
 * ---- why time and not commit number ----------------------------------
 *
 * 147 commits fall unevenly across 36 days. Plotting them evenly spaced would
 * make the work look continuous when it was bursts with gaps between them. The
 * x-axis is real elapsed time, so a quiet week is a quiet week on the page.
 *
 * Nothing is smoothed. A smoothed curve is an opinion about which days
 * mattered, and the 260-page migration on day one is exactly the kind of step a
 * moving average would file down into a gentle slope that never happened.
 */

// The dataset's shape lives in core.ts — ◈ WIKI XII · THE GENESIS reads the same
// file, and two private copies of one shape is how two rooms start disagreeing
// about what a commit is.

const W = 1000
const LANE_H = 116
const LANE_GAP = 26
const PULSE_H = 76
const PAD_L = 92
const PAD_R = 18

const fmt = (n: number) => n.toLocaleString()
const kb = (n: number) => `${Math.round(n / 1024).toLocaleString()} KB`
const day = (t: number) =>
  new Date(t * 1000).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
const full = (t: number) =>
  new Date(t * 1000).toLocaleString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })

export function Accretion({ instrument }: { instrument: Instrument }) {
  const { data, error, loading } = useSet<Data>('accretion.json')
  const [at, setAt] = useState<number | null>(null)

  const view = useMemo(() => {
    if (!data) return null
    const { points, span, series } = data
    const t0 = span.from
    const t1 = span.to
    const x = (t: number) => PAD_L + ((t - t0) / Math.max(1, t1 - t0)) * (W - PAD_L - PAD_R)

    const lanes = series.map((s, i) => {
      const max = Math.max(...points.map((p) => p[s.id]))
      const top = i * (LANE_H + LANE_GAP)
      const y = (v: number) => top + LANE_H - (v / Math.max(1, max)) * LANE_H
      // Step path: the value holds until the next commit changes it, which is
      // what actually happened. A straight line between commits would draw
      // growth during hours nobody was working.
      let path = `M ${x(points[0].t)} ${y(points[0][s.id])}`
      for (let k = 1; k < points.length; k++) {
        path += ` L ${x(points[k].t)} ${y(points[k - 1][s.id])} L ${x(points[k].t)} ${y(points[k][s.id])}`
      }
      const area = `${path} L ${x(points[points.length - 1].t)} ${top + LANE_H} L ${x(points[0].t)} ${top + LANE_H} Z`
      return { ...s, max, top, y, path, area }
    })

    // Day ticks, one per week, so the axis is readable at 1000px.
    const ticks: { t: number; label: string }[] = []
    const dayMs = 86400
    for (let t = t0; t <= t1; t += dayMs * 7) ticks.push({ t, label: day(t) })

    const maxDelta = Math.max(...points.map((p) => Math.abs(p.d?.pages ?? 0)), 1)
    // The biggest single step, located rather than hardcoded, so the marker
    // follows the data if the history changes.
    const migration = points.reduce(
      (best, p, i) => ((p.d?.pages ?? 0) > (points[best].d?.pages ?? 0) ? i : best),
      0,
    )
    const pulseTop = lanes.length * (LANE_H + LANE_GAP)

    return { points, lanes, x, ticks, t0, t1, maxDelta, migration, pulseTop, height: pulseTop + PULSE_H + 26 }
  }, [data])

  if (loading) return <Frame instrument={instrument}><p className="acc__state">reading the history…</p></Frame>
  if (error || !data || !view)
    return (
      <Frame instrument={instrument}>
        <p className="acc__state">
          The growth dataset is missing ({error ?? 'no data'}). Rebuild it against a wiki-brain
          checkout: <code>npm run accretion -- ../wiki-brain</code>.
        </p>
      </Frame>
    )

  const first = view.points[0]
  const last = view.points[view.points.length - 1]
  const cur = at !== null ? view.points[at] : last
  // The migration is located in the data, not assumed at an index — an earlier
  // draft hardcoded points[3] and printed "0 pages" once the finder moved it.
  const mig = view.points[view.migration]
  const migDays = Math.max(1, Math.round((last.t - mig.t) / 86400))

  return (
    <Frame
      instrument={instrument}
      footer={
        <p className="acc__note">
          Built from {data.commits} first-parent commits on <code>{data.branch}</code>, spanning{' '}
          {data.span.days} days. Merges count once — replaying a branch's commits and then its merge
          would count the same growth twice. Nothing is smoothed and no commit is filtered out. The four
          lanes are linear; only the per-commit bars use a square-root height, because one 260-page
          commit renders every other bar at under a pixel on a linear scale — the ordering is exact,
          the ratios are compressed.
        </p>
      }
    >
      {/* ---- the readout ------------------------------------------------ */}
      <div className="acc__readout">
        <span className="acc__stamp">
          {at !== null ? full(cur.t) : 'AS IT STANDS'}
          <b className="acc__sha">{cur.sha}</b>
        </span>
        <p className="acc__subject">{at !== null ? cur.subject : `${data.commits} commits, ${data.span.days} days`}</p>
        <div className="acc__figures">
          {data.series.map((s) => (
            <span className="acc__figure" key={s.id}>
              <b>{s.id === 'bytes' ? kb(cur[s.id]) : fmt(cur[s.id])}</b>
              {s.label}
              {at !== null && cur.d && cur.d[s.id] !== 0 && (
                <i className={cur.d[s.id] > 0 ? 'acc__up' : 'acc__down'}>
                  {cur.d[s.id] > 0 ? '+' : ''}
                  {s.id === 'bytes' ? kb(Math.abs(cur.d[s.id])) : fmt(cur.d[s.id])}
                </i>
              )}
            </span>
          ))}
        </div>
      </div>

      {/* ---- the lanes -------------------------------------------------- */}
      <svg
        className="acc__svg"
        viewBox={`0 0 ${W} ${view.height}`}
        role="img"
        aria-label={`Four counts over ${data.span.days} days: pages, bytes, wikilinks and edges, each scaled to its own maximum.`}
        onPointerLeave={() => setAt(null)}
        onPointerMove={(e) => {
          const box = e.currentTarget.getBoundingClientRect()
          const px = ((e.clientX - box.left) / box.width) * W
          const t = view.t0 + ((px - PAD_L) / (W - PAD_L - PAD_R)) * (view.t1 - view.t0)
          let best = 0
          for (let i = 1; i < view.points.length; i++) {
            if (Math.abs(view.points[i].t - t) < Math.abs(view.points[best].t - t)) best = i
          }
          setAt(best)
        }}
      >
        {/* the migration: one commit that is 57% of the finished page count */}
        <g className="acc__migration">
          <line
            x1={view.x(view.points[view.migration].t)}
            y1={0}
            x2={view.x(view.points[view.migration].t)}
            y2={view.pulseTop + PULSE_H}
          />
          <text x={view.x(view.points[view.migration].t) + 6} y={11}>
            MIGRATION +{fmt(view.points[view.migration].d?.pages ?? 0)}
          </text>
        </g>

        {view.lanes.map((lane) => (
          <g key={lane.id} className={`acc__lane acc__lane--${lane.id}`}>
            <line className="acc__base" x1={PAD_L} y1={lane.top + LANE_H} x2={W - PAD_R} y2={lane.top + LANE_H} />
            <path className="acc__area" d={lane.area} />
            <path className="acc__line" d={lane.path} />
            <text className="acc__lane-label" x={PAD_L - 10} y={lane.top + 13} textAnchor="end">
              {lane.label}
            </text>
            <text className="acc__lane-max" x={PAD_L - 10} y={lane.top + 29} textAnchor="end">
              {lane.id === 'bytes' ? kb(lane.max) : fmt(lane.max)}
            </text>
            <text className="acc__lane-zero" x={PAD_L - 10} y={lane.top + LANE_H} textAnchor="end">
              0
            </text>
          </g>
        ))}

        {/* per-commit page delta — the rhythm of the work */}
        <g className="acc__pulse">
          <line className="acc__base" x1={PAD_L} y1={view.pulseTop + PULSE_H / 2} x2={W - PAD_R} y2={view.pulseTop + PULSE_H / 2} />
          <text className="acc__lane-label" x={PAD_L - 10} y={view.pulseTop + 13} textAnchor="end">
            PER COMMIT
          </text>
          <text className="acc__lane-max" x={PAD_L - 10} y={view.pulseTop + 29} textAnchor="end">
            ±{fmt(view.maxDelta)} pages
          </text>
          {view.points.map((p, i) => {
            const dv = p.d?.pages ?? 0
            if (!dv) return null
            // Square-root height. Linear, one 260-page commit renders every
            // other bar at a pixel or less; sqrt keeps the ordering exact and
            // the ratios honest-but-compressed. Disclosed in the footer.
            const h = Math.sqrt(Math.abs(dv) / view.maxDelta) * (PULSE_H / 2)
            const mid = view.pulseTop + PULSE_H / 2
            return (
              <rect
                key={p.sha}
                className={dv > 0 ? 'acc__bar acc__bar--up' : 'acc__bar acc__bar--down'}
                x={view.x(p.t) - 1.5}
                y={dv > 0 ? mid - h : mid}
                width={3}
                height={Math.max(1, h)}
                opacity={at === null || at === i ? 1 : 0.35}
              />
            )
          })}
        </g>

        {/* time axis */}
        {view.ticks.map((tick) => (
          <g key={tick.t} className="acc__tick">
            <line x1={view.x(tick.t)} y1={0} x2={view.x(tick.t)} y2={view.pulseTop + PULSE_H} />
            <text x={view.x(tick.t)} y={view.height - 6} textAnchor="middle">
              {tick.label}
            </text>
          </g>
        ))}

        {/* the cursor */}
        {at !== null && (
          <g className="acc__cursor">
            <line x1={view.x(cur.t)} y1={0} x2={view.x(cur.t)} y2={view.pulseTop + PULSE_H} />
            {view.lanes.map((lane) => (
              <circle key={lane.id} cx={view.x(cur.t)} cy={lane.y(cur[lane.id])} r={4} />
            ))}
          </g>
        )}
      </svg>

      {/* ---- what the lanes disagree about ------------------------------ */}
      <div className="acc__finding">
        <p>
          <b>The lanes disagree, and that is the reading.</b> The corpus arrives in one
          commit — <b>{fmt(mig.d?.pages ?? 0)} pages</b> on {day(mig.t)}, a migration from the
          previous project — and the page count barely moves after it: {fmt(mig.pages)} to{' '}
          {fmt(last.pages)} across the remaining {migDays} days, a rise of{' '}
          {Math.round(((last.pages - mig.pages) / mig.pages) * 100)}%. Over the same stretch bytes
          rise {Math.round(((last.bytes - mig.bytes) / mig.bytes) * 100)}% and edges{' '}
          {Math.round(((last.edges - mig.edges) / mig.edges) * 100)}%. What grew was not the number
          of pages but what is on them and what they point at.
        </p>
        <div className="acc__derived">
          <span>
            <b>{fmt(Math.round(first.bytes / Math.max(1, first.pages)))} → {fmt(Math.round(last.bytes / last.pages))}</b>
            bytes per page
          </span>
          <span>
            <b>{(first.edges / Math.max(1, first.pages)).toFixed(2)} → {(last.edges / last.pages).toFixed(2)}</b>
            edges per page
          </span>
          <span>
            <b>{(last.links / last.edges).toFixed(2)}</b>
            links per edge
          </span>
        </div>
        <p className="acc__derived-note">
          Those three are ratios of counted values, shown because they are the shape the lanes
          describe — they are arithmetic on the series above, not measurements of their own, and no
          instrument here plots them.
        </p>
      </div>
    </Frame>
  )
}
