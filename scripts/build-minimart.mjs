/**
 * Bakes JERAD'S METRIC MINIMART — public/minimart/stats.json.
 *
 *   npm run minimart                    # this repo only
 *   npm run minimart -- ../wiki-brain   # this repo and the brain, side by side
 *   WIKI_BRAIN=../wiki-brain npm run minimart
 *
 * ---- what this room is -----------------------------------------------------
 *
 * Every other room counts something about Dan. This one counts something
 * about the two repositories that build the rooms that count things about
 * Dan — lines of code, commits, pull requests, and how much of it a coding
 * agent did rather than a human at a keyboard. It is the one room in the
 * building whose subject is the building.
 *
 * ---- where each number comes from, and why two of them don't --------------
 *
 * Commits, authors, sessions and lines of code are read straight out of each
 * repository's own `git log` and working tree at build time — this repo
 * always, and `wiki-brain`'s when a checkout is handed in. Deterministic,
 * reproducible by anyone with the same two clones, no network call.
 *
 * Pull-request counts are not derivable that way: a squash-merged PR leaves
 * no merge commit, so `git log` undercounts them by more than half on both
 * repos (checked against the real counts below on 2026-08-31 — 31 merge
 * commits in `home` against 99 real PRs, 72 against 231 in `wiki-brain`).
 * The real count lives on GitHub, not in either checkout, which makes it the
 * same situation `docs/CORPUS.md` §5 and this file's own CLAUDE.md §7
 * already describe for the transcript and the gallery: data that derives
 * from a place this repo does not vendor is captured once and committed,
 * not re-fetched on every build. This sandboxed build environment also rate
 * -limits unauthenticated calls to the GitHub API hard enough that a live
 * call here would make the build flaky for a number that changes maybe once
 * a day — so PULL_REQUESTS below is a captured constant, not a fetch. Refresh
 * it by re-running the same two searches this comment used to build it —
 * `repo:<owner>/<repo> is:pr` and `repo:<owner>/<repo> is:pr is:merged`, via
 * the GitHub API or `gh search prs` — and updating the numbers and the date.
 *
 * ---- "hours spent by coding agent" is a reconstruction, and says so -------
 *
 * There is no timer anywhere that records focused work time. What exists is
 * a `Claude-Session: https://claude.ai/code/session_…` trailer on every
 * commit a coding-agent session made, which groups commits into sessions,
 * and each commit's own timestamp. `sessionSpanHours` below is the sum,
 * across every session, of (last commit in that session − first commit in
 * that session) — a real, checkable number, but an upper bound on attention,
 * not a measure of it: it counts the idle minutes between two commits in the
 * same session the same as the minutes actually spent writing the second
 * one, and a session that picks back up the next day after being left open
 * counts that whole gap too. The frame says this; nothing here should be
 * read as "hours worked" without that caveat attached.
 * ========================================================================== */
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { extname, resolve } from 'node:path'

const HOME = resolve('.')
const WIKI_BRAIN_ARG = process.argv[2] ?? process.env.WIKI_BRAIN ?? '../wiki-brain'
const WIKI_BRAIN = existsSync(resolve(WIKI_BRAIN_ARG, '.git')) ? resolve(WIKI_BRAIN_ARG) : null
const OUT = 'public/minimart'

// Captured 2026-08-31 via the GitHub API — see the block comment above for
// why this is a constant rather than a fetch, and how to refresh it.
const PULL_REQUESTS = {
  home: { total: 99, merged: 93, capturedAt: '2026-08-31' },
  wikiBrain: { total: 231, merged: 219, capturedAt: '2026-08-31' },
}

function git(dir, args) {
  return execFileSync('git', args, { cwd: dir, encoding: 'utf8' })
}

/** Every commit this checkout knows about, grouped by author and by the
 *  coding-agent session that made it (if any). */
function commitStats(dir) {
  const RS = '\x1e' // record separator between commits
  const US = '\x1f' // field separator within a commit
  const raw = git(dir, ['log', `--format=%H${US}%ad${US}%an${US}%B${RS}`, '--date=iso-strict'])
  const commits = raw
    .split(RS)
    .map((r) => r.trim())
    .filter(Boolean)
    .map((r) => {
      const [hash, date, author, ...bodyParts] = r.split(US)
      return { hash, date, author, body: bodyParts.join(US) }
    })

  const byAuthor = new Map()
  const sessions = new Map()
  let first = null
  let last = null

  for (const c of commits) {
    if (!first || c.date < first) first = c.date
    if (!last || c.date > last) last = c.date
    byAuthor.set(c.author, (byAuthor.get(c.author) ?? 0) + 1)
    const m = c.body.match(/session_[A-Za-z0-9]+/)
    if (m) {
      if (!sessions.has(m[0])) sessions.set(m[0], [])
      sessions.get(m[0]).push(c.date)
    }
  }

  let spanHours = 0
  for (const dates of sessions.values()) {
    dates.sort()
    const start = new Date(dates[0]).getTime()
    const end = new Date(dates[dates.length - 1]).getTime()
    spanHours += (end - start) / 3_600_000
  }

  return {
    total: commits.length,
    firstCommit: first ? first.slice(0, 10) : null,
    lastCommit: last ? last.slice(0, 10) : null,
    ageDays: first && last ? Math.round((new Date(last) - new Date(first)) / 86_400_000) : null,
    byAuthor: Object.fromEntries([...byAuthor.entries()].sort((a, b) => b[1] - a[1])),
    codingAgentSessions: {
      count: sessions.size,
      spanHours: Math.round(spanHours * 10) / 10,
    },
  }
}

/** Lines and files tracked under the given path prefixes, restricted to the
 *  given extensions (empty array = every file, extension or not). */
function countLines(dir, prefixes, extensions) {
  const listed = git(dir, ['ls-files', ...prefixes]).split('\n').filter(Boolean)
  const files = extensions.length ? listed.filter((f) => extensions.includes(extname(f))) : listed
  let lines = 0
  for (const f of files) {
    const text = readFileSync(resolve(dir, f), 'utf8')
    lines += text ? text.split('\n').length : 0
  }
  return { files: files.length, lines }
}

function buildRepo(dir, loc, prLabel) {
  return {
    commits: commitStats(dir),
    pullRequests: PULL_REQUESTS[prLabel],
    linesOfCode: loc,
  }
}

const home = buildRepo(
  HOME,
  {
    scope: 'src/ and scripts/ — application and build-script code. Excludes committed data ' +
      'payloads (public/**, leviathan/*.json), lockfiles, node_modules and dist.',
    ...(() => {
      const src = countLines(HOME, ['src'], ['.ts', '.tsx', '.css'])
      const scripts = countLines(HOME, ['scripts'], ['.mjs'])
      return {
        files: src.files + scripts.files,
        lines: src.lines + scripts.lines,
        byArea: {
          'src/ (.ts/.tsx/.css)': src,
          'scripts/ (.mjs)': scripts,
        },
      }
    })(),
  },
  'home',
)

let wikiBrain = null
if (WIKI_BRAIN) {
  const bin = countLines(WIKI_BRAIN, ['bin'], [])
  const tests = countLines(WIKI_BRAIN, ['tests'], ['.py'])
  const wikiContent = countLines(WIKI_BRAIN, ['wiki'], ['.md'])
  wikiBrain = buildRepo(
    WIKI_BRAIN,
    {
      scope: 'bin/ and tests/*.py — the tool code. wiki/ is corpus content, not code; its size ' +
        'is reported separately, in wikiContentLines below, and never added to the code total.',
      files: bin.files + tests.files,
      lines: bin.lines + tests.lines,
      byArea: {
        'bin/ (all files)': bin,
        'tests/ (.py)': tests,
      },
    },
    'wikiBrain',
  )
  wikiBrain.wikiContentLines = wikiContent
} else {
  console.warn(`No wiki-brain checkout at ${WIKI_BRAIN_ARG} — writing home-only stats.`)
  console.warn('Pass a path or set WIKI_BRAIN to include it: npm run minimart -- ../wiki-brain')
}

const combined = {
  commits: home.commits.total + (wikiBrain?.commits.total ?? 0),
  pullRequests: {
    total: home.pullRequests.total + (wikiBrain?.pullRequests.total ?? 0),
    merged: home.pullRequests.merged + (wikiBrain?.pullRequests.merged ?? 0),
  },
  linesOfCode: home.linesOfCode.lines + (wikiBrain?.linesOfCode.lines ?? 0),
  codingAgentSessions: {
    count: home.commits.codingAgentSessions.count + (wikiBrain?.commits.codingAgentSessions.count ?? 0),
    spanHours:
      Math.round(
        (home.commits.codingAgentSessions.spanHours + (wikiBrain?.commits.codingAgentSessions.spanHours ?? 0)) * 10,
      ) / 10,
  },
}

const data = {
  generatedAt: new Date().toISOString().slice(0, 19) + 'Z',
  repos: {
    home: { name: 'caakehorn/home', ...home },
    ...(wikiBrain ? { wikiBrain: { name: 'caakehorn/wiki-brain', ...wikiBrain } } : {}),
  },
  combined,
}

mkdirSync(OUT, { recursive: true })
writeFileSync(`${OUT}/stats.json`, JSON.stringify(data, null, 2) + '\n')

console.log(`${OUT}/stats.json`)
console.log(`  home: ${home.commits.total} commits, ${home.linesOfCode.lines} loc, ${home.pullRequests.total} PRs`)
if (wikiBrain) {
  console.log(
    `  wiki-brain: ${wikiBrain.commits.total} commits, ${wikiBrain.linesOfCode.lines} loc, ${wikiBrain.pullRequests.total} PRs`,
  )
}
console.log(`  combined coding-agent session span: ${combined.codingAgentSessions.spanHours}h across ${combined.codingAgentSessions.count} sessions`)
