/**
 * The sage log — every question ever put to the brain, and what came back.
 *
 * Derived at sync time from `sage/questions/*.md` in wiki-brain (see
 * `scripts/sync-wiki.mjs`), so this is a read of a static file like every other
 * dataset the portal serves. The states are the point:
 *
 *   pending   asked, and waiting for a session to answer it properly
 *   answered  answered, with citations and quotes
 *   declined  answered by refusing, with a reason, in the open
 *
 * `pending` is not a loading state and must never be dressed up as one. There is
 * no model behind the question box; a question waits for somebody to read the
 * corpus and write an answer worth putting under it, and the log says so.
 */

export type SageStatus = 'pending' | 'answered' | 'declined'

export type SageEntry = {
  id: string
  asked: string | null
  /** Null when the question was asked without a name. The box allows that. */
  asker: string | null
  status: SageStatus
  answered: string | null
  /** The `raw/` capture the answer was filed to, once it has been. */
  capture: string | null
  /** Every `wiki/` and `raw/` path the answer rests on. */
  cites: string[]
  question: string
  answer: string
}

export type SageLog = {
  generatedAt: string
  counts: { asked: number; pending: number; answered: number; declined: number }
  entries: SageEntry[]
}

const url = () => `${import.meta.env.BASE_URL}wiki/sage.json`.replace(/\/{2,}/g, '/')

let cache: Promise<SageLog> | null = null

/**
 * Only success is cached.
 *
 * A tab open across the deploy that first shipped the dataset would otherwise
 * take one 404 and report for the rest of the session that there is no log on a
 * deploy that plainly has one — the same trap `keyring.ts` documents.
 */
export function loadSage(): Promise<SageLog> {
  cache ??= fetch(url(), { cache: 'no-store' })
    .then(async (r) => {
      if (!r.ok) throw new Error(`no sage log on this deploy (${r.status}) — it arrives with the next sync`)
      // A missing static file does not always arrive as a 404. This site ships
      // a copy of index.html as its SPA fallback, so a host that serves that
      // fallback with a 200 hands back HTML — and `r.json()` then fails with
      // "Unexpected token '<'", which tells the person reading it nothing about
      // what is actually wrong. Name the condition instead.
      const text = await r.text()
      if (text.trimStart().startsWith('<')) {
        throw new Error('the sage log has not been published to this deploy yet — it arrives with the next sync')
      }
      try {
        return JSON.parse(text) as SageLog
      } catch {
        throw new Error('the sage log on this deploy is not readable — the next sync rewrites it')
      }
    })
    .catch((err) => {
      cache = null
      throw err
    })
  return cache
}

/** Forget the fetched log, so a submitted question is followed by fresh counts. */
export function invalidate() {
  cache = null
}

/** A wiki path as the portal routes it: `wiki/people/annie-ulmer.md` -> `people/annie-ulmer`. */
export const citeSlug = (cite: string) =>
  cite.replace(/^wiki\//, '').replace(/\.md$/, '')

export const isWikiCite = (cite: string) => cite.startsWith('wiki/')
