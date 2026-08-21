/**
 * Prints what the brief visualiser reads out of the wiki snapshot.
 *
 *   node --experimental-strip-types scripts/audit-briefs.mjs [slug-substring]
 *
 * The parser in src/wiki/brief.ts guesses at prose: which numbers are
 * quantities, which words are states, where one sentence ends. Re-run this
 * after a `sync-wiki` to see what the guesses became before trusting the
 * panels — a figure row full of house numbers means a rule needs tightening.
 */
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { segmentBriefs, topFigures } from '../src/wiki/brief.ts'

const PAGES = 'public/wiki/pages'
const filter = process.argv[2] ?? ''
const list = (items) => (items.length ? items.join(' · ') : '—')

let pages = 0
let briefs = 0

for (const file of readdirSync(PAGES).sort()) {
  const page = JSON.parse(readFileSync(join(PAGES, file), 'utf8'))
  if (page.locked) continue // sealed: there is no body here to audit
  if (filter && !page.slug.includes(filter)) continue

  const found = segmentBriefs(page.body).filter((s) => s.kind === 'brief')
  if (!found.length) continue
  pages++

  for (const { brief } of found) {
    briefs++
    console.log(`\n${'='.repeat(72)}\n${page.slug} — ${brief.heading} (${brief.words} words)`)
    console.log(`  facts   ${brief.facts.length}: ${list(brief.facts.map((f) => f.kind))}`)
    console.log(`  dates   ${list(brief.dates.map((d) => d.label))}`)
    console.log(`  figures ${list(topFigures(brief.figures).map((f) => `${f.value} ${f.label}`.trim()))}`)
    console.log(`  dropped ${list(
      brief.figures.filter((f) => !topFigures(brief.figures).includes(f)).map((f) => `${f.value} ${f.label}`.trim()),
    )}`)
    console.log(`  flags   ${list(brief.flags.map((f) => `${f.tone}:${f.label}`))}`)
    console.log(`  cast    ${list(brief.entities.map((e) => `${e.label}×${e.mentions}`))}`)
  }
}

console.log(`\n${briefs} briefs across ${pages} pages`)
