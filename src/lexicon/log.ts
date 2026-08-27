/**
 * The word list — everything caught, and what was made of it.
 *
 * Derived at sync time from `lexicon/words/*.md` in wiki-brain (see
 * `scripts/sync-wiki.mjs`), so this is a read of a static file like every other
 * dataset the portal serves. The states are the point:
 *
 *   pending    caught, and waiting for a session to check it against the corpus
 *   analyzed   checked, with counts, and folded into the vocabulary page
 *   rejected   checked and found to be nothing — kept, never deleted
 *
 * `pending` is not a loading state and must never be dressed up as one. There
 * is no model behind the box. A word waits for somebody to count it, and the
 * list says so.
 *
 * **`rejected` is a real outcome and is rendered as one.** A word checked and
 * found empty and a word nobody has looked at yet must not look the same from
 * outside — the same rule `sage/` applies to a declined question, and the
 * reason both queues keep their dead entries.
 */

export type WordStatus = 'pending' | 'analyzed' | 'rejected'

export type WordEntry = {
  id: string
  added: string | null
  word: string
  /** Coarse bucket chosen at capture time; a reading may disagree with it. */
  kind: string
  status: WordStatus
  analyzed: string | null
  /** Every `wiki/` page the reading was written into. */
  targets: string[]
  note: string
  reading: string
}

export type WordLog = {
  generatedAt: string
  counts: { caught: number; pending: number; analyzed: number; rejected: number }
  entries: WordEntry[]
}

const url = () => `${import.meta.env.BASE_URL}wiki/lexicon.json`.replace(/\/{2,}/g, '/')

let cache: Promise<WordLog | null> | null = null

/**
 * Resolves to null when no list has been built.
 *
 * Only success is cached: a tab open across the deploy that first ships the
 * file gets one 404 and would otherwise remember it for the rest of the
 * session. Same reasoning as `../wiki/keyring`.
 */
export function loadWords(): Promise<WordLog | null> {
  cache ??= fetch(url(), { cache: 'no-store' })
    .then((r) => (r.ok ? (r.json() as Promise<WordLog>) : Promise.reject(new Error('absent'))))
    .catch(() => {
      cache = null
      return null
    })
  return cache
}

/** Drop the cache so a just-submitted word can appear without a reload. */
export function forget() {
  cache = null
}
