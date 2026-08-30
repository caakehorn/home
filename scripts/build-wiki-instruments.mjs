/**
 * Bakes the ◈ WIKI wing out of the vendored snapshot.
 *
 *   npm run wiki-instruments
 *
 * Nine instruments, one dataset. Reads `public/wiki/` — the snapshot THE
 * WIKI-BRAIN already ships — and writes `public/leviathan/wiki.json`.
 *
 * One file rather than nine because these all read the same 486 pages, and nine
 * datasets over one corpus is nine chances for two instruments to disagree
 * about how many pages there are. It is also nine passes over the prose at
 * build time instead of one.
 *
 * ---- THE RULE, on a corpus of prose ---------------------------------------
 *
 * Everything below is a count, a date, or a length. The two places that could
 * have become judgements, and did not:
 *
 *   ECHO      overlap between two pages is the size of their shared vocabulary
 *             over the size of their union — a set operation, not a similarity
 *             model. No embedding, no threshold, and the pairs are ranked by
 *             the number rather than filtered by it.
 *   EVIDENCE  a citation is sorted by the directory it points into, which is a
 *             fact about the path. Nothing weighs one source against another
 *             and no page is scored for being well-sourced.
 *
 * The stoplist ECHO uses is the same closed-class list THE LEXICON publishes,
 * and it ships in this file too, for the same reason.
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const IN = 'public/wiki'
const OUT = 'public/leviathan'

if (!existsSync(join(IN, 'index.json'))) {
  console.error(`No wiki snapshot to read: ${IN}/index.json`)
  console.error('Get it over first: npm run sync-wiki -- ../wiki-brain')
  process.exit(1)
}

const index = JSON.parse(readFileSync(join(IN, 'index.json'), 'utf8'))
const files = readdirSync(join(IN, 'pages')).filter((f) => f.endsWith('.json'))

// Sealed pages are dropped from both halves of the read. THE RULE says no
// instrument makes a judgement; it does not say every instrument counts a page
// it is not allowed to open, and a zero-word entry in THE MASS is a description
// of a locked page all the same.
/** @type {any[]} */
const pages = files
  .map((f) => JSON.parse(readFileSync(join(IN, 'pages', f), 'utf8')))
  .filter((p) => !p.locked)
pages.sort((a, b) => a.slug.localeCompare(b.slug))
index.pages = index.pages.filter((p) => !p.locked)

const bySlug = new Map(pages.map((p) => [p.slug, p]))
const indexBySlug = new Map(index.pages.map((p) => [p.slug, p]))

const titleOf = (slug) => bySlug.get(slug)?.title ?? indexBySlug.get(slug)?.title ?? slug
const domainOf = (slug) => bySlug.get(slug)?.domain ?? indexBySlug.get(slug)?.domain ?? 'unfiled'

// ---------------------------------------------------------------------------
// II · THE WEB and IX · THE HEALTH — the graph, and how sound it is

const links = new Map() // slug -> Set of slugs it points at
for (const page of pages) {
  const out = new Set()
  for (const target of page.links ?? []) if (bySlug.has(target) && target !== page.slug) out.add(target)
  links.set(page.slug, out)
}

const inbound = new Map(pages.map((p) => [p.slug, 0]))
let edgeCount = 0
let reciprocal = 0
for (const [from, targets] of links) {
  for (const to of targets) {
    edgeCount++
    inbound.set(to, (inbound.get(to) ?? 0) + 1)
    if (links.get(to)?.has(from)) reciprocal++
  }
}

const web = {
  nodes: pages.map((p) => {
    const idx = indexBySlug.get(p.slug)
    return {
      slug: p.slug,
      title: p.title,
      domain: p.domain,
      words: p.words ?? 0,
      out: links.get(p.slug).size,
      in: inbound.get(p.slug) ?? 0,
      // The map at /brain already laid these out; reusing its coordinates means
      // the two rooms draw the same graph in the same shape.
      x: idx?.x ?? 0,
      y: idx?.y ?? 0,
    }
  }),
  edges: [...links].flatMap(([from, targets]) => [...targets].map((to) => [from, to])),
}

const orphans = pages
  .filter((p) => (inbound.get(p.slug) ?? 0) === 0)
  .map((p) => ({ slug: p.slug, title: p.title, domain: p.domain, out: links.get(p.slug).size }))

const health = {
  pages: pages.length,
  edges: edgeCount,
  /** Both directions present. Counted per direction, so a mutual pair adds two. */
  reciprocal,
  orphans,
  /** Out-degree distribution: how many pages point at nothing, at one, at two… */
  outDegrees: (() => {
    const bins = new Map()
    for (const [, targets] of links) bins.set(targets.size, (bins.get(targets.size) ?? 0) + 1)
    return [...bins].sort((a, b) => a[0] - b[0]).map(([degree, count]) => ({ degree, count }))
  })(),
  byDomain: index.domains.map((d) => {
    const rows = pages.filter((p) => p.domain === d.id)
    return {
      id: d.id,
      pages: rows.length,
      out: rows.reduce((n, p) => n + links.get(p.slug).size, 0),
      in: rows.reduce((n, p) => n + (inbound.get(p.slug) ?? 0), 0),
      orphans: rows.filter((p) => (inbound.get(p.slug) ?? 0) === 0).length,
    }
  }),
}

// ---------------------------------------------------------------------------
// III · THE CLAIMS — every link, with the sentence that makes it
//
// The old console called these typed edges. This snapshot does not carry the
// types, so rather than invent them the instrument shows the thing the type was
// standing in for: the sentence the link sits inside, in the wiki's own words.

/**
 * A prose block: not a table, not a heading, not a bullet list of bare links.
 *
 * The old console showed the *type* on an edge; this snapshot does not carry
 * types, so the instrument shows the thing the type stood in for — the sentence
 * the link sits inside, in the wiki's own words. That only works if the
 * sentence is a whole sentence, and these bodies are **hard-wrapped**: a
 * newline lands mid-clause, so splitting on newlines cuts sentences in half.
 * Paragraphs are split on blank lines and unwrapped first; the first cut of
 * this did not, and produced 3,300 fragments ending mid-word.
 *
 * The filter drops rows of a table and keeps prose. It does not drop prose for
 * what the prose says.
 */
const isProse = (block) => {
  const t = block.trim()
  if (t.length < 60) return false
  const first = t.split('\n')[0].trim()
  if (/^[|#>]/.test(first)) return false
  if (/^[-*+]\s/.test(first)) return false
  if (/^\d+\.\s/.test(first)) return false
  if (t.includes('|')) return false
  const linked = (t.match(/\[\[wiki\/[^\]]*\]\]/g) ?? []).join('').length
  return linked / t.length < 0.4
}

const plain = (text) =>
  text
    .replace(/\[\[wiki\/([^\]|]+)(\|[^\]]*)?\]\]/g, (_, slug) => titleOf(slug))
    .replace(/[*_`]/g, '')
    .replace(/\s+/g, ' ')
    .trim()

const claims = []
for (const page of pages) {
  const body = String(page.body ?? '')
  if (!body) continue
  const seen = new Set()

  for (const block of body.split(/\n\s*\n/)) {
    if (!isProse(block)) continue
    // Unwrap: the newlines inside a paragraph are typography, not structure.
    const paragraph = block.replace(/\s*\n\s*/g, ' ').trim()

    for (const sentence of paragraph.split(/(?<=[.!?])\s+(?=[A-Z"'(\[])/)) {
      const named = [...sentence.matchAll(/\[\[wiki\/([^\]|]+)(?:\|[^\]]*)?\]\]/g)]
        .map((m) => m[1])
        .filter((slug) => links.get(page.slug).has(slug))
      if (!named.length) continue
      const say = plain(sentence)
      // A claim that does not end in a full stop is a fragment, and a fragment
      // attributed to somebody's wiki is a misquotation.
      if (say.length < 50 || say.length > 340 || !/[.!?]$/.test(say)) continue
      for (const target of new Set(named)) {
        const key = `${page.slug}\u0000${target}`
        if (seen.has(key)) continue
        seen.add(key)
        claims.push({ from: page.slug, to: target, say })
      }
    }
  }
}

// ---------------------------------------------------------------------------
// IV · THE CENSUS — every documented person on one axis

const census = pages
  .filter((p) => p.domain === 'people' && (p.meta?.date_range_start || p.meta?.date_range_end))
  .map((p) => ({
    slug: p.slug,
    title: p.title,
    from: String(p.meta.date_range_start ?? '').slice(0, 10) || null,
    to: String(p.meta.date_range_end ?? '').slice(0, 10) || null,
    words: p.words ?? 0,
    knownFor: p.infobox?.known_for ?? null,
    relationship: p.infobox?.relationship_to_dan ?? null,
  }))
  .filter((row) => row.from || row.to)
  .sort((a, b) => String(a.from ?? a.to).localeCompare(String(b.from ?? b.to)))

// ---------------------------------------------------------------------------
// VII · THE TAGS — themes, and the pages under them
//
// Tags arrive as raw front-matter text rather than parsed lists, so the
// brackets and commas a YAML array leaves behind are stripped here. That is a
// parse, not a filter: nothing is dropped for what it says.

const cleanTag = (raw) =>
  String(raw)
    .replace(/^[[\s'"]+|[\]\s'",]+$/g, '')
    .toLowerCase()
    .trim()

const tagMap = new Map()
for (const page of pages) {
  const raw = page.meta?.tags
  if (!raw) continue
  const list = Array.isArray(raw) ? raw : String(raw).split(/[,\s]+/)
  for (const item of list) {
    const tag = cleanTag(item)
    if (!tag || tag.length < 2) continue
    const row = tagMap.get(tag) ?? { tag, pages: [] }
    if (!row.pages.some((x) => x.slug === page.slug)) {
      row.pages.push({ slug: page.slug, title: page.title, domain: page.domain })
    }
    tagMap.set(tag, row)
  }
}
const tags = [...tagMap.values()]
  .map((row) => ({ ...row, count: row.pages.length }))
  .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag))

// ---------------------------------------------------------------------------
// X · THE EVIDENCE — what the pages cite
//
// The raw/ tree the citations point into is not vendored here, so the sources
// cannot be opened. The citations themselves ship, and counting them by the
// directory they point into is a count of paths, which is a fact about the
// wiki rather than about the material.

/**
 * A citation is sorted by **the directory it points into and the file type it
 * names**, both of which are facts about the path. The first cut of this used a
 * table of regexes mapping paths onto categories like "AI CHATS" — which is a
 * hand-made semantic guess about somebody else's filing, exactly the kind of
 * mapping THE RULE is written against, and it dumped 546 of 1,170 references
 * into OTHER besides. Reading the path is both more honest and more accurate.
 */
const rootOf = (path) => {
  const parts = String(path).split('/').filter(Boolean)
  return parts.length >= 2 ? `${parts[0]}/${parts[1]}` : (parts[0] ?? 'unfiled')
}

const collectionOf = (path) => {
  const parts = String(path).split('/').filter(Boolean)
  return parts.length >= 3 ? parts.slice(0, 3).join('/') : rootOf(path)
}

const extOf = (path) => {
  const match = String(path).match(/\.([A-Za-z0-9]{1,5})(?:[)\s]|$)/)
  return match ? match[1].toLowerCase() : 'none'
}

const tally = (map, key) => map.set(key, (map.get(key) ?? 0) + 1)

const roots = new Map()
const collections = new Map()
const extensions = new Map()
const cited = []

for (const page of pages) {
  const sources = page.lists?.sources ?? []
  const mine = new Map()
  for (const source of sources) {
    tally(roots, rootOf(source))
    tally(collections, collectionOf(source))
    tally(extensions, extOf(source))
    tally(mine, rootOf(source))
  }
  cited.push({
    slug: page.slug,
    title: page.title,
    domain: page.domain,
    words: page.words ?? 0,
    sources: sources.length,
    roots: [...mine].map(([root, count]) => ({ root, count })),
  })
}

const rank = (map) =>
  [...map].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([name, count]) => ({ name, count }))

const evidence = {
  references: [...roots.values()].reduce((n, v) => n + v, 0),
  roots: rank(roots),
  collections: rank(collections).slice(0, 40),
  extensions: rank(extensions),
  pages: cited.sort((a, b) => b.sources - a.sources || a.slug.localeCompare(b.slug)),
  uncited: cited.filter((p) => p.sources === 0).length,
}

// ---------------------------------------------------------------------------
// XV · THE ATTENTION — what gets talked about against what gets written up

// Every page. An earlier cut filtered titles shorter than four characters —
// a leftover from a name-matching approach that was never used, since `named`
// is an inbound link count and not a search for the title in prose. It quietly
// dropped ten pages from a chart whose masthead said 486, which is the kind of
// filter this building exists to not have.
const attention = pages
  .map((page) => {
    const named = inbound.get(page.slug) ?? 0
    return {
      slug: page.slug,
      title: page.title,
      domain: page.domain,
      words: page.words ?? 0,
      named,
      backlinks: (page.backlinks ?? []).length,
    }
  })
  .sort((a, b) => b.named - a.named || b.words - a.words)

// ---------------------------------------------------------------------------
// XVII · THE SCHEMA — which front-matter fields are filled in

const fieldCounts = new Map()
for (const page of pages) {
  for (const [key, value] of Object.entries(page.meta ?? {})) {
    if (value === null || value === undefined || value === '') continue
    fieldCounts.set(key, (fieldCounts.get(key) ?? 0) + 1)
  }
}
const schema = {
  fields: [...fieldCounts]
    .sort((a, b) => b[1] - a[1])
    .map(([field, count]) => ({ field, count, share: count / pages.length })),
  byDomain: index.domains.map((d) => {
    const rows = pages.filter((p) => p.domain === d.id)
    const filled = rows.reduce(
      (n, p) => n + Object.values(p.meta ?? {}).filter((v) => v !== null && v !== '').length,
      0,
    )
    return { id: d.id, pages: rows.length, fields: filled, per: rows.length ? filled / rows.length : 0 }
  }),
  types: (() => {
    const bins = new Map()
    for (const p of pages) bins.set(p.meta?.page_type ?? 'none', (bins.get(p.meta?.page_type ?? 'none') ?? 0) + 1)
    return [...bins].sort((a, b) => b[1] - a[1]).map(([type, count]) => ({ type, count }))
  })(),
}

// ---------------------------------------------------------------------------
// XVIII · THE ECHO — where two pages share a vocabulary
//
// Jaccard over the distinct open-class words of two pages: the size of the
// intersection over the size of the union. A set operation and nothing else —
// no embedding, no model, no threshold. Pairs are ranked by the number, not
// filtered by it, and the top of the list is what the list is.

const STOP = new Set(
  `a about above after again against all am an and any are aren't as at be because been before being
   below between both but by can cannot could couldn't did didn't do does doesn't doing don't down
   during each few for from further had hadn't has hasn't have haven't having he her here hers
   herself him himself his how i if in into is isn't it it's its itself let's me more most mustn't
   my myself no nor not of off on once only or other ought our ours ourselves out over own same
   shan't she should shouldn't so some such than that the their theirs them themselves then there
   these they this those through to too under until up very was wasn't we were weren't what when
   where which while who whom why will with won't would wouldn't you your yours yourself yourselves
   is was has had also one two three new page wiki`.split(/\s+/).filter(Boolean),
)

const vocab = pages.map((page) => {
  const set = new Set()
  for (const match of String(page.body ?? '').toLowerCase().matchAll(/[a-z']{4,}/g)) {
    const word = match[0].replace(/^'+|'+$/g, '')
    if (word.length >= 4 && !STOP.has(word)) set.add(word)
  }
  return { slug: page.slug, title: page.title, domain: page.domain, set }
})

const echoPairs = []
for (let i = 0; i < vocab.length; i++) {
  const a = vocab[i]
  if (a.set.size < 40) continue
  for (let j = i + 1; j < vocab.length; j++) {
    const b = vocab[j]
    if (b.set.size < 40) continue
    let shared = 0
    const [small, large] = a.set.size <= b.set.size ? [a.set, b.set] : [b.set, a.set]
    for (const word of small) if (large.has(word)) shared++
    if (shared < 20) continue
    const overlap = shared / (a.set.size + b.set.size - shared)
    echoPairs.push({
      a: a.slug,
      aTitle: a.title,
      b: b.slug,
      bTitle: b.title,
      shared,
      overlap,
      sameDomain: a.domain === b.domain,
    })
  }
}
/**
 * Two rankings, because they answer different questions and the first one's
 * answer is surprising.
 *
 * By **overlap** the top of the list is a wall of 1.000s between one-line
 * concert-record stubs, which share a vocabulary because they share a template.
 * That is a true fact about this corpus and it is left at the top rather than
 * thresholded away — the wiki does repeat itself most in its own boilerplate,
 * and an instrument that quietly filtered that out would be reporting a
 * prettier corpus than the one that exists.
 *
 * By **shared words** the same measurement surfaces the long pages that
 * genuinely cover the same ground. Neither ranking is filtered; they are the
 * same pairs sorted by the two numbers already computed for each.
 */
const byOverlap = [...echoPairs].sort((x, y) => y.overlap - x.overlap || y.shared - x.shared)
const byShared = [...echoPairs].sort((x, y) => y.shared - x.shared || y.overlap - x.overlap)
const echo = {
  measured: vocab.filter((v) => v.set.size >= 40).length,
  total: echoPairs.length,
  /** Pairs where the two vocabularies are identical — the template signature. */
  identical: echoPairs.filter((p) => p.overlap === 1).length,
  byOverlap: byOverlap.slice(0, 200),
  byShared: byShared.slice(0, 200),
}

// ---------------------------------------------------------------------------

const set = {
  // The snapshot's own stamp, not the wall clock — the same rule as
  // build-docket.mjs. This file is committed and the sync workflow rebuilds it
  // on every run whether or not the wiki moved, so a `new Date()` here commits
  // a one-line JSON diff every hour and fires a deploy behind it. Keyed off the
  // snapshot it is byte-identical until the wiki actually changes.
  generatedAt: index.generatedAt,
  source: `${IN} · ${pages.length} pages`,
  counts: index.counts,
  domains: index.domains,
  web,
  health,
  claims: claims.sort((a, b) => a.from.localeCompare(b.from)).slice(0, 1200),
  claimsTotal: claims.length,
  census,
  tags: tags.slice(0, 200),
  tagsTotal: tags.length,
  evidence,
  // Every page, not a top-N. THE ATTENTION's whole subject is the shape of the
  // scatter, and a scatter with the tail cut off is a different shape.
  attention,
  schema,
  echo,
}

mkdirSync(OUT, { recursive: true })
writeFileSync(join(OUT, 'wiki.json'), JSON.stringify(set) + '\n')

console.log(
  `${OUT}/wiki.json — ${pages.length} pages · ${edgeCount.toLocaleString()} edges · ` +
    `${claims.length.toLocaleString()} claims · ${census.length} lifelines · ` +
    `${tags.length} tags · ${echoPairs.length.toLocaleString()} echo pairs · ` +
    `${(JSON.stringify(set).length / 1e6).toFixed(2)} MB`,
)
console.log(
  `  orphans: ${orphans.length} · reciprocal edges: ${reciprocal} · uncited pages: ${evidence.uncited}`,
)
