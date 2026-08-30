import { useEffect, useState } from 'react'
import { useWikiIndex, type WikiSource } from './data'

/**
 * Is the wiki you are reading the wiki that exists?
 *
 * ---- why this is a thing on the page at all --------------------------------
 *
 * `public/wiki/` is a derived snapshot of caakehorn/wiki-brain, rebuilt hourly
 * and on dispatch. When that rebuild stops, nothing about the site looks wrong:
 * the deploy is a separate workflow, it stays green, and it keeps shipping the
 * last snapshot that managed to build. On 2026-08-29 the sync went red on a
 * corpus assertion and stayed red for two days — the site served a frozen wiki
 * the whole time, and the only way anybody could have known was to open the
 * Actions tab of a repository the reader has never heard of.
 *
 * So the reader gets told instead. A blue dot when the snapshot is standing on
 * the newest commit that could have changed it; a flashing warning when it is
 * not.
 *
 * ---- what it compares, and why not the obvious thing -----------------------
 *
 * `index.json.source` records the last wiki-brain commit that touched any of
 * the four paths the sync actually reads — `wiki/`, `sage/questions/`, `plain/`
 * and `lexicon/words/` — written by `scripts/sync-wiki.mjs` at sync time.
 *
 * Not HEAD. A push that moves only `log.md` or `WORK.md` changes HEAD and
 * changes nothing this snapshot could carry, and a light keyed to HEAD would go
 * yellow for a commit the sync was right to ignore — then stay yellow, because
 * nothing would ever commit to clear it. Keyed to the read paths, the value
 * moves when, and only when, there is something to catch up with.
 *
 * One request per path against the public commits API, which needs no token and
 * costs four of an anonymous caller's sixty an hour. The answer is cached per
 * session against the snapshot's own commit, so a reader clicking through forty
 * pages asks once.
 *
 * ---- what it refuses to do -------------------------------------------------
 *
 * There is no yellow for "I could not find out". Rate-limited, offline, behind
 * a filter, GitHub down: all of those are `unknown`, drawn as a quiet grey dot
 * that says it does not know. A warning light that fires when it cannot see is
 * a warning light people learn to ignore, and this one has exactly one job on
 * the day it matters.
 *
 * It also cannot see a sync that ran, failed, and left the snapshot standing on
 * a commit that is still the newest — a wiki-brain push whose derivation broke.
 * That reads as current here, correctly: the snapshot *is* the newest thing the
 * sync could have produced. `bin/wiki-check` and the workflow's own red are
 * where that shows up.
 */

export type SyncStatus =
  | { state: 'checking' }
  /** The snapshot stands on the newest commit that could have changed it. */
  | { state: 'current'; snapshotAt: string; sourceAt: string }
  /** Newer commits touch the paths the sync reads; the page is behind them. */
  | { state: 'behind'; snapshotAt: string; sourceAt: string; newestAt: string; paths: string[] }
  /** The question could not be asked. Never drawn as an alarm. */
  | { state: 'unknown'; reason: string }

/** Long enough that clicking through the wiki asks once; short enough to matter. */
const TTL_MS = 5 * 60 * 1000

const API = 'https://api.github.com/repos'

const cacheKey = (commit: string) => `wiki-sync:${commit}`

function readCache(commit: string): SyncStatus | null {
  try {
    const raw = sessionStorage.getItem(cacheKey(commit))
    if (!raw) return null
    const { at, status } = JSON.parse(raw) as { at: number; status: SyncStatus }
    if (Date.now() - at > TTL_MS) return null
    return status
  } catch {
    return null
  }
}

function writeCache(commit: string, status: SyncStatus) {
  // Never cache `unknown`: it is usually a transient rate limit, and holding it
  // for five minutes turns one throttled request into five minutes of a reader
  // being told nothing when the answer was available all along.
  if (status.state === 'unknown') return
  try {
    sessionStorage.setItem(cacheKey(commit), JSON.stringify({ at: Date.now(), status }))
  } catch {
    /* private mode, quota, disabled — the check simply runs again */
  }
}

/**
 * The newest commit touching one path, or null if the API would not say.
 * `undefined` distinguishes "asked, and there are none" from "could not ask".
 */
async function newestCommit(
  repo: string,
  path: string,
  signal: AbortSignal,
): Promise<{ sha: string; date: string } | null | undefined> {
  const url = `${API}/${repo}/commits?path=${encodeURIComponent(path)}&per_page=1`
  const res = await fetch(url, { signal, headers: { Accept: 'application/vnd.github+json' } })
  if (!res.ok) return undefined
  const body = (await res.json()) as { sha: string; commit?: { committer?: { date?: string } } }[]
  const top = body[0]
  if (!top) return null
  const date = top.commit?.committer?.date
  if (!date) return undefined
  return { sha: top.sha, date }
}

export function useSyncStatus(): SyncStatus {
  const { data } = useWikiIndex()
  const source: WikiSource | null = data?.source ?? null
  const snapshotAt = data?.generatedAt ?? ''
  const [status, setStatus] = useState<SyncStatus>({ state: 'checking' })

  useEffect(() => {
    if (!data) return
    if (!source?.commit || !source.repo || !source.paths?.length) {
      // A snapshot synced from something that was not a git checkout. Nothing to
      // compare against, and saying so is more use than a green light would be.
      setStatus({ state: 'unknown', reason: 'this snapshot did not record what it was built from' })
      return
    }

    const cached = readCache(source.commit)
    if (cached) {
      setStatus(cached)
      return
    }

    const ac = new AbortController()
    ;(async () => {
      try {
        const results = await Promise.all(
          source.paths.map((p) => newestCommit(source.repo, p, ac.signal)),
        )
        if (ac.signal.aborted) return

        // One path we could not read is one path that could be hiding the
        // change, so the whole answer is unknown rather than a partial green.
        if (results.some((r) => r === undefined)) {
          setStatus({ state: 'unknown', reason: 'GitHub would not answer — rate limit, or offline' })
          return
        }

        const since = Date.parse(source.committedAt)
        const behind: { path: string; date: string }[] = []
        results.forEach((r, i) => {
          if (!r || r.sha === source.commit) return
          if (Date.parse(r.date) > since) behind.push({ path: source.paths[i], date: r.date })
        })

        const next: SyncStatus = behind.length
          ? {
              state: 'behind',
              snapshotAt,
              sourceAt: source.committedAt,
              newestAt: behind.reduce((a, b) => (Date.parse(b.date) > Date.parse(a.date) ? b : a)).date,
              paths: behind.map((b) => b.path),
            }
          : { state: 'current', snapshotAt, sourceAt: source.committedAt }

        writeCache(source.commit, next)
        setStatus(next)
      } catch (err) {
        if ((err as Error)?.name === 'AbortError') return
        setStatus({ state: 'unknown', reason: 'GitHub could not be reached' })
      }
    })()

    return () => ac.abort()
  }, [data, source?.commit, source?.repo, source?.committedAt, source?.paths, snapshotAt])

  return status
}

/** `2026-08-30 20:21 UTC` — the same shape everywhere the light explains itself. */
export function stamp(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())} UTC`
}

/** How long ago, in the coarsest unit that is still true. */
export function ago(iso: string): string {
  const then = Date.parse(iso)
  if (Number.isNaN(then)) return 'unknown'
  const mins = Math.max(0, Math.round((Date.now() - then) / 60000))
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins} min ago`
  const hours = Math.round(mins / 60)
  if (hours < 48) return `${hours} hr ago`
  return `${Math.round(hours / 24)} days ago`
}
