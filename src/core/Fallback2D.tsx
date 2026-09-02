import { useEffect, useRef } from 'react'
import type { Layout, Structure } from './data'

/**
 * THE CORE without a GPU.
 *
 * WebGL2 is fifteen years old and on every desktop browser, but it is off in
 * some hardened configurations, unavailable in a few remote-desktop stacks, and
 * a context can be lost and not come back. A room that shows a stack trace in
 * those cases is a room that is broken for the reader, not for the reader's
 * machine.
 *
 * So this draws the same structure in canvas 2D, orthographically, from the
 * same solved layout: the pages, the typed graph, the axis. What it does not
 * draw is the 134,348-message sheath and the bloom — 134,000 additively blended
 * points is exactly the thing 2D cannot do, and pretending otherwise with a
 * sample of them would be quietly showing a different corpus. It says which
 * layer is missing instead.
 *
 * It follows the measure and the shape, because it is handed the same solved
 * layout the GPU is. The one thing it had to stop assuming is that the picture
 * is a tall column: it fitted x to a fixed ±170 and y to the data, which is a
 * flat disc squashed into a stripe and a sphere cropped at the sides. Both axes
 * are fitted to the layout's own bounds now, and the aspect is held so a sphere
 * is round rather than an ellipse.
 */
export function Fallback2D({
  structure,
  layout,
  selected,
  onSelect,
}: {
  structure: Structure
  layout: Layout
  selected: number | null
  onSelect: (i: number | null) => void
}) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const hit = useRef<{ x: number; y: number; i: number; r: number }[]>([])

  useEffect(() => {
    const el = canvas.current
    if (!el) return
    const ctx = el.getContext('2d')
    if (!ctx) return

    const paint = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1)
      const rect = el.getBoundingClientRect()
      const w = Math.max(320, rect.width)
      const h = Math.max(320, rect.height)
      if (el.width !== Math.round(w * dpr)) {
        el.width = Math.round(w * dpr)
        el.height = Math.round(h * dpr)
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

      const style = getComputedStyle(el)
      const ink = (t: string, f: string) => style.getPropertyValue(t).trim() || f
      ctx.fillStyle = ink('--void', '#04040a')
      ctx.fillRect(0, 0, w, h)

      /*
       * Orthographic, with no camera, because a fallback that needs to be flown
       * is not a fallback — which leaves one decision: which two of the three
       * world axes to keep.
       *
       * It used to be x and y always, which is right for a column and useless
       * for a disc: a disc is a plane at y ≈ 0, so x-and-y renders it edge-on
       * as a 20-pixel stripe. The rule is the two widest axes, measured off the
       * layout itself. y wins the vertical whenever it is one of them, so the
       * column, the helix and the rings still read measure-up; a flat shape
       * falls through to x-and-z, which is a disc seen from above.
       */
      const lo = [Infinity, Infinity, Infinity]
      const hi = [-Infinity, -Infinity, -Infinity]
      for (let i = 0; i < structure.nodes.length; i++) {
        for (let d = 0; d < 3; d++) {
          const v = layout.pos[i * 3 + d]
          if (v < lo[d]) lo[d] = v
          if (v > hi[d]) hi[d] = v
        }
      }
      const span = [hi[0] - lo[0] || 1, hi[1] - lo[1] || 1, hi[2] - lo[2] || 1]
      const widest = [0, 1, 2].sort((a, b) => span[b] - span[a]).slice(0, 2)
      const up = widest.includes(1) ? 1 : 2
      const across = widest.find((d) => d !== up) ?? 0

      const pad = 40
      // One scale for both axes, so the shape keeps its proportions — a disc
      // fitted independently in each is an ellipse, which is a different drawing.
      const k = Math.min((w - pad * 2) / span[across], (h - pad * 2) / span[up])
      const sx = (i: number) =>
        w / 2 + (layout.pos[i * 3 + across] - (lo[across] + hi[across]) / 2) * k
      const sy = (i: number) => h / 2 - (layout.pos[i * 3 + up] - (lo[up] + hi[up]) / 2) * k

      ctx.strokeStyle = ink('--text-dim', '#7f9470')
      ctx.globalAlpha = 0.16
      ctx.lineWidth = 1
      ctx.beginPath()
      for (const [from, to] of structure.typed) {
        ctx.moveTo(sx(from), sy(from))
        ctx.lineTo(sx(to), sy(to))
      }
      ctx.stroke()

      ctx.globalAlpha = 1
      hit.current = []
      const accents = ['--n1', '--n2', '--n3', '--n4', '--n5']
      structure.nodes.forEach((n, i) => {
        const d = structure.domains.findIndex((x) => x.id === n.d)
        const x = sx(i)
        const y = sy(i)
        const r = 1.6 + Math.sqrt(n.w) / 26
        hit.current.push({ x, y, i, r: Math.max(6, r) })
        ctx.fillStyle = ink(accents[d % 5], '#b026ff')
        ctx.globalAlpha = selected === null || selected === i ? 0.9 : 0.3
        ctx.beginPath()
        ctx.arc(x, y, r, 0, Math.PI * 2)
        ctx.fill()
      })
      ctx.globalAlpha = 1
    }

    paint()
    const observer = new ResizeObserver(paint)
    observer.observe(el)
    return () => observer.disconnect()
  }, [structure, layout, selected])

  return (
    <canvas
      ref={canvas}
      className="core__canvas"
      onClick={(e) => {
        const rect = e.currentTarget.getBoundingClientRect()
        const x = e.clientX - rect.left
        const y = e.clientY - rect.top
        let best: number | null = null
        let bestD = Infinity
        for (const p of hit.current) {
          const d = Math.hypot(p.x - x, p.y - y)
          if (d < p.r && d < bestD) {
            bestD = d
            best = p.i
          }
        }
        onSelect(best)
      }}
    />
  )
}
