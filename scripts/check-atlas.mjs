#!/usr/bin/env node
/* ==========================================================================
   CHECK THE SWITCHBOARD.

   src/nav/atlas.ts writes out the identity of forty-five destinations instead
   of importing the registries they come from, and it does that for a real
   reason — the header is on the critical path of every route on this site, and
   importing src/leviathan/core.ts (48 kB) and src/arcade/content.ts (22 kB) to
   render a nav bar is exactly the thing src/App.tsx spends thirty lines
   refusing to do.

   The cost of that decision is drift, and this file is what pays it. A
   typed-out registry that nothing checks is a lie waiting to happen: an
   instrument gets built and no jack appears, a room gets renamed and the board
   still says the old name, a route changes and a chip points at a 404. None of
   those look like a broken build. All of them are.

   So: every claim atlas.ts makes about another file is asserted against that
   file here, and any failure exits 1.

     1. every `to` resolves to a route pattern declared in src/App.tsx
     2. the twenty-three instrument jacks are exactly the keys of BUILT in
        src/routes/Leviathan.tsx, in both directions
     3. every instrument and cabinet jack's title and kana match the registry
        it came from
     4. every SECTIONS slug is reachable from some jack
     5. no duplicate id, no duplicate route
     6. /ledger is absent, which is deliberate and documented in both files
     7. the per-bank counts the board prints are the counts in the registry

   Run: npm run atlas:check
   ========================================================================== */

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const read = (p) => readFileSync(join(ROOT, p), 'utf8')

const problems = []
const fail = (msg) => problems.push(msg)

/* ---- the atlas, parsed out of its own source ---------------------------- */

const atlasSrc = read('src/nav/atlas.ts')

/**
 * Object literals are read with a regex rather than by importing the module:
 * atlas.ts imports SECTIONS, which imports slogans, and node would need the
 * whole TS pipeline to get at one array of strings. The shapes here are
 * hand-written and stable, and a parse failure shows up as a count mismatch
 * against the totals asserted at the bottom.
 */
function objects(src) {
  const out = []
  const re = /\{\s*\n\s*id: '([^']+)',\s*\n\s*bank: '([A-Z]+)',\s*\n\s*to: '([^']+)',\s*\n\s*title: (?:'((?:[^'\\]|\\.)*)'|"([^"]*)"),\s*\n(?:\s*short: '([^']*)',\s*\n)?\s*kana: '([^']+)',/g
  let m
  while ((m = re.exec(src))) {
    out.push({ id: m[1], bank: m[2], to: m[3], title: m[4] ?? m[5], short: m[6], kana: m[7] })
  }
  return out
}

/** The two helper-built families: instrument(...) and cab(...). */
function helpers(src, name, bank, prefix, route) {
  const out = []
  const re = new RegExp(`${name}\\('([^']+)', '((?:[^'\\\\]|\\\\.)*)', '([^']+)',`, 'g')
  let m
  while ((m = re.exec(src))) {
    const id = m[1]
    out.push({
      id: `${prefix}${id}`,
      bank,
      to: route(id),
      title: m[2].replace(/\\'/g, "'"),
      kana: m[3],
      sourceId: id,
    })
  }
  return out
}

const literals = objects(atlasSrc)
const instrumentJacks = helpers(atlasSrc, 'instrument', 'INSTRUMENTS', 'lev-', (id) => `/leviathan/${id}`)
const cabJacks = helpers(atlasSrc, 'cab', 'ROOMS', 'cab-', (id) => `/arcade/${id}`)
const jacks = [...literals, ...instrumentJacks, ...cabJacks]

if (jacks.length < 40) {
  fail(`parsed only ${jacks.length} jacks out of src/nav/atlas.ts — the regexes in this script have drifted from the file's shape`)
}

/* ---- 1. every route is a real route ------------------------------------ */

const appSrc = read('src/App.tsx')
const routePaths = [...appSrc.matchAll(/<Route path="([^"]+)"/g)].map((m) => m[1])

/** Does a declared pattern (which may end in /* or carry :params) cover a path? */
const covers = (pattern, path) => {
  const p = pattern.replace(/\/\*$/, '/(.+)').replace(/:[^/]+/g, '[^/]+')
  return new RegExp(`^${p}$`).test(path)
}

for (const jack of jacks) {
  const path = jack.to.split('?')[0]
  if (!routePaths.some((p) => covers(p, path))) {
    fail(`jack "${jack.id}" points at ${jack.to}, which no <Route> in src/App.tsx declares`)
  }
}

/* ---- 2. the instrument jacks are exactly what BUILT renders ------------- */

const levSrc = read('src/routes/Leviathan.tsx')
const builtBlock = levSrc.match(/const BUILT: Record<string, typeof Mass> = \{([\s\S]*?)\n\}/)
if (!builtBlock) {
  fail('could not find the BUILT map in src/routes/Leviathan.tsx')
}
const builtIds = builtBlock ? [...builtBlock[1].matchAll(/^\s*([a-z][\w-]*):/gm)].map((m) => m[1]) : []

const jackInstrumentIds = instrumentJacks.map((j) => j.sourceId)
for (const id of builtIds) {
  if (!jackInstrumentIds.includes(id)) {
    fail(`instrument "${id}" is built and routable at /leviathan/${id}, but has no jack in src/nav/atlas.ts — it is unreachable from the board`)
  }
}
for (const id of jackInstrumentIds) {
  if (!builtIds.includes(id)) {
    fail(`jack "lev-${id}" points at /leviathan/${id}, but BUILT in src/routes/Leviathan.tsx has no component for it — that is a dead line on the board`)
  }
}

/* ---- 3. titles and kana match the registries they came from ------------- */

const coreSrc = read('src/leviathan/core.ts')
const registry = {}
{
  const re = /\{\s*\n\s*id: '([^']+)',\n\s*numeral: '([^']+)',\n\s*title: '((?:[^'\\]|\\.)*)',\n\s*kana: '([^']+)',/g
  let m
  while ((m = re.exec(coreSrc))) registry[m[1]] = { title: m[3], kana: m[4] }
}

for (const jack of instrumentJacks) {
  const truth = registry[jack.sourceId]
  if (!truth) {
    fail(`instrument "${jack.sourceId}" has a jack but is not in INSTRUMENTS in src/leviathan/core.ts`)
    continue
  }
  if (truth.title !== jack.title) {
    fail(`jack "lev-${jack.sourceId}" says title ${JSON.stringify(jack.title)}; src/leviathan/core.ts says ${JSON.stringify(truth.title)}`)
  }
  if (truth.kana !== jack.kana) {
    fail(`jack "lev-${jack.sourceId}" says kana ${JSON.stringify(jack.kana)}; src/leviathan/core.ts says ${JSON.stringify(truth.kana)}`)
  }
}

const cabSrc = read('src/arcade/content.ts')
const cabs = {}
{
  const re = /\{\s*\n\s*id: '([^']+)',\n\s*numeral: '([^']+)',\n\s*title: '((?:[^'\\]|\\.)*)',\n\s*sub: '((?:[^'\\]|\\.)*)',\n\s*kana: '([^']+)',/g
  let m
  while ((m = re.exec(cabSrc))) cabs[m[1]] = { title: m[3], kana: m[5] }
}

for (const jack of cabJacks) {
  const truth = cabs[jack.sourceId]
  if (!truth) {
    fail(`cabinet "${jack.sourceId}" has a jack but is not in CABS in src/arcade/content.ts`)
    continue
  }
  if (truth.title !== jack.title) {
    fail(`jack "cab-${jack.sourceId}" says title ${JSON.stringify(jack.title)}; src/arcade/content.ts says ${JSON.stringify(truth.title)}`)
  }
  if (truth.kana !== jack.kana) {
    fail(`jack "cab-${jack.sourceId}" says kana ${JSON.stringify(jack.kana)}; src/arcade/content.ts says ${JSON.stringify(truth.kana)}`)
  }
}

const cabCount = Object.keys(cabs).length
if (cabJacks.length !== cabCount) {
  fail(`CABS has ${cabCount} cabinets; the board has ${cabJacks.length} jacks for them`)
}

/* ---- 4. every room in SECTIONS is reachable ----------------------------- */

const sectionSlugs = [...read('src/content/sections.ts').matchAll(/^\s*slug: '([^']+)',/gm)].map((m) => m[1])
for (const slug of sectionSlugs) {
  if (!jacks.some((j) => j.to === `/${slug}`)) {
    fail(`SECTIONS declares the room "${slug}" and no jack points at /${slug}`)
  }
}

/* ---- 5. nothing is declared twice --------------------------------------- */

for (const key of ['id', 'to']) {
  const seen = new Map()
  for (const jack of jacks) {
    if (seen.has(jack[key])) fail(`two jacks share the same ${key}: "${jack.id}" and "${seen.get(jack[key])}" (${jack[key]})`)
    else seen.set(jack[key], jack.id)
  }
}

/* ---- 6. the ledger stays unlisted --------------------------------------- */

if (jacks.some((j) => j.to.startsWith('/ledger'))) {
  fail('/ledger has a jack. It is deliberately unlisted — see the comment in src/App.tsx and the one in src/nav/atlas.ts. This is not an omission to fix.')
}

/* ---- 7. the counts the board prints ------------------------------------- */

const perBank = {}
for (const jack of jacks) perBank[jack.bank] = (perBank[jack.bank] ?? 0) + 1

const EXPECTED = { BRAIN: 8, INSTRUMENTS: 26, RECORD: 2, ROOMS: 9 }
for (const [bank, n] of Object.entries(EXPECTED)) {
  if (perBank[bank] !== n) {
    fail(`bank ${bank} holds ${perBank[bank] ?? 0} jacks; this check was written against ${n}. If the change is intended, update EXPECTED in scripts/check-atlas.mjs and the count printed on the board.`)
  }
}

const TOTAL = Object.values(EXPECTED).reduce((a, b) => a + b, 0)
if (jacks.length !== TOTAL) fail(`the board has ${jacks.length} jacks; the banks account for ${TOTAL}`)

/* ---- the verdict -------------------------------------------------------- */

if (problems.length) {
  console.error(`\nTHE SWITCHBOARD IS OUT OF TRUE — ${problems.length} problem${problems.length === 1 ? '' : 's'}:\n`)
  for (const p of problems) console.error(`  · ${p}`)
  console.error('')
  process.exit(1)
}

console.log(
  `THE SWITCHBOARD HOLDS. ${jacks.length} jacks across ${Object.keys(EXPECTED).length} banks — ` +
    `${Object.entries(EXPECTED).map(([b, n]) => `${b} ${n}`).join(', ')}. ` +
    `${builtIds.length} built instruments, ${cabCount} cabinets, ${sectionSlugs.length} rooms, all reachable. /ledger unlisted.`,
)
