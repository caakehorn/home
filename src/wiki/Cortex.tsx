import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { usePortal, useRig } from '../state/usePortal'
import { buildGraph, clampCamera, HOME, project, zoomedRadius, type Camera } from './graph'
import type { WikiIndex } from './data'
import './cortex.css'

/**
 * THE CORTEX — the wiki as a map instead of a list.
 *
 * 458 pages in a grid is a filing cabinet; the same 458 pages laid out by what
 * they link to is a place you can learn. Position is the whole encoding here:
 * domains settle into lobes, and the pages that link across everything end up
 * in the middle, which is exactly where they belong. Colour carries state, not
 * identity — one accent, brightening for the page under the cursor and its
 * neighbours, receding for everything filtered out.
 *
 * Clicking inspects rather than navigates. The probe panel then lists what the
 * page connects to, and those are clickable too, so you can walk the wiki
 * link by link and only commit to a page when you mean it.
 */

const DOMAIN_KANA: Record<string, string> = {
  people: '人', interests: '趣味', mind: '心', timeline: '年表',
  self: '自己', work: '仕事', places: '場所', health: '健康', legal: '法',
}

const readPalette = () => {
  const styles = getComputedStyle(document.documentElement)
  const read = (token: string, fallback: string) => styles.getPropertyValue(token).trim() || fallback
  return {
    n1: read('--n1', '#b026ff'),
    n2: read('--n2', '#ff2bd6'),
    n3: read('--n3', '#00eaff'),
    text: read('--text', '#f2e9ff'),
    dim: read('--text-dim', '#a98ecf'),
    // Canvas needs real family names; a var() in ctx.font is silently ignored.
    mono: read('--f-mono', 'monospace'),
    jp: read('--f-jp', 'sans-serif'),
  }
}

const mix = (hex: string, alpha: number) => {
  const v = hex.replace('#', '')
  const n = v.length === 3 ? v.split('').map((c) => c + c).join('') : v
  const int = parseInt(n, 16)
  return `rgba(${(int >> 16) & 255}, ${(int >> 8) & 255}, ${int & 255}, ${alpha})`
}

type Props = {
  index: WikiIndex
  /** Slugs passing the current search and domain filter. */
  visible: Set<string>
  domain: string | null
  query: string
  onClear: () => void
}

export function Cortex({ index, visible, domain, query, onClear }: Props) {
  const navigate = useNavigate()
  const { chaos } = usePortal()
  const poke = useRig('CORTEX')
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const wrapRef = useRef<HTMLDivElement>(null)

  const graph = useMemo(() => buildGraph(index), [index])
  const [camera, setCamera] = useState<Camera>(HOME)
  const [hover, setHover] = useState<number | null>(null)
  const [pinned, setPinned] = useState<number | null>(null)

  const shown = hover ?? pinned
  const probe = shown === null ? null : graph.nodes[shown]

  // The draw loop reads these without being rebuilt on every state change.
  const state = useRef({ camera, hover, pinned, visible, graph, chaos, domain })
  state.current = { camera, hover, pinned, visible, graph, chaos, domain }

  /** Move the camera so a node lands in the middle, at a readable zoom. */
  const focusNode = useCallback((i: number | null, zoom = 2.6) => {
    setPinned(i)
    if (i === null) return
    setCamera((c) => clampCamera({ x: state.current.graph.nodes[i].x, y: state.current.graph.nodes[i].y, zoom: Math.max(c.zoom, zoom) }))
  }, [])

  // A single match is an answer, not a filter: fly to it.
  useEffect(() => {
    const hits = graph.nodes.filter((n) => visible.has(n.page.slug))
    if (query.trim().length > 1 && hits.length === 1) focusNode(hits[0].index)
  }, [query, visible, graph, focusNode])

  // A page filtered out of the map should not stay in the probe.
  useEffect(() => {
    if (pinned !== null && !visible.has(graph.nodes[pinned].page.slug)) setPinned(null)
    if (hover !== null && !visible.has(graph.nodes[hover].page.slug)) setHover(null)
  }, [visible, graph, pinned, hover])

  // Pointing at a lobe frames it.
  useEffect(() => {
    if (!domain) return
    const lobe = graph.lobes.find((l) => l.id === domain)
    if (lobe) setCamera(clampCamera({ x: lobe.x, y: lobe.y, zoom: 1.75 }))
  }, [domain, graph])

  // ---- drawing ----------------------------------------------------------
  useEffect(() => {
    const canvas = canvasRef.current
    const wrap = wrapRef.current
    if (!canvas || !wrap) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    let palette = readPalette()
    let width = 0
    let height = 0
    let raf = 0
    let t = 0
    let signature = ''

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      const rect = wrap.getBoundingClientRect()
      width = Math.max(1, Math.round(rect.width))
      height = Math.max(1, Math.round(rect.height))
      canvas.width = Math.round(width * dpr)
      canvas.height = Math.round(height * dpr)
      canvas.style.width = `${width}px`
      canvas.style.height = `${height}px`
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      palette = readPalette()
      signature = ''
    }

    const observer = new ResizeObserver(resize)
    observer.observe(wrap)
    resize()

    const draw = () => {
      const { camera: cam, hover: hov, pinned: pin, graph: g, chaos: cha } = state.current
      const shownSet = state.current.visible
      const litDomain = state.current.domain
      const active = hov ?? pin

      // A still map costs nothing: redraw on change, and keep animating only
      // while something is lit and breathing.
      const next = `${cam.x},${cam.y},${cam.zoom},${active},${shownSet.size},${litDomain}`
      const still = next === signature && (calm || active === null)
      signature = next
      if (still) {
        raf = requestAnimationFrame(draw)
        return
      }
      const { toScreen } = project(cam, width, height)
      const near = new Set<number>(active === null ? [] : g.nodes[active].neighbours)

      ctx.clearRect(0, 0, width, height)

      // lobe names, under everything, as ground rather than label
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      for (const lobe of g.lobes) {
        const at = toScreen(lobe.x, lobe.y)
        const lit = litDomain === lobe.id
        const size = Math.max(13, Math.min(48, 15 * cam.zoom ** 0.5))
        ctx.fillStyle = mix(palette.text, lit ? 0.22 : 0.1)
        ctx.font = `${size * 1.5}px ${palette.jp}`
        ctx.fillText(DOMAIN_KANA[lobe.id] ?? '書', at.x, at.y - size * 0.9)
        ctx.font = `${size * 0.62}px ${palette.mono}`
        ctx.fillStyle = mix(palette.text, lit ? 0.42 : 0.2)
        ctx.fillText(lobe.id.toUpperCase(), at.x, at.y + size * 0.5)
      }

      // synapses — a faint mesh, with the focused page's own links lit
      ctx.lineWidth = 1
      ctx.strokeStyle = mix(palette.n1, 0.1)
      ctx.beginPath()
      for (const [a, b] of g.edges) {
        if (active !== null && (a === active || b === active)) continue
        if (!shownSet.has(g.nodes[a].page.slug) || !shownSet.has(g.nodes[b].page.slug)) continue
        const p = toScreen(g.nodes[a].x, g.nodes[a].y)
        const q = toScreen(g.nodes[b].x, g.nodes[b].y)
        ctx.moveTo(p.x, p.y)
        ctx.lineTo(q.x, q.y)
      }
      ctx.stroke()

      if (active !== null) {
        const from = toScreen(g.nodes[active].x, g.nodes[active].y)
        ctx.strokeStyle = mix(palette.n3, 0.75)
        ctx.lineWidth = 1.4
        ctx.beginPath()
        for (const n of near) {
          const q = toScreen(g.nodes[n].x, g.nodes[n].y)
          ctx.moveTo(from.x, from.y)
          ctx.lineTo(q.x, q.y)
        }
        ctx.stroke()
      }

      // pages
      const pulse = calm ? 0 : (Math.sin(t / 34) * 0.5 + 0.5) * (0.25 + cha * 0.75)
      for (const node of g.nodes) {
        const at = toScreen(node.x, node.y)
        const r = zoomedRadius(node.radius, cam.zoom)
        if (at.x < -40 || at.y < -40 || at.x > width + 40 || at.y > height + 40) continue

        const isActive = node.index === active
        const isNear = near.has(node.index)
        const inSet = shownSet.has(node.page.slug)

        let fill = mix(palette.n1, inSet ? 0.5 : 0.14)
        if (inSet) fill = mix(palette.n1, 0.42 + Math.min(node.degree, 40) / 90)
        if (isNear) fill = mix(palette.n3, 0.85)
        if (isActive) fill = palette.n2

        if (isActive || isNear) {
          ctx.shadowColor = isActive ? palette.n2 : palette.n3
          ctx.shadowBlur = (isActive ? 22 : 10) * (0.5 + cha)
        }
        ctx.fillStyle = fill
        ctx.beginPath()
        ctx.arc(at.x, at.y, isActive ? r + 2.5 + pulse * 2 : r, 0, Math.PI * 2)
        ctx.fill()
        ctx.shadowBlur = 0

        if (isActive) {
          ctx.strokeStyle = mix(palette.n2, 0.55)
          ctx.lineWidth = 1.5
          ctx.beginPath()
          ctx.arc(at.x, at.y, r + 9 + pulse * 4, 0, Math.PI * 2)
          ctx.stroke()
        }
      }

      // Names, in priority order — the lit page, then its links, then the big
      // pages once the map is close enough — and only where one fits. An
      // unreadable pile of overlapping titles is worse than no titles.
      ctx.textAlign = 'left'
      ctx.textBaseline = 'alphabetic'
      ctx.font = `11px ${palette.mono}`
      const placed: { x: number; y: number; w: number }[] = []
      const fits = (x: number, y: number, w: number) =>
        !placed.some((b) => Math.abs(b.y - y) < 13 && x < b.x + b.w + 6 && b.x < x + w + 6)

      const candidates = [
        ...(active === null ? [] : [g.nodes[active]]),
        ...[...near].map((i) => g.nodes[i]).sort((a, b) => b.degree - a.degree).slice(0, 14),
        ...(cam.zoom > 1.3
          ? g.nodes
              .filter((n) => shownSet.has(n.page.slug) && zoomedRadius(n.radius, cam.zoom) > 8)
              .sort((a, b) => b.degree - a.degree)
          : []),
      ]

      for (const node of candidates) {
        const isActive = node.index === active
        const isNear = near.has(node.index)
        const at = toScreen(node.x, node.y)
        if (at.x < -100 || at.y < -20 || at.x > width + 100 || at.y > height + 20) continue
        const r = zoomedRadius(node.radius, cam.zoom)
        const x = at.x + r + 6
        const y = at.y + 4
        const w = ctx.measureText(node.page.title).width
        if (!isActive && !fits(x, y, w)) continue
        placed.push({ x, y, w })
        ctx.fillStyle = isActive ? palette.text : mix(palette.text, isNear ? 0.85 : 0.5)
        ctx.fillText(node.page.title, x, y)
      }

      t += 1
      raf = requestAnimationFrame(draw)
    }

    draw()
    return () => {
      observer.disconnect()
      cancelAnimationFrame(raf)
    }
  }, [graph])

  // ---- pointer ----------------------------------------------------------
  const drag = useRef<{ x: number; y: number; moved: boolean } | null>(null)

  const nodeAt = (clientX: number, clientY: number) => {
    const wrap = wrapRef.current
    if (!wrap) return null
    const rect = wrap.getBoundingClientRect()
    const { toScreen } = project(camera, rect.width, rect.height)
    const px = clientX - rect.left
    const py = clientY - rect.top
    let best: number | null = null
    let bestDistance = Infinity
    for (const node of graph.nodes) {
      if (!visible.has(node.page.slug)) continue
      const at = toScreen(node.x, node.y)
      const d = Math.hypot(at.x - px, at.y - py)
      const reach = zoomedRadius(node.radius, camera.zoom) + 7
      if (d < reach && d < bestDistance) {
        best = node.index
        bestDistance = d
      }
    }
    return best
  }

  const onPointerDown = (e: React.PointerEvent) => {
    ;(e.target as Element).setPointerCapture?.(e.pointerId)
    drag.current = { x: e.clientX, y: e.clientY, moved: false }
  }

  const onPointerMove = (e: React.PointerEvent) => {
    const wrap = wrapRef.current
    if (!wrap) return
    if (drag.current && (e.buttons & 1) === 1) {
      const dx = e.clientX - drag.current.x
      const dy = e.clientY - drag.current.y
      if (Math.abs(dx) + Math.abs(dy) > 3) drag.current.moved = true
      const rect = wrap.getBoundingClientRect()
      const { unit } = project(camera, rect.width, rect.height)
      drag.current.x = e.clientX
      drag.current.y = e.clientY
      setCamera((c) => clampCamera({ ...c, x: c.x - dx / (unit * c.zoom), y: c.y - dy / (unit * c.zoom) }))
      return
    }
    setHover(nodeAt(e.clientX, e.clientY))
  }

  const onPointerUp = (e: React.PointerEvent) => {
    const moved = drag.current?.moved
    drag.current = null
    if (moved) return
    const hit = nodeAt(e.clientX, e.clientY)
    setPinned(hit)
    if (hit !== null) poke()
  }

  const onWheel = (e: React.WheelEvent) => {
    const wrap = wrapRef.current
    if (!wrap) return
    const rect = wrap.getBoundingClientRect()
    const { toWorld } = project(camera, rect.width, rect.height)
    const at = toWorld(e.clientX - rect.left, e.clientY - rect.top)
    const next = clampCamera({ ...camera, zoom: camera.zoom * (e.deltaY < 0 ? 1.16 : 1 / 1.16) })
    // Keep the point under the cursor pinned to the cursor.
    const after = project(next, rect.width, rect.height).toWorld(e.clientX - rect.left, e.clientY - rect.top)
    setCamera(clampCamera({ ...next, x: next.x + (at.x - after.x), y: next.y + (at.y - after.y) }))
  }

  // ---- keyboard ---------------------------------------------------------
  const walk = (step: number) => {
    const list = graph.nodes.filter((n) => visible.has(n.page.slug))
    if (!list.length) return
    const at = list.findIndex((n) => n.index === pinned)
    const next = list[(at + step + list.length) % list.length] ?? list[0]
    focusNode(next.index)
  }

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      e.preventDefault()
      walk(1)
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      e.preventDefault()
      walk(-1)
    } else if (e.key === 'Enter' && probe) {
      e.preventDefault()
      navigate(`/brain/${probe.page.slug}`)
    } else if (e.key === 'Escape') {
      setPinned(null)
      setCamera(HOME)
    }
  }

  const lit = graph.nodes.filter((n) => visible.has(n.page.slug)).length

  // The panels sit inside the stage, so their clicks would otherwise read as
  // clicks on the map behind them — which would unpin the very page you are
  // reading before the button you pressed could do anything.
  const stop = (e: React.SyntheticEvent) => e.stopPropagation()
  const shield = {
    // Entering a panel means you have left the map; the hover reading should
    // not stick to whatever star the cursor crossed on the way here.
    onPointerEnter: () => setHover(null),
    onPointerDown: stop,
    onPointerMove: stop,
    onPointerUp: stop,
    onWheel: stop,
    onDoubleClick: stop,
  }

  return (
    <div className="cortex">
      <div
        className="cortex__stage"
        ref={wrapRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={() => setHover(null)}
        onWheel={onWheel}
        onDoubleClick={() => {
          setCamera(HOME)
          setPinned(null)
        }}
        onKeyDown={onKeyDown}
        role="application"
        tabIndex={0}
        aria-label="Map of the wiki. Arrow keys move between pages, Enter opens the focused page, Escape resets the view."
      >
        <canvas ref={canvasRef} className="cortex__canvas" />

        <p className="cortex__legend">
          <b>{lit}</b> of {graph.nodes.length} pages · {graph.edges.length} links · drag to pan ·
          scroll to zoom · click a star
        </p>

        <div className="cortex__zoom" role="group" aria-label="Zoom" {...shield}>
          <button type="button" onClick={() => setCamera((c) => clampCamera({ ...c, zoom: c.zoom * 1.3 }))}>
            +
          </button>
          <button type="button" onClick={() => setCamera((c) => clampCamera({ ...c, zoom: c.zoom / 1.3 }))}>
            −
          </button>
          <button
            type="button"
            className="cortex__reset"
            onClick={() => {
              setCamera(HOME)
              setPinned(null)
            }}
          >
            RESET
          </button>
        </div>

        {lit === 0 && (
          <div className="cortex__empty" {...shield}>
            <p>Nothing on the map matches.</p>
            <button type="button" onClick={onClear}>
              CLEAR FILTERS
            </button>
          </div>
        )}

        {probe && (
          <div className="probe" {...shield}>
            <span className="probe__domain">
              <span className="jp" aria-hidden="true">
                {DOMAIN_KANA[probe.page.domain] ?? '書'}
              </span>
              {probe.page.domain}
            </span>
            <h2 className="probe__title">{probe.page.title}</h2>
            <p className="probe__meta">
              {probe.page.words.toLocaleString()} words · {probe.degree} links
              {probe.page.charts > 0 && ` · ${probe.page.charts} charts`}
              {probe.page.brief && ' · brief'}
            </p>
            {probe.page.knownFor && <p className="probe__blurb">{probe.page.knownFor}</p>}
            {probe.neighbours.length > 0 && (
              <div className="probe__links">
                <h3>Connects to</h3>
                <ul>
                  {probe.neighbours
                    .slice()
                    .sort((a, b) => graph.nodes[b].degree - graph.nodes[a].degree)
                    .slice(0, 6)
                    .map((n) => (
                      <li key={n}>
                        <button type="button" onClick={() => focusNode(n)}>
                          {graph.nodes[n].page.title}
                        </button>
                      </li>
                    ))}
                </ul>
              </div>
            )}
            <button
              type="button"
              className="probe__enter"
              onClick={() => navigate(`/brain/${probe.page.slug}`)}
            >
              ENTER →
            </button>
          </div>
        )}
      </div>

      <p className="cortex__live" aria-live="polite">
        {probe ? `${probe.page.title}, ${probe.page.domain}, ${probe.degree} links` : ''}
      </p>
    </div>
  )
}
