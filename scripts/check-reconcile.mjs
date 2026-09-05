/**
 * The gate on the deploy decision.
 *
 *   npm run reconcile:check
 *
 * `decide()` in reconcile-deploy.mjs is the only thing standing between a
 * failed deploy and a site that stays in the past forever while every workflow
 * reports success. It ran for three days in September 2026 in the form of a
 * gate on `changed` alone, and nothing noticed, because the code that was
 * wrong was the code deciding whether to look.
 *
 * So it is a pure function and this is its decision matrix. Every row is a
 * state the sync can actually be in, and both directions matter: a row that
 * wrongly deploys burns a build, a row that wrongly does not is the outage.
 *
 * Failures print what happened and exit 1. Nothing throws.
 */

import { decide, identity } from './reconcile-deploy.mjs'

const A = 'bae8c627190df60ce132d27711ba16c607bad0d3'
const B = 'b12029c88ba2a0e071900ce16ab29d28e7d2ec8c'
const at = (commit, generatedAt) => ({ commit, generatedAt })

const CASES = [
  {
    why: 'Nothing to derive and the site already has it. The common case, 287 times a day.',
    input: { changed: false, mainSha: 'MAIN', main: at(A, 't1'), site: at(A, 't1') },
    want: { deploy: false, reason: 'current' },
  },
  {
    why: 'The site is behind main. THE OUTAGE — a deploy failed and nothing ever retried.',
    input: { changed: false, mainSha: 'MAIN', main: at(A, 't2'), site: at(B, 't1') },
    want: { deploy: true, sha: 'MAIN', reason: 'stale' },
  },
  {
    why: 'This run derived and pushed a snapshot. Deploy what it pushed, not what main was.',
    input: { changed: true, pushedSha: 'PUSHED', mainSha: 'MAIN', main: null, site: null },
    want: { deploy: true, sha: 'PUSHED', reason: 'pushed' },
  },
  {
    why: 'The site cannot be reached. A blip must not queue a deploy on every run.',
    input: { changed: false, mainSha: 'MAIN', main: at(A, 't1'), site: null },
    want: { deploy: false, reason: 'unreachable-site' },
  },
  {
    why: 'main cannot be read — reported apart, because it means THIS STEP is broken.',
    input: { changed: false, mainSha: 'MAIN', main: null, site: at(A, 't1') },
    want: { deploy: false, reason: 'unreadable-main' },
  },
  {
    why: 'Same commit, different build time. generatedAt churns; the commit is the identity.',
    input: { changed: false, mainSha: 'MAIN', main: at(A, 'later'), site: at(A, 'earlier') },
    want: { deploy: false, reason: 'current' },
  },
  {
    why: 'A different commit that happened to build at the same instant is still stale.',
    input: { changed: false, mainSha: 'MAIN', main: at(A, 'same'), site: at(B, 'same') },
    want: { deploy: true, sha: 'MAIN', reason: 'stale' },
  },
  {
    why: 'An index with no commit falls back to generatedAt rather than never recovering.',
    input: { changed: false, mainSha: 'MAIN', main: at(null, 't2'), site: at(null, 't1') },
    want: { deploy: true, sha: 'MAIN', reason: 'stale', key: 'generatedAt' },
  },
  {
    why: 'The same fallback must also be able to say "current", or it deploys forever.',
    input: { changed: false, mainSha: 'MAIN', main: at(null, 't1'), site: at(null, 't1') },
    want: { deploy: false, reason: 'current', key: 'generatedAt' },
  },
]

/* The shapes identity() has to survive, since it parses whatever the site returns. */
const PARSES = [
  { why: 'a real index', text: '{"generatedAt":"t","source":{"commit":"abc"}}', want: { commit: 'abc', generatedAt: 't' } },
  { why: 'no source block', text: '{"generatedAt":"t"}', want: { commit: null, generatedAt: 't' } },
  { why: 'an HTML 404 page', text: '<!doctype html><title>404</title>', want: null },
  { why: 'an empty body', text: '', want: null },
  { why: 'valid JSON that is not an index', text: '{"ok":true}', want: null },
  { why: 'null', text: null, want: null },
]

const fail = []
const note = (...lines) => fail.push(lines)

for (const { why, input, want } of CASES) {
  const got = decide(input)
  for (const key of Object.keys(want)) {
    if (got[key] !== want[key]) {
      note(
        `decide() — ${why}`,
        `  ${key}: got ${JSON.stringify(got[key])}, wanted ${JSON.stringify(want[key])}`,
        `  input: ${JSON.stringify(input)}`,
      )
    }
  }
  // A deploy with no commit to build is a workflow that fails at checkout.
  if (got.deploy && !got.sha) {
    note(`decide() said deploy with no sha — ${why}`, `  ${JSON.stringify(got)}`)
  }
  if (!got.message) note(`decide() returned no message — ${why}`)
}

for (const { why, text, want } of PARSES) {
  const got = identity(text)
  const ok = want === null ? got === null : got && got.commit === want.commit && got.generatedAt === want.generatedAt
  if (!ok) {
    note(`identity() — ${why}`, `  got: ${JSON.stringify(got)}`, `  wanted: ${JSON.stringify(want)}`)
  }
}

if (fail.length) {
  console.error('')
  console.error(`THE DEPLOY DECISION — ${fail.length} problem${fail.length === 1 ? '' : 's'}:`)
  console.error('')
  for (const lines of fail) for (const line of lines) console.error(line)
  console.error('')
  process.exit(1)
}

console.log('')
console.log(`THE DEPLOY DECISION — ${CASES.length} states, ${PARSES.length} index shapes`)
console.log('  a stale site redeploys without a new snapshot; a reachable-but-current one does not')
console.log('  the source commit is the identity; generatedAt only breaks the tie when it must')
console.log('  an unreadable main and an unreachable site are told apart')
console.log('')
