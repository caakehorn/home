/**
 * Vendors THE TRANSCRIPT out of the leviathan repo into public/transcript as
 * JSON this site can serve: one index for the spine, one file per month for
 * lazy loading.
 *
 *   node scripts/sync-transcript.mjs [path-to-leviathan]
 *   LEVIATHAN=/path/to/leviathan node scripts/sync-transcript.mjs
 *
 * The source is `data/transcript.json` in caakehorn/leviathan — one envelope
 * holding the whole record as fixed-length arrays:
 *
 *     {"generated": iso8601, "target": [...], "count": n,
 *      "first": ts, "last": ts, "m": [[timestamp, dir, text, flags], ...]}
 *
 *     dir   0 = received, 1 = sent
 *     flags bit 0 = has attachment, bit 1 = tapback/reaction
 *
 * The old site fetched that envelope whole — 9.4 MB before a single line was
 * on screen. Here it is split at month boundaries, because a reader arrives
 * wanting a month and not a decade, and because a re-sync then rewrites only
 * the months that moved rather than one nine-megabyte blob.
 *
 * NOTHING IS DROPPED, REORDERED OR EDITED. The split is a split: concatenate
 * the months in bin order and you have the envelope's `m` back, byte for byte,
 * in the same order, with the same timestamps and the same flags. Line numbers
 * are global and 1-based — the same identity the old site's `#L1234` anchors
 * used, so a link into the record from anywhere still lands on the same
 * message.
 *
 * This dataset is committed, like accretion.json and unlike the instrument
 * sets `prebuild` regenerates: it is derived from a repository this one does
 * not vendor, so there is nothing for CI to build it from.
 */
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

const SOURCE = resolve(process.argv[2] ?? process.env.LEVIATHAN ?? '../leviathan')
const OUT = resolve('public/transcript')
const RECORD = join(SOURCE, 'data', 'transcript.json')

if (!existsSync(RECORD)) {
  console.error(`sync-transcript: no record at ${RECORD}`)
  console.error('pass a leviathan checkout: node scripts/sync-transcript.mjs ../leviathan')
  process.exit(1)
}

const envelope = JSON.parse(readFileSync(RECORD, 'utf8'))
const messages = envelope.m ?? []
if (!messages.length) {
  console.error(`sync-transcript: ${RECORD} carries no messages`)
  process.exit(1)
}

/** Every message the record holds, still in the order it was sent. */
const bins = new Map()
const counts = { sent: 0, received: 0, attachments: 0, reactions: 0, characters: 0 }

messages.forEach((row, i) => {
  const [ts, dir, text, flags] = row
  const bin = ts.slice(0, 7)
  const month = bins.get(bin) ?? { bin, from: i + 1, count: 0, sent: 0, received: 0, chars: 0, m: [] }
  month.count++
  month.chars += text.length
  if (dir) month.sent++
  else month.received++
  month.m.push(row)
  bins.set(bin, month)

  if (dir) counts.sent++
  else counts.received++
  if (flags & 1) counts.attachments++
  if (flags & 2) counts.reactions++
  counts.characters += text.length
})

const months = [...bins.values()].sort((a, b) => a.bin.localeCompare(b.bin))

// A month the exports never covered is a hole in the exports, not a quiet
// month in the thread — the distinction matters enough to compute rather than
// assert, so the runs of missing months are derived here and the reader states
// them as what they are.
const step = (bin) => {
  const [y, m] = bin.split('-').map(Number)
  return m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, '0')}`
}
const distance = (a, b) => {
  const [ay, am] = a.split('-').map(Number)
  const [by, bm] = b.split('-').map(Number)
  return (by - ay) * 12 + (bm - am)
}

const gaps = []
for (let i = 1; i < months.length; i++) {
  const missing = distance(months[i - 1].bin, months[i].bin) - 1
  if (missing > 0) {
    gaps.push({ from: step(months[i - 1].bin), to: months[i].bin, months: missing })
  }
}
// `to` above is the first month that exists again; name the last missing one.
for (const gap of gaps) {
  let last = gap.from
  for (let i = 1; i < gap.months; i++) last = step(last)
  gap.to = last
}

const years = []
for (const month of months) {
  const year = Number(month.bin.slice(0, 4))
  const row = years.at(-1)?.year === year ? years.at(-1) : (years.push({ year, count: 0, months: 0 }), years.at(-1))
  row.count += month.count
  row.months++
}

const index = {
  generatedAt: new Date().toISOString(),
  /** Where the record came from, and when that repo last built it. */
  source: 'caakehorn/leviathan · data/transcript.json',
  builtAt: envelope.generated ?? null,
  handles: Array.isArray(envelope.target) ? envelope.target : [envelope.target],
  count: messages.length,
  first: envelope.first ?? messages[0][0],
  last: envelope.last ?? messages.at(-1)[0],
  counts,
  span: { months: distance(months[0].bin, months.at(-1).bin) + 1, covered: months.length },
  years,
  months: months.map(({ bin, from, count, sent, received, chars }) => ({
    bin,
    from,
    count,
    sent,
    received,
    chars,
  })),
  gaps,
}

// A stale month left behind by a shorter record would still be fetchable, so
// the directory is rebuilt rather than written over.
rmSync(OUT, { recursive: true, force: true })
mkdirSync(join(OUT, 'months'), { recursive: true })

for (const month of months) {
  writeFileSync(
    join(OUT, 'months', `${month.bin}.json`),
    JSON.stringify({ bin: month.bin, from: month.from, count: month.count, m: month.m }),
  )
}
writeFileSync(join(OUT, 'index.json'), JSON.stringify(index))

console.log(
  `transcript: ${index.count.toLocaleString()} messages · ` +
    `${counts.sent.toLocaleString()} sent / ${counts.received.toLocaleString()} received · ` +
    `${months.length} months covered of ${index.span.months} spanned ` +
    `(${gaps.length} gaps) · ${index.first.slice(0, 10)} → ${index.last.slice(0, 10)} -> ${OUT}`,
)
