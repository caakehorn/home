/**
 * THE CORE — the dataset, and where everything ends up in space.
 *
 * ---- the one rule the geometry obeys ---------------------------------------
 *
 * **The vertical axis is data and is never simulated.** A page's height is the
 * date the record gives it and nothing moves it afterwards; the message sheath
 * is at the height of the day it was sent. Only the horizontal placement —
 * where a page sits on its own ring of time — is relaxed by a force solver,
 * because that has no meaning in the record and something has to choose it.
 *
 * That split is the difference between a diagram and a mood. Anything you read
 * off the vertical is a date. Anything you read off the horizontal is a drawing
 * decision, and the room says so.
 *
 * ---- the axis is linear, and mostly empty ----------------------------------
 *
 * 1892 to 2027, evenly. A third of the corpus predates 2010 and the century
 * below it is nearly bare — eleven pages in 1900, two in 1918, one in 1959 —
 * while 106 pages land in 2026 alone. Compressing the empty part would make the
 * picture denser and would be a lie about a corpus whose reach backwards is
 * genealogical and whose density is entirely recent. The emptiness is the
 * reading, so it is drawn at its true height.
 *
 * The message record occupies 2015-11 → 2026-07 — eight per cent of the
 * column's height carrying every one of its 134,348 marks.
 */

import { FAR, HEIGHT, NEAR } from './axes'
import type { Axis, Shape } from './axes'
import type { Camera } from './camera'

/* ==========================================================================
   WHAT THE BUILD WROTE — scripts/build-core.mjs
   ========================================================================== */

export type CoreNode = {
  /** slug */ s: string
  /** title */ n: string
  /** domain */ d: string
  /** page type */ k: string
  /** status */ st: string
  /** words */ w: number
  /** the layout `index.json` already solved, in [-1, 1] */ x: number
  y: number
  /** fractional year, or null when the record places it nowhere */ t: number | null
  /** which rule placed it — index into `tSrc` */ ts: number
  /** documented range, when there is one */ a: number | null
  b: number | null
  /** declared knowledge gaps */ g: number
  /** backlinks / outlinks */ bl: number
  ol: number
  /** knowledge grade, importance */ kn: string | null
  im: string | null
  i: number
}

export type CoreType = {
  id: string
  n: number
  family: 'causal' | 'structural' | 'evidential' | 'affinity' | 'tension' | 'other'
  inverse: string | null
  symmetric: boolean
}

export type Structure = {
  generatedAt: string
  source: string
  counts: {
    nodes: number
    words: number
    typed: number
    untyped: number
    types: number
    gaps: number
    gapPages: number
    roots: number
    sourceRefs: number
    dangling: number
  }
  span: { from: number; to: number }
  tSrc: string[]
  domains: { id: string; count: number }[]
  types: CoreType[]
  facets: Record<string, { id: string; n: number }[]>
  nodes: CoreNode[]
  typed: [number, number, number][]
  untyped: [number, number][]
  roots: { id: string; n: number }[]
  nodeRoots: [number, number, number][]
}

/** `public/leviathan/clock.json`, reused whole rather than rebuilt. */
export type Clock = {
  count: number
  sent: number
  received: number
  from: string
  to: string
  days: number
  gaps: { from: string; to: string; months: number; fromDay: number; toDay: number }[]
  marks: number[]
}

const asset = (file: string) => `${import.meta.env.BASE_URL}${file}`.replace(/\/{2,}/g, '/')

const cache = new Map<string, Promise<unknown>>()
export function load<T>(file: string): Promise<T> {
  if (!cache.has(file))
    cache.set(
      file,
      fetch(asset(file)).then((r) => {
        if (!r.ok) throw new Error(`${file} unavailable (${r.status})`)
        return r.json()
      }),
    )
  return cache.get(file) as Promise<T>
}

/* ==========================================================================
   THE AXIS
   ========================================================================== */

export const AXIS = { from: 1892, to: 2027, height: 1900 }

/** A fractional year to a height on the column. */
export const yearToY = (year: number) =>
  ((year - AXIS.from) / (AXIS.to - AXIS.from) - 0.5) * AXIS.height

export const yToYear = (y: number) =>
  (y / AXIS.height + 0.5) * (AXIS.to - AXIS.from) + AXIS.from

/** Days since the epoch to a fractional year, arithmetically — never `Date` parsing. */
const dayToYear = (day: number) => {
  const d = new Date(day * 86400000)
  const y = d.getUTCFullYear()
  const start = Date.UTC(y, 0, 1) / 86400000
  const len = (Date.UTC(y + 1, 0, 1) - Date.UTC(y, 0, 1)) / 86400000
  return y + (day - start) / len
}

const isoToDay = (iso: string) =>
  Math.floor(Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10)) / 86400000)

/* ==========================================================================
   THE SHEATH — 134,348 messages, decoded out of clock.json
   ========================================================================== */

export const SHEATH_R = 40

export type Sheath = {
  /** xyz per message. */ pos: Float32Array
  /** 1 sent, 0 received. */ dir: Float32Array
  /**
   * Where each mark sits on the date axis, 0 → 1 — the same number the pages
   * carry, so the scrub window can be expressed in the measure rather than in
   * world units. It is the date and only ever the date: the sheath is drawn on
   * the date axis or it is not drawn at all.
   */
  t: Float32Array
  count: number
  /** The five stretches the export does not cover, on the date axis, 0 → 1. */
  holes: { from: number; to: number; months: number; label: string }[]
}

/** The date axis the sheath is placed against — the ruling the column has always had. */
const dateT = (year: number) => (year - AXIS.from) / (AXIS.to - AXIS.from)

/**
 * Unpack the clock.
 *
 * `marks` is delta-encoded `day * 2880 + minute * 2 + dir`, one integer per
 * message, which is how 134,348 messages fit in 320 KB with nothing lost. A
 * prefix sum and two remainders put every one of them back.
 *
 * Angle is the minute of the day, so midnight is the same bearing in every one
 * of the eleven years and the sheath develops a visible grain where somebody
 * kept hours. Radius is constant — nothing is encoded in it — with a hash-based
 * wobble so that 134,000 points on one cylinder read as a solid rather than a
 * wall of z-fighting.
 */
export function unpackSheath(clock: Clock): Sheath {
  const n = clock.marks.length
  const pos = new Float32Array(n * 3)
  const dir = new Float32Array(n)
  const t = new Float32Array(n)
  const day0 = isoToDay(clock.from)

  let value = 0
  for (let i = 0; i < n; i++) {
    value += clock.marks[i]
    const day = Math.floor(value / 2880)
    const rest = value - day * 2880
    const minute = rest >> 1
    const sent = rest & 1

    const year = dayToYear(day0 + day)
    // A cheap integer hash, so the wobble is deterministic across reloads.
    let h = (i * 2654435761) >>> 0
    h ^= h >>> 15
    const jitter = ((h & 1023) / 1023 - 0.5) * 5.5

    const angle = (minute / 1440) * Math.PI * 2
    const r = SHEATH_R + jitter + (sent ? 2.6 : -2.6)
    pos[i * 3] = Math.sin(angle) * r
    pos[i * 3 + 1] = yearToY(year)
    pos[i * 3 + 2] = Math.cos(angle) * r
    dir[i] = sent
    t[i] = dateT(year)
  }

  const holes = clock.gaps.map((g) => ({
    from: dateT(dayToYear(day0 + g.fromDay)),
    to: dateT(dayToYear(day0 + g.toDay)),
    months: g.months,
    label: g.from === g.to ? g.from : `${g.from} → ${g.to}`,
  }))

  return { pos, dir, t, count: n, holes }
}

/* ==========================================================================
   THE SKELETON — where the 519 pages settle
   ========================================================================== */

export type Layout = {
  /** xyz per node. */
  pos: Float32Array
  /**
   * Where each node sits on the current axis, 0 → 1.
   *
   * This travels beside every position because the scrub window is expressed in
   * the measure and not in world units. It used to be read off `pos.y`, which
   * worked only while the measure was always the date and the shape was always
   * the column — on a sphere the measure is latitude and on a disc it is
   * radius, and a window read off the height there would fade the wrong pages.
   */
  m: Float32Array
  /** Tessellated typed edges, and which edge each vertex belongs to. */
  edgePos: Float32Array
  edgeId: Float32Array
  /** Position along its own curve, 0→1, for the direction ramp. */
  edgeT: Float32Array
  /** The axis position of each edge vertex, interpolated between its ends. */
  edgeM: Float32Array
  edgeVerts: number
  /** The same for the untyped wikilink mesh, straight rather than curved. */
  linkPos: Float32Array
  linkM: Float32Array
  linkVerts: number
  /** The reference rings and the spine, which are now the shape's business. */
  axisPos: Float32Array
  axisM: Float32Array
  axisVerts: number
  iterations: number
}

/**
 * What to draw and how — everything about the arrangement that is a choice.
 *
 * `axis` is the data half: which measure, on which scale, and where every page
 * lands on it. `shape` is the drawing half. `groups` exists for the one shape
 * that separates the pages rather than mixing them, and is the domain ids in
 * alphabetical order, so which column stands where is a stated rule rather than
 * a ranking.
 */
export type Projection = {
  axis: Axis
  shape: Shape
  groups: string[]
  /** Only true where the sheath belongs to this axis: the date, linear, column. */
  sheath: boolean
}

/** The domain ids, alphabetically — the ring order, and it is arbitrary on purpose. */
export const groupsOf = (structure: Structure) =>
  structure.domains.map((d) => d.id).sort((a, b) => a.localeCompare(b))

const SEGMENTS = 14
const RING_SEGMENTS = 48

/**
 * Settle the pages, then hand them to a shape.
 *
 * Every node's position on the axis is already fixed by the measure. What is
 * left is a bearing and a depth each, and this is a plain force relaxation over
 * the **typed** graph to choose them: pages that argue with each other are
 * pulled together, every pair pushes apart, and a weak spring holds the whole
 * thing off the axis and inside the frame.
 *
 * The solve is deliberately the same in every shape and on every measure — it
 * runs in the column's own coordinates and the shape reads its answer as a
 * bearing and a normalised depth afterwards. Two consequences worth knowing:
 * the COLUMN on the date axis is exactly the picture the room has always drawn,
 * to the unit; and switching shape re-poses the same settled structure rather
 * than re-settling it, so a page keeps its neighbours across the change.
 *
 * It runs on the CPU, once per projection. 491 nodes is not a GPU problem — the
 * honest reason the GPU is here is the 134,000-point sheath and the compositing,
 * not this. Seeded from the deterministic layout `index.json` already carries,
 * so the structure looks the same on every reload and in every screenshot.
 */
export function solve(structure: Structure, projection: Projection, iterations = 190): Layout {
  const { axis, shape, groups } = projection
  const N = structure.nodes.length
  const px = new Float64Array(N)
  const pz = new Float64Array(N)
  const vx = new Float64Array(N)
  const vz = new Float64Array(N)
  const y = new Float64Array(N)

  const RING = 155
  for (let i = 0; i < N; i++) {
    const node = structure.nodes[i]
    // Seed off the layout the snapshot already solved, lifted onto a ring so
    // nothing starts on the axis where the sheath is.
    const a = Math.atan2(node.y, node.x)
    const r = RING * (0.45 + 0.55 * Math.min(1, Math.hypot(node.x, node.y)))
    px[i] = Math.sin(a) * r
    pz[i] = Math.cos(a) * r
    y[i] = (axis.t[i] - 0.5) * HEIGHT
  }

  // Springs over the typed graph only. The untyped wikilink graph is drawn but
  // does not vote on the layout: this room is about the argued edges.
  const springs = structure.typed.map(([from, to]) => [from, to] as const)

  for (let step = 0; step < iterations; step++) {
    const cool = 1 - step / iterations
    for (let i = 0; i < N; i++) {
      vx[i] *= 0.72
      vz[i] *= 0.72
    }

    // Repulsion. 491 nodes is 120k pairs — small enough to do honestly.
    for (let i = 0; i < N; i++) {
      for (let j = i + 1; j < N; j++) {
        const dx = px[i] - px[j]
        const dz = pz[i] - pz[j]
        const dy = (y[i] - y[j]) * 0.22
        let d2 = dx * dx + dz * dz + dy * dy
        if (d2 > 90000) continue
        if (d2 < 1) d2 = 1
        const f = 900 / d2
        const d = Math.sqrt(d2)
        vx[i] += (dx / d) * f
        vz[i] += (dz / d) * f
        vx[j] -= (dx / d) * f
        vz[j] -= (dz / d) * f
      }
    }

    for (const [a, b] of springs) {
      const dx = px[b] - px[a]
      const dz = pz[b] - pz[a]
      const d = Math.hypot(dx, dz) || 1
      const f = d * 0.012
      vx[a] += (dx / d) * f
      vz[a] += (dz / d) * f
      vx[b] -= (dx / d) * f
      vz[b] -= (dz / d) * f
    }

    // Hold the cloud off the axis and inside a radius, so the sheath stays
    // visible down the middle and nothing escapes the frame.
    for (let i = 0; i < N; i++) {
      const r = Math.hypot(px[i], pz[i]) || 1
      const want = Math.max(NEAR, Math.min(RING * 1.5, r))
      const pull = (want - r) * 0.06
      vx[i] += (px[i] / r) * pull
      vz[i] += (pz[i] / r) * pull
      px[i] += vx[i] * cool
      pz[i] += vz[i] * cool
    }
  }

  /* ---- hand the settled seats to the shape ------------------------------- */

  const groupAt = new Map(groups.map((g, i) => [g, i]))
  const pos = new Float32Array(N * 3)
  const m = new Float32Array(N)
  for (let i = 0; i < N; i++) {
    const radius = Math.hypot(px[i], pz[i]) || 1
    const [x, yy, z] = shape.place({
      t: axis.t[i],
      angle: Math.atan2(px[i], pz[i]),
      depth: Math.max(0, Math.min(1, (radius - NEAR) / (FAR - NEAR))),
      radius,
      group: groupAt.get(structure.nodes[i].d) ?? 0,
      groups: groups.length,
    })
    pos[i * 3] = x
    pos[i * 3 + 1] = yy
    pos[i * 3 + 2] = z
    m[i] = axis.t[i]
  }

  /* ---- tessellate the typed edges ---------------------------------------- */

  const E = structure.typed.length
  const edgeVerts = E * SEGMENTS * 2
  const edgePos = new Float32Array(edgeVerts * 3)
  const edgeId = new Float32Array(edgeVerts)
  const edgeT = new Float32Array(edgeVerts)
  const edgeM = new Float32Array(edgeVerts)

  let v = 0
  for (let e = 0; e < E; e++) {
    const [from, to] = structure.typed[e]
    const ax = pos[from * 3]
    const ay = pos[from * 3 + 1]
    const az = pos[from * 3 + 2]
    const bx = pos[to * 3]
    const by = pos[to * 3 + 1]
    const bz = pos[to * 3 + 2]

    // A quadratic bend, bowed away from whatever this shape is built around —
    // the vertical axis for the column, the helix and the rings; the centre of
    // the world for the sphere and the disc. Two pages arguing across fifteen
    // years should not be a chord through the middle of the record.
    const mx = (ax + bx) / 2
    const my = (ay + by) / 2
    const mz = (az + bz) / 2
    const bow = 1 + Math.min(0.55, Math.hypot(ax - bx, ay - by, az - bz) / 900)
    const spread = shape.bow === 'centre' ? bow : 1
    const cx = mx * bow
    const cz = mz * bow
    const cy = my * spread

    let prevX = ax
    let prevY = ay
    let prevZ = az
    for (let s = 1; s <= SEGMENTS; s++) {
      const t = s / SEGMENTS
      const it = 1 - t
      const x = it * it * ax + 2 * it * t * cx + t * t * bx
      const yy = it * it * ay + 2 * it * t * cy + t * t * by
      const z = it * it * az + 2 * it * t * cz + t * t * bz

      edgePos[v * 3] = prevX
      edgePos[v * 3 + 1] = prevY
      edgePos[v * 3 + 2] = prevZ
      edgeId[v] = e
      edgeT[v] = (s - 1) / SEGMENTS
      edgeM[v] = m[from] + (m[to] - m[from]) * ((s - 1) / SEGMENTS)
      v++

      edgePos[v * 3] = x
      edgePos[v * 3 + 1] = yy
      edgePos[v * 3 + 2] = z
      edgeId[v] = e
      edgeT[v] = t
      edgeM[v] = m[from] + (m[to] - m[from]) * t
      v++

      prevX = x
      prevY = yy
      prevZ = z
    }
  }

  /* ---- and the untyped mesh, straight and dim ---------------------------- */

  const L = structure.untyped.length
  const linkPos = new Float32Array(L * 6)
  const linkM = new Float32Array(L * 2)
  for (let i = 0; i < L; i++) {
    const [a, b] = structure.untyped[i]
    linkPos[i * 6] = pos[a * 3]
    linkPos[i * 6 + 1] = pos[a * 3 + 1]
    linkPos[i * 6 + 2] = pos[a * 3 + 2]
    linkPos[i * 6 + 3] = pos[b * 3]
    linkPos[i * 6 + 4] = pos[b * 3 + 1]
    linkPos[i * 6 + 5] = pos[b * 3 + 2]
    linkM[i * 2] = m[a]
    linkM[i * 2 + 1] = m[b]
  }

  const { pos: axisPos, m: axisM } = rule(projection)

  return {
    pos,
    m,
    edgePos,
    edgeId,
    edgeT,
    edgeM,
    edgeVerts,
    linkPos,
    linkM,
    linkVerts: L * 2,
    axisPos,
    axisM,
    axisVerts: axisPos.length / 3,
    iterations,
  }
}

/**
 * The ruling: a spine, and one reference ring per tick.
 *
 * This used to be a hard-coded decade ladder from 1900 to 2020 with the axis
 * running up the middle. It is now whatever the shape says a ring at position
 * `t` looks like — a small circle round the column, a latitude on the sphere, a
 * radius on the disc — and the ticks are whatever the measure says are the
 * numbers worth marking.
 *
 * The five holes in the message export are not part of it — they are a fact
 * about the message record and belong only to the date axis, so `holeRings`
 * builds them separately and the room appends them only where the sheath is
 * drawn. Reading them against a word count would be drawing a fact about the
 * message record onto a picture that is not of the message record.
 */
function rule(projection: Projection) {
  const { axis, shape } = projection
  const out: number[] = []
  const mm: number[] = []

  const push = (
    x0: number, y0: number, z0: number, m0: number,
    x1: number, y1: number, z1: number, m1: number,
  ) => {
    out.push(x0, y0, z0, x1, y1, z1)
    mm.push(m0, m1)
  }

  // Segments by circumference, not a constant: 24 is plenty around an 11-unit
  // tick on the column and a visible decagon around the disc's 930-unit rim.
  const circle = (t: number, radius: number, height: number, cx: number, cz: number) => {
    if (radius < 0.5) return
    // Segments by circumference, not a constant: 24 is plenty around an
    // 11-unit tick on the column and a visible decagon around the disc's rim.
    const segments = Math.max(24, Math.min(96, Math.round(radius / 7)))
    for (let k = 0; k < segments; k++) {
      const a0 = (k / segments) * Math.PI * 2
      const a1 = ((k + 1) / segments) * Math.PI * 2
      push(
        cx + Math.sin(a0) * radius, height, cz + Math.cos(a0) * radius, t,
        cx + Math.sin(a1) * radius, height, cz + Math.cos(a1) * radius, t,
      )
    }
  }

  const a = shape.ring(0)
  const b = shape.ring(1)
  for (const [cx, cz] of shape.centres(projection.groups.length)) {
    // The spine, tessellated rather than drawn as one line, so the scrub window
    // fades along it instead of switching the whole thing on and off.
    if (Math.abs(b.y - a.y) > 1) {
      const steps = 40
      for (let k = 0; k < steps; k++) {
        const t0 = k / steps
        const t1 = (k + 1) / steps
        push(cx, a.y + (b.y - a.y) * t0, cz, t0, cx, a.y + (b.y - a.y) * t1, cz, t1)
      }
    }
    for (const tick of axis.ticks) {
      const r = shape.ring(tick.t)
      circle(tick.t, r.r, r.y, cx, cz)
    }
  }

  return { pos: new Float32Array(out), m: new Float32Array(mm) }
}

/**
 * The rings the message export does not cover, at their true height.
 *
 * Built separately from the ruling because the holes come from the clock and
 * the ruling comes from the structure, and only one of the two is available at
 * the moment the layout is solved.
 */
export function holeRings(sheath: Sheath) {
  const out: number[] = []
  const mm: number[] = []
  for (const hole of sheath.holes) {
    for (const t of [hole.from, hole.to]) {
      const height = (t - 0.5) * HEIGHT
      for (let k = 0; k < RING_SEGMENTS; k++) {
        const a0 = (k / RING_SEGMENTS) * Math.PI * 2
        const a1 = ((k + 1) / RING_SEGMENTS) * Math.PI * 2
        out.push(
          Math.sin(a0) * SHEATH_R, height, Math.cos(a0) * SHEATH_R,
          Math.sin(a1) * SHEATH_R, height, Math.cos(a1) * SHEATH_R,
        )
        mm.push(t, t)
      }
    }
  }
  return { pos: new Float32Array(out), m: new Float32Array(mm) }
}

/* ==========================================================================
   ADJACENCY — what the panel reads
   ========================================================================== */

export type Adjacency = { out: number[][]; in: number[][] }

export function adjacency(structure: Structure): Adjacency {
  const out: number[][] = Array.from({ length: structure.nodes.length }, () => [])
  const inn: number[][] = Array.from({ length: structure.nodes.length }, () => [])
  structure.typed.forEach(([from, to], e) => {
    out[from].push(e)
    inn[to].push(e)
  })
  return { out, in: inn }
}

/** Where a node is, so the camera can be sent there. */
export const nodeHeight = (layout: Layout, i: number) => layout.pos[i * 3 + 1]

export function flyTo(camera: Camera, layout: Layout, i: number) {
  const x = layout.pos[i * 3]
  const z = layout.pos[i * 3 + 2]
  camera.goal.azimuth = Math.atan2(x, z)
  camera.focus(layout.pos[i * 3 + 1], 120)
}
