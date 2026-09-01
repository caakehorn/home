import { useEffect, useRef, useState } from 'react'
import { usePortal } from '../../state/usePortal'
import './decor.css'

/**
 * The ornament.
 *
 * A strip of things above the bench that flip, sweep, rotate and count, and
 * mean absolutely nothing. They are here because a room whose whole output is a
 * block of text is a room with no reason to be a place, and because the front
 * of a real instrument has switches on it that the person using it never
 * touches.
 *
 * ---- and it says so -------------------------------------------------------
 *
 * THE RULE at the top of `src/leviathan/core.ts` governs anything that draws
 * this corpus, and this draws none of it, so it is not bound. The spirit is,
 * and the spirit is the hard part: a readout that looks measured and is not is
 * a lie whether or not a rule forbids it. So the strip is labelled ORNAMENT —
 * THESE READ NOTHING, in the same spirit as THE ATLAS printing THE MAP IS DRAWN
 * BY HAND on every frame, and every number on it is visibly a pattern rather
 * than a quantity.
 *
 * The one honest readout in the room is the step counter in the terminal's own
 * bar, and it is deliberately over there rather than in here, where it would
 * lend its credibility to its neighbours.
 *
 * ---- the constraints it still has to meet ----------------------------------
 *
 * Ornament is not exempt from the house rules. Everything that moves reads
 * `motion` from `usePortal()` and stops dead when it is false — not slowed,
 * stopped, with a static frame left on screen. Every widget is a real
 * `<button>`, so all of it is reachable from a keyboard as well as a finger.
 * Nothing claims a pointer gesture, so nothing owes one back (CLAUDE.md §5),
 * and the seed is fixed per tool so the strip a reader comes back to is the one
 * they left.
 */

const MAX_FRAME_MS = 64

/** FNV-1a. The same tool gets the same ornament forever. */
function seedOf(text: string) {
  let hash = 0x811c9dc5
  for (const ch of text) {
    hash ^= ch.charCodeAt(0)
    hash = Math.imul(hash, 0x01000193) >>> 0
  }
  return hash
}

/** mulberry32, as everywhere else in this codebase. Seeded, never random. */
function rng(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function Decor({ toolId }: { toolId: string }) {
  const seed = seedOf(toolId)
  return (
    <div className="dc" aria-label="Ornament">
      <span className="dc__label">
        ORNAMENT
        <b>THESE READ NOTHING</b>
      </span>
      <Toggles seed={seed} />
      <Scope seed={seed} />
      <Dial seed={seed} />
      <Segments seed={seed} />
    </div>
  )
}

/* ---- eight switches ------------------------------------------------------ */

function Toggles({ seed }: { seed: number }) {
  const [bits, setBits] = useState(() => {
    const next = rng(seed)
    return Array.from({ length: 8 }, () => next() > 0.55)
  })

  return (
    <div className="dc__cell dc__cell--toggles">
      {bits.map((on, i) => (
        <button
          key={i}
          type="button"
          className={`dc__toggle${on ? ' dc__toggle--on' : ''}`}
          aria-pressed={on}
          aria-label={`Ornamental switch ${i + 1}`}
          onClick={() => setBits((cur) => cur.map((b, j) => (j === i ? !b : b)))}
        >
          <span aria-hidden="true" />
        </button>
      ))}
    </div>
  )
}

/* ---- a sweep ------------------------------------------------------------- */

/**
 * A Lissajous figure, drawn to a canvas.
 *
 * The rAF loop follows `src/components/Crawl.tsx`: the phase lives in a ref so
 * the loop never restarts on a render, the step is scaled by elapsed time so it
 * runs the same on a 120Hz display as on a 60Hz one, a long frame is clamped so
 * a backgrounded tab does not come back and jump, and returning to the tab
 * resets the clock instead of integrating the whole absence in one step.
 *
 * With motion off it draws one frame and stops. Not slower — stopped.
 */
function Scope({ seed }: { seed: number }) {
  const { motion } = usePortal()
  const canvas = useRef<HTMLCanvasElement>(null)
  const [figure, setFigure] = useState(() => Math.floor(rng(seed)() * 5))
  const phase = useRef(0)

  useEffect(() => {
    const el = canvas.current
    if (!el) return
    const ctx = el.getContext('2d')
    if (!ctx) return

    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const w = el.clientWidth
    const h = el.clientHeight
    el.width = Math.round(w * dpr)
    el.height = Math.round(h * dpr)
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

    const a = 2 + (figure % 3)
    const b = 3 + ((figure + 1) % 4)
    const ink =
      getComputedStyle(el).getPropertyValue('--t-hue').trim() || '#9fb0c0'

    const draw = () => {
      ctx.clearRect(0, 0, w, h)
      ctx.strokeStyle = ink
      ctx.lineWidth = 1
      ctx.globalAlpha = 0.9
      ctx.beginPath()
      for (let i = 0; i <= 240; i += 1) {
        const t = (i / 240) * Math.PI * 2
        const x = w / 2 + (w / 2 - 4) * Math.sin(a * t + phase.current)
        const y = h / 2 + (h / 2 - 4) * Math.sin(b * t)
        if (i === 0) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
      }
      ctx.stroke()
    }

    if (!motion) {
      draw()
      return
    }

    let frame = 0
    let last = performance.now()
    const step = (now: number) => {
      const dt = Math.min(now - last, MAX_FRAME_MS)
      last = now
      phase.current = (phase.current + dt * 0.0009) % (Math.PI * 2)
      draw()
      frame = requestAnimationFrame(step)
    }
    const onVisible = () => {
      last = performance.now()
    }
    document.addEventListener('visibilitychange', onVisible)
    frame = requestAnimationFrame(step)
    return () => {
      cancelAnimationFrame(frame)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [motion, figure])

  return (
    <button
      type="button"
      className="dc__cell dc__cell--scope"
      aria-label="Ornamental trace — click to change the figure"
      onClick={() => setFigure((f) => (f + 1) % 5)}
    >
      <canvas ref={canvas} className="dc__canvas" aria-hidden="true" />
    </button>
  )
}

/* ---- a dial -------------------------------------------------------------- */

function Dial({ seed }: { seed: number }) {
  const [notch, setNotch] = useState(() => Math.floor(rng(seed ^ 0x5a5a)() * 12))
  const turn = (by: number) => setNotch((n) => (n + by + 12) % 12)

  return (
    <button
      type="button"
      className="dc__cell dc__cell--dial"
      aria-label={`Ornamental dial, position ${notch + 1} of 12`}
      onClick={() => turn(1)}
      onContextMenu={(e) => {
        // Right-click turns it back, which is the only thing a dial with no
        // function can usefully offer over a button.
        e.preventDefault()
        turn(-1)
      }}
      onKeyDown={(e) => {
        if (e.key === 'ArrowLeft') {
          e.preventDefault()
          turn(-1)
        } else if (e.key === 'ArrowRight') {
          e.preventDefault()
          turn(1)
        }
      }}
    >
      <span className="dc__dial-face" style={{ transform: `rotate(${notch * 30}deg)` }}>
        <span className="dc__dial-mark" />
      </span>
      {Array.from({ length: 12 }, (_, i) => (
        <span
          key={i}
          className="dc__dial-tick"
          style={{ transform: `rotate(${i * 30}deg) translateY(-13px)` }}
        />
      ))}
    </button>
  )
}

/* ---- a counter that counts nothing --------------------------------------- */

function Segments({ seed }: { seed: number }) {
  const [roll, setRoll] = useState(0)
  // Derived from the seed and a click count, so it is a pattern and not a
  // measurement — and so it is the same pattern on every machine.
  const next = rng(seed ^ (roll * 0x9e3779b9))
  const digits = Array.from({ length: 6 }, () => Math.floor(next() * 10))

  return (
    <button
      type="button"
      className="dc__cell dc__cell--segs"
      aria-label="Ornamental counter — click to re-roll. It counts nothing."
      onClick={() => setRoll((r) => r + 1)}
    >
      {digits.map((d, i) => (
        <span key={i} className="dc__seg">
          {d}
        </span>
      ))}
    </button>
  )
}
