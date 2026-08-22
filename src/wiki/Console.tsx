import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useWikiIndex, type IndexEntry } from './data'
import { HIDDEN_LABELS, hiddenEntries, randomPage, readingTime, routeWords, routes } from './entry'
import { hasRead, lastRead, readCount } from './trail'
import './console.css'

/* ==========================================================================
   THE BRAIN CONSOLE — the front page's actual job.

   This building is a deployment portal for a 487-page wiki and its front page
   used to open with three paragraphs about what a dialectic is, followed by a
   grid of eight rooms of which the wiki was one. You could not search it from
   the front page. You could not resume it. There was no way to find out what
   to read first except to go to the index and be shown a force-directed graph
   of 487 unlabelled dots.

   So the console goes at the top, above everything, and it does four things
   that between them cover every reason somebody is standing here:

     SEARCH   — you know what you are looking for. Type it, hit it, gone.
     RESUME   — you have been here before. One button, back where you were.
     ROUTES   — you have not been here before and do not know where to start.
     DEEP     — you have read the obvious things and want the buried ones.

   The index is already in memory by the time this mounts: the splash pays for
   it while you are looking at the door.
   ========================================================================== */

const DOMAIN_KANA: Record<string, string> = {
  people: '人', interests: '趣味', mind: '心', timeline: '年表',
  self: '自己', work: '仕事', places: '場所', health: '健康', legal: '法',
}

/** Scored search. A title hit outranks a slug hit outranks a blurb hit. */
function search(pages: IndexEntry[], raw: string): IndexEntry[] {
  const q = raw.trim().toLowerCase()
  if (q.length < 2) return []
  const scored: { page: IndexEntry; score: number }[] = []

  for (const page of pages) {
    const title = page.title.toLowerCase()
    const slug = page.slug.toLowerCase()
    const known = (page.knownFor ?? '').toLowerCase()

    let score = 0
    if (title === q) score = 1000
    else if (title.startsWith(q)) score = 600
    else if (title.includes(q)) score = 400
    else if (slug.includes(q)) score = 250
    else if (known.includes(q)) score = 120

    if (score === 0) continue
    // Weight is a tiebreak, not a ranking: a 9,000-word page and a 900-word
    // page that both match on title should not be sorted by size alone.
    scored.push({ page, score: score + Math.min(60, page.words / 200) })
  }

  return scored.sort((a, b) => b.score - a.score).slice(0, 8).map((s) => s.page)
}

export function BrainConsole() {
  const { data, error, loading } = useWikiIndex()
  const navigate = useNavigate()
  const inputRef = useRef<HTMLInputElement>(null)

  const [query, setQuery] = useState('')
  // The corpus is 487 rows and the scorer runs over all of them per keystroke.
  // Deferring it means the input never waits on the list: the field stays at
  // 60fps under a fast typist and the results catch up a frame later.
  const deferred = useDeferredValue(query)
  const [cursor, setCursor] = useState(0)

  const results = useMemo(() => (data ? search(data.pages, deferred) : []), [data, deferred])
  const open = results.length > 0 && query.trim().length >= 2

  // `lastRead` and `readCount` are localStorage reads, not React state — they
  // are only ever written by the page route, which is a full navigation away,
  // so reading them once on mount is correct and re-reading them per render is
  // a synchronous storage hit for no new information.
  const [resume] = useState(() => lastRead())
  const [read] = useState(() => readCount())

  useEffect(() => setCursor(0), [deferred])

  const go = (slug: string) => {
    setQuery('')
    navigate(`/brain/${slug}`)
  }

  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open) return
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setCursor((c) => (c + 1) % results.length)
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setCursor((c) => (c - 1 + results.length) % results.length)
    } else if (event.key === 'Enter') {
      event.preventDefault()
      go(results[cursor].slug)
    } else if (event.key === 'Escape') {
      setQuery('')
    }
  }

  // "/" focuses the search from anywhere on the page, which is the one
  // keyboard convention every reader of a reference site already has.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== '/' || event.metaKey || event.ctrlKey || event.altKey) return
      const tag = (event.target as HTMLElement | null)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
      event.preventDefault()
      inputRef.current?.focus()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const paths = useMemo(() => (data ? routes(data) : []), [data])
  const buried = useMemo(() => (data ? hiddenEntries(data, 8) : []), [data])

  return (
    <section className="con wrap" aria-labelledby="con-title">
      <div className="con__head">
        <h2 id="con-title" className="con__title">
          THE BRAIN <span className="jp" aria-hidden="true">脳</span>
        </h2>
        {data && (
          <p className="con__stats">
            {data.counts.pages.toLocaleString()} pages · {data.counts.words.toLocaleString()} words ·{' '}
            {(data.counts.edges ?? 0).toLocaleString()} links · {data.domains.length} domains
            {read > 0 && <> · you have opened {read}</>}
          </p>
        )}
      </div>

      {/* ---- the search ------------------------------------------------- */}
      <div className={`con__search${open ? ' con__search--open' : ''}`}>
        <span className="con__search-kana jp" aria-hidden="true">
          検索
        </span>
        <input
          ref={inputRef}
          className="con__input"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder={
            loading
              ? 'waking the brain…'
              : `search ${(data?.counts.pages ?? 0).toLocaleString()} pages — press / from anywhere`
          }
          aria-label="Search the wiki"
          autoComplete="off"
          spellCheck={false}
        />
        <kbd className="con__slash" aria-hidden="true">
          /
        </kbd>

        {open && (
          <ul className="con__results" role="listbox" aria-label="Results">
            {results.map((page, i) => (
              <li key={page.slug}>
                <button
                  type="button"
                  className={`con__result${i === cursor ? ' con__result--on' : ''}`}
                  role="option"
                  aria-selected={i === cursor}
                  onMouseEnter={() => setCursor(i)}
                  onClick={() => go(page.slug)}
                >
                  <span className="con__result-kana jp" aria-hidden="true">
                    {DOMAIN_KANA[page.domain] ?? '書'}
                  </span>
                  <span className="con__result-main">
                    <b>{page.title}</b>
                    {page.knownFor && <i>{page.knownFor}</i>}
                  </span>
                  <span className="con__result-meta">
                    {hasRead(page.slug) && <em>read</em>}
                    {readingTime(page.words)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {error && (
        <p className="con__error">
          The wiki snapshot is missing ({error}). Run <code>node scripts/sync-wiki.mjs</code> and
          rebuild.
        </p>
      )}

      {/* ---- the four buttons ------------------------------------------- */}
      <div className="con__jumps">
        {resume && (
          <Link to={`/brain/${resume.slug}`} className="con__jump con__jump--resume">
            <span className="jp" aria-hidden="true">続</span>
            <b>PICK IT BACK UP</b>
            <i>{resume.title}</i>
          </Link>
        )}

        <button
          type="button"
          className="con__jump"
          onClick={() => {
            const page = data && randomPage(data)
            if (page) navigate(`/brain/${page.slug}`)
          }}
          disabled={!data}
        >
          <span className="jp" aria-hidden="true">乱</span>
          <b>THROW ME SOMEWHERE</b>
          <i>a page nobody was going to find on purpose</i>
        </button>

        <Link to="/brain?view=gaps" className="con__jump">
          <span className="jp" aria-hidden="true">空白</span>
          <b>WHAT IT ADMITS IT DOES NOT KNOW</b>
          <i>the gaps, listed by the thing that has them</i>
        </Link>

        <Link to="/brain" className="con__jump">
          <span className="jp" aria-hidden="true">地図</span>
          <b>THE WHOLE MAP</b>
          <i>
            {data
              ? `${data.counts.pages.toLocaleString()} pages, ${(data.counts.edges ?? 0).toLocaleString()} links, force-directed`
              : 'every page, every link, force-directed'}
          </i>
        </Link>
      </div>

      {/* ---- the domains ------------------------------------------------- */}
      {data && (
        <div className="con__domains">
          {data.domains.map((domain) => (
            <Link
              key={domain.id}
              to={`/brain?view=list&domain=${domain.id}`}
              className="con__domain"
            >
              <span className="jp" aria-hidden="true">
                {DOMAIN_KANA[domain.id] ?? '書'}
              </span>
              {domain.id.toUpperCase()}
              <b>{domain.count}</b>
            </Link>
          ))}
        </div>
      )}

      {/* ---- start here -------------------------------------------------- */}
      {paths.length > 0 && (
        <div className="con__block">
          <h3 className="con__sub">
            START HERE <span className="jp" aria-hidden="true">読始</span>
          </h3>
          <p className="con__sub-note">
            Four routes through the same 487 pages. Each one is a different theory of what
            “beginning” means, and each one is built out of the index rather than hand-picked, so
            none of them goes stale the next time the corpus syncs.
          </p>

          <ol className="con__routes">
            {paths.map((route, i) => (
              <li
                key={route.id}
                className="con__route"
                style={{ ['--glow' as string]: `var(--n${route.tone})` }}
              >
                <span className="con__route-num" aria-hidden="true">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <h4 className="con__route-label">
                  {route.label} <span className="jp" aria-hidden="true">{route.kana}</span>
                </h4>
                <p className="con__route-note">{route.note}</p>

                <ol className="con__stops">
                  {route.stops.slice(0, 3).map((stop) => (
                    <li key={stop.slug}>
                      <Link
                        to={`/brain/${stop.slug}`}
                        className={`con__stop${hasRead(stop.slug) ? ' con__stop--read' : ''}`}
                      >
                        {stop.title}
                        <em>{readingTime(stop.words)}</em>
                      </Link>
                    </li>
                  ))}
                  {route.stops.length > 3 && (
                    <li className="con__stop-more">+{route.stops.length - 3} more</li>
                  )}
                </ol>

                <Link to={`/brain/${route.stops[0].slug}`} className="con__route-go">
                  START →
                </Link>
                {/* Computed, not asserted. An earlier version carried a
                    hand-written "twenty minutes" next to a total the index
                    said was two hours, which is the exact failure mode a
                    derived route is supposed to avoid. */}
                <span className="con__route-cost">
                  {route.stops.length} stops · {readingTime(routeWords(route))} of reading
                </span>
              </li>
            ))}
          </ol>
        </div>
      )}

      {/* ---- the buried -------------------------------------------------- */}
      {buried.length > 0 && (
        <div className="con__block">
          <h3 className="con__sub">
            THE BURIED <span className="jp" aria-hidden="true">深部</span>
          </h3>
          <p className="con__sub-note">
            Every page in here rendered as an identical card with a word count on it, which meant
            the sealed ones, the abandoned ones, the finished ones nothing links to and the ones
            that are simply over all looked the same. They do not mean the same thing, so they no
            longer look the same.
          </p>

          <ul className="con__buried">
            {buried.map(({ kind, page }) => {
              const badge = HIDDEN_LABELS[kind]
              return (
                <li
                  key={page.slug}
                  className={`con__grave con__grave--${kind}`}
                  style={{ ['--glow' as string]: `var(--n${badge.tone})` }}
                >
                  <Link to={`/brain/${page.slug}`} className="con__grave-link">
                    <span className="con__grave-badge">
                      <span className="jp" aria-hidden="true">{badge.kana}</span>
                      {badge.label}
                    </span>
                    <b className="con__grave-title">{page.title}</b>
                    <span className="con__grave-why">{badge.note}</span>
                    <span className="con__grave-meta">
                      {page.domain} · {page.words.toLocaleString()}w · {readingTime(page.words)}
                    </span>
                  </Link>
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </section>
  )
}
