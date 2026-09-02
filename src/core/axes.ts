/**
 * THE CORE — what the room is allowed to measure, and what shapes it may take.
 *
 * ---- why this file exists ---------------------------------------------------
 *
 * THE CORE was built as one picture: a column with time running up the middle
 * of it. That was never a limitation of the data — every page in the corpus
 * carries half a dozen other quantities, each one a plain count or a plain
 * length — it was a limitation of the geometry, which had the year baked into
 * it in four places. This file is the seam that was missing. A **measure** says
 * what the structure is arranged *by*; a **shape** says how that arrangement is
 * drawn. The two are independent, and neither one is allowed to invent a
 * number.
 *
 * ---- THE RULE, applied here -------------------------------------------------
 *
 * Every measure below is a count, a date or a length, taken over the whole
 * corpus with nothing excluded and nothing weighted. There is no measure of
 * quality, no measure of importance, and there will not be one: the corpus does
 * carry an `importance` field, and it is somebody's opinion typed into
 * front-matter, so it filters the picture and never positions it. Each measure
 * states its own `kind` out loud and the room prints it, so a reader is never
 * left guessing whether a height is evidence or a preference.
 *
 * Where a page has no value for a measure — 6 pages the record dates nowhere,
 * 312 with no documented range — it rests at the floor and is *counted* there
 * rather than dropped. A page at the bottom of the span axis is not a page with
 * a short span; it is a page with no recorded span, and the room says which.
 *
 * ---- linear against rank ----------------------------------------------------
 *
 * Every one of these distributions is savagely skewed: the median page is 744
 * words and the longest is 113,514, so a linear word axis is one dot at the top
 * and 490 in a stripe at the bottom. That stripe is a true reading and it is
 * the default, for the same reason the year axis draws the empty century at its
 * true height — compressing it would be a lie about the corpus.
 *
 * `rank` is offered beside it, and it is not a transform of the value: it is a
 * *different count*. A page's rank position is the number of pages at or below
 * it, which is itself a count over the whole corpus with nothing weighted, so it
 * passes the rule on its own terms. The room labels which one is on, always,
 * because the two pictures look nothing alike and only one of them has the
 * outlier in it.
 */

import type { CoreNode, Structure } from './data'

/* ==========================================================================
   MEASURES — what the structure is arranged by
   ========================================================================== */

export type MeasureId =
  | 'year'
  | 'words'
  | 'edges'
  | 'in'
  | 'out'
  | 'gaps'
  | 'sources'
  | 'span'

export type Scale = 'linear' | 'rank'

/** Per-node quantities that are not on the node itself, derived once. */
export type Derived = {
  /** typed edges in + out, per node. */ degree: Int32Array
  /** distinct raw corpora the page cites, per node. */ sources: Int32Array
}

export type Measure = {
  id: MeasureId
  /** What the axis is called on the picture. */
  label: string
  /** What kind of number it is — printed verbatim, never abbreviated away. */
  kind: 'a date' | 'a count' | 'a length'
  /** One line saying exactly what is being counted. */
  says: string
  /** What a page with no value is missing — printed where the floor is named. */
  absent: string
  /**
   * A fixed range to place against, where the corpus's own min and max are not
   * the honest bounds. Only the date has one: the column has been ruled 1892 →
   * 2027 since the room was built, the 134,348-mark sheath is placed against
   * exactly that ruling, and re-fitting the axis to the data would shift every
   * page a few units off the record it is drawn beside.
   */
  domain?: [number, number]
  of: (n: CoreNode, d: Derived) => number | null
  format: (v: number) => string
}

const int = (v: number) => Math.round(v).toLocaleString()

/** A fractional year as `YYYY-MM`, the same way the room already prints one. */
export const yearLabel = (t: number) => {
  const y = Math.floor(t)
  const m = Math.round((t - y) * 12) + 1
  return `${y}-${String(Math.min(12, Math.max(1, m))).padStart(2, '0')}`
}

export const MEASURES: Measure[] = [
  {
    id: 'year',
    label: 'THE DATE',
    kind: 'a date',
    says: 'the date the record gives the page',
    absent: 'the record dates it nowhere',
    of: (n) => n.t,
    format: yearLabel,
    domain: [1892, 2027],
  },
  {
    id: 'words',
    label: 'LENGTH',
    kind: 'a length',
    says: 'how many words are on the page',
    absent: 'the page is empty',
    of: (n) => n.w,
    format: (v) => `${int(v)} words`,
  },
  {
    id: 'edges',
    label: 'ARGUED DEGREE',
    kind: 'a count',
    says: 'typed connections into and out of the page — every one carrying a claim',
    absent: 'nothing argues with it',
    of: (n, d) => d.degree[n.i],
    format: (v) => `${int(v)} argued edges`,
  },
  {
    id: 'in',
    label: 'BACKLINKS',
    kind: 'a count',
    says: 'wikilinks pointing at the page from elsewhere in the corpus',
    absent: 'nothing links to it',
    of: (n) => n.bl,
    format: (v) => `${int(v)} in`,
  },
  {
    id: 'out',
    label: 'OUTLINKS',
    kind: 'a count',
    says: 'wikilinks the page makes to other pages',
    absent: 'it links to nothing',
    of: (n) => n.ol,
    format: (v) => `${int(v)} out`,
  },
  {
    id: 'gaps',
    label: 'DECLARED GAPS',
    kind: 'a count',
    says: 'knowledge gaps the page declares about itself, in its own words',
    absent: 'it declares none',
    of: (n) => n.g,
    format: (v) => `${int(v)} declared gaps`,
  },
  {
    id: 'sources',
    label: 'SOURCES CITED',
    kind: 'a count',
    says: 'distinct raw corpora the page rests on',
    absent: 'it cites no raw corpus',
    of: (n, d) => d.sources[n.i],
    format: (v) => `${int(v)} corpora`,
  },
  {
    id: 'span',
    label: 'DOCUMENTED SPAN',
    kind: 'a length',
    says: 'how many years the page’s documented date range covers',
    absent: 'the page carries no documented date range',
    of: (n) => (n.a === null || n.b === null ? null : n.b - n.a),
    format: (v) =>
      v < 1 ? `${Math.round(v * 12)} months` : `${v.toFixed(v < 10 ? 1 : 0)} years`,
  },
]

export const measureById = (id: MeasureId) => MEASURES.find((m) => m.id === id) ?? MEASURES[0]

/** The two quantities no node carries directly. Cheap, and computed once. */
export function derive(structure: Structure): Derived {
  const N = structure.nodes.length
  const degree = new Int32Array(N)
  const sources = new Int32Array(N)
  for (const [from, to] of structure.typed) {
    degree[from]++
    degree[to]++
  }
  for (const [node] of structure.nodeRoots) sources[node]++
  return { degree, sources }
}

/* ==========================================================================
   THE AXIS a measure produces
   ========================================================================== */

export type Axis = {
  measure: Measure
  scale: Scale
  /** Raw value per node — null where the record gives the page none. */
  value: (number | null)[]
  /** Where each node sits on the axis, 0 → 1. A missing value rests at 0. */
  t: Float64Array
  lo: number
  hi: number
  /** How many pages have no value at all, and therefore rest at the floor. */
  missing: number
  /** Where to draw a reference ring, and what to call it. */
  ticks: { t: number; label: string }[]
}

/** A 1 / 2 / 5 ladder, so a count axis is ticked at numbers people say. */
function step(span: number, want: number) {
  const raw = span / Math.max(1, want)
  const mag = Math.pow(10, Math.floor(Math.log10(Math.max(1e-9, raw))))
  for (const m of [1, 2, 5, 10]) if (raw <= mag * m) return mag * m
  return mag * 10
}

/**
 * Place every page on the axis a measure describes.
 *
 * `linear` is the value against the true range, outliers and all. `rank` is the
 * page's position in the sorted order — ties share a position, so 296 pages
 * with zero declared gaps sit on one ring rather than being spread across a
 * sixth of the axis by an ordering nothing in the record justifies.
 */
export function buildAxis(structure: Structure, id: MeasureId, scale: Scale, d: Derived): Axis {
  const measure = measureById(id)
  const nodes = structure.nodes
  const N = nodes.length
  const value = nodes.map((n) => measure.of(n, d))
  const present = value.filter((v): v is number => v !== null)
  const lo = measure.domain ? measure.domain[0] : present.length ? Math.min(...present) : 0
  const hi = measure.domain ? measure.domain[1] : present.length ? Math.max(...present) : 1
  const t = new Float64Array(N)
  const ticks: { t: number; label: string }[] = []

  if (scale === 'rank') {
    // Rank by value, ties sharing a position. The denominator is the number of
    // *distinct* values, so the axis is the ladder of values the corpus
    // actually contains rather than a queue of pages.
    const distinct = [...new Set(present)].sort((a, b) => a - b)
    const at = new Map(distinct.map((v, i) => [v, distinct.length > 1 ? i / (distinct.length - 1) : 0]))
    for (let i = 0; i < N; i++) t[i] = value[i] === null ? 0 : at.get(value[i] as number)!
    const want = Math.min(8, distinct.length)
    for (let k = 0; k < want; k++) {
      const idx = Math.round((k / Math.max(1, want - 1)) * (distinct.length - 1))
      ticks.push({ t: at.get(distinct[idx])!, label: measure.format(distinct[idx]) })
    }
  } else {
    const span = hi - lo || 1
    for (let i = 0; i < N; i++) t[i] = value[i] === null ? 0 : ((value[i] as number) - lo) / span
    if (id === 'year') {
      // Decades, the way the column has always been ruled.
      const first = Math.ceil(lo / 10) * 10
      for (let y = first; y <= hi; y += 10) ticks.push({ t: (y - lo) / span, label: String(y) })
    } else {
      const s = step(span, 6)
      for (let v = Math.ceil(lo / s) * s; v <= hi + 1e-9; v += s)
        ticks.push({ t: (v - lo) / span, label: measure.format(v) })
    }
  }

  return {
    measure,
    scale,
    value,
    t,
    lo,
    hi,
    missing: N - present.length,
    ticks: ticks.filter((k) => k.t >= 0 && k.t <= 1),
  }
}

/* ==========================================================================
   SHAPES — how that arrangement is drawn
   ========================================================================== */

export type ShapeId = 'column' | 'helix' | 'sphere' | 'disc' | 'rings'

/** What the force solver hands a shape: a settled bearing and a settled depth. */
export type Seat = {
  /** The measure, 0 → 1. The only part of this that is data. */ t: number
  /** Bearing chosen by the solver, radians. */ angle: number
  /** Depth chosen by the solver, 0 → 1. */ depth: number
  /** The solver's radius in world units, before the band was normalised. */ radius: number
  /** Which facet group the page is in, and how many groups there are. */
  group: number
  groups: number
}

export type Shape = {
  id: ShapeId
  label: string
  /** What the reader is looking at, in one sentence. */
  says: string
  /** What the *drawing* does with everything the measure did not decide. */
  drawing: string
  /** Where the camera goes to see all of it. */
  home: { height: number; distance: number }
  /** True when the measure runs up the world's vertical, so the sheath can share it. */
  vertical: boolean
  /** True when the shape groups pages by domain rather than letting them mix. */
  grouped: boolean
  place: (s: Seat) => [number, number, number]
  /** A reference ring at axis position `t`: its height and its radius. */
  ring: (t: number) => { y: number; r: number }
  /** What an edge bows away from: the vertical axis, or the centre of the world. */
  bow: 'axis' | 'centre'
}

/** The column's height, unchanged — 1892 to 2027 at 1,900 units, as it was. */
export const HEIGHT = 1900
/** Where the solver's depth band sits, in world units, on the column. */
export const NEAR = 66
export const FAR = 232

const TURNS = 3.5

export const SHAPES: Shape[] = [
  {
    id: 'column',
    label: 'COLUMN',
    says: 'the measure runs up the middle and the pages settle on their own ring of it',
    drawing: 'where a page sits on its ring is the force solver’s opinion and means nothing',
    home: { height: 0, distance: 2350 },
    vertical: true,
    grouped: false,
    // The one shape that reads the solver's radius raw rather than the
    // normalised band, so this stays the picture the room has always drawn.
    place: ({ t, angle, radius }) => [
      Math.sin(angle) * radius,
      (t - 0.5) * HEIGHT,
      Math.cos(angle) * radius,
    ],
    ring: (t) => ({ y: (t - 0.5) * HEIGHT, r: 11 }),
    bow: 'axis',
  },
  {
    id: 'helix',
    label: 'HELIX',
    says: 'the same axis, wound — the measure turns the bearing as well as raising the height',
    drawing: `${TURNS} turns end to end, chosen because it reads; the depth is still the solver’s`,
    home: { height: 0, distance: 2350 },
    vertical: true,
    grouped: false,
    place: ({ t, angle, depth }) => {
      const a = angle * 0.22 + t * TURNS * Math.PI * 2
      const r = 150 + depth * 78
      return [Math.sin(a) * r, (t - 0.5) * HEIGHT, Math.cos(a) * r]
    },
    ring: (t) => ({ y: (t - 0.5) * HEIGHT, r: 14 }),
    bow: 'axis',
  },
  {
    id: 'sphere',
    label: 'SPHERE',
    says: 'the measure is latitude — the floor is the south pole and the ceiling is the north',
    drawing: 'bearing and altitude are the solver’s; a crowded pole is a crowded measure',
    home: { height: 0, distance: 2100 },
    vertical: false,
    grouped: false,
    place: ({ t, angle, depth }) => {
      const R = 620 + depth * 300
      const phi = (t - 0.5) * Math.PI
      const rr = Math.cos(phi) * R
      return [Math.sin(angle) * rr, Math.sin(phi) * R, Math.cos(angle) * rr]
    },
    ring: (t) => {
      const phi = (t - 0.5) * Math.PI
      return { y: Math.sin(phi) * 770, r: Math.cos(phi) * 770 }
    },
    bow: 'centre',
  },
  {
    id: 'disc',
    label: 'DISC',
    says: 'the measure reads outward — the floor is the hub and the ceiling is the rim',
    drawing: 'bearing is the solver’s; the slight thickness is its depth, so the disc is not one plane',
    home: { height: 0, distance: 2000 },
    vertical: false,
    grouped: false,
    place: ({ t, angle, depth }) => {
      const rr = 130 + t * 800
      return [Math.sin(angle) * rr, (depth - 0.5) * 110, Math.cos(angle) * rr]
    },
    ring: (t) => ({ y: 0, r: 130 + t * 800 }),
    bow: 'centre',
  },
  {
    id: 'rings',
    label: 'RINGS',
    says: 'one column per domain, stood in a circle — the same measure, ten times, side by side',
    drawing: 'which domain stands where is alphabetical; the bearing inside a column is the solver’s',
    home: { height: 0, distance: 2500 },
    vertical: true,
    grouped: true,
    place: ({ t, angle, depth, group, groups }) => {
      const a = (group / Math.max(1, groups)) * Math.PI * 2
      const cx = Math.sin(a) * 560
      const cz = Math.cos(a) * 560
      const r = 34 + depth * 62
      return [cx + Math.sin(angle) * r, (t - 0.5) * HEIGHT * 0.82, cz + Math.cos(angle) * r]
    },
    ring: (t) => ({ y: (t - 0.5) * HEIGHT * 0.82, r: 680 }),
    bow: 'axis',
  },
]

export const shapeById = (id: ShapeId) => SHAPES.find((s) => s.id === id) ?? SHAPES[0]
