/* ==========================================================================
   THE TRAIL — what this browser has already read.

   Two jobs, and the second is the one that matters:

     1. RESUME.  Landing back on the front page and being asked to choose a
        starting point again, having read forty pages, is the single most
        annoying thing a corpus this size can do to somebody.

     2. MARKING WHAT IS READ. The wiki index renders 487 identical cards. Once
        a few dozen of them are marked as visited the shape of your own path
        through the thing becomes visible, which is the cheapest possible way
        of making a flat list feel like territory.

   Deliberately not synced anywhere and deliberately not in the URL: this is a
   private reading history of somebody's private notes, and the only correct
   place for it is the one browser it happened in.
   ========================================================================== */

const KEY = 'danfrank:trail:v1'
const CAP = 120

export type Stop = { slug: string; title: string; at: number }

function read(): Stop[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(
      (x): x is Stop =>
        typeof x === 'object' &&
        x !== null &&
        typeof (x as Stop).slug === 'string' &&
        typeof (x as Stop).title === 'string' &&
        typeof (x as Stop).at === 'number',
    )
  } catch {
    return []
  }
}

let stops: Stop[] = read()

/** Most recent first. */
export const trail = (): readonly Stop[] => stops

export const lastRead = (): Stop | null => stops[0] ?? null

export const hasRead = (slug: string) => stops.some((stop) => stop.slug === slug)

export const readCount = () => stops.length

/**
 * Record a visit.
 *
 * Re-reading a page moves it to the front rather than adding a second entry,
 * so the cap is a cap on distinct pages and the trail cannot be filled up by
 * refreshing one of them.
 */
export function remember(slug: string, title: string) {
  if (!slug) return
  stops = [{ slug, title, at: Date.now() }, ...stops.filter((stop) => stop.slug !== slug)].slice(0, CAP)
  try {
    window.localStorage.setItem(KEY, JSON.stringify(stops))
  } catch {
    /* private mode; the trail just will not survive the tab */
  }
}

export function forgetTrail() {
  stops = []
  try {
    window.localStorage.removeItem(KEY)
  } catch {
    /* no-op */
  }
}
