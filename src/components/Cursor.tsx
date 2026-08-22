import { useEffect, useRef, useState } from 'react'
import { usePortal } from '../state/usePortal'

/**
 * THE RETICLE — a targeting bracket and a hairline, on the pointer.
 *
 * ---- what this replaced and why ----------------------------------------
 *
 * The old trail was a comet: up to 48 soft circles, radius up to 21px, drawn
 * additively and fading at 0.045 of their life per frame. Three things were
 * wrong with it and they compounded:
 *
 *   IT FELT SLOW.   Not because it was slow — because a 20px blob has no
 *                   edge, so there is nothing for the eye to lock onto and
 *                   check against the actual pointer. Softness reads as lag
 *                   even at 60fps.
 *   IT WAS HUGE.    It smeared a fifth of a phone-width of colour across
 *                   whatever you were trying to read.
 *   IT LIED.        One sample per frame joined by big round dots means a
 *                   fast flick drew a dotted chord, not the path your hand
 *                   actually took.
 *
 * So: hard edges, one-pixel lines, and the true path.
 *
 *   THE BRACKET  four corner ticks of a square, locked to the exact last
 *                reported position with no smoothing whatsoever, rotated to
 *                the direction of travel. It is the responsiveness: a hard
 *                corner sitting precisely on the hotspot is checkable, and
 *                anything that lags by even a frame is instantly visible —
 *                which is why nothing here interpolates.
 *   THE BLADE    a 1px tapering polyline through the recent path, only drawn
 *                above a walking pace. A parked pointer is a bare bracket.
 *
 * ---- how it is faster as well as sharper -------------------------------
 *
 * `getCoalescedEvents()` — the browser batches pointer events and hands the
 * whole batch to one frame. Reading only `clientX/Y` throws away every sample
 * but the last, which is what made the old flick a chord. Taking the coalesced
 * list draws the real path, and costs nothing: those samples were already
 * captured and already in memory.
 *
 * `pointerrawupdate` where it exists, which fires ahead of the coalescing that
 * `pointermove` waits on.
 *
 * A DIRTY RECT rather than a full-viewport clear. The old loop cleared
 * 1440×900 every frame forever. This clears the union of what it drew last
 * frame and what it is drawing now — a few thousand pixels around the pointer
 * — and it still sleeps entirely when the blade has drained and the pointer
 * has stopped.
 */

/** The reticle is a pointer affordance. On a touch screen there is no pointer. */
const FINE = '(hover: hover) and (pointer: fine)'

/** Samples kept for the blade. Short: this is a blade, not a comet. */
const TRAIL = 14
/** Padding on the dirty rect, in CSS px. Covers the glow and the bracket. */
const MARGIN = 30
/** px/frame at which the blade is at full length and the bracket is fully open. */
const FAST = 34

type Pt = { x: number; y: number }
type Rect = { x0: number; y0: number; x1: number; y1: number } | null

/** `getComputedStyle` hands back a custom property as authored: hex or rgb(). */
function toRgb(value: string, fallback: [number, number, number]): [number, number, number] {
  const hex = value.trim().match(/^#([0-9a-f]{6})$/i)
  if (hex) {
    const n = parseInt(hex[1], 16)
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
  }
  const rgb = value.trim().match(/^rgba?\(([^)]+)\)$/i)
  if (rgb) {
    const parts = rgb[1].split(/[\s,/]+/).filter(Boolean).map(Number)
    if (parts.length >= 3 && parts.every((p) => Number.isFinite(p))) {
      return [parts[0], parts[1], parts[2]]
    }
  }
  return fallback
}

export function Cursor() {
  const { vibe, chaos, motion } = usePortal()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const chaosRef = useRef(chaos)
  const inkRef = useRef({ calm: [157, 255, 0] as number[], hot: [255, 0, 168] as number[] })
  chaosRef.current = chaos

  // Not read once at mount: plugging in a mouse, or dragging the window to a
  // different display, flips this — and a stale `false` would keep the canvas
  // out of the document for the rest of the session.
  const [fine, setFine] = useState(
    () => typeof window !== 'undefined' && window.matchMedia(FINE).matches,
  )

  useEffect(() => {
    const query = window.matchMedia(FINE)
    const sync = () => setFine(query.matches)
    sync()
    query.addEventListener('change', sync)
    return () => query.removeEventListener('change', sync)
  }, [])

  useEffect(() => {
    const styles = getComputedStyle(document.documentElement)
    inkRef.current = {
      calm: toRgb(styles.getPropertyValue('--n3'), [157, 255, 0]),
      hot: toRgb(styles.getPropertyValue('--n2'), [255, 0, 168]),
    }
  }, [vibe])

  const live = fine && motion

  useEffect(() => {
    const canvas = canvasRef.current
    if (!live || !canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let raf = 0
    let dpr = Math.min(window.devicePixelRatio || 1, 2)
    const pts: Pt[] = []
    /** Where the bracket is pointing. Held through a stop rather than reset. */
    let angle = 0
    let speed = 0
    /**
     * Distance actually covered since the last frame, accumulated in `push`.
     *
     * This is load-bearing twice over.
     *
     * Measuring between the last two points in the trail instead — the obvious
     * thing — is wrong in both directions. When the hand STOPS, those two
     * points stop changing, so the reading holds at whatever the final flick
     * was, forever: speed never decays, the blade never drains, and a parked
     * pointer keeps a full-length streak hanging off it. And when the hand is
     * FAST, a coalesced batch delivers a dozen samples in one frame and the
     * gap between the last two of them is a twelfth of the real distance, so
     * the reticle reads a sprint as a stroll.
     *
     * The sum over the frame is simply the truth, and it costs one add per
     * sample in a loop that is already visiting every sample.
     */
    let travel = 0
    /** What was painted last frame, so the next one knows what to erase. */
    let dirty: Rect = null

    const resize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2)
      canvas.width = Math.round(window.innerWidth * dpr)
      canvas.height = Math.round(window.innerHeight * dpr)
      // Pin the CSS box to the same measurement the backing store was cut
      // from, so the two cannot disagree by a scrollbar's width.
      canvas.style.width = `${window.innerWidth}px`
      canvas.style.height = `${window.innerHeight}px`
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      dirty = { x0: 0, y0: 0, x1: window.innerWidth, y1: window.innerHeight }
    }
    resize()
    window.addEventListener('resize', resize)

    const push = (x: number, y: number) => {
      const last = pts[pts.length - 1]
      if (last) {
        const d = Math.hypot(x - last.x, y - last.y)
        if (d < 0.4) return
        travel += d
      }
      pts.push({ x, y })
      if (pts.length > TRAIL) pts.shift()
    }

    const onMove = (event: PointerEvent) => {
      // The whole batch, not just the last sample — this is the real path.
      const batch =
        typeof event.getCoalescedEvents === 'function' ? event.getCoalescedEvents() : null
      if (batch && batch.length > 1) {
        for (const e of batch) push(e.clientX, e.clientY)
      } else {
        push(event.clientX, event.clientY)
      }
      if (raf === 0) raf = requestAnimationFrame(frame)
    }

    // `pointerrawupdate` fires ahead of the coalescing `pointermove` waits on.
    // Chromium-only and behind a flag in some builds, hence the feature test.
    const RAW = 'onpointerrawupdate' in window
    const moveEvent = RAW ? 'pointerrawupdate' : 'pointermove'

    const frame = () => {
      const w = window.innerWidth
      const h = window.innerHeight

      if (dirty) {
        ctx.clearRect(dirty.x0, dirty.y0, dirty.x1 - dirty.x0, dirty.y1 - dirty.y0)
        dirty = null
      }

      const head = pts[pts.length - 1]
      if (!head) {
        raf = 0
        return
      }

      // Speed, smoothed just enough that a single jittery sample does not make
      // the bracket snap open. The POSITION is never smoothed — only this is.
      const prev = pts[pts.length - 2]
      const step = travel
      travel = 0

      // Fast attack, slow release. A symmetric filter makes the reticle open
      // a few frames after you started moving, which is exactly the lag the
      // old trail was replaced for; opening almost immediately and settling
      // gently is what reads as responsive.
      speed += (step - speed) * (step > speed ? 0.65 : 0.16)
      const t = Math.min(1, speed / FAST)

      if (prev && step > 0.6) angle = Math.atan2(head.y - prev.y, head.x - prev.x)

      const c = chaosRef.current
      const { calm, hot } = inkRef.current
      const ink = (a: number) => {
        const r = Math.round(calm[0] + (hot[0] - calm[0]) * t)
        const g = Math.round(calm[1] + (hot[1] - calm[1]) * t)
        const b = Math.round(calm[2] + (hot[2] - calm[2]) * t)
        return `rgb(${r} ${g} ${b} / ${a})`
      }

      let x0 = head.x
      let y0 = head.y
      let x1 = head.x
      let y1 = head.y

      ctx.globalCompositeOperation = 'lighter'
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'

      // ---- the blade -------------------------------------------------
      // Segment by segment, because a single stroked path cannot taper. Only
      // above a walking pace: a slow drag should leave nothing behind it.
      if (t > 0.08 && pts.length > 2) {
        const n = pts.length
        for (let i = 1; i < n; i++) {
          const a = pts[i - 1]
          const b = pts[i]
          const f = i / n
          ctx.strokeStyle = ink((0.1 + 0.75 * f) * (0.35 + 0.65 * t))
          ctx.lineWidth = 0.5 + 1.6 * f * (0.5 + 0.5 * t)
          ctx.beginPath()
          ctx.moveTo(a.x, a.y)
          ctx.lineTo(b.x, b.y)
          ctx.stroke()
          if (a.x < x0) x0 = a.x
          if (a.y < y0) y0 = a.y
          if (a.x > x1) x1 = a.x
          if (a.y > y1) y1 = a.y
        }
      }

      // ---- the bracket -----------------------------------------------
      // Four corners of a square, splaying open with speed. Drawn last so it
      // sits on top of its own trail, and drawn at `head` exactly.
      const s = 6.5 + 5.5 * t + 1.5 * c
      const arm = 3.2 + 1.4 * t
      ctx.save()
      ctx.translate(head.x, head.y)
      ctx.rotate(angle)
      ctx.strokeStyle = ink(0.92)
      ctx.lineWidth = 1.4
      ctx.beginPath()
      for (const [sx, sy] of [
        [-1, -1],
        [1, -1],
        [1, 1],
        [-1, 1],
      ] as const) {
        ctx.moveTo(sx * s - sx * arm, sy * s)
        ctx.lineTo(sx * s, sy * s)
        ctx.lineTo(sx * s, sy * s - sy * arm)
      }
      ctx.stroke()

      // A single hot pixel on the hotspot. This is the thing your eye actually
      // tracks, and it is one device pixel wide on purpose.
      ctx.fillStyle = ink(1)
      ctx.fillRect(-0.75, -0.75, 1.5, 1.5)
      ctx.restore()

      const reach = s + arm + 4
      x0 = Math.min(x0, head.x - reach)
      y0 = Math.min(y0, head.y - reach)
      x1 = Math.max(x1, head.x + reach)
      y1 = Math.max(y1, head.y + reach)

      dirty = {
        x0: Math.max(0, Math.floor(x0 - MARGIN)),
        y0: Math.max(0, Math.floor(y0 - MARGIN)),
        x1: Math.min(w, Math.ceil(x1 + MARGIN)),
        y1: Math.min(h, Math.ceil(y1 + MARGIN)),
      }

      // Drain the blade one sample a frame once the hand has stopped, so it
      // retracts into the bracket instead of vanishing. Never past the last
      // point — that one is the pointer.
      if (step < 0.6 && pts.length > 1) pts.splice(0, 1)

      // Parked and drained: stop the loop and LEAVE THE BRACKET ON SCREEN. It
      // is a reticle; marking where the pointer is sitting is its whole job,
      // and a static canvas costs nothing. `dirty` stays set, so the next wake
      // erases it before drawing. `onMove` is what wakes it.
      if (pts.length <= 1 && speed < 0.4) {
        raf = 0
        return
      }

      raf = requestAnimationFrame(frame)
    }

    window.addEventListener(moveEvent, onMove as EventListener, { passive: true })

    return () => {
      if (raf !== 0) cancelAnimationFrame(raf)
      window.removeEventListener('resize', resize)
      window.removeEventListener(moveEvent, onMove as EventListener)
    }
  }, [live])

  if (!live) return null

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        // A canvas is a replaced element: `inset: 0` alone leaves it at its
        // intrinsic 300×150 rather than stretching it. `resize()` overwrites
        // both of these with the measured viewport on the first frame; they
        // are here so there is no paint in between at the intrinsic size.
        width: '100vw',
        height: '100vh',
        pointerEvents: 'none',
        zIndex: 9500,
        mixBlendMode: 'screen',
      }}
    />
  )
}
