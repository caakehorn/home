import { useCallback, useEffect, useRef, useState } from 'react'
import { usePortal } from '../state/usePortal'
import './scrawl.css'

/**
 * THE HAND — the visitor's own oil stick.
 *
 * Drag anywhere the page is bare and you leave a mark. It is the one honest
 * way to make a Basquiat site interactive: his canvases are surfaces that got
 * added to, so this one can be added to.
 *
 * It works without a draw mode because of stacking rather than hit-testing:
 * this canvas sits at the very bottom, every route paints above it, so a
 * pointer only ever reaches it in the gaps where nothing else is. Content
 * keeps all its own clicks and no toggle is needed.
 *
 * Marks are stored as points in the palette slot they were drawn with, not as
 * pixels — so they re-colour when the vibe changes and survive a resize.
 */

type Stroke = { tone: number; width: number; points: [number, number][] }

const KEY = 'danfrank:scrawl:v1'
const MAX = 120

const load = (): Stroke[] => {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? (JSON.parse(raw) as Stroke[]) : []
  } catch {
    return []
  }
}

export function Scrawl() {
  const { chaos, vibe } = usePortal()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const strokes = useRef<Stroke[]>([])
  const drawing = useRef<Stroke | null>(null)
  const [count, setCount] = useState(0)

  const paint = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const w = window.innerWidth
    const h = window.innerHeight
    if (canvas.width !== Math.round(w * dpr)) {
      canvas.width = Math.round(w * dpr)
      canvas.height = Math.round(h * dpr)
      canvas.style.width = `${w}px`
      canvas.style.height = `${h}px`
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, w, h)

    const styles = getComputedStyle(document.documentElement)
    const ramp = ['--n1', '--n2', '--n3', '--n4', '--n5', '--p-bone'].map((t) =>
      styles.getPropertyValue(t).trim() || '#fff',
    )

    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    const all = drawing.current ? [...strokes.current, drawing.current] : strokes.current
    for (const stroke of all) {
      if (stroke.points.length < 2) continue
      ctx.strokeStyle = ramp[stroke.tone % ramp.length]
      ctx.lineWidth = stroke.width
      ctx.beginPath()
      ctx.moveTo(stroke.points[0][0] * w, stroke.points[0][1] * h)
      for (let i = 1; i < stroke.points.length; i++) {
        ctx.lineTo(stroke.points[i][0] * w, stroke.points[i][1] * h)
      }
      ctx.stroke()
    }
  }, [])

  useEffect(() => {
    strokes.current = load()
    setCount(strokes.current.length)
    paint()
  }, [paint])

  // Re-paint when the palette changes: the marks follow the room.
  useEffect(() => {
    paint()
  }, [vibe, paint])

  useEffect(() => {
    const onResize = () => paint()
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [paint])

  const save = () => {
    try {
      localStorage.setItem(KEY, JSON.stringify(strokes.current.slice(-MAX)))
    } catch {
      /* full, or private mode — the marks just will not outlive the tab */
    }
  }

  const at = (e: React.PointerEvent) => [e.clientX / window.innerWidth, e.clientY / window.innerHeight] as [number, number]

  return (
    <>
      <canvas
        ref={canvasRef}
        className="scrawl"
        aria-hidden="true"
        onPointerDown={(e) => {
          ;(e.target as HTMLCanvasElement).setPointerCapture(e.pointerId)
          drawing.current = {
            // The stroke takes whichever slot the dial happens to be near, so
            // a session's marks drift across the palette rather than sitting
            // in one colour.
            tone: Math.floor(Math.random() * 6),
            width: 4 + Math.round(chaos * 10),
            points: [at(e)],
          }
        }}
        onPointerMove={(e) => {
          if (!drawing.current) return
          drawing.current.points.push(at(e))
          paint()
        }}
        onPointerUp={(e) => {
          if (drawing.current && drawing.current.points.length > 1) {
            strokes.current = [...strokes.current, drawing.current].slice(-MAX)
            save()
            setCount(strokes.current.length)
          }
          drawing.current = null
          if ((e.target as HTMLCanvasElement).hasPointerCapture?.(e.pointerId)) {
            ;(e.target as HTMLCanvasElement).releasePointerCapture(e.pointerId)
          }
          paint()
        }}
      />

      {count > 0 && (
        <button
          type="button"
          className="scrawl__wipe"
          onClick={() => {
            strokes.current = []
            save()
            setCount(0)
            paint()
          }}
          title="Wipe the marks you have made"
        >
          WIPE <b>{count}</b>
        </button>
      )}
    </>
  )
}
