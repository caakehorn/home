import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Marquee } from '../components/Marquee'
import { Nav } from '../components/Nav'
import { SubHead } from '../components/Wordmark'
import { useWikiIndex, type IndexEntry } from '../wiki/data'
import { allDrafts } from '../wiki/store'
import './wiki.css'

const DOMAIN_KANA: Record<string, string> = {
  people: '人', interests: '趣味', mind: '心', timeline: '年表',
  self: '自己', work: '仕事', places: '場所', health: '健康', legal: '法',
}

export function WikiIndexRoute() {
  const { data, error, loading } = useWikiIndex()
  const [params, setParams] = useSearchParams()
  const [query, setQuery] = useState('')
  const domain = params.get('domain')
  const drafts = useMemo(() => Object.keys(allDrafts()), [])

  const results = useMemo(() => {
    if (!data) return []
    const q = query.trim().toLowerCase()
    return data.pages
      .filter((p) => (domain ? p.domain === domain : true))
      .filter((p) =>
        !q
          ? true
          : p.title.toLowerCase().includes(q) ||
            p.slug.toLowerCase().includes(q) ||
            (p.knownFor ?? '').toLowerCase().includes(q),
      )
      .sort((a, b) => b.words - a.words)
  }, [data, domain, query])

  return (
    <div className="wiki">
      <Nav />
      <Marquee
        text="NOTES BECOME CHARTS · CHARTS BECOME PICTURES · PICTURES BECOME NOTES ·"
        duration={20}
        tone={3}
        size="clamp(0.75rem, 1.6vw, 1.05rem)"
      />

      <header className="wrap wiki__masthead">
        <h1 className="wiki__mast-title">
          <SubHead>WIKI-BRAIN</SubHead>
        </h1>
        <span className="wiki__mast-kana jp" aria-hidden="true">
          脳
        </span>
        {data && (
          <p className="wiki__mast-note">
            {data.counts.pages.toLocaleString()} pages · {data.counts.words.toLocaleString()} words ·{' '}
            {data.counts.chartables} tables drawn as charts. Every page is editable in the browser.
          </p>
        )}
      </header>

      <div className="wrap wiki__controls">
        <input
          className="wiki__search"
          type="search"
          placeholder="search the brain…"
          aria-label="Search pages"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <div className="wiki__domains" role="group" aria-label="Filter by domain">
          <button
            type="button"
            className={`wiki__domain${!domain ? ' wiki__domain--on' : ''}`}
            onClick={() => setParams({})}
          >
            ALL {data ? `(${data.counts.pages})` : ''}
          </button>
          {data?.domains.map((d) => (
            <button
              key={d.id}
              type="button"
              className={`wiki__domain${domain === d.id ? ' wiki__domain--on' : ''}`}
              onClick={() => setParams({ domain: d.id })}
            >
              <span className="jp" aria-hidden="true">
                {DOMAIN_KANA[d.id] ?? '書'}
              </span>
              {d.id.toUpperCase()} ({d.count})
            </button>
          ))}
        </div>
      </div>

      {loading && <p className="wrap wiki__state">loading the index…</p>}
      {error && (
        <p className="wrap wiki__state">
          The wiki snapshot is missing ({error}). Run <code>node scripts/sync-wiki.mjs</code> and rebuild.
        </p>
      )}

      {data && (
        <div className="wrap wiki__results">
          <p className="wiki__count" aria-live="polite">
            {results.length} {results.length === 1 ? 'page' : 'pages'}
            {drafts.length > 0 && ` · ${drafts.length} with local edits`}
          </p>
          <ul className="wiki__grid">
            {results.map((page) => (
              <PageCard key={page.slug} page={page} draft={drafts.includes(page.slug)} />
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

function PageCard({ page, draft }: { page: IndexEntry; draft: boolean }) {
  return (
    <li>
      <Link to={`/brain/${page.slug}`} className="wiki__card">
        <span className="wiki__card-domain">{page.domain}</span>
        <h2 className="wiki__card-title">{page.title}</h2>
        {page.knownFor && <p className="wiki__card-blurb">{page.knownFor}</p>}
        <span className="wiki__card-meta">
          <span>{page.words.toLocaleString()}w</span>
          {page.charts > 0 && <span className="wiki__card-charts">{page.charts} charts</span>}
          {page.links > 0 && <span>{page.links} links</span>}
          {draft && <span className="wiki__card-draft">edited</span>}
        </span>
      </Link>
    </li>
  )
}
