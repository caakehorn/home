import { useEffect, useMemo, useRef, useState } from 'react'
import { Frame } from '../Frame'
import { useSet, type ClockSet, type Instrument } from '../core'
import { usePortal } from '../../state/usePortal'
import { colourWith } from '../ink'

/**
 * ◈ CORPUS XIII · THE RINGS
 *
 * Eleven years coiled into circles — one ring per year, one mark per day,
 * January at the top and December back round to it. A day with nothing in it
 * is a notch you can see from across the room, and that is the whole reading:
 * the record is not a smooth decade, it is a stack of years with different
 * amounts missing from each.
 *
 * Where THE CLOCK folds the record by hour and THE PULSE lays it out flat,
 * this folds it by year, which is the one axis that makes an eleven-year shape
 * comparable to itself. All three read the same `clock.json`.
 *
 * A day inside a month the exports do not cover is drawn hollow rather than
 * empty. Empty would say nobody wrote that day; hollow says nobody can tell.
 */
export function Rings({ instrument }: { instrument: Instrument }) {
  const { data, error, loading } = useSet<ClockSet>('clock.json')
  const [scale, setScale] = useState<'own' | 'shared'>('shared')

  const rings = useMemo(() => {
    if (!data) return null

    const zero = Date.UTC(
      +data.from.slice(0, 4),
      +data.from.slice(5, 7) - 1,
      +data.from.slice(8, 10),
    )

    /** Per year: one count per day of that year, plus which days are unexported. */
    const byYear = new Map<number, { days: Int32Array; hole: Uint8Array; total: number }>()
    const yearOf = (day: number) => new Date(zero + day * 86_400_000).getUTCFullYear()
    const dayOfYear = (day: number) => {
      const at = new Date(zero + day * 86_400_000)
      return Math.floor((at.getTime() - Date.UTC(at.getUTCFullYear(), 0, 1)) / 86_400_000)
    }
    const ensure = (year: number) => {
      let row = byYear.get(year)
      if (!row) {
        row = { days: new Int32Array(366), hole: new Uint8Array(366), total: 0 }
        byYear.set(year, row)
      }
      return row
    }

    for (const { year } of data.years) ensure(year)

    let value = 0
    for (let i = 0; i < data.marks.length; i++) {
      value += data.marks[i]
      const day = (value / 2880) | 0
      const row = ensure(yearOf(day))
      row.days[dayOfYear(day)]++
      row.total++
    }

    for (const gap of data.gaps) {
      for (let day = gap.fromDay; day <= gap.toDay; day++) {
        const row = byYear.get(yearOf(day))
        if (row) row.hole[dayOfYear(day)] = 1
      }
    }

    const years = [...byYear.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([year, row]) => {
        let peak = 0
        let spoken = 0
        let holes = 0
        for (let d = 0; d < 366; d++) {
          if (row.days[d] > peak) peak = row.days[d]
          if (row.days[d] > 0) spoken++
          if (row.hole[d]) holes++
        }
        return { year, ...row, peak, spoken, holes }
      })

    return { years, peak: Math.max(...years.map((y) => y.peak)) }
  }, [data])

  if (loading)
    return (
      <Frame instrument={instrument}>
        <p className="inst__state">coiling…</p>
      </Frame>
    )

  if (error || !data || !rings)
    return (
      <Frame instrument={instrument}>
        <p className="inst__state">
          The dataset is missing ({error}). Run <code>npm run clock</code> and rebuild.
        </p>
      </Frame>
    )

  return (
    <Frame
      instrument={instrument}
      controls={
        <div className="pt-chips" role="group" aria-label="Scale">
          <button
            type="button"
            className={`pt-chip${scale === 'shared' ? ' pt-chip--on' : ''}`}
            aria-pressed={scale === 'shared'}
            onClick={() => setScale('shared')}
          >
            ONE SCALE
          </button>
          <button
            type="button"
            className={`pt-chip${scale === 'own' ? ' pt-chip--on' : ''}`}
            aria-pressed={scale === 'own'}
            onClick={() => setScale('own')}
          >
            EACH TO ITSELF
          </button>
        </div>
      }
      footer={
        <p className="inst__method">
          <b>THE TWO SCALES</b> ONE SCALE draws every ring against the busiest day in the whole
          record, so the rings are comparable and most of them are nearly flat. EACH TO ITSELF draws
          every ring against its own busiest day, so the shape within a year is legible and the
          heights mean nothing across rings. Neither is the honest one; having only one of them
          would have been the dishonest thing, and the busiest day of each year is printed beside it
          either way. Under both, a day carrying any message at all is drawn at least a pixel and a
          half tall — without that floor an ordinary year beside 2015 renders as a clean circle,
          which would say it was silent rather than ordinary.
        </p>
      }
    >
      <div className="pt-split">
        <Coils rings={rings} scale={scale} />

        <div className="pt-stack">
          <p className="pt-note">
            One ring per year, one mark per day, January at the top and the year running clockwise.
            The mark points outward by how many messages that day carried.
          </p>

          <h3 className="pt-sub">DAYS WITH ANYTHING ON THEM</h3>
          <ol
            className="pt-rows"
            style={{ ['--pt-label' as string]: '3rem', ['--pt-value' as string]: '3rem' }}
          >
            {rings.years.map((year) => (
              <li key={year.year} className="pt-row">
                <span className="pt-label">{year.year}</span>
                <span className="pt-bar">
                  <span className="pt-fill" style={{ inlineSize: `${(year.spoken / 366) * 100}%` }} />
                </span>
                <span className="pt-value">{year.spoken}</span>
              </li>
            ))}
          </ol>

          <h3 className="pt-sub">DAYS NOBODY HAS</h3>
          <ol
            className="pt-rows"
            style={{ ['--pt-label' as string]: '3rem', ['--pt-value' as string]: '3rem' }}
          >
            {rings.years
              .filter((year) => year.holes > 0)
              .map((year) => (
                <li key={year.year} className="pt-row">
                  <span className="pt-label">{year.year}</span>
                  <span className="pt-bar">
                    <span
                      className="pt-fill pt-fill--warn"
                      style={{ inlineSize: `${(year.holes / 366) * 100}%` }}
                    />
                  </span>
                  <span className="pt-value">{year.holes}</span>
                </li>
              ))}
          </ol>
          <p className="pt-note">
            Days inside a month the exports never covered. They are not quiet days — nobody can say
            what was on them — so they are counted separately and drawn hollow on the ring rather
            than left blank.
          </p>

          <h3 className="pt-sub">BUSIEST DAY IN EACH RING</h3>
          <ol className="pt-rows" style={{ ['--pt-label' as string]: '3rem' }}>
            {rings.years.map((year) => (
              <li key={year.year} className="pt-row">
                <span className="pt-label">{year.year}</span>
                <span className="pt-bar">
                  <span
                    className="pt-fill pt-fill--alt"
                    style={{ inlineSize: `${(year.peak / rings.peak) * 100}%` }}
                  />
                </span>
                <span className="pt-value">{year.peak.toLocaleString()}</span>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </Frame>
  )
}

// ---------------------------------------------------------------------------

type Rings = {
  years: {
    year: number
    days: Int32Array
    hole: Uint8Array
    total: number
    peak: number
    spoken: number
    holes: number
  }[]
  peak: number
}

const TAU = Math.PI * 2

function Coils({ rings, scale }: { rings: Rings; scale: 'own' | 'shared' }) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const { vibe } = usePortal()

  useEffect(() => {
    const el = canvas.current
    if (!el) return
    const ctx = el.getContext('2d')
    if (!ctx) return

    const ink = getComputedStyle(el)
    const mark = ink.getPropertyValue('--n1').trim() || '#f5c400'
    const grid = ink.getPropertyValue('--text-dim').trim() || '#888'
    const paper = ink.getPropertyValue('--paper').trim() || '#e8e2d4'
    // Unknown days are drawn in paper rather than in a ramp colour. On a mount
    // this dark, RIOT's --n5 is toner black and would render "nobody has this
    // day" as nothing at all — which is the one reading it must not have.
    const hole = paper

    const paint = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1)
      const size = Math.max(300, Math.min(el.getBoundingClientRect().width, 720))
      if (el.width !== Math.round(size * dpr)) {
        el.width = Math.round(size * dpr)
        el.height = Math.round(size * dpr)
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, size, size)

      const cx = size / 2
      const cy = size / 2
      const r0 = size * 0.09
      const r1 = size * 0.46
      const step = (r1 - r0) / rings.years.length
      // Each ring gets a band; the marks may use most of it but never all, so
      // two adjacent years cannot bleed into one another and read as one shape.
      const band = step * 0.78

      ctx.font = '9px ui-monospace, monospace'
      ctx.textBaseline = 'middle'

      rings.years.forEach((year, i) => {
        const base = r0 + i * step
        const top = scale === 'own' ? Math.max(1, year.peak) : rings.peak

        // the ring's own floor
        ctx.strokeStyle = colourWith(grid, 0.22)
        ctx.lineWidth = 1
        ctx.beginPath()
        ctx.arc(cx, cy, base, 0, TAU)
        ctx.stroke()

        const days = year.year % 4 === 0 ? 366 : 365
        for (let d = 0; d < days; d++) {
          const angle = (d / days) * TAU - Math.PI / 2
          const n = year.days[d]
          if (!n) {
            if (year.hole[d]) {
              // hollow, not empty: nobody can say what happened here
              ctx.strokeStyle = colourWith(hole, 0.4)
              ctx.beginPath()
              ctx.moveTo(cx + Math.cos(angle) * base, cy + Math.sin(angle) * base)
              ctx.lineTo(cx + Math.cos(angle) * (base + band * 0.16), cy + Math.sin(angle) * (base + band * 0.16))
              ctx.stroke()
            }
            continue
          }
          // A floor of a pixel and a half. Linear above it, and below it every
          // day that happened is still visible as a day that happened —
          // otherwise a year next to 2015's 1,273-message peak renders as a
          // clean circle, which would say the year was silent rather than
          // ordinary. The floor is disclosed on the instrument.
          const height = Math.max(1.5, Math.min(1, n / top) * band)
          ctx.strokeStyle = colourWith(mark, 0.85)
          ctx.lineWidth = Math.max(0.8, (TAU * base) / days - 0.4)
          ctx.beginPath()
          ctx.moveTo(cx + Math.cos(angle) * base, cy + Math.sin(angle) * base)
          ctx.lineTo(cx + Math.cos(angle) * (base + height), cy + Math.sin(angle) * (base + height))
          ctx.stroke()
        }

        ctx.fillStyle = colourWith(paper, 0.8)
        ctx.textAlign = 'right'
        ctx.fillText(String(year.year), cx - 4, cy - base - step * 0.32)
      })

      // January at the top, and the direction it runs
      ctx.fillStyle = colourWith(paper, 0.7)
      ctx.textAlign = 'center'
      ctx.fillText('JAN', cx, cy - r1 - 14)
      ctx.fillText('JUL', cx, cy + r1 + 14)
      ctx.textAlign = 'left'
      ctx.fillText('APR', cx + r1 + 8, cy)
      ctx.textAlign = 'right'
      ctx.fillText('OCT', cx - r1 - 8, cy)
    }

    paint()
    const observer = new ResizeObserver(paint)
    observer.observe(el)
    return () => observer.disconnect()
  }, [rings, scale, vibe])

  return (
    <figure className="pt-figure">
      <canvas ref={canvas} className="pt-mount pt-mount--square" />
      <figcaption className="pt-legend">
        <span className="pt-key" style={{ color: 'var(--n1)' }}>
          A DAY
        </span>
        <span className="pt-key" style={{ color: '#c9c2b1' }}>
          NOT EXPORTED
        </span>
        <span className="pt-key-say">one ring is one year · january at the top</span>
      </figcaption>
    </figure>
  )
}
