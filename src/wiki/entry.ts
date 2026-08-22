import type { IndexEntry, WikiIndex } from './data'

/* ==========================================================================
   WAYS IN

   487 pages, 662,512 words, nine domains and a force-directed map. Every one
   of those is a way of looking at the corpus and not one of them is a way of
   STARTING it — the honest answer to "where do I begin" was previously a
   search box and a graph, which is the same answer as "you don't".

   So: five routes, each one an ordered list of real pages derived from the
   index rather than hand-curated, because a hand-curated list of 487 pages
   goes stale the first time somebody runs the sync script.

   Each route sorts on something the index already knows and each one is a
   different theory of what "start" means:

     THE BRIEFS   the pages that carry a machine-readable summary block —
                  the shortest honest version of the whole thing
     THE SPINE    most-linked: what the rest of the corpus keeps pointing at
     THE PEOPLE   the entities, by weight. Most of this is about somebody
     THE LONG     biggest by word count, for somebody with an evening
     DEEP CUTS    the ones nothing links to and nobody has finished
   ========================================================================== */

export type Route = {
  id: string
  label: string
  kana: string
  /** One line on what this route is a theory of. */
  note: string
  tone: 1 | 2 | 3 | 4 | 5
  stops: IndexEntry[]
}

/** Reading speed for the estimate. Deliberately slow — this is dense material. */
const WPM = 210

export const readingTime = (words: number) => {
  const minutes = Math.max(1, Math.round(words / WPM))
  if (minutes < 60) return `${minutes} min`
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  return rest ? `${hours}h ${rest}m` : `${hours}h`
}

/** Index pages are scaffolding, not reading. They never open a route. */
const readable = (page: IndexEntry) => page.type !== 'index' && !page.slug.endsWith('/index')

/**
 * Pages nothing points at.
 *
 * `links` on an index entry is the OUTBOUND count — how many pages this one
 * reaches. Inbound is what makes something findable, and that has to be counted
 * off the edge list, which is index-pair based. A page with a lot of outbound
 * links and no inbound ones is precisely the interesting case: somebody wrote
 * it, wired it into the corpus, and then never linked it from anywhere.
 */
export function inboundCounts(index: WikiIndex): Map<string, number> {
  const counts = new Map<string, number>()
  for (const page of index.pages) counts.set(page.slug, 0)
  for (const [a, b] of index.edges ?? []) {
    const pa = index.pages[a]
    const pb = index.pages[b]
    if (pa) counts.set(pa.slug, (counts.get(pa.slug) ?? 0) + 1)
    if (pb) counts.set(pb.slug, (counts.get(pb.slug) ?? 0) + 1)
  }
  return counts
}

/* --------------------------------------------------------------------------
   THE HIDDEN ENTRIES

   "Hidden" is four different things in this corpus and they were all rendered
   identically — a card with a word count on it. They are separated here
   because they mean opposite things: a sealed page is deliberate, a stub is
   unfinished, an archived page is over, and an orphan is an accident.
   -------------------------------------------------------------------------- */

export type HiddenKind = 'sealed' | 'stub' | 'archived' | 'orphan' | 'unlit'

export type Hidden = {
  kind: HiddenKind
  page: IndexEntry
}

export const HIDDEN_LABELS: Record<HiddenKind, { label: string; kana: string; note: string; tone: 1 | 2 | 3 | 4 | 5 }> = {
  sealed: {
    label: 'SEALED',
    kana: '封',
    note: 'Encrypted in the snapshot. The row is the whole entry until somebody types the phrase.',
    tone: 2,
  },
  stub: {
    label: 'STUB',
    kana: '断',
    note: 'Started and not finished. Usually because the answer turned out to be worse than the question.',
    tone: 5,
  },
  archived: {
    label: 'CLOSED',
    kana: '終',
    note: 'Over. Kept because deleting the parts that stopped being true is how a record becomes a story.',
    tone: 1,
  },
  orphan: {
    label: 'ORPHAN',
    kana: '孤',
    note: 'Nothing in the corpus links to it. You can only arrive here on purpose, and almost nobody does.',
    tone: 4,
  },
  unlit: {
    label: 'UNLIT',
    kana: '暗',
    note: 'Long, finished, well-linked, and never once opened by anybody following the obvious path.',
    tone: 3,
  },
}

export function hiddenEntries(index: WikiIndex, limit = 12): Hidden[] {
  const inbound = inboundCounts(index)
  const out: Hidden[] = []
  const taken = new Set<string>()

  const push = (kind: HiddenKind, pages: IndexEntry[], take: number) => {
    for (const page of pages) {
      if (out.length >= limit || take <= 0) return
      if (taken.has(page.slug)) continue
      taken.add(page.slug)
      out.push({ kind, page })
      take--
    }
  }

  const pool = index.pages.filter(readable)

  // Sealed first: it is the only one of these that is a deliberate act.
  push('sealed', pool.filter((p) => p.locked), 3)

  // Then the accidents, biggest first — an orphan nobody linked that runs to
  // 4,000 words is a better find than an orphan that runs to 200.
  push(
    'orphan',
    pool.filter((p) => (inbound.get(p.slug) ?? 0) === 0 && p.words > 400).sort((a, b) => b.words - a.words),
    4,
  )

  push(
    'archived',
    pool.filter((p) => p.status === 'archived' || p.status === 'closed').sort((a, b) => b.words - a.words),
    3,
  )

  push(
    'stub',
    pool.filter((p) => p.status === 'stub' || p.words < 260).sort((a, b) => (b.links ?? 0) - (a.links ?? 0)),
    3,
  )

  // Backfill with the substantial-but-unobvious: long, well-connected pages
  // that are not in any domain's top slot, so they never surface by browsing.
  push(
    'unlit',
    pool
      .filter((p) => p.words > 1500 && (inbound.get(p.slug) ?? 0) > 0 && (inbound.get(p.slug) ?? 0) < 3)
      .sort((a, b) => b.words - a.words),
    limit,
  )

  return out.slice(0, limit)
}

/* --------------------------------------------------------------------------
   THE ROUTES
   -------------------------------------------------------------------------- */

export function routes(index: WikiIndex): Route[] {
  const inbound = inboundCounts(index)
  const pool = index.pages.filter(readable)

  const byInbound = [...pool].sort(
    (a, b) => (inbound.get(b.slug) ?? 0) - (inbound.get(a.slug) ?? 0) || b.words - a.words,
  )
  const byWords = [...pool].sort((a, b) => b.words - a.words)

  /*
   * Routes do not overlap.
   *
   * The four sorts agree with each other more than you would expect: the
   * most-linked page in the corpus is also one of the longest and is also a
   * person, so the first cut of this put the same three pages at the top of
   * three of the four routes. Four ways in that all begin identically is one
   * way in with three redundant labels.
   *
   * So each route claims its stops and the next one picks from what is left,
   * in an order that gives each sort the pages it has the strongest claim to:
   * the briefs are a fixed set of ten and cannot be reassigned, the spine is
   * the whole point of the link graph, people is a domain, and length is the
   * weakest claim so it goes last and takes what nobody else wanted. Four
   * routes, twenty-four distinct pages, and LONG HAUL is now honestly "the
   * longest things you have not already been pointed at".
   */
  const claimed = new Set<string>()
  const take = (pages: IndexEntry[], n = 6) => {
    const out: IndexEntry[] = []
    for (const page of pages) {
      if (out.length >= n) break
      if (claimed.has(page.slug)) continue
      claimed.add(page.slug)
      out.push(page)
    }
    return out
  }

  const built: Route[] = [
    {
      id: 'briefs',
      label: 'THE SHORT VERSION',
      kana: '要約',
      note:
        'The pages that carry a compressed block written for machines: every date, name and number packed into one paragraph. Taken apart and read back at you as sentences.',
      tone: 3,
      stops: take(pool.filter((p) => p.brief).sort((a, b) => b.words - a.words)),
    },
    {
      id: 'spine',
      label: 'THE SPINE',
      kana: '背骨',
      note:
        'What the rest of the corpus keeps pointing at. If a claim on any other page needed something to lean on, it leaned on one of these.',
      tone: 1,
      stops: take(byInbound),
    },
    {
      id: 'people',
      label: 'THE PEOPLE',
      kana: '人物',
      note:
        'Most of this is about somebody. The entities, heaviest first — which is also, roughly, in order of how much of it they have had to put up with.',
      tone: 2,
      stops: take(byWords.filter((p) => p.domain === 'people')),
    },
    {
      id: 'long',
      label: 'THE LONG HAUL',
      kana: '長編',
      note:
        'The biggest things left in the building once the other three routes have taken theirs. Nothing here is a summary of anything; these are the pages the summaries were made out of.',
      tone: 5,
      stops: take(byWords),
    },
  ]

  return built.filter((route) => route.stops.length > 0)
}

/** Total words on a route, for the honest estimate. */
export const routeWords = (route: Route) => route.stops.reduce((sum, page) => sum + page.words, 0)

/** A page nobody was going to find on purpose. */
export function randomPage(index: WikiIndex): IndexEntry | null {
  const pool = index.pages.filter((p) => readable(p) && p.words > 300)
  if (pool.length === 0) return null
  return pool[Math.floor(Math.random() * pool.length)]
}
