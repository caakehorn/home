/* ==========================================================================
   THE MATCHER — one way of finding a jack, shared by three surfaces.

   THE RULE is the whole design here. A search box is the most tempting place
   on a website to smuggle in a judgement: fuzzy distance, a popularity boost,
   a hand-tuned field weight, a "best match" that is somebody's opinion wearing
   a number. None of that is in here.

   What is in here: a literal, case-folded substring test, and an ordering made
   only of counts and positions —

     0. the query is exactly the jack's id            (an equality)
     1. the query starts the title, short or kana     (an offset of zero)
     2. the query appears anywhere in title or kana   (an offset)
     3. the query appears in the blurb                (an offset)

   Ties inside a tier break on where the match landed, then on how long the
   title is, then alphabetically. Every one of those is a position or a length.
   Nothing in this file knows which jacks are good, and the palette prints the
   rule at the bottom of the list so a reader does not have to take it on faith.

   Kana are matched as written. There is no romaji table, because building one
   means deciding which readings count, and that is a judgement too.
   ========================================================================== */

import type { Destination } from './atlas'

/** A page from the wiki index, folded in once the index has landed. */
export type PageHit = {
  slug: string
  title: string
  /** A length. Printed as-is. */
  words: number
}

export type Hit =
  | { kind: 'jack'; tier: number; at: number; dest: Destination }
  | { kind: 'page'; tier: number; at: number; page: PageHit }

export const normalise = (s: string) => s.toLowerCase().trim()

/**
 * Where `q` lands in `s`, or -1. Split out so every caller folds case the same
 * way and nobody is tempted to add a second, cleverer comparison.
 */
const at = (s: string | undefined, q: string) => (s ? s.toLowerCase().indexOf(q) : -1)

function tierOf(d: Destination, q: string): { tier: number; at: number } | null {
  if (d.id.toLowerCase() === q) return { tier: 0, at: 0 }

  const heads = [d.title, d.short, d.kana]
  const offsets = heads.map((h) => at(h, q)).filter((n) => n >= 0)
  if (offsets.some((n) => n === 0)) return { tier: 1, at: 0 }
  if (offsets.length) return { tier: 2, at: Math.min(...offsets) }

  // The id is a search key as well as a route key: `lev-atlas` and `cab-yarn`
  // are typeable, and somebody who knows them should not be told there is no
  // such thing.
  const idAt = at(d.id, q)
  if (idAt >= 0) return { tier: 2, at: idAt }

  const blurbAt = at(d.blurb, q)
  if (blurbAt >= 0) return { tier: 3, at: blurbAt }

  return null
}

/**
 * Jacks matching `query`, ordered as documented above. An empty query returns
 * every jack in registry order — the board is a map before it is a search box,
 * and an empty field should show the building rather than nothing.
 */
export function searchJacks(destinations: readonly Destination[], query: string): Hit[] {
  const q = normalise(query)
  if (!q) return destinations.map((dest) => ({ kind: 'jack' as const, tier: 1, at: 0, dest }))

  const hits: Hit[] = []
  for (const dest of destinations) {
    const scored = tierOf(dest, q)
    if (scored) hits.push({ kind: 'jack', tier: scored.tier, at: scored.at, dest })
  }
  return hits.sort(compare)
}

/**
 * Wiki pages matching `query`, title only. The index carries 519 rows and a
 * blurb search over it would return most of the corpus for any common word,
 * which is not a search result, it is the wiki.
 */
export function searchPages(pages: readonly PageHit[], query: string, cap: number): Hit[] {
  const q = normalise(query)
  if (!q) return []

  const hits: Hit[] = []
  for (const page of pages) {
    const titleAt = at(page.title, q)
    const slugAt = at(page.slug, q)
    const offset = titleAt >= 0 ? titleAt : slugAt
    if (offset < 0) continue
    hits.push({ kind: 'page', tier: offset === 0 ? 1 : 2, at: offset, page })
  }
  return hits.sort(compare).slice(0, cap)
}

/** The documented order, in one place so the two callers cannot disagree. */
function compare(a: Hit, b: Hit): number {
  if (a.tier !== b.tier) return a.tier - b.tier
  if (a.at !== b.at) return a.at - b.at
  const at1 = a.kind === 'jack' ? a.dest.title : a.page.title
  const bt = b.kind === 'jack' ? b.dest.title : b.page.title
  if (at1.length !== bt.length) return at1.length - bt.length
  return at1.localeCompare(bt)
}

/** Printed under the results, because a search that will not say how it ranks is a search you cannot check. */
export const RANKING_RULE =
  'RANKED BY WHERE THE LETTERS LAND — EXACT ID, THEN START OF NAME, THEN ANYWHERE IN IT, THEN THE LINE UNDER IT. NO SCORING.'
