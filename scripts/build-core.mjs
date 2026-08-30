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
 * ---- the invariants, and why they are no longer constants ------------------
 *
 * The thing this build must refuse to do is write a structure that has quietly
 * lost a thousand edges, because it renders exactly like one that has not.
 * Until 2026-08-30 that refusal was eight hand-typed numbers checked for exact
 * equality — nodes 471, words 772,670, and so on — copied out of
 * `docs/CORPUS.md` by whoever last looked.
 *
 * That is the wrong shape for this repository and it failed in the way wrong
 * shapes do. The corpus is a wiki somebody writes in every day; `wiki/meta/`
 * alone carries three generated mirrors whose word counts move when the corpus
 * is merely *described*. The sync runs hourly. So every ordinary page edit
 * upstream turned this check red, the snapshot froze at whatever it had last
 * managed to write, and the site kept deploying — green — from a corpus that
 * had stopped advancing. Between 2026-08-29 and 2026-08-30 that cost eight
 * days of `public/leviathan/wiki.json`, then 22 of 25 Reader's Digest twins,
 * merged and never published.
 *
 * The deeper failure is what the fix became. `words: got 772670, says 772653`
 * is cleared by typing 772670, and a check whose remedy is to retype the number
 * it just printed is a check nobody reads any more — it had been bumped
 * seventeen words earlier the same day. **An assertion that must be edited to
 * accept normal operation eventually gets edited without looking.**
 *
 * So the check is split into the two questions the constants were conflating:
 *
 *   SHAPE     — does this build agree with the snapshot it was derived from?
 *               Exact, self-derived, and true of any corpus: nodes against
 *               index rows against page files, words against the sum of the
 *               pages, edges in range and distinct, typed edges against what
 *               the front-matter reader actually consumed, every relationship
 *               type carrying a family. These never need updating, and they
 *               catch a derivation bug the moment it happens rather than
 *               whenever a human next re-crawls.
 *
 *   MOVEMENT  — has the corpus collapsed since the last build? Compared against
 *               the `public/core/structure.json` already committed here, which
 *               is the previous run's own output, so the baseline maintains
 *               itself. Growth never fails. A fall past COLLAPSE fails loudly
 *               and names what fell.
 *
 * Every count is printed on every run either way, so the log still shows the
 * corpus moving. `docs/CORPUS.md` remains the data dictionary; what it no
 * longer is, is a set of constants an hourly robot must be kept in step with.
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { bareSlug, readConnections } from './core-frontmatter.mjs'

const WIKI = 'public/wiki'
const LEV = 'public/leviathan'
const OUT = 'public/core'

/* ==========================================================================
   HOW FAR THE CORPUS MAY MOVE IN ONE BUILD — see the note at the top
   ========================================================================== */

/**
 * The one thing that is not derivable from the snapshot: how much of the corpus
 * may disappear between two builds before somebody should be made to look.
 *
 * A wiki loses pages legitimately, and in quantity: a deletion pass took 48 of
 * 519 pages away on 2026-08-29 (see `a3a88ac` in this repository). So this is
 * not zero, and it is set from that precedent rather than from taste — 15%
 * clears the largest purge the record actually holds, with room.
 *
 * It is a cliff, not a tolerance. A fall past it in one hourly step is not
 * editing; it is a truncated read, a half-written snapshot, or a reader that
 * stopped understanding the front matter, and every one of those loses far more
 * than a purge does. `floor` catches the same failure on a corpus small enough
 * that a percentage would not.
 *
 * Growth is never checked. Nothing about this instrument breaks when the corpus
 * gets bigger, and a ceiling would be one more number to bump.
 */
const COLLAPSE = { fraction: 0.85, floor: 25 }

/** Counts compared against the previous build. Anything else is shape. */
const TRACKED = ['nodes', 'words', 'typed', 'untyped', 'gaps', 'gapPages']

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

/**
 * The previous build's own output, read before this one overwrites it. This is
 * the movement baseline: the file is committed, so a checkout always carries
 * the last build that was accepted, and every successful run advances it with
 * no hand-maintained number anywhere in the loop.
 *
 * Absent on a tree that has never built. That is not a failure — it is the
 * first build — and it is said out loud rather than passing silently, because
 * a missing baseline and a baseline that matches must not look the same.
 */
const previous = existsSync(join(OUT, 'structure.json'))
  ? JSON.parse(readFileSync(join(OUT, 'structure.json'), 'utf8'))
  : null

/* ---- the typed graph, out of every page's front-matter -------------------- */

/**
 * A second, deliberately different count of the same thing: how many
 * connections a page's front matter *declares*, read by regex over the block
 * rather than by the line state machine in `core-frontmatter.mjs`.
 *
 * This exists so the two readers can be set against each other. The one that
 * matters is narrow on purpose — see the note at the top of that file — and
 * `wrapped` catches a shape it does not recognise, but neither catches the case
 * where it stops entering the block at all and reports a confident zero. Two
 * implementations disagreeing is the only evidence available that either is
 * still reading.
 *
 * Scoped to the `connections:` block, never the whole front matter: sixteen
 * `- page:` openers across the corpus sit under a `stops:` key, and a naive
 * scan counts them (docs/CORPUS.md §3).
 */
function declaredConnections(fmRaw) {
  if (!fmRaw) return 0
  const lines = fmRaw.split('\n')
  const at = lines.findIndex((l) => /^connections:\s*$/.test(l))
  if (at < 0) return 0
  let end = lines.length
  for (let i = at + 1; i < lines.length; i++) {
    if (lines[i].trim() !== '' && !/^\s/.test(lines[i])) {
      end = i
      break
    }
  }
  return lines.slice(at + 1, end).filter((l) => /^\s*-\s+page:/.test(l)).length
}

const typed = []
const claims = []
const typeTally = new Map()
let wrapped = 0
let dangling = 0
let declared = 0
const sourceRefs = new Map() // page index -> Map(root -> count)
const ROOT = /^((?:raw|exports|ingest)\/[^/]+(?:\/[^/]+)?)/

for (const file of readdirSync(join(WIKI, 'pages')).sort()) {
  if (!file.endsWith('.json')) continue
  const page = JSON.parse(readFileSync(join(WIKI, 'pages', file), 'utf8'))
  const from = nodeAt.get(page.slug)
  if (from === undefined) continue

  const { items, wrapped: odd } = readConnections(page.fmRaw)
  wrapped += odd
  declared += declaredConnections(page.fmRaw)
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
   ASSEMBLE — the structure in memory; it reaches disk after the checks
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

/* ---- SHAPE: does this build agree with what it read? ----------------------
 *
 * Every one of these is derived from the snapshot in this same run, so none of
 * them has a number in it that anybody maintains. They are the ones that catch
 * a derivation bug — a truncated read, a reader that stopped entering a block,
 * an index and a set of page files that have come apart — at the moment it
 * happens, on any corpus, of any size.
 */
const shape = []
const agree = (label, a, b, aName, bName) => {
  if (a !== b) shape.push(`${label}: ${aName} says ${a}, ${bName} says ${b}`)
}

const pageFiles = readdirSync(join(WIKI, 'pages')).filter((f) => f.endsWith('.json')).length
agree('nodes', nodes.length, index.pages.length, 'this build', 'index.json')
agree('nodes', nodes.length, index.counts.pages, 'this build', "index.json's own count")
agree('nodes', nodes.length, pageFiles, 'this build', `${WIKI}/pages`)

const summed = index.pages.reduce((a, p) => a + (p.words ?? 0), 0)
agree('words', index.counts.words, summed, "index.json's count", 'the sum of its pages')

agree('untyped edges', index.edges.length, index.counts.edges, 'index.json', 'its own count')
let outOfRange = 0
let selfLoop = 0
const seenEdge = new Set()
let duplicate = 0
for (const [a, b] of index.edges) {
  if (!Number.isInteger(a) || !Number.isInteger(b) || a < 0 || b < 0 || a >= nodes.length || b >= nodes.length)
    outOfRange++
  else if (a === b) selfLoop++
  else {
    const k = a < b ? `${a}-${b}` : `${b}-${a}`
    if (seenEdge.has(k)) duplicate++
    seenEdge.add(k)
  }
}
if (outOfRange) shape.push(`${outOfRange} untyped edges index a node that does not exist`)
if (selfLoop) shape.push(`${selfLoop} untyped edges are self-loops`)
if (duplicate) shape.push(`${duplicate} untyped edges are duplicates of another pair`)

// The two front-matter readers, set against each other. See declaredConnections.
agree('typed edges', typed.length + dangling, declared, 'the connections reader', 'a second count of the same blocks')
if (wrapped) shape.push(`${wrapped} front-matter lines the connections reader did not understand`)
if (declared && !typed.length) shape.push(`${declared} connections declared and none read — the reader is not reading`)

agree('declared gaps', structure.counts.gaps, gapsSet.counts?.open ?? -1, 'this build', 'gaps.json')
agree('pages declaring gaps', gapsFor.size, gapsSet.counts?.pages ?? -1, 'this build', 'gaps.json')
agree('domains', index.domains.length, new Set(index.pages.map((p) => p.domain)).size, 'index.json', 'its pages')

for (const t of types) {
  // FAMILY decides how an edge is drawn, so a type missing from it draws as
  // 'other' and the instrument quietly stops saying what it was built to say.
  // INVERSE is deliberately not checked: `contextualizes`, `escalates` and
  // `resolves` have no undo and never did.
  if (!FAMILY[t.id]) shape.push(`relationship type "${t.id}" has no family — see FAMILY in this file`)
}
if (!Number.isFinite(structure.span.from) || !Number.isFinite(structure.span.to))
  shape.push('no page could be placed in time — the structure has no span to draw')

/* ---- MOVEMENT: has the corpus collapsed since the last build? ------------- */

const movement = []
if (previous?.counts) {
  const deltas = []
  for (const key of TRACKED) {
    const was = previous.counts[key]
    const now = structure.counts[key]
    if (typeof was !== 'number' || typeof now !== 'number') continue
    if (now !== was) deltas.push(`${key} ${was.toLocaleString()} → ${now.toLocaleString()}`)
    const floor = Math.min(was - COLLAPSE.floor, Math.floor(was * COLLAPSE.fraction))
    if (now < floor)
      movement.push(
        `${key} fell ${was.toLocaleString()} → ${now.toLocaleString()} ` +
          `— a ${(((was - now) / was) * 100).toFixed(1)}% fall`,
      )
  }
  console.log(
    deltas.length
      ? `  since the last build: ${deltas.join(' · ')}`
      : '  unchanged since the last build',
  )
} else {
  console.log('  no previous build to compare against — movement unchecked')
}

/* ---- the refusal ---------------------------------------------------------- */

if (shape.length) {
  console.error('\nThis build does not agree with the snapshot it read:')
  for (const p of shape) console.error(`  ${p}`)
  console.error(
    '\nThese are self-consistency checks — there is no constant to update. Something in\n' +
      'the derivation is losing data: re-run the sync, then read the reader.',
  )
  process.exit(1)
}

if (movement.length) {
  console.error('\nThe corpus collapsed against the last committed build:')
  for (const p of movement) console.error(`  ${p}`)
  console.error(
    `\nA fall past ${((1 - COLLAPSE.fraction) * 100).toFixed(0)}% (or ${COLLAPSE.floor} items) in one build is not editing — it is a\n` +
      'truncated read or a half-written snapshot. Check the source wiki actually lost\n' +
      'this, then re-run with CORPUS_ACCEPT_DROP=1 to accept it and move the baseline.\n' +
      'The hourly sync does not set that, on purpose: a drop this size wants a person.',
  )
  if (!process.env.CORPUS_ACCEPT_DROP) process.exit(1)
  console.error('  CORPUS_ACCEPT_DROP is set — accepted.')
}

if (dangling) console.log(`  ${dangling} connections name a page the snapshot does not carry — dropped, not faked`)
console.log('  the structure agrees with the snapshot it was built from')

/* ==========================================================================
   WRITE — only once it has passed
   ========================================================================== */

// After the checks, not before them. `structure.json` is this build's output
// *and* the next build's movement baseline, so writing a structure that failed
// would launder the collapse into the thing the next run compares against.
mkdirSync(OUT, { recursive: true })
writeFileSync(join(OUT, 'structure.json'), JSON.stringify(structure) + '\n')
writeFileSync(
  join(OUT, 'claims.json'),
  JSON.stringify({ generatedAt: structure.generatedAt, claims }) + '\n',
)
