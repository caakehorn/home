/**
 * JERAD'S METRIC MINIMART — the loader.
 *
 * The dataset is `scripts/build-minimart.mjs`'s output, `public/minimart/
 * stats.json`: counts, dates and lengths read out of both repositories' own
 * git history, plus two pull-request totals captured from GitHub because
 * neither checkout contains them (see that script's header for why). Nothing
 * here recomputes or reinterprets a number — it is the same fetch-once-per-
 * session shape every other data-backed room uses (`src/docket/core.ts` is
 * the original of this pattern).
 */
import { useEffect, useState } from 'react'

export type LinesOfCode = {
  scope: string
  files: number
  lines: number
  byArea: Record<string, { files: number; lines: number }>
}

export type RepoStats = {
  name: string
  commits: {
    total: number
    firstCommit: string | null
    lastCommit: string | null
    ageDays: number | null
    byAuthor: Record<string, number>
    codingAgentSessions: { count: number; spanHours: number }
  }
  pullRequests: { total: number; merged: number; capturedAt: string }
  linesOfCode: LinesOfCode
  wikiContentLines?: { files: number; lines: number }
}

export type MinimartStats = {
  generatedAt: string
  repos: { home: RepoStats; wikiBrain?: RepoStats }
  combined: {
    commits: number
    pullRequests: { total: number; merged: number }
    linesOfCode: number
    codingAgentSessions: { count: number; spanHours: number }
  }
}

type Async<T> = { data: T | null; error: string | null; loading: boolean }

let cached: Promise<MinimartStats> | null = null

export function loadMinimart(): Promise<MinimartStats> {
  if (!cached) {
    const url = `${import.meta.env.BASE_URL}minimart/stats.json`.replace(/([^:])\/{2,}/g, '$1/')
    cached = fetch(url).then((r) => {
      if (!r.ok) throw new Error(`no minimart stats on this deploy (${r.status}) — run npm run minimart`)
      return r.json() as Promise<MinimartStats>
    })
    cached.catch(() => {
      cached = null
    })
  }
  return cached
}

export function useMinimart(): Async<MinimartStats> {
  const [state, setState] = useState<Async<MinimartStats>>({ data: null, error: null, loading: true })
  useEffect(() => {
    let live = true
    loadMinimart()
      .then((data) => live && setState({ data, error: null, loading: false }))
      .catch((e: Error) => live && setState({ data: null, error: e.message, loading: false }))
    return () => {
      live = false
    }
  }, [])
  return state
}
