/**
 * THE PAGE-HISTORY CLAIM, CHECKED AGAINST GIT.
 *
 *   node scripts/check-history.mjs [path-to-wiki-brain]
 *
 * `scripts/build-wiki-history.mjs` already proves one thing before it writes:
 * folding its own chain with its own applier reproduces every revision. That is
 * necessary and it is not sufficient — it proves the two halves of one program
 * agree, which they would even if both were wrong in the same direction. Three
 * claims are left over, and they are the ones a reader would be misled by:
 *
 *   1. The SHIPPED dataset, on disk, reproduces the blobs git holds — checked
 *      through the applier in `src/wiki/history.ts`, which is the code the
 *      browser actually runs and a separate copy from the build's.
 *   2. The diff the panel draws attributes the right lines to the right side.
 *      `changesIn` inverts a reverse patch to say what a commit ADDED, and an
 *      inversion that is backwards renders a plausible, readable, exactly wrong
 *      account of what changed. Checked against the dataset's own counts for
 *      every revision of every page, and then exactly: the lines the panel
 *      would NOT strike through must reconstruct the newer snapshot, and the
 *      ones it would not mark as added must reconstruct the older one. A
 *      backwards inversion swaps the two and fails both. Those snapshots are
 *      the dataset's own — claim 1 is what ties them to the blobs in git, and
 *      the two together are what make this a statement about the record rather
 *      than about the dataset's internal consistency.
 *   3. The version the dataset calls a revision's PREDECESSOR is the version
 *      that preceded it on `main`. Claims 1 and 2 both hold on a chain whose
 *      links are in the wrong order — every snapshot is a real file and every
 *      diff is a correct diff, of the wrong pair. This is the one that broke on
 *      2026-09-02, on 197 of 3,087 revisions, and the one a reader cannot catch
 *      unaided, because they opened the history precisely because they do not
 *      know what the page used to say.
 *
 * Runs twice, deliberately. In the wiki sync, where the source repository is
 * checked out, it does all of it. In the deploy, where it is not, it does the
 * half that needs no git — which is still the half that catches a corrupted
 * dataset on its way to the site. Exits 1 on any disagreement.
 */
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { applyOps, changesIn, snapshotAt, splitSnapshot } from '../src/wiki/history.ts'

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
    // And the inversion, exactly rather than by its totals. The lines the panel
    // paints green must rebuild this revision's text and nothing else; the ones
    // it paints red must rebuild its predecessor's. A `changesIn` that inverted
    // the wrong way agrees with every count above and fails here, which is the
    // whole reason this is a separate assertion and not a tidier one.
    const newer = snapshotAt(history, i)
    const older = snapshotAt(history, i + 1)
    const keptAdd = shown.filter((l) => l.kind !== 'del').map((l) => l.text).join('\n')
    const keptDel = shown.filter((l) => l.kind !== 'add').map((l) => l.text).join('\n')
    if (keptAdd !== newer) fail(`${history.slug} @ ${rev.sha}: the added side is not this revision`)
    if (keptDel !== older) fail(`${history.slug} @ ${rev.sha}: the removed side is not its predecessor`)
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

/** Where git keeps the text of one revision — the path it had at that commit. */
const blobKey = (history, rev) => `${rev.sha}:wiki/${rev.path ?? history.slug}.md`

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
  for (const rev of history.revisions) specs.push(blobKey(history, rev))
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
    const blob = blobs.get(blobKey(history, rev))
    if (blob === undefined) continue
    if (lines.join('\n') !== blob) {
      fail(`${history.slug} @ ${rev.sha}: the shipped chain does not reproduce the file`)
      break
    }
  }
}

/* ---- the lineage, against git ---------------------------------------------
 *
 * The check above proves the panel agrees with the dataset and that its
 * inversion runs the right way. Neither of them asks the question that actually
 * broke on 2026-09-02: whether the version this dataset calls a revision's
 * PREDECESSOR is the version that preceded it on `main`.
 *
 * It was not, for 197 of 3,087 revisions. The build walked `git log
 * --no-merges` and treated the flat list as a lineage, so two branches that
 * both touched a page were interleaved by date and the chain ran through
 * versions that were never consecutive — a readable, plausible, wrong account
 * of what a commit did, which is the one failure a reader cannot catch, because
 * they came here precisely because they do not know what the page used to say.
 *
 * So this asks it directly, for every revision of every page rather than a
 * sample: the blob at the revision's FIRST PARENT must be the snapshot the
 * dataset ships as its predecessor. It replaced a `git show --numstat` sample
 * that compared line counts, which could not be exact — git's diff and this
 * build's Myers disagree by a line or two on 4% of revisions without either
 * being wrong, and a check that has to be approximate is a check that gets
 * loosened until it passes. This one is bytes, so it does not.
 *
 * A missing blob is skipped rather than failed: a page deleted and later
 * recreated under the same name has a revision whose first parent genuinely
 * does not hold it, and that gap is in git, not in the dataset.
 */
const lineage = []
for (const history of histories) {
  if (history.head === null) continue
  for (let i = 0; i < history.revisions.length - 1; i++) {
    const before = history.revisions[i + 1]
    lineage.push({
      history,
      i,
      spec: `${history.revisions[i].sha}^:wiki/${before.path ?? history.slug}.md`,
    })
  }
}
const parentBuf = execFileSync('git', ['-C', SOURCE, 'cat-file', '--batch'], {
  input: lineage.map((l) => l.spec).join('\n'),
  maxBuffer: 512 * 1024 * 1024,
})
let seat = 0
let lineages = 0
let ungrafted = 0
for (const { history, i, spec } of lineage) {
  const nl = parentBuf.indexOf(0x0a, seat)
  const header = parentBuf.toString('utf8', seat, nl)
  if (header.endsWith(' missing')) {
    ungrafted++
    seat = nl + 1
    continue
  }
  const size = Number(header.split(' ')[2])
  const blob = parentBuf.toString('utf8', nl + 1, nl + 1 + size)
  seat = nl + 1 + size + 1
  lineages++
  if (snapshotAt(history, i + 1) !== blob) {
    fail(
      `${history.slug} @ ${history.revisions[i].sha}: the version this dataset calls its ` +
        `predecessor is not what ${spec} holds`,
    )
  }
}

console.log(
  failures
    ? `check-history: ${failures} failure${failures === 1 ? '' : 's'}.`
    : `check-history: ${files.length} pages · ${revisions} snapshots reproduced · ` +
      `${diffs} diffs agree and invert the right way · ${lineages} predecessors are the ` +
      `first parent git holds${ungrafted ? ` · ${ungrafted} not in git at that path` : ''}.`,
)
process.exit(failures ? 1 : 0)
