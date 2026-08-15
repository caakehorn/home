/**
 * Vendors a snapshot of the wiki-brain repo into public/wiki as JSON the
 * static site can serve: one index for browse/search, one file per page for
 * lazy loading.
 *
 *   node scripts/sync-wiki.mjs [path-to-wiki-brain]
 *   WIKI_BRAIN=/path/to/wiki-brain node scripts/sync-wiki.mjs
 *
 * The portal is static, so nothing is read from the source repo at runtime.
 * Re-run this to pull in new writing.
 */
import { mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import { layoutWiki, undirectedEdges } from './graph-layout.mjs'

const SOURCE = resolve(process.argv[2] ?? process.env.WIKI_BRAIN ?? '../wiki-brain')
const OUT = resolve('public/wiki')

/** Frontmatter is hand-written YAML; this handles the shapes the wiki uses. */
function parseFrontmatter(text) {
  if (!text.startsWith('---')) return { meta: {}, infobox: null, body: text }
  const end = text.indexOf('\n---', 3)
  if (end === -1) return { meta: {}, infobox: null, body: text }

  const head = text.slice(4, end).split('\n')
  const body = text.slice(text.indexOf('\n', end + 1) + 1)
  const meta = {}
  const lists = {}
  let infobox = null
  let currentList = null
  let inInfobox = false

  const unquote = (v) => v.trim().replace(/^["']|["']$/g, '')

  for (const line of head) {
    if (!line.trim()) continue

    // nested infobox entries
    if (inInfobox && /^\s{2,}\S/.test(line)) {
      const m = line.match(/^\s+([A-Za-z0-9_]+):\s*(.*)$/)
      if (m) infobox[m[1]] = unquote(m[2])
      continue
    }
    // list items belonging to the last seen key
    if (/^\s*-\s+/.test(line) && currentList) {
      lists[currentList].push(unquote(line.replace(/^\s*-\s+/, '')))
      continue
    }

    const m = line.match(/^([A-Za-z0-9_]+):\s*(.*)$/)
    if (!m) continue
    inInfobox = false
    currentList = null
    const [, key, rawValue] = m
    const value = rawValue.trim()

    if (key === 'infobox') {
      infobox = {}
      inInfobox = true
    } else if (value === '') {
      lists[key] = []
      currentList = key
    } else {
      meta[key] = unquote(value)
    }
  }

  return { meta, infobox, lists, body }
}

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    if (entry.startsWith('.')) continue
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) walk(full, out)
    else if (entry.endsWith('.md')) out.push(full)
  }
  return out
}

const titleFromSlug = (slug) =>
  slug
    .split('/')
    .pop()
    .replace(/-/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())

/** `[[wiki/people/x|label]]` and `[[wiki/people/x]]` -> target slugs. */
function extractWikiLinks(body) {
  const links = new Set()
  for (const match of body.matchAll(/\[\[([^\]|]+)(?:\|[^\]]*)?\]\]/g)) {
    const target = match[1].trim().replace(/^wiki\//, '').replace(/\.md$/, '')
    if (target) links.add(target)
  }
  return [...links]
}

/**
 * Does the page carry a compressed block — an "LLM Quick Brief" or one of its
 * kin? Only the heading is checked here; the client's parser has the final
 * say on whether there is enough in it to visualise. This flag exists so the
 * index can offer the brief deck without reading 458 page bodies.
 */
const BRIEF_HEADING = /^#{2,4}\s+.*(quick brief|context injection|tl;?\s?dr|at a glance|in brief)/im

/**
 * A table is chartable when it has a label column and at least one column
 * whose cells are mostly numbers. Detected here so the client does not have
 * to re-scan every page body just to know whether a chart is possible.
 */
function countChartableTables(body) {
  let count = 0
  const lines = body.split('\n')
  for (let i = 0; i < lines.length - 1; i++) {
    if (!lines[i].trim().startsWith('|')) continue
    if (!/^\s*\|[\s:|-]+\|\s*$/.test(lines[i + 1])) continue
    const rows = []
    for (let j = i + 2; j < lines.length && lines[j].trim().startsWith('|'); j++) {
      rows.push(lines[j].split('|').slice(1, -1).map((c) => c.trim()))
    }
    const numericish = (cell) => /^[-+]?[\d,]+(\.\d+)?%?$/.test(cell.replace(/\s*\(.*\)\s*/, '').trim())
    const columns = rows[0]?.length ?? 0
    for (let c = 1; c < columns; c++) {
      const values = rows.map((r) => r[c] ?? '')
      const hits = values.filter(numericish).length
      if (values.length >= 2 && hits >= Math.max(2, values.length * 0.6)) {
        count++
        break
      }
    }
    i += rows.length + 1
  }
  return count
}

// ---------------------------------------------------------------------------

let sourceStat
try {
  sourceStat = statSync(join(SOURCE, 'wiki'))
} catch {
  console.error(`No wiki/ directory under ${SOURCE}.`)
  console.error('Pass the path to a wiki-brain checkout: node scripts/sync-wiki.mjs ../wiki-brain')
  process.exit(1)
}
if (!sourceStat.isDirectory()) process.exit(1)

rmSync(OUT, { recursive: true, force: true })
mkdirSync(join(OUT, 'pages'), { recursive: true })

const files = walk(join(SOURCE, 'wiki')).sort()
const index = []
const backlinks = new Map()

const pages = files.map((file) => {
  const rel = relative(join(SOURCE, 'wiki'), file).replace(/\\/g, '/')
  const slug = rel.replace(/\.md$/, '')
  const raw = readFileSync(file, 'utf8')
  const { meta, infobox, lists, body } = parseFrontmatter(raw)

  // A leading H1 duplicates the title; drop it and prefer it as the title.
  let title = meta.title || titleFromSlug(slug)
  let content = body.replace(/^\s*\n/, '')
  const h1 = content.match(/^#\s+(.+)\n?/)
  if (h1) {
    title = h1[1].trim()
    content = content.slice(h1[0].length)
  }

  const links = extractWikiLinks(body)
  for (const target of links) {
    if (!backlinks.has(target)) backlinks.set(target, new Set())
    backlinks.get(target).add(slug)
  }

  return {
    slug,
    domain: slug.split('/')[0],
    title,
    meta,
    infobox,
    lists: lists ?? {},
    links,
    body: content.trimEnd(),
    words: content.split(/\s+/).filter(Boolean).length,
    charts: countChartableTables(content),
    brief: BRIEF_HEADING.test(content),
  }
})

for (const page of pages) {
  const file = `${page.slug.replace(/\//g, '__')}.json`
  writeFileSync(
    join(OUT, 'pages', file),
    JSON.stringify({ ...page, backlinks: [...(backlinks.get(page.slug) ?? [])].sort() }),
  )

  index.push({
    slug: page.slug,
    domain: page.domain,
    title: page.title,
    type: page.meta.page_type ?? null,
    status: page.meta.status ?? null,
    knownFor: page.infobox?.known_for ?? null,
    relationship: page.infobox?.relationship_to_dan ?? null,
    words: page.words,
    charts: page.charts,
    links: page.links.length,
    brief: page.brief,
  })
}

const domains = [...new Set(index.map((p) => p.domain))].sort().map((id) => ({
  id,
  count: index.filter((p) => p.domain === id).length,
}))

index.sort((a, b) => a.slug.localeCompare(b.slug))

// The map's coordinates are baked here rather than simulated on load, and the
// edge list rides along as index pairs — slugs would triple the file for the
// same graph.
const edges = undirectedEdges(pages)
const position = layoutWiki(
  index.map((p) => ({ slug: p.slug, domain: p.domain, weight: p.words })),
  edges,
)
const order = new Map(index.map((p, i) => [p.slug, i]))
for (const entry of index) {
  const at = position.get(entry.slug)
  entry.x = at?.x ?? 0
  entry.y = at?.y ?? 0
}
const wire = edges.map(([a, b]) => [order.get(a), order.get(b)])

writeFileSync(
  join(OUT, 'index.json'),
  JSON.stringify({
    generatedAt: new Date().toISOString(),
    counts: {
      pages: index.length,
      words: index.reduce((n, p) => n + p.words, 0),
      chartables: index.reduce((n, p) => n + p.charts, 0),
      briefs: index.filter((p) => p.brief).length,
      edges: edges.length,
    },
    domains,
    pages: index,
    edges: wire,
  }),
)

console.log(
  `wiki: ${index.length} pages · ${domains.length} domains · ` +
    `${index.reduce((n, p) => n + p.charts, 0)} chartable tables · ` +
    `${index.filter((p) => p.brief).length} briefs · ${edges.length} mapped links -> public/wiki`,
)
