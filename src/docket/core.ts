/**
 * THE DOCKET — the core.
 *
 * A docket is a court's list of matters that have not been decided. This one is
 * the wiki's, and it is built from the wiki's own admissions: the collisions it
 * is holding rather than resolving, the gaps it writes down where it does not
 * know, the falsifiable bets it has left standing, and the dated blocks where a
 * doubt actually got closed.
 *
 * ---- why this is a room and not an instrument -------------------------------
 *
 * LEVIATHAN counts. Every instrument in that rack answers "how much" over one
 * corpus, and THE RULE there forbids a judgement because a count that has been
 * weighted is a portrait of an argument. Nothing on this floor is counted.
 * Every item is a span of prose the wiki wrote about itself, lifted whole and
 * attributed — the argument *is* the content, and abbreviating one to a number
 * would be the thing that destroys it.
 *
 * What the two rooms share is that neither one gets to decide anything. THE
 * DOCKET does not resolve a collision, rank a gap, or score a prediction. It
 * lists what is outstanding, in the wiki's own words, with the date it was
 * raised and the page that raised it, and it is quiet about which ones matter.
 *
 * ---- the one number this room is proud of -----------------------------------
 *
 * 443 rulings. A list of everything a body of work does not know is a
 * complaint; the same list next to a dated record of the doubts it has already
 * closed is a machine with a work rate. THE RULINGS is the bench that decides
 * which of the two this room is, and it is why it is here rather than being
 * left as a fourth tab on a page about gaps.
 */
import { useEffect, useState } from 'react'

/* ==========================================================================
   THE DATASET — written by scripts/build-docket.mjs
   ========================================================================== */

/** A page anything on the docket points at, with its coordinates on the map. */
export type DocketPage = {
  title: string
  domain: string
  words: number
  /** The layout from /brain, reused rather than re-simulated. See Collisions. */
  x: number
  y: number
  /** False for a page named by a collision that the snapshot has never seen. */
  known: boolean
}

/** Two claims that cannot both be true, held rather than resolved. */
export type Collision = {
  id: string
  /** The page carrying the block. Both sides carry it, by convention. */
  page: string
  domain: string
  date: string | null
  /** The title the block gives itself after the em dash, where it gives one. */
  headline: string | null
  /** False once the block's own heading says CLOSED, RESOLVED or SETTLED. */
  open: boolean
  /** Every other page the block names. Empty on the 18 that name none. */
  against: string[]
  text: string
}

/** Something a page writes down that it does not know. */
export type Gap = {
  id: string
  page: string
  domain: string
  /** One line, links unwrapped and emphasis stripped. */
  label: string
  /** As written, with its sub-bullets. */
  text: string
}

/** A falsifiable claim, and whatever verdict it has been given so far. */
export type Prediction = {
  id: string
  page: string
  domain: string
  verdict: 'STANDING' | 'CONFIRMED' | 'FALSIFIED' | 'PARTIALLY FALSIFIED' | 'RESOLVED' | 'SCORED'
  claim: string
  /** The argument under the claim, where the item makes one. */
  rationale: string | null
  /** What would kill it — stated by 20 of the 68, and by none of the rest. */
  falsifier: string | null
  text: string
}

/** A dated block where the wiki recorded what happened to one of its claims. */
export type Ruling = {
  id: string
  page: string
  domain: string
  kind: RulingKind
  date: string | null
  headline: string | null
  text: string
}

export type RulingKind =
  | 'RE-CHECKED'
  | 'CORRECTED'
  | 'REVISED'
  | 'GAP CLOSED'
  | 'CONTRADICTION CLOSED'
  | 'RESOLVED'
  | 'DEADLINE ELAPSED'
  | 'RETRACTED'
  | 'SUPERSEDED'
  | 'CONFIRMED'
  | 'SETTLED'

export type DocketSet = {
  generatedAt: string
  /** Every page in the corpus as `[x, y, domain]` — the denominator, drawn faint. */
  field: [number, number, string][]
  counts: {
    corpusPages: number
    contradictions: number
    contradictionsClosed: number
    gaps: number
    predictions: number
    predictionsStanding: number
    rulings: number
    pages: number
    open: number
  }
  domains: {
    id: string
    contradictions: number
    gaps: number
    predictions: number
    rulings: number
    pages: number
  }[]
  pages: Record<string, DocketPage>
  contradictions: Collision[]
  gaps: Gap[]
  predictions: Prediction[]
  rulings: Ruling[]
}

/* ==========================================================================
   THE BENCHES
   ========================================================================== */

export type BenchId = 'collisions' | 'field' | 'board' | 'rulings'

export type Bench = {
  id: BenchId
  numeral: string
  title: string
  kana: string
  /** One line under the tab. What this bench is looking at. */
  blurb: string
  /** How the items got here, in one sentence. Every bench owes this. */
  method: string
}

export const BENCHES: Bench[] = [
  {
    id: 'collisions',
    numeral: 'I',
    title: 'THE COLLISIONS',
    kana: '衝突',
    blurb:
      'Two claims that cannot both be true, and neither one withdrawn. The wiki holds these open on purpose — a disagreement resolved by seniority is a disagreement lost.',
    method:
      'Every blockquote opening with a bold CONTRADICTION head, taken whole. The convention is that both pages carry the block, so a collision is an edge between the page holding it and every page it names inside it.',
  },
  {
    id: 'field',
    numeral: 'II',
    title: 'THE FIELD',
    kana: '空白',
    blurb:
      'Every gap the pages write down about themselves, one mark each. This is the shape of what is not known, and it is the only picture of it that exists.',
    method:
      'The `## Gaps` section of every page, and the five other headings that mean the same thing. A gap struck through or marked CLOSED, RESOLVED or SETTLED is not here — this wall shrinks only when something is actually settled.',
  },
  {
    id: 'board',
    numeral: 'III',
    title: 'THE BOARD',
    kana: '賭',
    blurb:
      'The bets. Every falsifiable claim the wiki has made about what happens next, with what would kill it where it said, and the three it has already scored against itself.',
    method:
      'Items under a predictions heading, with the falsifier cut off the end where the page states one. A section whose heading carries its own verdict is a scoring, not a prediction, and is filed as the one entry it is.',
  },
  {
    id: 'rulings',
    numeral: 'IV',
    title: 'THE RULINGS',
    kana: '裁定',
    blurb:
      'Where a doubt actually got closed. Dated, so it plots — this is the bench that decides whether the other three are a frontier or a graveyard.',
    method:
      'Every dated block a page uses to record what happened to it: RE-CHECKED, CORRECTED, REVISED, GAP CLOSED and six rarer ones. Each is kept whole, because the announcement is in the first line and the reasoning is in the second.',
  },
]

export const benchById = (id: string) => BENCHES.find((b) => b.id === id)

/* ==========================================================================
   THE VERDICT AND KIND PALETTES

   Both are reserved roles rather than series slots, the same way STATUS is in
   the wiki palette: a verdict must never be able to impersonate a domain, and
   every one of them ships with its word next to it. Colour is the third
   channel here and never the only one.
   ========================================================================== */

export const KIND_TONE: Record<string, string> = {
  'RE-CHECKED': '#00d5e8',
  CORRECTED: '#ff3ba7',
  REVISED: '#a86bff',
  'GAP CLOSED': '#3ddc84',
  'CONTRADICTION CLOSED': '#ffb020',
  RESOLVED: '#3ddc84',
  'DEADLINE ELAPSED': '#ff5c5c',
  RETRACTED: '#ff5c5c',
  SUPERSEDED: '#ffb020',
  CONFIRMED: '#3ddc84',
  SETTLED: '#3ddc84',
}

/** The order the legend and the stack read in — commonest first, and fixed. */
export const KIND_ORDER: RulingKind[] = [
  'RE-CHECKED',
  'CORRECTED',
  'REVISED',
  'GAP CLOSED',
  'RESOLVED',
  'CONTRADICTION CLOSED',
  'DEADLINE ELAPSED',
  'RETRACTED',
  'SUPERSEDED',
  'CONFIRMED',
  'SETTLED',
]

export const VERDICT_TONE: Record<string, string> = {
  STANDING: '#ffb020',
  CONFIRMED: '#3ddc84',
  RESOLVED: '#3ddc84',
  FALSIFIED: '#ff5c5c',
  'PARTIALLY FALSIFIED': '#ec835a',
  SCORED: '#00d5e8',
}

/** Domain kana, matching the set THE WEB and the wiki index already use. */
export const DOMAIN_KANA: Record<string, string> = {
  self: '自',
  timeline: '年',
  people: '人',
  mind: '心',
  work: '働',
  interests: '趣',
  health: '体',
  places: '場',
  legal: '法',
  meta: '元',
}

/* ==========================================================================
   THE LOADER
   ========================================================================== */

type Async<T> = { data: T | null; error: string | null; loading: boolean }

let cached: Promise<DocketSet> | null = null

/** One fetch per session. The room has four benches over one dataset. */
export function loadDocket(): Promise<DocketSet> {
  if (!cached) {
    const url = `${import.meta.env.BASE_URL}docket/docket.json`.replace(/([^:])\/{2,}/g, '$1/')
    cached = fetch(url).then((r) => {
      if (!r.ok) throw new Error(`no docket on this deploy (${r.status}) — run npm run docket`)
      return r.json() as Promise<DocketSet>
    })
    cached.catch(() => {
      cached = null
    })
  }
  return cached
}

export function useDocket(): Async<DocketSet> {
  const [state, setState] = useState<Async<DocketSet>>({ data: null, error: null, loading: true })
  useEffect(() => {
    let live = true
    loadDocket()
      .then((data) => live && setState({ data, error: null, loading: false }))
      .catch((e: Error) => live && setState({ data: null, error: e.message, loading: false }))
    return () => {
      live = false
    }
  }, [])
  return state
}

/* ==========================================================================
   SHARED SMALL THINGS
   ========================================================================== */

/** `mind/synthesis/the-cato-seat` → `THE CATO SEAT`, when there is no title. */
export const nameOf = (set: DocketSet, slug: string) =>
  set.pages[slug]?.title ?? slug.split('/').pop()?.replace(/-/g, ' ') ?? slug

/** `2026-08-18` → `18 AUG`. Undated items sort last and say so. */
const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC']
export function shortDate(iso: string | null) {
  if (!iso) return 'UNDATED'
  const [y, m, d] = iso.split('-')
  return `${Number(d)} ${MONTHS[Number(m) - 1]} ${y.slice(2)}`
}

/**
 * Markdown, to the small extent these spans use it, as React-safe segments.
 *
 * The corpus writes `**bold**`, `*italic*`, `` `code` `` and `[[wiki/slug]]`,
 * and a docket item is one to six paragraphs of exactly that. Running the
 * site's markdown library over 1,036 spans at mount is the wrong shape — this
 * is four inline forms, and a link that has to become a `<Link>` rather than an
 * `<a>` so the router keeps the navigation.
 */
export type Seg =
  | { t: 'text'; v: string }
  | { t: 'bi'; v: string }
  | { t: 'b'; v: string }
  | { t: 'i'; v: string }
  | { t: 'code'; v: string }
  | { t: 'link'; v: string; to: string }

/**
 * The five inline forms, in the order they have to be tried.
 *
 * `***…***` comes before `**…**` because it has to: matched second, the bold
 * arm eats the first two asterisks and leaves the third to print itself, which
 * is what was happening to the corpus's bold-italic quotations — the shape it
 * reserves for a line somebody actually said.
 *
 * The italic arm allows a single newline inside the span and refuses a blank
 * one. That is not fussiness: the corpus hard-wraps its prose at about
 * seventy-eight characters, so an italic quotation of any length has a line
 * break in the middle of it, and a `[^*\n]` body silently failed on every one
 * — printing the asterisks at the reader instead. Refusing the blank line is
 * what stops a stray opening `*` from italicising the next three paragraphs.
 */
const INLINE =
  /\[\[wiki\/([^\]|#]+?)(?:[|#]([^\]]*))?\]\]|\*\*\*([\s\S]+?)\*\*\*|\*\*([\s\S]+?)\*\*|(?<!\w)\*((?:[^*\n]|\n(?!\n))+?)\*(?!\w)|`([^`]+?)`/g

export function segments(text: string): Seg[] {
  const out: Seg[] = []
  let at = 0
  for (const m of text.matchAll(INLINE)) {
    if (m.index > at) out.push({ t: 'text', v: text.slice(at, m.index) })
    if (m[1] !== undefined) {
      const slug = m[1].replace(/\/$/, '')
      out.push({ t: 'link', v: m[2]?.trim() || (slug.split('/').pop() ?? slug), to: slug })
    } else if (m[3] !== undefined) out.push({ t: 'bi', v: m[3] })
    else if (m[4] !== undefined) out.push({ t: 'b', v: m[4] })
    else if (m[5] !== undefined) out.push({ t: 'i', v: m[5] })
    else if (m[6] !== undefined) out.push({ t: 'code', v: m[6] })
    at = m.index + m[0].length
  }
  if (at < text.length) out.push({ t: 'text', v: text.slice(at) })
  return out
}
