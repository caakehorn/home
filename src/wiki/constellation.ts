import type { Graph } from './graph'

/* ==========================================================================
   CONSTELLATIONS — pinning stars until they make a figure.

   The map already let you inspect one page at a time: click a star, read its
   probe, click one of its links, repeat. That is a walk, and a walk has no
   memory — the moment you click the second star the first one is gone, so
   nothing on screen ever accumulates into an argument.

   A constellation is the memory. Stars are pinned rather than probed, they
   stay lit, and the edges the corpus already has between them light up as
   strands. What you are drawing is not decoration: a strand exists only where
   the wiki genuinely links those two pages, so a figure that closes is a
   claim about the corpus that the corpus agreed to.

   ---- the end state -----------------------------------------------------

   A constellation is COMPLETE when it has at least three stars and every star
   can be reached from every other WITHOUT LEAVING THE FIGURE. That is a real
   graph property rather than a score, it is checkable at a glance once drawn,
   and it is the one condition that makes the thing you assembled mean
   something: a connected pinned subgraph is a set of pages that genuinely
   hang together, as opposed to a set of pages you happened to like.

   Until it closes, the gap is shown rather than hidden. Every disconnected
   piece gets a ghost strand to the main body along the shortest real path
   through the corpus, and the pages on that path are the answer to "what
   would join these two" — which is the single most useful question this map
   can be asked, and previously could not be.
   ========================================================================== */

export type Bridge = {
  /** Full path including both endpoints; everything between is unpinned. */
  path: number[]
  from: number
  to: number
}

export type Constellation = {
  /** Pin order. This is the reading order until the figure closes. */
  members: number[]
  /** Connected pieces within the pinned set. One piece = joined up. */
  components: number[][]
  complete: boolean
  /** Real edges between two pinned stars. The figure's own lines. */
  strands: [number, number][]
  /** Shortest real paths that would join the pieces, through unpinned pages. */
  bridges: Bridge[]
  /** Traversal order once complete — how the figure reads as a sequence. */
  track: number[]
  name: string
  kana: string
}

/** Below this a "figure" is just two stars and a line, which is not a figure. */
export const MIN_FIGURE = 3

const DOMAIN_KANA: Record<string, string> = {
  people: '人', interests: '趣味', mind: '心', timeline: '年表',
  self: '自己', work: '仕事', places: '場所', health: '健康', legal: '法',
}

/**
 * Connected pieces of the pinned set, walking ONLY through pinned stars.
 *
 * This is the whole test. Restricting the walk to members is what makes a
 * constellation a statement about the corpus rather than about the reader:
 * you cannot close a figure by wanting it closed, only by pinning pages the
 * wiki actually links.
 */
function componentsOf(members: number[], graph: Graph): number[][] {
  const inSet = new Set(members)
  const seen = new Set<number>()
  const out: number[][] = []

  for (const start of members) {
    if (seen.has(start)) continue
    const piece: number[] = []
    const queue = [start]
    seen.add(start)
    while (queue.length) {
      const at = queue.shift()!
      piece.push(at)
      for (const next of graph.nodes[at].neighbours) {
        if (!inSet.has(next) || seen.has(next)) continue
        seen.add(next)
        queue.push(next)
      }
    }
    // Pin order inside a piece, so the list reads the way it was built.
    piece.sort((a, b) => members.indexOf(a) - members.indexOf(b))
    out.push(piece)
  }

  // Biggest piece first: it is the body, and the rest are the strays.
  return out.sort((a, b) => b.length - a.length)
}

/**
 * The shortest real route from any node in `from` to any node in `to`.
 *
 * A multi-source BFS over the whole graph — not just the pinned set — because
 * the point of a bridge is to name the unpinned pages that would join two
 * pieces. Undirected and unweighted, so BFS is the shortest path.
 */
function shortestBridge(from: number[], to: number[], graph: Graph): Bridge | null {
  const target = new Set(to)
  const prev = new Map<number, number>()
  const seen = new Set<number>(from)
  const queue = [...from]

  while (queue.length) {
    const at = queue.shift()!
    if (target.has(at)) {
      const path: number[] = []
      for (let cur: number | undefined = at; cur !== undefined; cur = prev.get(cur)) path.push(cur)
      path.reverse()
      return { path, from: path[0], to: path[path.length - 1] }
    }
    for (const next of graph.nodes[at].neighbours) {
      if (seen.has(next)) continue
      seen.add(next)
      prev.set(next, at)
      queue.push(next)
    }
  }
  return null // different islands of the corpus entirely
}

/**
 * A depth-first walk of the closed figure, from its most-connected star.
 *
 * DFS rather than BFS on purpose: a depth-first order runs along the figure
 * like a path, which is what a reading order wants to be, where breadth-first
 * would hop back to the hub between every branch.
 */
function walkTrack(members: number[], graph: Graph): number[] {
  if (members.length === 0) return []
  const inSet = new Set(members)
  const start = members.reduce((best, i) =>
    graph.nodes[i].degree > graph.nodes[best].degree ? i : best,
  )

  const seen = new Set<number>([start])
  const order: number[] = []
  const visit = (at: number) => {
    order.push(at)
    const next = graph.nodes[at].neighbours
      .filter((n) => inSet.has(n) && !seen.has(n))
      // Least-connected first, so the walk goes out to a leaf and comes back
      // rather than bouncing between the two hubs and stranding the edges.
      .sort((a, b) => graph.nodes[a].degree - graph.nodes[b].degree)
    for (const n of next) {
      if (seen.has(n)) continue
      seen.add(n)
      visit(n)
    }
  }
  visit(start)
  // Anything unreachable (only possible on an open figure) keeps pin order.
  for (const m of members) if (!seen.has(m)) order.push(m)
  return order
}

function nameOf(members: number[], graph: Graph): { name: string; kana: string } {
  if (members.length === 0) return { name: 'NOTHING PINNED', kana: '空' }

  const tally = new Map<string, number>()
  for (const i of members) {
    const d = graph.nodes[i].page.domain
    tally.set(d, (tally.get(d) ?? 0) + 1)
  }
  const ranked = [...tally.entries()].sort((a, b) => b[1] - a[1])
  const [top, count] = ranked[0]

  // Named for what it is made of. A figure drawn entirely inside one domain is
  // that domain's own shape; one that crosses is named for the crossing,
  // because crossing is the more interesting thing it did.
  const kana = ranked.length > 1 ? '交' : (DOMAIN_KANA[top] ?? '書')
  const name =
    ranked.length === 1
      ? `THE ${top.toUpperCase()} FIGURE`
      : count > members.length / 2
        ? `THE ${top.toUpperCase()} CROSSING`
        : `THE ${ranked.length}-DOMAIN CROSSING`

  return { name, kana }
}

export function constellationOf(members: number[], graph: Graph): Constellation {
  const components = componentsOf(members, graph)
  const complete = members.length >= MIN_FIGURE && components.length === 1

  const inSet = new Set(members)
  const strands: [number, number][] = []
  for (const [a, b] of graph.edges) {
    if (inSet.has(a) && inSet.has(b)) strands.push([a, b])
  }

  // Every stray piece gets one ghost route back to the body. A star topology
  // rather than every pair: n-1 routes is what it takes to close the figure,
  // and drawing all n² of them would bury the answer in the diagram.
  const bridges: Bridge[] = []
  if (!complete && components.length > 1) {
    const body = components[0]
    for (const piece of components.slice(1)) {
      const bridge = shortestBridge(piece, body, graph)
      if (bridge) bridges.push(bridge)
    }
  }

  return {
    members,
    components,
    complete,
    strands,
    bridges,
    track: complete ? walkTrack(members, graph) : members,
    ...nameOf(members, graph),
  }
}

/** World-space bounds of a set of nodes, for framing the finished figure. */
export function boundsOf(members: number[], graph: Graph) {
  let x0 = Infinity
  let y0 = Infinity
  let x1 = -Infinity
  let y1 = -Infinity
  for (const i of members) {
    const n = graph.nodes[i]
    if (n.x < x0) x0 = n.x
    if (n.y < y0) y0 = n.y
    if (n.x > x1) x1 = n.x
    if (n.y > y1) y1 = n.y
  }
  return { x0, y0, x1, y1, cx: (x0 + x1) / 2, cy: (y0 + y1) / 2, w: x1 - x0, h: y1 - y0 }
}
