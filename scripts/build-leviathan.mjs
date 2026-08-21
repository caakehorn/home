/**
 * Bakes LEVIATHAN's datasets out of the vendored wiki snapshot.
 *
 *   node --experimental-strip-types scripts/build-leviathan.mjs
 *
 * The old LEVIATHAN computed its wiki instruments in the browser, over a 2.5 MB
 * payload, on every load. Here the counting happens once, at build time, and
 * the browser gets the counts — same numbers, none of the wait.
 *
 * THE RULE, carried over from the original and load-bearing: no instrument
 * makes a judgement. Every number below is a count, a date, or a length taken
 * over the whole corpus with nothing excluded and nothing weighted. There is
 * no sentiment scoring, no keyword list, no threshold picked because of what
 * it would surface. Anything editorial would make the output a portrait of an
 * argument; left alone, the counts make a portrait of the corpus.
 */
import { readdirSync, readFileSync, mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { mineDates, segmentBriefs } from '../src/wiki/brief.ts'

const PAGES = 'public/wiki/pages'
const OUT = 'public/leviathan'

// Sealed pages are not counted. An instrument that reports a page with no
// words, no links and no dates is publishing the shape of what it cannot read.
const pages = readdirSync(PAGES)
  .filter((f) => f.endsWith('.json'))
  .map((f) => JSON.parse(readFileSync(join(PAGES, f), 'utf8')))
  .filter((p) => !p.locked)
  .sort((a, b) => a.slug.localeCompare(b.slug))

// ---------------------------------------------------------------------------
// I · THE MASS — where the corpus's weight actually sits

const domains = new Map()
for (const page of pages) {
  const d = domains.get(page.domain) ?? {
    id: page.domain,
    pages: 0,
    words: 0,
    links: 0,
    charts: 0,
    briefs: 0,
    longest: { slug: '', title: '', words: 0 },
  }
  d.pages++
  d.words += page.words
  d.links += page.links.length
  d.charts += page.charts
  if (segmentBriefs(page.body).some((s) => s.kind === 'brief')) d.briefs++
  if (page.words > d.longest.words) d.longest = { slug: page.slug, title: page.title, words: page.words }
  domains.set(page.domain, d)
}

const mass = {
  domains: [...domains.values()].sort((a, b) => b.words - a.words),
  // Every page's length, for the distribution. Slugs ride along so the
  // instrument can name what the reader is pointing at.
  pages: pages
    .map((p) => ({ slug: p.slug, title: p.title, domain: p.domain, words: p.words }))
    .sort((a, b) => b.words - a.words),
}

// ---------------------------------------------------------------------------
// II · THE CHRONOLOGY — every date the wiki names, mined out of its own prose
//
// Not the timeline pages: the whole corpus. A date counts once per page that
// names it, so a page repeating 2015 forty times does not outvote forty pages
// naming it once — that is a count of pages, which is a fact, rather than a
// count of mentions, which is a writing habit.

const months = new Map()
const years = new Map()
let mentions = 0

for (const page of pages) {
  const seen = new Set()
  for (const date of mineDates(page.body)) {
    // A span is a claim about its endpoints, not about every month between.
    const key = `${date.label}`
    if (seen.has(key)) continue
    seen.add(key)
    mentions++

    const year = Math.floor(date.start)
    const month = Math.min(11, Math.max(0, Math.round((date.start - year) * 12)))
    const bin = `${year}-${String(month + 1).padStart(2, '0')}`

    const m = months.get(bin) ?? { bin, year, month, count: 0, pages: [] }
    m.count++
    if (m.pages.length < 12) m.pages.push({ slug: page.slug, title: page.title, label: date.label })
    months.set(bin, m)

    const y = years.get(year) ?? { year, count: 0, pages: new Set(), sample: [], seen: new Map() }
    y.count++
    y.pages.add(page.slug)
    // One row per page, with the first date it named and how many it named in
    // all — the panel answers "which pages say 1994?", not "how many times".
    const row = y.seen.get(page.slug)
    if (row) row.dates++
    else if (y.sample.length < 40) {
      const fresh = { slug: page.slug, title: page.title, label: date.label, dates: 1 }
      y.sample.push(fresh)
      y.seen.set(page.slug, fresh)
    }
    years.set(year, y)
  }
}

const chronology = {
  mentions,
  months: [...months.values()].sort((a, b) => a.bin.localeCompare(b.bin)),
  years: [...years.values()]
    .map((y) => ({ year: y.year, count: y.count, pages: y.pages.size, sample: y.sample }))
    .sort((a, b) => a.year - b.year),
}


// ---------------------------------------------------------------------------
// III · THE PEN — the corpus as a chart recorder
//
// The old site's pen scaffold drew a moving stylus over stacked lanes and
// looked like an instrument without measuring anything. The lanes here are
// real, and every one of them is a count so the rule holds: nothing weighted,
// nothing scored, nothing chosen for what it would surface.
//
//   MENTIONS  every dated mention landing in the year
//   PAGES     distinct pages that name the year at all
//   DOMAINS   distinct domains among those pages — breadth, not volume
//   OPENINGS  pages whose earliest named date is this year: the record's
//             own first word about something
//
// PAGES and MENTIONS diverge exactly where one page is doing all the talking,
// which is the most useful thing a reader can notice about a year.

const penYears = new Map()
const firstYearOf = new Map()

for (const page of pages) {
  const seen = new Set()
  for (const date of mineDates(page.body)) {
    if (seen.has(date.label)) continue
    seen.add(date.label)
    const year = Math.floor(date.start)

    const row = penYears.get(year) ?? { year, mentions: 0, pages: new Set(), domains: new Set(), openings: 0 }
    row.mentions++
    row.pages.add(page.slug)
    row.domains.add(page.domain)
    penYears.set(year, row)

    const earliest = firstYearOf.get(page.slug)
    if (earliest === undefined || year < earliest) firstYearOf.set(page.slug, year)
  }
}

for (const year of firstYearOf.values()) {
  const row = penYears.get(year)
  if (row) row.openings++
}

// A continuous axis: a year the corpus never names is a zero, not a gap, or
// the pen would skip over the quiet decades and flatter the record.
const penSorted = [...penYears.values()].sort((a, b) => a.year - b.year)
const penFrom = penSorted.length ? penSorted[0].year : 0
const penTo = penSorted.length ? penSorted[penSorted.length - 1].year : 0
const penRows = []
for (let year = penFrom; year <= penTo; year++) {
  const row = penYears.get(year)
  penRows.push({
    year,
    mentions: row ? row.mentions : 0,
    pages: row ? row.pages.size : 0,
    domains: row ? row.domains.size : 0,
    openings: row ? row.openings : 0,
  })
}

const pen = {
  from: penFrom,
  to: penTo,
  lanes: [
    { key: 'mentions', label: 'MENTIONS', unit: 'dated mentions landing in the year' },
    { key: 'pages', label: 'PAGES', unit: 'distinct pages naming it' },
    { key: 'domains', label: 'DOMAINS', unit: 'distinct domains among them' },
    { key: 'openings', label: 'OPENINGS', unit: "pages whose earliest date is this year" },
  ],
  rows: penRows,
}

// ---------------------------------------------------------------------------

mkdirSync(OUT, { recursive: true })
writeFileSync(join(OUT, 'mass.json'), JSON.stringify(mass))
writeFileSync(join(OUT, 'chronology.json'), JSON.stringify(chronology))
writeFileSync(join(OUT, 'pen.json'), JSON.stringify(pen))

const span = chronology.years.length
  ? `${chronology.years[0].year}–${chronology.years[chronology.years.length - 1].year}`
  : 'none'
console.log(
  `leviathan: ${pages.length} pages · ${mass.domains.length} domains · ` +
    `${mentions.toLocaleString()} dated mentions across ${span} -> ${OUT}`,
)
