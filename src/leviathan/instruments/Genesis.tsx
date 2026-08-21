import { useEffect, useMemo, useRef, useState } from 'react'
import { Frame } from '../Frame'
import { useSet, type AccretionSet, type Instrument } from '../core'
import { usePortal } from '../../state/usePortal'
import { colourWith } from '../ink'

/**
 * ◈ WIKI XII · THE GENESIS
 *
 * The knowledge graph forming, in time-lapse. 147 commits over 36 days, played
 * back in the order they landed, with pages and edges arriving as they arrived.
 *
 * ---- what this is, next to THE ACCRETION -----------------------------------
 *
 * They read the same dataset and they are not the same instrument. THE
 * ACCRETION plots four counts against real elapsed time and lets you read the
 * disagreement between them; this replays the same 147 commits **one at a
 * time**, so what a single commit did is legible instead of being one pixel of
 * a curve. The day-one migration commit that lands 260 pages at once is a step
 * on the first and an event on this one.
 *
 * ---- the playback is not a smoothing --------------------------------------
 *
 * The playhead moves through commits, not through time: each frame is one
 * commit and every commit gets the same frame whether it landed a second or
 * four days after the one before it. That is a different axis from THE
 * ACCRETION's, deliberately — it is the only way a 147-step sequence with a
 * 36-day span and one enormous step is watchable — and the elapsed date is
 * printed on every frame so the compression is never hidden. Nothing is
 * interpolated between two commits: the bars hold their value until the next
 * one lands, because nothing happened in between.
 */
export function Genesis({ instrument }: { instrument: Instrument }) {
  const { data, error, loading } = useSet<AccretionSet>('accretion.json')
  const { motion } = usePortal()
  const [at, setAt] = useState(0)
  const [playing, setPlaying] = useState(false)

  const points = useMemo(() => data?.points ?? [], [data])

  useEffect(() => {
    if (!playing || !points.length) return
    const id = window.setInterval(() => {
      setAt((now) => {
        if (now >= points.length - 1) {
          setPlaying(false)
          return now
        }
        return now + 1
      })
    }, 90)
    return () => window.clearInterval(id)
  }, [playing, points.length])

  if (loading)
    return (
      <Frame instrument={instrument}>
        <p className="inst__state">replaying the build…</p>
      </Frame>
    )

  if (error || !data || !points.length)
    return (
      <Frame instrument={instrument}>
        <p className="inst__state">
          The dataset is missing ({error}). Run <code>npm run accretion -- ../wiki-brain</code> and
          rebuild.
        </p>
      </Frame>
    )

  const here = points[Math.min(at, points.length - 1)]
  const day = (t: number) => new Date(t * 1000).toISOString().slice(0, 10)
  const elapsed = Math.round((here.t - points[0].t) / 86_400)
  const last = points[points.length - 1]

  return (
    <Frame
      instrument={instrument}
      controls={
        <div className="pt-chips" role="group" aria-label="Playback">
          <button
            type="button"
            className={`pt-chip${playing ? ' pt-chip--on' : ''}`}
            aria-pressed={playing}
            onClick={() => {
              if (at >= points.length - 1) setAt(0)
              setPlaying((p) => !p)
            }}
            disabled={!motion && !playing}
          >
            {playing ? '❚❚ PAUSE' : '▶ PLAY'}
          </button>
          <button type="button" className="pt-chip" onClick={() => { setPlaying(false); setAt(0) }}>
            ⟲ REWIND
          </button>
          <button
            type="button"
            className="pt-chip"
            onClick={() => { setPlaying(false); setAt(points.length - 1) }}
          >
            ⇥ END
          </button>
        </div>
      }
      footer={
        <p className="inst__method">
          <b>THE PLAYHEAD MOVES THROUGH COMMITS, NOT THROUGH TIME</b> Every commit gets one frame
          whether it landed a second or four days after the one before it. That is a different axis
          from IV · THE ACCRETION&apos;s, on purpose: it is the only way a 147-step sequence with a
          36-day span and one enormous step is watchable. The real date is printed on every frame so
          the compression is never hidden, and nothing is interpolated between two commits — the
          bars hold until the next one lands, because nothing happened in between.
        </p>
      }
    >
      <div className="pt-split pt-split--wide">
        <div className="pt-stack">
          <Field points={points} at={at} />

          <label className="pt-note" style={{ display: 'grid', gap: '0.25rem' }}>
            <span>
              COMMIT <b>{at + 1}</b> OF {points.length} · {day(here.t)} · day {elapsed} of{' '}
              {data.span.days}
            </span>
            <input
              type="range"
              min={0}
              max={points.length - 1}
              value={at}
              onChange={(e) => {
                setPlaying(false)
                setAt(Number(e.target.value))
              }}
              style={{ width: '100%', accentColor: 'var(--n1)' }}
            />
          </label>

          <div className="pt-card">
            <span className="pt-card__head">
              <span>{here.sha}</span>
              <span>{day(here.t)}</span>
            </span>
            <p className="pt-card__say">{here.subject}</p>
            {here.d && (
              <span className="pt-card__meta">
                this commit: {sign(here.d.pages)} pages · {sign(here.d.edges)} edges ·{' '}
                {sign(here.d.links)} links · {sign(here.d.bytes)} bytes
              </span>
            )}
          </div>
        </div>

        <div className="pt-stack">
          <h3 className="pt-sub">AT THIS COMMIT</h3>
          <ol className="pt-rows" style={{ ['--pt-label' as string]: '4.5rem' }}>
            {(
              [
                ['pages', here.pages, last.pages],
                ['edges', here.edges, last.edges],
                ['links', here.links, last.links],
                ['bytes', here.bytes, last.bytes],
              ] as [string, number, number][]
            ).map(([label, value, top]) => (
              <li key={label} className="pt-row" style={{ ['--pt-label' as string]: '4.5rem' }}>
                <span className="pt-label">{label}</span>
                <span className="pt-bar pt-bar--tall">
                  <span className="pt-fill" style={{ inlineSize: `${(value / top) * 100}%` }} />
                </span>
                <span className="pt-value">
                  {label === 'bytes' ? `${(value / 1e6).toFixed(2)}M` : value.toLocaleString()}
                </span>
              </li>
            ))}
          </ol>
          <p className="pt-note">
            Each bar is against its own final value, so they all finish full. They are not
            comparable to each other — bytes are millions and pages are hundreds — which is the same
            reason IV · THE ACCRETION scales its four lanes separately.
          </p>

          <h3 className="pt-sub">THE BIGGEST STEPS</h3>
          <ol className="pt-rows" style={{ ['--pt-label' as string]: '1fr' }}>
            {[...points]
              .map((p, i) => ({ ...p, i }))
              .filter((p) => p.d)
              .sort((a, b) => (b.d!.pages ?? 0) - (a.d!.pages ?? 0))
              .slice(0, 10)
              .map((p) => (
                <li key={p.sha}>
                  <button
                    type="button"
                    className="pt-row-btn"
                    style={{ ['--pt-label' as string]: '1fr', ['--pt-value' as string]: '4rem' }}
                    onClick={() => {
                      setPlaying(false)
                      setAt(p.i)
                    }}
                  >
                    <span className="pt-label">{p.subject}</span>
                    <span className="pt-bar">
                      <span
                        className="pt-fill pt-fill--alt"
                        style={{ inlineSize: `${((p.d!.pages ?? 0) / 260) * 100}%` }}
                      />
                    </span>
                    <span className="pt-value">+{p.d!.pages}</span>
                  </button>
                </li>
              ))}
          </ol>
          <p className="pt-note">
            One commit lands 260 pages. Everything after it is the corpus getting deeper rather than
            wider, which is the reading IV · THE ACCRETION draws as four lanes disagreeing.
          </p>
        </div>
      </div>
    </Frame>
  )
}

const sign = (n: number) => (n > 0 ? `+${n.toLocaleString()}` : n.toLocaleString())

// ---------------------------------------------------------------------------

/**
 * The field: one mark per page that exists at this commit, filling as the
 * corpus arrives. It is a count made visible rather than a layout — the marks
 * are in a grid in commit order, so a page's position means nothing except
 * when it turned up.
 */
function Field({ points, at }: { points: AccretionSet['points']; at: number }) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const { vibe } = usePortal()

  useEffect(() => {
    const el = canvas.current
    if (!el) return
    const ctx = el.getContext('2d')
    if (!ctx) return

    const ink = getComputedStyle(el)
    const mark = ink.getPropertyValue('--n1').trim() || '#f5c400'
    const edge = ink.getPropertyValue('--n3').trim() || '#00eaff'
    const grid = ink.getPropertyValue('--text-dim').trim() || '#888'
    const paper = ink.getPropertyValue('--paper').trim() || '#e8e2d4'

    const paint = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1)
      const w = Math.max(300, Math.min(el.getBoundingClientRect().width, 820))
      const h = w * 0.62
      if (el.width !== Math.round(w * dpr)) {
        el.width = Math.round(w * dpr)
        el.height = Math.round(h * dpr)
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, w, h)

      const here = points[Math.min(at, points.length - 1)]
      const final = points[points.length - 1]
      const cols = 30
      const rows = Math.ceil(final.pages / cols)
      const cell = Math.min((w - 24) / cols, (h - 46) / rows)
      const x0 = (w - cell * cols) / 2
      const y0 = 30

      ctx.font = '10px ui-monospace, monospace'
      ctx.textAlign = 'left'
      ctx.fillStyle = colourWith(paper, 0.8)
      ctx.fillText(`${here.pages} PAGES · ${here.edges.toLocaleString()} EDGES`, 10, 18)
      ctx.textAlign = 'right'
      ctx.fillStyle = colourWith(grid, 0.7)
      ctx.fillText(`OF ${final.pages} · ${final.edges.toLocaleString()}`, w - 10, 18)

      for (let i = 0; i < final.pages; i++) {
        const cx = x0 + (i % cols) * cell
        const cy = y0 + Math.floor(i / cols) * cell
        const there = i < here.pages
        ctx.fillStyle = there ? colourWith(mark, 0.85) : colourWith(grid, 0.14)
        ctx.fillRect(cx + 1, cy + 1, Math.max(1.5, cell - 2.5), Math.max(1.5, cell - 2.5))
      }

      // The edge lane along the bottom: a count, drawn as a bar rather than as
      // 3,174 lines nobody could resolve.
      const laneY = y0 + rows * cell + 8
      if (laneY < h - 6) {
        ctx.fillStyle = colourWith(grid, 0.18)
        ctx.fillRect(x0, laneY, cell * cols, 6)
        ctx.fillStyle = colourWith(edge, 0.9)
        ctx.fillRect(x0, laneY, cell * cols * (here.edges / Math.max(1, final.edges)), 6)
      }
    }

    paint()
    const observer = new ResizeObserver(paint)
    observer.observe(el)
    return () => observer.disconnect()
  }, [points, at, vibe])

  return (
    <figure className="pt-figure">
      <canvas ref={canvas} className="pt-mount" style={{ aspectRatio: '1 / 0.62' }} />
      <figcaption className="pt-legend">
        <span className="pt-key" style={{ color: 'var(--n1)' }}>
          A PAGE THAT EXISTS
        </span>
        <span className="pt-key" style={{ color: 'var(--n3)' }}>
          EDGES
        </span>
        <span className="pt-key-say">
          position is arrival order and nothing else — the grid is a count made visible, not a layout
        </span>
      </figcaption>
    </figure>
  )
}
