/**
 * Bakes THE CORE — the whole corpus as one structure.
 *
 *   npm run core
 *
 * ---- what this reads, and why it is not the obvious field ------------------
 *
 * The instrument's premise is the **typed** graph: 2,398 connections, each one
 * `{page, type, claim}`, where the claim is a sentence of prose asserting why
 * the edge exists. Nineteen relationship types, six of them in inverse pairs
 * whose counts match almost exactly — which is the tell that this graph is
 * maintained deliberately rather than accumulated.
 *
 * That graph is not `index.json.edges`. Those 3,851 edges are the *untyped*
 * wikilink graph — a different, larger, flatter object. It ships too, as the
 * dim secondary mesh, but it is not what the room is about.
 *
 * The typed graph exists only in each page's raw front-matter, so this build
 * reads `fmRaw` through `core-frontmatter.mjs`. See the note at the top of that
 * file for why a line reader beats a YAML parser here.
 *
 * ---- what it does not read -------------------------------------------------
 *
 * `clock.json` is reused whole and untouched: 134,348 messages already packed
 * one integer each, 320 KB, and re-deriving them here would produce the same
 * bytes twice. The client decodes it. `public/core/` carries only what does not
 * already exist somewhere in this repo.
 *
 * ---- the invariants --------------------------------------------------------
 *
 * `docs/CORPUS.md` states what this corpus contains. This build asserts against
 * those numbers and exits non-zero when they drift, because a structure that
 * has quietly lost a thousand edges renders exactly like one that has not.
 * When the snapshot legitimately moves, the fix is to re-crawl, correct
 * `docs/CORPUS.md`, and update the constants below — never to relax the check.
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { bareSlug, readConnections } from './core-frontmatter.mjs'

const WIKI = 'public/wiki'
const LEV = 'public/leviathan'
const OUT = 'public/core'

/* ==========================================================================
   WHAT THE CORPUS IS SUPPOSED TO CONTAIN — see docs/CORPUS.md
   ========================================================================== */

const EXPECT = {
  nodes: 472,
  untyped: 3801,
  typed: 2304,
  typeCount: 19,
  gapPages: 151,
  gaps: 484,
  domains: 10,
  words: 774912,
}

/**
 * The nineteen relationship types, grouped by what kind of assertion they make.
 * The family decides how an edge is drawn; it is a grouping of the names the
 * corpus already uses, not a judgement about which edges matter.
 */
const FAMILY = {
  causes: 'causal', 'caused-by': 'causal', precedes: 'causal', follows: 'causal',
  escalates: 'causal', resolves: 'causal',
  contains: 'structural', 'component-of': 'structural',
  instantiates: 'structural', 'instance-of': 'structural',
  evidences: 'evidential', 'evidenced-by': 'evidential', contextualizes: 'evidential',
  supplies: 'evidential', 'supplied-by': 'evidential',
  'co-occurs': 'affinity', parallels: 'affinity', mirrors: 'affinity',
  contradicts: 'tension',
}

/** Which type undoes which. Symmetric types are their own inverse. */
const INVERSE = {
  causes: 'caused-by', 'caused-by': 'causes',
  contains: 'component-of', 'component-of': 'contains',
  instantiates: 'instance-of', 'instance-of': 'instantiates',
  evidences: 'evidenced-by', 'evidenced-by': 'evidences',
  precedes: 'follows', follows: 'precedes',
  supplies: 'supplied-by', 'supplied-by': 'supplies',
  'co-occurs': 'co-occurs', parallels: 'parallels',
  contradicts: 'contradicts', mirrors: 'mirrors',
}

/* ==========================================================================
   READ
   ========================================================================== */

if (!existsSync(join(WIKI, 'index.json'))) {
  console.error(`No wiki snapshot to read: ${WIKI}/index.json`)
  console.error('Get it over first: node scripts/sync-wiki.mjs ../wiki-brain')
  process.exit(1)
}

const index = JSON.parse(readFileSync(join(WIKI, 'index.json'), 'utf8'))
const gapsSet = JSON.parse(readFileSync(join(WIKI, 'gaps.json'), 'utf8'))
const chronology = existsSync(join(LEV, 'chronology.json'))
  ? JSON.parse(readFileSync(join(LEV, 'chronology.json'), 'utf8'))
  : { months: [] }

const nodeAt = new Map(index.pages.map((p, i) => [p.slug, i]))

/* ---- the typed graph, out of every page's front-matter -------------------- */

const typed = []
const claims = []
const typeTally = new Map()
let wrapped = 0
let dangling = 0
const sourceRefs = new Map() // page index -> Map(root -> count)
const ROOT = /^((?:raw|exports|ingest)\/[^/]+(?:\/[^/]+)?)/

for (const file of readdirSync(join(WIKI, 'pages')).sort()) {
  if (!file.endsWith('.json')) continue
  const page = JSON.parse(readFileSync(join(WIKI, 'pages', file), 'utf8'))
  const from = nodeAt.get(page.slug)
  if (from === undefined) continue

  const { items, wrapped: odd } = readConnections(page.fmRaw)
  wrapped += odd
  for (const c of items) {
    const to = nodeAt.get(bareSlug(c.page))
    // A connection can name a page that is not in the snapshot — the wiki is
    // edited faster than it is synced. Those are counted and dropped rather
    // than pointed at node 0, which would be a fabricated edge.
    if (to === undefined) {
      dangling++
      continue
    }
    typed.push([from, to, c.type])
    claims.push(c.claim)
    typeTally.set(c.type, (typeTally.get(c.type) ?? 0) + 1)
  }

  // Provenance: which raw corpora this page cites. The paths are strings about
  // files that do not ship; what is drawn is the count, not the contents.
  const cites = page.lists?.sources ?? []
  if (cites.length) {
    const roots = new Map()
    for (const ref of cites) {
      const m = String(ref).match(ROOT)
      if (!m) continue
      roots.set(m[1], (roots.get(m[1]) ?? 0) + 1)
    }
    if (roots.size) sourceRefs.set(from, roots)
  }
}

/* ---- when each page sits on the time axis --------------------------------- */

/**
 * A page's position in time, in fractional years, by the first of these that
 * the record actually supplies. `tSrc` says which one, so the instrument can
 * admit that a page placed by its file-creation date is not the same claim as
 * one placed by a documented range.
 */
const T_SRC = ['range', 'start', 'mention', 'created', 'none']

const yearOf = (iso) => {
  const m = String(iso).match(/^(\d{4})-(\d{2})(?:-(\d{2}))?/)
  if (!m) return null
  return +m[1] + (+m[2] - 1) / 12 + (m[3] ? (+m[3] - 1) / 365 : 0)
}

// Earliest dated mention per page, from the chronology instrument.
const firstMention = new Map()
for (const month of chronology.months ?? []) {
  const t = month.year + (month.month ?? 0) / 12
  for (const ref of month.pages ?? []) {
    const cur = firstMention.get(ref.slug)
    if (cur === undefined || t < cur) firstMention.set(ref.slug, t)
  }
}

const gapsFor = new Map((gapsSet.pages ?? []).map((p) => [p.slug, p.gaps.length]))

const nodes = index.pages.map((p, i) => {
  const raw = JSON.parse(readFileSync(join(WIKI, 'pages', `${p.slug.replace(/\//g, '__')}.json`), 'utf8'))
  const meta = raw.meta ?? {}
  const a = yearOf(meta.date_range_start)
  const b = yearOf(meta.date_range_end)
  const mention = firstMention.get(p.slug) ?? null
  const created = yearOf(meta.date_created)

  let t = null
  let src = 4
  if (a !== null && b !== null) {
    t = (a + b) / 2
    src = 0
  } else if (a !== null) {
    t = a
    src = 1
  } else if (mention !== null) {
    t = mention
    src = 2
  } else if (created !== null) {
    t = created
    src = 3
  }

  return {
    s: p.slug,
    n: p.title,
    d: p.domain,
    k: p.type,
    st: p.status,
    w: p.words,
    x: p.x,
    y: p.y,
    t: t === null ? null : Math.round(t * 1000) / 1000,
    ts: src,
    a: a === null ? null : Math.round(a * 1000) / 1000,
    b: b === null ? null : Math.round(b * 1000) / 1000,
    g: gapsFor.get(p.slug) ?? 0,
    bl: (raw.backlinks ?? []).length,
    ol: (raw.links ?? []).length,
    kn: meta.knowledge ?? null,
    im: meta.importance ?? null,
    i, // its own index, so a filtered subset can still address the original
  }
})

/* ---- the provenance anchors ---------------------------------------------- */

const rootTally = new Map()
for (const roots of sourceRefs.values())
  for (const [root, n] of roots) rootTally.set(root, (rootTally.get(root) ?? 0) + n)
const roots = [...rootTally.entries()].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))
const rootAt = new Map(roots.map(([id], i) => [id, i]))
const nodeRoots = []
for (const [node, rs] of [...sourceRefs.entries()].sort((a, b) => a[0] - b[0]))
  for (const [root, n] of [...rs.entries()].sort())
    nodeRoots.push([node, rootAt.get(root), n])

/* ---- facets --------------------------------------------------------------- */

const tally = (key) => {
  const m = new Map()
  for (const n of nodes) {
    const v = n[key]
    if (v === null || v === undefined) continue
    m.set(v, (m.get(v) ?? 0) + 1)
  }
  return [...m.entries()].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1)).map(([id, n]) => ({ id, n }))
}

const types = [...typeTally.entries()]
  .sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))
  .map(([id, n]) => ({
    id,
    n,
    family: FAMILY[id] ?? 'other',
    inverse: INVERSE[id] ?? null,
    symmetric: INVERSE[id] === id,
  }))
const typeAt = new Map(types.map((t, i) => [t.id, i]))

/* ==========================================================================
   WRITE
   ========================================================================== */

const structure = {
  // The snapshot's own stamp, not the wall clock — the same rule as
  // build-docket.mjs. This file is committed and the sync workflow rebuilds it
  // on every run whether or not the wiki moved, so a `new Date()` here commits
  // a one-line JSON diff every hour and fires a deploy behind it. Keyed off the
  // snapshot it is byte-identical until the wiki actually changes.
  generatedAt: index.generatedAt,
  source: `${WIKI} · ${nodes.length} pages`,
  counts: {
    nodes: nodes.length,
    words: index.counts.words,
    typed: typed.length,
    untyped: index.edges.length,
    types: types.length,
    gaps: [...gapsFor.values()].reduce((a, b) => a + b, 0),
    gapPages: gapsFor.size,
    roots: roots.length,
    sourceRefs: nodeRoots.reduce((a, r) => a + r[2], 0),
    dangling,
  },
  /** Fractional-year span the structure is drawn across. */
  span: {
    from: Math.min(...nodes.filter((n) => n.t !== null).map((n) => n.t)),
    to: Math.max(...nodes.filter((n) => n.t !== null).map((n) => n.t)),
  },
  tSrc: T_SRC,
  domains: index.domains,
  types,
  facets: { kind: tally('k'), status: tally('st'), knowledge: tally('kn'), importance: tally('im') },
  nodes,
  /** `[from, to, typeIdx]` — the argued graph. Index i aligns with claims[i]. */
  typed: typed.map(([from, to, type]) => [from, to, typeAt.get(type)]),
  /** The untyped wikilink graph, as index.json already solved it. */
  untyped: index.edges,
  roots: roots.map(([id, n]) => ({ id, n })),
  nodeRoots,
}

mkdirSync(OUT, { recursive: true })
writeFileSync(join(OUT, 'structure.json'), JSON.stringify(structure) + '\n')
writeFileSync(
  join(OUT, 'claims.json'),
  JSON.stringify({ generatedAt: structure.generatedAt, claims }) + '\n',
)

/* ==========================================================================
   CHECK — the build refuses to write a corpus it does not recognise
   ========================================================================== */

const size = (f) => (JSON.stringify(f).length / 1e6).toFixed(2)
console.log(
  `${OUT}/structure.json — ${nodes.length} nodes · ${typed.length.toLocaleString()} typed edges · ` +
    `${types.length} types · ${index.edges.length.toLocaleString()} untyped · ` +
    `${roots.length} raw-corpus roots · ${size(structure)} MB`,
)
console.log(
  `${OUT}/claims.json — ${claims.length.toLocaleString()} claims · ` +
    `${(claims.reduce((a, c) => a + c.length, 0) / 1e3).toFixed(0)}k chars`,
)

const placed = nodes.filter((n) => n.t !== null).length
const bySrc = T_SRC.map((name, i) => `${name} ${nodes.filter((n) => n.ts === i).length}`)
console.log(`  placed in time: ${placed}/${nodes.length} — ${bySrc.join(' · ')}`)
console.log(`  span: ${structure.span.from.toFixed(1)} → ${structure.span.to.toFixed(1)}`)

const problems = []
const want = (label, got, expected) => {
  if (got !== expected) problems.push(`${label}: got ${got}, docs/CORPUS.md says ${expected}`)
}
want('nodes', nodes.length, EXPECT.nodes)
want('words', index.counts.words, EXPECT.words)
want('untyped edges', index.edges.length, EXPECT.untyped)
want('typed edges', typed.length + dangling, EXPECT.typed)
want('relationship types', types.length, EXPECT.typeCount)
want('domains', index.domains.length, EXPECT.domains)
want('pages declaring gaps', gapsFor.size, EXPECT.gapPages)
want('declared gaps', structure.counts.gaps, EXPECT.gaps)
if (wrapped) problems.push(`${wrapped} front-matter lines the connections reader did not understand`)
for (const t of types) {
  if (!FAMILY[t.id]) problems.push(`relationship type "${t.id}" has no family — see FAMILY in this file`)
}

if (problems.length) {
  console.error('\nThe corpus does not match docs/CORPUS.md:')
  for (const p of problems) console.error(`  ${p}`)
  console.error('\nRe-crawl, correct docs/CORPUS.md, then update EXPECT here. Do not relax the check.')

  // The check stays exactly as strict; this only removes the archaeology.
  // Every failure here has to be resolved by hand-deriving eight numbers out of
  // three payloads, and on 2026-08-30 that cost the site a day: the sync went
  // red at 08:09, deploy stayed green, and 22 merged plain-language twins sat
  // unpublished because nobody knew where to look. Printing the block that
  // WOULD match turns that into a copy-paste — after a human has looked at the
  // diff above and agreed the corpus really did move.
  console.error('\nIf the corpus legitimately moved, this is the block that matches it now:\n')
  console.error('const EXPECT = {')
  for (const [k, v] of [
    ['nodes', nodes.length], ['untyped', index.edges.length],
    ['typed', typed.length + dangling], ['typeCount', types.length],
    ['gapPages', gapsFor.size], ['gaps', structure.counts.gaps],
    ['domains', index.domains.length], ['words', index.counts.words],
  ]) console.error(`  ${k}: ${v},${v === EXPECT[k] ? '' : `   // was ${EXPECT[k]}`}`)
  console.error('}')
  console.error('\ndocs/CORPUS.md carries these figures in several places — the header line,')
  console.error('the `counts` block, the per-page `words` row, the domain aggregate table and')
  console.error('its total row, and mass.json\'s summing figure. Correct all of them.')
  process.exit(1)
}
if (dangling) console.log(`  ${dangling} connections name a page the snapshot does not carry — dropped, not faked`)
console.log('  every count matches docs/CORPUS.md')
