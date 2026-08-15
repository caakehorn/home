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
}

export type WikiIndex = {
  generatedAt: string
  counts: { pages: number; words: number; chartables: number }
  domains: { id: string; count: number }[]
  pages: IndexEntry[]
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
