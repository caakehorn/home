import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Marquee } from '../components/Marquee'
import { Nav } from '../components/Nav'
import { SectionArt } from '../components/SectionArt'
import { SubHead } from '../components/Wordmark'
import { sectionBySlug } from '../content/sections'
import { usePortal } from '../state/usePortal'
import { Camera } from '../core/camera'
import { Fallback2D } from '../core/Fallback2D'
import {
  AXIS,
  adjacency,
  flyTo,
  groupsOf,
  load,
  solve,
  unpackSheath,
  yearToY,
} from '../core/data'
import { buildAxis, derive, shapeById } from '../core/axes'
import type { Adjacency, Clock, Layout, Sheath, Structure } from '../core/data'
import { STATE, Scene } from '../core/scene'
import type { Palette, Visible } from '../core/scene'
import './core.css'

/**
 * THE CORE — the whole corpus as one body.
 *
 * Every other room on this site is a *view*: the brain reads the pages, the
 * lattice draws a pedigree, LEVIATHAN racks thirty-seven instruments each
 * answering one question, the atlas replays a decade of movement. This is the
 * corpus as a single object, with time running up the middle of it.
 *
 * ---- what is actually being drawn -------------------------------------------
 *
 * The skeleton is the wiki's **typed** graph, and it is the reason this room
 * exists. Not `index.json.edges` — those 3,851 undirected wikilinks are the
 * flat graph, and they are here only as the dim haze in the background. The
 * structure is the 2,398 `connections`: nineteen relationship types, six of
 * them in inverse pairs whose counts match almost exactly, and **every single
 * edge carrying a sentence of prose saying why it exists.** That graph lives
 * only in each page's raw front-matter and nothing on this site has ever drawn
 * it. Selecting an edge prints its claim, whole and unabridged.
 *
 * The mass is the message record: 134,348 marks, one per message, at the height
 * of the day it was sent and the bearing of the minute it was sent at. The
 * thirty-eight months no export covers are drawn as rings the sheath does not
 * fill, at their true height, because a hole in an archive is not a quiet
 * stretch.
 *
 * ---- what the axis means, and what it does not ------------------------------
 *
 * Vertical is data. A page's height is the date the record gives it, and
 * nothing in the simulation is allowed to move it. Horizontal is a drawing:
 * pages are settled around their own ring of time by a force solver, and where
 * a page sits on that ring means nothing at all.
 *
 * Because 256 of the 519 pages have no documented range and are placed by the
 * earliest date their prose happens to name, and 89 by nothing better than when
 * the file was created, every node carries which rule placed it and the panel
 * says so out loud. A page floating at 1900 because it mentions a grandparent's
 * birth is not making the same claim as one with a date range on it.
 */

const section = sectionBySlug('core')!

const rgb = (hex: string, fallback: [number, number, number]): [number, number, number] => {
  const h = hex.trim()
  if (!h.startsWith('#')) return fallback
  const full = h.length === 4 ? h.slice(1).split('').map((c) => c + c).join('') : h.slice(1)
  const n = Number.parseInt(full, 16)
  if (!Number.isFinite(n)) return fallback
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]
}

const mix = (
  a: [number, number, number],
  b: [number, number, number],
  t: number,
): [number, number, number] => [
  a[0] + (b[0] - a[0]) * t,
  a[1] + (b[1] - a[1]) * t,
  a[2] + (b[2] - a[2]) * t,
]

const WHITE: [number, number, number] = [1, 1, 1]

/**
 * Lift a colour until it can be seen on a black ground.
 *
 * RIOT is two inks — spot red and toner — so three of its five accents are
 * near-black, and a near-black line drawn additively onto a near-black canvas
 * is not a line. Every channel the scene uses goes through here first, which
 * costs a little saturation in the dark palettes and is the difference between
 * a legend that matches the picture and one that lies about it.
 */
const lift = (c: [number, number, number], floor: number): [number, number, number] => {
  const peak = Math.max(c[0], c[1], c[2])
  return peak >= floor ? c : mix(c, WHITE, (floor - peak) / (1 - peak + 1e-6))
}

const FAMILY_ORDER = ['causal', 'structural', 'evidential', 'affinity', 'tension', 'other']
const FAMILY_SAYS: Record<string, string> = {
  causal: 'this made that happen, or came before it',
  structural: 'this is part of that, or an instance of it',
  evidential: 'this is the evidence for that',
  affinity: 'these turn up together, or rhyme',
  tension: 'these two disagree',
  other: 'unfamilied',
}

const year = (t: number) => {
  const y = Math.floor(t)
  const m = Math.round((t - y) * 12) + 1
  return `${y}-${String(Math.min(12, Math.max(1, m))).padStart(2, '0')}`
}

type Filters = {
  domains: Set<string>
  families: Set<string>
  types: Set<string>
  status: Set<string>
}

const EMPTY: Filters = { domains: new Set(), families: new Set(), types: new Set(), status: new Set() }

/**
 * A finger, not a mouse.
 *
 * This room was built and checked with a pointing device, and every one of its
 * gestures assumed one: selection read a hover state that a touchscreen never
 * sets, zoom was the wheel and nothing else, and travelling the years wanted a
 * shift key. Read once at module scope — a device does not grow a mouse
 * mid-session, and the two places that care (the pick radius and the sentence
 * that tells you what the gestures are) do not need to react.
 */
const COARSE =
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(pointer: coarse)').matches

/** How far from the pointer a node still counts as picked, in CSS pixels. */
const PICK_R = COARSE ? 22 : 6

export function CoreRoute() {
  // Slugs carry slashes (`people/annie-ulmer`), so the route is a splat and the
  // focused page is whatever follows `/core/`.
  const focus = useParams()['*'] || ''
  const navigate = useNavigate()
  const { motion, vibe } = usePortal()

  const [data, setData] = useState<{
    structure: Structure
    sheath: Sheath
    layout: Layout
    adj: Adjacency
  } | null>(null)
  const [claims, setClaims] = useState<string[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [noGl, setNoGl] = useState(false)

  const [selected, setSelected] = useState<number | null>(null)
  const [edge, setEdge] = useState<number | null>(null)
  const [hover, setHover] = useState<number | null>(null)
  const [filters, setFilters] = useState<Filters>(EMPTY)
  const [query, setQuery] = useState('')
  const [win, setWin] = useState<[number, number] | null>(null)
  const [playing, setPlaying] = useState(false)
  const [layers, setLayers] = useState({ sheath: true, typed: true, untyped: false, axis: true })
  const [bloom, setBloom] = useState(0.85)
  const [fps, setFps] = useState(0)
  /** How much of the record is drawn. Dropped automatically on a slow device. */
  const [fraction, setFraction] = useState(1)
  /** Bumped when the GL scene exists, so the first state push is not dropped. */
  const [ready, setReady] = useState(0)

  /* ---- load ------------------------------------------------------------- */

  useEffect(() => {
    let live = true
    Promise.all([load<Structure>('core/structure.json'), load<Clock>('leviathan/clock.json')])
      .then(([structure, clock]) => {
        if (!live) return
        const sheath = unpackSheath(clock)
        const layout = solve(structure, {
          axis: buildAxis(structure, 'year', 'linear', derive(structure)),
          shape: shapeById('column'),
          groups: groupsOf(structure),
          sheath: true,
        })
        setData({ structure, sheath, layout, adj: adjacency(structure) })
      })
      .catch((e: Error) => live && setError(e.message))
    return () => {
      live = false
    }
  }, [])

  // The claims are half a megabyte of prose and nothing needs them until
  // somebody selects an edge, so they arrive on their own schedule.
  useEffect(() => {
    if (edge === null || claims) return
    load<{ claims: string[] }>('core/claims.json')
      .then((c) => setClaims(c.claims))
      .catch(() => setClaims([]))
  }, [edge, claims])

  /* ---- the deep link ----------------------------------------------------- */

  useEffect(() => {
    if (!data || !focus) return
    const i = data.structure.nodes.findIndex((n) => n.s === focus)
    if (i >= 0) setSelected(i)
  }, [data, focus])

  /* ---- what is visible --------------------------------------------------- */

  /** Which raw corpora each page cites, and how often. */
  const rootsFor = useMemo(() => {
    if (!data) return new Map<number, [string, number][]>()
    const m = new Map<number, [string, number][]>()
    for (const [node, root, n] of data.structure.nodeRoots) {
      const list = m.get(node) ?? []
      list.push([data.structure.roots[root].id, n])
      m.set(node, list)
    }
    for (const list of m.values()) list.sort((a, b) => b[1] - a[1])
    return m
  }, [data])

  const matches = useMemo(() => {
    if (!data) return null
    const q = query.trim().toLowerCase()
    const on = new Uint8Array(data.structure.nodes.length)
    data.structure.nodes.forEach((n, i) => {
      if (filters.domains.size && !filters.domains.has(n.d)) return
      if (filters.status.size && !filters.status.has(n.st)) return
      if (q && !n.n.toLowerCase().includes(q) && !n.s.toLowerCase().includes(q)) return
      on[i] = 1
    })
    return on
  }, [data, filters, query])

  /**
   * The matches, as a list you can touch.
   *
   * Searching lit the right pages in the structure and left you to find them —
   * which on a phone means hitting a four-pixel dot in a cloud of 519. Naming
   * them is the other half of selecting one. Titles that begin with what you
   * typed come first; the rest are alphabetical, so the order is a rule and not
   * a ranking.
   */
  const found = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q || !data || !matches) return []
    const nodes = data.structure.nodes
    const hits: number[] = []
    for (let i = 0; i < matches.length; i++) if (matches[i]) hits.push(i)
    hits.sort((a, b) => {
      const na = nodes[a].n.toLowerCase()
      const nb = nodes[b].n.toLowerCase()
      const pa = na.startsWith(q) ? 0 : 1
      const pb = nb.startsWith(q) ? 0 : 1
      return pa !== pb ? pa - pb : na.localeCompare(nb)
    })
    return hits
  }, [data, matches, query])

  const sceneRef = useRef<Scene | null>(null)
  const cameraRef = useRef(new Camera())
  const liveRef = useRef({ layers, bloom, win, motion, hover, selected, edge, fraction })
  liveRef.current = { layers, bloom, win, motion, hover, selected, edge, fraction }

  /** Push node and edge states into the lookup textures. */
  useEffect(() => {
    const scene = sceneRef.current
    if (!scene || !data || !matches) return
    const { structure, adj } = data
    const nodes = scene.nodeStates
    const edges = scene.edgeStates

    const near = new Set<number>()
    if (selected !== null) {
      near.add(selected)
      for (const e of adj.out[selected]) near.add(structure.typed[e][1])
      for (const e of adj.in[selected]) near.add(structure.typed[e][0])
    }

    for (let i = 0; i < structure.nodes.length; i++) {
      if (!matches[i]) nodes[i] = STATE.hidden
      else if (selected === null) nodes[i] = hover === i ? STATE.lit : STATE.on
      else if (i === selected || hover === i) nodes[i] = STATE.lit
      else if (near.has(i)) nodes[i] = STATE.on
      else nodes[i] = STATE.dim
    }

    for (let e = 0; e < structure.typed.length; e++) {
      const [from, to, typeIdx] = structure.typed[e]
      const type = structure.types[typeIdx]
      let state: number = STATE.dim
      if (!matches[from] || !matches[to]) state = STATE.hidden
      else if (filters.families.size && !filters.families.has(type.family)) state = STATE.hidden
      else if (filters.types.size && !filters.types.has(type.id)) state = STATE.hidden
      else if (edge === e) state = STATE.lit
      else if (selected !== null && (from === selected || to === selected)) state = STATE.on
      else if (selected === null) state = STATE.on
      edges[e] = state
    }
    scene.pushStates()
  }, [data, matches, selected, hover, edge, filters, ready])

  /* ---- the loop ---------------------------------------------------------- */

  const canvas = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    if (!data || noGl) return
    const el = canvas.current
    if (!el) return
    const gl = el.getContext('webgl2', {
      antialias: false,
      alpha: false,
      powerPreference: 'high-performance',
      preserveDrawingBuffer: false,
    })
    if (!gl) {
      setNoGl(true)
      return
    }

    let scene: Scene
    try {
      scene = new Scene(gl, data.structure, data.layout, data.sheath)
    } catch (e) {
      console.error(e)
      setNoGl(true)
      return
    }
    sceneRef.current = scene
    setReady((n) => n + 1)

    const camera = cameraRef.current
    camera.goal.height = yearToY(2016)
    camera.goal.distance = 560
    camera.snap()

    const lost = (e: Event) => {
      e.preventDefault()
      setNoGl(true)
    }
    el.addEventListener('webglcontextlost', lost)

    let raf = 0
    let last = performance.now()
    // Measured from here, not from zero. `told = 0` made the first window "since
    // the page loaded", which reads as a couple of frames per second and
    // degraded a fast machine before it had drawn anything at all.
    const started = last
    let told = last
    let frames = 0
    let eased = 0
    let quick = 0

    const frame = (now: number) => {
      raf = requestAnimationFrame(frame)
      const dt = Math.min(0.1, (now - last) / 1000)
      last = now
      frames++

      const dpr = Math.min(2, window.devicePixelRatio || 1)
      const rect = el.getBoundingClientRect()
      const w = Math.max(2, Math.round(rect.width * dpr))
      const h = Math.max(2, Math.round(rect.height * dpr))
      if (el.width !== w || el.height !== h) {
        el.width = w
        el.height = h
      }

      const live = liveRef.current
      if (live.motion) camera.goal.azimuth += dt * 0.028
      camera.step(dt, live.motion)
      camera.frame(w / h)

      const style = getComputedStyle(el)
      const ink = (t: string, f: [number, number, number]) =>
        rgb(style.getPropertyValue(t), f)
      const accents: [number, number, number][] = [
        ink('--n1', [0.69, 0.15, 1]),
        ink('--n2', [1, 0, 0.66]),
        ink('--n3', [0.62, 1, 0]),
        ink('--n4', [0, 0.9, 1]),
        ink('--n5', [1, 0.9, 0]),
      ]
      const paper = ink('--paper', [0.91, 0.89, 0.83])
      const palette: Palette = {
        // The mount is dark in every palette, for the reason THE CLOCK's is:
        // this is an additive exposure, and RIOT's `--void` is paper. Adding
        // scene light onto newsprint is not light. The room around the canvas
        // still follows the palette; the canvas itself never does.
        void: [0.012, 0.012, 0.028],
        // Ten domains out of five accents, on a continuous lightness ramp
        // rather than two tiers — GRIPTAPE collapses two accents onto each
        // other and RIOT collapses four, so hue alone cannot separate ten.
        domains: Array.from({ length: 10 }, (_, i) =>
          lift(mix(accents[i % 5], WHITE, (i / 9) * 0.7), 0.5),
        ),
        families: [
          lift(accents[1], 0.62), // causal
          lift(accents[3], 0.62), // structural
          lift(accents[2], 0.62), // evidential
          lift(accents[0], 0.62), // affinity
          lift(ink('--spot', [0.88, 0.11, 0.07]), 0.7), // tension — the one constant colour
          lift(mix(paper, WHITE, 0.2), 0.7), // other
        ],
        sent: lift(mix(accents[4], WHITE, 0.25), 0.7),
        recv: lift(accents[3], 0.7),
        axis: lift(mix(paper, WHITE, 0.1), 0.6),
        link: lift(paper, 0.6),
      }

      const vis: Visible = {
        sheath: live.layers.sheath,
        typed: live.layers.typed,
        untyped: live.layers.untyped,
        axis: live.layers.axis,
        bloom: live.bloom,
        sheathAlpha: live.selected === null ? 0.5 : 0.24,
        sheathFraction: live.fraction,
        window: live.win
          ? [
              (live.win[0] - AXIS.from) / (AXIS.to - AXIS.from),
              (live.win[1] - AXIS.from) / (AXIS.to - AXIS.from),
            ]
          : null,
      }
      scene.draw(camera, w, h, palette, vis, live.motion ? dt : 0)

      if (now - told > 900) {
        const rate = Math.round((frames * 1000) / (now - told))
        setFps(rate)
        // Software GL and integrated parts cannot hold 134,000 additive points.
        // Rather than crawl, draw a smaller unbiased sample and say so. One
        // step at a time with a cooldown, so the picture settles instead of
        // thrashing while each step is still being measured.
        //
        // It climbs back, and it ignores the first two seconds. Shader
        // compilation and the force solve are not the steady-state frame rate,
        // and a ladder that only went down meant one stall at load left a phone
        // that can hold the whole record drawing a sixteenth of it for the rest
        // of the session. Three good seconds to go up, one bad one to come down:
        // slower to trust a machine than to doubt it.
        if (now - started > 2000) {
          if (rate < 24 && now - eased > 2600) {
            eased = now
            quick = 0
            setFraction((f) => Math.max(0.0625, f / 2))
          } else if (rate > 52 && live.fraction < 1) {
            quick++
            if (quick >= 3 && now - eased > 2600) {
              eased = now
              quick = 0
              setFraction((f) => Math.min(1, f * 2))
            }
          } else if (rate <= 52) quick = 0
        }
        frames = 0
        told = now
      }
    }
    raf = requestAnimationFrame(frame)

    return () => {
      cancelAnimationFrame(raf)
      el.removeEventListener('webglcontextlost', lost)
      sceneRef.current = null
    }
  }, [data, noGl, vibe])

  /* ---- the time sweep ---------------------------------------------------- */

  useEffect(() => {
    if (!playing || !motion) return
    const id = window.setInterval(() => {
      setWin((w) => {
        if (!w) return w
        const width = w[1] - w[0]
        const next = w[1] + 0.55
        if (next > AXIS.to) return [AXIS.from, AXIS.from + width]
        return [next - width, next]
      })
    }, 60)
    return () => window.clearInterval(id)
  }, [playing, motion])

  useEffect(() => {
    if (!motion) setPlaying(false)
  }, [motion])

  /* ---- pointer ----------------------------------------------------------- */

  /**
   * Every pointer currently down, by id.
   *
   * One entry is a drag: orbit, or pan with shift or the right button. Two is a
   * pinch: the distance between them is the dolly and the midpoint is the
   * travel, which is the pair of gestures every map application has already
   * taught everybody. A single ref holding one drag could not express the
   * second case at all, which is why touch had no zoom.
   */
  const pointers = useRef(new Map<number, { x: number; y: number }>())
  /** The live two-finger gesture: the span between the fingers and their middle. */
  const gesture = useRef<{ dist: number; midY: number } | null>(null)
  /** Where the first finger went down, so a tap can be told from a drag. */
  const tap = useRef<{ x: number; y: number; multi: boolean } | null>(null)
  const lastPick = useRef(0)

  /** What is under a point on the page, in node indices. −1 for nothing. */
  const pickAt = useCallback((el: HTMLCanvasElement, clientX: number, clientY: number) => {
    const scene = sceneRef.current
    if (!scene) return -1
    const rect = el.getBoundingClientRect()
    const dpr = Math.min(2, window.devicePixelRatio || 1)
    return scene.pick(
      cameraRef.current,
      Math.round((clientX - rect.left) * dpr),
      Math.round((clientY - rect.top) * dpr),
      el.width,
      el.height,
      PICK_R * dpr,
    )
  }, [])

  const onMove = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      const camera = cameraRef.current
      const live = pointers.current.get(e.pointerId)

      // Nothing is down: this is a mouse looking around. Throttled, because a
      // pick costs a draw call and a readback.
      if (!live) {
        if (!sceneRef.current) return
        const now = performance.now()
        if (now - lastPick.current < 55) return
        lastPick.current = now
        const id = pickAt(e.currentTarget, e.clientX, e.clientY)
        setHover(id >= 0 ? id : null)
        return
      }

      const dx = e.clientX - live.x
      const dy = e.clientY - live.y
      live.x = e.clientX
      live.y = e.clientY

      if (pointers.current.size >= 2) {
        const [a, b] = [...pointers.current.values()]
        const dist = Math.max(1, Math.hypot(a.x - b.x, a.y - b.y))
        const midY = (a.y + b.y) / 2
        const was = gesture.current
        if (was) {
          camera.dolly(was.dist / dist)
          camera.pan((midY - was.midY) * 0.8)
        }
        gesture.current = { dist, midY }
        if (tap.current) tap.current.multi = true
        return
      }

      // Dragging down travels up the years, which is the direction the sheath
      // moves under your finger. Shift or the right button does it with a mouse.
      if (e.shiftKey || (e.buttons & 2) === 2) camera.pan(dy * 0.8)
      else camera.orbit(dx * 0.006, -dy * 0.005)
    },
    [pickAt],
  )

  const structure = data?.structure
  const node = selected !== null && structure ? structure.nodes[selected] : null
  const hovered = hover !== null && structure ? structure.nodes[hover] : null
  // On a phone the panel that names what you picked is below the fold, so the
  // tip falls back to the selection: a tap answers itself, on the canvas.
  const tipped = hovered ?? node

  const pick = useCallback(
    (i: number | null) => {
      setSelected(i)
      setEdge(null)
      if (i !== null && data) {
        flyTo(cameraRef.current, data.layout, i)
        navigate(`/core/${data.structure.nodes[i].s}`, { replace: true })
      } else navigate('/core', { replace: true })
    },
    [data, navigate],
  )

  /**
   * A pointer came up.
   *
   * Selection used to read the `hover` state, which only `onMove` ever set —
   * so on a touchscreen, where no move precedes a tap, every tap read `null`
   * and *cleared* the selection. Picking at the release coordinates fixes touch
   * and also fixes the mouse click that outruns the 55 ms hover throttle.
   */
  const endPointer = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>, select: boolean) => {
      const el = e.currentTarget
      pointers.current.delete(e.pointerId)
      if (el.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId)
      if (pointers.current.size < 2) gesture.current = null
      // Still fingers down — the gesture is not over, so nothing has been tapped.
      if (pointers.current.size > 0) return
      const t = tap.current
      tap.current = null
      if (!select || !t || t.multi) return
      if (Math.hypot(e.clientX - t.x, e.clientY - t.y) > 6) return
      const id = pickAt(el, e.clientX, e.clientY)
      setHover(id >= 0 ? id : null)
      pick(id >= 0 ? id : null)
    },
    [pick, pickAt],
  )

  /* ---- the zoom and travel pad ------------------------------------------- */

  // A gesture nobody finds is not a feature. These are real buttons, so a
  // keyboard reaches the camera for the first time as well.
  const holding = useRef(0)
  const hold = useCallback((fn: () => void) => {
    fn()
    window.clearInterval(holding.current)
    holding.current = window.setInterval(fn, 70)
  }, [])
  const release = useCallback(() => window.clearInterval(holding.current), [])
  useEffect(() => () => window.clearInterval(holding.current), [])

  /* ---- render ------------------------------------------------------------ */

  if (error)
    return (
      <Room>
        <p className="core__state">
          The structure is missing ({error}). Run <code>npm run core</code> and rebuild.
        </p>
      </Room>
    )

  if (!data || !structure)
    return (
      <Room>
        <p className="core__state">
          <span className="jp" aria-hidden="true">
            構築中
          </span>{' '}
          SETTLING 519 PAGES AND 134,348 MESSAGES…
        </p>
      </Room>
    )

  const c = structure.counts
  const toggle = (key: keyof Filters, value: string) =>
    setFilters((f) => {
      const next = new Set(f[key])
      if (next.has(value)) next.delete(value)
      else next.add(value)
      return { ...f, [key]: next }
    })

  const outgoing = selected === null ? [] : data.adj.out[selected]
  const incoming = selected === null ? [] : data.adj.in[selected]

  return (
    <Room>
      <header className="wrap core__masthead">
        <h1 className="core__title">
          <SubHead>THE CORE</SubHead>
        </h1>
        <span className="core__kana jp" aria-hidden="true">
          {section.kana}
        </span>
        <p className="core__note">{section.blurb}</p>
        <p className="core__rule">
          <b>VERTICAL IS DATA. HORIZONTAL IS A DRAWING.</b> A page&apos;s height is the date the
          record gives it and nothing moves it. Where it sits on its own ring of time was chosen by
          a force solver and means nothing — {c.nodes} pages settled around{' '}
          {c.typed.toLocaleString()} argued edges.
        </p>
      </header>

      <div className="wrap core__stage">
        <div className="core__mount">
          {noGl ? (
            <Fallback2D
              structure={structure}
              layout={data.layout}
              selected={selected}
              onSelect={pick}
            />
          ) : (
            <canvas
              ref={canvas}
              className="core__canvas"
              onPointerDown={(e) => {
                e.currentTarget.setPointerCapture(e.pointerId)
                pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
                if (pointers.current.size === 1) {
                  tap.current = { x: e.clientX, y: e.clientY, multi: false }
                  gesture.current = null
                } else {
                  // A second finger: this is a pinch, and whatever happens next
                  // it is not a tap.
                  if (tap.current) tap.current.multi = true
                  const [a, b] = [...pointers.current.values()]
                  gesture.current = {
                    dist: Math.max(1, Math.hypot(a.x - b.x, a.y - b.y)),
                    midY: (a.y + b.y) / 2,
                  }
                }
              }}
              onPointerUp={(e) => endPointer(e, true)}
              onPointerCancel={(e) => endPointer(e, false)}
              onPointerMove={onMove}
              onPointerLeave={() => setHover(null)}
              onContextMenu={(e) => e.preventDefault()}
              onWheel={(e) => cameraRef.current.dolly(e.deltaY > 0 ? 1.09 : 0.92)}
            />
          )}

          <div className="core__hud" aria-hidden="true">
            <span>
              {c.nodes} PAGES · {c.typed.toLocaleString()} ARGUED EDGES · {c.types} TYPES
            </span>
            <span>
              {noGl
                ? 'CANVAS 2D — NO SHEATH'
                : fraction < 1
                  ? `${Math.round(134348 * fraction).toLocaleString()} OF 134,348 MARKS — 1 IN ${Math.round(1 / fraction)} · ${fps} FPS`
                  : `134,348 MARKS · ${fps} FPS`}
            </span>
          </div>
          {!noGl && (
            <div className="core__pad">
              {(
                [
                  ['＋', 'Zoom in', () => cameraRef.current.dolly(0.92)],
                  ['－', 'Zoom out', () => cameraRef.current.dolly(1.087)],
                  ['↑', 'Travel up the years', () => cameraRef.current.pan(26)],
                  ['↓', 'Travel down the years', () => cameraRef.current.pan(-26)],
                ] as const
              ).map(([glyph, label, step]) => (
                <button
                  key={label}
                  type="button"
                  className="core__pad-btn"
                  aria-label={label}
                  title={label}
                  onPointerDown={() => hold(step)}
                  onPointerUp={release}
                  onPointerCancel={release}
                  onPointerLeave={release}
                  onBlur={release}
                  // `detail === 0` is a keyboard activation, which fires no
                  // pointerdown and so would otherwise do nothing at all.
                  onClick={(e) => {
                    if (e.detail === 0) step()
                  }}
                >
                  {glyph}
                </button>
              ))}
            </div>
          )}

          {tipped && (
            <div className="core__tip">
              <b>{tipped.n}</b>
              <span>
                {tipped.d} · {tipped.t === null ? 'undated' : year(tipped.t)}
              </span>
            </div>
          )}
        </div>

        <div className="core__controls">
          <div className="core__row">
            <input
              type="search"
              className="core__search"
              placeholder="find a page…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Find a page"
            />
            {(['sheath', 'typed', 'untyped', 'axis'] as const).map((k) => (
              <button
                key={k}
                type="button"
                className={`core__chip${layers[k] ? ' core__chip--on' : ''}`}
                aria-pressed={layers[k]}
                onClick={() => setLayers((l) => ({ ...l, [k]: !l[k] }))}
              >
                {k === 'sheath' ? 'THE SHEATH' : k === 'typed' ? 'THE ARGUMENT' : k === 'untyped' ? 'WIKILINKS' : 'AXIS'}
              </button>
            ))}
            <label className="core__slider">
              GLOW
              <input
                type="range"
                min={0}
                max={180}
                value={Math.round(bloom * 100)}
                onChange={(e) => setBloom(Number(e.target.value) / 100)}
              />
            </label>
          </div>

          {query.trim() && (
            <div className="core__found">
              {found.length === 0 ? (
                <span className="core__found-none">
                  no page is called anything like “{query.trim()}”
                </span>
              ) : (
                <>
                  {found.slice(0, 12).map((i) => (
                    <button
                      key={i}
                      type="button"
                      className={`core__found-hit${selected === i ? ' core__found-hit--on' : ''}`}
                      onClick={() => pick(i)}
                    >
                      {structure.nodes[i].n}
                    </button>
                  ))}
                  {found.length > 12 && (
                    <span className="core__found-none">
                      and {found.length - 12} more, lit in the structure
                    </span>
                  )}
                </>
              )}
            </div>
          )}

          <div className="core__row">
            <button
              type="button"
              className={`core__chip${win ? ' core__chip--on' : ''}`}
              aria-pressed={!!win}
              onClick={() => setWin((w) => (w ? null : [2015, 2020]))}
            >
              TIME WINDOW
            </button>
            {win && (
              <>
                <label className="core__slider">
                  {year(win[0])}
                  <input
                    type="range"
                    min={AXIS.from}
                    max={AXIS.to}
                    step={0.25}
                    value={win[0]}
                    onChange={(e) => setWin([Math.min(Number(e.target.value), win[1] - 0.5), win[1]])}
                  />
                </label>
                <label className="core__slider">
                  {year(win[1])}
                  <input
                    type="range"
                    min={AXIS.from}
                    max={AXIS.to}
                    step={0.25}
                    value={win[1]}
                    onChange={(e) => setWin([win[0], Math.max(Number(e.target.value), win[0] + 0.5)])}
                  />
                </label>
                <button
                  type="button"
                  className={`core__chip${playing ? ' core__chip--on' : ''}`}
                  aria-pressed={playing}
                  onClick={() => setPlaying((p) => !p)}
                  disabled={!motion}
                >
                  {playing ? '❚❚ SWEEPING' : '▶ SWEEP'}
                </button>
              </>
            )}
            <button
              type="button"
              className="core__chip"
              onClick={() => {
                const c = cameraRef.current
                // 1,900 units of column at a 0.9 rad field needs about this much
                // room, plus a margin so 1892 and 2027 are both inside the frame.
                c.goal.height = 0
                c.goal.distance = 2350
              }}
            >
              ⤢ THE WHOLE COLUMN
            </button>
            <button
              type="button"
              className="core__chip"
              onClick={() => {
                const c = cameraRef.current
                c.goal.height = yearToY(2016)
                c.goal.distance = 560
              }}
            >
              ⌖ THE RECORD
            </button>
            <button type="button" className="core__chip" onClick={() => pick(null)}>
              ⟲ CLEAR
            </button>
          </div>

          <div className="core__row core__row--wrap">
            {structure.domains.map((d, i) => (
              <button
                key={d.id}
                type="button"
                className={`core__tag${filters.domains.has(d.id) ? ' core__tag--on' : ''}`}
                aria-pressed={filters.domains.has(d.id)}
                style={{ ['--tag' as string]: `var(--n${(i % 5) + 1})` }}
                onClick={() => toggle('domains', d.id)}
              >
                {d.id} <i>{d.count}</i>
              </button>
            ))}
          </div>

          <div className="core__row core__row--wrap">
            {structure.facets.status.map((f) => (
              <button
                key={f.id}
                type="button"
                className={`core__tag${filters.status.has(f.id) ? ' core__tag--on' : ''}`}
                aria-pressed={filters.status.has(f.id)}
                style={{ ['--tag' as string]: 'var(--n5)' }}
                onClick={() => toggle('status', f.id)}
              >
                {f.id} <i>{f.n}</i>
              </button>
            ))}
          </div>

          <div className="core__row core__row--wrap">
            {FAMILY_ORDER.map((f) => {
              const n = structure.types
                .filter((t) => t.family === f)
                .reduce((a, t) => a + t.n, 0)
              if (!n) return null
              return (
                <button
                  key={f}
                  type="button"
                  className={`core__tag core__tag--${f}${filters.families.has(f) ? ' core__tag--on' : ''}`}
                  aria-pressed={filters.families.has(f)}
                  title={FAMILY_SAYS[f]}
                  onClick={() => toggle('families', f)}
                >
                  {f} <i>{n.toLocaleString()}</i>
                </button>
              )
            })}
          </div>
        </div>
      </div>

      <div className="wrap core__panels">
        <section className="core__panel">
          <h2 className="core__sub">
            {node ? 'THIS PAGE' : 'NOTHING SELECTED'}
          </h2>
          {!node && (
            <p className="core__say">
              {COARSE ? 'Tap' : 'Click'} a page in the structure — or type a name above and take it
              from the list. Its argued edges light up and every claim it makes becomes readable
              below.{' '}
              {COARSE
                ? 'Drag to orbit, pinch to close in, two fingers to travel the years. The pad on the picture does the same thing with buttons.'
                : 'Drag to orbit, shift-drag to travel up the years, scroll to close in.'}
            </p>
          )}
          {node && (
            <>
              <h3 className="core__name">{node.n}</h3>
              <dl className="core__facts">
                <div>
                  <dt>DOMAIN</dt>
                  <dd>{node.d} · {node.k} · {node.st}</dd>
                </div>
                <div>
                  <dt>PLACED AT</dt>
                  <dd>
                    {node.t === null ? 'nowhere — the record gives no date' : year(node.t)}{' '}
                    <i>
                      by{' '}
                      {['a documented range', 'a range with one end', 'its earliest dated mention',
                        'the day the file was made', 'nothing'][node.ts]}
                    </i>
                  </dd>
                </div>
                <div>
                  <dt>WEIGHT</dt>
                  <dd>
                    {node.w.toLocaleString()} words · {node.bl} in · {node.ol} out
                    {node.g > 0 && <i> · {node.g} declared gaps</i>}
                  </dd>
                </div>
              </dl>
              {rootsFor.get(node.i)?.length ? (
                <div className="core__roots">
                  <span className="core__roots-head">RESTS ON</span>
                  <span className="core__roots-list">
                    {rootsFor
                      .get(node.i)!
                      .map(([id, n]) => `${id}${n > 1 ? ` ×${n}` : ''}`)
                      .join(' · ')}
                  </span>
                  <span className="core__roots-say">
                    raw corpora this page cites. None of them ship — the citation is the record,
                    the file is not.
                  </span>
                </div>
              ) : null}
              <p className="core__links">
                <Link to={`/brain/${node.s}`}>READ THE PAGE →</Link>
                {node.g > 0 && <Link to="/docket">ITS {node.g} GAPS, IN ITS OWN WORDS →</Link>}
              </p>
            </>
          )}
        </section>

        <section className="core__panel">
          <h2 className="core__sub">
            {node
              ? `${outgoing.length} CLAIMS IT MAKES · ${incoming.length} MADE ABOUT IT`
              : 'THE NINETEEN RELATIONSHIPS'}
          </h2>
          {!node && (
            <ol className="core__types">
              {structure.types.map((t) => (
                <li key={t.id} className={`core__type core__type--${t.family}`}>
                  <button
                    type="button"
                    className={filters.types.has(t.id) ? 'core__type-btn core__type-btn--on' : 'core__type-btn'}
                    aria-pressed={filters.types.has(t.id)}
                    onClick={() => toggle('types', t.id)}
                  >
                    <span className="core__type-id">{t.id}</span>
                    <span className="core__type-n">{t.n}</span>
                    <span className="core__type-inv">
                      {t.symmetric ? 'symmetric' : t.inverse ? `↔ ${t.inverse}` : 'unpaired'}
                    </span>
                  </button>
                </li>
              ))}
            </ol>
          )}
          {node && (
            <ol className="core__edges">
              {[...outgoing.map((e) => [e, 'out'] as const), ...incoming.map((e) => [e, 'in'] as const)].map(
                ([e, way]) => {
                  const [from, to, typeIdx] = structure.typed[e]
                  const type = structure.types[typeIdx]
                  const other = structure.nodes[way === 'out' ? to : from]
                  return (
                    <li key={`${way}-${e}`}>
                      <button
                        type="button"
                        className={`core__edge core__edge--${type.family}${edge === e ? ' core__edge--on' : ''}`}
                        onClick={() => setEdge(edge === e ? null : e)}
                        onMouseEnter={() => setHover(way === 'out' ? to : from)}
                        onMouseLeave={() => setHover(null)}
                      >
                        <span className="core__edge-type">
                          {way === 'out' ? '→' : '←'} {type.id}
                        </span>
                        <span className="core__edge-to">{other.n}</span>
                      </button>
                      {edge === e && (
                        <div className="core__claim">
                          {claims ? (
                            <p>{claims[e]}</p>
                          ) : (
                            <p className="core__say">reading the claim…</p>
                          )}
                          <button
                            type="button"
                            className="core__chip"
                            onClick={() => pick(way === 'out' ? to : from)}
                          >
                            FOLLOW IT →
                          </button>
                        </div>
                      )}
                    </li>
                  )
                },
              )}
            </ol>
          )}
        </section>
      </div>

      <footer className="wrap core__foot">
        <p className="core__method">
          <b>WHAT IS DRAWN</b> The skeleton is the wiki&apos;s typed graph —{' '}
          {c.typed.toLocaleString()} connections in {c.types} relationship types, six of them in
          inverse pairs, each one carrying a sentence of prose asserting why it exists. That graph
          lives only in each page&apos;s raw front-matter: the field that looks like it holds it
          flattens every entry and drops both the type and the claim. The{' '}
          {c.untyped.toLocaleString()} untyped wikilinks are the haze behind it, off by default. The
          mass is 134,348 messages, one mark each, at the height of their day and the bearing of
          their minute — and the 38 months no export covers are rings the sheath does not fill,
          at their true height, because a hole in an archive is not a quiet stretch.
        </p>
        <p className="core__method">
          <b>WHAT IS NOT A MEASUREMENT</b> Only the vertical. 160 pages are placed by a documented
          date range; 256 by the earliest date their prose happens to name; 89 by nothing better
          than when the file was created; 6 by nothing at all, and they rest at the floor. Every
          page says which of those placed it. The horizontal placement is a force solver&apos;s
          opinion and encodes nothing. The bend in an edge is drawing, not direction — direction is
          the brightness running along it.
        </p>
        <p className="core__rule-line">
          Every number here is a count, a date or a length, taken over the whole corpus with
          nothing excluded and nothing weighted.
        </p>
      </footer>
    </Room>
  )
}

function Room({ children }: { children: React.ReactNode }) {
  return (
    <div className="core" style={{ ['--glow' as string]: `var(--n${section.accent})` }}>
      <Nav />
      <SectionArt slug="core" />
      <Marquee
        text={section.chant}
        duration={20}
        tone={section.accent}
        size="clamp(0.75rem, 1.6vw, 1.05rem)"
      />
      {children}
    </div>
  )
}
