import { useEffect, useMemo, useRef, useState } from 'react'
import { Frame } from '../Frame'
import { useSet, type ClockSet, type Instrument } from '../core'
import { usePortal } from '../../state/usePortal'
import { colourWith } from '../ink'
import '../pulse.css'

/**
 * ◈ CORPUS I · THE PULSE
 *
 * The whole record as one line: messages per day, 3,894 days of them, on a
 * window you can drag and zoom. A count and a date, and nothing else.
 *
 * ---- the reason this instrument is dangerous ------------------------------
 *
 * A volume chart is the easiest place on this site to tell a lie by accident.
 * Draw the days the exports cover and nothing else, and the twenty-eight months
 * missing from the middle of the archive render as twenty-eight months of
 * silence between two people — which is a claim about a relationship, made by a
 * gap in a zip file. **The gaps are drawn at their real width, hatched and
 * labelled**, exactly as THE TRANSCRIPT's rail draws them. Stating them is a
 * fact about the archive; leaving them out would have been a claim about the
 * thread.
 *
 * The old console banded four named eras behind this chart — NYC ONE,
 * UNIONTOWN, NYC TWO, RETURN. They do not come across. Those boundaries were
 * chosen by hand and are not in the corpus, and a band drawn behind a volume
 * curve is an invitation to read the curve as caused by the band. What is left
 * is the count.
 *
 * ---- one dataset, two instruments -----------------------------------------
 *
 * This reads `clock.json` rather than a set of its own, and derives the daily
 * counts from the same marks II · THE CLOCK draws. That is not laziness: two
 * instruments over one record that load different files can disagree, and the
 * one thing worse than a chart nobody checks is two charts that quietly
 * contradict each other.
 */
export function Pulse({ instrument }: { instrument: Instrument }) {
  const { data, error, loading } = useSet<ClockSet>('clock.json')

  /** Messages per day, folded out of the same packed marks THE CLOCK draws. */
  const daily = useMemo(() => {
    if (!data) return null
    const counts = new Int32Array(data.days)
    let value = 0
    for (let i = 0; i < data.marks.length; i++) {
      value += data.marks[i]
      counts[(value / 2880) | 0]++
    }
    let peak = 0
    let peakDay = 0
    let spoken = 0
    for (let d = 0; d < counts.length; d++) {
      if (counts[d] > peak) {
        peak = counts[d]
        peakDay = d
      }
      if (counts[d] > 0) spoken++
    }
    return { counts, peak, peakDay, spoken }
  }, [data])

  const [window_, setWindow] = useState<[number, number] | null>(null)

  if (loading)
    return (
      <Frame instrument={instrument}>
        <p className="inst__state">counting days…</p>
      </Frame>
    )

  if (error || !data || !daily)
    return (
      <Frame instrument={instrument}>
        <p className="inst__state">
          The dataset is missing ({error}). Run <code>npm run clock</code> and rebuild.
        </p>
      </Frame>
    )

  // `days` is a count and day indices are zero-based, so the last drawable day
  // is one short of it. Getting this wrong puts a day that does not exist on
  // the right-hand end of every readout.
  const lastDay = data.days - 1
  const view = window_ ?? [0, lastDay]
  const [from, to] = view
  const covered = data.days - gapDays(data)
  let inWindow = 0
  for (let d = Math.max(0, Math.floor(from)); d <= Math.min(lastDay, Math.ceil(to)); d++) {
    inWindow += daily.counts[d]
  }

  return (
    <Frame
      instrument={instrument}
      controls={
        <div className="pulse__jumps" role="group" aria-label="Window">
          <button
            type="button"
            className={`pulse__jump${window_ === null ? ' pulse__jump--on' : ''}`}
            onClick={() => setWindow(null)}
          >
            ALL
          </button>
          {data.years.map((year) => (
            <button
              key={year.year}
              type="button"
              className="pulse__jump"
              onClick={() => setWindow(yearWindow(data, year.year))}
            >
              {year.year}
            </button>
          ))}
        </div>
      }
      footer={
        <p className="inst__method">
          <b>THE GAPS</b> The exports cover 91 of the 129 months this record spans. The 38 that are
          missing are hatched and labelled at their real width, because a hole in an archive and a
          quiet month look identical if you only draw the months that survived. The old console
          banded four named eras behind this chart; they were chosen by hand rather than counted,
          so they do not come across.
        </p>
      }
    >
      <div className="pulse">
        <Trace data={data} daily={daily} view={view} onView={setWindow} />

        <div className="pulse__readouts">
          <p className="pulse__span">
            <b>{inWindow.toLocaleString()}</b> messages in view · {dayLabel(data, from)} →{' '}
            {dayLabel(data, to)} · {Math.round(to - from + 1).toLocaleString()} days
          </p>
          <p className="pulse__note">
            Drag the trace to pan, scroll it to zoom, or jump to a year. Every bar is one day and
            every day in the span is drawn, including the ones with nothing in them.
          </p>

          <dl className="pulse__facts">
            <dt>BUSIEST DAY</dt>
            <dd>
              {dayLabel(data, daily.peakDay)} · {daily.peak.toLocaleString()} messages
            </dd>
            <dt>DAYS WITH ANYTHING</dt>
            <dd>
              {daily.spoken.toLocaleString()} of {covered.toLocaleString()} covered days ·{' '}
              {(daily.spoken / covered * 100).toFixed(1)}%
            </dd>
            <dt>DAYS NOT COVERED</dt>
            <dd>{gapDays(data).toLocaleString()} across 38 months of missing export</dd>
            <dt>MEAN OVER COVERED DAYS</dt>
            <dd>{(data.count / covered).toFixed(1)} messages</dd>
          </dl>

          <h3 className="pulse__sub">BY YEAR</h3>
          <ol className="pulse__years">
            {data.years.map((year) => (
              <li key={year.year}>
                <button type="button" onClick={() => setWindow(yearWindow(data, year.year))}>
                  <span className="pulse__year-label">{year.year}</span>
                  <span className="pulse__bar">
                    <span
                      className="pulse__fill"
                      style={{
                        inlineSize: `${(year.count / Math.max(...data.years.map((y) => y.count))) * 100}%`,
                      }}
                    />
                  </span>
                  <span className="pulse__year-n">{year.count.toLocaleString()}</span>
                </button>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </Frame>
  )
}

// ---------------------------------------------------------------------------

type Daily = { counts: Int32Array; peak: number; peakDay: number; spoken: number }

const DAY_MS = 86_400_000

const gapDays = (data: ClockSet) =>
  data.gaps.reduce((n, gap) => n + (gap.toDay - gap.fromDay + 1), 0)

const dayDate = (data: ClockSet, day: number) => {
  const at = Date.UTC(+data.from.slice(0, 4), +data.from.slice(5, 7) - 1, +data.from.slice(8, 10))
  return new Date(at + Math.round(day) * DAY_MS)
}

const dayLabel = (data: ClockSet, day: number) => dayDate(data, day).toISOString().slice(0, 10)

function yearWindow(data: ClockSet, year: number): [number, number] {
  const at = (iso: string) =>
    Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10)) / DAY_MS
  const zero = at(data.from)
  return [
    Math.max(0, at(`${year}-01-01`) - zero),
    Math.min(data.days - 1, at(`${year}-12-31`) - zero),
  ]
}

/**
 * The trace.
 *
 * Bars, not a line: a line between two days implies the days between them and
 * there are none — every value here is a day, and a day is a bar. At full span
 * that is 3,894 bars across about a thousand pixels, so several land on the
 * same column; the tallest wins the column rather than the last one, because
 * the alternative is a chart whose peaks appear and vanish as you resize.
 */
function Trace({
  data,
  daily,
  view,
  onView,
}: {
  data: ClockSet
  daily: Daily
  view: [number, number]
  onView: (view: [number, number] | null) => void
}) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const drag = useRef<{ x: number; from: number; to: number } | null>(null)
  const { vibe } = usePortal()

  useEffect(() => {
    const el = canvas.current
    if (!el) return
    const ctx = el.getContext('2d')
    if (!ctx) return

    const ink = getComputedStyle(el)
    const bar = ink.getPropertyValue('--n1').trim() || '#f5c400'
    const grid = ink.getPropertyValue('--text-dim').trim() || '#888'
    const paper = ink.getPropertyValue('--paper').trim() || '#e8e2d4'

    const paint = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1)
      const box = el.getBoundingClientRect()
      const w = Math.max(280, box.width)
      const h = Math.max(200, box.height)
      if (el.width !== Math.round(w * dpr)) {
        el.width = Math.round(w * dpr)
        el.height = Math.round(h * dpr)
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, w, h)

      const [from, to] = view
      const span = Math.max(1, to - from)
      const padB = 22
      const plot = h - padB - 8
      const xOf = (day: number) => ((day - from) / span) * w

      // ---- the gaps, first and underneath ---------------------------------
      // Hatched at their real width. They are drawn before the bars so a day
      // that does have messages inside a gap month is still visible on top.
      for (const gap of data.gaps) {
        const x0 = xOf(gap.fromDay)
        const x1 = xOf(gap.toDay + 1)
        if (x1 < 0 || x0 > w) continue
        ctx.save()
        ctx.beginPath()
        ctx.rect(Math.max(0, x0), 8, Math.min(w, x1) - Math.max(0, x0), plot)
        ctx.clip()
        ctx.strokeStyle = colourWith(grid, 0.35)
        ctx.lineWidth = 1
        for (let x = Math.max(0, x0) - plot; x < Math.min(w, x1) + plot; x += 7) {
          ctx.beginPath()
          ctx.moveTo(x, 8 + plot)
          ctx.lineTo(x + plot, 8)
          ctx.stroke()
        }
        ctx.restore()
        if (x1 - x0 > 64) {
          ctx.fillStyle = colourWith(paper, 0.75)
          ctx.font = '9px ui-monospace, monospace'
          ctx.textAlign = 'center'
          ctx.fillText(
            `${gap.months} MONTH${gap.months === 1 ? '' : 'S'} NOT EXPORTED`,
            (Math.max(0, x0) + Math.min(w, x1)) / 2,
            16,
          )
        }
      }

      // ---- the bars --------------------------------------------------------
      // One column per pixel, holding the tallest day that lands in it.
      const columns = new Float64Array(Math.ceil(w))
      let top = 0
      for (let day = Math.max(0, Math.floor(from)); day <= Math.min(data.days - 1, Math.ceil(to)); day++) {
        const n = daily.counts[day]
        if (!n) continue
        const col = Math.floor(xOf(day))
        if (col < 0 || col >= columns.length) continue
        if (n > columns[col]) columns[col] = n
        if (n > top) top = n
      }

      ctx.fillStyle = colourWith(bar, 0.9)
      const width = Math.max(1, w / span < 1 ? 1 : w / span - 0.5)
      for (let col = 0; col < columns.length; col++) {
        const n = columns[col]
        if (!n) continue
        const barH = (n / Math.max(1, top)) * plot
        ctx.fillRect(col, 8 + plot - barH, width, barH)
      }

      // ---- the axis --------------------------------------------------------
      ctx.strokeStyle = colourWith(grid, 0.4)
      ctx.beginPath()
      ctx.moveTo(0, 8 + plot + 0.5)
      ctx.lineTo(w, 8 + plot + 0.5)
      ctx.stroke()

      ctx.font = '10px ui-monospace, monospace'
      ctx.fillStyle = colourWith(paper, 0.7)
      ctx.textAlign = 'center'
      ctx.textBaseline = 'top'
      const ticks = span > 1200 ? 'year' : span > 120 ? 'quarter' : 'month'
      for (let day = Math.floor(from); day <= Math.ceil(to); day++) {
        const date = dayDate(data, day)
        const isFirst = date.getUTCDate() === 1
        if (!isFirst) continue
        const month = date.getUTCMonth()
        const show =
          ticks === 'year' ? month === 0 : ticks === 'quarter' ? month % 3 === 0 : true
        if (!show) continue
        const x = xOf(day)
        if (x < 14 || x > w - 14) continue
        ctx.strokeStyle = colourWith(grid, 0.18)
        ctx.beginPath()
        ctx.moveTo(x, 8)
        ctx.lineTo(x, 8 + plot)
        ctx.stroke()
        ctx.fillText(
          ticks === 'year'
            ? String(date.getUTCFullYear())
            : `${date.toISOString().slice(0, 7)}`,
          x,
          8 + plot + 5,
        )
      }

      ctx.textAlign = 'left'
      ctx.fillStyle = colourWith(paper, 0.85)
      ctx.fillText(`PEAK IN VIEW ${top.toLocaleString()} / DAY`, 6, 8)
    }

    paint()
    const observer = new ResizeObserver(paint)
    observer.observe(el)
    return () => observer.disconnect()
  }, [data, daily, view, vibe])

  // ---- panning and zooming -------------------------------------------------

  const clamp = (from: number, to: number): [number, number] => {
    const whole = data.days - 1
    const span = Math.min(whole, Math.max(6, to - from))
    const start = Math.max(0, Math.min(whole - span, from))
    return [start, start + span]
  }

  return (
    <figure className="pulse__figure">
      <canvas
        ref={canvas}
        className="pulse__canvas"
        onPointerDown={(e) => {
          drag.current = { x: e.clientX, from: view[0], to: view[1] }
          e.currentTarget.setPointerCapture(e.pointerId)
        }}
        onPointerMove={(e) => {
          const held = drag.current
          if (!held) return
          const w = e.currentTarget.getBoundingClientRect().width
          const perPixel = (held.to - held.from) / w
          const shift = (held.x - e.clientX) * perPixel
          onView(clamp(held.from + shift, held.to + shift))
        }}
        onPointerUp={() => {
          drag.current = null
        }}
        onPointerCancel={() => {
          drag.current = null
        }}
        onWheel={(e) => {
          const box = e.currentTarget.getBoundingClientRect()
          const at = view[0] + ((e.clientX - box.left) / box.width) * (view[1] - view[0])
          const factor = e.deltaY > 0 ? 1.25 : 0.8
          onView(clamp(at - (at - view[0]) * factor, at + (view[1] - at) * factor))
        }}
      />
      <figcaption className="pulse__legend">
        <span className="pulse__key">ONE BAR IS ONE DAY</span>
        <span className="pulse__key pulse__key--gap">HATCHED = NOT EXPORTED</span>
        <span className="pulse__key-say">drag to pan · scroll to zoom</span>
      </figcaption>
    </figure>
  )
}
