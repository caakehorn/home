import { useEffect, useMemo, useRef, useState } from 'react'
import { Frame } from '../Frame'
import { useSet, type AtlasSet, type Instrument } from '../core'
import { usePortal } from '../../state/usePortal'
import { colourWith } from '../ink'
import '../atlas.css'

/**
 * ◈ CORPUS IV · THE ATLAS
 *
 * A decade of movement over a hand-drawn corridor, replayed one day at a time.
 *
 * ---- the two modes, and why there are two ---------------------------------
 *
 * They answer different questions and neither can answer the other's.
 *
 * **CHASE** locks the camera on the subject at street scale and follows it
 * turn by turn, so a single day is legible: which door, at what hour, by
 * which road, and how long they stood there. At twelve seconds a day you can
 * read every movement in it. What you cannot see from inside it is the shape
 * of the decade — you are in the car.
 *
 * **BLOOM** never moves the camera and never clears the frame. Every road the
 * subject drives gains exposure, every door gains a glow, every town lights
 * when something in it is visited, and none of it fades. Run it for eleven
 * years and the corridor develops like a photographic plate: the places that
 * were entered a thousand times burn out to white, the ones entered twice
 * stay a smear, and the negative space — everywhere in two states that was
 * never once driven through — stays black. What you cannot see from inside
 * it is any particular Tuesday.
 *
 * ---- the rate ------------------------------------------------------------
 *
 * Eleven years is 3,927 days, 1,992 of which have movement on them, and those
 * two numbers are in tension: a day slow enough to read is a decade too long
 * to watch. So the rate is a control rather than a decision, every speed
 * prints what it costs in real time before you pick it, and there is a LOOP
 * DAY button that replays whatever day you are on at full twelve seconds
 * without re-timing the rest of the replay. Read one day; then watch the
 * decade at a fifth of a second each and see where it went.
 *
 * ---- what is drawn and what is counted ------------------------------------
 *
 * The counts are published — see the method note under the instrument. The
 * *day* is a reconstruction and the frame says so on every frame it draws.
 * The map is hand-drawn and says so too. Neither of those is a hedge: they
 * are the difference between this instrument and one that would be lying.
 */

type Mode = 'chase' | 'bloom'

/**
 * Seconds of real time per replayed day.
 *
 * The top of the range is the one a day can actually be read at — twenty
 * seconds is a day at roughly seventy-two times life, which is slow enough to
 * watch somebody drive to the CVS and back. The bottom is the one the decade
 * can be watched at: an eighth of a second a day puts 1,992 days of movement
 * on the plate in four minutes. Both are the instrument; neither is the
 * setting, which is why every chip prints what it costs.
 */
const SPEEDS = [
  { secs: 20, label: '20s' },
  { secs: 12, label: '12s' },
  { secs: 6, label: '6s' },
  { secs: 3, label: '3s' },
  { secs: 1.2, label: '1.2s' },
  { secs: 0.4, label: '0.4s' },
  { secs: 0.12, label: '0.12s' },
]

/** What LOOP THIS DAY holds a day at, whatever the reel is running. */
const LOOP_SECS = 12

/** Pin colours by what the wiki calls the place, not by any ranking of them. */
const KIND_INK: Record<string, string> = {
  home: '--n5',
  work: '--n2',
  family: '--n1',
  leisure: '--n4',
  errand: '--n3',
  local: '--n3',
  transit: '--n4',
  unnamed: '--text-dim',
}

/** Line weights by what the road is. A weight is a drawing, not a measurement. */
const ROAD_W: Record<string, number> = {
  interstate: 3.4,
  highway: 2.6,
  us: 2.2,
  state: 1.7,
  local: 1.2,
  crosstown: 1.3,
  avenue: 1.4,
  street: 0.9,
}

/** Where the camera rests in CHASE, per map. Pixels per metre. */
const CHASE_ZOOM: Record<string, number> = {
  manhattan: 0.42,
  brooklyn: 0.42,
  fayette: 0.085,
  corridor: 0.012,
}

const MX = 111320 * Math.cos((40 * Math.PI) / 180)
const MY = 111320

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n))
const hhmm = (m: number) =>
  `${String(Math.floor(clamp(m, 0, 1439) / 60)).padStart(2, '0')}:${String(Math.floor(clamp(m, 0, 1439)) % 60).padStart(2, '0')}`

/** Days are counted, never parsed: the same rule THE CLOCK gives. */
const isoOf = (dayNumber: number) => new Date(dayNumber * 86400000).toISOString().slice(0, 10)
const WEEKDAY = ['Thu', 'Fri', 'Sat', 'Sun', 'Mon', 'Tue', 'Wed']

const runtime = (seconds: number) => {
  if (seconds < 90) return `${Math.round(seconds)}s`
  if (seconds < 5400) return `${Math.round(seconds / 60)} min`
  const h = Math.floor(seconds / 3600)
  const m = Math.round((seconds % 3600) / 60)
  return m ? `${h}h ${m}m` : `${h}h`
}

// ---------------------------------------------------------------------------
// the world: everything derived from the dataset once, and nothing per frame

type Leg = { xy: Float64Array; cum: Float64Array; edges: number[]; metres: number }

function build(set: AtlasSet) {
  const N = set.nodes.length
  const nodeXY = new Float64Array(N * 2)
  for (let i = 0; i < N; i++) {
    nodeXY[i * 2] = set.nodes[i][0] * MX
    nodeXY[i * 2 + 1] = -set.nodes[i][1] * MY
  }
  const placeXY = new Float64Array(set.places.length * 2)
  set.places.forEach((p, i) => {
    placeXY[i * 2] = p.lon * MX
    placeXY[i * 2 + 1] = -p.lat * MY
  })
  const cityXY = new Float64Array(set.cities.length * 2)
  set.cities.forEach((c, i) => {
    cityXY[i * 2] = c.lon * MX
    cityXY[i * 2 + 1] = -c.lat * MY
  })

  // Which edge joins two nodes, so a route of nodes becomes a route of roads.
  const edgeAt = new Map<number, number>()
  set.edges.forEach(([a, b], i) => edgeAt.set(a < b ? a * N + b : b * N + a, i))

  // The nearest town to every pin, so a town can light when something in it is
  // visited. Nearest, and nothing else — no pin is assigned to a town it is
  // not closest to because the story would be tidier.
  const cityOf = set.places.map((_place, i) => {
    let best = 0
    let bestD = Infinity
    for (let c = 0; c < set.cities.length; c++) {
      const dx = placeXY[i * 2] - cityXY[c * 2]
      const dy = placeXY[i * 2 + 1] - cityXY[c * 2 + 1]
      const d = dx * dx + dy * dy
      if (d < bestD) {
        bestD = d
        best = c
      }
    }
    return Math.sqrt(bestD) < 12000 ? best : -1
  })

  const legs = new Map<string, Leg>()
  const legOf = (a: number, b: number): Leg => {
    const key = `${a}>${b}`
    const had = legs.get(key)
    if (had) return had

    const path = set.routes[a < b ? `${a}>${b}` : `${b}>${a}`]
    const nodes = path ? (a < b ? path : [...path].reverse()) : []
    const pts: number[] = [placeXY[a * 2], placeXY[a * 2 + 1]]
    const edges: number[] = []
    for (let i = 0; i < nodes.length; i++) {
      pts.push(nodeXY[nodes[i] * 2], nodeXY[nodes[i] * 2 + 1])
      if (i > 0) {
        const e = edgeAt.get(
          nodes[i - 1] < nodes[i] ? nodes[i - 1] * N + nodes[i] : nodes[i] * N + nodes[i - 1],
        )
        if (e !== undefined) edges.push(e)
      }
    }
    pts.push(placeXY[b * 2], placeXY[b * 2 + 1])

    const xy = Float64Array.from(pts)
    const cum = new Float64Array(xy.length / 2)
    for (let i = 1; i < cum.length; i++) {
      cum[i] =
        cum[i - 1] + Math.hypot(xy[i * 2] - xy[i * 2 - 2], xy[i * 2 + 1] - xy[i * 2 - 1])
    }
    const leg: Leg = { xy, cum, edges, metres: cum[cum.length - 1] }
    legs.set(key, leg)
    return leg
  }

  /**
   * Every day of the span, including the still ones.
   *
   * A day with no fix on it is not a day nobody moved — it is a day the export
   * has nothing for, and the two are not the same claim. It is drawn as a day
   * spent at whichever address was home, and it is labelled NO FIXES rather
   * than nothing.
   */
  const baseAt = (dayNumber: number) => {
    let base = set.bases[0]
    for (const b of set.bases) if (isoOf(dayNumber) >= b.since) base = b
    return base
  }
  const placeIndex = new Map(set.places.map((p, i) => [p.id, i]))
  const byDay = new Map(set.days.map((d) => [d.d, d]))
  const timeline: { d: number; s: number[]; still: boolean; move: boolean; trip: boolean }[] = []
  for (let d = 0; d < set.span.days; d++) {
    const had = byDay.get(d)
    if (had) {
      timeline.push({ d, s: had.s, still: false, move: had.move === 1, trip: had.trip === 1 })
    } else {
      const home = placeIndex.get(baseAt(set.span.from0 + d)?.place ?? '') ?? 0
      timeline.push({ d, s: [home, 0, 1440], still: true, move: false, trip: false })
    }
  }

  const bounds = (region: string) => {
    const r = set.regions.find((x) => x.id === region) ?? set.regions[set.regions.length - 1]
    return {
      x0: r.bounds[0] * MX,
      x1: r.bounds[2] * MX,
      y0: -r.bounds[3] * MY,
      y1: -r.bounds[1] * MY,
      name: r.name,
    }
  }

  return { set, nodeXY, placeXY, cityXY, cityOf, legOf, timeline, bounds, placeIndex }
}

// ---------------------------------------------------------------------------

export function Atlas({ instrument }: { instrument: Instrument }) {
  const { data, error, loading } = useSet<AtlasSet>('atlas.json')
  const { motion, vibe } = usePortal()

  const [mode, setMode] = useState<Mode>('chase')
  const [speed, setSpeed] = useState(3) // 3s a day
  const [playing, setPlaying] = useState(false)
  const [skipStill, setSkipStill] = useState(true)
  const [loopDay, setLoopDay] = useState(false)
  const [lock, setLock] = useState<string>('auto')
  const [tick, setTick] = useState({ i: 0, minute: 0, visits: 0 })

  const world = useMemo(() => (data ? build(data) : null), [data])

  /** The days the playhead actually walks: all of them, or only the ones with fixes. */
  const reel = useMemo(() => {
    if (!world) return [] as number[]
    const all = world.timeline.map((_, i) => i)
    return skipStill ? all.filter((i) => !world.timeline[i].still) : all
  }, [world, skipStill])

  // Everything the frame loop needs, in refs, so sixty frames a second do not
  // cost sixty renders.
  const at = useRef({ slot: 0, minute: 0 })
  const heat = useRef<{ edge: Float32Array; place: Float32Array; city: Float32Array; visits: number }>({
    edge: new Float32Array(0),
    place: new Float32Array(0),
    city: new Float32Array(0),
    visits: 0,
  })
  const burnt = useRef({ slot: -1, leg: 0 })
  const trailRef = useRef<{ day: number; pts: number[] }>({ day: -1, pts: [] })
  const cam = useRef({ x: 0, y: 0, k: 0, ready: false })
  const live = useRef({ mode, speed, playing, loopDay, lock, reel })
  live.current = { mode, speed, playing, loopDay, lock, reel }

  // Reset the plate whenever the reel changes underneath it.
  useEffect(() => {
    if (!world) return
    heat.current = {
      edge: new Float32Array(world.set.edges.length),
      place: new Float32Array(world.set.places.length),
      city: new Float32Array(world.set.cities.length),
      visits: 0,
    }
    burnt.current = { slot: -1, leg: 0 }
    trailRef.current = { day: -1, pts: [] }
    at.current = { slot: 0, minute: 0 }
    setTick({ i: 0, minute: 0, visits: 0 })
  }, [world, skipStill])

  /**
   * Expose the plate up to a moment.
   *
   * Forward is incremental. Backward is a full re-expose from the start of the
   * reel, which is the only honest way to rewind an accumulation: you cannot
   * un-burn a road, so the plate is thrown away and the light is run again.
   */
  const expose = useMemo(() => {
    if (!world) return () => {}
    return (slot: number, minute: number) => {
      const { edge, place, city } = heat.current
      const seat = live.current.reel
      /**
       * The road always takes the exposure — it was driven either way. The
       * *arrival* only counts when it is a visit, and the last arrival of a
       * day is the bed, which is not one. That is the same rule the build
       * counts by, and it is why the ledger beside the plate lands exactly on
       * the published numbers instead of a day-count above them.
       */
      const commitLeg = (from: number, to: number, counts: boolean) => {
        const leg = world.legOf(from, to)
        for (const e of leg.edges) edge[e] += 1
        if (!counts) return
        place[to] += 1
        const c = world.cityOf[to]
        if (c >= 0) city[c] += 1
        heat.current.visits += 1
      }
      const commitRest = (day: number, fromLeg: number) => {
        const s = world.timeline[day].s
        const stops = s.length / 3
        for (let k = fromLeg; k + 1 < stops; k++)
          commitLeg(s[k * 3], s[(k + 1) * 3], k + 2 < stops)
      }

      if (slot < burnt.current.slot) {
        edge.fill(0)
        place.fill(0)
        city.fill(0)
        heat.current.visits = 0
        burnt.current = { slot: -1, leg: 0 }
      }
      while (burnt.current.slot < slot) {
        if (burnt.current.slot >= 0)
          commitRest(seat[burnt.current.slot], burnt.current.leg)
        burnt.current.slot += 1
        burnt.current.leg = 0
      }
      const s = world.timeline[seat[slot]].s
      const stops = s.length / 3
      while (burnt.current.leg + 1 < stops && s[(burnt.current.leg + 1) * 3 + 1] <= minute) {
        commitLeg(
          s[burnt.current.leg * 3],
          s[(burnt.current.leg + 1) * 3],
          burnt.current.leg + 2 < stops,
        )
        burnt.current.leg += 1
      }
    }
  }, [world])

  // ---- the loop ------------------------------------------------------------
  const canvas = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    if (!world) return
    const el = canvas.current
    if (!el) return
    const ctx = el.getContext('2d')
    if (!ctx) return

    const style = getComputedStyle(el)
    const ink = (token: string, fallback: string) =>
      style.getPropertyValue(token).trim() || fallback
    const paper = ink('--paper', '#e8e2d4')
    const dim = ink('--text-dim', '#7f9470')
    const void$ = ink('--void', '#04040a')
    const accent = ink('--n3', '#9dff00')
    const hot = ink('--n5', '#ffe500')
    const water = ink('--n4', '#00e5ff')
    const kindInk: Record<string, string> = {}
    for (const [k, token] of Object.entries(KIND_INK)) kindInk[k] = ink(token, paper)

    let raf = 0
    let last = performance.now()
    let told = 0
    const { set } = world

    const frame = (now: number) => {
      raf = requestAnimationFrame(frame)
      const dt = Math.min(0.25, (now - last) / 1000)
      const trail = trailRef.current
      last = now
      const { playing: on, speed: sp, loopDay: loop, mode: m, lock: locked, reel: seat } = live.current
      if (!seat.length) return

      // ---- advance ---------------------------------------------------------
      if (on) {
        const perDay = loop ? LOOP_SECS : SPEEDS[sp].secs
        at.current.minute += (dt / perDay) * 1440
        while (at.current.minute >= 1440) {
          at.current.minute -= 1440
          if (loop) break
          at.current.slot += 1
          if (at.current.slot >= seat.length) {
            at.current.slot = seat.length - 1
            at.current.minute = 1439
            setPlaying(false)
            break
          }
        }
      }
      const slot = clamp(at.current.slot, 0, seat.length - 1)
      const minute = clamp(at.current.minute, 0, 1439)
      expose(slot, minute)

      // ---- where the subject is -------------------------------------------
      const day = world.timeline[seat[slot]]
      const s = day.s
      const stops = s.length / 3
      let x = world.placeXY[s[0] * 2]
      let y = world.placeXY[s[0] * 2 + 1]
      let speedMs = 0
      let onRoad = -1
      let standing = s[0]
      for (let k = 0; k < stops; k++) {
        const arrive = s[k * 3 + 1]
        const depart = s[k * 3 + 2]
        if (minute < arrive && k > 0) {
          const from = s[(k - 1) * 3]
          const to = s[k * 3]
          const leg = world.legOf(from, to)
          const left = s[(k - 1) * 3 + 2]
          const t = clamp((minute - left) / Math.max(1, arrive - left), 0, 1)
          const want = t * leg.metres
          let i = 1
          while (i < leg.cum.length - 1 && leg.cum[i] < want) i++
          const span = Math.max(1e-6, leg.cum[i] - leg.cum[i - 1])
          const f = clamp((want - leg.cum[i - 1]) / span, 0, 1)
          x = leg.xy[(i - 1) * 2] + (leg.xy[i * 2] - leg.xy[(i - 1) * 2]) * f
          y = leg.xy[(i - 1) * 2 + 1] + (leg.xy[i * 2 + 1] - leg.xy[(i - 1) * 2 + 1]) * f
          speedMs = leg.metres / Math.max(60, (arrive - left) * 60)
          onRoad = leg.edges.length ? leg.edges[clamp(i - 2, 0, leg.edges.length - 1)] : -1
          standing = -1
          break
        }
        if (minute <= depart) {
          x = world.placeXY[s[k * 3] * 2]
          y = world.placeXY[s[k * 3] * 2 + 1]
          standing = s[k * 3]
          break
        }
        x = world.placeXY[s[k * 3] * 2]
        y = world.placeXY[s[k * 3] * 2 + 1]
        standing = s[k * 3]
      }

      /**
       * The light behind the subject is the path it walked, not the straight
       * line between two frames. Two things break that: a day change (which
       * teleports it back to a bed) and a fast rate (which steps it a hundred
       * miles between frames). Both are cut rather than drawn — a chord across
       * the county is a road that does not exist, and this instrument does not
       * draw roads that do not exist.
       */
      if (trail.day !== slot) {
        trail.day = slot
        trail.pts.length = 0
      }
      const n = trail.pts.length
      if (n >= 2) {
        const gap = Math.hypot(x - trail.pts[n - 2], y - trail.pts[n - 1])
        if (gap > 2500) trail.pts.length = 0
      }
      trail.pts.push(x, y)
      if (trail.pts.length > 600) trail.pts.splice(0, trail.pts.length - 600)

      // ---- the camera ------------------------------------------------------
      const dpr = Math.min(2, window.devicePixelRatio || 1)
      const rect = el.getBoundingClientRect()
      const w = Math.max(320, rect.width)
      const h = Math.max(240, rect.height)
      if (el.width !== Math.round(w * dpr)) {
        el.width = Math.round(w * dpr)
        el.height = Math.round(h * dpr)
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

      const region =
        locked !== 'auto'
          ? locked
          : m === 'chase'
            ? set.places[standing >= 0 ? standing : s[0]].region
            : set.places[s[0]].region

      if (m === 'chase') {
        // Tighter when standing still, wider at seventy on the turnpike, so a
        // block is a block and a two-hundred-mile drive is still on screen.
        // The resting scale is per map: the Manhattan lattice is eighty metres
        // a block and Fayette County is eight miles between two of its towns,
        // and one zoom cannot be right for both.
        const rest = CHASE_ZOOM[region] ?? 0.1
        const want = clamp(rest / (1 + speedMs / 4), 0.012, 1.1)
        if (!cam.current.ready) {
          cam.current = { x, y, k: want, ready: true }
        } else {
          const ease = 1 - Math.pow(0.0025, dt)
          cam.current.x += (x - cam.current.x) * ease
          cam.current.y += (y - cam.current.y) * ease
          cam.current.k += (want - cam.current.k) * (1 - Math.pow(0.06, dt))
        }
      } else {
        const b = world.bounds(region)
        const k = Math.min((w - 40) / (b.x1 - b.x0), (h - 40) / (b.y1 - b.y0))
        const cx = (b.x0 + b.x1) / 2
        const cy = (b.y0 + b.y1) / 2
        if (!cam.current.ready) cam.current = { x: cx, y: cy, k, ready: true }
        const ease = 1 - Math.pow(0.02, dt)
        cam.current.x += (cx - cam.current.x) * ease
        cam.current.y += (cy - cam.current.y) * ease
        cam.current.k += (k - cam.current.k) * ease
      }

      const K = cam.current.k
      const px = (wx: number) => (wx - cam.current.x) * K + w / 2
      const py = (wy: number) => (wy - cam.current.y) * K + h / 2

      // ---- the plate -------------------------------------------------------
      ctx.globalCompositeOperation = 'source-over'
      ctx.fillStyle = void$
      ctx.fillRect(0, 0, w, h)

      // water first, because it is what the towns were put on
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
      ctx.strokeStyle = colourWith(water, 0.16)
      ctx.lineWidth = Math.max(0.6, 2.2 * Math.min(1, K * 12))
      for (const river of set.waters) {
        ctx.beginPath()
        river.pts.forEach((p, i) => {
          const sx = px(p[0] * MX)
          const sy = py(-p[1] * MY)
          if (i) ctx.lineTo(sx, sy)
          else ctx.moveTo(sx, sy)
        })
        ctx.stroke()
      }

      // the road network, unlit
      const edges = set.edges
      const heatE = heat.current.edge
      let maxE = 1
      for (let i = 0; i < heatE.length; i++) if (heatE[i] > maxE) maxE = heatE[i]
      const scale = Math.log1p(maxE)

      for (let i = 0; i < edges.length; i++) {
        const [a, b, roadIdx] = edges[i]
        const ax = px(world.nodeXY[a * 2])
        const ay = py(world.nodeXY[a * 2 + 1])
        const bx = px(world.nodeXY[b * 2])
        const by = py(world.nodeXY[b * 2 + 1])
        if (offscreen(ax, ay, bx, by, w, h)) continue
        ctx.strokeStyle = colourWith(dim, 0.3)
        ctx.lineWidth = (ROAD_W[set.roads[roadIdx].kind] ?? 1) * clamp(K * 3, 0.35, 1.6)
        ctx.beginPath()
        ctx.moveTo(ax, ay)
        ctx.lineTo(bx, by)
        ctx.stroke()
      }

      // …and the exposure on top of it, added rather than painted over
      ctx.globalCompositeOperation = 'lighter'
      for (let i = 0; i < edges.length; i++) {
        const n = heatE[i]
        if (!n) continue
        const [a, b, roadIdx] = edges[i]
        const ax = px(world.nodeXY[a * 2])
        const ay = py(world.nodeXY[a * 2 + 1])
        const bx = px(world.nodeXY[b * 2])
        const by = py(world.nodeXY[b * 2 + 1])
        if (offscreen(ax, ay, bx, by, w, h)) continue
        const f = clamp(Math.log1p(n) / scale, 0, 1)
        const base = (ROAD_W[set.roads[roadIdx].kind] ?? 1) * clamp(K * 3, 0.4, 1.7)
        // Three passes: a wide dim halo, the line, and a white core that only
        // appears where the exposure is genuinely heavy.
        ctx.strokeStyle = colourWith(accent, 0.05 + f * 0.1)
        ctx.lineWidth = base + 6 * f
        stroke(ctx, ax, ay, bx, by)
        ctx.strokeStyle = colourWith(f > 0.72 ? hot : accent, 0.18 + f * 0.5)
        ctx.lineWidth = base + 2 * f
        stroke(ctx, ax, ay, bx, by)
        if (f > 0.55) {
          ctx.strokeStyle = `rgba(255,255,255,${(f - 0.55) * 1.9})`
          ctx.lineWidth = base * 0.8
          stroke(ctx, ax, ay, bx, by)
        }
      }

      // Label positions already spoken for, so a town's name and a door's do
      // not land on each other.
      const taken: number[][] = []

      // the towns
      const heatC = heat.current.city
      let maxC = 1
      for (let i = 0; i < heatC.length; i++) if (heatC[i] > maxC) maxC = heatC[i]
      set.cities.forEach((city, i) => {
        const sx = px(world.cityXY[i * 2])
        const sy = py(world.cityXY[i * 2 + 1])
        if (sx < -80 || sy < -40 || sx > w + 80 || sy > h + 40) return
        const f = heatC[i] ? clamp(Math.log1p(heatC[i]) / Math.log1p(maxC), 0, 1) : 0
        const r = (7 - city.rank) * 1.6 + f * 26
        if (f > 0) {
          const glow = ctx.createRadialGradient(sx, sy, 0, sx, sy, r)
          glow.addColorStop(0, `rgba(255,255,255,${0.1 + f * 0.55})`)
          glow.addColorStop(0.4, colourWith(hot, 0.16 * f))
          glow.addColorStop(1, 'rgba(0,0,0,0)')
          ctx.fillStyle = glow
          ctx.beginPath()
          ctx.arc(sx, sy, r, 0, Math.PI * 2)
          ctx.fill()
        }
        ctx.globalCompositeOperation = 'source-over'
        ctx.fillStyle = colourWith(f > 0.2 ? paper : dim, city.rank <= 1 ? 0.85 : 0.5)
        ctx.font = `${city.rank <= 1 ? 10 : 8.5}px ui-monospace, monospace`
        ctx.textAlign = 'left'
        if (K > 0.004 || city.rank <= 1) {
          ctx.fillText(city.name, sx + 5, sy - 4)
          taken.push([sx, sy - 4])
        }
        ctx.fillRect(sx - 1, sy - 1, 2, 2)
        ctx.globalCompositeOperation = 'lighter'
      })

      // the doors
      const heatP = heat.current.place
      let maxP = 1
      for (let i = 0; i < heatP.length; i++) if (heatP[i] > maxP) maxP = heatP[i]
      const wanted: { i: number; sx: number; sy: number; f: number }[] = []
      set.places.forEach((place, i) => {
        const sx = px(world.placeXY[i * 2])
        const sy = py(world.placeXY[i * 2 + 1])
        if (sx < -60 || sy < -40 || sx > w + 60 || sy > h + 40) return
        const n = heatP[i]
        const f = n ? clamp(Math.log1p(n) / Math.log1p(maxP), 0, 1) : 0
        if (f > 0) {
          const r = 4 + f * (m === 'chase' ? 26 : 40)
          const glow = ctx.createRadialGradient(sx, sy, 0, sx, sy, r)
          glow.addColorStop(0, `rgba(255,255,255,${clamp(0.16 + f * 0.85, 0, 1)})`)
          glow.addColorStop(0.35, colourWith(kindInk[place.kind] ?? accent, 0.4 * f))
          glow.addColorStop(1, 'rgba(0,0,0,0)')
          ctx.fillStyle = glow
          ctx.beginPath()
          ctx.arc(sx, sy, r, 0, Math.PI * 2)
          ctx.fill()
        }
        ctx.globalCompositeOperation = 'source-over'
        ctx.strokeStyle = colourWith(
          place.named ? (kindInk[place.kind] ?? accent) : dim,
          f > 0 ? 0.85 : 0.35,
        )
        ctx.lineWidth = 1
        ctx.beginPath()
        ctx.arc(sx, sy, place.named ? 3.2 : 1.8, 0, Math.PI * 2)
        ctx.stroke()
        ctx.globalCompositeOperation = 'lighter'
        if (place.named) wanted.push({ i, sx, sy, f })
      })

      /**
       * The labels, last and in order of how hard the door has burnt in.
       *
       * Twelve addresses inside one white blob is twelve labels on top of each
       * other, which names nothing. So they are placed hottest-first and any
       * that would land on top of one already placed is dropped — the pin is
       * still drawn, and the panel beside the plate names every one of them
       * anyway. Nothing is hidden; a label is just not printed where it cannot
       * be read.
       */
      ctx.globalCompositeOperation = 'source-over'
      ctx.textAlign = 'left'
      wanted
        .sort((a, b) => (standing === b.i ? 1 : standing === a.i ? -1 : b.f - a.f))
        .forEach(({ i, sx, sy, f }) => {
          const close = K > 0.25
          if (!close && standing !== i && f < 0.45) return
          if (
            taken.some(([tx, ty]) => Math.abs(tx - sx) < 130 && Math.abs(ty - sy) < 11) &&
            standing !== i
          )
            return
          taken.push([sx, sy])
          ctx.fillStyle = colourWith(standing === i ? paper : dim, standing === i ? 0.95 : 0.62)
          ctx.font = `${standing === i ? 11 : 9}px ui-monospace, monospace`
          ctx.fillText(set.places[i].name, sx + 6, sy + 3)
        })
      ctx.globalCompositeOperation = 'lighter'

      // the road under the wheels, named
      if (m === 'chase' && onRoad >= 0) {
        ctx.globalCompositeOperation = 'source-over'
        const name = set.roads[edges[onRoad][2]].name
        ctx.fillStyle = colourWith(paper, 0.8)
        ctx.font = '11px ui-monospace, monospace'
        ctx.textAlign = 'center'
        ctx.fillText(name.toUpperCase(), w / 2, h - 16)
        ctx.globalCompositeOperation = 'lighter'
      }

      /**
       * In CHASE, the whole day is drawn before the subject walks it: the legs
       * still to come as a dim dotted line, the ones already walked solid.
       * Without it the camera is a torch in a tunnel and you cannot tell a
       * three-stop day from a twenty-stop one until it is over — which is the
       * one thing this mode exists to let you read.
       */
      if (m === 'chase') {
        ctx.globalCompositeOperation = 'source-over'
        for (let k = 0; k + 1 < stops; k++) {
          const leg = world.legOf(s[k * 3], s[(k + 1) * 3])
          const done = minute >= s[(k + 1) * 3 + 1]
          ctx.setLineDash(done ? [] : [3, 4])
          ctx.strokeStyle = colourWith(done ? hot : paper, done ? 0.3 : 0.16)
          ctx.lineWidth = done ? 1.5 : 1
          ctx.beginPath()
          for (let i = 0; i < leg.cum.length; i++) {
            const sx$ = px(leg.xy[i * 2])
            const sy$ = py(leg.xy[i * 2 + 1])
            if (i) ctx.lineTo(sx$, sy$)
            else ctx.moveTo(sx$, sy$)
          }
          ctx.stroke()
        }
        ctx.setLineDash([])
      }

      // the light behind the subject
      const tail = trail.pts
      ctx.globalCompositeOperation = 'lighter'
      for (let i = 2; i < tail.length; i += 2) {
        const age = i / tail.length
        ctx.strokeStyle = colourWith(hot, 0.03 + age * 0.35)
        ctx.lineWidth = 0.6 + age * 2.6
        stroke(ctx, px(tail[i - 2]), py(tail[i - 1]), px(tail[i]), py(tail[i + 1]))
      }

      // …and the subject
      const sx = px(x)
      const sy = py(y)
      const halo = ctx.createRadialGradient(sx, sy, 0, sx, sy, 22)
      halo.addColorStop(0, 'rgba(255,255,255,0.95)')
      halo.addColorStop(0.25, colourWith(hot, 0.5))
      halo.addColorStop(1, 'rgba(0,0,0,0)')
      ctx.fillStyle = halo
      ctx.beginPath()
      ctx.arc(sx, sy, 22, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = '#ffffff'
      ctx.beginPath()
      ctx.arc(sx, sy, 2.6, 0, Math.PI * 2)
      ctx.fill()

      // ---- the stamp -------------------------------------------------------
      ctx.globalCompositeOperation = 'source-over'
      ctx.textAlign = 'left'
      ctx.font = '10px ui-monospace, monospace'
      ctx.fillStyle = colourWith(paper, 0.75)
      const iso = isoOf(set.span.from0 + day.d)
      ctx.fillText(
        `${iso} ${WEEKDAY[(set.span.from0 + day.d) % 7]} · ${hhmm(minute)} · ${world.bounds(region).name}`,
        12,
        18,
      )
      ctx.fillStyle = colourWith(dim, 0.8)
      ctx.fillText(day.still ? 'NO FIXES ON THIS DAY' : day.move ? 'THE MOVE' : day.trip ? 'HOME, FOR A FEW DAYS' : '', 12, 32)
      ctx.textAlign = 'right'
      ctx.fillStyle = colourWith(set.source === 'export' ? dim : hot, 0.75)
      ctx.fillText(set.source === 'export' ? 'FROM THE EXPORT' : 'RECONSTRUCTED', w - 12, 18)
      ctx.fillStyle = colourWith(dim, 0.6)
      ctx.fillText('THE MAP IS DRAWN BY HAND', w - 12, 32)

      // ---- tell React, ten times a second and no more ----------------------
      if (now - told > 100) {
        told = now
        setTick({ i: slot, minute, visits: heat.current.visits })
      }
    }

    raf = requestAnimationFrame(frame)
    const observer = new ResizeObserver(() => {})
    observer.observe(el)
    return () => {
      cancelAnimationFrame(raf)
      observer.disconnect()
    }
  }, [world, expose, vibe])

  // Autoplay is a motion preference, the same as everywhere else in the house.
  useEffect(() => {
    if (!motion) setPlaying(false)
  }, [motion])

  if (loading)
    return (
      <Frame instrument={instrument}>
        <p className="inst__state">drawing the corridor…</p>
      </Frame>
    )

  if (error || !data || !world)
    return (
      <Frame instrument={instrument}>
        <p className="inst__state">
          The dataset is missing ({error}). Run <code>npm run atlas</code> and rebuild.
        </p>
      </Frame>
    )

  const set = data
  const slot = clamp(tick.i, 0, Math.max(0, reel.length - 1))
  const day = world.timeline[reel[slot] ?? 0]
  const iso = isoOf(set.span.from0 + day.d)
  const stops = day.s.length / 3
  const perDay = SPEEDS[speed].secs
  const left = (reel.length - slot) * perDay

  const jump = (to: number) => {
    at.current = { slot: clamp(to, 0, reel.length - 1), minute: 0 }
    setTick((t) => ({ ...t, i: clamp(to, 0, reel.length - 1), minute: 0 }))
  }
  const jumpToYear = (year: number) => {
    const want = `${year}-01-01`
    const found = reel.findIndex((i) => isoOf(set.span.from0 + world.timeline[i].d) >= want)
    jump(found < 0 ? reel.length - 1 : found)
  }

  return (
    <Frame
      instrument={instrument}
      controls={
        <div className="pt-chips" role="group" aria-label="Playback">
          <button
            type="button"
            className={`pt-chip${mode === 'chase' ? ' pt-chip--on' : ''}`}
            aria-pressed={mode === 'chase'}
            onClick={() => {
              setMode('chase')
              cam.current.ready = false
            }}
          >
            ⌖ CHASE
          </button>
          <button
            type="button"
            className={`pt-chip${mode === 'bloom' ? ' pt-chip--on' : ''}`}
            aria-pressed={mode === 'bloom'}
            onClick={() => {
              setMode('bloom')
              cam.current.ready = false
            }}
          >
            ✷ BLOOM
          </button>
          <button
            type="button"
            className={`pt-chip${playing ? ' pt-chip--on' : ''}`}
            aria-pressed={playing}
            onClick={() => setPlaying((p) => !p)}
            disabled={!motion && !playing}
          >
            {playing ? '❚❚ PAUSE' : '▶ PLAY'}
          </button>
          <button type="button" className="pt-chip" onClick={() => jump(0)}>
            ⟲ REWIND
          </button>
        </div>
      }
      footer={
        <>
          <p className="inst__method">
            <b>WHAT IS COUNTED AND WHAT IS DRAWN</b> Every total this replays is a published one:{' '}
            {set.totals.visits.toLocaleString()} visits, the eleven per-year counts, and the{' '}
            {set.published.length} per-address counts, all reproduced exactly — the build refuses to
            write a dataset that misses any of them. What is <i>not</i> in the record is which day
            inside a year a given visit fell on, and that is drawn from a fixed seed rather than
            known. The instrument says RECONSTRUCTED on every frame for that reason, and stops
            saying it if a real export is ever handed to the build. The 1,891 visits the published
            table leaves unnamed are drawn as unnamed pins rather than given invented names.
          </p>
          <p className="inst__method">
            <b>THE MAP IS DRAWN BY HAND</b> No road here was surveyed and no tile was fetched: the
            interstates, the rivers and the Uniontown streets are polylines somebody typed, good to
            a block in town and a mile on the turnpike. The Upper East Side lattice is the one
            exception — it is generated off the 1811 grid, the 29° rotation and the measured avenue
            offsets, which puts it within about 25 m of the real intersections.
          </p>
        </>
      }
    >
      <div className="atlas">
        <div className="atlas__stage">
          <canvas ref={canvas} className="atlas__canvas" />

          <div className="atlas__rate">
            <span className="atlas__rate-lead">A DAY EVERY</span>
            {SPEEDS.map((s, i) => (
              <button
                key={s.label}
                type="button"
                className={`pt-chip${i === speed ? ' pt-chip--on' : ''}`}
                aria-pressed={i === speed}
                onClick={() => setSpeed(i)}
                title={`${runtime(reel.length * s.secs)} for the ${reel.length.toLocaleString()} days left in the reel`}
              >
                {s.label}
              </button>
            ))}
            <span className="atlas__rate-say">
              {runtime(left)} from here at {SPEEDS[speed].label} a day
            </span>
          </div>

          <label className="atlas__scrub">
            <span>
              DAY <b>{(slot + 1).toLocaleString()}</b> OF {reel.length.toLocaleString()} ·{' '}
              {iso} · {hhmm(tick.minute)}
            </span>
            <input
              type="range"
              min={0}
              max={Math.max(0, reel.length - 1)}
              value={slot}
              onChange={(e) => jump(Number(e.target.value))}
            />
          </label>

          <div className="atlas__years">
            {set.years.map((y) => (
              <button
                key={y.year}
                type="button"
                className="pt-chip pt-chip--year"
                onClick={() => jumpToYear(y.year)}
                title={`${y.visits.toLocaleString()} visits`}
              >
                {String(y.year).slice(2)}
              </button>
            ))}
            <button
              type="button"
              className={`pt-chip${skipStill ? ' pt-chip--on' : ''}`}
              aria-pressed={skipStill}
              onClick={() => setSkipStill((v) => !v)}
              title="The export has nothing for 1,935 of the 3,927 days. Play them or skip them."
            >
              SKIP THE DAYS WITH NO FIXES
            </button>
            <button
              type="button"
              className={`pt-chip${loopDay ? ' pt-chip--on' : ''}`}
              aria-pressed={loopDay}
              onClick={() => setLoopDay((v) => !v)}
              title="Hold this day and replay it at twelve seconds, without re-timing the rest."
            >
              ⟳ LOOP THIS DAY
            </button>
            <select
              className="atlas__lock"
              value={lock}
              onChange={(e) => {
                setLock(e.target.value)
                cam.current.ready = false
              }}
              aria-label="Which map"
            >
              <option value="auto">FOLLOW THE DAY</option>
              {set.regions.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="atlas__side">
          <h3 className="pt-sub">THIS DAY, STOP BY STOP</h3>
          {day.still ? (
            <p className="pt-note">
              The export carries no fix for {iso}. That is a hole in the record, not a day nobody
              moved, and it is drawn as a day at{' '}
              {set.places[day.s[0]].name} rather than as nothing.
            </p>
          ) : (
            <ol className="atlas__stops">
              {Array.from({ length: stops }, (_, k) => {
                const place = set.places[day.s[k * 3]]
                const arrive = day.s[k * 3 + 1]
                const depart = day.s[k * 3 + 2]
                const here = tick.minute >= arrive && tick.minute <= depart
                const bed = k === 0 || k === stops - 1
                return (
                  <li
                    key={k}
                    className={`atlas__stop${here ? ' atlas__stop--here' : ''}${bed ? ' atlas__stop--bed' : ''}`}
                  >
                    <span className="atlas__stop-t">
                      {bed && k === 0 ? '—' : hhmm(arrive)}
                    </span>
                    <span className="atlas__stop-n">
                      {place.name}
                      {bed && <i> · the bed it {k === 0 ? 'woke in' : 'ended in'}, not a visit</i>}
                    </span>
                    <span className="atlas__stop-d">
                      {bed ? '' : `${Math.max(1, depart - arrive)}m`}
                    </span>
                  </li>
                )
              })}
            </ol>
          )}

          <h3 className="pt-sub">EXPOSED SO FAR</h3>
          <dl className="atlas__counts">
            <div>
              <dt>VISITS BURNT IN</dt>
              <dd>
                {tick.visits.toLocaleString()}{' '}
                <i>of {set.totals.visits.toLocaleString()}</i>
              </dd>
            </div>
            <div>
              <dt>DAYS PLAYED</dt>
              <dd>
                {(slot + 1).toLocaleString()} <i>of {reel.length.toLocaleString()}</i>
              </dd>
            </div>
            <div>
              <dt>WHERE HOME WAS</dt>
              <dd className="atlas__counts-era">{eraAt(set, iso)}</dd>
            </div>
          </dl>

          <h3 className="pt-sub">THE PUBLISHED TABLE, AGAINST WHAT IS ON THE PLATE</h3>
          <ol
            className="pt-rows atlas__ledger"
            style={{ ['--pt-label' as string]: '9.5rem', ['--pt-value' as string]: '6.4rem' }}
          >
            {set.published
              .map((row) => ({
                row,
                place: set.places[world.placeIndex.get(row.id) ?? 0],
                burnt: heat.current.place[world.placeIndex.get(row.id) ?? 0] ?? 0,
              }))
              .sort((a, b) => b.row.visits - a.row.visits)
              .map(({ row, place, burnt: n }) => (
                <li key={row.id} className="pt-row">
                  <span className="pt-label">{place.name}</span>
                  <span className="pt-bar">
                    <span
                      className="pt-fill"
                      style={{ width: `${(n / row.visits) * 100}%` }}
                      aria-hidden="true"
                    />
                  </span>
                  <span className="pt-value">
                    {Math.round(n).toLocaleString()} / {row.visits.toLocaleString()}
                  </span>
                </li>
              ))}
          </ol>
          <p className="pt-note">
            The right-hand number is the wiki&apos;s. The left is what the replay has burnt in so
            far, and at the end of the reel every pair is equal — that is the check the build runs
            before it will write the file.
          </p>
        </div>
      </div>
    </Frame>
  )
}

// ---------------------------------------------------------------------------

function stroke(ctx: CanvasRenderingContext2D, ax: number, ay: number, bx: number, by: number) {
  ctx.beginPath()
  ctx.moveTo(ax, ay)
  ctx.lineTo(bx, by)
  ctx.stroke()
}

const offscreen = (ax: number, ay: number, bx: number, by: number, w: number, h: number) =>
  (ax < 0 && bx < 0) || (ay < 0 && by < 0) || (ax > w && bx > w) || (ay > h && by > h)

const eraAt = (set: AtlasSet, iso: string) =>
  set.eras.find((e) => iso >= e.from && iso < e.to)?.label ?? '—'
