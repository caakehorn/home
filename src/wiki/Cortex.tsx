import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { usePortal, useRig } from '../state/usePortal'
import { buildGraph, clampCamera, HOME, project, zoomedRadius, type Camera } from './graph'
import { boundsOf, constellationOf, MIN_FIGURE } from './constellation'
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
 *
 * ---- constellations ----------------------------------------------------
 *
 * Probing is a walk, and a walk has no memory: the moment you click the second
 * star the first one is gone. Shift-click PINS instead, and pinned stars stay
 * lit while the real edges between them light up as strands. Pin three that
 * the corpus genuinely joins up and the figure CLOSES — the map dims
 * everything else, flies to frame what you built, and ignites the strands
 * along it in reading order. See `./constellation.ts` for why that particular
 * condition is the one worth chasing.
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
    // The map draws its pages in whatever the palette says a mark is. On the
    // dark palettes that is the signage colour; on raw canvas a yellow dot
    // disappears, so UNTITLED overrides it with ink.
    ink: read('--graph-ink', '') || read('--n1', '#b026ff'),
    n2: read('--n2', '#ff2bd6'),
    n3: read('--n3', '#00eaff'),
    // The ghost-route ink. It has to be a hue neither the mesh (--ink) nor the
    // strands (--n3) are using, or "could be joined" and "is joined" read as
    // the same statement.
    n5: read('--n5', '#ffe500'),
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
  const { chaos, motion } = usePortal()
  const poke = useRig('CORTEX')
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const wrapRef = useRef<HTMLDivElement>(null)

  const graph = useMemo(() => buildGraph(index), [index])
  const [camera, setCamera] = useState<Camera>(HOME)
  const [hover, setHover] = useState<number | null>(null)
  const [pinned, setPinned] = useState<number | null>(null)
  /** The constellation, in pin order. Separate from `pinned`, which is the probe. */
  const [pins, setPins] = useState<number[]>([])

  const shown = hover ?? pinned
  const probe = shown === null ? null : graph.nodes[shown]

  const figure = useMemo(() => constellationOf(pins, graph), [pins, graph])

  /**
   * When the figure last closed.
   *
   * The draw loop lights the strands in sequence off this, so closing a
   * constellation is an event you watch happen rather than a state you find
   * yourself already in. Null whenever the figure is open.
   */
  const ignited = useRef<number | null>(null)
  const wasComplete = useRef(false)

  // The draw loop reads these without being rebuilt on every state change.
  const state = useRef({ camera, hover, pinned, visible, graph, chaos, domain, figure, ignited })
  state.current = { camera, hover, pinned, visible, graph, chaos, domain, figure, ignited }

  /** Move the camera so a node lands in the middle, at a readable zoom. */
  const focusNode = useCallback((i: number | null, zoom = 2.6) => {
    setPinned(i)
    if (i === null) return
    setCamera((c) => clampCamera({ x: state.current.graph.nodes[i].x, y: state.current.graph.nodes[i].y, zoom: Math.max(c.zoom, zoom) }))
  }, [])

  /**
   * Ease the camera to a target over ~520ms.
   *
   * Every other camera move on this map is a jump, which is right for "show me
   * that page" — you asked for somewhere specific and you want to be there.
   * Closing a figure is the opposite: nobody asked to move, so the move has to
   * be legible or the map appears to have thrown the reader somewhere. The
   * tween writes React state per frame rather than driving the canvas
   * directly, because the pointer maths reads `camera` from state and a
   * hit-test against a stale camera mid-flight would pick the wrong star.
   */
  const flight = useRef(0)
  const flyTo = useCallback((target: Camera) => {
    cancelAnimationFrame(flight.current)
    const from = state.current.camera
    const to = clampCamera(target)
    const start = performance.now()
    const DURATION = 520
    const step = (now: number) => {
      const p = Math.min(1, (now - start) / DURATION)
      // ease-out cubic: fast commit, soft arrival, no overshoot — an
      // overshooting camera reads as the map losing its place.
      const e = 1 - (1 - p) ** 3
      setCamera({
        x: from.x + (to.x - from.x) * e,
        y: from.y + (to.y - from.y) * e,
        zoom: from.zoom + (to.zoom - from.zoom) * e,
      })
      if (p < 1) flight.current = requestAnimationFrame(step)
    }
    flight.current = requestAnimationFrame(step)
  }, [])

  useEffect(() => () => cancelAnimationFrame(flight.current), [])

  /** Pin or unpin a star. Pinning the probed star is the common case. */
  const togglePin = useCallback((i: number) => {
    setPins((current) =>
      current.includes(i) ? current.filter((n) => n !== i) : [...current, i],
    )
    poke()
  }, [poke])

  const clearFigure = useCallback(() => {
    setPins([])
    ignited.current = null
  }, [])

  /*
   * The moment it closes.
   *
   * Framing the whole figure is the "reforms" half of the brief: the stars you
   * pinned are usually spread across lobes at a zoom where you can only see
   * two of them, so a figure that closes off-screen has not visibly closed at
   * all. The padding is generous and the zoom is capped — a two-star-wide
   * figure would otherwise fill the screen at zoom 7 and read as a crash.
   */
  useEffect(() => {
    if (figure.complete && !wasComplete.current) {
      ignited.current = performance.now()
      const b = boundsOf(figure.members, graph)
      const span = Math.max(b.w, b.h, 0.12)
      flyTo({ x: b.cx, y: b.cy, zoom: Math.min(3.4, 1.5 / span) })
    }
    if (!figure.complete) ignited.current = null
    wasComplete.current = figure.complete
  }, [figure.complete, figure.members, graph, flyTo])

  // A pinned page filtered off the map would be an invisible member of a
  // figure that then cannot be closed or understood. Dropping it is the only
  // honest option, and it is why filtering while building is not destructive:
  // the star comes back the moment the filter does.
  useEffect(() => {
    setPins((current) => {
      const kept = current.filter((i) => visible.has(graph.nodes[i].page.slug))
      return kept.length === current.length ? current : kept
    })
  }, [visible, graph])

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

    const calm = !motion
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
      const fig = state.current.figure
      const active = hov ?? pin

      // A still map costs nothing: redraw on change, and keep animating only
      // while something is lit and breathing. A figure on the map is always
      // breathing — the strands crawl — so it counts as lit.
      const next = `${cam.x},${cam.y},${cam.zoom},${active},${shownSet.size},${litDomain},${fig.members.join('.')},${fig.complete}`
      const still =
        next === signature && (calm || (active === null && fig.members.length === 0))
      signature = next
      if (still) {
        raf = requestAnimationFrame(draw)
        return
      }
      const { toScreen } = project(cam, width, height)
      const near = new Set<number>(active === null ? [] : g.nodes[active].neighbours)

      const pinSet = new Set(fig.members)
      // Pages sitting on a ghost route: not pinned, but named as the answer to
      // "what would join these two", so they must not be dimmed into the mesh.
      const onBridge = new Set<number>()
      for (const b of fig.bridges) for (const i of b.path) if (!pinSet.has(i)) onBridge.add(i)

      /*
       * How hard everything else recedes.
       *
       * An open figure only half-dims: you are still hunting, and the stars you
       * have not pinned yet are the candidates, so blacking them out would
       * remove the thing you are choosing from. A closed one dims hard, because
       * at that point the figure IS the content and the other 480 pages are
       * ground.
       */
      const recede = fig.members.length === 0 ? 1 : fig.complete ? 0.16 : 0.45

      // Ignition. Strand N lights at N * 90ms after the figure closed, in
      // track order, so a finished constellation draws itself along the path
      // you would read it in rather than snapping on all at once.
      const litFor = state.current.ignited.current
      const age = litFor === null ? Infinity : performance.now() - litFor
      const trackRank = new Map<number, number>()
      fig.track.forEach((n, i) => trackRank.set(n, i))
      const strandLit = (a: number, b: number) => {
        if (!fig.complete) return 1
        if (calm) return 1
        const rank = Math.max(trackRank.get(a) ?? 0, trackRank.get(b) ?? 0)
        return Math.max(0, Math.min(1, (age - rank * 90) / 260))
      }

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
      ctx.strokeStyle = mix(palette.ink, 0.1 * recede)
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

      /*
       * The probed star's own links, fanned out.
       *
       * Suppressed when the probed star is part of a CLOSED figure, and only
       * then. The fan and the strands are both drawn in --n3, so on a finished
       * constellation the fan puts twenty more acid lines through the three
       * you just earned and the figure stops being readable as a figure. On an
       * open one it is still the tool you are hunting with, and hovering a
       * star that is not in the figure keeps its fan either way.
       */
      if (active !== null && !(fig.complete && pinSet.has(active))) {
        const from = toScreen(g.nodes[active].x, g.nodes[active].y)
        ctx.strokeStyle = mix(palette.n3, 0.75 * Math.max(recede, 0.5))
        ctx.lineWidth = 1.4
        ctx.beginPath()
        for (const n of near) {
          const q = toScreen(g.nodes[n].x, g.nodes[n].y)
          ctx.moveTo(from.x, from.y)
          ctx.lineTo(q.x, q.y)
        }
        ctx.stroke()
      }

      /* ---- the ghost routes ------------------------------------------
       * What it would take to close the figure, drawn as a crawling dash
       * along the shortest real path through the corpus. Dashed and cadmium
       * so it never reads as a strand you have already earned: a bridge is a
       * proposal, and the difference between "this is joined" and "this could
       * be joined" is the entire information content of an open figure. */
      if (fig.bridges.length > 0) {
        ctx.save()
        ctx.setLineDash([5, 7])
        ctx.lineDashOffset = calm ? 0 : -t * 0.9
        // A soft wide underlay first, then the dash on top of it. A 1.6px
        // dashed line alone disappears into a mesh of 3,110 edges, and the
        // route is the one thing on an open figure worth reading.
        ctx.strokeStyle = mix(palette.n5, 0.13)
        ctx.lineWidth = 6
        ctx.setLineDash([])
        ctx.beginPath()
        for (const bridge of fig.bridges) {
          for (let i = 1; i < bridge.path.length; i++) {
            const a = toScreen(g.nodes[bridge.path[i - 1]].x, g.nodes[bridge.path[i - 1]].y)
            const b = toScreen(g.nodes[bridge.path[i]].x, g.nodes[bridge.path[i]].y)
            ctx.moveTo(a.x, a.y)
            ctx.lineTo(b.x, b.y)
          }
        }
        ctx.stroke()

        ctx.setLineDash([5, 7])
        ctx.strokeStyle = mix(palette.n5, 0.85)
        ctx.lineWidth = 2
        ctx.beginPath()
        for (const bridge of fig.bridges) {
          for (let i = 1; i < bridge.path.length; i++) {
            const a = toScreen(g.nodes[bridge.path[i - 1]].x, g.nodes[bridge.path[i - 1]].y)
            const b = toScreen(g.nodes[bridge.path[i]].x, g.nodes[bridge.path[i]].y)
            ctx.moveTo(a.x, a.y)
            ctx.lineTo(b.x, b.y)
          }
        }
        ctx.stroke()
        ctx.restore()
      }

      /* ---- the strands ------------------------------------------------
       * Real edges between two pinned stars. These are the figure. Drawn as a
       * wide soft underlay plus a hard core, which is the cheapest way to get
       * a line that reads as lit rather than as merely thick. */
      if (fig.strands.length > 0) {
        for (const [a, b] of fig.strands) {
          const lit = strandLit(a, b)
          if (lit <= 0) continue
          const p = toScreen(g.nodes[a].x, g.nodes[a].y)
          const q = toScreen(g.nodes[b].x, g.nodes[b].y)

          ctx.strokeStyle = mix(palette.n3, 0.16 * lit)
          ctx.lineWidth = 7
          ctx.beginPath()
          ctx.moveTo(p.x, p.y)
          ctx.lineTo(q.x, q.y)
          ctx.stroke()

          ctx.strokeStyle = mix(palette.n3, (fig.complete ? 0.95 : 0.7) * lit)
          ctx.lineWidth = fig.complete ? 2.2 : 1.7
          ctx.beginPath()
          ctx.moveTo(p.x, p.y)
          ctx.lineTo(q.x, q.y)
          ctx.stroke()
        }

        // A charge running along a closed figure, so it is alive rather than
        // merely finished. Open figures do not get one: nothing is flowing yet.
        if (fig.complete && !calm) {
          ctx.save()
          ctx.setLineDash([2, 26])
          ctx.lineDashOffset = -t * 2.4
          ctx.strokeStyle = mix(palette.text, 0.85)
          ctx.lineWidth = 2.6
          ctx.lineCap = 'round'
          ctx.beginPath()
          for (const [a, b] of fig.strands) {
            if (strandLit(a, b) < 1) continue
            const p = toScreen(g.nodes[a].x, g.nodes[a].y)
            const q = toScreen(g.nodes[b].x, g.nodes[b].y)
            ctx.moveTo(p.x, p.y)
            ctx.lineTo(q.x, q.y)
          }
          ctx.stroke()
          ctx.restore()
        }
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
        const isPinned = pinSet.has(node.index)
        const isBridge = onBridge.has(node.index)

        // `recede` applies to the mesh, never to what the figure is made of —
        // a pinned star at 16% opacity is a pinned star you cannot see.
        const back = isPinned || isBridge ? 1 : recede

        let fill = mix(palette.ink, (inSet ? 0.5 : 0.14) * back)
        if (inSet) fill = mix(palette.ink, (0.42 + Math.min(node.degree, 40) / 90) * back)
        if (isNear) fill = mix(palette.n3, 0.85 * Math.max(back, 0.5))
        if (isBridge) fill = mix(palette.n5, 0.9)
        if (isPinned) fill = palette.n3
        if (isActive) fill = palette.n2

        if (isActive || isNear || isPinned) {
          ctx.shadowColor = isActive ? palette.n2 : palette.n3
          ctx.shadowBlur = (isActive ? 22 : isPinned ? 16 : 10) * (0.5 + cha)
        }
        ctx.fillStyle = fill
        ctx.beginPath()
        ctx.arc(at.x, at.y, isActive || isPinned ? r + 2.5 + pulse * 2 : r, 0, Math.PI * 2)
        ctx.fill()
        ctx.shadowBlur = 0

        // A pinned star wears a hard ring — the one mark on this map that says
        // "you put this here" rather than "the corpus put this here".
        if (isPinned) {
          ctx.strokeStyle = mix(palette.n3, fig.complete ? 0.95 : 0.7)
          ctx.lineWidth = 2
          ctx.beginPath()
          ctx.arc(at.x, at.y, r + 6, 0, Math.PI * 2)
          ctx.stroke()

          // Its number in the figure: pin order while open, reading order once
          // closed — which is the whole point of closing it.
          const rank = (fig.complete ? fig.track : fig.members).indexOf(node.index)
          if (rank >= 0 && cam.zoom > 0.8) {
            ctx.save()
            ctx.textAlign = 'center'
            ctx.textBaseline = 'middle'
            ctx.font = `bold 9px ${palette.mono}`
            ctx.fillStyle = palette.n3
            ctx.fillText(String(rank + 1), at.x, at.y - r - 12)
            ctx.restore()
          }
        }

        // A candidate on a ghost route: hollow, because it is not yours yet.
        if (isBridge) {
          ctx.strokeStyle = mix(palette.n5, 0.8)
          ctx.lineWidth = 1.4
          ctx.beginPath()
          ctx.arc(at.x, at.y, r + 5, 0, Math.PI * 2)
          ctx.stroke()
        }

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
        // Named unconditionally: a figure whose stars you cannot read is a
        // pattern rather than an argument, and the bridge candidates are only
        // useful if you can see WHICH page would join the pieces.
        ...fig.members.map((i) => g.nodes[i]),
        ...[...onBridge].map((i) => g.nodes[i]),
        ...[...near].map((i) => g.nodes[i]).sort((a, b) => b.degree - a.degree).slice(0, 14),
        ...(cam.zoom > 1.3
          ? g.nodes
              .filter((n) => shownSet.has(n.page.slug) && zoomedRadius(n.radius, cam.zoom) > 8)
              .sort((a, b) => b.degree - a.degree)
          : []),
      ]

      const seenLabel = new Set<number>()
      for (const node of candidates) {
        if (seenLabel.has(node.index)) continue
        seenLabel.add(node.index)
        const isActive = node.index === active
        const isNear = near.has(node.index)
        const isPinned = pinSet.has(node.index)
        const isBridge = onBridge.has(node.index)
        const at = toScreen(node.x, node.y)
        if (at.x < -100 || at.y < -20 || at.x > width + 100 || at.y > height + 20) continue
        const r = zoomedRadius(node.radius, cam.zoom)
        const x = at.x + r + 6
        const y = at.y + 4
        const w = ctx.measureText(node.page.title).width
        // Members and candidates outrank the collision test: they are the
        // reason the map is in this state.
        if (!isActive && !isPinned && !isBridge && !fits(x, y, w)) continue
        placed.push({ x, y, w })
        ctx.fillStyle = isPinned
          ? palette.n3
          : isBridge
            ? (palette.n5)
            : isActive
              ? palette.text
              : mix(palette.text, (isNear ? 0.85 : 0.5) * recede)
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

    // Shift (or ⌘/Ctrl, which is the same gesture on the other muscle memory)
    // pins into the figure. A plain click still probes, because probing is the
    // thing people do ninety times for every once they build something.
    if (hit !== null && (e.shiftKey || e.metaKey || e.ctrlKey)) {
      togglePin(hit)
      setPinned(hit)
      return
    }

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
    } else if (e.key === 'p' || e.key === 'P') {
      // The keyboard equivalent of shift-click, on the star the arrows are on.
      if (pinned !== null) {
        e.preventDefault()
        togglePin(pinned)
      }
    } else if (e.key === 'Escape') {
      // Escape backs out one layer at a time rather than wiping everything:
      // losing a half-built figure to a keystroke meant for the probe would be
      // the most annoying thing on this page.
      if (pins.length > 0) {
        e.preventDefault()
        clearFigure()
        return
      }
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
          scroll to zoom · click a star · <b>shift-click to pin it</b>
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

        {/* ---- the panels --------------------------------------------------
            Three corners of the stage are already taken: the legend top-left,
            the zoom top-right, the probe bottom-left. The figure gets the
            fourth, which also happens to be the right reading: the probe is
            the star you are considering, the figure is what you have already
            committed to, and they sit at opposite ends of the same edge.

            `display: contents` on this wrapper means it does nothing at all on
            a wide screen — both panels keep their own absolute corners. Under
            720px it becomes a real flex column instead, because there is only
            one bottom edge on a phone and two panels claiming it is how you
            get a figure nobody can read behind a probe nobody asked for. */}
        <div className="cortex__panels">
        {pins.length > 0 && (
          <div className={`figure${figure.complete ? ' figure--closed' : ''}`} {...shield}>
            <header className="figure__head">
              <span className="figure__kana jp" aria-hidden="true">
                {figure.kana}
              </span>
              <div>
                <h2 className="figure__name">{figure.name}</h2>
                <p className="figure__state">
                  {figure.complete ? (
                    <>
                      CLOSED · {figure.members.length} stars · {figure.strands.length} strands
                    </>
                  ) : figure.members.length < MIN_FIGURE ? (
                    <>
                      {figure.members.length} of {MIN_FIGURE} · a figure needs three
                    </>
                  ) : (
                    <>
                      OPEN · {figure.components.length} pieces · not yet joined
                    </>
                  )}
                </p>
              </div>
            </header>

            <ol className="figure__stars">
              {(figure.complete ? figure.track : figure.members).map((i, rank) => (
                <li key={i}>
                  <button
                    type="button"
                    className="figure__star"
                    onClick={() => focusNode(i)}
                    title="Show this one on the map"
                  >
                    <b>{String(rank + 1).padStart(2, '0')}</b>
                    {graph.nodes[i].page.title}
                  </button>
                  <button
                    type="button"
                    className="figure__drop"
                    onClick={() => togglePin(i)}
                    aria-label={`Unpin ${graph.nodes[i].page.title}`}
                  >
                    ×
                  </button>
                </li>
              ))}
            </ol>

            {/* What is missing, named. This is the part that makes an open
                figure useful rather than merely unfinished. */}
            {figure.bridges.length > 0 && (
              <div className="figure__gap">
                <h3>
                  TO JOIN IT <span className="jp" aria-hidden="true">橋</span>
                </h3>
                {figure.bridges.map((bridge) => {
                  const between = bridge.path.slice(1, -1)
                  return (
                    <p key={`${bridge.from}-${bridge.to}`} className="figure__bridge">
                      {between.length === 0 ? (
                        <>Already touching — pin either end again to redraw.</>
                      ) : (
                        <>
                          <em>{graph.nodes[bridge.from].page.title}</em> reaches the rest through{' '}
                          {between.map((i, k) => (
                            <span key={i}>
                              {k > 0 && ' → '}
                              <button type="button" onClick={() => togglePin(i)}>
                                {graph.nodes[i].page.title}
                              </button>
                            </span>
                          ))}
                          .
                        </>
                      )}
                    </p>
                  )
                })}
              </div>
            )}

            <footer className="figure__foot">
              {figure.complete && (
                <button
                  type="button"
                  className="figure__read"
                  onClick={() => navigate(`/brain/${graph.nodes[figure.track[0]].page.slug}`)}
                >
                  READ THE TRACK →
                </button>
              )}
              <button type="button" className="figure__clear" onClick={clearFigure}>
                CLEAR
              </button>
            </footer>
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
              {probe.page.locked ? (
                'sealed · nothing about this page is on the map'
              ) : (
                <>
                  {probe.page.words.toLocaleString()} words · {probe.degree} links
                  {probe.page.charts > 0 && ` · ${probe.page.charts} charts`}
                  {probe.page.brief && ' · brief'}
                </>
              )}
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
            <div className="probe__actions">
              <button
                type="button"
                className={`probe__pin${pins.includes(probe.index) ? ' probe__pin--on' : ''}`}
                onClick={() => togglePin(probe.index)}
                aria-pressed={pins.includes(probe.index)}
              >
                <span className="jp" aria-hidden="true">
                  {pins.includes(probe.index) ? '解' : '留'}
                </span>
                {pins.includes(probe.index) ? 'UNPIN' : 'PIN'}
              </button>
              <button
                type="button"
                className="probe__enter"
                onClick={() => navigate(`/brain/${probe.page.slug}`)}
              >
                ENTER →
              </button>
            </div>
          </div>
        )}
        </div>
      </div>

      <p className="cortex__live" aria-live="polite">
        {figure.complete
          ? `Constellation closed: ${figure.name}, ${figure.members.length} pages joined by ${figure.strands.length} links.`
          : probe
            ? `${probe.page.title}, ${probe.page.domain}, ${probe.degree} links`
            : ''}
      </p>
    </div>
  )
}
