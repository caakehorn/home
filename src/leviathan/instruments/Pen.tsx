import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Frame } from '../Frame'
import { useSet, type Instrument } from '../core'
import { useWidth } from '../../wiki/useWidth'
import '../pen.css'

export type PenSet = {
  from: number
  to: number
  lanes: { key: string; label: string; unit: string }[]
  rows: Record<string, number>[]
}

/**
 * III · THE PEN
 *
 * The old site's pen scaffold drew a moving stylus over stacked lanes and
 * looked like an instrument without measuring anything — the jitter on the pen
 * head was `Math.random()`. The chrome survives here because a chart recorder
 * is a genuinely good way to read four series against one axis; what changed
 * is that the lanes now carry counts, and the stylus sits exactly where the
 * value is.
 *
 * Each lane keeps its own vertical scale. That is the one liberty taken, and
 * it is the right one: MENTIONS runs to 741 and DOMAINS to 9, so a shared
 * scale would flatten three lanes into the floor to make a point about the
 * fourth. Every lane prints its own maximum, so no lane can borrow another's
 * altitude without saying so.
 */
export function Pen({ instrument }: { instrument: Instrument }) {
  const { data, error, loading } = useSet<PenSet>('pen.json')
  const [wrapRef, width] = useWidth<HTMLDivElement>(880, 320)

  const [playing, setPlaying] = useState(false)
  const [pos, setPos] = useState(1)
  const [held, setHeld] = useState<number | null>(null)

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const raf = useRef(0)

  const rows = data?.rows ?? []
  const lanes = data?.lanes ?? []
  const n = rows.length

  // Per-lane maxima: each lane is read against itself, and says so.
  const maxima = useMemo(() => {
    const out: Record<string, number> = {}
    for (const lane of lanes) out[lane.key] = Math.max(1, ...rows.map((r) => r[lane.key] ?? 0))
    return out
  }, [lanes, rows])

  useEffect(() => {
    if (n) setPos(n - 1)
  }, [n])

  // transport
  useEffect(() => {
    if (!playing || !n) return
    let last = performance.now()
    const tick = (now: number) => {
      const dt = (now - last) / 1000
      last = now
      setPos((p) => {
        const next = p + dt * 14
        if (next >= n - 1) {
          setPlaying(false)
          return n - 1
        }
        return next
      })
      raf.current = requestAnimationFrame(tick)
    }
    raf.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf.current)
  }, [playing, n])

  const geo = useMemo(() => {
    const padL = 96
    const padR = 26
    const padT = 16
    const laneH = 64
    const laneGap = 12
    return { padL, padR, padT, laneH, laneGap, plotW: Math.max(40, width - padL - padR) }
  }, [width])

  const height = geo.padT + lanes.length * (geo.laneH + geo.laneGap) + 30

  const draw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas || !n) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    canvas.width = Math.round(width * dpr)
    canvas.height = Math.round(height * dpr)
    canvas.style.width = `${width}px`
    canvas.style.height = `${height}px`
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, width, height)

    const styles = getComputedStyle(document.documentElement)
    const ink = styles.getPropertyValue('--n3').trim() || '#00eaff'
    const dim = styles.getPropertyValue('--text-dim').trim() || '#888'
    const paper = styles.getPropertyValue('--void').trim() || '#000'
    const rule = styles.getPropertyValue('--void-3').trim() || '#222'

    const xOf = (i: number) => geo.padL + (i / Math.max(1, n - 1)) * geo.plotW
    const readAt = held ?? pos

    lanes.forEach((lane, li) => {
      const y0 = geo.padT + li * (geo.laneH + geo.laneGap)
      const max = maxima[lane.key]

      // paper
      ctx.fillStyle = paper
      ctx.fillRect(geo.padL, y0, geo.plotW, geo.laneH)
      ctx.strokeStyle = rule
      ctx.lineWidth = 1
      ctx.strokeRect(geo.padL + 0.5, y0 + 0.5, geo.plotW, geo.laneH)

      // lane identity, in text tokens rather than the trace colour
      ctx.textAlign = 'right'
      ctx.textBaseline = 'middle'
      ctx.font = '10px ui-monospace, monospace'
      ctx.fillStyle = styles.getPropertyValue('--text').trim() || '#fff'
      ctx.fillText(lane.label, geo.padL - 12, y0 + geo.laneH / 2 - 6)
      ctx.fillStyle = dim
      ctx.font = '9px ui-monospace, monospace'
      ctx.fillText(`max ${max.toLocaleString()}`, geo.padL - 12, y0 + geo.laneH / 2 + 8)

      // the trace, drawn only as far as the stylus has travelled
      ctx.strokeStyle = ink
      ctx.lineWidth = 1.6
      ctx.lineJoin = 'round'
      ctx.beginPath()
      const upto = Math.floor(pos)
      for (let i = 0; i <= upto; i++) {
        const v = rows[i][lane.key] ?? 0
        const x = xOf(i)
        const y = y0 + geo.laneH - 4 - (v / max) * (geo.laneH - 10)
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
      }
      ctx.stroke()

      // the stylus, at the value — not near it
      const i0 = Math.min(n - 1, Math.floor(pos))
      const v = rows[i0][lane.key] ?? 0
      const px = xOf(pos)
      const py = y0 + geo.laneH - 4 - (v / max) * (geo.laneH - 10)
      ctx.fillStyle = ink
      ctx.beginPath()
      ctx.arc(px, py, 3.2, 0, Math.PI * 2)
      ctx.fill()

      // the readout follows the held year when there is one
      const ri = Math.min(n - 1, Math.round(readAt))
      const rv = rows[ri][lane.key] ?? 0
      const rx = xOf(ri)
      const ry = y0 + geo.laneH - 4 - (rv / max) * (geo.laneH - 10)
      if (held !== null) {
        ctx.strokeStyle = dim
        ctx.setLineDash([2, 3])
        ctx.beginPath()
        ctx.moveTo(rx, y0)
        ctx.lineTo(rx, y0 + geo.laneH)
        ctx.stroke()
        ctx.setLineDash([])
        ctx.fillStyle = ink
        ctx.beginPath()
        ctx.arc(rx, ry, 4, 0, Math.PI * 2)
        ctx.fill()
      }
      ctx.textAlign = 'left'
      ctx.font = '10px ui-monospace, monospace'
      ctx.fillStyle = styles.getPropertyValue('--text').trim() || '#fff'
      ctx.fillText(rv.toLocaleString(), Math.min(rx + 8, width - 46), y0 + 12)
    })

    // the year axis
    ctx.textAlign = 'center'
    ctx.textBaseline = 'top'
    ctx.font = '9px ui-monospace, monospace'
    ctx.fillStyle = dim
    const axisY = geo.padT + lanes.length * (geo.laneH + geo.laneGap) + 2
    for (let year = 1900; year <= rows[n - 1].year; year += 20) {
      const i = rows.findIndex((r) => r.year === year)
      if (i < 0) continue
      ctx.fillText(String(year), xOf(i), axisY)
    }
  }, [width, height, geo, lanes, rows, n, pos, held, maxima])

  useEffect(() => {
    draw()
  }, [draw])

  const scrub = (clientX: number, target: HTMLCanvasElement) => {
    const rect = target.getBoundingClientRect()
    const t = (clientX - rect.left - geo.padL) / geo.plotW
    return Math.min(n - 1, Math.max(0, Math.round(t * (n - 1))))
  }

  const readAt = Math.min(n - 1, Math.round(held ?? pos))
  const readRow = rows[readAt]

  return (
    <Frame
      instrument={instrument}
      controls={
        <div className="pen__transport">
          <button
            type="button"
            className="pen__btn"
            onClick={() => {
              if (pos >= n - 1) setPos(0)
              setPlaying((p) => !p)
            }}
            disabled={!n}
          >
            {playing ? '❚❚ HOLD' : '▶ RUN'}
          </button>
          <button type="button" className="pen__btn" onClick={() => setPos(n - 1)} disabled={!n}>
            ⇥ END
          </button>
          <label className="pen__scrub">
            <span>YEAR</span>
            <input
              type="range"
              min={0}
              max={Math.max(0, n - 1)}
              value={Math.round(pos)}
              onChange={(e) => {
                setPlaying(false)
                setPos(Number(e.target.value))
              }}
              aria-label="Position the stylus by year"
            />
            <b>{readRow ? readRow.year : '—'}</b>
          </label>
        </div>
      }
      footer={
        <p className="pen__note">
          Each lane is scaled to its own maximum, printed beside its name — MENTIONS reaches{' '}
          {maxima.mentions?.toLocaleString() ?? '—'} and DOMAINS reaches {maxima.domains ?? '—'}, so a
          shared axis would flatten three lanes to make a point about one. Where MENTIONS climbs and
          PAGES does not, one page is doing the talking.
        </p>
      }
    >
      {loading && <p className="pen__state">winding the drum…</p>}
      {error && <p className="pen__state">{error}</p>}

      {data && (
        <div className="pen" ref={wrapRef}>
          <canvas
            ref={canvasRef}
            className="pen__canvas"
            role="img"
            aria-label={`Chart recorder, ${data.from} to ${data.to}. Lanes: ${lanes
              .map((l) => l.label)
              .join(', ')}.`}
            onPointerMove={(e) => setHeld(scrub(e.clientX, e.currentTarget))}
            onPointerLeave={() => setHeld(null)}
            onPointerDown={(e) => {
              setPlaying(false)
              setPos(scrub(e.clientX, e.currentTarget))
            }}
          />

          {readRow && (
            <dl className="pen__readout" aria-live="off">
              <div className="pen__year">
                <dt>YEAR</dt>
                <dd>{readRow.year}</dd>
              </div>
              {lanes.map((lane) => (
                <div key={lane.key}>
                  <dt>{lane.label}</dt>
                  <dd>{(readRow[lane.key] ?? 0).toLocaleString()}</dd>
                  <span>{lane.unit}</span>
                </div>
              ))}
            </dl>
          )}
        </div>
      )}
    </Frame>
  )
}
