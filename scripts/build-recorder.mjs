/**
 * Bakes THE HOUSE V · THE RECORDER out of the vendored transcript.
 *
 *   npm run recorder
 *
 * The old console's MODULE 08 was THE POLYGRAPH — a four-pen chart recorder
 * run over the message record, and the best-looking instrument on the site.
 * It is BARRED here and it stays barred: its four pens were LOVE, PROFANITY,
 * APOLOGY and SHOUT, four keyword lists asked to stand in for a mood, and THE
 * RULE does not bend for an instrument that looks good.
 *
 * What comes across is the chart recorder, not the pens. THE PEN already did
 * this once over the wiki's dated mentions; this is the same drum wound over
 * the corpus the polygraph actually ran on — 134,348 messages, month by month
 * — with the keyword channels replaced by four things that are only ever
 * counted:
 *
 *     SENT       messages sent in the month
 *     RECEIVED   messages received in it
 *     WORDS      runs of letters across both directions
 *     DAYS       distinct days in the month carrying at least one message
 *
 * Nothing is scored, nothing is weighted, and no month is dropped.
 *
 * ---- timestamps -----------------------------------------------------------
 *
 * Read out of the string, never through `Date()`, for the same reason THE
 * CLOCK does it: the export writes local wall-clock time with no zone on it,
 * and handing that to the runtime makes it guess one. A month bin and a day
 * are the first seven and first ten characters. That reading is true in every
 * timezone; any other reading is true in one.
 *
 * ---- the months the exports do not cover ----------------------------------
 *
 * The record spans 129 months and the exports cover 91 of them. The missing 38
 * are not months of silence — they are months of missing archive, and the two
 * are not the same fact. They are emitted as rows with `covered: 0` and every
 * lane at zero, and the instrument hatches them rather than tracing through
 * them, the same arrangement THE PULSE and THE RINGS use.
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const IN = 'public/transcript'
const OUT = 'public/leviathan'

if (!existsSync(join(IN, 'index.json'))) {
  console.error(`No transcript to read: ${IN}/index.json`)
  console.error('Get the record over first: npm run transcript -- ../leviathan')
  process.exit(1)
}

const index = JSON.parse(readFileSync(join(IN, 'index.json'), 'utf8'))
const files = readdirSync(join(IN, 'months'))
  .filter((f) => f.endsWith('.json'))
  .sort()

if (!files.length) {
  console.error(`No months under ${IN}/months — the record is not vendored.`)
  process.exit(1)
}

/**
 * A word is a run of letters and apostrophes, lowercased, stripped of the
 * apostrophes at either end, and at least two characters long once it has
 * been. That is THE LEXICON's definition verbatim, and it is used here rather
 * than a looser one so the two instruments cannot disagree about what a word
 * is while both claiming to count the same corpus.
 */
const WORD = /[a-z']+/g

/** @type {Map<string, { sent: number, received: number, words: number, days: Set<string>, chars: number }>} */
const bins = new Map()

for (const file of files) {
  const month = JSON.parse(readFileSync(join(IN, 'months', file), 'utf8'))
  const bin = month.bin
  const row = { sent: 0, received: 0, words: 0, days: new Set(), chars: 0 }

  for (const [ts, dir, text] of month.m) {
    // The bin is the first seven characters and the day the first ten. No Date().
    row.days.add(ts.slice(0, 10))
    dir === 1 ? row.sent++ : row.received++
    const body = typeof text === 'string' ? text : ''
    row.chars += body.length
    for (const match of body.toLowerCase().matchAll(WORD)) {
      if (match[0].replace(/^'+|'+$/g, '').length >= 2) row.words++
    }
  }

  bins.set(bin, row)
}

/** Every month between the first and the last, whether or not it was exported. */
const span = []
const [y0, m0] = index.first.slice(0, 7).split('-').map(Number)
const [y1, m1] = index.last.slice(0, 7).split('-').map(Number)
for (let y = y0, m = m0; y < y1 || (y === y1 && m <= m1); m === 12 ? ((y += 1), (m = 1)) : (m += 1)) {
  span.push(`${y}-${String(m).padStart(2, '0')}`)
}

const rows = span.map((bin) => {
  const row = bins.get(bin)
  if (!row) return { bin, covered: 0, sent: 0, received: 0, words: 0, days: 0, messages: 0, chars: 0 }
  return {
    bin,
    covered: 1,
    sent: row.sent,
    received: row.received,
    words: row.words,
    days: row.days.size,
    messages: row.sent + row.received,
    chars: row.chars,
  }
})

const recorder = {
  generatedAt: new Date().toISOString().slice(0, 19) + 'Z',
  source: index.source,
  from: span[0],
  to: span[span.length - 1],
  months: span.length,
  covered: rows.filter((r) => r.covered).length,
  count: rows.reduce((n, r) => n + r.messages, 0),
  sent: rows.reduce((n, r) => n + r.sent, 0),
  received: rows.reduce((n, r) => n + r.received, 0),
  words: rows.reduce((n, r) => n + r.words, 0),
  days: rows.reduce((n, r) => n + r.days, 0),
  lanes: [
    { key: 'sent', label: 'SENT', unit: 'messages he sent that month' },
    { key: 'received', label: 'RECEIVED', unit: 'messages he was sent' },
    { key: 'words', label: 'WORDS', unit: 'runs of letters across both' },
    { key: 'days', label: 'DAYS', unit: 'distinct days carrying a message' },
  ],
  rows,
}

// The record is the record: if the sum of the months is not the count the
// index publishes, something was dropped and the file should not be written.
if (recorder.count !== index.count) {
  console.error(`recorder: counted ${recorder.count} messages, index says ${index.count}`)
  process.exit(1)
}

mkdirSync(OUT, { recursive: true })
writeFileSync(join(OUT, 'recorder.json'), JSON.stringify(recorder))

console.log(
  `recorder.json — ${recorder.count.toLocaleString()} messages · ${recorder.covered}/${recorder.months} months covered · ` +
    `${recorder.words.toLocaleString()} words · ${recorder.days.toLocaleString()} active days`,
)
