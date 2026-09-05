#!/usr/bin/env node
/**
 * THE BOARD, CHECKED — what `src/content/board.json` is allowed to say.
 *
 * The board is the one dataset in this repository written by a form in a
 * browser rather than by a script in CI. `src/slates/publish-slates.ts` builds
 * it from a dashboard, commits it beside a picture, and nothing between that
 * form and the deployed site would notice if it wrote a plate id nobody has,
 * a wall nobody reads, or a filename with no file behind it. Every one of
 * those renders as *the fallback* — which is to say, as a working site with
 * the wrong pictures on it, deployed green.
 *
 * So the assertions are here, they run in the deploy job, and they exit 1.
 *
 *   1. Every plate id the board names exists — in `SCENES`, or in the board's
 *      own `plates`.
 *   2. Every uploaded plate has a real file under `public/art/`, a positive
 *      pixel size, a tone in 1–5, and alt text. Not a kana: that field is
 *      optional and `Plate` draws no corner without one. A `kana` key that is
 *      present and empty is still caught, because that is a form writing a
 *      blank rather than a picture that has no word.
 *   3. Every wall the board assigns is a wall the registry knows, and every
 *      wall the registry offers is one the site actually reads. A dashboard
 *      that hangs a picture on a wall no component looks at is a dashboard
 *      that lies, and it lies quietly.
 *   4. The six hand-placed walls still fall back to the pictures that hung
 *      there before the board existed. That table is duplicated below on
 *      purpose: it is the historical fact, held somewhere the file under test
 *      cannot edit, so a change to `slates.ts` that silently re-hangs the
 *      front door fails here instead of shipping.
 *
 * Run: npm run slates:check
 */
import { readFileSync, existsSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const root = new URL('..', import.meta.url).pathname
const read = (p) => readFileSync(join(root, p), 'utf8')

const problems = []
const fail = (msg) => problems.push(msg)

/* ---- what the repository says exists ------------------------------------ */

const artSource = read('src/content/art.ts')
// SCENES rows only: the ALLY photographs are `asset('ally/…')` and are not
// hangable plates.
const SCENE_ORDER = [...artSource.matchAll(/\{ id: '([^']+)', src: asset\('art\//g)].map(
  (m) => m[1],
)
if (SCENE_ORDER.length < 8) {
  fail(
    `parsed only ${SCENE_ORDER.length} scenes out of src/content/art.ts — the row format ` +
      'changed and this check is now reading a different file than it thinks it is',
  )
}

const sectionSource = read('src/content/sections.ts')
const SLUGS = [...sectionSource.matchAll(/^ {4}slug: '([^']+)',$/gm)].map((m) => m[1])
if (SLUGS.length < 8) {
  fail(`parsed only ${SLUGS.length} sections out of src/content/sections.ts — same problem`)
}

const slatesSource = read('src/content/slates.ts')
const wallsBlock = slatesSource.slice(
  slatesSource.indexOf('export const WALLS: Wall[] = ['),
  slatesSource.indexOf('export const POOLS: Pool[] = ['),
)
const FIXED = [...wallsBlock.matchAll(/id: '([^']+)',[\s\S]*?fallback: '([^']+)',/g)].map((m) => ({
  id: m[1],
  fallback: m[2],
}))

/**
 * Where each hand-placed plate hung before `board.json` existed, read off
 * `Home.tsx` and `Splash.tsx` at commit 40ed73d. Not derived — recorded.
 */
const AS_HUNG = {
  'door-left': 'kiss-window',
  'door-right': 'kiss-neon',
  mast: 'kiss-uniform',
  'void-1': 'kiss-water',
  'void-2': 'kiss-close',
  'void-3': 'kiss-dark',
}

for (const [id, plate] of Object.entries(AS_HUNG)) {
  const wall = FIXED.find((w) => w.id === id)
  if (!wall) fail(`wall '${id}' has gone missing from WALLS in src/content/slates.ts`)
  else if (wall.fallback !== plate) {
    fail(
      `wall '${id}' falls back to '${wall.fallback}', but '${plate}' is what hung there before ` +
        'the board existed — an empty board must reproduce the old site exactly',
    )
  }
}
if (FIXED.length !== Object.keys(AS_HUNG).length) {
  fail(
    `WALLS lists ${FIXED.length} hand-placed walls and this check knows ${Object.keys(AS_HUNG).length}. ` +
      'A new one needs a row in AS_HUNG here and a component that reads it.',
  )
}

/* ---- every wall on offer is a wall the site reads ------------------------ */

const readers = ['src/routes/Home.tsx', 'src/routes/Splash.tsx', 'src/components/SectionArt.tsx']
  .map(read)
  .join('\n')

for (const wall of FIXED) {
  if (!readers.includes(`hangs('${wall.id}')`)) {
    fail(
      `wall '${wall.id}' is offered by the dashboard but nothing calls hangs('${wall.id}') — ` +
        'assigning a plate to it would change nothing on the site',
    )
  }
}
// The room walls are read generically, by SectionArt building the id from the
// slug. One call covers all twelve; check the call rather than the twelve.
if (!readers.includes('hangs(`room:${slug}`)')) {
  fail('SectionArt no longer reads room walls — every per-room assignment is dead')
}
// Both pools are chosen inside one `draws(…)` call, on a ternary over the
// path prefix, so the test is that each pool id appears in that call's
// arguments — not that each has a call of its own.
const drawCalls = readers
  .split('\n')
  .filter((line) => line.includes('draws('))
  .join('\n')
for (const pool of ['wiki', 'blog']) {
  if (!drawCalls.includes(`'${pool}'`)) {
    fail(`pool '${pool}' is offered by the dashboard but nothing draws from it`)
  }
}

/* ---- the board itself ---------------------------------------------------- */

let board
try {
  board = JSON.parse(read('src/content/board.json'))
} catch (err) {
  console.error(`board.json is not valid JSON: ${err.message}`)
  process.exit(1)
}

const KNOWN_KEYS = new Set(['note', 'plates', 'walls', 'pools'])
for (const key of Object.keys(board)) {
  if (!KNOWN_KEYS.has(key)) fail(`board.json has an unknown top-level key '${key}'`)
}

const plates = board.plates ?? []
const files = existsSync(join(root, 'public/art')) ? readdirSync(join(root, 'public/art')) : []
const seen = new Set(SCENE_ORDER)

for (const plate of plates) {
  const at = `board.json plate '${plate.id ?? '(no id)'}'`
  if (!plate.id || !/^[a-z0-9][a-z0-9-]*$/.test(plate.id)) {
    fail(`${at}: id must be lowercase letters, digits and hyphens`)
    continue
  }
  if (seen.has(plate.id)) fail(`${at}: two plates share this id`)
  seen.add(plate.id)

  if (!plate.file || !/^[a-z0-9][a-z0-9.-]*\.(webp|png|jpg|jpeg|gif|avif)$/.test(plate.file)) {
    fail(`${at}: file '${plate.file}' is not a plain image filename`)
  } else if (!files.includes(plate.file)) {
    fail(
      `${at}: public/art/${plate.file} does not exist. The picture and the manifest row are ` +
        'committed together for exactly this reason — see publish-slates.ts.',
    )
  }
  if (!Number.isInteger(plate.w) || plate.w <= 0) fail(`${at}: w is not a positive integer`)
  if (!Number.isInteger(plate.h) || plate.h <= 0) fail(`${at}: h is not a positive integer`)
  if (![1, 2, 3, 4, 5].includes(plate.tone)) fail(`${at}: tone must be 1–5, not ${plate.tone}`)
  if (!plate.alt || !plate.alt.trim()) {
    fail(
      `${at}: no alt text. Several plates are the largest object on their page; a screen ` +
        'reader handed nothing for one of those has been lied to.',
    )
  }
  if ('kana' in plate && (typeof plate.kana !== 'string' || !plate.kana.trim())) {
    fail(
      `${at}: kana is present and empty. A plate with no kana leaves the key out — ` +
        'see the field note in src/content/art.ts.',
    )
  }
}

/* ---- what the board assigns --------------------------------------------- */

const wallIds = new Set([...FIXED.map((w) => w.id), ...SLUGS.map((s) => `room:${s}`)])

for (const [wall, plate] of Object.entries(board.walls ?? {})) {
  if (!wallIds.has(wall)) fail(`board.json hangs a plate on '${wall}', which is not a wall`)
  if (!seen.has(plate)) fail(`board.json hangs '${plate}' on '${wall}', and there is no such plate`)
}

for (const [pool, ids] of Object.entries(board.pools ?? {})) {
  if (!['wiki', 'blog'].includes(pool)) fail(`board.json has a pool '${pool}', which is not a pool`)
  if (!Array.isArray(ids)) {
    fail(`board.json pool '${pool}' is not a list`)
    continue
  }
  for (const id of ids) {
    if (!seen.has(id)) fail(`board.json pool '${pool}' draws from '${id}', and there is no such plate`)
  }
  if (ids.length && new Set(ids).size !== ids.length) fail(`board.json pool '${pool}' repeats a plate`)
}

/* ---- say what happened --------------------------------------------------- */

if (problems.length) {
  console.error(`\nTHE BOARD DOES NOT CHECK OUT — ${problems.length} problem(s):\n`)
  for (const p of problems) console.error(`  · ${p}`)
  console.error('')
  process.exit(1)
}

const hung = Object.keys(board.walls ?? {}).length
const pooled = Object.values(board.pools ?? {}).filter((v) => v.length).length
console.log(
  `the board checks out — ${SCENE_ORDER.length} cut plates, ${plates.length} uploaded, ` +
    `${wallIds.size} walls (${hung} assigned by hand), ${pooled} of 2 pools narrowed`,
)
