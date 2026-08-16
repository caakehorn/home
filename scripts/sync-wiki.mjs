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
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
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

  // The frontmatter block exactly as written, kept alongside the parsed view.
  //
  // The parsed view is lossy and cannot be otherwise: `connections:` entries
  // carry `type:` and `claim:` under each `- page:`, and `lists` flattens them
  // to strings. Rebuilding frontmatter from it therefore *deletes every typed
  // edge's claim* — which is what saving a page from the portal used to do.
  // Anything that writes a page back edits this text instead.
  return { meta, infobox, lists, body, fmRaw: text.slice(4, end) }
}

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    if (entry.startsWith('.')) continue
    // Pictures live under wiki/assets/ and are copied wholesale, not parsed.
    if (entry === 'assets') continue
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

// Pictures published from the portal ride along with the prose; an `image:`
// value of `assets/<slug>/<id>.jpg` resolves against this directory.
const assets = join(SOURCE, 'wiki', 'assets')
if (existsSync(assets)) cpSync(assets, join(OUT, 'assets'), { recursive: true })

const files = walk(join(SOURCE, 'wiki')).sort()
const index = []
/* ---- gaps ----------------------------------------------------------------
 *
 * A page's `## Gaps` section is the wiki admitting what it does not know. The
 * GAPS view answers them in the browser, and it needs the whole set at once —
 * fetching 460 page files to build a list is not a list. So they are baked
 * here, into their own dataset rather than into index.json, which every route
 * loads and which has no use for the text of 269 gaps.
 *
 * This is a port of the parser in wiki-brain's `bin/wiki-gaps`, and the two
 * have to agree: the tool cuts a gap out of the page by matching its text, so
 * a gap this splits differently is a gap the tool cannot find. Keep them in
 * step.
 */
const GAP_HEAD = /^(#{2,3})\s+(gaps?\b|notes\s+(and|&)\s+gaps\b|corpus gaps\b|open questions\b)/i
const BULLET = /^([-*]|\d+\.)\s+\S/

/** Flatten to one line for a list label: links unwrapped, emphasis stripped. */
function flatten(text) {
  return text
    .replace(/\[\[[^\]|]+\|([^\]]+)\]\]/g, '$1')
    .replace(/\[\[([^\]]+)\]\]/g, (_, p) => p.replace(/\/$/, '').split('/').pop())
    .replace(/^\s*([-*]|\d+\.)\s+/, '')
    .replace(/[*_`]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Every open gap on a page.
 *
 * Sections come in five heading variants and pages carry more than one —
 * jerel-coles has both an `## Open questions` and a `## Gaps` — so every
 * matching section is read, not just the first. Items come in two shapes:
 * bulleted lists with wrapped continuations and nested sub-bullets, and bare
 * paragraphs. Blocks are split on blank lines, then any block opening with a
 * top-level bullet is split at each subsequent one, which leaves nested
 * bullets attached to the item they belong to.
 */
function extractGaps(body) {
  const lines = body.split('\n')
  const out = []

  for (let i = 0; i < lines.length; i++) {
    const head = lines[i].match(GAP_HEAD)
    if (!head) continue
    const level = head[1].length
    let end = lines.length
    for (let j = i + 1; j < lines.length; j++) {
      const h = lines[j].match(/^(#+)\s/)
      if (h && h[1].length <= level) {
        end = j
        break
      }
    }

    // group the section body into blank-line-separated blocks
    const blocks = []
    let cur = []
    for (let k = i + 1; k < end; k++) {
      if (lines[k].trim()) cur.push(k)
      else if (cur.length) {
        blocks.push(cur)
        cur = []
      }
    }
    if (cur.length) blocks.push(cur)

    for (const block of blocks) {
      const first = lines[block[0]].trimStart()
      // sub-headings, blockquotes and whole-line italic placeholders are
      // commentary on the section, not gaps in it
      if (first.startsWith('#') || first.startsWith('>')) continue
      if (block.length === 1 && /^[_*].+[_*]$/.test(first.trim())) continue

      const starts = block.filter((k) => BULLET.test(lines[k]))
      const spans = []
      if (!starts.length) spans.push([block[0], block[block.length - 1] + 1])
      else {
        if (starts[0] > block[0]) spans.push([block[0], starts[0]])
        const bounds = [...starts, block[block.length - 1] + 1]
        for (let b = 0; b < bounds.length - 1; b++) spans.push([bounds[b], bounds[b + 1]])
      }

      for (const [lo, hi] of spans) {
        const text = lines.slice(lo, hi).join('\n')
        const label = flatten(text)
        // Settled already, by the two marks bin/wiki-digest filters OPEN.md on.
        if (!label || label.startsWith('~~')) continue
        if (/\b(CLOSED|RESOLVED|SETTLED)\b/.test(label)) continue
        out.push({ text, label })
      }
    }
  }
  return out
}

const backlinks = new Map()

const pages = files.map((file) => {
  const rel = relative(join(SOURCE, 'wiki'), file).replace(/\\/g, '/')
  const slug = rel.replace(/\.md$/, '')
  const raw = readFileSync(file, 'utf8')
  const { meta, infobox, lists, body, fmRaw } = parseFrontmatter(raw)

  // A leading H1 duplicates the title; drop it and prefer it as the title.
  // Kept verbatim as `h1` so a page written back from the browser puts it back
  // — saving used to delete it, because nothing remembered it had been there.
  let title = meta.title || titleFromSlug(slug)
  let content = body.replace(/^\s*\n/, '')
  const h1 = content.match(/^#\s+(.+)\n?/)
  const h1Line = h1 ? h1[0].replace(/\n$/, '') : null
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
    fmRaw,
    h1: h1Line,
    links,
    body: content.trimEnd(),
    words: content.split(/\s+/).filter(Boolean).length,
    charts: countChartableTables(content),
    brief: BRIEF_HEADING.test(content),
    gaps: extractGaps(content),
    /** Set by bin/wiki-gaps: this page is holding an answer nothing has acted on. */
    staged: meta.pending_ingest ?? null,
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

// Its own file: every route loads index.json, and none of them but GAPS wants
// the full text of a few hundred gaps.
const withGaps = pages.filter((p) => p.gaps.length || p.staged)
writeFileSync(
  join(OUT, 'gaps.json'),
  JSON.stringify({
    generatedAt: new Date().toISOString(),
    counts: {
      open: withGaps.reduce((n, p) => n + p.gaps.length, 0),
      pages: withGaps.filter((p) => p.gaps.length).length,
      staged: withGaps.filter((p) => p.staged).length,
    },
    pages: withGaps.map((p) => ({
      slug: p.slug,
      domain: p.domain,
      title: p.title,
      staged: p.staged,
      gaps: p.gaps,
    })),
  }),
)

console.log(
  `wiki: ${index.length} pages · ${domains.length} domains · ` +
    `${index.reduce((n, p) => n + p.charts, 0)} chartable tables · ` +
    `${index.filter((p) => p.brief).length} briefs · ${edges.length} mapped links -> public/wiki`,
)
