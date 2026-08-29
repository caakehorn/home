import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { usePortal } from '../state/usePortal'
import { colourWith } from '../leviathan/ink'
import { DOMAIN_KANA, nameOf, shortDate, type Collision, type DocketSet } from './core'
import { Reading, stripHead } from './Reading'

/**
 * I · THE COLLISIONS — 衝突
 *
 * Forty-one places where the wiki makes two claims that cannot both be true and
 * has withdrawn neither. Every page in the corpus is a dot; the fifty-one
 * carrying a collision are lit; a collision that names another page is drawn as
 * a fracture between them.
 *
 * ---- the layout is not the data --------------------------------------------
 *
 * The coordinates come from the map at /brain, the same ones THE WEB reuses,
 * for the same reason it gives: a force simulation started twice gives two
 * different pictures of one graph, and a reader who cannot tell which parts of a
 * drawing are the data cannot read it. The one liberty taken is the frame — the
 * view is fitted to the fifty-one lit pages rather than to all five hundred and
 * sixteen, which is a pan and a zoom of the same map and not a second one.
 *
 * ---- why the fractures move ------------------------------------------------
 *
 * A held contradiction is not a settled fact and should not be drawn like one. A
 * straight line between two pages says the relationship is understood; the
 * fracture is a random walk between the same two endpoints, reseeded on a slow
 * cycle, so what it draws is the thing being unresolved rather than a fact about
 * how it will resolve. The endpoints never move — those are the data. It holds
 * still under a motion preference, where the seed is frozen instead.
 *
 * ---- the eighteen with nobody to fight -------------------------------------
 *
 * Eighteen of the forty-one name no other page. They are a page colliding with a
 * source, with an operator capture, or with an earlier version of itself, and
 * there is no second node to draw. They get a fracture ring instead of an edge,
 * which is the honest shape: the damage is real and it is internal.
 */

type Node = {
  slug: string
  x: number
  y: number
  domain: string
  /** Collisions this page is party to, whether it holds the block or is named. */
  degree: number
  /** Collisions it holds that name nobody — drawn as a ring, not an edge. */
  internal: number
}

const DOMAIN_INK: Record<string, string> = {
  mind: '#a86bff',
  people: '#ff3ba7',
  timeline: '#00d5e8',
  self: '#3ddc84',
  interests: '#ffb020',
  health: '#ff5c5c',
  legal: '#ec835a',
  places: '#8fd6ff',
  work: '#d7ff5c',
  meta: '#9aa0b5',
}

export function Collisions({ set }: { set: DocketSet }) {
  const [picked, setPicked] = useState<string | null>(null)
  const [hover, setHover] = useState<string | null>(null)

  const open = useMemo(() => set.contradictions.filter((c) => c.open), [set])

  const { nodes, edges } = useMemo(() => {
    const by = new Map<string, Node>()
    const touch = (slug: string) => {
      let n = by.get(slug)
      if (!n) {
        const p = set.pages[slug]
        n = { slug, x: p?.x ?? 0, y: p?.y ?? 0, domain: p?.domain ?? slug.split('/')[0], degree: 0, internal: 0 }
        by.set(slug, n)
      }
      return n
    }
    const edges: { a: Node; b: Node; c: Collision }[] = []
    for (const c of open) {
      const a = touch(c.page)
      a.degree++
      if (!c.against.length) a.internal++
      for (const other of c.against) {
        const b = touch(other)
        b.degree++
        edges.push({ a, b, c })
      }
    }
    const nodes = [...by.values()]
    return { nodes, edges }
  }, [open, set])

  const shown = picked
    ? open.filter((c) => c.page === picked || c.against.includes(picked))
    : open

  return (
    <div className="dk-bench">
      <div className="dk-plot">
        <Fracture
          set={set}
          nodes={nodes}
          edges={edges}
          picked={picked}
          hover={hover}
          onPick={setPicked}
          onHover={setHover}
        />
        <ul className="dk-legend" aria-label="Domains on the graph">
          {[...new Set(nodes.map((n) => n.domain))].sort().map((d) => (
            <li key={d}>
              <i style={{ background: DOMAIN_INK[d] ?? '#9aa0b5' }} aria-hidden="true" />
              <span className="jp" aria-hidden="true">
                {DOMAIN_KANA[d] ?? ''}
              </span>
              {d.toUpperCase()}
            </li>
          ))}
          <li className="dk-legend__note">
            <i className="dk-legend__ring" aria-hidden="true" /> RING = COLLIDES WITH NO OTHER PAGE
          </li>
        </ul>
      </div>

      <div className="dk-side">
        <div className="dk-side__head">
          <h3 className="dk-side__title">
            {picked ? nameOf(set, picked).toUpperCase() : `${open.length} HELD OPEN`}
          </h3>
          {picked ? (
            <p className="dk-side__meta">
              <Link to={`/brain/${picked}`}>READ THE PAGE →</Link>{' '}
              <button type="button" className="dk-chip" onClick={() => setPicked(null)}>
                CLEAR
              </button>
            </p>
          ) : (
            <p className="dk-side__meta">
              {nodes.length} pages · {edges.length} named collisions ·{' '}
              {open.filter((c) => !c.against.length).length} internal. Pick one on the graph, or read
              them all below.
            </p>
          )}
        </div>

        <ol className="dk-list">
          {shown.map((c) => (
            <li key={c.id} className="dk-case">
              <p className="dk-case__head">
                <span className="dk-case__no">{c.id.toUpperCase()}</span>
                <Link className="dk-case__page" to={`/brain/${c.page}`}>
                  {nameOf(set, c.page).toUpperCase()}
                </Link>
                {c.against.length ? (
                  <>
                    <span className="dk-case__v" aria-hidden="true">
                      ⚡
                    </span>
                    {c.against.map((a, i) => (
                      <span key={a} className="dk-case__against">
                        {i > 0 && <em aria-hidden="true">+</em>}
                        <Link className="dk-case__page" to={`/brain/${a}`}>
                          {nameOf(set, a).toUpperCase()}
                        </Link>
                      </span>
                    ))}
                  </>
                ) : (
                  <span className="dk-case__internal">INTERNAL</span>
                )}
                {c.date && <span className="dk-case__date">{shortDate(c.date)}</span>}
              </p>
              {c.headline && <p className="dk-case__line">{c.headline}</p>}
              <Reading text={stripHead(c.text)} />
            </li>
          ))}
        </ol>
      </div>
    </div>
  )
}

/* ==========================================================================
   THE DRAWING
   ========================================================================== */

/** A fracture: a random walk between two points that never leaves the segment. */
function fracture(ax: number, ay: number, bx: number, by: number, seed: number, spread: number) {
  const dx = bx - ax
  const dy = by - ay
  const len = Math.hypot(dx, dy) || 1
  const nx = -dy / len
  const ny = dx / len
  const steps = Math.max(4, Math.min(14, Math.round(len / 26)))
  const pts: [number, number][] = [[ax, ay]]
  let s = seed
  for (let i = 1; i < steps; i++) {
    // xorshift, so a given seed draws the same crack every frame it is held.
    s ^= s << 13
    s ^= s >>> 17
    s ^= s << 5
    const jitter = (((s >>> 0) % 2000) / 1000 - 1) * spread * Math.sin((i / steps) * Math.PI)
    const t = i / steps
    pts.push([ax + dx * t + nx * jitter, ay + dy * t + ny * jitter])
  }
  pts.push([bx, by])
  return pts
}

function Fracture({
  set,
  nodes,
  edges,
  picked,
  hover,
  onPick,
  onHover,
}: {
  set: DocketSet
  nodes: Node[]
  edges: { a: Node; b: Node; c: Collision }[]
  picked: string | null
  hover: string | null
  onPick: (slug: string | null) => void
  onHover: (slug: string | null) => void
}) {
  const wrap = useRef<HTMLDivElement>(null)
  const canvas = useRef<HTMLCanvasElement>(null)
  const hits = useRef<{ slug: string; x: number; y: number; r: number }[]>([])
  const { motion } = usePortal()

  useEffect(() => {
    const box = wrap.current
    const cv = canvas.current
    if (!box || !cv) return
    const ctx = cv.getContext('2d')
    if (!ctx) return

    let raf = 0
    let stop = false

    const draw = (t: number) => {
      const w = box.clientWidth
      const h = box.clientHeight
      const dpr = Math.min(2, window.devicePixelRatio || 1)
      if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) {
        cv.width = Math.round(w * dpr)
        cv.height = Math.round(h * dpr)
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, w, h)

      // The frame is the lit pages' own bounding box, opened out by a third.
      //
      // Fitting to the fifty-one alone fills the plate and crops the other four
      // hundred and sixty-five off the edges, which throws away the only thing
      // the faint field was drawn for — forty-one collisions is a number about
      // a corpus, and the corpus has to be in the picture. Fitting to all five
      // hundred and sixteen does the opposite: the map at /brain has long thin
      // arms, and letting them set the scale leaves the collisions in a knot in
      // the middle of an empty plate. A third out from the lit box keeps the
      // knot legible with a wide margin of corpus around it, and what falls off
      // the edge is field rather than data.
      const pad = 34
      const bx0 = Math.min(...nodes.map((n) => n.x))
      const bx1 = Math.max(...nodes.map((n) => n.x))
      const by0 = Math.min(...nodes.map((n) => n.y))
      const by1 = Math.max(...nodes.map((n) => n.y))
      const grow = 0.34
      const mx = (bx1 - bx0) * grow
      const my = (by1 - by0) * grow
      const x0 = bx0 - mx
      const x1 = bx1 + mx
      const y0 = by0 - my
      const y1 = by1 + my
      const k = Math.min((w - pad * 2) / (x1 - x0 || 1), (h - pad * 2) / (y1 - y0 || 1))
      const ox = (w - (x1 - x0) * k) / 2 - x0 * k
      const oy = (h - (y1 - y0) * k) / 2 - y0 * k
      const px = (x: number) => x * k + ox
      const py = (y: number) => y * k + oy

      const css = getComputedStyle(box)
      const dim = css.getPropertyValue('--text-dim').trim() || '#7f9470'

      // ---- the denominator: every other page in the corpus, faint ----------
      ctx.fillStyle = colourWith(dim, 0.3)
      for (const [fx, fy] of set.field) {
        const x = px(fx)
        const y = py(fy)
        if (x < -20 || x > w + 20 || y < -20 || y > h + 20) continue
        ctx.beginPath()
        ctx.arc(x, y, 1.35, 0, Math.PI * 2)
        ctx.fill()
      }

      // ---- the fractures ----------------------------------------------------
      // Reseeded once a second so the crack redraws rather than crawling: a
      // smoothly animated line reads as a flow, and nothing here flows.
      const era = motion ? Math.floor(t / 900) : 0
      for (const e of edges) {
        const live =
          !picked || picked === e.a.slug || picked === e.b.slug || hover === e.a.slug || hover === e.b.slug
        const seed = (hash(e.c.id) ^ (era * 2654435761)) >>> 0 || 1
        const pts = fracture(px(e.a.x), py(e.a.y), px(e.b.x), py(e.b.y), seed, live ? 13 : 7)
        ctx.strokeStyle = colourWith('#ff5c5c', live ? 0.85 : 0.2)
        ctx.lineWidth = live ? 1.8 : 1
        ctx.beginPath()
        ctx.moveTo(pts[0][0], pts[0][1])
        for (const [x, y] of pts.slice(1)) ctx.lineTo(x, y)
        ctx.stroke()
      }

      // ---- the pages carrying one -------------------------------------------
      //
      // Drawn busiest-first so that when two labels want the same space the one
      // on the page in more collisions gets it. A label is skipped outright
      // rather than nudged: a nudged label points at the wrong dot, which is
      // worse than no label on a picture whose whole job is to say which pages
      // these are. The picked and hovered ones are drawn last and unconditionally.
      hits.current = []
      const placed: [number, number, number, number][] = []
      const clear = (x: number, y: number, w: number, h: number) =>
        !placed.some(([a, b, c, d]) => x < a + c && x + w > a && y < b + d && y + h > b)

      const order = [...nodes].sort((a, b) => b.degree - a.degree)
      for (const n of order) {
        const x = px(n.x)
        const y = py(n.y)
        const r = 3.4 + Math.min(4.6, n.degree * 1.5)
        const live = !picked || picked === n.slug
        const ink = DOMAIN_INK[n.domain] ?? '#9aa0b5'
        hits.current.push({ slug: n.slug, x, y, r: r + 7 })

        if (n.internal) {
          // The ring is the collision that has no second node to draw.
          ctx.strokeStyle = colourWith('#ff5c5c', live ? 0.75 : 0.22)
          ctx.lineWidth = 1.4
          for (let i = 0; i < n.internal; i++) {
            ctx.beginPath()
            ctx.arc(x, y, r + 5 + i * 4, 0, Math.PI * 2)
            ctx.stroke()
          }
        }

        ctx.fillStyle = colourWith(ink, live ? 0.95 : 0.25)
        ctx.beginPath()
        ctx.arc(x, y, r, 0, Math.PI * 2)
        ctx.fill()

        if (picked === n.slug || hover === n.slug) {
          ctx.strokeStyle = ink
          ctx.lineWidth = 2
          ctx.beginPath()
          ctx.arc(x, y, r + 5, 0, Math.PI * 2)
          ctx.stroke()
        }

        const wanted = picked === n.slug || hover === n.slug
        if (n.degree > 1 || wanted) {
          const label = nameOf(set, n.slug).toUpperCase()
          ctx.font = '600 9.5px "Space Mono", ui-monospace, monospace'
          ctx.textAlign = 'center'
          ctx.textBaseline = 'top'
          const tw = ctx.measureText(label).width
          const bx = x - tw / 2 - 3
          const by = y + r + 4
          if (wanted || clear(bx, by, tw + 6, 13)) {
            placed.push([bx, by, tw + 6, 13])
            ctx.fillStyle = colourWith('#03030a', 0.82)
            ctx.fillRect(bx, by, tw + 6, 12)
            ctx.fillStyle = colourWith(ink, live ? 1 : 0.35)
            ctx.fillText(label, x, y + r + 5)
          }
        }
      }

      if (!stop && motion) raf = requestAnimationFrame(draw)
    }

    raf = requestAnimationFrame(draw)
    const ro = new ResizeObserver(() => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(draw)
    })
    ro.observe(box)
    return () => {
      stop = true
      cancelAnimationFrame(raf)
      ro.disconnect()
    }
  }, [set, nodes, edges, picked, hover, motion])

  const at = (ev: React.MouseEvent) => {
    const box = wrap.current
    if (!box) return null
    const r = box.getBoundingClientRect()
    const mx = ev.clientX - r.left
    const my = ev.clientY - r.top
    let best: { slug: string; d: number } | null = null
    for (const h of hits.current) {
      const d = Math.hypot(h.x - mx, h.y - my)
      if (d < h.r && (!best || d < best.d)) best = { slug: h.slug, d }
    }
    return best?.slug ?? null
  }

  return (
    <div
      className="dk-graph"
      ref={wrap}
      onMouseMove={(e) => onHover(at(e))}
      onMouseLeave={() => onHover(null)}
      onClick={(e) => {
        const slug = at(e)
        onPick(slug && slug !== picked ? slug : null)
      }}
    >
      <canvas ref={canvas} className="dk-graph__cv" />
      <p className="dk-graph__cap">
        {set.field.length} PAGES · {nodes.length} CARRYING A COLLISION
      </p>
    </div>
  )
}

function hash(s: string) {
  let h = 0x811c9dc5
  for (const ch of s) {
    h ^= ch.charCodeAt(0)
    h = Math.imul(h, 0x01000193) >>> 0
  }
  return h
}
