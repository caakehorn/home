import { useEffect, useMemo, useRef, useState } from 'react'
import { Frame } from '../Frame'
import { useSet, type ClockSet, type Instrument } from '../core'
import { usePortal } from '../../state/usePortal'
import '../clock.css'

type Side = 'all' | 'sent' | 'received'

/**
 * ◈ CORPUS II · THE CLOCK
 *
 * Eleven years of messages on one spiral. **Angle is the hour of the day.**
 * **Radius is the date** — the first message at the centre, the last at the rim.
 * One mark per message, all 134,348 of them, nothing sampled and nothing binned.
 *
 * This is the second-oldest instrument in the old repo and the one that most
 * deserved rebuilding, because the shape it draws is not a claim about anybody:
 * a wedge of empty spiral is a person asleep, and the reader can see that for
 * themselves without the instrument saying a word about it. Every number on the
 * page is a count of marks.
 *
 * ---- why it is a canvas ---------------------------------------------------
 *
 * 134,348 marks is 134,348 DOM nodes in SVG, which is a locked tab. The
 * trade-off canvas makes is that the picture is not text, so everything the
 * spiral says is also printed underneath it as counts — the hour table is not
 * a footnote, it is the same instrument in the form a screen reader can read.
 */
export function Clock({ instrument }: { instrument: Instrument }) {
  const { data, error, loading } = useSet<ClockSet>('clock.json')
  const [side, setSide] = useState<Side>('all')

  /**
   * The pack, undone: `day * 2880 + minute * 2 + dir`, delta-encoded. One prefix
   * sum and it is the record again. Held in a typed array because 134k boxed
   * numbers in a plain array is about a megabyte of heap for no reason.
   */
  const marks = useMemo(() => {
    if (!data) return null
    const out = new Int32Array(data.marks.length)
    let value = 0
    for (let i = 0; i < data.marks.length; i++) {
      value += data.marks[i]
      out[i] = value
    }
    return out
  }, [data])

  if (loading)
    return (
      <Frame instrument={instrument}>
        <p className="inst__state">reading eleven years…</p>
      </Frame>
    )

  if (error || !data || !marks)
    return (
      <Frame instrument={instrument}>
        <p className="inst__state">
          The dataset is missing ({error}). Run <code>npm run clock</code> and rebuild.
        </p>
      </Frame>
    )

  const peak = Math.max(...data.hours.map((h) => h.all))
  const busiest = data.hours.reduce((best, h, i) => (h.all > data.hours[best].all ? i : best), 0)
  const quietest = data.hours.reduce((worst, h, i) => (h.all < data.hours[worst].all ? i : worst), 0)
  const shown = side === 'all' ? data.count : side === 'sent' ? data.sent : data.received

  return (
    <Frame
      instrument={instrument}
      controls={
        <div className="clock__sides" role="group" aria-label="Direction">
          {(
            [
              ['all', `ALL ${data.count.toLocaleString()}`],
              ['sent', `SENT ${data.sent.toLocaleString()}`],
              ['received', `RECEIVED ${data.received.toLocaleString()}`],
            ] as [Side, string][]
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              className={`clock__side${side === value ? ' clock__side--on' : ''}`}
              aria-pressed={side === value}
              onClick={() => setSide(value)}
            >
              {label}
            </button>
          ))}
        </div>
      }
      footer={
        <p className="inst__method">
          <b>THE TIMEZONE</b> Timestamps are sliced out of the{' '}
          <code>&quot;YYYY-MM-DD HH:MM:SS&quot;</code> string and never handed to{' '}
          <code>Date()</code>. The export carries local wall-clock time with no zone on it, so
          parsing it would make the runtime guess one — and on an instrument whose whole axis is
          the hour of the day, a guess in the wrong direction moves somebody&apos;s bedtime to the
          afternoon.
        </p>
      }
    >
      <div className="clock">
        <Spiral data={data} marks={marks} side={side} />

        <div className="clock__readouts">
          <p className="clock__span">
            <b>{shown.toLocaleString()}</b> marks · {data.from} → {data.to} ·{' '}
            {data.days.toLocaleString()} days · centre is the first message, rim is the last
          </p>

          <h3 className="clock__sub">BY HOUR OF THE DAY</h3>
          <ol className="clock__hours">
            {data.hours.map((hour, i) => {
              const n = side === 'all' ? hour.all : side === 'sent' ? hour.sent : hour.received
              return (
                <li key={i} className="clock__hour">
                  <span className="clock__hour-label">{String(i).padStart(2, '0')}</span>
                  <span className="clock__hour-bar">
                    <span
                      className="clock__hour-fill"
                      style={{ inlineSize: `${(n / peak) * 100}%` }}
                    />
                  </span>
                  <span className="clock__hour-n">{n.toLocaleString()}</span>
                </li>
              )
            })}
          </ol>
          <p className="clock__note">
            Densest hour is {String(busiest).padStart(2, '0')}:00 with{' '}
            {data.hours[busiest].all.toLocaleString()} messages; thinnest is{' '}
            {String(quietest).padStart(2, '0')}:00 with{' '}
            {data.hours[quietest].all.toLocaleString()}. Both are counts of marks in this record and
            neither is called anything.
          </p>

          <h3 className="clock__sub">BY YEAR</h3>
          <ol className="clock__years">
            {data.years.map((year) => (
              <li key={year.year}>
                <span className="clock__year-label">{year.year}</span>
                <span className="clock__hour-bar">
                  <span
                    className="clock__hour-fill clock__hour-fill--year"
                    style={{
                      inlineSize: `${(year.count / Math.max(...data.years.map((y) => y.count))) * 100}%`,
                    }}
                  />
                </span>
                <span className="clock__hour-n">{year.count.toLocaleString()}</span>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </Frame>
  )
}

// ---------------------------------------------------------------------------

const TAU = Math.PI * 2
const HOUR_SPOKES = [0, 3, 6, 9, 12, 15, 18, 21]

/**
 * The spiral itself.
 *
 * It draws once and then appends: on a first paint the marks arrive in slices
 * across a couple of seconds, which is not decoration — 134,348 `fillRect`s in
 * one frame is a visible stall, and slicing them turns the cost into the
 * drawing you were going to watch anyway. With MOTION off they all land in the
 * first frame and the stall is the honest price of not moving.
 */
function Spiral({ data, marks, side }: { data: ClockSet; marks: Int32Array; side: Side }) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const drawn = useRef(0)
  const { motion, vibe } = usePortal()

  useEffect(() => {
    const el = canvas.current
    if (!el) return
    const ctx = el.getContext('2d')
    if (!ctx) return

    const ink = getComputedStyle(el)
    const grid = ink.getPropertyValue('--text-dim').trim() || '#888'
    const text = ink.getPropertyValue('--text').trim() || '#eee'

    /**
     * Two channels, and direction is the only thing colour encodes here — so
     * the two have to be told apart in every palette, and in RIOT they are not:
     * that room has two inks, and `--n1` and `--n3` are the same red twice
     * through the machine. Where the ramp collapses, the second channel falls
     * back to bare paper, which is a constant across all five and is legible on
     * a mount this dark. The switch above is the other half of the answer:
     * anyone who cannot separate two colours can isolate one direction.
     */
    const sentColour = ink.getPropertyValue('--n1').trim() || '#f5c400'
    const ramp = ink.getPropertyValue('--n3').trim() || '#00eaff'
    const paper = ink.getPropertyValue('--paper').trim() || '#e8e2d4'
    const recvColour = apart(sentColour, ramp) ? ramp : paper

    // On the <figure>, not the canvas: custom properties inherit down, and the
    // legend is the canvas's sibling.
    const figure = el.closest('.clock__figure')
    if (figure instanceof HTMLElement) {
      figure.style.setProperty('--clock-sent', sentColour)
      figure.style.setProperty('--clock-recv', recvColour)
    }

    let frame = 0
    let stopped = false

    const paint = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1)
      const box = el.getBoundingClientRect()
      const size = Math.max(320, Math.min(box.width, 760))
      if (el.width !== Math.round(size * dpr)) {
        el.width = Math.round(size * dpr)
        el.height = Math.round(size * dpr)
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

      const cx = size / 2
      const cy = size / 2
      const r0 = size * 0.085
      const r1 = size * 0.44

      // ---- the grid: hour spokes and year rings ---------------------------
      ctx.clearRect(0, 0, size, size)
      ctx.lineWidth = 1
      ctx.font = '10px ui-monospace, monospace'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'

      for (const hour of HOUR_SPOKES) {
        const angle = (hour / 24) * TAU - Math.PI / 2
        ctx.strokeStyle = colourWith(grid, 0.22)
        ctx.beginPath()
        ctx.moveTo(cx + Math.cos(angle) * r0, cy + Math.sin(angle) * r0)
        ctx.lineTo(cx + Math.cos(angle) * r1, cy + Math.sin(angle) * r1)
        ctx.stroke()
        ctx.fillStyle = colourWith(text, 0.75)
        ctx.fillText(
          `${String(hour).padStart(2, '0')}`,
          cx + Math.cos(angle) * (r1 + 16),
          cy + Math.sin(angle) * (r1 + 16),
        )
      }

      for (const { year } of data.years) {
        const day = daysBetween(data.from, `${year}-01-01`)
        if (day < 0 || day > data.days) continue
        const r = r0 + (day / data.days) * (r1 - r0)
        ctx.strokeStyle = colourWith(grid, 0.16)
        ctx.beginPath()
        ctx.arc(cx, cy, r, 0, TAU)
        ctx.stroke()
        ctx.fillStyle = colourWith(text, 0.5)
        ctx.textAlign = 'left'
        ctx.fillText(String(year), cx + 4, cy - r)
        ctx.textAlign = 'center'
      }

      // ---- the marks -------------------------------------------------------
      drawn.current = 0
      const total = marks.length
      const slice = motion ? Math.ceil(total / 90) : total

      const step = () => {
        if (stopped) return
        const until = Math.min(total, drawn.current + slice)
        for (let i = drawn.current; i < until; i++) {
          const value = marks[i]
          const day = (value / 2880) | 0
          const rest = value - day * 2880
          const minute = rest >> 1
          const dir = rest & 1
          if (side === 'sent' && dir !== 1) continue
          if (side === 'received' && dir !== 0) continue

          const angle = (minute / 1440) * TAU - Math.PI / 2
          const r = r0 + (day / data.days) * (r1 - r0)
          ctx.fillStyle = colourWith(dir ? sentColour : recvColour, 0.5)
          ctx.fillRect(cx + Math.cos(angle) * r, cy + Math.sin(angle) * r, 1.4, 1.4)
        }
        drawn.current = until
        if (until < total) frame = requestAnimationFrame(step)
      }
      step()
    }

    paint()
    const observer = new ResizeObserver(() => paint())
    observer.observe(el)
    return () => {
      stopped = true
      cancelAnimationFrame(frame)
      observer.disconnect()
    }
  }, [data, marks, side, motion, vibe])

  return (
    <figure className="clock__figure">
      <canvas ref={canvas} className="clock__canvas" />
      <figcaption className="clock__legend">
        <span className="clock__key clock__key--sent">SENT</span>
        <span className="clock__key clock__key--received">RECEIVED</span>
        <span className="clock__key-say">
          angle is the hour · radius is the date · one mark is one message
        </span>
      </figcaption>
    </figure>
  )
}

/**
 * Far enough apart to carry a channel each. A blunt RGB city-block distance is
 * the right amount of cleverness for a question with one real answer: RIOT's
 * two reds fail it, and the other four palettes clear it by a mile.
 */
function apart(a: string, b: string) {
  const rgb = (hex: string) => {
    if (!hex.startsWith('#')) return null
    const full = hex.length === 4 ? hex.slice(1).split('').map((c) => c + c).join('') : hex.slice(1)
    const n = Number.parseInt(full, 16)
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
  }
  const x = rgb(a)
  const y = rgb(b)
  if (!x || !y) return true
  return Math.abs(x[0] - y[0]) + Math.abs(x[1] - y[1]) + Math.abs(x[2] - y[2]) > 180
}

/** A hex or rgb() colour at an alpha, without a colour library for four uses. */
function colourWith(colour: string, alpha: number) {
  if (colour.startsWith('#')) {
    const hex = colour.length === 4
      ? colour.slice(1).split('').map((c) => c + c).join('')
      : colour.slice(1)
    const n = Number.parseInt(hex, 16)
    return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`
  }
  return colour
}

/** Whole days between two ISO dates, by calendar arithmetic on the parts. */
function daysBetween(from: string, to: string) {
  const at = (iso: string) =>
    Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10)) / 86_400_000
  return at(to) - at(from)
}
