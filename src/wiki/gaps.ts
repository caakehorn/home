/**
 * Answering a gap from the browser.
 *
 * `bin/wiki-gaps` in wiki-brain does this from a terminal: pick a page, pick
 * something the page admits it does not know, type the answer, and the answer
 * is staged on the page for the next pass to integrate. This is the same
 * operation with the terminal taken out — the list is baked into
 * `public/wiki/gaps.json` at sync time and the result is committed through the
 * same path the editor saves by.
 *
 * ---- the two have to agree -------------------------------------------------
 *
 * `stage()` below produces byte-for-byte what the Python tool produces: same
 * section name, same preamble, same `### ANSWERED [date]` heading, same
 * frontmatter key in the same position. That is not tidiness. `bin/wiki-gaps
 * clear` finds the staging section by its exact heading and the flag by its
 * exact key, so a block written here that the tool cannot recognise is a block
 * nobody can ever clear. If you change one, change both.
 *
 * ---- what it does not do ---------------------------------------------------
 *
 * It stages; it does not correct. The gap is cut out of `## Gaps` and moved
 * verbatim into the staging section beside the answer, the page is flagged, and
 * that is the end of it. Rewriting the page around the answer and cascading
 * into every page that inherited the gap needs judgement across the whole
 * corpus — a text box cannot do it and should not pretend to. What this
 * guarantees is that the answer is captured at the moment it exists.
 *
 * `date_modified` is deliberately left alone. The page has not been corrected
 * yet, and bumping it would clear the staleness warnings on every page that
 * reasons from this one — the move wiki-brain's CLAUDE.md §3 forbids.
 */

export type Gap = {
  /** The gap exactly as the page states it, including its bullet and indentation. */
  text: string
  /** One line, links unwrapped, for the list. */
  label: string
}

export type GapPage = {
  slug: string
  domain: string
  title: string
  /** Date an answer was staged here, or null. */
  staged: string | null
  gaps: Gap[]
}

export type GapIndex = {
  generatedAt: string
  counts: { open: number; pages: number; staged: number }
  pages: GapPage[]
}

const url = () => `${import.meta.env.BASE_URL}wiki/gaps.json`.replace(/\/{2,}/g, '/')

let cache: Promise<GapIndex> | null = null

export function loadGaps(): Promise<GapIndex> {
  cache ??= fetch(url()).then((r) => {
    if (!r.ok) throw new Error(`no gaps dataset on this deploy (${r.status}) — run npm run wiki`)
    return r.json() as Promise<GapIndex>
  })
  return cache
}

/** Forget the fetched list, so a save is followed by fresh counts. */
export function invalidate() {
  cache = null
}

// ---------------------------------------------------------------------------
// the transform

export const SECTION = '## Operator answers — pending ingest'
export const FLAG = 'pending_ingest'

const GAP_HEAD = /^(#{2,3})\s+(gaps?\b|notes\s+(and|&)\s+gaps\b|corpus gaps\b|open questions\b)/i

const PREAMBLE = [
  '> Transient staging, written from the portal. Each block below is the',
  '> operator answering something this page said it did not know. **Nothing here',
  '> has been integrated yet.** The next pass over this page reads these answers,',
  '> corrects this page *and every page that inherited the gap*, records each',
  // Without its asterisks on purpose: bin/wiki-digest scans every page for a
  // literal `**GAP CLOSED`, and an instruction to write one would be counted by
  // RECENT.md as a gap that had actually been closed.
  '> result inline as a `GAP CLOSED [date]` blockquote per STYLE_GUIDE rule 9,',
  '> bumps `date_modified`, then runs `bin/wiki-gaps clear <page>` to delete this',
  '> section and the `pending_ingest:` flag. It is not allowed to accumulate into',
  '> a changelog — STYLE_GUIDE rule 6.',
]

const today = () => new Date().toISOString().slice(0, 10)

const clip = (s: string, n: number) => (s.length <= n ? s : `${s.slice(0, n - 1).trimEnd()}…`)

const slugify = (text: string) =>
  text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 44).replace(/-$/, '') || 'note'

/**
 * The `raw/` capture an answer is filed as — permanent T0 evidence.
 *
 * The staging block on the page is scaffolding: `bin/wiki-gaps clear` deletes
 * it once the answer has been worked in. Without this the operator's actual
 * words would go with it. Same capture-note format the rest of `raw/` uses, and
 * it carries `targets:`, which `bin/ingest-pack` already understands.
 */
export function capture(
  slug: string,
  domain: string,
  gap: Gap | null,
  answer: string,
): { path: string; text: string } {
  const now = new Date()
  const p2 = (n: number) => String(n).padStart(2, '0')
  const stamp =
    `${now.getFullYear()}-${p2(now.getMonth() + 1)}-${p2(now.getDate())}_` +
    `${p2(now.getHours())}${p2(now.getMinutes())}${p2(now.getSeconds())}`
  const name = slug.split('/').pop() ?? slug
  const lines = [
    '---',
    `captured: ${now.getFullYear()}-${p2(now.getMonth() + 1)}-${p2(now.getDate())} ${p2(now.getHours())}:${p2(now.getMinutes())}`,
    `title: gap answer — ${clip(gap ? gap.label : name, 60)}`,
    'type: fact',
    'tags: []',
    'source: portal-gaps',
    `targets: [wiki/${slug}]`,
    '---',
    '',
  ]
  if (gap) {
    lines.push(`THE GAP, as wiki/${slug} stated it:`, '')
    for (const line of gap.text.split('\n')) lines.push(`  ${line}`.trimEnd())
    lines.push('')
  } else {
    lines.push(`Volunteered by the operator — not an answer to a listed gap on wiki/${slug}.`, '')
  }
  lines.push('THE ANSWER (verbatim):', '')
  return {
    path: `raw/${domain}/captures/${stamp}_gap-${slugify(name)}.md`,
    text: `${lines.join('\n')}\n${answer.trim()}\n`,
  }
}

/** Every gaps-section span in a body, as [heading, end) line indices. */
function gapSections(lines: string[]): [number, number][] {
  const spans: [number, number][] = []
  for (let i = 0; i < lines.length; i++) {
    const head = lines[i].match(GAP_HEAD)
    if (!head) continue
    const level = head[1].length
    let end = lines.length
    for (let j = i + 1; j < lines.length; j++) {
      const h = lines[j].match(/^(#+)\s/)
      if (h && h[1].length <= level) {
        end = j
        break
      }
    }
    spans.push([i, end])
  }
  return spans
}

/**
 * Cut a gap out of its section and stage it with the answer.
 *
 * The gap is located by matching its exact text rather than by a line number,
 * because the dataset is baked at sync time and the page may have been edited
 * since. A gap that cannot be found is reported rather than guessed at — the
 * alternative is cutting the wrong paragraph out of a page.
 */
export function stage(
  body: string,
  gap: Gap | null,
  answer: string,
  /** The `raw/` path the answer was filed to, cited in the block. */
  source?: string,
): { body: string; error?: string } {
  const lines = body.split('\n')

  if (gap) {
    const want = gap.text.split('\n')
    let at = -1
    for (const [head, end] of gapSections(lines)) {
      for (let i = head + 1; i + want.length <= end; i++) {
        if (want.every((line, k) => lines[i + k] === line)) {
          at = i
          break
        }
      }
      if (at >= 0) break
    }
    if (at < 0) {
      return {
        body,
        error: 'that gap is not on the page any more — it was edited since this list was built',
      }
    }

    let hi = at + want.length
    // take one trailing blank with it, so the section does not fill up with holes
    while (hi < lines.length && !lines[hi].trim() && (hi + 1 >= lines.length || !lines[hi + 1].trim())) hi++
    lines.splice(at, hi - at)

    // an emptied section says so rather than sitting as a bare heading
    for (const [head, end] of gapSections(lines)) {
      if (!lines.slice(head + 1, end).some((l) => l.trim())) {
        lines.splice(head + 1, end - head - 1, '', '_All recorded gaps have been answered and are staged below._', '')
        break
      }
    }
  }

  const block: string[] = []
  if (gap) {
    block.push(`### ANSWERED [${today()}] — ${clip(gap.label, 72)}`, '', '**The gap, as this page stated it:**', '')
    for (const line of gap.text.split('\n')) block.push(`> ${line}`.trimEnd())
  } else {
    block.push(
      `### ANSWERED [${today()}] — manual note`,
      '',
      '**Not from the gap list** — volunteered by the operator, so the ingest',
      'has to work out for itself where on the page it belongs, and whether it',
      'contradicts something already there.',
    )
  }
  block.push(
    '',
    source
      ? `**Operator's answer — verbatim, first person, T0.** Filed at \`${source}\`.`
      : "**Operator's answer — verbatim, first person, T0.**",
    '',
    ...answer.trim().split('\n'),
    '',
  )

  const head = lines.findIndex((l) => l.trimEnd() === SECTION)
  if (head < 0) {
    while (lines.length && !lines[lines.length - 1].trim()) lines.pop()
    lines.push('', SECTION, '', ...PREAMBLE, '', ...block)
  } else {
    // append inside the existing section, after its last non-blank line
    let end = lines.length
    for (let j = head + 1; j < lines.length; j++) {
      if (/^#{1,2}\s/.test(lines[j])) {
        end = j
        break
      }
    }
    while (end > head && !lines[end - 1].trim()) end--
    lines.splice(end, 0, '', ...block)
  }

  return { body: lines.join('\n').replace(/\n+$/, '\n') }
}

/**
 * Add or refresh `pending_ingest:` in the frontmatter text.
 *
 * Placed straight after `date_modified` — always present, always one line — so
 * the marker sits by the dates a maintainer already reads and never lands
 * inside a multi-line `connections:` or `infobox:` block.
 */
export function flag(frontmatter: string): string {
  const lines = frontmatter.split('\n')
  const at = lines.findIndex((l) => new RegExp(`^${FLAG}:`).test(l))
  const line = `${FLAG}: ${today()}`
  if (at >= 0) {
    lines[at] = line
    return lines.join('\n')
  }
  const anchor = lines.findIndex((l) => /^date_modified:/.test(l))
  const fallback = lines.findIndex((l) => /^status:/.test(l))
  const insert = anchor >= 0 ? anchor + 1 : fallback >= 0 ? fallback + 1 : lines.length
  lines.splice(insert, 0, line)
  return lines.join('\n')
}
