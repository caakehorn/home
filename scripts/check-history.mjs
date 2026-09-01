/**
 * THE PAGE-HISTORY CLAIM, CHECKED AGAINST GIT.
 *
 *   node scripts/check-history.mjs [path-to-wiki-brain]
 *
 * `scripts/build-wiki-history.mjs` already proves one thing before it writes:
 * folding its own chain with its own applier reproduces every revision. That is
 * necessary and it is not sufficient — it proves the two halves of one program
 * agree, which they would even if both were wrong in the same direction. Two
 * claims are left over, and they are the ones a reader would be misled by:
 *
 *   1. The SHIPPED dataset, on disk, reproduces the blobs git holds — checked
 *      through the applier in `src/wiki/history.ts`, which is the code the
 *      browser actually runs and a separate copy from the build's.
 *   2. The diff the panel draws attributes the right lines to the right side.
 *      `changesIn` inverts a reverse patch to say what a commit ADDED, and an
 *      inversion that is backwards renders a plausible, readable, exactly wrong
 *      account of what changed. Checked against the dataset's own counts for
 *      every revision of every page, and against `git show --numstat` on a
 *      sample — the sample is enough for that one because the property is
 *      global: an inversion cannot be backwards on one page and right on the
 *      next.
 *
 * Runs twice, deliberately. In the wiki sync, where the source repository is
 * checked out, it does all of it. In the deploy, where it is not, it does the
 * half that needs no git — which is still the half that catches a corrupted
 * dataset on its way to the site. Exits 1 on any disagreement.
 */
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { applyOps, changesIn, splitSnapshot } from '../src/wiki/history.ts'

const SOURCE = resolve(process.argv[2] ?? process.env.WIKI_BRAIN ?? '../wiki-brain')
const DIR = resolve('public/wiki/history')

let failures = 0
const fail = (message) => {
  failures++
  console.error(`  ✗ ${message}`)
}

/* ---- the applier, on its own ---------------------------------------------
 *
 * Small enough to state as examples, and worth stating: every claim below
 * rests on these six lines being right, and a table of cases is how the next
 * person changing them finds out they were not.
 */
const cases = [
  { name: 'keep everything', from: ['a', 'b'], ops: [[2]], to: ['a', 'b'] },
  { name: 'insert at the top', from: ['b'], ops: [[0, ['a']], [1]], to: ['a', 'b'] },
  { name: 'delete a line', from: ['a', 'b', 'c'], ops: [[1], [1, []], [1]], to: ['a', 'c'] },
  { name: 'replace a line', from: ['a', 'b'], ops: [[1], [1, ['B']]], to: ['a', 'B'] },
  { name: 'trailing lines survive a short op list', from: ['a', 'b', 'c'], ops: [[1, ['A']]], to: ['A', 'b', 'c'] },
  { name: 'append', from: ['a'], ops: [[1], [0, ['b']]], to: ['a', 'b'] },
]
for (const c of cases) {
  const got = applyOps(c.from, c.ops)
  if (got.join('\n') !== c.to.join('\n')) fail(`applyOps: ${c.name} — got ${JSON.stringify(got)}`)
}

/* ---- the frontmatter split ------------------------------------------------
 *
 * This mirrors `sync-wiki.mjs`, which is the point of it: a historical version
 * has to reach the markdown renderer in the same shape a live page does, or the
 * two editions of the same entry render differently and the difference reads as
 * a change to the writing. The blank line left after the stripped H1 is part of
 * that — the sync leaves it too, and asserting it away here would be asserting
 * the wrong contract.
 */
{
  const raw = '---\ntitle: X\ndate_modified: 2026-01-01\n---\n\n# A Heading\n\nBody text.\n'
  const s = splitSnapshot(raw)
  if (s.h1 !== 'A Heading') fail(`splitSnapshot: h1 was ${JSON.stringify(s.h1)}`)
  if (s.body !== '\nBody text.') fail(`splitSnapshot: body was ${JSON.stringify(s.body)}`)
  if (!s.frontmatter.includes('title: X')) fail('splitSnapshot: lost the frontmatter')
  // A page with no frontmatter at all must not have its first lines eaten.
  const bare = splitSnapshot('# T\n\nhello\n')
  if (bare.body !== '\nhello' || bare.frontmatter !== '') {
    fail(`splitSnapshot: mishandled a bare file — ${JSON.stringify(bare)}`)
  }
  // An unterminated frontmatter block is a file, not a crash.
  const broken = splitSnapshot('---\ntitle: X\n\nstill going\n')
  if (broken.frontmatter !== '' || !broken.body.includes('still going')) {
    fail(`splitSnapshot: lost an unterminated block — ${JSON.stringify(broken)}`)
  }
}

if (!existsSync(DIR)) {
  console.log('check-history: no public/wiki/history — nothing shipped to check.')
  process.exit(failures ? 1 : 0)
}

const files = readdirSync(DIR).filter((f) => f.endsWith('.json')).sort()
const histories = files.map((f) => JSON.parse(readFileSync(join(DIR, f), 'utf8')))

/* ---- 2. the panel against the dataset -------------------------------------
 *
 * Runs with or without the source repository, because it needs neither: it asks
 * whether the diff the browser would draw carries the same number of added and
 * removed lines as the row the browser prints beside it. The deploy has no
 * wiki-brain checkout and this is the half it can still prove.
 */
let diffs = 0
for (const history of histories) {
  if (history.head === null) continue
  for (let i = 0; i < history.revisions.length - 1; i++) {
    const rev = history.revisions[i]
    const shown = changesIn(history, i)
    if (!shown) {
      fail(`${history.slug} @ ${rev.sha}: no diff where one is stored`)
      continue
    }
    const added = shown.filter((l) => l.kind === 'add').length
    const removed = shown.filter((l) => l.kind === 'del').length
    if (added !== rev.added || removed !== rev.removed) {
      fail(
        `${history.slug} @ ${rev.sha}: the panel would draw +${added}/−${removed}, ` +
          `the dataset says +${rev.added}/−${rev.removed}`,
      )
    }
    diffs++
  }
}

if (!existsSync(join(SOURCE, 'wiki'))) {
  console.log(
    `check-history: ${files.length} pages · ${diffs} diffs agree with their own counts. ` +
      `No wiki-brain at ${SOURCE}, so nothing was checked against git.`,
  )
  process.exit(failures ? 1 : 0)
}

const git = (...args) =>
  execFileSync('git', ['-C', SOURCE, ...args], { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 })

/* ---- 1. every snapshot against the blob git holds --------------------------
 *
 * Through `applyOps` from `src/wiki/history.ts` — the copy the browser runs,
 * which is a different copy from the one the build proved itself with. One
 * `git cat-file --batch` for all 3,587 rather than 3,587 spawns: the same check
 * took thirty seconds that way and takes two like this.
 */
const specs = []
for (const history of histories) {
  if (history.head === null) continue
  for (const rev of history.revisions) specs.push(`${rev.sha}:wiki/${rev.path ?? history.slug}.md`)
}
const buf = execFileSync('git', ['-C', SOURCE, 'cat-file', '--batch'], {
  input: specs.join('\n'),
  maxBuffer: 512 * 1024 * 1024,
})
const blobs = new Map()
let at = 0
for (const spec of specs) {
  const nl = buf.indexOf(0x0a, at)
  const header = buf.toString('utf8', at, nl)
  if (header.endsWith(' missing')) {
    fail(`git has no blob at ${spec}`)
    at = nl + 1
    continue
  }
  const size = Number(header.split(' ')[2])
  blobs.set(spec, buf.toString('utf8', nl + 1, nl + 1 + size))
  at = nl + 1 + size + 1
}

let revisions = 0
for (const history of histories) {
  if (history.head === null) continue
  let lines = history.head.split('\n')
  for (const [i, rev] of history.revisions.entries()) {
    if (i > 0) lines = applyOps(lines, history.patches[i - 1])
    revisions++
    const blob = blobs.get(`${rev.sha}:wiki/${rev.path ?? history.slug}.md`)
    if (blob === undefined) continue
    if (lines.join('\n') !== blob) {
      fail(`${history.slug} @ ${rev.sha}: the shipped chain does not reproduce the file`)
      break
    }
  }
}

/* ---- the diff's direction, against git ------------------------------------
 *
 * The check above proves the panel agrees with the dataset. This proves the
 * dataset agrees with git, on a sample rather than all 3,587 — `git diff` is a
 * process spawn each time, and the property being checked (that the inversion
 * is not backwards) is global: it cannot be wrong on one page and right on the
 * next. A stride rather than a random pick, so the sample is the same on every
 * run and a failure reproduces.
 */
let sampled = 0
for (let f = 0; f < histories.length; f += 17) {
  const history = histories[f]
  if (history.head === null || history.revisions.length < 2) continue
  const i = 0
  const rev = history.revisions[i]
  if (rev.renamedFrom || rev.path) continue
  const shown = changesIn(history, i)
  const numstat = git(
    'show', '--format=', '--numstat', rev.sha, '--', `wiki/${history.slug}.md`,
  ).trim().split('\t')
  if (numstat.length < 2) continue
  const [gitAdded, gitRemoved] = [Number(numstat[0]), Number(numstat[1])]
  const added = shown.filter((l) => l.kind === 'add').length
  const removed = shown.filter((l) => l.kind === 'del').length
  if (added !== gitAdded || removed !== gitRemoved) {
    fail(
      `${history.slug} @ ${rev.sha}: git says +${gitAdded}/−${gitRemoved}, ` +
        `this dataset says +${added}/−${removed}`,
    )
  }
  sampled++
}

console.log(
  failures
    ? `check-history: ${failures} failure${failures === 1 ? '' : 's'}.`
    : `check-history: ${files.length} pages · ${revisions} snapshots reproduced · ` +
      `${diffs} diffs agree · ${sampled} checked against git directly.`,
)
process.exit(failures ? 1 : 0)
