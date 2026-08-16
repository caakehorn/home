import { useEffect, useState } from 'react'

export type IndexEntry = {
  slug: string
  domain: string
  title: string
  type: string | null
  status: string | null
  knownFor: string | null
  relationship: string | null
  words: number
  charts: number
  links: number
  /** The page carries a compressed block the brief visualiser can open. */
  brief?: boolean
  /** Map coordinates, baked at sync time. Roughly [-1, 1]. */
  x?: number
  y?: number
}

export type WikiIndex = {
  generatedAt: string
  counts: { pages: number; words: number; chartables: number; briefs?: number; edges?: number }
  domains: { id: string; count: number }[]
  pages: IndexEntry[]
  /** Undirected links as index pairs into `pages`. */
  edges?: [number, number][]
}

export type WikiPage = {
  slug: string
  domain: string
  title: string
  meta: Record<string, string>
  infobox: Record<string, string> | null
  lists: Record<string, string[]>
  links: string[]
  backlinks: string[]
  body: string
  words: number
  charts: number
  /** The frontmatter block exactly as written upstream. See `toSource`. */
  fmRaw?: string
  /** The leading `# Heading` line, stripped from `body` at sync time. */
  h1?: string | null
}

/**
 * A page as a file again, ready to commit.
 *
 * `frontmatterOf` rebuilds frontmatter from the *parsed* view, and that view is
 * lossy: `lists` flattens each `connections:` entry to a string, dropping the
 * `type:` and `claim:` written under it. Saving a page reconstructed that way
 * deleted every typed edge's claim on it, and dropped the leading H1 as well,
 * because nothing remembered either had been there.
 *
 * So the raw frontmatter is what gets edited and written back, and the H1 is
 * put back on the front of the body. `frontmatterOf` is still what the editor
 * *shows* — it is readable, and it is what someone editing frontmatter by hand
 * wants — but a page is only ever committed through here.
 */
/**
 * What the frontmatter pane should show and edit.
 *
 * The raw block, so what you see is what is in the file and what you type is
 * what gets written. `frontmatterOf` is the fallback for a page from a snapshot
 * built before the raw text was carried.
 */
export const editableFrontmatter = (page: WikiPage) => page.fmRaw ?? frontmatterOf(page)

export function toSource(
  page: WikiPage,
  next: { frontmatter?: string; body: string },
): string {
  // An edited frontmatter pane wins; otherwise the raw block, untouched.
  const fm = (next.frontmatter ?? page.fmRaw ?? frontmatterOf(page)).replace(/^\n+|\n+$/g, '')
  const head = page.h1 ? `${page.h1}\n\n` : ''
  return `---\n${fm}\n---\n\n${head}${next.body.replace(/^\n+/, '')}`
}

const asset = (path: string) => `${import.meta.env.BASE_URL}wiki/${path}`.replace(/\/{2,}/g, '/')

let indexCache: Promise<WikiIndex> | null = null
export function loadIndex(): Promise<WikiIndex> {
  indexCache ??= fetch(asset('index.json')).then((r) => {
    if (!r.ok) throw new Error(`wiki index unavailable (${r.status})`)
    return r.json() as Promise<WikiIndex>
  })
  return indexCache
}

const pageCache = new Map<string, Promise<WikiPage>>()
export function loadPage(slug: string): Promise<WikiPage> {
  if (!pageCache.has(slug)) {
    const file = `pages/${slug.replace(/\//g, '__')}.json`
    pageCache.set(
      slug,
      fetch(asset(file)).then((r) => {
        if (!r.ok) throw new Error(`no page "${slug}" (${r.status})`)
        return r.json() as Promise<WikiPage>
      }),
    )
  }
  return pageCache.get(slug)!
}

type Async<T> = { data: T | null; error: string | null; loading: boolean }

export function useWikiIndex(): Async<WikiIndex> {
  const [state, setState] = useState<Async<WikiIndex>>({ data: null, error: null, loading: true })
  useEffect(() => {
    let live = true
    loadIndex()
      .then((data) => live && setState({ data, error: null, loading: false }))
      .catch((e: Error) => live && setState({ data: null, error: e.message, loading: false }))
    return () => {
      live = false
    }
  }, [])
  return state
}

export function useWikiPage(slug: string | undefined): Async<WikiPage> {
  const [state, setState] = useState<Async<WikiPage>>({ data: null, error: null, loading: true })
  useEffect(() => {
    if (!slug) return
    let live = true
    setState({ data: null, error: null, loading: true })
    loadPage(slug)
      .then((data) => live && setState({ data, error: null, loading: false }))
      .catch((e: Error) => live && setState({ data: null, error: e.message, loading: false }))
    return () => {
      live = false
    }
  }, [slug])
  return state
}

/** Rebuild the frontmatter block so an edited page round-trips as real .md. */
export function frontmatterOf(page: WikiPage): string {
  const lines: string[] = []
  for (const [key, value] of Object.entries(page.meta)) {
    lines.push(`${key}: ${/[:#]/.test(value) ? JSON.stringify(value) : value}`)
  }
  for (const [key, items] of Object.entries(page.lists)) {
    if (!items.length) continue
    lines.push(`${key}:`)
    for (const item of items) lines.push(`  - ${item}`)
  }
  if (page.infobox) {
    lines.push('infobox:')
    for (const [key, value] of Object.entries(page.infobox)) {
      lines.push(`  ${key}: ${/[:#]/.test(value) ? JSON.stringify(value) : value}`)
    }
  }
  return lines.join('\n')
}

export const humanize = (slug: string) =>
  slug
    .split('/')
    .pop()!
    .replace(/-/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
