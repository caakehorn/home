/**
 * PAGE HISTORY — reading the chain scripts/build-wiki-history.mjs writes.
 *
 * The dataset is the current file whole plus a reverse patch chain: `patches[i]`
 * turns revision `i`'s text into revision `i + 1`'s, and revision 0 is what the
 * page says now. So the snapshot for any revision is a fold, and the recent
 * revisions — the ones people actually open — are the cheap end of it.
 *
 * `applyOps` here and `applyOps` in the build script are the same six lines
 * written twice on purpose. The build folds every chain with its copy and
 * compares the result to the blob git holds, so the two agreeing is checked at
 * build time rather than assumed; if they ever drift, the sync fails instead of
 * the browser quietly rendering a version of a page that never existed.
 */

/** One commit that touched this page. */
export type Revision = {
  /** Abbreviated. Long enough to paste into `git show`. */
  sha: string
  /** ISO 8601 with an offset — the author date, not the commit date. */
  date: string
  author: string
  subject: string
  /**
   * The operation, when the subject follows wiki-brain's `<op>: <description>`
   * convention — ingest, climb, close, answer, translate, edit, fix, docs.
   * Null when it does not, which is most portal edits and every merge.
   */
  op: string | null
  bytes: number
  lines: number
  added: number
  removed: number
  /** The oldest revision this history reaches. */
  created: boolean
  /** The slug this page had before this commit, if it was moved. */
  renamedFrom: string | null
  /**
   * Where the file lived at this revision, when that is not where it lives
   * now. Present only on revisions older than a rename — most pages have never
   * moved and carry it on none of theirs.
   */
  path?: string
}

export type PageHistory = {
  slug: string
  domain: string
  title: string
  /** Newest first. Always at least one entry. */
  revisions: Revision[]
  /**
   * Set when the text is deliberately not published — the revision list is
   * real and the snapshots are absent. Currently only `'moratorium'`, and
   * currently never set; see the header of build-wiki-history.mjs.
   */
  withheld: string | null
  /** The current file, verbatim. Null when `withheld`. */
  head: string | null
  /** `patches[i]` turns `revisions[i]`'s text into `revisions[i + 1]`'s. */
  patches: Ops[] | null
}

/**
 * One line op.
 *
 *   [n]        keep the next n lines
 *   [n, [...]] drop the next n lines, emit these instead
 */
export type Op = [number] | [number, string[]]
export type Ops = Op[]

/** The whole-corpus summary — counts, and when each page last moved. */
export type HistoryIndex = {
  generatedAt: string
  counts: { pages: number; revisions: number; commits: number; sealed: number; withheld: number }
  span: { first: string; last: string } | null
  pages: {
    slug: string
    domain: string
    revisions: number
    created?: string
    updated?: string
    sealed?: boolean
    withheld?: string | null
  }[]
}

export function applyOps(lines: string[], ops: Ops): string[] {
  const out: string[] = []
  let at = 0
  for (const [n, add] of ops) {
    if (add === undefined) out.push(...lines.slice(at, at + n))
    else out.push(...add)
    at += n
  }
  out.push(...lines.slice(at))
  return out
}

const asset = (path: string) => `${import.meta.env.BASE_URL}wiki/${path}`.replace(/\/{2,}/g, '/')

const cache = new Map<string, Promise<PageHistory | null>>()

/**
 * A page's history, or null if it has none published.
 *
 * Null is an ordinary answer, not a failure: a sealed page has no history file
 * by design, and a page added since the last sync has none yet. The caller says
 * so rather than showing an error — an error implies something broke.
 */
export function loadHistory(slug: string): Promise<PageHistory | null> {
  if (!cache.has(slug)) {
    const file = `history/${slug.replace(/\//g, '__')}.json`
    cache.set(
      slug,
      fetch(asset(file))
        .then((r) => (r.ok ? (r.json() as Promise<PageHistory>) : null))
        .catch(() => null),
    )
  }
  return cache.get(slug)!
}

/**
 * The whole file, exactly as it stood at `index` (0 = now).
 *
 * Folds the chain from the head. Returns null when the text was withheld or
 * the index is out of range — never a partial fold, which would look like a
 * real older version of the page.
 */
export function snapshotAt(history: PageHistory, index: number): string | null {
  if (history.head === null || history.patches === null) return null
  if (index < 0 || index >= history.revisions.length) return null
  let lines = history.head.split('\n')
  for (let i = 0; i < index; i++) lines = applyOps(lines, history.patches[i])
  return lines.join('\n')
}

/** A wiki file split into the parts the page renderer wants. */
export type Snapshot = { frontmatter: string; h1: string | null; body: string }

/**
 * Split a raw file the way scripts/sync-wiki.mjs splits the current one, so a
 * historical version renders through exactly the same path as a live page —
 * frontmatter off, leading H1 promoted to the title.
 */
export function splitSnapshot(raw: string): Snapshot {
  let frontmatter = ''
  let rest = raw
  if (raw.startsWith('---')) {
    const end = raw.indexOf('\n---', 3)
    if (end !== -1) {
      frontmatter = raw.slice(4, end)
      rest = raw.slice(raw.indexOf('\n', end + 1) + 1)
    }
  }
  let body = rest.replace(/^\s*\n/, '')
  const h1 = body.match(/^#\s+(.+)\n?/)
  if (h1) body = body.slice(h1[0].length)
  return { frontmatter, h1: h1 ? h1[1].trim() : null, body: body.trimEnd() }
}

/** One line of a rendered diff. */
export type DiffLine = { kind: 'same' | 'add' | 'del'; text: string }

/**
 * What revision `index` did to the page, oldest-to-newest, as lines.
 *
 * The stored chain runs the other way — `patches[index]` turns this revision
 * into its predecessor — so an op that drops n lines from the newer text is
 * describing n lines this revision ADDED. Inverting is the whole of it.
 *
 * Returns null for the oldest revision, which has no predecessor here: this
 * history reaches the commit that created the page, and "what changed" against
 * nothing is the whole file, which is what the snapshot view already shows.
 */
export function changesIn(history: PageHistory, index: number): DiffLine[] | null {
  if (history.patches === null) return null
  const ops = history.patches[index]
  if (!ops) return null
  const newer = snapshotAt(history, index)
  if (newer === null) return null

  const lines = newer.split('\n')
  const out: DiffLine[] = []
  let at = 0
  for (const [n, add] of ops) {
    if (add === undefined) {
      for (const text of lines.slice(at, at + n)) out.push({ kind: 'same', text })
    } else {
      // `add` is what the OLDER revision had here; the newer lines are what
      // this revision put in its place.
      for (const text of add) out.push({ kind: 'del', text })
      for (const text of lines.slice(at, at + n)) out.push({ kind: 'add', text })
    }
    at += n
  }
  for (const text of lines.slice(at)) out.push({ kind: 'same', text })
  return out
}

/**
 * Collapse long runs of unchanged lines, keeping `context` either side.
 *
 * A 900-line page with a one-word fix is 899 lines of noise around the answer.
 * The gap is reported rather than silently closed — a diff that hides how much
 * it is not showing is a diff you cannot trust for the thing it is for.
 */
export function condense(lines: DiffLine[], context = 3): (DiffLine | { kind: 'gap'; n: number })[] {
  const keep = new Set<number>()
  lines.forEach((line, i) => {
    if (line.kind === 'same') return
    for (let j = Math.max(0, i - context); j <= Math.min(lines.length - 1, i + context); j++) {
      keep.add(j)
    }
  })
  const out: (DiffLine | { kind: 'gap'; n: number })[] = []
  let skipped = 0
  lines.forEach((line, i) => {
    if (keep.has(i)) {
      if (skipped) {
        out.push({ kind: 'gap', n: skipped })
        skipped = 0
      }
      out.push(line)
    } else skipped++
  })
  if (skipped) out.push({ kind: 'gap', n: skipped })
  return out
}

/** `2026-08-30T14:02:11-05:00` -> `30 Aug 2026`. */
export function shortDate(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso.slice(0, 10)
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

/**
 * How long ago, in the coarsest unit that is still true.
 *
 * Coarse on purpose: "3 months ago" is what a reader wants from a card, and
 * "94 days ago" invites them to do arithmetic they did not ask for.
 */
export function ago(iso: string, now = Date.now()): string {
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return ''
  const days = Math.floor((now - then) / 86_400_000)
  if (days < 0) return 'just now'
  if (days === 0) return 'today'
  if (days === 1) return 'yesterday'
  if (days < 31) return `${days} days ago`
  const months = Math.floor(days / 30.44)
  if (months < 24) return `${months} month${months === 1 ? '' : 's'} ago`
  return `${Math.floor(days / 365.25)} years ago`
}
