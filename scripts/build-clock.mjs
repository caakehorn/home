/**
 * Bakes ◈ CORPUS II · THE CLOCK out of the vendored transcript.
 *
 *   npm run clock
 *
 * This is the one instrument in the CORPUS wing whose corpus was already in the
 * building. The rack said so for months — "nothing from outside any more; what
 * is missing is the instrument" — and this is that missing half. It reads
 * `public/transcript/`, which THE TRANSCRIPT already ships, and writes
 * `public/leviathan/clock.json`.
 *
 * ---- the one rule that matters here --------------------------------------
 *
 * **Timestamps are parsed out of the string, never through `Date()`.** The
 * export writes local wall-clock time as `"YYYY-MM-DD HH:MM:SS"` with no zone
 * on it. Handing that to `new Date()` makes the runtime guess a zone, and an
 * instrument whose entire x-axis is the hour of the day cannot afford a guess:
 * a viewer in Berlin would be shown a correspondent who went to bed at 3pm.
 * Slicing the string is not a shortcut around a library — it is the only
 * reading of that string that is true in every timezone, which is why the old
 * repo did it too and said so.
 *
 * ---- what is counted ------------------------------------------------------
 *
 * Every message, once. No sampling, no density binning, no smoothing, and no
 * message dropped for being short, duplicated or unlike its neighbours. The
 * spiral is 134,348 marks because the record is 134,348 messages.
 *
 * ---- the packing ----------------------------------------------------------
 *
 * One message is three numbers — which day, which minute of that day, and which
 * direction — and three numbers times 134,348 is a lot of JSON brackets. So
 * each message is packed into one integer:
 *
 *     value = day * 2880 + minute * 2 + dir
 *
 * `day` counts from the first day in the record, `minute` is 0–1439, and `dir`
 * comes off the export unchanged — 1 sent, 0 received, the same convention
 * THE TRANSCRIPT reads. Nothing is lost: the three fall back out with a
 * divide and two remainders, and the instrument does exactly that.
 *
 * The values are then delta-encoded, because the record is already in order and
 * the gap between two consecutive messages is usually a handful of minutes: it
 * turns eight-digit numbers into one- and two-digit ones and takes the file
 * from about 1.2 MB to about 0.4 MB. A prefix sum puts them back. This is a
 * compression of the file, not of the data — every message is still in it.
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
const months = readdirSync(join(IN, 'months')).filter((f) => f.endsWith('.json')).sort()

if (!months.length) {
  console.error(`No months under ${IN}/months — the record is not vendored.`)
  process.exit(1)
}

/** `"2015-11-28 18:47:54"` → days since the epoch, read as a date and nothing else. */
const dayNumber = (stamp) => {
  const y = +stamp.slice(0, 4)
  const m = +stamp.slice(5, 7)
  const d = +stamp.slice(8, 10)
  // Date.UTC does calendar arithmetic on numbers we supply; no zone is inferred
  // from the string, and no local time is involved on either side.
  return Math.floor(Date.UTC(y, m - 1, d) / 86_400_000)
}

const minuteOfDay = (stamp) => +stamp.slice(11, 13) * 60 + +stamp.slice(14, 16)

/** `"2020-08"` → the day index of the 1st. */
const monthStartDay = (bin) => Math.floor(Date.UTC(+bin.slice(0, 4), +bin.slice(5, 7) - 1, 1) / 86_400_000)

/** `"2022-11"` → the day index of the last day of that month. */
const monthEndDay = (bin) => Math.floor(Date.UTC(+bin.slice(0, 4), +bin.slice(5, 7), 0) / 86_400_000)

const gaps = index.gaps ?? []

// ---------------------------------------------------------------------------
// pass one: read every message, in order

/** @type {{ day: number, minute: number, dir: number }[]} */
const marks = []
let first = null
let last = null

for (const file of months) {
  const bin = JSON.parse(readFileSync(join(IN, 'months', file), 'utf8'))
  for (const [stamp, dir] of bin.m) {
    const day = dayNumber(stamp)
    marks.push({ day, minute: minuteOfDay(stamp), dir: dir ? 1 : 0 })
    if (first === null || day < first) first = day
    if (last === null || day > last) last = day
  }
}

marks.sort((a, b) => a.day - b.day || a.minute - b.minute)

// The spine already knows how many messages there are. If this pass disagrees
// with it, the split and this instrument are reading different records and the
// spiral would be quietly wrong rather than loudly missing.
if (marks.length !== index.count) {
  console.error(`Read ${marks.length} messages; the index says ${index.count}.`)
  console.error('The months and the spine disagree — re-run `npm run transcript`.')
  process.exit(1)
}

// ---------------------------------------------------------------------------
// pass two: the counts the instrument prints, and the pack
//
// Every figure below is a count of marks. Nothing is a rate, a score or a
// share of anything, and no hour is called late or early — the spiral says
// where the record is dense and the reader says what that means.

const hours = Array.from({ length: 24 }, () => ({ all: 0, sent: 0, received: 0 }))
const years = new Map()
let sent = 0

const packed = []
let previous = 0

for (const mark of marks) {
  const hour = Math.floor(mark.minute / 60)
  hours[hour].all++
  hours[hour][mark.dir ? 'sent' : 'received']++
  if (mark.dir) sent++

  const year = new Date((mark.day * 86_400_000)).getUTCFullYear()
  years.set(year, (years.get(year) ?? 0) + 1)

  const value = (mark.day - first) * 2880 + mark.minute * 2 + mark.dir
  packed.push(value - previous)
  previous = value
}

const iso = (day) => new Date(day * 86_400_000).toISOString().slice(0, 10)

const set = {
  generatedAt: new Date().toISOString(),
  source: `${IN} · ${months.length} months`,
  count: marks.length,
  sent,
  received: marks.length - sent,
  /** Day zero of the spiral: the centre. */
  from: iso(first),
  /** The rim. */
  to: iso(last),
  days: last - first + 1,
  hours,
  years: [...years.entries()].sort((a, b) => a[0] - b[0]).map(([year, count]) => ({ year, count })),
  /**
   * The runs of months the exports do not cover, carried over from the spine
   * and converted to day indices off the same day zero as `marks`.
   *
   * This is not a nicety. A volume chart with nothing in it for twenty-eight
   * months and no note draws a silence that never happened — the record went
   * quiet in the archive, not in the relationship, and the two look identical
   * if you only plot the months that survived. THE TRANSCRIPT states them; an
   * instrument reading the same record has to state them too, at their real
   * width, or it is making a claim the corpus does not support.
   */
  gaps: gaps.map((gap) => ({
    ...gap,
    fromDay: monthStartDay(gap.from) - first,
    toDay: monthEndDay(gap.to) - first,
  })),
  /** Delta-encoded `day * 2880 + minute * 2 + dir`. See the note at the top. */
  marks: packed,
}

mkdirSync(OUT, { recursive: true })
writeFileSync(join(OUT, 'clock.json'), JSON.stringify(set) + '\n')

const bytes = JSON.stringify(set).length
const busiest = hours.reduce((best, h, i) => (h.all > hours[best].all ? i : best), 0)
console.log(
  `${OUT}/clock.json — ${marks.length.toLocaleString()} messages · ${set.from} → ${set.to} · ` +
    `${set.days.toLocaleString()} days · ${(bytes / 1e6).toFixed(2)} MB`,
)
console.log(
  `  densest hour: ${String(busiest).padStart(2, '0')}:00 with ${hours[busiest].all.toLocaleString()} ` +
    `(${sent.toLocaleString()} sent, ${(marks.length - sent).toLocaleString()} received)`,
)
