/**
 * The one outstanding-work list for the charts overhaul.
 *
 * This rebuild is meant to run as several sessions at once, in different
 * containers, on different branches, possibly under different models, none of
 * which can see the others. Two things have to be true for that not to end in
 * a merge pile: a session must be able to find out what is left **without
 * asking anybody**, and two sessions must not be able to claim the same work.
 *
 * So nothing here is a checkbox. Every lane's `done` is a predicate recomputed
 * against the working tree on each run — a payload that exists, an instrument
 * that is registered, a defect count that has actually fallen. A list that can
 * be ticked independently of the thing it describes is a list that can lie,
 * and the first lie it tells is that unfinished work is finished.
 *
 * Claims are the one thing the tree cannot compute, because a claim is about a
 * session in flight rather than about a file. They live in
 * `.charts/lanes.jsonl`, which is append-only for the reason wiki-brain's
 * ledgers are: two sessions appending merge as a set union, where one mutable
 * file would make every concurrent push a conflict whose loser is dropped
 * silently.
 *
 *   node scripts/charts-work.mjs                 what is done, claimed, open
 *   node scripts/charts-work.mjs next            the lane to take, and why
 *   node scripts/charts-work.mjs claim <lane>    take it, and say so
 *   node scripts/charts-work.mjs release <lane>  hand it back
 *   node scripts/charts-work.mjs check           are this branch's edits in its lane?
 */

import fs from 'node:fs'
import path from 'node:path'
import { execSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const LEDGER = path.join(ROOT, '.charts', 'lanes.jsonl')

const exists = (p) => fs.existsSync(path.join(ROOT, p))
const read = (p) => (exists(p) ? fs.readFileSync(path.join(ROOT, p), 'utf8') : '')

/** An instrument is finished when its own entry says it is lit. */
const registered = (id) => read(`src/leviathan/instruments/${id}/entry.ts`).includes("status: 'LIVE'")

/**
 * The lanes.
 *
 * `owns` is the whole point of the file. It is the set of paths a lane may
 * write, it is disjoint between every pair of lanes, and `check` enforces it
 * against the branch's own diff — so a session cannot wander into another
 * one's files without the gate saying so before the push, rather than git
 * saying so after it.
 */
const LANES = [
  {
    id: 'foundation',
    title: 'Self-registering instruments, and the shared chart kit',
    why:
      'Adding one instrument today edits three shared files: the registry array in core.ts, and ' +
      'an import plus a BUILT entry in Leviathan.tsx. Three parallel sessions adding three ' +
      'instruments collide twice each. This lane makes an instrument one self-contained ' +
      'directory that registers itself through import.meta.glob, so adding one is a new file and ' +
      'never an edit to a shared one. It also lands src/charts/, the primitive every later lane ' +
      'draws with. Every other lane except brief waits on it, so it is done once, alone, first.',
    owns: [
      'src/leviathan/core.ts',
      'src/leviathan/registry.ts',
      'src/routes/Leviathan.tsx',
      'src/charts/**',
      'src/leviathan/instruments/*/entry.ts',
      'scripts/build-all.mjs',
    ],
    needs: [],
    done: () => exists('src/leviathan/registry.ts') && exists('src/charts'),
  },
  {
    id: 'analyzer',
    title: 'The refuse-first table analyzer',
    why:
      '194 of 239 drawn tables carry a hard defect, because analyzeTable asks whether a chart is ' +
      'possible and never whether it is true. Rewrite it to refuse by default: units detected per ' +
      'column rather than per table, no column of years drawn as a magnitude, no duplicate ' +
      'labels, no fewer than four rows, no magnitude spread past 25x without an explicit log ' +
      'opt-in, no score or rating or percentile header at all, and labels that wrap instead of ' +
      'being cut at fifteen characters. Re-measure with scripts/audit-charts.mjs and lower its ' +
      'BASELINE as each count actually falls.',
    owns: ['src/wiki/table.ts', 'src/wiki/Chart.tsx', 'src/wiki/Markdown.tsx', 'src/wiki/chart.css'],
    needs: ['foundation'],
    done: () => read('src/wiki/table.ts').includes('REFUSALS'),
  },
  {
    id: 'brief',
    title: 'THE RULE, applied to the page renderer',
    why:
      'Seventeen instruments are BARRED in core.ts for keyword lists and composite scores. Two ' +
      'things in brief.ts do exactly that on every wiki page: FLAGS maps a keyword list to four ' +
      'sentiment tones, and figureScore decides which four numbers get set large by a hand-tuned ' +
      'formula. Keep the state words as neutral labels, take the tones and the score out. This ' +
      'lane touches nothing any other lane touches, so it can start immediately.',
    owns: ['src/wiki/brief.ts', 'src/wiki/Brief.tsx', 'src/wiki/brief.css'],
    needs: [],
    done: () => read('src/wiki/brief.ts').length > 0 && !read('src/wiki/brief.ts').includes('figureScore'),
  },
  {
    id: 'youtube',
    title: 'THE SIGNAL — 19,068 watches, 2010 to 2026',
    why:
      'Marked SEALED on the claim that the watch history "is not vendored here". wiki-brain holds ' +
      'raw/self/youtube-watch-history/ — 19,068 parsed timestamps, 21,734 watch links, 11,797 ' +
      'channel links. The largest untouched dated corpus the site has. Build signal.json and ' +
      'commit it, per the atlas.json precedent. Trap: the timestamps use a narrow no-break space ' +
      '(U+202F) before AM/PM, and about 2.5% of entries carry no timestamp at all — count those ' +
      'rather than dropping them silently. Watch volume by month against the coverage gaps, ' +
      'hour-of-day by year, distinct channels and top-channel share per year, repeat watches.',
    owns: [
      'scripts/build-signal.mjs',
      'public/leviathan/signal.json',
      'src/leviathan/instruments/signal/**',
    ],
    needs: ['foundation'],
    done: () => exists('public/leviathan/signal.json') && registered('signal'),
  },
  {
    id: 'location',
    title: 'THE ATLAS, un-reconstructed',
    why:
      'The instrument prints RECONSTRUCTED on every frame against a real Google Semantic Location ' +
      'History, 2014 to 2024, sitting in wiki-brain at raw/self/location/2026-06-22-ingest/ with ' +
      'a 28 MB Records.json beside it. build-atlas.mjs:35 already documents the escape hatch — ' +
      'handed a real export it sets source: "export" and the instrument stops printing the word. ' +
      'Nobody has fired it. The existing per-year and per-address assertions in that script must ' +
      'keep passing or be replaced with assertions against the export, never simply deleted.',
    owns: [
      'scripts/build-atlas.mjs',
      'scripts/check-atlas.mjs',
      'public/leviathan/atlas.json',
      'src/leviathan/instruments/atlas/**',
    ],
    needs: ['foundation'],
    done: () => read('public/leviathan/atlas.json').includes('"source":"export"'),
  },
  {
    id: 'sessions',
    title: 'The AI-session record, charted against itself',
    why:
      '375 ChatGPT conversations over 4,821 nodes, 2022 to 2025, plus 21 MB of dated Gemini ' +
      'activity. The record of the project that produced this wiki, and it is charted nowhere. ' +
      'Conversations per week, turns per conversation, and the hour-of-day profile set against ' +
      'the message record own — two counts on one axis, which is the only comparison this site is ' +
      'allowed to draw. Nothing reads message content; a turn is a node in the mapping.',
    owns: [
      'scripts/build-sessions.mjs',
      'public/leviathan/sessions.json',
      'src/leviathan/instruments/sessions/**',
    ],
    needs: ['foundation'],
    done: () => exists('public/leviathan/sessions.json') && registered('sessions'),
  },
  {
    id: 'rewing',
    title: 'Re-wing the eleven instruments that measure the repository',
    why:
      'MASS, CHRONICLE, GENESIS, ACCRETION, WEB, HEALTH, SCHEMA, TAGS, ECHO, ATTENTION, EVIDENCE ' +
      'and CLAIMS count words, links, commits and frontmatter fields. Every one is honestly built ' +
      'and the operator asked for none of them to be cut. The defect is framing: "people is the ' +
      'heaviest domain" is a fact about how much has been typed, and it is shown with the same ' +
      'authority as a message timestamp. Give them a wing named for what they measure. After ' +
      'foundation lands this is an edit to each entry.ts wing field, which collides with nothing.',
    owns: ['src/leviathan/wings.ts'],
    needs: ['foundation'],
    done: () => exists('src/leviathan/wings.ts'),
  },
  {
    id: 'directive',
    title: 'The opt-in chart directive, in wiki-brain',
    why:
      'Once the analyzer refuses by default, a page that wants a chart has to ask for one. This ' +
      'lane is in the OTHER repository: the directive syntax, the pages worth marking up, and ' +
      'the wiki-brain gate that keeps a directive pointing at a table that still exists. Nothing ' +
      'here owns a file in this repository, so it never conflicts with anything above.',
    owns: [],
    repo: 'caakehorn/wiki-brain',
    needs: ['analyzer'],
    done: () => false,
  },
]

// ---------------------------------------------------------------------------
// claims — the only state the tree cannot compute

const events = () =>
  (fs.existsSync(LEDGER) ? fs.readFileSync(LEDGER, 'utf8') : '')
    .split('\n')
    .filter(Boolean)
    .flatMap((l) => {
      try {
        return [JSON.parse(l)]
      } catch {
        return []
      }
    })

/**
 * A claim goes stale rather than expiring on a clock, because a session that
 * dies in a reclaimed container leaves no release behind and would otherwise
 * hold a lane forever. Twelve hours is longer than any one session and shorter
 * than a working day.
 */
const STALE_MS = 12 * 60 * 60 * 1000

function claims() {
  const held = new Map()
  for (const e of events()) {
    if (e.type === 'claim') held.set(e.lane, e)
    if (e.type === 'release' || e.type === 'complete') held.delete(e.lane)
  }
  for (const [lane, e] of held)
    if (Date.now() - Date.parse(e.at) > STALE_MS) held.set(lane, { ...e, stale: true })
  return held
}

const append = (event) => {
  fs.mkdirSync(path.dirname(LEDGER), { recursive: true })
  fs.appendFileSync(LEDGER, JSON.stringify(event) + '\n')
}

const branchNow = () => {
  try {
    return execSync('git branch --show-current', { cwd: ROOT }).toString().trim()
  } catch {
    return 'unknown'
  }
}

/**
 * Whoever is running this.
 *
 * The model is taken from `--as` or the environment and is **never guessed**.
 * A session that cannot name its own model records `unstated`, which is more
 * use to the next reader than a confident wrong answer — the point of the
 * field is that whoever finds a stale claim can tell whether the session
 * holding it was theirs.
 */
const whoami = () => {
  const flag = process.argv.indexOf('--as')
  return {
    agent: process.env.CLAUDE_SESSION_ID ?? process.env.AGENT_ID ?? 'unstated',
    model:
      (flag > -1 ? process.argv[flag + 1] : null) ??
      process.env.CLAUDE_MODEL ??
      process.env.ANTHROPIC_MODEL ??
      'unstated',
    branch: branchNow(),
  }
}

// ---------------------------------------------------------------------------

const state = () => {
  const held = claims()
  return LANES.map((l) => {
    const claim = held.get(l.id)
    return {
      ...l,
      isDone: l.done(),
      claim: claim && !claim.stale ? claim : null,
      stale: claim && claim.stale ? claim : null,
      blockedBy: l.needs.filter((n) => !LANES.find((x) => x.id === n).done()),
    }
  })
}

/**
 * Enough glob for the `owns` patterns above, and no more: `**` crosses a
 * directory separator, `*` does not.
 */
const glob = (pattern) => {
  let out = '^'
  for (let i = 0; i < pattern.length; i++) {
    const c = pattern[i]
    if (c === '*' && pattern[i + 1] === '*') {
      out += '.*'
      i += pattern[i + 2] === '/' ? 2 : 1
    } else if (c === '*') out += '[^/]*'
    else out += c.replace(/[.+^${}()|[\]\\]/, '\\$&')
  }
  return new RegExp(out + '$')
}

/**
 * How far a pattern commits to a path before it stops naming one.
 *
 * Two patterns can match one file. `foundation` owns every instrument's
 * `entry.ts`, because splitting the registry is what that lane does;
 * `youtube` owns everything under its own instrument directory. The file is
 * the second lane's, and the rule that says so is that the more specific
 * pattern wins.
 *
 * This is the whole reason `owns` can be called disjoint, so `doctor` proves
 * it over the real tree rather than leaving it asserted.
 */
const specificity = (pattern) => pattern.split('*')[0].length

/** Every lane a path could belong to, most specific first. */
const ownersOf = (file) =>
  LANES.flatMap((l) =>
    l.owns.filter((o) => glob(o).test(file)).map((o) => ({ lane: l.id, pattern: o })),
  ).sort((a, b) => specificity(b.pattern) - specificity(a.pattern))

const ownerOf = (file) => ownersOf(file)[0] ?? null

const [cmd, arg] = process.argv.slice(2)

if (!cmd || cmd === 'list') {
  const rows = state()
  const mark = (l) =>
    l.isDone ? 'DONE' : l.claim ? 'CLAIMED' : l.blockedBy.length ? 'BLOCKED' : 'OPEN'
  console.log('CHARTS OVERHAUL — the account is docs/CHARTS.md\n')
  for (const l of rows) {
    console.log(`${mark(l).padEnd(8)} ${l.id.padEnd(11)} ${l.title}`)
    if (l.claim) console.log(`         held by ${l.claim.model} on ${l.claim.branch}, since ${l.claim.at}`)
    if (l.stale) console.log(`         a stale claim from ${l.stale.branch} — reclaimable`)
    if (l.blockedBy.length) console.log(`         waits on ${l.blockedBy.join(', ')}`)
    if (l.repo) console.log(`         lives in ${l.repo}, not here`)
  }
  const open = rows.filter((l) => !l.isDone && !l.claim && !l.blockedBy.length)
  console.log(`\n${rows.filter((l) => l.isDone).length}/${rows.length} done · ${open.length} open now`)
  console.log('take one with: node scripts/charts-work.mjs next')
} else if (cmd === 'next') {
  const rows = state()
  const open = rows.filter((l) => !l.isDone && !l.claim && !l.blockedBy.length)
  if (!open.length) {
    const blocked = rows.filter((l) => !l.isDone && l.blockedBy.length)
    console.log(
      blocked.length
        ? `Nothing open. ${blocked.length} lane(s) wait on: ${[...new Set(blocked.flatMap((l) => l.blockedBy))].join(', ')}`
        : 'Every lane is done or claimed.',
    )
    process.exit(0)
  }
  const l = open[0]
  console.log(`TAKE: ${l.id} — ${l.title}\n`)
  console.log(l.why.replace(/(.{1,86})(\s|$)/g, '$1\n').trimEnd())
  console.log(
    `\nIt owns, and may write, only:\n${l.owns.map((o) => '  ' + o).join('\n') || '  (another repository)'}`,
  )
  console.log(`\n  node scripts/charts-work.mjs claim ${l.id}`)
} else if (cmd === 'claim' || cmd === 'release') {
  const lane = LANES.find((l) => l.id === arg)
  if (!lane) {
    console.error(`no lane "${arg}". Lanes: ${LANES.map((l) => l.id).join(', ')}`)
    process.exit(1)
  }
  const held = claims().get(arg)
  if (cmd === 'claim' && held && !held.stale) {
    console.error(`${arg} is held by ${held.model} on ${held.branch}, since ${held.at}.`)
    console.error('Take another lane, or release it if you know that session is gone.')
    process.exit(1)
  }
  const me = whoami()
  append({ type: cmd, lane: arg, at: new Date().toISOString(), ...me })
  console.log(`${cmd === 'claim' ? 'claimed' : 'released'} ${arg}.`)
  if (me.model === 'unstated')
    console.log('No model recorded. Pass --as "<your model>" so a later session can tell\nwhose stale claim it is looking at.')
  if (cmd === 'claim') {
    console.log('Commit and push .charts/lanes.jsonl now, before writing any code —')
    console.log('a claim nobody else can see is not a claim.')
  }
} else if (cmd === 'check') {
  let changed = []
  try {
    const base = execSync('git merge-base HEAD origin/main', { cwd: ROOT }).toString().trim()
    changed = execSync(`git diff --name-only ${base}...HEAD`, { cwd: ROOT })
      .toString()
      .split('\n')
      .filter(Boolean)
  } catch {
    console.log('no origin/main to compare against; nothing to check')
    process.exit(0)
  }
  const here = branchNow()
  const mine = [...claims().values()].filter((c) => c.branch === here).map((c) => c.lane)
  if (!mine.length) {
    console.log(`${here} holds no lane; nothing to check`)
    process.exit(0)
  }
  /** Shared by construction: the account, the ledger, and the two work tools. */
  const communal = [/^docs\//, /^\.charts\//, /^scripts\/(audit|charts)-/, /^package(-lock)?\.json$/, /^AGENTS\.md$/, /^CLAUDE\.md$/]
  const trespass = changed
    .filter((f) => !communal.some((re) => re.test(f)))
    .map((f) => ({ f, owner: ownerOf(f) }))
    .filter((x) => x.owner && !mine.includes(x.owner.lane))
  if (trespass.length) {
    console.error(`holding ${mine.join(', ')}, this branch writes files another lane owns:\n`)
    for (const { f, owner } of trespass) console.error(`  ${f}  — ${owner.lane}  (${owner.pattern})`)
    console.error('\nSplit the change, or claim that lane too. Do not merge across lanes.')
    process.exit(1)
  }
  console.log(`holding ${mine.join(', ')} · ${changed.length} files changed, all in lane`)
} else if (cmd === 'doctor') {
  // §3.3 calls the `owns` sets disjoint. This is where that stops being a claim.
  const files = execSync('git ls-files', { cwd: ROOT }).toString().split('\n').filter(Boolean)
  const probes = [
    ...files,
    'src/charts/Chart.tsx',
    'src/leviathan/instruments/signal/entry.ts',
    'src/leviathan/instruments/signal/Signal.tsx',
    'src/leviathan/instruments/sessions/entry.ts',
    'src/leviathan/instruments/atlas/entry.ts',
    'src/leviathan/registry.ts',
    'src/leviathan/wings.ts',
    'scripts/build-signal.mjs',
    'public/leviathan/signal.json',
  ]
  const ties = []
  for (const f of probes) {
    const owners = ownersOf(f)
    if (owners.length < 2) continue
    // A tie is only ambiguous when two patterns are equally specific.
    if (specificity(owners[0].pattern) === specificity(owners[1].pattern))
      ties.push({ f, owners: owners.slice(0, 2) })
  }
  const contested = probes
    .map((f) => ({ f, owners: ownersOf(f) }))
    .filter((x) => new Set(x.owners.map((o) => o.lane)).size > 1)
  console.log(`${probes.length} paths probed`)
  console.log(`${contested.length} matched by more than one lane, resolved by specificity:`)
  for (const { f, owners } of contested)
    console.log(`  ${f}\n    → ${owners[0].lane} (${owners[0].pattern}) over ${owners.slice(1).map((o) => o.lane).join(', ')}`)
  if (ties.length) {
    console.error(`\n${ties.length} genuinely ambiguous — two lanes, equal specificity:`)
    for (const { f, owners } of ties) console.error(`  ${f}  — ${owners.map((o) => o.lane).join(' vs ')}`)
    console.error('\nOwnership must be decidable. Narrow one of the patterns.')
    process.exit(1)
  }
  console.log('\nno ambiguous ownership')
} else {
  console.error('commands: list · next · claim <lane> · release <lane> · check · doctor')
  process.exit(1)
}
