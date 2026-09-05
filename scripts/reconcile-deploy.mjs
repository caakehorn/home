/**
 * What the site should be serving, and whether it already is.
 *
 * ---- why this is not just `changed` ----------------------------------------
 *
 * The sync used to gate its deploy on whether it had committed anything. That
 * answers whether main moved. It does not answer whether main reached anybody,
 * and the difference is the whole failure: a deploy that fails leaves main
 * holding a snapshot the site has not got, every later sync re-derives that
 * same snapshot, finds it already current, reports nothing changed, skips the
 * deploy — and the gap is permanent, silent, and invisible behind a column of
 * green runs. Three days of it in September 2026, main at 498 pages against a
 * published 496, while every scheduled sync reported success.
 *
 * A repository state and a deployment state are two different facts. Only one
 * of them is what a reader sees. So the published snapshot is asked directly.
 *
 * ---- the identity is the commit --------------------------------------------
 *
 * `source.commit` in the index is the wiki-brain commit a snapshot was derived
 * from: it says exactly what source state a reader is receiving, which is the
 * question being asked. `generatedAt` only says when a build ran — two builds
 * of identical source differ in it, and it is the field the sync's own churn
 * guard exists to normalise away. It is carried here for the log, never for
 * the decision.
 *
 * An index missing `source.commit` on either side falls back to `generatedAt`
 * and says so. That is worse, and it is still better than a comparison that
 * cannot be made: an identity this code cannot read is a recovery that never
 * runs, which is the bug it was written for.
 *
 * `decide` is pure so the decision matrix can be tested rather than reasoned
 * about — see scripts/check-reconcile.mjs.
 */

import { execFileSync } from 'node:child_process'
import { appendFileSync } from 'node:fs'

/** `{ commit, generatedAt }` from a snapshot index, or null if it is unusable. */
export function identity(text) {
  if (typeof text !== 'string' || !text.trim()) return null
  let json
  try {
    json = JSON.parse(text)
  } catch {
    return null
  }
  const commit = typeof json?.source?.commit === 'string' ? json.source.commit : null
  const generatedAt = typeof json?.generatedAt === 'string' ? json.generatedAt : null
  if (!commit && !generatedAt) return null
  return { commit, generatedAt }
}

/**
 * Deploy or not, and what.
 *
 * `main` and `site` are `identity()` results — null meaning unreadable and
 * unreachable respectively, which are reported apart on purpose. Conflating
 * them hides a step that can never compare anything behind a message that
 * reads like a passing network blip.
 */
export function decide({ changed, pushedSha, mainSha, main, site }) {
  if (changed) {
    return {
      deploy: true,
      sha: pushedSha,
      reason: 'pushed',
      message: 'Deploying the snapshot this run pushed.',
    }
  }
  if (!main) {
    return {
      deploy: false,
      sha: null,
      reason: 'unreadable-main',
      level: 'warning',
      message:
        'Could not read public/wiki/index.json at origin/main — this step cannot ' +
        'detect a stale site. Fix that rather than ignoring it.',
    }
  }
  if (!site) {
    return {
      deploy: false,
      sha: null,
      reason: 'unreachable-site',
      level: 'warning',
      message: 'Could not read the published snapshot — not forcing a deploy this run.',
    }
  }

  // Commit where both sides have one; otherwise the timestamp, loudly.
  const key = main.commit && site.commit ? 'commit' : 'generatedAt'
  if (!main[key] || !site[key]) {
    return {
      deploy: false,
      sha: null,
      reason: 'no-identity',
      level: 'warning',
      message: 'Neither a source commit nor a generatedAt is readable on both sides.',
    }
  }
  if (main[key] === site[key]) {
    return {
      deploy: false,
      sha: null,
      reason: 'current',
      key,
      message: `The site is serving the snapshot on main (${key} ${main[key]}).`,
    }
  }
  return {
    deploy: true,
    sha: mainSha,
    reason: 'stale',
    key,
    level: 'notice',
    message:
      `main holds a snapshot the site never got — ${key} ${main[key]} on main, ` +
      `${site[key]} on the site. Deploying main.`,
  }
}

/* ---- the CLI half: gather the two identities, then decide ---------------- */

const run = (...args) => execFileSync('git', args, { encoding: 'utf8' }).trim()

async function main() {
  const changed = process.env.CHANGED === 'true'
  const pushedSha = process.env.PUSHED_SHA || ''

  let mainSha = ''
  let onMain = null
  let onSite = null
  let siteUrl = ''

  if (!changed) {
    try {
      run('fetch', '--quiet', 'origin', 'main')
      mainSha = run('rev-parse', 'origin/main')
      onMain = identity(run('show', 'origin/main:public/wiki/index.json'))
    } catch {
      onMain = null
    }

    const [owner, repo] = (process.env.GITHUB_REPOSITORY || '/').split('/')
    siteUrl = `https://${owner}.github.io/${repo}/wiki/index.json`
    try {
      const res = await fetch(siteUrl, { signal: AbortSignal.timeout(30_000) })
      onSite = res.ok ? identity(await res.text()) : null
    } catch {
      onSite = null
    }

    console.log(`  site      ${siteUrl}`)
    console.log(`  on main   ${onMain ? `${onMain.commit} · ${onMain.generatedAt}` : '<unreadable>'}`)
    console.log(`  on site   ${onSite ? `${onSite.commit} · ${onSite.generatedAt}` : '<unreachable>'}`)
  }

  const verdict = decide({ changed, pushedSha, mainSha, main: onMain, site: onSite })

  const prefix = verdict.level ? `::${verdict.level}::` : ''
  console.log(`${prefix}${verdict.message}`)

  if (process.env.GITHUB_OUTPUT) {
    const lines = [`deploy=${verdict.deploy}`, `reason=${verdict.reason}`]
    if (verdict.deploy) lines.push(`sha=${verdict.sha}`)
    appendFileSync(process.env.GITHUB_OUTPUT, lines.join('\n') + '\n')
  }
}

// Only when run as a program; importing it for the checks must do nothing.
if (process.argv[1] && process.argv[1].endsWith('reconcile-deploy.mjs')) {
  await main()
}
