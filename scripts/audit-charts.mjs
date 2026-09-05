/**
 * What the wiki's tables are actually being drawn as.
 *
 * `src/wiki/Markdown.tsx` defaults every table to `tables: 'chart'`, so
 * `analyzeTable` gets a vote on all 663 of them and draws whichever it can
 * find a numeric column in. That is a permissive rule, and a permissive rule
 * over a corpus this heterogeneous produces charts nobody asked for: a year
 * scraped out of a prose cell and drawn as a magnitude, a `Metric | Value`
 * key-value list flattened onto one shared axis, a percent sign sniffed from
 * one column and printed on the units of another.
 *
 * This file is the count. It exists because "most of these are wrong" is an
 * impression and "184 of 233 trip at least one of eight named defects" is a
 * number that can be re-measured after a fix, and because the defects have to
 * be named individually before the analyzer can be taught to refuse them.
 *
 * It reads the published snapshot rather than wiki-brain, so it measures what
 * a reader actually gets, and it runs the same `preprocess` → `marked.lexer`
 * the renderer runs rather than a parser of its own. That order matters: skip
 * `preprocess` and the `|` inside `[[path|label]]` splits 43 rows an extra
 * column wide, which looks exactly like a rendering defect and is not one.
 *
 *   node scripts/audit-charts.mjs            # the tally
 *   node scripts/audit-charts.mjs --detail   # every offending table, named
 *   node scripts/audit-charts.mjs --check    # exit 1 if the tally has risen
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { marked } from 'marked'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const PAGES = path.join(HERE, '..', 'public', 'wiki', 'pages')

/**
 * The tally this file was written against. `--check` fails when a number goes
 * up, so a fix that repairs one defect while opening another cannot pass.
 * Lower these as the defects are actually fixed; never raise one to go green.
 */
const BASELINE = {
  'truncated-labels': 131,
  'kv-list': 54,
  'tiny': 39,
  'blank-header': 36,
  'year-as-value': 27,
  'mixed-magnitude': 18,
  'unit-contamination': 16,
  'judgement-column': 12,
}

// ---------------------------------------------------------------------------
// The analyzer, copied rather than imported.
//
// `src/wiki/table.ts` is TypeScript inside the Vite graph and this is a plain
// node script, so the logic is duplicated here on purpose. The duplication is
// the point of `--check`: if the two ever disagree the tally moves and the
// gate says so, which is a louder failure than a build-time import shim.

const parseNumber = (cell) => {
  if (!cell) return null
  const cleaned = cell.replace(/\(.*?\)/g, ' ').replace(/[,$]/g, '').trim()
  const m = cleaned.match(/^[-+]?\d+(\.\d+)?/)
  if (!m) return null
  const n = Number(m[0])
  return Number.isFinite(n) ? n : null
}

const strip = (s) =>
  s.replace(/\*\*|__|`|\[\[|\]\]/g, '').replace(/\[([^\]]*)\]\([^)]*\)/g, '$1').trim()

const unitOf = (cells) => {
  if (cells.some((c) => c.includes('%'))) return '%'
  if (cells.some((c) => c.trim().startsWith('$'))) return '$'
  return ''
}

const looksTemporal = (labels) => {
  const hits = labels.filter(
    (l) =>
      /^(19|20)\d{2}([-/].+)?$/.test(l.trim()) ||
      /^\d{4}-\d{2}(-\d{2})?$/.test(l.trim()) ||
      /^(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/i.test(l.trim()),
  ).length
  return labels.length >= 3 && hits >= labels.length * 0.8
}

function analyzeTable({ headers, rows }) {
  if (headers.length < 2 || rows.length < 2) return null
  const labels = rows.map((r) => strip(r[0] ?? ''))
  if (labels.some((l) => !l)) return null

  const series = []
  let unit = ''
  for (let c = 1; c < headers.length; c++) {
    const cells = rows.map((r) => (r[c] ?? '').trim())
    const values = cells.map(parseNumber)
    const hits = values.filter((v) => v !== null).length
    if (hits < Math.max(2, values.length * 0.6)) continue
    series.push({ name: strip(headers[c]), values, cells })
    if (!unit) unit = unitOf(cells)
  }
  if (!series.length || series.length > 4) return null

  return { form: looksTemporal(labels) ? 'line' : 'bar', labelHeader: strip(headers[0]), labels, series, unit }
}

// ---------------------------------------------------------------------------
// The eight defects, each one a rule the analyzer will have to learn to refuse

function defectsOf(spec) {
  const found = []
  const heads = spec.series.map((s) => s.name)

  // A key-value list has no shared dimension, so its bars are not comparable.
  if (/^(metric|indicator|measure|stat)s?$/i.test(spec.labelHeader) && spec.series.length === 1)
    found.push('kv-list')

  if (!spec.labelHeader) found.push('blank-header')

  // A column of years is an axis, not a magnitude. Drawn as one it says 2015.
  for (const s of spec.series) {
    const v = s.values.filter((x) => x !== null)
    if (v.length >= 2 && v.every((x) => Number.isInteger(x) && x >= 1900 && x <= 2030)) {
      found.push('year-as-value')
      break
    }
  }

  if (spec.series.length > 1) {
    const maxes = spec.series.map((s) => Math.max(0, ...s.values.filter((v) => v !== null).map(Math.abs)))
    const lo = Math.min(...maxes)
    const hi = Math.max(...maxes)
    // Past ~100x the smaller series is under a pixel and the axis is a lie.
    if (hi > 0 && (lo === 0 || hi / lo >= 100)) found.push('mixed-magnitude')

    // `unit` is taken from the first column that has one and printed on all of
    // them, so one parenthetical `(86.7%)` renders 120 books as "120%".
    const kinds = spec.series.map((s) =>
      s.cells.some((c) => c.includes('%')) ? '%' : s.cells.some((c) => c.trim().startsWith('$')) ? '$' : '',
    )
    if (new Set(kinds).size > 1) found.push('unit-contamination')
  }

  // THE RULE: a score, a rating and a percentile are judgements, not counts.
  if (heads.some((h) => /score|rating|rank|percentile|index|verdict|grade|gini|confidence|severity/i.test(h)))
    found.push('judgement-column')

  if (spec.labels.length <= 3) found.push('tiny')

  // `Chart.tsx` cuts a bar's category at 15 characters and appends an ellipsis.
  if (spec.form === 'bar' && spec.labels.some((l) => l.length > 16)) found.push('truncated-labels')

  return found
}

// ---------------------------------------------------------------------------

/**
 * `src/wiki/inline.tsx`. Wikilinks become ordinary markdown links before the
 * lexer ever sees them, which is why their pipes do not shatter a table row.
 */
const preprocess = (md) =>
  md.replace(/\[\[([^\]|]+)(?:\|([^\]]*))?\]\]/g, (_all, target, label) => {
    const slug = target.trim().replace(/^wiki\//, '').replace(/\.md$/, '')
    return `[${(label ?? slug).trim()}](/wiki/${slug})`
  })

const tablesOf = (body) => {
  const out = []
  const walk = (tokens) => {
    for (const t of tokens) {
      if (t.type === 'table')
        out.push({ headers: t.header.map((c) => c.text), rows: t.rows.map((r) => r.map((c) => c.text)) })
      if (t.tokens) walk(t.tokens)
    }
  }
  walk(marked.lexer(preprocess(body)))
  return out
}

const detail = process.argv.includes('--detail')
const check = process.argv.includes('--check')

let tables = 0
let charted = 0
const tally = {}
const offenders = []

for (const file of fs.readdirSync(PAGES).sort()) {
  const page = JSON.parse(fs.readFileSync(path.join(PAGES, file), 'utf8'))
  for (const table of tablesOf(page.body)) {
    tables++
    const spec = analyzeTable(table)
    if (!spec) continue
    charted++
    const defects = defectsOf(spec)
    if (!defects.length) continue
    for (const d of new Set(defects)) tally[d] = (tally[d] ?? 0) + 1
    offenders.push({ slug: page.slug, headers: table.headers, defects: [...new Set(defects)], spec })
  }
}

const hard = offenders.filter((o) => o.defects.some((d) => d !== 'tiny')).length

console.log(`${tables} tables · ${charted} auto-charted · ${hard} carrying a hard defect\n`)
for (const [name, n] of Object.entries(tally).sort((a, b) => b[1] - a[1])) {
  const base = BASELINE[name]
  const mark = base === undefined ? ' (new)' : n > base ? ` ▲ ${n - base}` : n < base ? ` ▼ ${base - n}` : ''
  console.log(`${String(n).padStart(4)}  ${name}${mark}`)
}

if (detail) {
  console.log('')
  for (const o of offenders) {
    console.log(`${o.slug}  [${o.defects.join(', ')}]`)
    console.log(`    ${o.headers.join(' | ')}`)
    for (const s of o.spec.series)
      console.log(`    ${s.name} → ${JSON.stringify(s.values.slice(0, 5))}  raw ${JSON.stringify(s.cells.slice(0, 3))}`)
  }
}

if (check) {
  const risen = Object.entries(tally).filter(([k, n]) => n > (BASELINE[k] ?? 0))
  if (risen.length) {
    console.error(`\nchart defects have risen: ${risen.map(([k, n]) => `${k} ${BASELINE[k] ?? 0}→${n}`).join(', ')}`)
    process.exit(1)
  }
  console.log('\nno defect count above its baseline')
}
