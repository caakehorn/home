import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { Frame } from './Frame'
import { useSet, type Instrument } from './core'
import { colourWith } from './ink'
import { useWidth } from '../wiki/useWidth'
import './pen.css'

/** A row is one position on the drum: the lane values, plus whatever labels it. */
export type PenRow = Record<string, number | string>

export type PenLane = { key: string; label: string; unit: string }

export type PenSet = {
  lanes: PenLane[]
  rows: PenRow[]
}

export type PenAxis = {
  /** What the scrub control calls a position — YEAR, MONTH. */
  label: string
  /** How a row prints in the readout and beside the scrubber. */
  stamp: (row: PenRow) => string
  /** Which rows get a tick under the drum, and what it says. */
  ticks: (rows: PenRow[]) => { i: number; text: string }[]
  /**
   * Rows the record does not cover. They are hatched rather than traced
   * through: a month with no export is not a month with no messages, and a
   * line drawn across it would assert the second.
   */
  blank?: (row: PenRow) => boolean
}

/**
 * THE PEN SCAFFOLD — the chart recorder, shared.
 *
 * The old site's `js/pen-core.js` drew a moving stylus over stacked lanes and
 * looked like an instrument without measuring anything: the jitter on the pen
 * head was `Math.random()`, and the four pens the console hung off it were
 * keyword lists. The chrome survives here because a chart recorder is a
 * genuinely good way to read four series against one axis; what changed is
 * that the lanes carry counts and the stylus sits exactly where the value is.
 *
 * It lives out here, rather than inside one instrument, for the same reason
 * the original did: more than one thing wants to be read this way. THE PEN
 * runs it over the wiki's dated mentions; THE RECORDER runs it over the
 * message record.
 *
 * Each lane keeps its own vertical scale. That is the one liberty taken, and
 * it is the right one: two lanes three orders of magnitude apart would flatten
 * one into the floor to make a point about the other. Every lane prints its
 * own maximum, so no lane can borrow another's altitude without saying so.
 */
export function PenChart({
  instrument,
  file,
  axis,
  speed = 14,
  footer,
}: {
  instrument: Instrument
  /** The dataset under /leviathan this drum is wound with. */
  file: string
  axis: PenAxis
  /** Positions per second under ▶ RUN. */
  speed?: number
  /** The instrument's own reading of its lanes, given their maxima. */
  footer?: (maxima: Record<string, number>) => ReactNode
}) {
  const { data, error, loading } = useSet<PenSet>(file)
  const [wrapRef, width] = useWidth<HTMLDivElement>(880, 320)

  const [playing, setPlaying] = useState(false)
  const [pos, setPos] = useState(1)
  const [held, setHeld] = useState<number | null>(null)

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const raf = useRef(0)

  const rows = data?.rows ?? []
  const lanes = data?.lanes ?? []
  const n = rows.length

  const valueAt = (row: PenRow | undefined, key: string) => Number(row?.[key] ?? 0)

  // Per-lane maxima: each lane is read against itself, and says so.
  const maxima = useMemo(() => {
    const out: Record<string, number> = {}
    for (const lane of lanes) out[lane.key] = Math.max(1, ...rows.map((r) => Number(r[lane.key] ?? 0)))
    return out
  }, [lanes, rows])

  const ticks = useMemo(() => (n ? axis.ticks(rows) : []), [axis, rows, n])

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
        const next = p + dt * speed
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
  }, [playing, n, speed])

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
    const text = styles.getPropertyValue('--text').trim() || '#fff'

    const xOf = (i: number) => geo.padL + (i / Math.max(1, n - 1)) * geo.plotW
    const readAt = held ?? pos
    const blank = axis.blank ?? (() => false)

    /** Contiguous stretches the record does not cover, as [from, to] indices. */
    const blanks: { from: number; to: number }[] = []
    for (let i = 0; i < n; i++) {
      if (!blank(rows[i])) continue
      const last = blanks[blanks.length - 1]
      if (last && last.to === i - 1) last.to = i
      else blanks.push({ from: i, to: i })
    }

    lanes.forEach((lane, li) => {
      const y0 = geo.padT + li * (geo.laneH + geo.laneGap)
      const max = maxima[lane.key]

      // paper
      ctx.fillStyle = paper
      ctx.fillRect(geo.padL, y0, geo.plotW, geo.laneH)

      // the holes in the record, hatched at their real width — the same mark
      // THE PULSE and THE RINGS use, so a reader who has seen one knows it.
      for (const run of blanks) {
        const x0 = xOf(run.from - 0.5)
        const x1 = xOf(run.to + 0.5)
        ctx.save()
        ctx.beginPath()
        ctx.rect(x0, y0, x1 - x0, geo.laneH)
        ctx.clip()
        ctx.strokeStyle = colourWith(dim, 0.35)
        ctx.lineWidth = 1
        for (let x = x0 - geo.laneH; x < x1; x += 7) {
          ctx.beginPath()
          ctx.moveTo(x, y0 + geo.laneH)
          ctx.lineTo(x + geo.laneH, y0)
          ctx.stroke()
        }
        ctx.restore()
      }

      ctx.strokeStyle = rule
      ctx.lineWidth = 1
      ctx.strokeRect(geo.padL + 0.5, y0 + 0.5, geo.plotW, geo.laneH)

      // lane identity, in text tokens rather than the trace colour
      ctx.textAlign = 'right'
      ctx.textBaseline = 'middle'
      ctx.font = '10px ui-monospace, monospace'
      ctx.fillStyle = text
      ctx.fillText(lane.label, geo.padL - 12, y0 + geo.laneH / 2 - 6)
      ctx.fillStyle = dim
      ctx.font = '9px ui-monospace, monospace'
      ctx.fillText(`max ${max.toLocaleString()}`, geo.padL - 12, y0 + geo.laneH / 2 + 8)

      // the trace, drawn only as far as the stylus has travelled, and lifted
      // clean off the paper over the stretches the record does not cover
      ctx.strokeStyle = ink
      ctx.lineWidth = 1.6
      ctx.lineJoin = 'round'
      ctx.beginPath()
      const upto = Math.floor(pos)
      let down = false
      for (let i = 0; i <= upto; i++) {
        if (blank(rows[i])) {
          down = false
          continue
        }
        const v = valueAt(rows[i], lane.key)
        const x = xOf(i)
        const y = y0 + geo.laneH - 4 - (v / max) * (geo.laneH - 10)
        down ? ctx.lineTo(x, y) : ctx.moveTo(x, y)
        down = true
      }
      ctx.stroke()

      // the stylus, at the value — not near it
      const i0 = Math.min(n - 1, Math.floor(pos))
      const v = valueAt(rows[i0], lane.key)
      const px = xOf(pos)
      const py = y0 + geo.laneH - 4 - (v / max) * (geo.laneH - 10)
      ctx.fillStyle = ink
      ctx.beginPath()
      ctx.arc(px, py, 3.2, 0, Math.PI * 2)
      ctx.fill()

      // the readout follows the held position when there is one
      const ri = Math.min(n - 1, Math.round(readAt))
      const rv = valueAt(rows[ri], lane.key)
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
        if (!blank(rows[ri])) {
          ctx.fillStyle = ink
          ctx.beginPath()
          ctx.arc(rx, ry, 4, 0, Math.PI * 2)
          ctx.fill()
        }
      }
      ctx.textAlign = 'left'
      ctx.font = '10px ui-monospace, monospace'
      ctx.fillStyle = text
      ctx.fillText(
        blank(rows[ri]) ? 'no export' : rv.toLocaleString(),
        Math.min(rx + 8, width - 60),
        y0 + 12,
      )
    })

    // the axis
    ctx.textAlign = 'center'
    ctx.textBaseline = 'top'
    ctx.font = '9px ui-monospace, monospace'
    ctx.fillStyle = dim
    const axisY = geo.padT + lanes.length * (geo.laneH + geo.laneGap) + 2
    for (const tick of ticks) ctx.fillText(tick.text, xOf(tick.i), axisY)
  }, [width, height, geo, lanes, rows, n, pos, held, maxima, ticks, axis])

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
  const readBlank = readRow ? (axis.blank?.(readRow) ?? false) : false

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
            <span>{axis.label}</span>
            <input
              type="range"
              min={0}
              max={Math.max(0, n - 1)}
              value={Math.round(pos)}
              onChange={(e) => {
                setPlaying(false)
                setPos(Number(e.target.value))
              }}
              aria-label={`Position the stylus by ${axis.label.toLowerCase()}`}
            />
            <b>{readRow ? axis.stamp(readRow) : '—'}</b>
          </label>
        </div>
      }
      footer={footer?.(maxima)}
    >
      {loading && <p className="pen__state">winding the drum…</p>}
      {error && <p className="pen__state">{error}</p>}

      {data && (
        <div className="pen" ref={wrapRef}>
          <canvas
            ref={canvasRef}
            className="pen__canvas"
            role="img"
            aria-label={`Chart recorder, ${rows.length ? axis.stamp(rows[0]) : '—'} to ${
              rows.length ? axis.stamp(rows[rows.length - 1]) : '—'
            }. Lanes: ${lanes.map((l) => l.label).join(', ')}.`}
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
                <dt>{axis.label}</dt>
                <dd>{axis.stamp(readRow)}</dd>
              </div>
              {lanes.map((lane) => (
                <div key={lane.key}>
                  <dt>{lane.label}</dt>
                  <dd>{readBlank ? '—' : valueAt(readRow, lane.key).toLocaleString()}</dd>
                  <span>{readBlank ? 'no export covers this month' : lane.unit}</span>
                </div>
              ))}
            </dl>
          )}
        </div>
      )}
    </Frame>
  )
}
