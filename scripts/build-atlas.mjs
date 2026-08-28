/**
 * Bakes ◈ CORPUS IV · THE ATLAS.
 *
 *   npm run atlas                          # from the vendored wiki snapshot
 *   npm run atlas -- ../location-export    # from a real Google Takeout timeline
 *
 * ---- the thing this instrument has to say about itself ---------------------
 *
 * THE ATLAS was SEALED for a year with one line under it: *the location
 * history is not vendored here and is not something this site is going to
 * publish.* That is still true. 6,227 raw fixes are a map of where somebody
 * slept, and they are not going in a public JSON.
 *
 * What **is** already published, on `wiki/self/location-history` and
 * `wiki/self/context-core`, is the arithmetic over those fixes: how many
 * visits fell in each of eleven years, how many landed on each of twenty-one
 * named addresses, and which address was home in which stretch of the decade.
 * Those tables are the corpus this build reads. The map is drawn from them.
 *
 * So the instrument is a **reconstruction**, and it says so on its face, in
 * three registers:
 *
 *   1. Every aggregate it replays is exact. Year totals are the published year
 *      totals. Per-address totals are the published per-address totals. The
 *      residence timeline is the canonical one, to the day where the wiki
 *      gives a day.
 *   2. Every individual day is a draw. Which Tuesday in March 2017 the CVS
 *      visit fell on is not in the record and is not knowable from it; it is
 *      sampled, from a fixed seed, so the same Tuesday comes out of every
 *      build. The instrument prints RECONSTRUCTED on every frame.
 *   3. The base map is drawn by hand — see `atlas-geography.mjs`. No road on
 *      it was surveyed.
 *
 * If a real export is handed to the script it takes that instead, marks the
 * dataset `source: "export"`, and the instrument stops printing RECONSTRUCTED.
 * The reconstruction is the fallback, not the point.
 *
 * ---- how the day-by-day is arrived at -------------------------------------
 *
 * A transportation problem, solved rather than guessed. The published tables
 * give two margins over the same 6,227 visits: one per year, one per address.
 * Iterative proportional fitting finds the visit matrix that hits both margins
 * at once, against a weight field that is only ever *era mask × published
 * total* — no address is nudged toward a year because it would look better
 * there. The residual (visits in a year that no published address claims) is
 * the 1,891 the tables leave unnamed, and it is drawn as unnamed pins rather
 * than given invented names.
 *
 * Then each cell of that matrix is scattered over the days of its year by a
 * seeded propensity field, days are ordered into a plausible walk out from
 * home and back, and clocks are hung on them. That last step is the invented
 * one and it is the one the instrument keeps saying is invented.
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { GEOGRAPHY } from './atlas-geography.mjs'

const OUT = 'public/leviathan'
const WIKI = 'public/wiki/pages'
const SEED = 0x0a71a5 // "atlas". Fixed, so every build draws the same decade.

/* ==========================================================================
   THE PUBLISHED TABLES

   Transcribed from wiki/self/location-history and wiki/self/context-core, and
   checked against them at the bottom of this file: if the wiki page stops
   saying 6,227, this build refuses to write.
   ========================================================================== */

/** Place visits per year, from the semantic-location database. */
const YEARS = {
  2014: 108, 2015: 23, 2016: 531, 2017: 1111, 2018: 1716, 2019: 809,
  2020: 121, 2021: 257, 2022: 806, 2023: 728, 2024: 17,
}

/**
 * Visits per named address. `id` keys into the geography's pins.
 *
 * Two entries in the published table are one door: "Au Za'atar (and Midtown
 * East)" at 445 and "1063 1st Ave." at 201 are the same restaurant under its
 * name and under its address, which the page itself notes. They are summed
 * here and the sum is printed on the instrument, rather than drawing one
 * building twice.
 */
const NAMED = [
  ['307-e76', 1082], ['155-virginia', 849], ['au-zaatar', 646], ['337-saratoga', 415],
  ['117-belmont', 246], ['73-smith-school', 206], ['mcdonalds-un', 130], ['147-virginia', 128],
  ['cvs-un', 126], ['1396-2nd', 121], ['uniontown-cc', 82], ['keybank-un', 66],
  ['shepherds-rock', 50], ['vapor-hut', 34], ['sunoco-un', 30], ['nemacolin', 28],
  ['pls-check', 28], ['walgreens-ny', 24], ['walmart-un', 23], ['sheetz-un', 22],
]

/**
 * The canonical residence timeline, from context-core, clipped to the years
 * the export covers. `since` is the first day the base is that address.
 *
 * The one date the wiki does not give is the move from 337 Saratoga to 155
 * Virginia Avenue inside the 2013–2019 Uniontown stretch: the page gives the
 * stretch and the order, not the day. 2016-07-01 is this build's assumption
 * and is flagged as one in the dataset and on the instrument.
 */
const BASES = [
  { since: '2014-04-02', place: '337-saratoga', region: 'fayette', assumed: false },
  { since: '2016-07-01', place: '155-virginia', region: 'fayette', assumed: true },
  { since: '2019-02-22', place: '307-e76', region: 'manhattan', assumed: false },
]

/** The whole documented residence spine, for the strip under the playhead. */
const ERAS = [
  ['1988-11-01', '1996-01-01', 'Uniontown · 12 Bryer Ave', '12-bryer'],
  ['1996-01-01', '2008-09-01', 'Uniontown · 337 Saratoga Dr', '337-saratoga'],
  ['2008-09-01', '2010-04-01', 'Winter Park FL · Full Sail', null],
  ['2010-04-01', '2013-05-01', 'Brooklyn · 424 Bedford Ave → Manhattan', '424-bedford'],
  ['2013-05-01', '2019-02-22', 'Uniontown · 337 Saratoga → 155 Virginia', '155-virginia'],
  ['2019-02-22', '2025-02-22', 'Manhattan · 307 E 76th St', '307-e76'],
  ['2025-02-22', '2026-06-01', 'Uniontown · 337 Saratoga Drive', '337-saratoga'],
  ['2026-06-01', '2026-08-28', 'Uniontown · 463 Morgantown St', null],
]

const SPAN = { from: '2014-04-02', to: '2024-12-31' }

/* ==========================================================================
   SMALL TOOLS
   ========================================================================== */

/** mulberry32. Deterministic, seeded, and the same on every machine. */
function rng(seed) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/**
 * Dates are sliced out of the string, never handed to `Date()` for parsing —
 * the same rule THE CLOCK gives. Day numbers here are days since the epoch,
 * computed arithmetically, so no runtime's idea of a timezone can move one.
 */
const dayNo = (iso) => {
  const y = +iso.slice(0, 4)
  const m = +iso.slice(5, 7)
  const d = +iso.slice(8, 10)
  return Math.floor(Date.UTC(y, m - 1, d) / 86400000)
}
const isoOf = (n) => new Date(n * 86400000).toISOString().slice(0, 10)
const yearOf = (n) => +isoOf(n).slice(0, 4)

const round = (n, p = 5) => Math.round(n * 10 ** p) / 10 ** p

/* ==========================================================================
   THE PROJECTION AND THE GRAPH

   Every road is a polyline of [lon, lat]. Vertices that are the same point are
   the same node — which is why the geography file is written so that a
   crossing is typed as one coordinate in both roads. Edges are consecutive
   vertices along a road, weighted by how long they take rather than how long
   they are, so a route out of Uniontown takes the turnpike instead of walking
   the National Pike the whole way.
   ========================================================================== */

const LAT0 = 40.0
const MX = 111320 * Math.cos((LAT0 * Math.PI) / 180)
const MY = 111320
const flat = (lon, lat) => [lon * MX, lat * MY]
const metres = (a, b) => {
  const [ax, ay] = flat(a[0], a[1])
  const [bx, by] = flat(b[0], b[1])
  return Math.hypot(ax - bx, ay - by)
}

/** km/h, by what the road is. Nothing here is a measurement; it is a drawing. */
const SPEED = {
  interstate: 105, highway: 88, us: 72, state: 60, local: 42,
  crosstown: 22, avenue: 24, street: 18,
}

function buildGraph(roads) {
  const nodes = []
  const index = new Map()
  const at = (pt) => {
    const key = `${round(pt[0])},${round(pt[1])}`
    let i = index.get(key)
    if (i === undefined) {
      i = nodes.length
      nodes.push([round(pt[0]), round(pt[1])])
      index.set(key, i)
    }
    return i
  }

  const edges = []
  const edgeKey = new Map()
  const adj = []
  const touch = (i) => {
    while (adj.length <= i) adj.push([])
  }

  roads.forEach((road, roadIdx) => {
    let prev = at(road.pts[0])
    for (let k = 1; k < road.pts.length; k++) {
      const cur = at(road.pts[k])
      if (cur === prev) continue
      const key = prev < cur ? `${prev}-${cur}` : `${cur}-${prev}`
      let e = edgeKey.get(key)
      if (e === undefined) {
        const len = metres(nodes[prev], nodes[cur])
        e = edges.length
        edges.push({ a: prev, b: cur, len, road: roadIdx, kind: road.kind })
        edgeKey.set(key, e)
        touch(prev)
        touch(cur)
        adj[prev].push(e)
        adj[cur].push(e)
      }
      prev = cur
    }
  })
  touch(nodes.length - 1)
  return { nodes, edges, adj }
}

/** Dijkstra on travel time. Returns the node path, or null if unreachable. */
function route(graph, from, to) {
  if (from === to) return [from]
  const { edges, adj, nodes } = graph
  const dist = new Float64Array(nodes.length).fill(Infinity)
  const prev = new Int32Array(nodes.length).fill(-1)
  const seen = new Uint8Array(nodes.length)
  dist[from] = 0
  // A binary heap, because the corridor graph is a few thousand nodes and this
  // is run a few hundred times.
  const heap = [[0, from]]
  const push = (item) => {
    heap.push(item)
    let i = heap.length - 1
    while (i > 0) {
      const p = (i - 1) >> 1
      if (heap[p][0] <= heap[i][0]) break
      ;[heap[p], heap[i]] = [heap[i], heap[p]]
      i = p
    }
  }
  const pop = () => {
    const top = heap[0]
    const last = heap.pop()
    if (heap.length) {
      heap[0] = last
      let i = 0
      for (;;) {
        const l = i * 2 + 1
        const r = l + 1
        let s = i
        if (l < heap.length && heap[l][0] < heap[s][0]) s = l
        if (r < heap.length && heap[r][0] < heap[s][0]) s = r
        if (s === i) break
        ;[heap[s], heap[i]] = [heap[i], heap[s]]
        i = s
      }
    }
    return top
  }

  while (heap.length) {
    const [d, u] = pop()
    if (seen[u]) continue
    seen[u] = 1
    if (u === to) break
    for (const e of adj[u] ?? []) {
      const edge = edges[e]
      const v = edge.a === u ? edge.b : edge.a
      if (seen[v]) continue
      const cost = d + edge.len / ((SPEED[edge.kind] ?? 40) / 3.6)
      if (cost < dist[v]) {
        dist[v] = cost
        prev[v] = u
        push([cost, v])
      }
    }
  }

  if (!Number.isFinite(dist[to])) return null
  const path = [to]
  for (let u = to; prev[u] !== -1; u = prev[u]) path.push(prev[u])
  return path.reverse()
}

const nearestNode = (graph, lon, lat) => {
  let best = -1
  let bestD = Infinity
  for (let i = 0; i < graph.nodes.length; i++) {
    const d = metres(graph.nodes[i], [lon, lat])
    if (d < bestD) {
      bestD = d
      best = i
    }
  }
  return { node: best, off: Math.round(bestD) }
}

/* ==========================================================================
   THE PINS

   The named ones come from the geography. The unnamed ones are generated onto
   real road nodes inside each region, because that is what the record says
   they are: a visit that happened, at a place Google would not name.
   ========================================================================== */

function buildPlaces(graph, geo) {
  const places = geo.places.map((p) => ({
    id: p.id,
    name: p.name,
    kind: p.kind,
    page: p.page,
    note: p.note,
    lon: p.lon,
    lat: p.lat,
    named: true,
    ...nearestNode(graph, p.lon, p.lat),
  }))

  const inBounds = (b, lon, lat) => lon >= b[0] && lon <= b[2] && lat >= b[1] && lat <= b[3]
  const random = rng(SEED ^ 0x5eed)

  for (const [region, count] of Object.entries(geo.unnamed)) {
    const bounds = geo.unnamedCore[region] ?? geo.regions.find((r) => r.id === region).bounds
    const pool = graph.nodes
      .map((n, i) => [n, i])
      .filter(([n]) => inBounds(bounds, n[0], n[1]))
    for (let k = 0; k < count; k++) {
      const [node, idx] = pool[Math.floor(random() * pool.length)]
      places.push({
        id: `unnamed-${region}-${k}`,
        name: 'UNNAMED',
        kind: 'unnamed',
        page: 'self/location-history',
        note: null,
        lon: node[0],
        lat: node[1],
        named: false,
        node: idx,
        off: 0,
        region,
      })
    }
  }

  for (const p of places) {
    if (p.region) continue
    p.region =
      geo.regions.find((r) => r.id !== 'corridor' && inBounds(r.bounds, p.lon, p.lat))?.id ??
      'corridor'
  }
  return places
}

/* ==========================================================================
   THE MATRIX

   Iterative proportional fitting: find X[place][year] whose rows sum to the
   published per-address totals and whose columns sum to the published
   per-year totals. The seed field is the era mask — 1 where the address was
   reachable from that year's home, 0.1 for a Fayette County address during
   the New York years (which is what a trip home is), 0 where the address did
   not exist yet.
   ========================================================================== */

function fit(rows, cols, weight) {
  const R = rows.length
  const C = cols.length
  const x = weight.map((r) => r.slice())
  for (let pass = 0; pass < 400; pass++) {
    for (let i = 0; i < R; i++) {
      const s = x[i].reduce((a, b) => a + b, 0)
      if (s > 0) for (let j = 0; j < C; j++) x[i][j] *= rows[i] / s
    }
    for (let j = 0; j < C; j++) {
      let s = 0
      for (let i = 0; i < R; i++) s += x[i][j]
      if (s > 0) for (let i = 0; i < R; i++) x[i][j] *= cols[j] / s
    }
  }

  // Integerise without losing either margin: floor, then hand the residual to
  // the largest fractions whose row and column both still owe one.
  const out = x.map((r) => r.map(Math.floor))
  const rowShort = rows.map((t, i) => t - out[i].reduce((a, b) => a + b, 0))
  const colShort = cols.map((t, j) => t - out.reduce((a, r) => a + r[j], 0))
  const cells = []
  for (let i = 0; i < R; i++)
    for (let j = 0; j < C; j++) if (weight[i][j] > 0) cells.push([x[i][j] % 1, i, j])
  cells.sort((a, b) => b[0] - a[0])
  let moved = true
  while (moved) {
    moved = false
    for (const [, i, j] of cells) {
      if (rowShort[i] > 0 && colShort[j] > 0) {
        out[i][j]++
        rowShort[i]--
        colShort[j]--
        moved = true
      }
    }
  }

  /**
   * What is left over after that pass is structurally stuck rather than
   * rounded wrong: an address that owes one more visit and a year that owes
   * one more, where the address was nowhere near that year. Walgreens on East
   * 86th Street owes a visit and 2016 owes a visit, and he did not live in
   * New York in 2016.
   *
   * The fix is not to fudge either margin — both are published numbers — but
   * to route around the zero: give the address its visit in a year it *was*
   * there, take that year's visit off some other address that can carry one in
   * the year that is short, and give it to them there. Two moves, both
   * margins intact, and no visit invented or destroyed.
   */
  for (let i = 0; i < R; i++) {
    while (rowShort[i] > 0) {
      const j = colShort.findIndex((n) => n > 0)
      if (j < 0) break
      if (weight[i][j] > 0) {
        out[i][j]++
        rowShort[i]--
        colShort[j]--
        continue
      }
      let done = false
      for (let j2 = 0; j2 < C && !done; j2++) {
        if (weight[i][j2] <= 0) continue
        for (let i2 = 0; i2 < R && !done; i2++) {
          if (i2 === i || out[i2][j2] <= 0 || weight[i2][j] <= 0) continue
          out[i][j2]++
          out[i2][j2]--
          out[i2][j]++
          rowShort[i]--
          colShort[j]--
          done = true
        }
      }
      if (!done) break
    }
  }
  return out
}

/* ==========================================================================
   THE DAYS
   ========================================================================== */

/** How long somebody stays, by what the place is. Minutes, drawn not measured. */
const DWELL = {
  home: [45, 240], work: [180, 460], family: [60, 300], leisure: [70, 260],
  errand: [8, 35], local: [20, 90], transit: [10, 40], unnamed: [12, 75],
}

function buildDays({ graph, places, matrix, byIndex, from, to }) {
  const random = rng(SEED)
  const idxOf = new Map(places.map((p, i) => [p.id, i]))

  // Which address is home on a given day.
  const baseOn = (day) => {
    let base = BASES[0]
    for (const b of BASES) if (day >= dayNo(b.since)) base = b
    return base
  }

  // Trip windows: the stretches during the New York years when the Fayette
  // County pins are the ones being visited. Two or three a year, three to six
  // days each — which is the shape a drive home has, and it is a shape, not a
  // record of one.
  const trips = []
  for (let y = 2019; y <= 2024; y++) {
    const n = 2 + Math.floor(random() * 3)
    for (let k = 0; k < n; k++) {
      const start = dayNo(`${y}-01-01`) + Math.floor(random() * 360)
      const len = 3 + Math.floor(random() * 5)
      trips.push([start, start + len])
    }
  }
  const onTrip = (day) => trips.some(([a, b]) => day >= a && day <= b)

  // Scatter each cell of the matrix over the days of its year.
  const perDay = new Map() // day -> [placeIdx, ...]
  const years = Object.keys(YEARS).map(Number)
  years.forEach((year, col) => {
    const first = Math.max(from, dayNo(`${year}-01-01`))
    const last = Math.min(to, dayNo(`${year}-12-31`))
    const days = []
    for (let d = first; d <= last; d++) days.push(d)

    // A propensity field over the year: some days are busy, most are not, and
    // the shape of that is seeded rather than uniform.
    const heat = days.map(() => 0.15 + random() ** 2.2 * 2.4)

    for (let row = 0; row < matrix.length; row++) {
      const count = matrix[row][col]
      if (!count) continue
      const place = byIndex[row]
      if (place === null) continue // the unnamed row is expanded below
      const p = places[place]
      const weights = days.map((d, k) => {
        const home = baseOn(d)
        // A trip home is a Fayette County day even though home is on 76th St.
        const trip = onTrip(d) && home.region !== 'fayette'
        const where = trip ? 'fayette' : home.region
        if (p.region !== where) return 0
        return trip ? heat[k] * 3 : heat[k]
      })
      const total = weights.reduce((a, b) => a + b, 0)
      if (total <= 0) continue
      for (let n = 0; n < count; n++) {
        let r = random() * total
        let k = 0
        while (k < days.length - 1 && (r -= weights[k]) > 0) k++
        const day = days[k]
        if (!perDay.has(day)) perDay.set(day, [])
        perDay.get(day).push(place)
      }
    }

    // The unnamed row, spread over the unnamed pins of whichever region the
    // day is in. They are one row in the matrix because the published table
    // gives them as one number.
    const unnamedRow = matrix[matrix.length - 1][col]
    const pool = { fayette: [], manhattan: [], brooklyn: [] }
    places.forEach((p, i) => {
      if (!p.named && pool[p.region]) pool[p.region].push(i)
    })
    for (let n = 0; n < unnamedRow; n++) {
      let r = random() * heat.reduce((a, b) => a + b, 0)
      let k = 0
      while (k < days.length - 1 && (r -= heat[k]) > 0) k++
      const day = days[k]
      const home = baseOn(day)
      const region = onTrip(day) && home.region !== 'fayette' ? 'fayette' : home.region
      const bucket = pool[region] ?? pool.fayette
      const place = bucket[Math.floor(random() * bucket.length)]
      if (!perDay.has(day)) perDay.set(day, [])
      perDay.get(day).push(place)
    }
  })

  // Order each day into a walk out from home and back, and hang a clock on it.
  const routes = new Map()
  const routeBetween = (a, b) => {
    const key = a <= b ? `${a}>${b}` : `${b}>${a}`
    if (!routes.has(key)) {
      const path = route(graph, places[a <= b ? a : b].node, places[a <= b ? b : a].node)
      routes.set(key, path)
    }
    const path = routes.get(key)
    if (!path) return null
    return a <= b ? path : [...path].reverse()
  }
  const legMinutes = (path) => {
    if (!path || path.length < 2) return 4
    let secs = 0
    for (let i = 1; i < path.length; i++) {
      const e = graph.edges.find(
        (x) =>
          (x.a === path[i - 1] && x.b === path[i]) || (x.b === path[i - 1] && x.a === path[i]),
      )
      if (!e) continue
      secs += e.len / ((SPEED[e.kind] ?? 40) / 3.6)
    }
    return Math.max(3, Math.round((secs / 60) * 1.25)) // lights, parking, the rest of it
  }

  // A cache, because the same six legs are walked a thousand times.
  const legCache = new Map()
  const leg = (a, b) => {
    const key = `${a}>${b}`
    if (!legCache.has(key)) {
      const path = routeBetween(a, b)
      legCache.set(key, { path, mins: legMinutes(path) })
    }
    return legCache.get(key)
  }

  const days = []
  const sorted = [...perDay.keys()].sort((a, b) => a - b)
  let moveDone = false

  for (const day of sorted) {
    const home = baseOn(day)
    let baseIdx = idxOf.get(home.place)
    const stops = perDay.get(day)

    // On a trip home the base for the day is the Uniontown house, and the
    // drive down the corridor is the first leg.
    const away = stops.some((s) => places[s].region === 'fayette') && home.region !== 'fayette'
    const arriving = away && !onTrip(day - 1)
    const leaving = away && !onTrip(day + 1)
    if (away) baseIdx = idxOf.get('337-saratoga')

    // The one dated move inside the span: Feb 22 2019, Uniontown to Manhattan.
    const isMove = !moveDone && day >= dayNo('2019-02-22') && home.place === '307-e76'
    if (isMove) moveDone = true

    // Where the day starts: the bed it woke in. On the day of the move, and on
    // the first day of a trip home, that is the other end of the corridor.
    const startFrom =
      isMove || arriving
        ? idxOf.get(isMove && home.place === '307-e76' ? '337-saratoga' : '307-e76')
        : baseIdx

    // Greedy nearest-neighbour out from home over the *distinct* places of the
    // day. Not an optimisation of anything — it is the ordering a person doing
    // errands tends to fall into, and some ordering has to be chosen.
    const counts = new Map()
    for (const s of stops) counts.set(s, (counts.get(s) ?? 0) + 1)
    const distinct = [...counts.keys()]
    const order = []
    let at = baseIdx
    while (distinct.length) {
      let best = 0
      let bestD = Infinity
      for (let i = 0; i < distinct.length; i++) {
        const d = metres(
          [places[at].lon, places[at].lat],
          [places[distinct[i]].lon, places[distinct[i]].lat],
        )
        if (d < bestD) {
          bestD = d
          best = i
        }
      }
      at = distinct[best]
      order.push(at)
      distinct.splice(best, 1)
    }

    /**
     * Two visits to the same address are two visits, and the export records
     * them separately — but back to back, four minutes apart, they are not two
     * arrivals, they are one stay written down twice. So repeats are spread
     * through the day instead of stacked: take the place with the most left to
     * place that is not the one just left. Nothing is merged and nothing is
     * dropped; the count is the published count either way.
     */
    const rank = new Map(order.map((p, i) => [p, i]))
    const seq = []
    let prev = isMove || arriving ? startFrom : baseIdx
    while (seq.length < stops.length) {
      let pick = -1
      for (const [place, n] of counts) {
        if (n <= 0 || place === prev) continue
        if (
          pick < 0 ||
          n > counts.get(pick) ||
          (n === counts.get(pick) && rank.get(place) < rank.get(pick))
        )
          pick = place
      }
      if (pick < 0) pick = [...counts.keys()].find((k) => counts.get(k) > 0)
      counts.set(pick, counts.get(pick) - 1)
      seq.push(pick)
      prev = pick
    }
    // …and the last stop cannot be the bed it ends in either.
    const closing = leaving ? idxOf.get(home.place) : baseIdx
    if (seq.length > 1 && seq[seq.length - 1] === closing) {
      for (let i = seq.length - 2; i >= 0; i--) {
        if (seq[i] !== closing) {
          ;[seq[i], seq[seq.length - 1]] = [seq[seq.length - 1], seq[i]]
          break
        }
      }
    }

    // Clocks. Out in the morning, back before midnight; if the day will not
    // fit, the dwells are squeezed rather than the stops dropped.
    const line = []
    let clock = 8 * 60 + Math.floor(random() * 260)
    let cursor = isMove || arriving ? startFrom : baseIdx
    line.push([cursor, 0, clock])

    for (const stop of seq) {
      const { mins } = leg(cursor, stop)
      const arrive = clock + mins
      const [lo, hi] = DWELL[places[stop].kind] ?? DWELL.unnamed
      const stay = lo + Math.floor(random() * (hi - lo))
      const depart = arrive + stay
      line.push([stop, arrive, depart])
      clock = depart
      cursor = stop
    }

    const back = leaving ? idxOf.get(home.place) : baseIdx
    const home$ = leg(cursor, back)
    line.push([back, clock + home$.mins, 1440])

    // Squeeze if the day overran midnight. The stops stay; the standing still
    // gets shorter.
    const overrun = line[line.length - 1][1] - 1425
    if (overrun > 0) {
      const slack = line.slice(1, -1).reduce((a, s) => a + (s[2] - s[1]), 0)
      const factor = Math.max(0.15, 1 - overrun / Math.max(1, slack))
      let t = line[0][2]
      for (let i = 1; i < line.length - 1; i++) {
        const mins = leg(line[i - 1][0], line[i][0]).mins
        const stay = Math.max(4, Math.round((line[i][2] - line[i][1]) * factor))
        line[i][1] = t + mins
        line[i][2] = line[i][1] + stay
        t = line[i][2]
      }
      const last = line[line.length - 1]
      last[1] = t + leg(line[line.length - 2][0], last[0]).mins
    }

    // A day that still will not fit — a long drive with a full afternoon
    // hung off it — is clamped rather than trimmed. The stops all stay; the
    // clock stops moving at midnight.
    for (let i = 1; i < line.length; i++) {
      line[i][1] = Math.min(1439, Math.max(line[i][1], line[i - 1][2]))
      line[i][2] = Math.min(i === line.length - 1 ? 1440 : 1439, Math.max(line[i][2], line[i][1]))
    }

    days.push({
      d: day - from,
      s: line.flat(),
      ...(isMove ? { move: 1 } : {}),
      ...(away ? { trip: 1 } : {}),
    })
  }

  return { days, legCache }
}

/* ==========================================================================
   A REAL EXPORT, IF ONE IS HANDED OVER
   ========================================================================== */

function readExport(dir) {
  const stops = new Map() // "YYYY-MM-DD" -> [{name, address, lon, lat, from, to}]
  const walk = (d) => {
    for (const entry of readdirSync(d, { withFileTypes: true })) {
      const path = join(d, entry.name)
      if (entry.isDirectory()) walk(path)
      else if (entry.name.endsWith('.json') && !/^(Settings|Timeline Edits|Records)\./.test(entry.name))
        eat(path)
    }
  }
  const eat = (path) => {
    let json
    try {
      json = JSON.parse(readFileSync(path, 'utf8'))
    } catch {
      return
    }
    for (const item of json.timelineObjects ?? []) {
      const visit = item.placeVisit
      if (!visit?.location) continue
      const start = visit.duration?.startTimestamp ?? visit.duration?.startTimestampMs
      if (!start) continue
      const iso = String(start).length > 12 ? String(start).slice(0, 10) : null
      const day = iso ?? new Date(Number(start)).toISOString().slice(0, 10)
      const rec = {
        name: visit.location.name ?? null,
        address: visit.location.address ?? null,
        lon: (visit.location.longitudeE7 ?? 0) / 1e7,
        lat: (visit.location.latitudeE7 ?? 0) / 1e7,
        from: minutesOf(visit.duration?.startTimestamp),
        to: minutesOf(visit.duration?.endTimestamp),
      }
      if (!rec.lon || !rec.lat) continue
      if (!stops.has(day)) stops.set(day, [])
      stops.get(day).push(rec)
    }
  }
  const minutesOf = (stamp) => {
    if (!stamp) return null
    const s = String(stamp)
    if (s.includes('T')) return +s.slice(11, 13) * 60 + +s.slice(14, 16)
    return null
  }
  walk(dir)
  return stops
}

/* ==========================================================================
   BUILD
   ========================================================================== */

const handed = process.argv[2]
const geo = GEOGRAPHY
const graph = buildGraph(geo.roads)
const places = buildPlaces(graph, geo)

// The wiki is the corpus. If it stops saying what this build transcribed, the
// build stops too rather than shipping a stale number under a live label.
const page = join(WIKI, 'self__location-history.json')
let checked = false
if (existsSync(page)) {
  const body = JSON.parse(readFileSync(page, 'utf8')).body ?? ''
  const total = Object.values(YEARS).reduce((a, b) => a + b, 0)
  const missing = [String(total), '6,227'].filter((n) => !body.includes(n))
  if (missing.length) {
    console.error(`wiki/self/location-history no longer states ${missing.join(', ')}.`)
    console.error('The published tables moved. Re-transcribe YEARS/NAMED before rebuilding.')
    process.exit(1)
  }
  checked = true
}

const from = dayNo(SPAN.from)
const to = dayNo(SPAN.to)
const total = Object.values(YEARS).reduce((a, b) => a + b, 0)

// ---- the matrix -----------------------------------------------------------
const idxOf = new Map(places.map((p, i) => [p.id, i]))
const rowsIds = NAMED.map(([id]) => id)
const byIndex = [...rowsIds.map((id) => idxOf.get(id)), null] // last row is UNNAMED
const rowTotals = [...NAMED.map(([, n]) => n), total - NAMED.reduce((a, [, n]) => a + n, 0)]
const yearList = Object.keys(YEARS).map(Number)
const colTotals = yearList.map((y) => YEARS[y])

const daysIn = (year, region) => {
  let n = 0
  const first = Math.max(from, dayNo(`${year}-01-01`))
  const last = Math.min(to, dayNo(`${year}-12-31`))
  for (let d = first; d <= last; d++) {
    let base = BASES[0]
    for (const b of BASES) if (d >= dayNo(b.since)) base = b
    if (base.region === region) n++
  }
  return n
}

const weight = byIndex.map((place, row) => {
  const region = place === null ? null : places[place].region
  return yearList.map((year) => {
    const fay = daysIn(year, 'fayette')
    const man = daysIn(year, 'manhattan')
    if (region === null) return fay + man // unnamed follows wherever home is
    if (region === 'fayette') return fay + man * 0.05 // a trip home
    if (region === 'manhattan') return man
    return 0
  }).map((w, j) => w * (rowTotals[row] > 0 ? 1 : 0) * (colTotals[j] > 0 ? 1 : 0))
})

const matrix = fit(rowTotals, colTotals, weight)

// ---- the days -------------------------------------------------------------
let source = 'reconstruction'
let days
if (handed && existsSync(handed)) {
  const real = readExport(handed)
  if (real.size) {
    source = 'export'
    days = [...real.entries()]
      .filter(([iso]) => iso >= SPAN.from && iso <= SPAN.to)
      .sort(([a], [b]) => (a < b ? -1 : 1))
      .map(([iso, list]) => {
        const line = list
          .sort((a, b) => (a.from ?? 0) - (b.from ?? 0))
          .map((v) => {
            let best = -1
            let bestD = Infinity
            places.forEach((p, i) => {
              const d = metres([p.lon, p.lat], [v.lon, v.lat])
              if (d < bestD) {
                bestD = d
                best = i
              }
            })
            return [bestD < 220 ? best : -1, v.from ?? 0, v.to ?? (v.from ?? 0) + 30]
          })
          .filter((s) => s[0] >= 0)
        return { d: dayNo(iso) - from, s: line.flat() }
      })
      .filter((d) => d.s.length >= 6)
    console.log(`read ${real.size.toLocaleString()} days out of ${handed}`)
  } else {
    console.warn(`nothing readable under ${handed} — falling back to the reconstruction`)
  }
}
if (!days) ({ days } = buildDays({ graph, places, matrix, byIndex, from, to }))

// ---- the routes the days actually use -------------------------------------
const pairs = new Map()
for (const day of days) {
  for (let i = 3; i < day.s.length; i += 3) {
    const a = day.s[i - 3]
    const b = day.s[i]
    if (a === b) continue
    const key = a < b ? `${a}>${b}` : `${b}>${a}`
    if (!pairs.has(key)) {
      const path = route(graph, places[Math.min(a, b)].node, places[Math.max(a, b)].node)
      if (path) pairs.set(key, path)
    }
  }
}

/**
 * What each pin ended up carrying.
 *
 * The first and last entry of a day are where the day started and ended —
 * asleep at home — and they are not visits. Google counts an arrival; nobody
 * arrives at the bed they woke up in. Counting them would inflate every
 * residence by one per day and the published totals would stop matching,
 * which is exactly the check at the bottom of this file.
 */
const visits = new Array(places.length).fill(0)
for (const day of days) for (let i = 3; i < day.s.length - 3; i += 3) visits[day.s[i]]++

const set = {
  generatedAt: new Date().toISOString().slice(0, 19) + 'Z',
  source,
  /** Whether the two published tables were still on the page at build time. */
  checked,
  seed: SEED,
  span: { from: SPAN.from, to: SPAN.to, days: to - from + 1, from0: from },
  totals: {
    visits: total,
    named: NAMED.reduce((a, [, n]) => a + n, 0),
    unnamed: total - NAMED.reduce((a, [, n]) => a + n, 0),
    replayed: visits.reduce((a, b) => a + b, 0),
    activeDays: days.length,
  },
  years: yearList.map((y, j) => ({ year: y, visits: colTotals[j] })),
  published: NAMED.map(([id, n]) => ({ id, visits: n })),
  eras: ERAS.map(([from$, to$, label, place]) => ({ from: from$, to: to$, label, place })),
  bases: BASES,
  regions: geo.regions,
  cities: geo.cities.map((c) => ({ ...c, lon: round(c.lon), lat: round(c.lat) })),
  waters: geo.waters.map((w) => ({ id: w.id, name: w.name, pts: w.pts.map((p) => [round(p[0]), round(p[1])]) })),
  roads: geo.roads.map((r) => ({ id: r.id, name: r.name, kind: r.kind })),
  nodes: graph.nodes,
  edges: graph.edges.map((e) => [e.a, e.b, e.road, Math.round(e.len)]),
  places: places.map((p, i) => ({
    id: p.id,
    name: p.name,
    kind: p.kind,
    region: p.region,
    page: p.page,
    note: p.note,
    lon: round(p.lon),
    lat: round(p.lat),
    node: p.node,
    named: p.named,
    visits: visits[i],
  })),
  routes: Object.fromEntries(pairs),
  days,
}

mkdirSync(OUT, { recursive: true })
writeFileSync(join(OUT, 'atlas.json'), JSON.stringify(set) + '\n')

const bytes = JSON.stringify(set).length
console.log(
  `${OUT}/atlas.json — ${set.totals.replayed.toLocaleString()} visits · ` +
    `${days.length.toLocaleString()} days with movement of ${set.span.days.toLocaleString()} · ` +
    `${graph.nodes.length.toLocaleString()} nodes · ${graph.edges.length.toLocaleString()} road segments · ` +
    `${pairs.size} routes · ${(bytes / 1e6).toFixed(2)} MB`,
)
console.log(`  source: ${source}${checked ? ' · tables checked against the wiki' : ''}`)
const off = set.published.filter((p) => visits[idxOf.get(p.id)] !== p.visits)
if (off.length) {
  console.error('  per-address totals drifted from the published table:')
  for (const p of off) console.error(`    ${p.id}: replayed ${visits[idxOf.get(p.id)]}, published ${p.visits}`)
  process.exit(1)
}
console.log('  every published per-year and per-address total is reproduced exactly')
