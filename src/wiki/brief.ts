/**
 * Reads the wiki's compressed blocks — the "LLM Quick Brief" sections and
 * their kin — and pulls the structure back out of them.
 *
 * A brief is a paragraph written for a machine to swallow whole: a decade of
 * dates, a dozen people and every load-bearing number packed into six
 * sentences with no line breaks. It is the densest, least readable thing on
 * the page, and it is usually the most important. Everything here exists to
 * turn that wall back into facets a person can scan — a timeline, a cast, the
 * figures, the state — without discarding a word of the original text, which
 * the visualiser keeps one toggle away.
 *
 * Nothing in this file knows about React; it is a pure text→shape pass.
 */

export type StatusTone = 'good' | 'warning' | 'serious' | 'critical'

/** A date mentioned in the brief, resolved far enough to plot. */
export type BriefDate = {
  /** Cleaned for display, e.g. "Jul 23–26 2026". */
  label: string
  /** Fractional years, so a day and a decade sit on the same axis. */
  start: number
  end: number
  precision: 'day' | 'month' | 'year' | 'span'
  /** Index of the fact this date came out of. */
  fact: number
}

/** A number worth lifting out of the prose and setting large. */
export type BriefFigure = {
  value: string
  /** The words the number was carrying, e.g. "row message corpus". */
  label: string
  fact: number
}

/** A state word: closed, active, unresolved, in transition. */
export type BriefFlag = {
  label: string
  tone: StatusTone
  fact: number
}

/** A page the brief points at. */
export type BriefEntity = {
  slug: string
  label: string
  domain: string
  mentions: number
  /** Which facts named it, so the cast lights up with the sentence. */
  facts: number[]
}

export type FactKind = 'status' | 'time' | 'figure' | 'link' | 'note'

/** One sentence of the brief, standing on its own. */
export type BriefFact = {
  index: number
  /** Markdown, wiki links intact. */
  text: string
  kind: FactKind
}

export type Brief = {
  /** The heading the block was found under, e.g. "LLM Quick Brief". */
  heading: string
  /** Anchor id of that heading, so the contents rail still lands here. */
  id: string
  /** The lead-in that was stripped off, e.g. "For context injection:". */
  lede: string | null
  /** The block as written, minus the heading. */
  source: string
  facts: BriefFact[]
  dates: BriefDate[]
  figures: BriefFigure[]
  flags: BriefFlag[]
  entities: BriefEntity[]
  words: number
}

// ---------------------------------------------------------------------------
// finding the block

/** Headings whose bodies are written compressed rather than for reading. */
const BRIEF_HEADING = /(quick brief|context injection|tl;?\s?dr|at a glance|in brief)/i

export const headingId = (text: string) =>
  text.toLowerCase().replace(/[^\w]+/g, '-').replace(/^-|-$/g, '') || 'section'

export type Segment = { kind: 'markdown'; text: string } | { kind: 'brief'; brief: Brief }

/**
 * Splits a page body into ordinary markdown and brief blocks, in order.
 *
 * A brief runs from its heading to the next heading of the same or shallower
 * depth (a `---` rule ends it too — the wiki uses one to fence these off).
 * Fenced code is skipped so a `## TL;DR` inside a sample never matches.
 */
export function segmentBriefs(source: string): Segment[] {
  const lines = source.split('\n')
  const segments: Segment[] = []
  let plainFrom = 0
  let fenced = false

  for (let i = 0; i < lines.length; i++) {
    if (/^\s*(```|~~~)/.test(lines[i])) fenced = !fenced
    if (fenced) continue

    const heading = lines[i].match(/^(#{2,4})\s+(.*\S)\s*$/)
    if (!heading || !BRIEF_HEADING.test(heading[2])) continue

    const depth = heading[1].length
    let end = lines.length
    for (let j = i + 1; j < lines.length; j++) {
      const next = lines[j].match(/^(#{1,6})\s+\S/)
      if (next && next[1].length <= depth) {
        end = j
        break
      }
      if (/^\s*(---|\*\*\*|___)\s*$/.test(lines[j])) {
        end = j
        break
      }
    }

    const body = lines.slice(i + 1, end).join('\n').trim()
    const brief = body ? parseBrief(heading[2], body) : null
    // A block with nothing to lift out reads better as the prose it already is.
    if (!brief) continue

    if (i > plainFrom) segments.push({ kind: 'markdown', text: lines.slice(plainFrom, i).join('\n') })
    segments.push({ kind: 'brief', brief })
    plainFrom = end
    i = end - 1
  }

  if (plainFrom < lines.length) {
    const tail = lines.slice(plainFrom).join('\n')
    if (tail.trim()) segments.push({ kind: 'markdown', text: tail })
  }
  return segments
}

// ---------------------------------------------------------------------------
// dates

const MONTHS = [
  'january', 'february', 'march', 'april', 'may', 'june',
  'july', 'august', 'september', 'october', 'november', 'december',
]
const MONTH_RE = '(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\\.?'
const monthIndex = (word: string) => {
  const key = word.toLowerCase().replace(/\.$/, '')
  return MONTHS.findIndex((m) => m.startsWith(key.slice(0, 3)))
}

const SHORT_MONTH = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** Fractional years, so 1988-11-01 and "the 2010s" share one axis. */
const asYear = (y: number, m = 1, d = 1) => y + (m - 1) / 12 + (d - 1) / 365

/** A year on its own is a whole year wide; a day is a day wide. */
const DASH = '[–—-]'

type Matcher = { re: RegExp; read: (m: RegExpExecArray) => Omit<BriefDate, 'fact'> | null }

/** Ordered most-specific first; earlier patterns consume the text. */
const DATE_MATCHERS: Matcher[] = [
  // 2015–June 1 2026 — a year opening onto a full date
  {
    re: new RegExp(
      `(?<![\\d,.])((?:19|20)\\d{2})\\s*${DASH}\\s*(?:${MONTH_RE}\\s+(\\d{1,2}),?\\s+)?((?:19|20)\\d{2})(?![\\d])`,
      'gi',
    ),
    read: (m) => {
      const [y1, y2] = [+m[1], +m[4]]
      if (y2 < y1) return null
      const mo = m[2] ? monthIndex(m[2]) : -1
      return {
        label: mo >= 0 ? `${y1}–${SHORT_MONTH[mo]} ${m[3]} ${y2}` : `${y1}–${y2}`,
        start: asYear(y1),
        end: mo >= 0 ? asYear(y2, mo + 1, +m[3]) : asYear(y2) + 1,
        precision: 'span',
      }
    },
  },
  // 1988-11-01
  {
    re: /(?<![\d,.])((?:19|20)\d{2})-(\d{2})-(\d{2})(?![\d])/g,
    read: (m) => {
      const [y, mo, d] = [+m[1], +m[2], +m[3]]
      if (mo < 1 || mo > 12 || d < 1 || d > 31) return null
      return {
        label: `${SHORT_MONTH[mo - 1]} ${d} ${y}`,
        start: asYear(y, mo, d),
        end: asYear(y, mo, d),
        precision: 'day',
      }
    },
  },
  // July 23–26, 2026
  {
    re: new RegExp(`\\b${MONTH_RE}\\s+(\\d{1,2})\\s*${DASH}\\s*(\\d{1,2}),?\\s+((?:19|20)\\d{2})`, 'gi'),
    read: (m) => {
      const mo = monthIndex(m[1])
      if (mo < 0) return null
      const y = +m[4]
      return {
        label: `${SHORT_MONTH[mo]} ${m[2]}–${m[3]} ${y}`,
        start: asYear(y, mo + 1, +m[2]),
        end: asYear(y, mo + 1, +m[3]),
        precision: 'span',
      }
    },
  },
  // November 1, 1988 · Feb 17 2010
  {
    re: new RegExp(`\\b${MONTH_RE}\\s+(\\d{1,2}),?\\s+((?:19|20)\\d{2})`, 'gi'),
    read: (m) => {
      const mo = monthIndex(m[1])
      if (mo < 0) return null
      const y = +m[3]
      return {
        label: `${SHORT_MONTH[mo]} ${m[2]} ${y}`,
        start: asYear(y, mo + 1, +m[2]),
        end: asYear(y, mo + 1, +m[2]),
        precision: 'day',
      }
    },
  },
  // Aug 2025–Mar 2026
  {
    re: new RegExp(
      `\\b${MONTH_RE}\\s+((?:19|20)\\d{2})\\s*${DASH}\\s*${MONTH_RE}\\s+((?:19|20)\\d{2})`,
      'gi',
    ),
    read: (m) => {
      const [a, b] = [monthIndex(m[1]), monthIndex(m[3])]
      if (a < 0 || b < 0) return null
      const [y1, y2] = [+m[2], +m[4]]
      return {
        label: `${SHORT_MONTH[a]} ${y1}–${SHORT_MONTH[b]} ${y2}`,
        start: asYear(y1, a + 1),
        end: asYear(y2, b + 1),
        precision: 'span',
      }
    },
  },
  // autumn 2024 · June 2026
  {
    re: new RegExp(`\\b${MONTH_RE}\\s+((?:19|20)\\d{2})`, 'gi'),
    read: (m) => {
      const mo = monthIndex(m[1])
      if (mo < 0) return null
      const y = +m[2]
      return {
        label: `${SHORT_MONTH[mo]} ${y}`,
        start: asYear(y, mo + 1),
        end: asYear(y, mo + 1) + 1 / 12,
        precision: 'month',
      }
    },
  },
  // July 4 · Aug 2 — a day with no year, which the surrounding brief already fixed
  {
    re: new RegExp(`\\b${MONTH_RE}\\s+(\\d{1,2})(?!\\s*[,\\d])`, 'gi'),
    read: () => null,
  },
  // 2 August, 26 July
  {
    re: new RegExp(`\\b(\\d{1,2})\\s+${MONTH_RE}\\b`, 'gi'),
    read: () => null,
  },
  // 11:18 PM, 05:04 — clock times are never quantities
  {
    re: /\b\d{1,2}:\d{2}\s*(?:[ap]\.?m\.?)?/gi,
    read: () => null,
  },
  // 2015–2026 · 2004-05 · 2018–2024
  {
    re: new RegExp(`(?<![\\d,.])((?:19|20)\\d{2})\\s*${DASH}\\s*((?:19|20)?\\d{2})(?![\\d])`, 'g'),
    read: (m) => {
      const y1 = +m[1]
      // "2004-05" is shorthand for 2004–2005.
      const y2 = m[2].length === 2 ? Math.floor(y1 / 100) * 100 + +m[2] : +m[2]
      if (y2 < y1 || y2 > y1 + 120) return null
      return {
        label: `${y1}–${y2}`,
        start: asYear(y1),
        end: asYear(y2) + 1,
        precision: 'span',
      }
    },
  },
  // a bare 2026
  {
    re: /(?<![\d,.\-–—/])((?:19|20)\d{2})(?![\d\-–—/]|\s*(?:rows?|words?|messages?))/g,
    read: (m) => ({
      label: m[1],
      start: asYear(+m[1]),
      end: asYear(+m[1]) + 1,
      precision: 'year',
    }),
  },
]

/**
 * Every date in one string, most-specific pattern winning any overlap.
 * Returns them in order of appearance, with the character span they covered
 * so the number scan can skip over them.
 */
function scanDates(text: string) {
  const taken: [number, number][] = []
  const found: (Omit<BriefDate, 'fact'> & { at: number })[] = []
  const overlaps = (a: number, b: number) => taken.some(([s, e]) => a < e && b > s)

  for (const { re, read } of DATE_MATCHERS) {
    re.lastIndex = 0
    let m: RegExpExecArray | null
    while ((m = re.exec(text))) {
      const [start, end] = [m.index, m.index + m[0].length]
      if (overlaps(start, end)) continue
      // Claimed either way: a matcher that reads null (a clock time, a day
      // with no year) exists precisely to keep that text out of the figures.
      taken.push([start, end])
      const parsed = read(m)
      if (parsed) found.push({ ...parsed, at: start })
    }
  }

  found.sort((a, b) => a.at - b.at)
  return { dates: found, taken }
}

// ---------------------------------------------------------------------------
// figures

/** Words that carry no meaning as a figure's label. */
const STOP = new Set([
  'as', 'of', 'in', 'on', 'at', 'by', 'to', 'and', 'or', 'but', 'the', 'a', 'an', 'for', 'from',
  'with', 'is', 'was', 'were', 'are', 'that', 'which', 'who', 'after', 'before', 'since', 'until',
  'his', 'her', 'their', 'its', 'it', 'he', 'she', 'they', 'this', 'these', 'then', 'so',
  'vs', 'per', 'over', 'under', 'about', 'into', 'out', 'up', 'down', 'more', 'less', 'than',
])

/**
 * Single-word units that make a bare number mean something on its own. A
 * number whose label is not one of these, is not a phrase, and carries no
 * unit marker is a percentile or a house number — true, but not a statistic,
 * and a stat row full of them says nothing.
 */
const UNITS = new Set([
  'age', 'years', 'year', 'months', 'month', 'weeks', 'week', 'days', 'day', 'hours', 'hour',
  'minutes', 'minute', 'messages', 'message', 'rows', 'row', 'words', 'word', 'pages', 'page',
  'people', 'times', 'entries', 'photos', 'texts', 'calls', 'songs', 'tracks', 'albums',
])

const credible = (f: { value: string; label: string }) =>
  f.label.includes(' ') || UNITS.has(f.label) || /[,+%$]/.test(f.value)

/** Numbers that are only ever ordinals or list noise. */
const isRankish = (label: string) => /^(st|nd|rd|th)\b/.test(label)

/**
 * Lifts the quantities out of a sentence.
 *
 * The label a number carries has to be lowercase: a capitalised word after a
 * number is an address or a proper noun ("337 Saratoga", "26 July"), not a
 * unit, and setting those as figures is how a stat row fills up with things
 * that are not statistics.
 */
function scanFigures(text: string, taken: [number, number][]): Omit<BriefFigure, 'fact'>[] {
  const out: Omit<BriefFigure, 'fact'>[] = []
  // A trailing comma belongs to the sentence, not the number, and "13–15" is
  // one quantity rather than two.
  const re = /(?<![\w.,–—-])(\$?\d(?:[\d,]*\d)?(?:\.\d+)?(?:\s*[–—]\s*\d(?:[\d,]*\d)?)?\+?%?)(?![\w])/g
  let m: RegExpExecArray | null

  while ((m = re.exec(text))) {
    const [start, end] = [m.index, m.index + m[0].length]
    if (taken.some(([s, e]) => start < e && end > s)) continue

    // Walk right through the words the number is carrying: "52 days",
    // "181,585-row message corpus", "15+ years".
    const words: string[] = []
    const tail = text.slice(end).match(/^[-\s]([a-z][\w'-]*(?:[-\s][a-z][\w'-]*){0,2})/)
    if (tail) {
      for (const word of tail[1].split(/\s+/)) {
        // A joining word ends the label — past it the sentence has moved on.
        if (STOP.has(word.toLowerCase())) break
        words.push(word)
      }
    }

    let label = words.join(' ')
    if (!label) {
      // Nothing after it — the word in front usually names it ("Age 37").
      const before = text.slice(0, start).match(/([A-Za-z][\w'-]*)\s+$/)
      if (before && !STOP.has(before[1].toLowerCase())) label = before[1]
    }
    const figure = { value: m[1].replace(/\s*([–—])\s*/, '$1'), label: label.trim().toLowerCase() }
    // A sum of money says what it is unaided; nothing else does.
    if (!figure.label && !/^\$/.test(figure.value)) continue
    if (isRankish(figure.label) || !credible(figure)) continue

    out.push(figure)
  }
  return out
}

/**
 * The stat row seats four. Prefer the figures that are actually carrying
 * something — a described unit, a thousands separator, a "+" — over a bare
 * count that happened to appear first.
 */
const figureScore = (f: BriefFigure) =>
  f.label.split(' ').length + (/[,+%$]/.test(f.value) ? 2 : 0) + (f.value.length > 3 ? 1 : 0)

export const topFigures = (figures: BriefFigure[], limit = 4) =>
  [...figures]
    .map((f, order) => ({ f, order }))
    .sort((a, b) => figureScore(b.f) - figureScore(a.f) || a.order - b.order)
    .slice(0, limit)
    .sort((a, b) => a.order - b.order)
    .map(({ f }) => f)

// ---------------------------------------------------------------------------
// state words

/** "not closed", "no longer severed" — the word is there, the state is not. */
const NEGATED = /\b(not|no longer|never|nor|without being)\s+$/i

/**
 * Ordered worst-first, and matches are consumed: "not live" is one critical
 * flag, not a critical one plus a stray "live" reading as healthy.
 */
const FLAGS: { re: RegExp; tone: StatusTone }[] = [
  {
    re: /\b(not live|closed|terminated|severed|collapsed|deceased|defunct)\b/gi,
    tone: 'critical',
  },
  {
    re: /\b(unresolved|open|in (?:active )?transition|disputed|contested|at risk|unfinished)\b/gi,
    tone: 'warning',
  },
  {
    re: /\b(corrected|superseded|stale|inferred|unverified|low-certainty|self-identified)\b/gi,
    tone: 'serious',
  },
  { re: /\b(active|ongoing|live|stable)\b/gi, tone: 'good' },
]

function scanFlags(text: string): Omit<BriefFlag, 'fact'>[] {
  const out: Omit<BriefFlag, 'fact'>[] = []
  const taken: [number, number][] = []
  for (const { re, tone } of FLAGS) {
    re.lastIndex = 0
    let m: RegExpExecArray | null
    while ((m = re.exec(text))) {
      const [start, end] = [m.index, m.index + m[0].length]
      if (taken.some(([s, e]) => start < e && end > s)) continue
      taken.push([start, end])
      // "not live" is itself a state; anything else under a negation is not
      // a claim about the state at all, so it stays out of the flag row.
      if (m[1].toLowerCase() !== 'not live' && NEGATED.test(text.slice(0, start))) continue
      out.push({ label: m[1].toLowerCase().replace(/\s+/g, ' '), tone })
    }
  }
  return out
}

// ---------------------------------------------------------------------------
// links

const WIKILINK = /\[\[([^\]|]+)(?:\|([^\]]*))?\]\]/g

const humanizeSlug = (slug: string) => {
  const parts = slug.split('/')
  // ".../psychosexual/index" reads as "Psychosexual", not "Index".
  const leaf = parts[parts.length - 1] === 'index' && parts.length > 1 ? parts[parts.length - 2] : parts.pop()!
  return leaf.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

type EntityHit = Pick<BriefEntity, 'slug' | 'label' | 'domain'>

function scanEntities(text: string): EntityHit[] {
  const out: EntityHit[] = []
  WIKILINK.lastIndex = 0
  let m: RegExpExecArray | null
  while ((m = WIKILINK.exec(text))) {
    const slug = m[1].trim().replace(/^wiki\//, '').replace(/\.md$/, '')
    if (!slug) continue
    out.push({
      slug,
      label: (m[2]?.trim() || humanizeSlug(slug)).replace(/\s+/g, ' '),
      domain: slug.split('/')[0],
    })
  }
  return out
}

// ---------------------------------------------------------------------------
// sentences

/**
 * Splits a brief into sentence-sized facts.
 *
 * Briefs are written as one runaway paragraph, so the sentence is the only
 * natural seam. A break needs terminal punctuation followed by something that
 * starts a sentence — which keeps "Nov. 1", "e.g." and "05:04 July 26" whole.
 */
const ABBREV =
  /\b(b|d|c|ca|approx|est|no|vs|etc|e\.g|i\.e|mr|mrs|ms|dr|prof|st|ave|rd|jr|sr|jan|feb|mar|apr|jun|jul|aug|sept?|oct|nov|dec)\.$/i

function splitSentences(text: string): string[] {
  const parts: string[] = []
  let current = ''
  const chars = [...text]

  for (let i = 0; i < chars.length; i++) {
    current += chars[i]
    if (!'.!?'.includes(chars[i])) continue
    const rest = text.slice(i + 1)
    // Terminal punctuation may be followed by a closing quote or bracket.
    const gap = rest.match(/^["'”’)\]]*\s+/)
    if (!gap) continue
    const next = rest.slice(gap[0].length)
    if (!/^[*_[("“'A-Z0-9]/.test(next)) continue
    // An initial ("D. Frank") or an abbreviation ("b. 1988") is not the end
    // of a sentence, however capital the next word looks.
    if (/(^|\s)[A-Za-z]$/.test(current.slice(0, -1))) continue
    if (ABBREV.test(current)) continue
    current += gap[0]
    parts.push(current.trim())
    current = ''
    i += gap[0].length
  }
  if (current.trim()) parts.push(current.trim())
  return parts.filter(Boolean).flatMap(breakLongClauses)
}

const wordsIn = (s: string) => s.split(/\s+/).filter(Boolean).length

/**
 * Briefs stack whole arguments into one sentence with semicolons. Past about
 * forty words a card stops being a card, so a long sentence is cut at its
 * semicolons — but only where both sides still stand up as statements.
 */
function breakLongClauses(sentence: string): string[] {
  if (wordsIn(sentence) < 45 || !sentence.includes(';')) return [sentence]
  const parts: string[] = []
  let current = ''
  for (const chunk of sentence.split(/;\s+/)) {
    current = current ? `${current}; ${chunk}` : chunk
    if (wordsIn(current) >= 12) {
      parts.push(current)
      current = ''
    }
  }
  if (current) {
    if (wordsIn(current) < 12 && parts.length) parts[parts.length - 1] += `; ${current}`
    else parts.push(current)
  }
  return parts
}

const classify = (
  has: { dates: boolean; figures: boolean; flags: boolean; entities: boolean },
): FactKind => {
  if (has.flags) return 'status'
  if (has.dates) return 'time'
  if (has.figures) return 'figure'
  if (has.entities) return 'link'
  return 'note'
}

// ---------------------------------------------------------------------------

/** The lead-in the wiki uses to mark a block as machine-facing. */
const LEDE = /^\s*(?:\*\*|__)?\s*(for context injection|context|summary|tl;?\s?dr|brief)\s*:?\s*(?:\*\*|__)?\s*:?\s*/i

/**
 * Turns a brief block into its facets. Returns null when the block is not
 * actually compressed — a list of links or a two-word note gains nothing from
 * being visualised and should stay the markdown it is.
 */
export function parseBrief(heading: string, body: string): Brief | null {
  const source = body.trim()
  if (!source) return null

  const lines = source.split('\n').filter((l) => l.trim())
  // A table is already a structure, and the chart pass has a better claim on
  // it; a list is already scannable. Neither is the wall this exists to open.
  if (lines.some((l) => l.trim().startsWith('|'))) return null
  if (lines.filter((l) => /^\s*([-*+]|\d+\.)\s/.test(l)).length > lines.length / 2) return null

  const ledeMatch = source.match(LEDE)
  const lede = ledeMatch ? ledeMatch[1].replace(/\s+/g, ' ') : null
  const prose = ledeMatch ? source.slice(ledeMatch[0].length) : source

  const words = prose.split(/\s+/).filter(Boolean).length
  if (words < 40) return null

  const facts: BriefFact[] = []
  const dates: BriefDate[] = []
  const figures: BriefFigure[] = []
  const flags: BriefFlag[] = []
  const entityHits: (EntityHit & { fact: number })[] = []

  splitSentences(prose.replace(/\s*\n\s*/g, ' ')).forEach((sentence, index) => {
    // Facets read the plain text; links would otherwise leak slugs into labels.
    const plain = sentence
      .replace(WIKILINK, (_a, target: string, label?: string) => label?.trim() || humanizeSlug(target))
      .replace(/`([^`]*)`/g, '$1')

    const { dates: found, taken } = scanDates(plain)
    const figured = scanFigures(plain, taken)
    const flagged = scanFlags(plain)
    const linked = scanEntities(sentence)

    for (const d of found) dates.push({ ...d, fact: index })
    for (const f of figured) figures.push({ ...f, fact: index })
    for (const f of flagged) flags.push({ ...f, fact: index })
    for (const e of linked) entityHits.push({ ...e, fact: index })

    facts.push({
      index,
      text: sentence,
      kind: classify({
        dates: found.length > 0,
        figures: figured.length > 0,
        flags: flagged.length > 0,
        entities: linked.length > 0,
      }),
    })
  })

  // A brief with no facets at all is just a paragraph.
  if (!dates.length && !figures.length && !flags.length && !entityHits.length) return null

  const entities: BriefEntity[] = []
  for (const hit of entityHits) {
    const existing = entities.find((e) => e.slug === hit.slug)
    if (existing) {
      existing.mentions++
      if (!existing.facts.includes(hit.fact)) existing.facts.push(hit.fact)
    } else {
      entities.push({ slug: hit.slug, label: hit.label, domain: hit.domain, mentions: 1, facts: [hit.fact] })
    }
  }

  return {
    heading,
    id: headingId(heading),
    lede,
    source,
    facts,
    dates: dedupeDates(dates),
    figures: dedupeFigures(figures),
    flags: dedupeFlags(flags),
    entities,
    words,
  }
}

/** The same date said twice is one point on the rail. */
function dedupeDates(dates: BriefDate[]) {
  const seen = new Map<string, BriefDate>()
  for (const d of dates) {
    const key = `${d.start}:${d.end}`
    const prior = seen.get(key)
    // Keep the version that says the most (a labelled span over a bare year).
    if (!prior || d.label.length > prior.label.length) seen.set(key, prior ? { ...d, fact: prior.fact } : d)
  }
  return [...seen.values()].sort((a, b) => a.start - b.start || a.end - b.end)
}

function dedupeFigures(figures: BriefFigure[]) {
  const labelled = new Set(figures.filter((f) => f.label).map((f) => f.value))
  const seen = new Set<string>()
  return figures.filter((f) => {
    // The same sum said twice, once in passing, is one figure.
    if (!f.label && labelled.has(f.value)) return false
    // "within 24 hours ... the 24-hour switch" is one fact restating itself.
    const withinFact = `${f.fact}|${f.value}`
    if (seen.has(withinFact)) return false
    const key = `${f.value}|${f.label}`
    if (seen.has(key)) return false
    seen.add(key)
    seen.add(withinFact)
    return true
  })
}

function dedupeFlags(flags: BriefFlag[]) {
  const seen = new Set<string>()
  return flags.filter((f) => {
    if (seen.has(f.label)) return false
    seen.add(f.label)
    return true
  })
}
