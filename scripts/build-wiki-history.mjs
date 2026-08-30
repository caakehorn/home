/**
 * PAGE HISTORY — every version of every wiki page, reconstructible exactly.
 *
 *   node scripts/build-wiki-history.mjs [path-to-wiki-brain]
 *   WIKI_BRAIN=/path/to/wiki-brain node scripts/build-wiki-history.mjs
 *
 * Runs after scripts/sync-wiki.mjs, into the snapshot that script just built.
 *
 * ---- why this exists ------------------------------------------------------
 *
 * The wiki is a second brain, not a cache: a page is *revised*, never
 * regenerated, and the reasoning that produced today's sentence happened once.
 * So the interesting question about any earned page is not only what it says —
 * it is what it used to say, and when it stopped saying that. `date_modified`
 * in frontmatter answers "has this moved"; nothing on the site answered "how".
 *
 * Git already holds the answer. wiki-brain commits after every operation with
 * `<op>: <description>`, so its log is a labelled record of every ingest,
 * climb, close and portal edit that ever touched a page. This turns that log
 * into a dataset the static site can serve.
 *
 * ---- what is stored, and why it is not full text --------------------------
 *
 * 3,487 page-revisions of full text is 6.1 MB, and it grows with every commit.
 * A reverse patch chain — the current file whole, then line-level ops walking
 * backwards one revision at a time — is 2.6 MB for the same 3,487 revisions,
 * and it is EXACT: applying the chain reproduces the git blob byte for byte,
 * which this script checks for every revision of every page before writing
 * anything (see `verify` below). A snapshot that is 99% right is not a
 * snapshot, so the check is a build failure, not a warning.
 *
 * Reverse rather than forward because the revisions people actually open are
 * the recent ones, and reverse puts those nearest the head: reading last
 * week's version applies one patch, not forty.
 *
 * Each history file is self-contained — it carries the current text as well as
 * the chain, duplicating `pages/<slug>.json`. That duplication is deliberate.
 * The alternative is reconstructing the head from the page JSON's `fmRaw`,
 * `h1` and `body`, which is a lossy round-trip (the trailing newline, for one),
 * and a history view whose oldest snapshot depends on a reassembly no test
 * covers is a history view that will one day be quietly wrong.
 *
 * ---- what is NOT stored ---------------------------------------------------
 *
 * SEALED PAGES GET NO HISTORY FILE AT ALL. `wiki.locks.json` names pages that
 * ship as ciphertext precisely so the site cannot read them out; a history file
 * would publish every prior version of that page in the clear, which is the
 * seal defeated through the back door rather than broken. They are skipped by
 * slug, before any text is read.
 *
 * ---- the standing moratorium, and why it does not withhold anything --------
 *
 * `CLAUDE.md` in wiki-brain carries an operator directive about a living
 * person. `bin/wiki-plain` refuses to write a plain-language twin of a page
 * about her, so the question was asked here too, and the answer went the other
 * way. It is worth writing down which, because the two look alike and are not.
 *
 * A plain twin is NEW PROSE. It does not exist until somebody writes it, it is
 * rebuilt for readers who could not read the original, and it is squarely what
 * the directive stops. A history view writes nothing. It replays bytes this
 * wiki already published, at an earlier date, out of a git log that is public
 * and one click away at github.com/caakehorn/wiki-brain — same content, same
 * audience, a different renderer. It cannot advance the record by definition:
 * it only ever looks backwards, and there is nothing past 2026-08-19 in it to
 * show.
 *
 * Withholding was implemented first and measured: `bin/wiki-plain`'s own test —
 * named in frontmatter, or more than two body mentions — held back 217 of 472
 * pages, among them `interests/golf` and `self/tattoos`, which name her in a
 * `sources:` line. That is not a page about her; that is a citation. And the
 * directive is explicit in the other direction — "This directive is a stop, not
 * a retraction and not a redaction. Nothing already written is deleted,
 * softened or rewritten" — so blanking the history of 46% of the corpus is the
 * thing it forbids, not the thing it asks for.
 *
 * `MORATORIUM`, `INCIDENTAL` and `WITHHOLD_UNDER_MORATORIUM` below are the
 * whole mechanism, kept live and switchable. Setting the last to `true` puts
 * every page about her back to a revision LIST with no reconstructable text.
 * That is the operator's call and nobody else's, in either direction.
 *
 * ---- determinism ----------------------------------------------------------
 *
 * No wall clock anywhere in a per-page file, no PRNG, sorted output. A page
 * whose history has not changed produces a byte-identical file, so the hourly
 * resync commits only the pages that actually moved. `history.json` carries a
 * `generatedAt` because the workflow's timestamp-only-churn guard knows how to
 * ignore that; the per-page files must never grow one.
 */
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { readManifest } from './wiki-locks.mjs'

const SOURCE = resolve(process.argv[2] ?? process.env.WIKI_BRAIN ?? '../wiki-brain')
const OUT = resolve('public/wiki')
const HISTORY = join(OUT, 'history')

/**
 * The moratorium, mechanically — the same test as wiki-brain's `bin/wiki-plain`
 * (frontmatter mention at all, or more than INCIDENTAL in the body), switched
 * off here for the reasons argued at the top of this file. Flip the flag and
 * every page about her keeps its revision list and loses its text.
 */
const MORATORIUM = /\b(annie|ulmer)/i
const INCIDENTAL = 2
const WITHHOLD_UNDER_MORATORIUM = false

/**
 * A page whose whole history is one commit needs no chain, and a page nobody
 * has touched since it was created has nothing to show. Both still get a file:
 * "created on this date, never revised" is an answer, and an absent file is
 * indistinguishable from a build that failed.
 */

const git = (...args) =>
  execFileSync('git', ['-C', SOURCE, ...args], {
    encoding: 'utf8',
    maxBuffer: 512 * 1024 * 1024,
  })

const gitBuffer = (args, input) =>
  execFileSync('git', ['-C', SOURCE, ...args], {
    input,
    maxBuffer: 512 * 1024 * 1024,
  })

// ---------------------------------------------------------------------------
// The log
//
// One pass over `wiki/`, with rename detection on, giving every commit that
// touched a page and what it did to it. `--name-status -M` reports a rename as
// `R<score>\told\tnew`, which is how a page keeps its history across a move —
// `--follow` would be one invocation per page and cannot see two pages that
// swapped names.

/**
 * @returns {{ commits: Map<string, {sha,date,author,subject}>, touched: Map<string, {sha,status,from}[]> }}
 *   `touched` is keyed by the page's CURRENT path and ordered newest first.
 */
function readLog() {
  const SEP = ''
  const raw = git(
    'log',
    '--no-merges',
    '--name-status',
    '-M',
    `--format=@@${['%H', '%aI', '%an', '%s'].join(SEP)}`,
    '--',
    'wiki/',
  )

  const commits = new Map()
  /** current path -> [{ sha, status, path, from }], newest first */
  const touched = new Map()
  /**
   * Walking newest-first, `alias` maps the name a page had at the commit being
   * read to the name it has today. A rename seen at commit C means everything
   * OLDER than C used the old name, so the mapping is installed as the rename
   * is passed and applies to the rest of the walk.
   */
  const alias = new Map()
  const today = (path) => alias.get(path) ?? path

  let sha = null
  for (const line of raw.split('\n')) {
    if (line.startsWith('@@')) {
      const [id, date, author, subject] = line.slice(2).split(SEP)
      sha = id
      commits.set(sha, { sha, date, author, subject })
      continue
    }
    if (!line.trim() || !sha) continue

    const [status, a, b] = line.split('\t')
    const code = status[0]
    const path = code === 'R' ? b : a
    if (!path?.startsWith('wiki/') || !path.endsWith('.md')) continue

    const current = today(path)
    if (!touched.has(current)) touched.set(current, [])
    touched.get(current).push({ sha, status: code, path, from: code === 'R' ? a : null })

    // Older commits know this page by its old name.
    if (code === 'R' && a.endsWith('.md')) alias.set(a, current)
  }

  return { commits, touched }
}

// ---------------------------------------------------------------------------
// Diffing
//
// Myers' algorithm over lines, with the common prefix and suffix trimmed off
// first. Trimming is what makes this fast on the ordinary case — a one-word
// correction to a 600-line page has an edit distance of 2 after trimming — and
// the cap below bounds the pathological one. A page rewritten from scratch has
// an edit distance near its own length, and there is nothing to be gained from
// finding the optimal alignment between two texts that share nothing: the
// whole-file replacement is both smaller and honest.

/** Above this edit distance, stop looking and emit a whole-file replacement. */
const MAX_EDIT = 4000

/**
 * Line ops turning `a` into `b`.
 *
 *   [n]        keep the next n lines of `a`
 *   [n, [...]] drop the next n lines of `a`, emit these instead
 *
 * A pure insert is `[0, [...]]`; a pure delete is `[n, []]`. One shape rather
 * than three keeps the applier below to six lines, which is the point: the
 * applier runs in a browser and every branch in it is a way to be wrong.
 */
function diffLines(a, b) {
  let lo = 0
  const max = Math.min(a.length, b.length)
  while (lo < max && a[lo] === b[lo]) lo++
  let hi = 0
  while (hi < max - lo && a[a.length - 1 - hi] === b[b.length - 1 - hi]) hi++

  const A = a.slice(lo, a.length - hi)
  const B = b.slice(lo, b.length - hi)
  const ops = []
  if (lo) ops.push([lo])
  if (A.length || B.length) {
    const middle = myers(A, B)
    if (middle) ops.push(...middle)
    else ops.push([A.length, B])
  }
  if (hi) ops.push([hi])
  return ops
}

/** Myers' O(ND) edit script, or null if the distance exceeds MAX_EDIT. */
function myers(a, b) {
  const n = a.length
  const m = b.length
  const maxD = Math.min(n + m, MAX_EDIT)
  const offset = maxD
  const v = new Int32Array(2 * maxD + 1)
  const trace = []

  for (let d = 0; d <= maxD; d++) {
    trace.push(v.slice())
    for (let k = -d; k <= d; k += 2) {
      let x
      if (k === -d || (k !== d && v[offset + k - 1] < v[offset + k + 1])) x = v[offset + k + 1]
      else x = v[offset + k - 1] + 1
      let y = x - k
      while (x < n && y < m && a[x] === b[y]) {
        x++
        y++
      }
      v[offset + k] = x
      if (x >= n && y >= m) return backtrack(trace, a, b, d, offset)
    }
  }
  return null
}

/** Walk the saved frontiers back to a list of ops. */
function backtrack(trace, a, b, d, offset) {
  const ops = []
  let x = a.length
  let y = b.length
  /** Emit in reverse, then flip: `push` on the front of an array is quadratic. */
  const keep = (n) => n > 0 && ops.push([n])
  const change = (drop, add) => (drop || add.length) && ops.push([drop, add])

  for (let step = d; step > 0; step--) {
    const v = trace[step]
    const k = x - y
    const down = k === -step || (k !== step && v[offset + k - 1] < v[offset + k + 1])
    const prevK = down ? k + 1 : k - 1
    const prevX = v[offset + prevK]
    const prevY = prevX - prevK

    keep(x - (down ? prevX : prevX + 1))
    if (down) change(0, [b[prevY]])
    else change(1, [])
    x = prevX
    y = prevY
  }
  keep(x)

  // Reverse, then coalesce: backtracking emits one op per edit step, so a
  // twelve-line insertion arrives as twelve separate ops.
  ops.reverse()
  const out = []
  for (const op of ops) {
    const last = out[out.length - 1]
    if (last && last.length === op.length && last.length === 1) last[0] += op[0]
    else if (last && last.length === 2 && op.length === 2) {
      last[0] += op[0]
      last[1].push(...op[1])
    } else out.push(op.length === 2 ? [op[0], [...op[1]]] : [...op])
  }
  return out
}

/** The applier, mirrored in src/wiki/history.ts. Kept here to verify at build. */
function applyOps(lines, ops) {
  const out = []
  let at = 0
  for (const [n, add] of ops) {
    if (add === undefined) out.push(...lines.slice(at, at + n))
    else out.push(...add)
    at += n
  }
  out.push(...lines.slice(at))
  return out
}

// ---------------------------------------------------------------------------

/** Read many blobs in one `git cat-file --batch`, keyed by `<sha>:<path>`. */
function readBlobs(specs) {
  const out = new Map()
  if (!specs.length) return out
  const buf = gitBuffer(['cat-file', '--batch'], specs.join('\n'))
  let at = 0
  for (const spec of specs) {
    const nl = buf.indexOf(0x0a, at)
    const header = buf.toString('utf8', at, nl)
    // `<oid> missing` for a spec git cannot resolve — a page deleted and later
    // recreated under the same name has revisions whose blob is not in this
    // path. Skipping keeps the walk honest rather than shifting every
    // subsequent blob onto the wrong revision.
    if (header.endsWith(' missing')) {
      at = nl + 1
      continue
    }
    const size = Number(header.split(' ')[2])
    out.set(spec, buf.toString('utf8', nl + 1, nl + 1 + size))
    at = nl + 1 + size + 1
  }
  return out
}

const forbidden = (text) => {
  if (!WITHHOLD_UNDER_MORATORIUM) return false
  const cut = text.startsWith('---') ? text.indexOf('\n---', 3) : -1
  const head = cut === -1 ? '' : text.slice(0, cut)
  const body = cut === -1 ? text : text.slice(cut)
  if (MORATORIUM.test(head)) return true
  return (body.match(new RegExp(MORATORIUM.source, 'gi')) ?? []).length > INCIDENTAL
}

// ---------------------------------------------------------------------------

if (!existsSync(join(SOURCE, 'wiki'))) {
  console.error(`No wiki/ directory under ${SOURCE}.`)
  process.exit(1)
}
if (!existsSync(join(OUT, 'index.json'))) {
  console.error('No public/wiki/index.json — run scripts/sync-wiki.mjs first.')
  process.exit(1)
}

// A shallow clone has a truncated log, and a truncated log renders as "this
// page was created on the day the clone was cut" — a confident, wrong claim
// about when the writing happened. Refuse rather than publish it.
if (git('rev-parse', '--is-shallow-repository').trim() === 'true') {
  console.error(
    'wiki-history: the wiki-brain checkout is shallow, so its log does not reach the\n' +
      'first version of any page. Check it out with fetch-depth: 0 (see\n' +
      '.github/workflows/sync-wiki.yml) or run `git fetch --unshallow` locally.',
  )
  process.exit(1)
}

const index = JSON.parse(readFileSync(join(OUT, 'index.json'), 'utf8'))
const sealed = new Set(index.pages.filter((p) => p.locked).map((p) => p.slug))
for (const slug of readManifest().locked) sealed.add(slug)

const { commits, touched } = readLog()

// Every blob this build needs, in one batch. 3,487 lazy reads is four minutes;
// one batch is four seconds.
const wanted = []
for (const entry of index.pages) {
  if (sealed.has(entry.slug)) continue
  for (const rev of touched.get(`wiki/${entry.slug}.md`) ?? []) {
    if (rev.status !== 'D') wanted.push(`${rev.sha}:${rev.path}`)
  }
}
const blobs = readBlobs(wanted)

rmSync(HISTORY, { recursive: true, force: true })
mkdirSync(HISTORY, { recursive: true })

const summary = []
let revisionCount = 0
let held = 0
let checked = 0

for (const entry of index.pages) {
  const path = `wiki/${entry.slug}.md`
  const revs = (touched.get(path) ?? []).filter((r) => r.status !== 'D')
  if (!revs.length) continue

  // Sealed: no file at all. Not an empty one — an empty file says "this page
  // has no history", and it has one.
  if (sealed.has(entry.slug)) {
    // The dates and the count, which are facts about this repository's commits
    // rather than about the page — so the browse view can still say when a
    // sealed page last moved without any of it being readable.
    summary.push({
      slug: entry.slug,
      domain: entry.domain,
      sealed: true,
      revisions: revs.length,
      created: commits.get(revs[revs.length - 1].sha).date,
      updated: commits.get(revs[0].sha).date,
    })
    continue
  }

  const texts = revs.map((r) => blobs.get(`${r.sha}:${r.path}`))
  if (texts.some((t) => t === undefined)) {
    console.error(`wiki-history: missing a blob for ${entry.slug}; the log and the object store disagree.`)
    process.exit(1)
  }

  const revisions = revs.map((rev, i) => {
    const meta = commits.get(rev.sha)
    const previous = texts[i + 1]
    const [added, removed] = previous === undefined
      ? [texts[i].split('\n').length, 0]
      : countChanges(previous, texts[i])
    return {
      sha: rev.sha.slice(0, 10),
      date: meta.date,
      author: meta.author,
      subject: meta.subject,
      // The operation, when the commit message follows the convention
      // CLAUDE.md sets: `<op>: <short description>`.
      op: /^([a-z-]+)(\([^)]*\))?:/.exec(meta.subject)?.[1] ?? null,
      bytes: Buffer.byteLength(texts[i]),
      lines: texts[i].split('\n').length,
      added,
      removed,
      created: i === revs.length - 1,
      renamedFrom: rev.from ? rev.from.replace(/^wiki\/|\.md$/g, '') : null,
      // Only when the file was somewhere else at this revision — which is rare,
      // and is the difference between `git show <sha>:<path>` working and not.
      // Emitted so the checker can address the blob without re-deriving the
      // rename chain, and so the panel can say what the page used to be called.
      path: rev.path === path ? undefined : rev.path.replace(/^wiki\/|\.md$/g, ''),
    }
  })
  revisionCount += revisions.length

  // Held under the moratorium, if that is ever switched on: the list, never the
  // text. Judged on the CURRENT page — a page that is about her today does not
  // become eligible because an early draft had not named her yet.
  const withheld = forbidden(texts[0])
  if (withheld) held++

  const file = {
    slug: entry.slug,
    domain: entry.domain,
    title: entry.title,
    revisions,
    /** Why there is no text below, when there is none. */
    withheld: withheld ? 'moratorium' : null,
    head: withheld ? null : texts[0],
    /** patches[i] turns revisions[i]'s text into revisions[i + 1]'s. */
    patches: withheld ? null : buildChain(texts),
  }

  if (!withheld) checked += verify(entry.slug, texts, file.head, file.patches)

  writeFileSync(
    join(HISTORY, `${entry.slug.replace(/\//g, '__')}.json`),
    JSON.stringify(file),
  )

  summary.push({
    slug: entry.slug,
    domain: entry.domain,
    revisions: revisions.length,
    created: revisions[revisions.length - 1].date,
    updated: revisions[0].date,
    withheld: withheld ? 'moratorium' : null,
  })
}

function countChanges(before, after) {
  let added = 0
  let removed = 0
  for (const [n, add] of diffLines(before.split('\n'), after.split('\n'))) {
    if (add === undefined) continue
    removed += n
    added += add.length
  }
  return [added, removed]
}

function buildChain(texts) {
  const chain = []
  for (let i = 0; i < texts.length - 1; i++) {
    chain.push(diffLines(texts[i].split('\n'), texts[i + 1].split('\n')))
  }
  return chain
}

/**
 * THE CLAIM, CHECKED IN THE BUILD.
 *
 * The dataset asserts that folding the chain reproduces each revision exactly.
 * A silently-truncated patch chain renders as a plausible older version of the
 * page — the one failure mode a reader cannot catch, because they came here
 * precisely because they do not know what the page used to say. So it is
 * proved here, for every revision of every page, against the blob git holds.
 */
function verify(slug, texts, head, patches) {
  let lines = head.split('\n')
  for (let i = 0; i < patches.length; i++) {
    lines = applyOps(lines, patches[i])
    if (lines.join('\n') !== texts[i + 1]) {
      console.error(
        `wiki-history: the chain for ${slug} does not reproduce revision ${i + 1}. ` +
          'The patch builder and the applier disagree; nothing was written.',
      )
      process.exit(1)
    }
  }
  return patches.length + 1
}

summary.sort((a, b) => a.slug.localeCompare(b.slug))

/* ---- the last-modified tags ----------------------------------------------
 *
 * `updated` and `revisions` are written back into index.json rather than into
 * a fourth dataset, because every surface that wants them — the browse cards,
 * the sort, the page header — already loads index.json and nothing else. A
 * separate file would mean a second fetch on every route to answer "when did
 * this last move".
 *
 * It has to happen here rather than in sync-wiki.mjs: the answer is in git,
 * and sync-wiki deliberately does not open the source repo's history. The
 * frontmatter `date_modified` is NOT the same fact — it is what a session
 * remembered to type, it is a date rather than a time, and `bin/wiki-gaps`
 * leaves it alone on purpose when it stages an answer. This is when the file
 * actually changed.
 */
const when = new Map(summary.map((p) => [p.slug, p]))
for (const entry of index.pages) {
  const page = when.get(entry.slug)
  if (!page?.updated) continue
  entry.updated = page.updated
  entry.revisions = page.revisions
}
index.counts.revisions = revisionCount
writeFileSync(join(OUT, 'index.json'), JSON.stringify(index))

// The same two fields onto the page's own JSON. A reader on a page has loaded
// that file and nothing else, and the header needs to say "12 revisions, last
// touched three days ago" before anybody asks for the history — putting it here
// is what keeps the panel's dataset (23 KB on average, 1.2 MB at the worst) a
// deliberate click rather than a cost on every page view. It costs nothing:
// these values change only when the page does, and the page's file is rewritten
// then anyway.
for (const page of summary) {
  if (!page.updated) continue
  const file = join(OUT, 'pages', `${page.slug.replace(/\//g, '__')}.json`)
  const json = JSON.parse(readFileSync(file, 'utf8'))
  json.updated = page.updated
  json.revisions = page.revisions
  writeFileSync(file, JSON.stringify(json))
}

const dated = summary.filter((p) => p.updated)
writeFileSync(
  join(OUT, 'history.json'),
  JSON.stringify({
    generatedAt: new Date().toISOString(),
    counts: {
      pages: summary.length,
      revisions: revisionCount,
      commits: commits.size,
      sealed: summary.filter((p) => p.sealed).length,
      withheld: held,
    },
    span: dated.length
      ? {
          first: dated.reduce((a, p) => (p.created < a ? p.created : a), dated[0].created),
          last: dated.reduce((a, p) => (p.updated > a ? p.updated : a), dated[0].updated),
        }
      : null,
    pages: summary,
  }),
)

console.log(
  `wiki-history: ${summary.length} pages · ${revisionCount} revisions · ` +
    `${checked} reconstructions verified · ${held} withheld · ` +
    `${summary.filter((p) => p.sealed).length} sealed -> public/wiki/history`,
)
