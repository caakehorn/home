/**
 * The gate on the gates.
 *
 *   npm run gates:check
 *
 * `npm run verify` is what a pull request runs. deploy.yml is what production
 * runs. If those two drift, a pull request goes green on a check production
 * does not have, or — the way it actually hurts — production blocks on a check
 * the pull request never ran, which is precisely how #112 merged a red gate and
 * held every deploy for three days.
 *
 * So the list is not maintained by hand in two places. deploy.yml is read, the
 * `*:check` scripts it runs are extracted, and `verify` is required to contain
 * every one of them. Adding a gate to the deploy therefore adds it to the pull
 * request automatically, or fails here saying so.
 *
 * Not every check belongs: `atlas:check` is deliberately absent from deploy.yml
 * and so is absent here. A check production does not block on is not a check a
 * pull request should block on — that is the deploy's call to make, and this
 * file only holds the two in agreement.
 */

import { readFileSync } from 'node:fs'

const pkg = JSON.parse(readFileSync('package.json', 'utf8'))
const verify = pkg.scripts?.verify ?? ''

// Comment lines first: deploy.yml's comments name npm scripts as prose.
const deployYml = readFileSync('.github/workflows/deploy.yml', 'utf8')
  .split('\n')
  .filter((line) => !line.trim().startsWith('#'))
  .join('\n')

const inDeploy = [...deployYml.matchAll(/^\s*(?:- )?run:\s*npm run ([a-z:]+)/gm)].map((m) => m[1])
const gates = [...new Set(inDeploy.filter((s) => s.endsWith(':check')))]

// These block no deploy but must still run on a pull request: one tests the
// decision that publishes the site, the other is this file.
const ALSO = ['reconcile:check', 'gates:check']

const fail = []

if (!verify) {
  fail.push(['package.json defines no "verify" script.', '  .github/workflows/verify.yml runs it; without it a pull request checks nothing.'])
}

for (const gate of [...gates, ...ALSO]) {
  if (!pkg.scripts?.[gate]) {
    fail.push([`deploy.yml runs "npm run ${gate}", which package.json does not define.`])
  } else if (!verify.includes(`npm run ${gate}`)) {
    fail.push([
      `"${gate}" blocks the production deploy but "verify" does not run it.`,
      '  A pull request would go green on a check that then fails after merge —',
      '  which is the exact failure this file exists to prevent. Add it to the',
      '  "verify" script in package.json.',
    ])
  }
}

if (!gates.length) {
  fail.push([
    'No *:check gates were found in deploy.yml.',
    '  Either the deploy stopped checking anything, or this file stopped being able',
    '  to read it. Both are worth stopping for.',
  ])
}

if (fail.length) {
  console.error('')
  console.error(`THE GATES — ${fail.length} problem${fail.length === 1 ? '' : 's'}:`)
  console.error('')
  for (const lines of fail) for (const line of lines) console.error(line)
  console.error('')
  process.exit(1)
}

console.log(`THE GATES — verify runs all ${gates.length} deploy-blocking checks (${gates.join(', ')}) plus ${ALSO.join(', ')}`)
