/**
 * Bakes THE DOCKET out of the vendored snapshot.
 *
 *   npm run docket
 *
 * Reads `public/wiki/` — the snapshot THE WIKI-BRAIN already ships — and writes
 * `public/docket/docket.json`.
 *
 * ---- what a docket is ------------------------------------------------------
 *
 * Every other room in this building reads the wiki for what it asserts. This
 * one reads it for what it has not settled: the places two pages make claims
 * that cannot both be true, the places a page writes down what it does not
 * know, the bets it has left standing, and — the half that makes the other
 * three a machine rather than a complaint — the dated blocks where a doubt
 * actually got closed.
 *
 * Four benches, one dataset, for the same reason THE WIKI wing is one file:
 * four passes over the same 519 pages is four chances for two benches to
 * disagree about how many pages there are.
 *
 * ---- THE RULE, which this room inherits ------------------------------------
 *
 * Nothing here is scored, ranked by importance or filtered for what it would
 * surface. Every item is a span of prose the wiki wrote about itself, lifted
 * whole, attributed to the page that wrote it and dated where it carries a
 * date. The one place a judgement could have crept in is which blocks count as
 * settled, and that is not this file's opinion: `CLOSED`, `RESOLVED` and
 * `SETTLED` are the exact three marks `bin/wiki-digest` filters `OPEN.md` on,
 * and they are applied here to contradictions as well as to gaps — which is
 * the one place the source tool does not apply them, and the reason its live
 * count reads three high.
 *
 * ---- what is deliberately not read -----------------------------------------
 *
 * `wiki/meta/open-questions`, `wiki/meta/digest` and `wiki/meta/recent-activity`
 * are on-site mirrors of OPEN.md, DIGEST.md and RECENT.md — the same lists this
 * file is built from, republished as pages so the portal can serve them. Read
 * them and every gap in the corpus is counted twice, once where it was written
 * and once in the mirror that lists it. They are skipped by slug.
 *
 * Sealed pages are skipped too, the same way the LEVIATHAN build skips them: a
 * page that ships as ciphertext so the site cannot read it out does not get its
 * doubts read out either.
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const IN = 'public/wiki'
const OUT = 'public/docket'

if (!existsSync(join(IN, 'index.json'))) {
  console.error(`No wiki snapshot to read: ${IN}/index.json`)
  console.error('Get it over first: node scripts/sync-wiki.mjs ../wiki-brain')
  process.exit(1)
}

/** Mirrors of the very lists this file builds. Reading them double-counts. */
const MIRRORS = new Set(['meta/open-questions', 'meta/digest', 'meta/recent-activity'])

const index = JSON.parse(readFileSync(join(IN, 'index.json'), 'utf8'))
const pages = readdirSync(join(IN, 'pages'))
  .filter((f) => f.endsWith('.json'))
  .map((f) => JSON.parse(readFileSync(join(IN, 'pages', f), 'utf8')))
  .filter((p) => !p.locked && !MIRRORS.has(p.slug))
pages.sort((a, b) => a.slug.localeCompare(b.slug))

const meta = new Map(index.pages.map((p) => [p.slug, p]))

// ---------------------------------------------------------------------------
// Shared cutting tools

/**
 * Every dated block in a body, as `{ kind, tail, text }`.
 *
 * A block is a blockquote opening `> **KIND [date] — headline**`, and three
 * things about how the corpus actually writes them decide how this has to
 * work:
 *
 *  1. **The headline wraps.** `> **RE-CHECKED [2026-08-20] — a structural`
 *     `> assumption of the corpus turned out to be wrong**` is one bold span
 *     across two lines. Matching the opening line on its own misses 122 of the
 *     452 blocks in the corpus — a quarter of them, and disproportionately the
 *     ones whose headline was worth writing. So the run is joined first and
 *     matched second.
 *  2. **The block runs to several paragraphs**, and the reasoning is usually in
 *     the second one. `bin/wiki-digest` keeps 240 characters because it is
 *     writing a one-line digest; this keeps the whole thing, because the room
 *     is where you read it.
 *  3. **Two blocks can share a run** with no blank line between them, so a run
 *     is cut at every head it contains rather than assumed to hold one.
 */
const BLOCK_HEAD =
  /^(RE-CHECKED|CORRECTED|REVISED|GAP CLOSED|DEADLINE ELAPSED|RETRACTED|SUPERSEDED|RESOLVED|CONFIRMED|SETTLED|CONTRADICTION)\b/
/** The whole bold head, opening `**` to closing `**`, headline and all. */
const BLOCK_BOLD = /^\*\*([\s\S]*?)\*\*/

function datedBlocks(body) {
  const lines = body.split('\n')
  const out = []

  for (let i = 0; i < lines.length; i++) {
    if (!lines[i].startsWith('>')) continue
    let end = i
    while (end < lines.length && lines[end].startsWith('>')) end++

    // The run, with the quote markers off, and the line indices kept so a
    // second head inside it can be found on a line boundary.
    const run = lines.slice(i, end).map((l) => l.replace(/^>\s?/, ''))
    const opens = (l) => l.startsWith('**') && BLOCK_HEAD.test(l.slice(2))
    const heads = run.map((l, n) => (opens(l) ? n : -1)).filter((n) => n !== -1)

    for (const [k, at] of heads.entries()) {
      const to = heads[k + 1] ?? run.length
      const text = run.slice(at, to).join('\n').trim()
      // The whole bold head, then the kind word taken off the front of it. The
      // rest is the tail — and it has to keep the second word, because
      // `CONTRADICTION CLOSED` and `CONTRADICTION RESOLVED` say the block is
      // settled in exactly that position. Eating the capitals as part of the
      // kind loses the only mark that distinguishes a held contradiction from
      // a closed one, on two of the three closed ones in the corpus.
      const bold = (text.match(BLOCK_BOLD) ?? [null, ''])[1]
      const kind = bold.match(BLOCK_HEAD)[1].toUpperCase()
      out.push({ kind, tail: bold.slice(kind.length), text })
    }
    i = end - 1
  }
  return out
}

/** Every `[[wiki/…]]` a span names, deduped, in the order it names them. */
function citedIn(text) {
  const out = []
  for (const m of text.matchAll(/\[\[wiki\/([^\]|#]+)(?:[|#][^\]]*)?\]\]/g)) {
    const slug = m[1].replace(/\/$/, '')
    if (!out.includes(slug)) out.push(slug)
  }
  return out
}

/** Markdown emphasis and wiki links flattened to a plain one-liner. */
function flatten(text) {
  return text
    .replace(/\[\[[^\]|]+\|([^\]]+)\]\]/g, '$1')
    .replace(/\[\[([^\]]+)\]\]/g, (_, p) => p.replace(/\/$/, '').split('/').pop())
    .replace(/^\s*([-*]|\d+\.)\s+/, '')
    .replace(/[*_`]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/** The three marks bin/wiki-digest treats as "this one is done". */
const SETTLED = /\b(CLOSED|RESOLVED|SETTLED|WITHDRAWN)\b/i

// ---------------------------------------------------------------------------
// I · THE COLLISIONS — contradictions the wiki is holding rather than resolving
//
// A page records one as a blockquote opening `> **CONTRADICTION**`, and the
// convention is that BOTH pages carry it — so a collision is an edge between
// the page holding the block and the pages it names inside it, which is what
// makes this bench a graph rather than a list.

const contradictions = []
for (const page of pages) {
  for (const block of datedBlocks(page.body)) {
    if (block.kind !== 'CONTRADICTION') continue
    const date = (block.tail.match(/(\d{4}-\d{2}-\d{2})/) ?? [])[1] ?? null
    // The title a block gives itself after the em dash, where it gives one.
    const headline = (block.tail.match(/[—–]\s*([\s\S]+?)\s*$/) ?? [])[1] ?? null
    contradictions.push({
      id: `c${contradictions.length + 1}`,
      page: page.slug,
      domain: page.domain,
      date,
      headline: headline ? flatten(headline) : null,
      // Applied here and not in the source tool, which is why its live count
      // reads 44 against this file's own.
      open: !SETTLED.test(block.tail),
      against: citedIn(block.text).filter((s) => s !== page.slug),
      text: block.text,
    })
  }
}

// ---------------------------------------------------------------------------
// II · THE GAPS — what the pages admit they do not know
//
// Already parsed at sync time, by the port of `bin/wiki-gaps`' own parser, and
// re-parsing them here would be a second parser to keep in step with the tool
// that has to find these spans again by matching their text.

/** A horizontal rule between sections is punctuation, never a gap. */
const RULE = /^(?:-{3,}|_{3,}|\*{3,})$/

const gaps = []
for (const page of pages) {
  for (const gap of page.gaps ?? []) {
    // Filtered here as well as at the source, because this reads a committed
    // snapshot: a fix in sync-wiki.mjs only reaches this file after the next
    // sync, and until then the room would publish the rule as an open gap.
    if (RULE.test(gap.label)) continue
    gaps.push({
      id: `g${gaps.length + 1}`,
      page: page.slug,
      domain: page.domain,
      label: gap.label,
      text: gap.text,
    })
  }
}

// ---------------------------------------------------------------------------
// III · THE BOARD — falsifiable claims awaiting a verdict
//
// `bin/wiki-digest` reads numbered items under a heading that starts with the
// word. That misses the four pages whose predictions are bulleted and the nine
// whose heading is a sentence — "What this predicts, and what would falsify
// it" — so this reads both shapes under either heading, and reports the
// difference rather than quietly disagreeing with OPEN.md.

const PRED_HEAD =
  /^(#{2,4})[ \t]+(?:\d+[.)][ \t]*)?(?:the\s+)?(?:standing\s+|future\s+)?(?:predictions?\b|what\s+(?:this|the\s+\w+)\s+predicts?\b|predicted\s+anti-preferences\b)/i
/**
 * A verdict a prediction has already been given.
 *
 * Case matters, and differently in the two positions. A HEADING is a label —
 * `### Prediction 1 — PARTIALLY FALSIFIED`, `## Prediction resolved, and a
 * threat rule that falls out of it` — so it is read case-insensitively. An
 * ITEM is prose, and prose says "confirmed" about all sorts of things that are
 * not this item's own verdict, so there the word only counts when the page
 * shouted it.
 */
const VERDICT = /\b(PARTIALLY FALSIFIED|FALSIFIED|CONFIRMED|SCORED|RESOLVED)\b/
const VERDICT_HEAD = new RegExp(VERDICT.source, 'i')
/**
 * Where an item states its own falsifier.
 *
 * Matched against the RAW item rather than the flattened one, and it has to
 * be: the corpus marks a falsifier by emphasising the word — `*Falsifier:*`,
 * `**Falsified by:**` — and `flatten()` strips exactly that emphasis, which
 * leaves nothing to tell a label from the same word used in a sentence. It
 * had one: food-and-diet ends a prediction *"would be the cleanest falsifier
 * available"*, and a marker that only needed the word split the item there and
 * filed **available.** as the falsifier.
 *
 * So the marker has to be a label rather than the word. Three shapes count,
 * and prose loses:
 *
 *   `*Falsifier:*` `**Falsified by:**`   emphasised — 31 of the 33 in the corpus
 *   `Falsified by:`                       a colon, unemphasised
 *   `. Falsified if …`                    sentence-initial, which is how
 *                                         texting-deviance-audit writes all
 *                                         four of its own, with no label at all
 *
 * The third is why this is not simply "emphasis or colon": four real falsifiers
 * are written as a plain following sentence, and dropping them would have the
 * board printing a dash against the most rigorously falsifiable page in the
 * corpus. What it still refuses is the word mid-clause, which is the only case
 * that was ever wrong.
 */
const FALSIFIER =
  /(?:\*{1,2}_{0,2}\bFalsifie[rd](?:\s+(?:by|if))?[:.]?_{0,2}\*{1,2}|\bFalsifie[rd](?:\s+by)?:|(?<=[.!?]\s{1,8})\bFalsifie[rd]\s+(?:by|if)\b)\s*/i
/** The bold lead an item opens with: the claim, with the argument after it. */
const CLAIM_LEAD = /^\s*(?:[-*]|\d+\.)?\s*\*\*([\s\S]+?)\*\*\s*/

/** "The claim was that X." — how a scored section restates what it is scoring. */
function claimOf(text) {
  const m = flatten(text).match(/^The claim was that\s+([\s\S]+?)(?<!\b[A-Z][a-z]{0,3})\.\s/)
  return m ? m[1].trim() : null
}

const predictions = []
for (const page of pages) {
  const lines = page.body.split('\n')

  // Every prediction heading and its span, first, so a section that only
  // contains other prediction sections can be recognised as the container it
  // is. `## Predictions scored` on the-deferred-audit holds two `###` verdicts;
  // emitting the parent too would put the same two scorings on the board twice.
  const heads = []
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(PRED_HEAD)
    if (!m) continue
    const level = m[1].length
    let end = lines.length
    for (let j = i + 1; j < lines.length; j++) {
      const h = lines[j].match(/^(#+)\s/)
      if (h && h[1].length <= level) {
        end = j
        break
      }
    }
    heads.push({ at: i, end, level })
  }

  for (const { at, end, level } of heads) {
    if (heads.some((h) => h.at > at && h.at < end && h.level > level)) continue

    const heading = lines[at].replace(/^#+\s+/, '').trim()
    const scored = (heading.match(VERDICT_HEAD) ?? [])[1] ?? null
    const body = lines.slice(at + 1, end)

    // A SCORED SECTION is a verdict written as prose — the wiki marking its own
    // homework, at length, on a claim it made earlier. There is no list to cut
    // up, and cutting the paragraphs into items would file the reasoning as
    // four more predictions. One entry, the heading as the claim, the argument
    // kept whole.
    if (scored) {
      const text = body.join('\n').trim()
      if (!text) continue
      predictions.push({
        id: `p${predictions.length + 1}`,
        page: page.slug,
        domain: page.domain,
        verdict: scored.toUpperCase(),
        // The claim a scored section is scoring is not in its heading — the
        // heading is the verdict. It is in the first line of the section, and
        // the two that exist both write it the same way: "The claim was that
        // …". Where a page does not, the heading stands, minus its numbering,
        // verdict and all: `PARTIALLY FALSIFIED, and the rule is better for
        // it` is the page's own title for what it decided.
        claim: claimOf(text) ?? flatten(heading.replace(/^predictions?\s*\d*\s*[—–:-]\s*/i, '')),
        rationale: flatten(text).slice(0, 400),
        falsifier: null,
        text,
      })
      continue
    }

    const starts = body
      .map((l, n) => (/^([-*]|\d+\.)\s+\S/.test(l) ? n : -1))
      .filter((n) => n !== -1)
    if (!starts.length) continue
    const bounds = [...starts, body.length]

    for (let b = 0; b < bounds.length - 1; b++) {
      // A trailing horizontal rule belongs to the section, not to its last
      // item, and swallowed into one it prints `---` on the end of a falsifier.
      const raw = body
        .slice(bounds[b], bounds[b + 1])
        .join('\n')
        .replace(/\n\s*(?:-{3,}|_{3,}|\*{3,})\s*$/, '')
        .trim()
      if (!raw || raw.startsWith('>') || raw.startsWith('#')) continue

      // The falsifier comes off the end first, so it cannot be mistaken for
      // part of the argument, and the bold lead comes off the front second.
      // Both are conventions the pages hold to; where a page does not, the
      // whole item stands as the claim rather than being cut at a guess.
      const flat = flatten(raw)
      if (!flat || flat.startsWith('~~')) continue
      const at = raw.search(FALSIFIER)
      const stated = at > 0 ? flatten(raw.slice(0, at)) : flat
      const falsifier = at > 0 ? flatten(raw.slice(at).replace(FALSIFIER, '')) || null : null

      const lead = raw.match(CLAIM_LEAD)
      const claim = lead ? flatten(lead[1]).replace(/[.,;:]$/, '') : stated
      const rationale = lead ? stated.slice(flatten(lead[1]).length).replace(/^[\s.,;:—–-]+/, '') : null

      predictions.push({
        id: `p${predictions.length + 1}`,
        page: page.slug,
        domain: page.domain,
        verdict: ((flat.match(VERDICT) ?? [])[1] ?? 'STANDING').toUpperCase(),
        claim,
        rationale: rationale || null,
        falsifier,
        text: raw,
      })
    }
  }
}

// ---------------------------------------------------------------------------
// IV · THE RULINGS — where a doubt actually got closed
//
// The dated blocks a page uses to record what happened to it. This is the bench
// that decides whether the other three are a frontier or a graveyard: 149 pages
// carry one, they are dated, and they plot.

/** CONTRADICTION is left off: it has a bench of its own, three lines below. */
const RULING_KINDS = new Set([
  'RE-CHECKED',
  'CORRECTED',
  'REVISED',
  'GAP CLOSED',
  'DEADLINE ELAPSED',
  'RETRACTED',
  'SUPERSEDED',
  'RESOLVED',
  'CONFIRMED',
  'SETTLED',
])

const rulings = []
for (const page of pages) {
  for (const block of datedBlocks(page.body)) {
    if (!RULING_KINDS.has(block.kind)) continue
    const date = (block.tail.match(/(\d{4}-\d{2}-\d{2})/) ?? [])[1] ?? null
    const headline = (block.tail.match(/[—–]\s*([\s\S]+?)\s*$/) ?? [])[1] ?? null
    rulings.push({
      id: `r${rulings.length + 1}`,
      page: page.slug,
      domain: page.domain,
      kind: block.kind,
      date,
      headline: headline ? flatten(headline) : null,
      text: block.text,
    })
  }
}
// A contradiction whose heading says it is closed is a ruling too — it is the
// record of one of these being settled — so it appears on both benches, greyed
// on the first and dated on the second. That is not double counting: the same
// block genuinely is both, and hiding it from THE RULINGS would lose the three
// clearest examples in the corpus of the machine working.
for (const c of contradictions) {
  if (c.open) continue
  rulings.push({
    id: `r${rulings.length + 1}`,
    page: c.page,
    domain: c.domain,
    kind: 'CONTRADICTION CLOSED',
    date: c.date,
    headline: c.headline,
    text: c.text,
  })
}
rulings.sort((a, b) => (a.date ?? '0000').localeCompare(b.date ?? '0000') || a.page.localeCompare(b.page))

// ---------------------------------------------------------------------------
// The page table, and the domains
//
// Coordinates come across from index.json — the same layout the map at /brain
// draws and THE WEB reuses — for the reason THE WEB gives under its picture:
// a force simulation started twice gives two pictures of one graph, and the
// three rooms agree because they use one set of numbers computed once.

const touched = new Set()
for (const set of [contradictions, gaps, predictions, rulings]) for (const it of set) touched.add(it.page)
for (const c of contradictions) for (const s of c.against) touched.add(s)

const table = {}
for (const slug of [...touched].sort()) {
  const m = meta.get(slug)
  table[slug] = {
    title: m?.title ?? slug.split('/').pop(),
    domain: m?.domain ?? slug.split('/')[0],
    words: m?.words ?? 0,
    x: m?.x ?? 0,
    y: m?.y ?? 0,
    // A page can be named by a contradiction on another page without carrying
    // one itself. It is on the graph; it is not in the corpus's page list if
    // the snapshot has never heard of it.
    known: Boolean(m),
  }
}

const domains = {}
const bump = (id, key) => {
  domains[id] ??= { id, contradictions: 0, gaps: 0, predictions: 0, rulings: 0, pages: 0 }
  domains[id][key]++
}
for (const c of contradictions) if (c.open) bump(c.domain, 'contradictions')
for (const g of gaps) bump(g.domain, 'gaps')
for (const p of predictions) bump(p.domain, 'predictions')
for (const r of rulings) bump(r.domain, 'rulings')
for (const [, p] of Object.entries(table)) {
  domains[p.domain] ??= { id: p.domain, contradictions: 0, gaps: 0, predictions: 0, rulings: 0, pages: 0 }
  domains[p.domain].pages++
}

const openContra = contradictions.filter((c) => c.open)
const standing = predictions.filter((p) => p.verdict === 'STANDING')

/**
 * Every page in the corpus as a bare dot, for THE COLLISIONS to draw the lit
 * ones against.
 *
 * Fifty-one pages carry a collision. Drawn on their own they are fifty-one dots
 * in a void, and the reader has no way to see that the number worth knowing is
 * fifty-one *out of five hundred and sixteen*. The faint field is that
 * denominator, and it costs 15 kB.
 */
const field = index.pages
  .filter((p) => !p.locked && !MIRRORS.has(p.slug))
  .map((p) => [Number(p.x.toFixed(4)), Number(p.y.toFixed(4)), p.domain])

const data = {
  // The snapshot's own stamp, not the wall clock. This file is committed, and
  // the sync workflow rebuilds it hourly whether or not the wiki moved — so a
  // `new Date()` here would produce a one-line JSON diff every hour and a
  // commit to go with it. Keyed off the snapshot instead, the docket is
  // byte-identical until the wiki actually changes, which is also what makes
  // the workflow's timestamp-only churn guard cover this file for free.
  generatedAt: index.generatedAt,
  field,
  counts: {
    corpusPages: pages.length,
    contradictions: openContra.length,
    contradictionsClosed: contradictions.length - openContra.length,
    gaps: gaps.length,
    predictions: predictions.length,
    predictionsStanding: standing.length,
    rulings: rulings.length,
    pages: touched.size,
    open: openContra.length + gaps.length + standing.length,
  },
  domains: Object.values(domains).sort((a, b) => b.gaps + b.contradictions - (a.gaps + a.contradictions)),
  pages: table,
  contradictions,
  gaps,
  predictions,
  rulings,
}

mkdirSync(OUT, { recursive: true })
writeFileSync(join(OUT, 'docket.json'), JSON.stringify(data))

const kinds = {}
for (const r of rulings) kinds[r.kind] = (kinds[r.kind] ?? 0) + 1
console.log(`THE DOCKET — over ${pages.length} pages`)
console.log(`  I   COLLISIONS  ${openContra.length} open (${contradictions.length - openContra.length} closed)`)
console.log(`  II  GAPS        ${gaps.length} across ${new Set(gaps.map((g) => g.page)).size} pages`)
console.log(
  `  III BOARD       ${predictions.length} (${standing.length} standing, ` +
    `${predictions.length - standing.length} scored)`,
)
console.log(`  IV  RULINGS     ${rulings.length} — ${Object.entries(kinds).map(([k, n]) => `${k} ${n}`).join(', ')}`)
console.log(`  ${touched.size} pages on the docket · ${(JSON.stringify(data).length / 1024).toFixed(0)} kB`)
