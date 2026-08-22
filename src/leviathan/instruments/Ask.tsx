import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Frame } from '../Frame'
import { useSet, type AskSet, type Instrument } from '../core'
import { apart, colourWith } from '../ink'
import { useWidth } from '../../wiki/useWidth'
import { usePortal } from '../../state/usePortal'
import '../pen.css'
import '../ask.css'

/**
 * VI · THE ASK
 *
 * The one instrument from the unlisted third page that comes across, and the
 * only one in the rack that makes a judgement. It is here as a chart recorder
 * because that is what it was over there — `js/pen-core.js` drawing five lanes
 * and a running total under a travelling stylus — and because a recorder is
 * the right instrument for the question it asks: not how many, but when, and
 * against what.
 *
 * Three things are different from the original, and all three are the same
 * change. Over there the payload carried the quotes, the counts and the
 * classification in one file, so the reading could not be checked against the
 * evidence; here only the classification came across. The text of every
 * fragment is read back out of `/transcript`, every fragment carries the line
 * it sits on and links to it, and the sixth lane is her whole message volume
 * per day, recounted from the same record — because a lane that rises in a
 * week she sent four hundred messages has not risen.
 *
 * THE RULE does not cover this instrument and the frame says so in its own
 * words rather than printing the boilerplate. What stands in for it is that
 * every part of the reading is walkable back to the record.
 */
export function Ask({ instrument }: { instrument: Instrument }) {
  const { data, error, loading } = useSet<AskSet>('ask.json')
  const { vibe } = usePortal()
  const [wrapRef, width] = useWidth<HTMLDivElement>(880, 300)

  const [playing, setPlaying] = useState(false)
  const [pos, setPos] = useState(0)
  const [held, setHeld] = useState<number | null>(null)
  const [lane, setLane] = useState<string | null>(null)

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const raf = useRef(0)

  const n = data?.days ?? 0
  const lanes = useMemo(() => data?.lanes ?? [], [data])

  /** Day index → `YYYY-MM-DD`, without going through a local timezone. */
  const dayOf = useCallback(
    (i: number) => new Date((Date.parse(`${data?.from ?? '1970-01-01'}T00:00:00Z`) + i * 86400000)),
    [data?.from],
  )

  /**
   * A triangular kernel at nine days, the bandwidth the original used.
   *
   * The raw series is a count of messages on a day, and it tops out at three —
   * drawn straight it is a picket fence, and a picket fence hides exactly the
   * thing a recorder is for, which is where the density sits. The smoothing is
   * a reading aid and is not allowed to be the only thing on the lane: the raw
   * counts are drawn underneath it as ticks, so every peak can be checked
   * against the days that made it.
   */
  const smoothed = useMemo(() => {
    if (!data) return {}
    const bw = 9
    const pass = (raw: number[]) => {
      const out = new Float64Array(raw.length)
      for (let i = 0; i < raw.length; i++) {
        if (!raw[i]) continue
        const lo = Math.max(0, i - bw)
        const hi = Math.min(raw.length - 1, i + bw)
        for (let j = lo; j <= hi; j++) out[j] += raw[i] * (1 - Math.abs(j - i) / bw)
      }
      return out
    }
    const out: Record<string, Float64Array> = {}
    for (const l of lanes) out[l.key] = pass(data.series[l.key] ?? [])
    out.volume = pass(data.volume)
    return out
  }, [data, lanes])

  /**
   * One scale across all five lanes, which is the opposite of the choice THE
   * PEN makes next door and is right for the opposite reason: there the lanes
   * run 9 against 741 and a shared axis would flatten three of them, here they
   * run 22 against 137 and a per-lane axis would print five identical curves
   * and let the reader believe the small lanes were as busy as the big ones.
   */
  const scale = useMemo(() => {
    let ask = 0.001
    for (const l of lanes) for (const v of smoothed[l.key] ?? []) if (v > ask) ask = v
    let vol = 0.001
    for (const v of smoothed.volume ?? []) if (v > vol) vol = v
    return { ask, vol }
  }, [lanes, smoothed])

  useEffect(() => {
    if (n) setPos(n - 1)
  }, [n])

  // transport — sixty days a second, the original's NORMAL speed
  useEffect(() => {
    if (!playing || !n) return
    let last = performance.now()
    const tick = (now: number) => {
      const dt = (now - last) / 1000
      last = now
      setPos((p) => {
        const next = p + dt * 60
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
    /**
     * Narrow enough that a left-hand label gutter would cost more plot than
     * the labels are worth. Below that width the lane names move inside the
     * lanes and the gutter shrinks to what the month axis needs to centre its
     * first and last tick.
     */
    const tight = width < 640
    const padL = tight ? 26 : 158
    const padR = tight ? 22 : 16
    // room above the first lane for the one thing the lanes cannot say about
    // themselves: what their shared vertical scale is
    const padT = 30
    // a lane that carries its own name needs the room to print it
    const laneH = tight ? 48 : 46
    const laneGap = 7
    const volGap = 18
    const volH = tight ? 54 : 56
    const ribbonH = 9
    const axisH = 22
    return {
      tight,
      padL,
      padR,
      padT,
      laneH,
      laneGap,
      volGap,
      volH,
      ribbonH,
      axisH,
      plotW: Math.max(40, width - padL - padR),
    }
  }, [width])

  const rows = lanes.length
  const volY = geo.padT + rows * (geo.laneH + geo.laneGap) + geo.volGap
  const ribbonY = volY + geo.volH + 8
  const height = ribbonY + geo.ribbonH + geo.axisH

  const draw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas || !data || !n) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    canvas.width = Math.round(width * dpr)
    canvas.height = Math.round(height * dpr)
    canvas.style.width = `${width}px`
    canvas.style.height = `${height}px`
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, width, height)

    const styles = getComputedStyle(canvas)
    const token = (name: string, fallback: string) =>
      styles.getPropertyValue(name).trim() || fallback
    const text = token('--text', '#fff')
    const dim = token('--text-dim', '#888')
    const paper = token('--void', '#000')
    const rule = token('--void-3', '#222')

    /**
     * Two channels, and the palette has to carry both in every room: the asks
     * and the volume they are measured against. `--n1` and `--n2` are far
     * enough apart in all five vibes — RIOT included, where the ramp is two
     * inks and `--n1`/`--n3` are the same red twice through the machine — but
     * the check is cheap and the fallback is a token that is never the accent.
     */
    const ink = token('--n1', '#e01b12')
    const second = token('--n2', '#111110')
    const volInk = apart(ink, second) ? second : dim

    const xOf = (i: number) => geo.padL + (i / Math.max(1, n - 1)) * geo.plotW
    const upto = Math.min(n - 1, Math.floor(pos))
    const readAt = Math.min(n - 1, Math.round(held ?? pos))

    const mono = (size: number) => `${size}px ui-monospace, monospace`

    // ---- what the vertical axis is ----------------------------------------
    ctx.textAlign = 'left'
    ctx.textBaseline = 'top'
    ctx.font = mono(9)
    ctx.fillStyle = dim
    ctx.fillText(
      geo.tight
        ? `ONE SCALE, ALL FIVE: 0 → ${scale.ask.toFixed(1)}/DAY`
        : `ALL FIVE LANES SHARE ONE VERTICAL SCALE — 0 → ${scale.ask.toFixed(1)} MESSAGES A DAY, SMOOTHED OVER NINE DAYS. THE TICKS UNDER EACH TRACE ARE THE RAW DAYS.`,
      geo.padL,
      4,
    )

    // ---- the five lanes ---------------------------------------------------
    lanes.forEach((l, li) => {
      const y0 = geo.padT + li * (geo.laneH + geo.laneGap)
      const raw = data.series[l.key] ?? []
      const curve = smoothed[l.key] ?? []
      const floorY = y0 + geo.laneH - 3
      // a lane carrying its own name gives the top of itself up to it
      const room = geo.laneH - 9 - (geo.tight ? 14 : 0)

      ctx.fillStyle = paper
      ctx.fillRect(geo.padL, y0, geo.plotW, geo.laneH)
      ctx.strokeStyle = rule
      ctx.lineWidth = 1
      ctx.strokeRect(geo.padL + 0.5, y0 + 0.5, geo.plotW, geo.laneH)

      // identity, in text tokens rather than the trace colour
      if (geo.tight) {
        ctx.textAlign = 'left'
        ctx.textBaseline = 'top'
        ctx.font = mono(9.5)
        ctx.fillStyle = text
        ctx.fillText(l.label, geo.padL + 5, y0 + 4)
        ctx.fillStyle = dim
        ctx.fillText(`${l.count}`, geo.padL + 12 + ctx.measureText(l.label).width, y0 + 4)
      } else {
        ctx.textAlign = 'right'
        ctx.textBaseline = 'middle'
        ctx.font = mono(10)
        ctx.fillStyle = text
        ctx.fillText(l.label, geo.padL - 10, y0 + geo.laneH / 2 - 6)
        ctx.font = mono(9)
        ctx.fillStyle = dim
        ctx.fillText(`${l.count} messages`, geo.padL - 10, y0 + geo.laneH / 2 + 7)
      }

      // the raw days, underneath: one tick per message, so the curve above can
      // never be the only claim on the lane
      ctx.fillStyle = colourWith(ink, 0.42)
      for (let i = 0; i <= upto; i++) {
        const v = raw[i]
        if (!v) continue
        ctx.fillRect(Math.round(xOf(i)), floorY - v * 3, 1, v * 3)
      }

      // the trace, drawn only as far as the stylus has travelled
      ctx.strokeStyle = ink
      ctx.lineWidth = 1.6
      ctx.lineJoin = 'round'
      ctx.beginPath()
      for (let i = 0; i <= upto; i++) {
        const y = floorY - (curve[i] / scale.ask) * room
        i === 0 ? ctx.moveTo(xOf(i), y) : ctx.lineTo(xOf(i), y)
      }
      ctx.stroke()

      // the stylus, at the value
      ctx.fillStyle = ink
      ctx.beginPath()
      ctx.arc(xOf(pos), floorY - (curve[upto] / scale.ask) * room, 3, 0, Math.PI * 2)
      ctx.fill()
    })

    // ---- the denominator --------------------------------------------------
    {
      const curve = smoothed.volume ?? []
      const floorY = volY + geo.volH - 3
      const room = geo.volH - 9 - (geo.tight ? 14 : 0)
      const peak = Math.max(...data.volume)

      ctx.fillStyle = paper
      ctx.fillRect(geo.padL, volY, geo.plotW, geo.volH)
      ctx.strokeStyle = rule
      ctx.strokeRect(geo.padL + 0.5, volY + 0.5, geo.plotW, geo.volH)

      if (geo.tight) {
        ctx.textAlign = 'left'
        ctx.textBaseline = 'top'
        ctx.font = mono(9.5)
        ctx.fillStyle = text
        ctx.fillText('EVERYTHING SHE SENT', geo.padL + 5, volY + 4)
        ctx.fillStyle = dim
        ctx.textAlign = 'right'
        ctx.fillText(`PEAK ${peak}/DAY`, geo.padL + geo.plotW - 5, volY + 4)
      } else {
        ctx.textAlign = 'right'
        ctx.textBaseline = 'middle'
        ctx.font = mono(10)
        ctx.fillStyle = text
        ctx.fillText('EVERYTHING SHE SENT', geo.padL - 10, volY + geo.volH / 2 - 6)
        ctx.font = mono(9)
        ctx.fillStyle = dim
        ctx.fillText(
          `${data.herMessages.toLocaleString()} messages`,
          geo.padL - 10,
          volY + geo.volH / 2 + 7,
        )

        // right-aligned inside the lane: the curve ends low, so the caption
        // sits over paper rather than over the trace
        ctx.textAlign = 'right'
        ctx.textBaseline = 'top'
        ctx.fillText(
          `PEAK ${peak} IN A DAY · ITS OWN SCALE, NOT THE ONE ABOVE`,
          geo.padL + geo.plotW - 6,
          volY + 4,
        )
      }
      ctx.textBaseline = 'middle'

      ctx.beginPath()
      ctx.moveTo(xOf(0), floorY)
      for (let i = 0; i <= upto; i++) ctx.lineTo(xOf(i), floorY - (curve[i] / scale.vol) * room)
      ctx.lineTo(xOf(upto), floorY)
      ctx.closePath()
      ctx.fillStyle = colourWith(volInk, 0.22)
      ctx.fill()

      ctx.strokeStyle = volInk
      ctx.lineWidth = 1.3
      ctx.beginPath()
      for (let i = 0; i <= upto; i++) {
        const y = floorY - (curve[i] / scale.vol) * room
        i === 0 ? ctx.moveTo(xOf(i), y) : ctx.lineTo(xOf(i), y)
      }
      ctx.stroke()
    }

    // ---- the day ribbon ---------------------------------------------------
    {
      const perDay = new Array(n).fill(0)
      for (const l of lanes) {
        const raw = data.series[l.key] ?? []
        for (let i = 0; i < n; i++) perDay[i] += raw[i] ?? 0
      }
      const w = Math.max(1, geo.plotW / n)
      for (let i = 0; i < n; i++) {
        const c = perDay[i]
        ctx.fillStyle = c
          ? colourWith(ink, i <= upto ? Math.min(1, 0.35 + c * 0.22) : 0.18)
          : colourWith(dim, i <= upto ? 0.16 : 0.06)
        ctx.fillRect(xOf(i), ribbonY, Math.max(1, w), geo.ribbonH)
      }
      ctx.strokeStyle = rule
      ctx.strokeRect(geo.padL + 0.5, ribbonY + 0.5, geo.plotW, geo.ribbonH)
    }

    // ---- the month axis ---------------------------------------------------
    ctx.textAlign = 'center'
    ctx.textBaseline = 'top'
    ctx.font = mono(9)
    ctx.fillStyle = dim
    const every = geo.tight ? 2 : 1
    let months = 0
    for (let i = 0; i < n; i++) {
      const t = dayOf(i)
      if (t.getUTCDate() !== 1) continue
      if (months++ % every) continue
      const label = t.toLocaleString('en-US', { month: 'short', timeZone: 'UTC' }).toUpperCase()
      ctx.fillText(
        t.getUTCMonth() === 0 ? `${label} ${t.getUTCFullYear()}` : label,
        xOf(i),
        ribbonY + geo.ribbonH + 6,
      )
    }

    // ---- where the reader is pointing -------------------------------------
    if (held !== null) {
      ctx.strokeStyle = dim
      ctx.setLineDash([2, 3])
      ctx.beginPath()
      ctx.moveTo(xOf(readAt), geo.padT)
      ctx.lineTo(xOf(readAt), ribbonY + geo.ribbonH)
      ctx.stroke()
      ctx.setLineDash([])
    }
  }, [data, width, height, geo, lanes, n, pos, held, smoothed, scale, volY, ribbonY, dayOf, vibe])

  useEffect(() => {
    draw()
  }, [draw])

  const scrub = (clientX: number, target: HTMLCanvasElement) => {
    const rect = target.getBoundingClientRect()
    const t = (clientX - rect.left - geo.padL) / geo.plotW
    return Math.min(n - 1, Math.max(0, Math.round(t * (n - 1))))
  }

  const at = Math.min(n - 1, Math.round(held ?? pos))
  const on = data ? dayOf(at).toISOString().slice(0, 10) : ''

  /** Everything the stylus has passed, newest first — the original's feed. */
  const shown = useMemo(() => {
    if (!data) return []
    const cut = dayOf(Math.min(n - 1, Math.floor(pos))).toISOString().slice(0, 10)
    const kinds = lane ? new Set(lanes.find((l) => l.key === lane)?.kinds ?? []) : null
    return data.records
      .filter((r) => r.d <= cut && (!kinds || kinds.has(r.k)))
      .reverse()
  }, [data, lane, lanes, n, pos, dayOf])

  /** Running totals at the reader's day, per lane. */
  const running = useMemo(() => {
    const out: Record<string, number> = {}
    if (!data) return out
    for (const l of lanes) {
      const raw = data.series[l.key] ?? []
      let sum = 0
      for (let i = 0; i <= at; i++) sum += raw[i] ?? 0
      out[l.key] = sum
    }
    return out
  }, [data, lanes, at])

  const share = data ? (data.matched / data.herMessages) * 100 : 0

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
            <span>DAY</span>
            <input
              type="range"
              min={0}
              max={Math.max(0, n - 1)}
              value={Math.round(pos)}
              onChange={(e) => {
                setPlaying(false)
                setPos(Number(e.target.value))
              }}
              aria-label="Position the stylus by day"
            />
            <b>{on || '—'}</b>
          </label>
        </div>
      }
      footer={
        data ? (
          <div className="ask__notes">
            <p className="pen__note">
              <b>THE DENOMINATOR</b> — the bottom lane is not a sixth category, it is what the five
              above are a fraction of: {data.matched} messages out of{' '}
              {data.herMessages.toLocaleString()}, {share.toFixed(1)}% of everything she sent in the
              window. It is recounted here from the record rather than carried over, and it does not
              agree with the original: {data.herMessagesClaimed.toLocaleString()} over there against{' '}
              {data.herMessages.toLocaleString()} here, on a different dedup pass. The gap is printed
              because a number that agrees with itself because it was copied has not been checked.
            </p>
            <p className="pen__note">
              <b>PRECISION</b> — every hit in the original was read by hand and the false positives
              struck; what survived is per category, and it is the only reason the categories are
              on the page at all.{' '}
              {Object.entries(data.precision)
                .sort((a, b) => b[1] - a[1])
                .map(([k, v]) => `${data.kinds[k] ?? k} ${v}%`)
                .join(' · ')}
              .
            </p>
            <p className="pen__note">
              <b>ALSO IN THE WINDOW</b> — {data.dollarMentions} stated dollar amounts totalling $
              {data.dollarsStated.toLocaleString()}, and {data.atmRuns} announced ATM runs. Those are
              counts. Which of the five lanes a message belongs in is not.
            </p>
          </div>
        ) : null
      }
    >
      {loading && <p className="pen__state">winding the drum…</p>}
      {error && <p className="pen__state">{error}</p>}

      {data && (
        <div className="ask" ref={wrapRef}>
          <canvas
            ref={canvasRef}
            className="pen__canvas"
            role="img"
            aria-label={`Chart recorder, ${data.from} to ${data.to}. Five lanes — ${lanes
              .map((l) => `${l.label}, ${l.count} messages`)
              .join('; ')} — over a sixth lane carrying her whole message volume, ${data.herMessages.toLocaleString()} messages.`}
            onPointerMove={(e) => setHeld(scrub(e.clientX, e.currentTarget))}
            onPointerLeave={() => setHeld(null)}
            onPointerDown={(e) => {
              setPlaying(false)
              setPos(scrub(e.clientX, e.currentTarget))
            }}
          />

          <dl className="pen__readout" aria-live="off">
            <div className="pen__year">
              <dt>DAY</dt>
              <dd>{on}</dd>
            </div>
            {lanes.map((l) => (
              <div key={l.key}>
                <dt>{l.label}</dt>
                <dd>{running[l.key] ?? 0}</dd>
                <span>of {l.count} by this day</span>
              </div>
            ))}
          </dl>

          <div className="ask__feed">
            <div className="pt-chips" role="group" aria-label="Filter the fragments by lane">
              <button
                type="button"
                className={`pt-chip${lane ? '' : ' pt-chip--on'}`}
                aria-pressed={!lane}
                onClick={() => setLane(null)}
              >
                ALL {data.matched}
              </button>
              {lanes.map((l) => (
                <button
                  key={l.key}
                  type="button"
                  className={`pt-chip${lane === l.key ? ' pt-chip--on' : ''}`}
                  aria-pressed={lane === l.key}
                  onClick={() => setLane(lane === l.key ? null : l.key)}
                >
                  {l.label} {l.count}
                </button>
              ))}
            </div>

            <h3 className="pt-sub">
              {shown.length} PASSED THE STYLUS · NEWEST FIRST · EVERY ONE LINKS TO ITS LINE IN THE
              RECORD
            </h3>

            <ol className="pt-cards pt-scroll pt-scroll--tall">
              {shown.slice(0, 80).map((r) => (
                <li key={r.line} className="pt-card">
                  <span className="pt-card__head">
                    <span>{data.kinds[r.k] ?? r.k}</span>
                    <span>
                      {r.d} {r.t}
                    </span>
                    <Link to={`/transcript#L${r.line}`}>L{r.line} →</Link>
                  </span>
                  <p className="pt-card__say">{r.x}</p>
                  <span className="pt-card__meta">
                    {data.precision[r.k] ?? 100}% precision on this category, hand-audited
                  </span>
                </li>
              ))}
            </ol>

            {shown.length > 80 && (
              <p className="pen__note">
                80 shown of {shown.length}. The rest are in the record, in order, at{' '}
                <Link to="/transcript">/transcript</Link> — which is the whole point of the line
                numbers.
              </p>
            )}
          </div>
        </div>
      )}
    </Frame>
  )
}
