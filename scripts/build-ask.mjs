/**
 * Vendors PROCUREMENT VI · THE ASK out of the leviathan repo.
 *
 *   node scripts/build-ask.mjs [path-to-leviathan]
 *   LEVIATHAN=/path/to/leviathan node scripts/build-ask.mjs
 *
 * The source is `js/procurement-asks.js` in caakehorn/leviathan — a hand-built
 * ledger of 357 records drawn from 18,946 messages, classified by speech-act
 * frame and then read by hand.
 *
 * ---- what ships with it ---------------------------------------------------
 *
 * The per-category **precision** from the hand audit travels with the records
 * and is printed on the instrument beside every lane. That is the original's
 * arrangement and its own stated reason for it: a number nobody can check is
 * not evidence. It runs from 100% down to 57%.
 *
 * Nothing here is recomputed. The classification has already been done by hand
 * over there; re-deriving it would only invent a second, differently-wrong
 * ledger. This script reshapes the records into monthly lanes and copies the
 * audit through unchanged.
 *
 * This dataset is committed, like transcript and accretion and unlike the sets
 * `prebuild` regenerates: it derives from a repository this one does not
 * vendor, so there is nothing for CI to build it from.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

const SOURCE = resolve(process.argv[2] ?? process.env.LEVIATHAN ?? '../leviathan')
const LEDGER = join(SOURCE, 'js', 'procurement-asks.js')
const OUT = resolve('public/leviathan')

if (!existsSync(LEDGER)) {
  console.error(`build-ask: no ledger at ${LEDGER}`)
  console.error('pass a leviathan checkout: node scripts/build-ask.mjs ../leviathan')
  process.exit(1)
}

// The source is an IIFE assigning one object literal to window. Slice the
// literal out rather than evaluating the file: this script should not be able
// to run whatever that repository happens to have in it.
const text = readFileSync(LEDGER, 'utf8')
const open = text.indexOf('window.ProcurementAsks =')
if (open < 0) {
  console.error('build-ask: no `window.ProcurementAsks =` in the ledger')
  process.exit(1)
}
const brace = text.indexOf('{', open)
if (brace < 0) {
  console.error('build-ask: could not find the object literal')
  process.exit(1)
}

/**
 * Walk to the literal's matching brace. The file closes with the IIFE's own
 * braces after it, so the last `}` in the file is the wrong one — and the
 * quoted message text is full of braces and escapes, so the walk has to know
 * when it is inside a string.
 */
const close = (() => {
  let depth = 0
  let inString = false
  let escaped = false
  for (let i = brace; i < text.length; i++) {
    const c = text[i]
    if (inString) {
      if (escaped) escaped = false
      else if (c === '\\') escaped = true
      else if (c === '"') inString = false
      continue
    }
    if (c === '"') inString = true
    else if (c === '{') depth++
    else if (c === '}' && --depth === 0) return i
  }
  return -1
})()

if (close < 0) {
  console.error('build-ask: the object literal never closes')
  process.exit(1)
}

/** @type {{ meta: Record<string, unknown>, records: { d: string, t: string, k: string, x: string }[] }} */
const ledger = JSON.parse(text.slice(brace, close + 1))
const records = ledger.records ?? []
if (!records.length) {
  console.error('build-ask: the ledger carries no records')
  process.exit(1)
}
if (records.length !== ledger.meta.total) {
  console.error(`build-ask: ${records.length} records, meta says ${ledger.meta.total}`)
  process.exit(1)
}

/**
 * The five lanes, in the order the original drew them, with the raw categories
 * each one folds together. The grouping is the original's and is part of the
 * classification rather than a reading of it — it is reproduced, not invented.
 */
const LANES = [
  { key: 'denom', label: 'NAMES THE BUY SIZE', kinds: ['denom'] },
  { key: 'want', label: 'ASKS FOR IT', kinds: ['want', 'order', 'chase', 'askSupply', 'askMoney', 'askOther'] },
  { key: 'fund', label: 'RAISES THE MONEY', kinds: ['fund', 'ask3p'] },
  { key: 'code', label: 'HANDS OVER THE ATM CODE', kinds: ['code'] },
  { key: 'see', label: 'IS THE SOURCE AROUND', kinds: ['see'] },
]

/** What each raw category was taken to mean, for the record feed. */
const KINDS = {
  denom: 'names the number when asked how much',
  want: 'asks for it',
  order: 'places the order',
  chase: 'chases the supply',
  askSupply: 'asks him for supply',
  askMoney: 'asks him for money',
  askOther: 'asks him for something',
  ask3p: 'asks her family',
  fund: 'raises the money',
  code: 'hands over the ATM code',
  see: 'is the source around',
}

const laneOf = (kind) => LANES.find((lane) => lane.kinds.includes(kind))?.key ?? null

for (const record of records) {
  if (!laneOf(record.k)) {
    console.error(`build-ask: category ${record.k} belongs to no lane`)
    process.exit(1)
  }
}

/** Every month between the first record and the last, whether or not it carries one. */
const span = []
const [y0, m0] = ledger.meta.from.slice(0, 7).split('-').map(Number)
const [y1, m1] = ledger.meta.to.slice(0, 7).split('-').map(Number)
for (let y = y0, m = m0; y < y1 || (y === y1 && m <= m1); m === 12 ? ((y += 1), (m = 1)) : (m += 1)) {
  span.push(`${y}-${String(m).padStart(2, '0')}`)
}

let running = 0
const rows = span.map((bin) => {
  const here = records.filter((r) => r.d.slice(0, 7) === bin)
  running += here.length
  const row = { bin, records: here.length, running }
  for (const lane of LANES) row[lane.key] = here.filter((r) => lane.kinds.includes(r.k)).length
  return row
})

const counted = rows.reduce((n, r) => n + r.records, 0)
if (counted !== records.length) {
  console.error(`build-ask: ${counted} records fell in the span, ledger holds ${records.length}`)
  process.exit(1)
}

const ask = {
  generatedAt: new Date().toISOString().slice(0, 19) + 'Z',
  source: 'caakehorn/leviathan · js/procurement-asks.js',
  /** Carried through verbatim. The precision table is the point of it. */
  meta: ledger.meta,
  from: span[0],
  to: span[span.length - 1],
  months: span.length,
  total: records.length,
  lanes: LANES.map((lane) => ({
    key: lane.key,
    label: lane.label,
    kinds: lane.kinds,
    /** The worst hand-audited precision among the categories this lane folds. */
    precision: Math.min(...lane.kinds.map((k) => ledger.meta.precision[k] ?? 100)),
    unit: 'classified records that month',
  })).concat([
    { key: 'running', label: 'RUNNING TOTAL', kinds: [], precision: null, unit: 'records classified so far' },
  ]),
  rows,
  /** The records themselves, for the feed. Each keeps its own audited precision. */
  records: records.map((r) => ({
    d: r.d,
    t: r.t,
    k: r.k,
    lane: laneOf(r.k),
    means: KINDS[r.k] ?? r.k,
    precision: ledger.meta.precision[r.k] ?? 100,
    x: r.x,
  })),
}

mkdirSync(OUT, { recursive: true })
writeFileSync(join(OUT, 'ask.json'), JSON.stringify(ask))

const worst = Math.min(...Object.values(ledger.meta.precision))
console.log(
  `ask.json — ${ask.total} classified records · ${ask.months} months · ` +
    `${ask.from} → ${ask.to} · precision ${worst}%–100%`,
)
