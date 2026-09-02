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

      // Orthographic: x across, the measure up. No camera, because a fallback
      // that needs to be flown is not a fallback.
      let minX = Infinity
      let maxX = -Infinity
      let minY = Infinity
      let maxY = -Infinity
      for (let i = 0; i < structure.nodes.length; i++) {
        const x = layout.pos[i * 3]
        const y = layout.pos[i * 3 + 1]
        if (x < minX) minX = x
        if (x > maxX) maxX = x
        if (y < minY) minY = y
        if (y > maxY) maxY = y
      }
      const pad = 40
      const spanX = maxX - minX || 1
      const spanY = maxY - minY || 1
      // One scale for both axes, so the shape keeps its proportions — a disc
      // fitted independently in x and y is an ellipse, which is a different
      // drawing.
      const k = Math.min((w - pad * 2) / spanX, (h - pad * 2) / spanY)
      const sx = (x: number) => w / 2 + (x - (minX + maxX) / 2) * k
      const sy = (y: number) => h / 2 - (y - (minY + maxY) / 2) * k

      ctx.strokeStyle = ink('--text-dim', '#7f9470')
      ctx.globalAlpha = 0.16
      ctx.lineWidth = 1
      ctx.beginPath()
      for (const [from, to] of structure.typed) {
        ctx.moveTo(sx(layout.pos[from * 3]), sy(layout.pos[from * 3 + 1]))
        ctx.lineTo(sx(layout.pos[to * 3]), sy(layout.pos[to * 3 + 1]))
      }
      ctx.stroke()

      ctx.globalAlpha = 1
      hit.current = []
      const accents = ['--n1', '--n2', '--n3', '--n4', '--n5']
      structure.nodes.forEach((n, i) => {
        const d = structure.domains.findIndex((x) => x.id === n.d)
        const x = sx(layout.pos[i * 3])
        const y = sy(layout.pos[i * 3 + 1])
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
