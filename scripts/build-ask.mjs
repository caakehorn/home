/**
 * Bakes VI · THE ASK out of the record this site already ships.
 *
 *   node scripts/build-ask.mjs [path-to-leviathan]
 *   LEVIATHAN=/path/to/leviathan node scripts/build-ask.mjs
 *
 * The old instrument (`caakehorn/leviathan`, `ask.html` over
 * `js/procurement-asks.js`) counted its own payload: 357 procurement messages
 * lifted out of a merge of every Annie-thread CSV export in wiki-brain, with
 * the quoted text baked into the payload beside the label. That payload was
 * the evidence and the reading of the evidence in one file, and a reader had
 * no way to check one against the other.
 *
 * This build splits them. Only the LABELS come across — a date, a time and a
 * category per message, which is the hand-audited part and cannot be
 * re-derived by anything here. Everything else is recounted from
 * `public/transcript/**`, the complete record this site serves at /transcript:
 *
 *   · the TEXT of every classified message is read back out of the record,
 *     never out of the old payload, so a quote that does not appear in the
 *     record cannot appear on the instrument;
 *   · every record carries the LINE NUMBER it holds in the record, so each
 *     fragment is a link to the message in its own context at /transcript#L…;
 *   · the DENOMINATOR — how many messages she sent each day — is recounted
 *     here rather than taken on faith, so a lane that rises can be read
 *     against whether she was simply texting more that week.
 *
 * The recount does not reproduce the original's total, and the instrument says
 * so out loud: 18,943 of her messages sit in this window against the 18,946 the
 * old payload claims. Three messages, on a different dedup pass. Printing the
 * gap is the point — a number that agrees with itself because it was copied
 * has not been checked.
 *
 * THE RULE bends here and only here, which is why `ask` carries its own rule
 * note in the registry: the categories are a reading, not a count. The check
 * on that reading is the per-category precision from the original's manual
 * audit, carried across and printed on the instrument, plus the line numbers,
 * which let any reader walk a fragment back to the record and disagree.
 *
 * The output is committed, like public/transcript/** and accretion.json: it
 * derives from a repository this one does not vendor, so there is nothing for
 * CI to build it from.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'

const SOURCE = resolve(process.argv[2] ?? process.env.LEVIATHAN ?? '../leviathan')
const LABELS = join(SOURCE, 'js', 'procurement-asks.js')
const TRANSCRIPT = resolve('public/transcript')
const OUT = resolve('public/leviathan/ask.json')

if (!existsSync(LABELS)) {
  console.error(`build-ask: no label set at ${LABELS}`)
  console.error('pass a leviathan checkout: node scripts/build-ask.mjs ../leviathan')
  process.exit(1)
}
if (!existsSync(join(TRANSCRIPT, 'index.json'))) {
  console.error('build-ask: public/transcript is not built — run `npm run transcript` first')
  process.exit(1)
}

// ---------------------------------------------------------------------------
// the labels
//
// `procurement-asks.js` is a browser file that assigns one object literal to a
// global. There is no build step over there and no JSON beside it, so the
// literal is cut out by brace-matching and parsed. Anything else in the file —
// the comment header, the IIFE — is deliberately not executed.

const src = readFileSync(LABELS, 'utf8')
const open = src.indexOf('{', src.indexOf('window.ProcurementAsks'))
let depth = 0
let close = -1
for (let i = open; i < src.length; i++) {
  if (src[i] === '{') depth++
  else if (src[i] === '}' && --depth === 0) {
    close = i
    break
  }
}
if (open < 0 || close < 0) {
  console.error(`build-ask: could not find the payload literal in ${LABELS}`)
  process.exit(1)
}
const payload = JSON.parse(src.slice(open, close + 1))

// ---------------------------------------------------------------------------
// the record
//
// Only the months the window touches are read. Line numbers are global and
// 1-based — the same identity /transcript#L… anchors use.

const index = JSON.parse(readFileSync(join(TRANSCRIPT, 'index.json'), 'utf8'))
const from = payload.meta.from
const to = payload.meta.to

const DAY = 86400000
const dayNum = (d) => Math.floor(Date.parse(`${d}T00:00:00Z`) / DAY)
const d0 = dayNum(from)
const d1 = dayNum(to)
const n = d1 - d0 + 1
const dayOf = (i) => new Date((d0 + i) * DAY).toISOString().slice(0, 10)

/** Her messages, by day, and the same rows indexed by day for the text lookup. */
const volume = new Array(n).fill(0)
const hers = new Map()
let herMessages = 0

for (const month of index.months) {
  if (month.bin < from.slice(0, 7) || month.bin > to.slice(0, 7)) continue
  const file = JSON.parse(readFileSync(join(TRANSCRIPT, 'months', `${month.bin}.json`), 'utf8'))
  file.m.forEach((row, offset) => {
    // dir 1 = sent (his phone), 0 = received. Her side only.
    if (row[1] !== 0) return
    const day = row[0].slice(0, 10)
    const i = dayNum(day) - d0
    if (i < 0 || i >= n) return
    volume[i]++
    herMessages++
    const bucket = hers.get(day)
    const line = { ts: row[0], text: row[2], line: file.from + offset }
    if (bucket) bucket.push(line)
    else hers.set(day, [line])
  })
}

// ---------------------------------------------------------------------------
// putting one against the other
//
// A label is kept only if the message it points at is in the record. The match
// is on the day plus the text, normalised for whitespace and for the curly
// quotes the exports and the record disagree about; where a day holds more
// than one candidate the one closest to the labelled minute wins.

const norm = (s) =>
  s
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()

const minutes = (hhmm) => {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + m
}

const records = []
const unmatched = []

for (const label of payload.records) {
  const wanted = norm(label.x)
  const candidates = (hers.get(label.d) ?? []).filter((row) => {
    const text = norm(row.text)
    return text === wanted || text.includes(wanted)
  })
  if (!candidates.length) {
    unmatched.push(label)
    continue
  }
  const at = minutes(label.t)
  const best = candidates.reduce((a, b) => {
    const da = Math.abs(minutes(a.ts.slice(11, 16)) - at)
    const db = Math.abs(minutes(b.ts.slice(11, 16)) - at)
    return db < da ? b : a
  })
  records.push({
    d: label.d,
    t: best.ts.slice(11, 16),
    k: label.k,
    // the record's text, not the payload's
    x: best.text,
    line: best.line,
  })
}

records.sort((a, b) => (a.d === b.d ? a.t.localeCompare(b.t) : a.d.localeCompare(b.d)))

// ---------------------------------------------------------------------------
// the lanes
//
// Five lanes over eleven categories, in the order the original drew them:
// naming the size of the buy at the top because it is the act the whole
// question turns on, the ambient wanting under it, the money under that.

const KINDS = {
  denom: 'SHE NAMES THE NUMBER',
  want: 'SHE WANTS IT',
  order: 'SHE PLACES THE ORDER',
  chase: 'SHE CHASES THE SUPPLY',
  askSupply: 'SHE ASKS HIM FOR SUPPLY',
  askMoney: 'SHE ASKS HIM FOR MONEY',
  askOther: 'SHE ASKS HIM FOR SOMETHING',
  fund: 'SHE RAISES THE MONEY',
  ask3p: 'SHE ASKS HER FAMILY',
  code: 'SHE SENDS HER OWN ATM CODE',
  see: 'IS THE SOURCE AROUND?',
}

const LANES = [
  { key: 'denom', label: 'NAMES THE BUY SIZE', unit: 'MESSAGES', kinds: ['denom'] },
  {
    key: 'want',
    label: 'ASKS FOR IT',
    unit: 'MESSAGES',
    kinds: ['want', 'order', 'chase', 'askSupply', 'askMoney', 'askOther'],
  },
  { key: 'fund', label: 'RAISES THE MONEY', unit: 'MESSAGES', kinds: ['fund', 'ask3p'] },
  { key: 'code', label: 'SENDS HER ATM CODE', unit: 'MESSAGES', kinds: ['code'] },
  { key: 'see', label: 'IS THE SOURCE AROUND?', unit: 'MESSAGES', kinds: ['see'] },
]

const laneOf = new Map()
for (const lane of LANES) for (const kind of lane.kinds) laneOf.set(kind, lane.key)

const series = Object.fromEntries(LANES.map((l) => [l.key, new Array(n).fill(0)]))
const counts = Object.fromEntries(LANES.map((l) => [l.key, 0]))
const byKind = {}

for (const record of records) {
  const i = dayNum(record.d) - d0
  const key = laneOf.get(record.k)
  if (key === undefined || i < 0 || i >= n) continue
  series[key][i]++
  counts[key]++
  byKind[record.k] = (byKind[record.k] ?? 0) + 1
}

// ---------------------------------------------------------------------------

const set = {
  generatedAt: new Date().toISOString(),
  source:
    'labels: caakehorn/leviathan · js/procurement-asks.js — text, line numbers and volume: public/transcript',
  from,
  to,
  /** Days in the window, inclusive. Every lane array is this long. */
  days: n,
  /** Her messages in the window, recounted from the record this site serves. */
  herMessages,
  /** What the old payload claimed for the same window, on its own dedup pass. */
  herMessagesClaimed: payload.meta.herMessages,
  /** Labels carried across, and how many of them the record could confirm. */
  labelled: payload.records.length,
  matched: records.length,
  dollarsStated: payload.meta.dollarsStated,
  dollarMentions: payload.meta.dollarMentions,
  atmRuns: payload.meta.atmRuns,
  /** Per-category precision from the original's full manual read of every hit. */
  precision: payload.meta.precision,
  kinds: KINDS,
  lanes: LANES.map((lane) => ({ ...lane, count: counts[lane.key] })),
  series,
  /** Her whole message volume per day — the denominator the lanes are read against. */
  volume,
  byKind,
  records,
}

mkdirSync(dirname(OUT), { recursive: true })
writeFileSync(OUT, `${JSON.stringify(set)}\n`)

const first = dayOf(0)
const last = dayOf(n - 1)
console.log(`build-ask: ${records.length}/${payload.records.length} labels confirmed against the record`)
if (unmatched.length) {
  console.log(`build-ask: ${unmatched.length} dropped — no such message in the record:`)
  for (const u of unmatched.slice(0, 12)) console.log(`  ${u.d} ${u.t} ${u.k} · ${u.x.slice(0, 60)}`)
}
console.log(
  `build-ask: ${herMessages.toLocaleString('en-US')} of her messages over ${n} days, ${first} → ${last}` +
    ` (payload claimed ${payload.meta.herMessages.toLocaleString('en-US')})`,
)
console.log(`build-ask: wrote ${OUT}`)
