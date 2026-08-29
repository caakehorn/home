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
  load,
  solve,
  unpackSheath,
  yearToY,
} from '../core/data'
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
  /** Bumped when the GL scene exists, so the first state push is not dropped. */
  const [ready, setReady] = useState(0)

  /* ---- load ------------------------------------------------------------- */

  useEffect(() => {
    let live = true
    Promise.all([load<Structure>('core/structure.json'), load<Clock>('leviathan/clock.json')])
      .then(([structure, clock]) => {
        if (!live) return
        const sheath = unpackSheath(clock)
        const layout = solve(structure)
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

  const sceneRef = useRef<Scene | null>(null)
  const cameraRef = useRef(new Camera())
  const liveRef = useRef({ layers, bloom, win, motion, hover, selected, edge })
  liveRef.current = { layers, bloom, win, motion, hover, selected, edge }

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
    let told = 0
    let frames = 0

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
      const white: [number, number, number] = [1, 1, 1]
      const palette: Palette = {
        void: ink('--void', [0.01, 0.01, 0.03]).map((c) => c * 0.55) as [number, number, number],
        // Ten domains out of five accents: the second five are the same hues
        // lifted toward white, so they stay distinct in griptape and riot where
        // two of the accents collapse onto each other.
        domains: Array.from({ length: 10 }, (_, i) =>
          i < 5 ? accents[i] : mix(accents[i - 5], white, 0.5),
        ),
        families: [
          accents[1], // causal
          accents[3], // structural
          accents[2], // evidential
          accents[0], // affinity
          ink('--spot', [0.88, 0.11, 0.07]), // tension — the one constant across palettes
          mix(paper, white, 0.2), // other
        ],
        sent: mix(accents[4], white, 0.25),
        recv: accents[3],
        axis: mix(paper, white, 0.1),
        link: paper,
      }

      const vis: Visible = {
        sheath: live.layers.sheath,
        typed: live.layers.typed,
        untyped: live.layers.untyped,
        axis: live.layers.axis,
        bloom: live.bloom,
        sheathAlpha: live.selected === null ? 0.5 : 0.24,
        window: live.win ? [yearToY(live.win[0]), yearToY(live.win[1])] : null,
      }
      scene.draw(camera, w, h, palette, vis, live.motion ? dt : 0)

      if (now - told > 900) {
        setFps(Math.round((frames * 1000) / (now - told)))
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

  const drag = useRef<{ x: number; y: number; button: number } | null>(null)
  const lastPick = useRef(0)

  const onMove = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      const camera = cameraRef.current
      if (drag.current) {
        const dx = e.clientX - drag.current.x
        const dy = e.clientY - drag.current.y
        drag.current.x = e.clientX
        drag.current.y = e.clientY
        if (drag.current.button === 2 || e.shiftKey) camera.pan(dy * 0.8)
        else camera.orbit(dx * 0.006, -dy * 0.005)
        return
      }
      const scene = sceneRef.current
      if (!scene) return
      const now = performance.now()
      if (now - lastPick.current < 55) return
      lastPick.current = now
      const el = e.currentTarget
      const rect = el.getBoundingClientRect()
      const dpr = Math.min(2, window.devicePixelRatio || 1)
      const id = scene.pick(
        camera,
        Math.round((e.clientX - rect.left) * dpr),
        Math.round((e.clientY - rect.top) * dpr),
        el.width,
        el.height,
      )
      setHover(id >= 0 ? id : null)
    },
    [],
  )

  const structure = data?.structure
  const node = selected !== null && structure ? structure.nodes[selected] : null
  const hovered = hover !== null && structure ? structure.nodes[hover] : null

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
                drag.current = { x: e.clientX, y: e.clientY, button: e.button }
              }}
              onPointerUp={(e) => {
                const was = drag.current
                drag.current = null
                e.currentTarget.releasePointerCapture(e.pointerId)
                if (was && Math.hypot(e.clientX - was.x, e.clientY - was.y) < 4)
                  pick(hover ?? null)
              }}
              onPointerMove={onMove}
              onPointerLeave={() => {
                drag.current = null
                setHover(null)
              }}
              onContextMenu={(e) => e.preventDefault()}
              onWheel={(e) => cameraRef.current.dolly(e.deltaY > 0 ? 1.09 : 0.92)}
            />
          )}

          <div className="core__hud" aria-hidden="true">
            <span>
              {c.nodes} PAGES · {c.typed.toLocaleString()} ARGUED EDGES · {c.types} TYPES
            </span>
            <span>
              {noGl ? 'CANVAS 2D — NO SHEATH' : `134,348 MARKS · ${fps} FPS`}
            </span>
          </div>
          {hovered && (
            <div className="core__tip">
              <b>{hovered.n}</b>
              <span>
                {hovered.d} · {hovered.t === null ? 'undated' : year(hovered.t)}
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
              Click a page in the structure. Its argued edges light up and every claim it makes
              becomes readable below. Drag to orbit, shift-drag to travel up the years, scroll to
              close in.
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
