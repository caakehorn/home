/**
 * The wiki as a place.
 *
 * `index.json` ships finished coordinates (baked by scripts/graph-layout.mjs)
 * and an edge list of index pairs. This turns that into the shape the map
 * draws from: adjacency, degree, a per-node radius, and the domain lobes with
 * their centres — everything the canvas needs without touching a page body.
 */
import type { IndexEntry, WikiIndex } from './data'

export type GraphNode = {
  index: number
  page: IndexEntry
  x: number
  y: number
  /** Screen radius before zoom, from the page's length. */
  radius: number
  degree: number
  neighbours: number[]
}

export type Lobe = {
  id: string
  count: number
  x: number
  y: number
}

export type Graph = {
  nodes: GraphNode[]
  edges: [number, number][]
  lobes: Lobe[]
  bySlug: Map<string, number>
}

/** Long pages read as bigger stars, but the scale has to flatten fast. */
const radiusOf = (words: number) => Math.min(11, 2.6 + Math.sqrt(Math.max(words, 1)) / 15)

export function buildGraph(index: WikiIndex): Graph {
  const nodes: GraphNode[] = index.pages.map((page, i) => ({
    index: i,
    page,
    x: page.x ?? 0,
    y: page.y ?? 0,
    radius: radiusOf(page.words),
    degree: 0,
    neighbours: [],
  }))

  const edges: [number, number][] = []
  for (const [a, b] of index.edges ?? []) {
    if (!nodes[a] || !nodes[b]) continue
    edges.push([a, b])
    nodes[a].neighbours.push(b)
    nodes[b].neighbours.push(a)
    nodes[a].degree++
    nodes[b].degree++
  }

  const lobes: Lobe[] = index.domains.map((domain) => {
    const own = nodes.filter((n) => n.page.domain === domain.id)
    const sum = own.reduce((acc, n) => ({ x: acc.x + n.x, y: acc.y + n.y }), { x: 0, y: 0 })
    return {
      id: domain.id,
      count: domain.count,
      x: own.length ? sum.x / own.length : 0,
      y: own.length ? sum.y / own.length : 0,
    }
  })

  return { nodes, edges, lobes, bySlug: new Map(nodes.map((n) => [n.page.slug, n.index])) }
}

// ---------------------------------------------------------------------------
// camera

export type Camera = { x: number; y: number; zoom: number }

export const HOME: Camera = { x: 0, y: 0, zoom: 1 }

/** World → screen. The map is square in world space; the view rarely is. */
export function project(camera: Camera, width: number, height: number) {
  const unit = (Math.min(width, height) / 2) * 0.92
  return {
    toScreen: (x: number, y: number) => ({
      x: width / 2 + (x - camera.x) * unit * camera.zoom,
      y: height / 2 + (y - camera.y) * unit * camera.zoom,
    }),
    toWorld: (sx: number, sy: number) => ({
      x: (sx - width / 2) / (unit * camera.zoom) + camera.x,
      y: (sy - height / 2) / (unit * camera.zoom) + camera.y,
    }),
    unit,
  }
}

export const clampCamera = (camera: Camera): Camera => ({
  x: Math.max(-2, Math.min(2, camera.x)),
  y: Math.max(-2, Math.min(2, camera.y)),
  zoom: Math.max(0.55, Math.min(7, camera.zoom)),
})

/** Nodes grow with zoom, but sublinearly — the map has to stay legible. */
export const zoomedRadius = (radius: number, zoom: number) => radius * zoom ** 0.4
