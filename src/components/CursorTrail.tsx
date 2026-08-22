import { useEffect, useRef, useState } from 'react'
import { usePortal } from '../state/usePortal'

type Dot = { x: number; y: number; life: number; tone: number }

/** The trail is a pointer affordance. On a touch screen it has nothing to follow. */
const FINE = '(hover: hover) and (pointer: fine)'

/**
 * A neon comet that follows the pointer. Fine pointers only — on touch it
 * would just be a smear behind your thumb.
 *
 * ---- why the element is conditional -----------------------------------
 *
 * It used to always render and let the effect bail on touch, which left a
 * canvas on every phone at its intrinsic 300×150 — `position: fixed; inset: 0`
 * does NOT stretch a replaced element, so `inset` resolved to `top: 0; left: 0`
 * and the box sat in the corner at its default size. Blank, so invisible in
 * most browsers; but `mix-blend-mode: screen` on an empty composited layer
 * paints as a dark slab in mobile Safari, which is what a phone showed: a
 * rectangle in the top-left corner, over the page and under nothing.
 *
 * So the canvas is only in the document when it is actually being drawn on,
 * and it is sized in CSS as well as in the backing store, so there is no state
 * in which a stray 300×150 box exists to be blended.
 */
export function CursorTrail() {
  const { vibe, chaos, motion } = usePortal()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const chaosRef = useRef(chaos)
  const paletteRef = useRef<string[]>([])
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
    paletteRef.current = ['--n1', '--n2', '--n3', '--n5'].map(
      (token) => styles.getPropertyValue(token).trim() || '#fff',
    )
  }, [vibe])

  const live = fine && motion

  useEffect(() => {
    const canvas = canvasRef.current
    if (!live || !canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let raf = 0
    let tone = 0
    const dots: Dot[] = []
    const dpr = Math.min(window.devicePixelRatio || 1, 2)

    // The last position the pointer reported, and whether it is new. A high
    // polling-rate mouse fires pointermove up to a thousand times a second and
    // the old loop pushed a dot for every one of them — a thousand arcs a
    // second into a 90-slot buffer, 940 of which were overwritten before they
    // were ever drawn. One dot per FRAME is the most that can ever be seen.
    let px = 0
    let py = 0
    let moved = false

    const resize = () => {
      canvas.width = Math.round(window.innerWidth * dpr)
      canvas.height = Math.round(window.innerHeight * dpr)
      // Pin the CSS box to the same measurement the backing store was cut
      // from, so the two cannot disagree by a scrollbar's width.
      canvas.style.width = `${window.innerWidth}px`
      canvas.style.height = `${window.innerHeight}px`
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    resize()
    window.addEventListener('resize', resize)

    const onMove = (event: PointerEvent) => {
      px = event.clientX
      py = event.clientY
      moved = true
      // Asleep: the pointer has started moving again, so start the loop.
      if (raf === 0) raf = requestAnimationFrame(frame)
    }

    const frame = () => {
      if (moved) {
        tone = (tone + 1) % 4
        dots.push({ x: px, y: py, life: 1, tone })
        if (dots.length > 48) dots.shift()
        moved = false
      }

      ctx.clearRect(0, 0, window.innerWidth, window.innerHeight)
      const c = chaosRef.current
      ctx.globalCompositeOperation = 'lighter'
      for (let i = dots.length - 1; i >= 0; i--) {
        const dot = dots[i]
        dot.life -= 0.045
        if (dot.life <= 0) {
          dots.splice(i, 1)
          continue
        }
        ctx.globalAlpha = dot.life * (0.35 + c * 0.5)
        ctx.fillStyle = paletteRef.current[dot.tone] ?? '#fff'
        ctx.beginPath()
        ctx.arc(dot.x, dot.y, dot.life * (5 + c * 16), 0, Math.PI * 2)
        ctx.fill()
      }
      ctx.globalAlpha = 1

      // Nothing left to draw and nothing new coming in: stop. The old loop ran
      // a full-viewport clearRect at 60fps for the entire life of the session,
      // whether or not the pointer had moved in the last ten minutes — on a
      // page nobody is touching, that was the single largest thing the site
      // was doing. `onMove` wakes it again.
      if (dots.length === 0) {
        raf = 0
        return
      }
      raf = requestAnimationFrame(frame)
    }

    window.addEventListener('pointermove', onMove, { passive: true })
    raf = requestAnimationFrame(frame)

    return () => {
      if (raf !== 0) cancelAnimationFrame(raf)
      window.removeEventListener('resize', resize)
      window.removeEventListener('pointermove', onMove)
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
