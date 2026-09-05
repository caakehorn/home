import { useCallback, useEffect, useRef } from 'react'
import './pad.css'

/**
 * The zoom-and-travel pad, hoisted.
 *
 * `CLAUDE.md` §5 states the rule this exists to satisfy — a view that sets
 * `touch-action: none` has taken the browser's own pan and pinch away from the
 * reader and now owes them a replacement, and `onWheel` is not a replacement,
 * because a wheel event never fires on a touchscreen. It then names
 * `src/routes/Core.tsx`'s `.core__pad` as the worked reference and says:
 * "Copy from there rather than re-deriving it."
 *
 * This is that copy, made once. Three of the lanes that wait on `foundation`
 * ship a new drawn instrument each, and the alternative to hoisting it is
 * three sessions re-deriving hold-to-repeat and the `e.detail === 0` keyboard
 * case independently, which is how two of the three end up with a canvas that
 * cannot be zoomed on a phone.
 *
 * The two details that are easy to lose, both from §5:
 *
 * - **Real `<button>`s.** A pinch is discoverable only if you already expect
 *   one, and it is reachable from no keyboard at all. These are focusable and
 *   they are how the camera gets reached without a pointer.
 * - **`e.detail === 0` is a keyboard activation.** It fires `click` with no
 *   `pointerdown`, so a pad wired only to `onPointerDown` does nothing at all
 *   for a keyboard user while looking entirely correct to whoever built it.
 */

export type PadStep = {
  /** The glyph on the key. */
  glyph: string
  /** What it does, for the label and the tooltip. Never omitted. */
  label: string
  run: () => void
  /** Draws a gap under this key, to group the pairs. */
  breakAfter?: boolean
}

export function Pad({ steps, className = '' }: { steps: PadStep[]; className?: string }) {
  // Hold-to-repeat. A camera that moves one step per tap is a camera nobody
  // travels anywhere with.
  const holding = useRef(0)
  const hold = useCallback((fn: () => void) => {
    fn()
    window.clearInterval(holding.current)
    holding.current = window.setInterval(fn, 70)
  }, [])
  const release = useCallback(() => window.clearInterval(holding.current), [])
  useEffect(() => () => window.clearInterval(holding.current), [])

  return (
    <div className={`ckpad ${className}`.trim()}>
      {steps.map((s) => (
        <button
          key={s.label}
          type="button"
          className={`ckpad__btn${s.breakAfter ? ' ckpad__btn--break' : ''}`}
          aria-label={s.label}
          title={s.label}
          onPointerDown={() => hold(s.run)}
          onPointerUp={release}
          onPointerCancel={release}
          onPointerLeave={release}
          onBlur={release}
          onClick={(e) => {
            // A keyboard activation fires no pointerdown, so without this the
            // pad is inert for anybody not using a pointer.
            if (e.detail === 0) s.run()
          }}
        >
          {s.glyph}
        </button>
      ))}
    </div>
  )
}

/**
 * A pinch, reported as a scale factor about its own midpoint.
 *
 * The second half of §5's replacement: the buttons are the discoverable and
 * keyboard-reachable path, and this is the gesture a reader who already
 * expects one will try first. Both are owed; neither substitutes for the other.
 *
 * The midpoint matters. §5's worked note on the wiki map says its wheel
 * handler "already pins the point under the cursor while zooming — keep that,
 * and pin the pinch midpoint the same way", because a pinch that zooms about
 * the centre of the canvas walks the thing you were looking at off the screen.
 *
 * Returns handlers to spread onto the element that sets `touch-action: none`.
 */
export function usePinch(onScale: (factor: number, midpoint: { x: number; y: number }) => void) {
  const points = useRef(new Map<number, { x: number; y: number }>())
  const spread = useRef(0)

  const measure = () => {
    const [a, b] = [...points.current.values()]
    return {
      distance: Math.hypot(a.x - b.x, a.y - b.y),
      midpoint: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
    }
  }

  return {
    onPointerDown: (e: React.PointerEvent) => {
      points.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
      if (points.current.size === 2) spread.current = measure().distance
    },
    onPointerMove: (e: React.PointerEvent) => {
      if (!points.current.has(e.pointerId)) return
      points.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
      if (points.current.size !== 2) return
      const { distance, midpoint } = measure()
      // A zero previous spread means this is the first frame of the gesture;
      // dividing by it would send the camera to infinity.
      if (spread.current > 0 && distance > 0) onScale(distance / spread.current, midpoint)
      spread.current = distance
    },
    onPointerUp: (e: React.PointerEvent) => {
      points.current.delete(e.pointerId)
      spread.current = 0
    },
    onPointerCancel: (e: React.PointerEvent) => {
      points.current.delete(e.pointerId)
      spread.current = 0
    },
  }
}
