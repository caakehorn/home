import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Marquee } from '../components/Marquee'
import { Nav } from '../components/Nav'
import { SubHead } from '../components/Wordmark'
import { banner } from '../content/slogans'
import { BriefDeck } from '../wiki/BriefDeck'
import { Cortex } from '../wiki/Cortex'
import { Gaps } from '../wiki/Gaps'
import { useWikiIndex, type IndexEntry, type WikiIndex } from '../wiki/data'
import { allDrafts } from '../wiki/store'
import './wiki.css'

const DOMAIN_KANA: Record<string, string> = {
  people: '人', interests: '趣味', mind: '心', timeline: '年表',
  self: '自己', work: '仕事', places: '場所', health: '健康', legal: '法',
}

const VIEWS = [
  { id: 'map', label: 'MAP', kana: '地図' },
  { id: 'list', label: 'LIST', kana: '一覧' },
  { id: 'briefs', label: 'BRIEFS', kana: '要約' },
  // Sits with the other three because it is the same act — a way of reading the
  // wiki. MAP is what connects, LIST is what exists, BRIEFS is what it says,
  // GAPS is what it admits it does not know.
  { id: 'gaps', label: 'GAPS', kana: '空白' },
] as const

type View = (typeof VIEWS)[number]['id']

/** The map needs coordinates; an older snapshot may not carry them. */
const mappable = (data: WikiIndex) => Boolean(data.edges?.length && data.pages.some((p) => p.x !== undefined))

export function WikiIndexRoute() {
  const { data, error, loading } = useWikiIndex()
  const [params, setParams] = useSearchParams()
  const [query, setQuery] = useState('')
  const domain = params.get('domain')
  const drafts = useMemo(() => Object.keys(allDrafts()), [])

  const requested = (params.get('view') ?? 'map') as View
  const view: View = data && !mappable(data) && requested === 'map' ? 'list' : requested

  const setParam = (key: string, value: string | null) => {
    const next = new URLSearchParams(params)
    if (value === null) next.delete(key)
    else next.set(key, value)
    setParams(next)
  }

  const results = useMemo(() => {
    if (!data) return []
    const q = query.trim().toLowerCase()
    return data.pages
      .filter((p) => (view === 'briefs' ? p.brief : true))
      .filter((p) => (domain ? p.domain === domain : true))
      .filter((p) =>
        !q
          ? true
          : p.title.toLowerCase().includes(q) ||
            p.slug.toLowerCase().includes(q) ||
            (p.knownFor ?? '').toLowerCase().includes(q),
      )
      .sort((a, b) => b.words - a.words)
  }, [data, view, domain, query])

  // The map dims rather than removes, so it wants the set, not the list.
  const visible = useMemo(() => new Set(results.map((p) => p.slug)), [results])

  // Landing on the map with a stale domain filter would frame an empty lobe.
  useEffect(() => {
    if (domain && data && !data.domains.some((d) => d.id === domain)) setParam('domain', null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, domain])

  return (
    <div className="wiki">
      <Nav />
      <Marquee
        text={banner('wiki')}
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
            {data.counts.pages.toLocaleString()} pages · {data.counts.words.toLocaleString()} words
            {data.counts.edges ? ` · ${data.counts.edges.toLocaleString()} links` : ''} ·{' '}
            {data.counts.chartables} tables drawn as charts
            {data.counts.briefs ? ` · ${data.counts.briefs} briefs unpacked` : ''}
            {data.counts.sealed ? ` · ${data.counts.sealed} sealed` : ''}.
          </p>
        )}
      </header>

      <div className="wrap wiki__deckbar">
        <div className="wiki__views" role="group" aria-label="View">
          {VIEWS.map((v) => (
            <button
              key={v.id}
              type="button"
              className={`wiki__view${view === v.id ? ' wiki__view--on' : ''}`}
              aria-pressed={view === v.id}
              onClick={() => setParam('view', v.id === 'map' ? null : v.id)}
            >
              <span className="jp" aria-hidden="true">
                {v.kana}
              </span>
              {v.label}
              {v.id === 'briefs' && data?.counts.briefs ? ` (${data.counts.briefs})` : ''}
            </button>
          ))}
        </div>

        <input
          className="wiki__search"
          type="search"
          placeholder={view === 'map' ? 'light up the map…' : 'search the brain…'}
          aria-label="Search pages"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />

        <p className="wiki__count" aria-live="polite">
          {results.length} {results.length === 1 ? 'page' : 'pages'}
          {drafts.length > 0 && ` · ${drafts.length} edited`}
        </p>
      </div>

      <div className="wrap wiki__domains" role="group" aria-label="Filter by domain">
        <button
          type="button"
          className={`wiki__domain${!domain ? ' wiki__domain--on' : ''}`}
          onClick={() => setParam('domain', null)}
        >
          ALL {data ? `(${data.counts.pages})` : ''}
        </button>
        {data?.domains.map((d) => (
          <button
            key={d.id}
            type="button"
            className={`wiki__domain${domain === d.id ? ' wiki__domain--on' : ''}`}
            onClick={() => setParam('domain', domain === d.id ? null : d.id)}
          >
            <span className="jp" aria-hidden="true">
              {DOMAIN_KANA[d.id] ?? '書'}
            </span>
            {d.id.toUpperCase()} ({d.count})
          </button>
        ))}
      </div>

      {loading && <p className="wrap wiki__state">waking the brain…</p>}
      {error && (
        <p className="wrap wiki__state">
          The wiki snapshot is missing ({error}). Run <code>node scripts/sync-wiki.mjs</code> and rebuild.
        </p>
      )}

      {data && view === 'map' && (
        <div className="wrap wiki__stage">
          <Cortex
            index={data}
            visible={visible}
            domain={domain}
            query={query}
            onClear={() => {
              setQuery('')
              setParam('domain', null)
            }}
          />
        </div>
      )}

      {data && view === 'briefs' && (
        <div className="wrap wiki__results">
          <p className="wiki__deck-note">
            The wiki writes a compressed block for machines — every date, name and number of a page
            packed into one paragraph. Here they are taken apart: dates on a rail, numbers pulled
            out, people linked, each sentence on its own. The original text is one toggle away.
          </p>
          <BriefDeck pages={results} />
        </div>
      )}

      {view === 'gaps' && (
        <div className="wrap wiki__results">
          <Gaps />
        </div>
      )}

      {data && view === 'list' && (
        <div className="wrap wiki__results">
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
          {page.locked ? <span className="wiki__card-seal">sealed</span> : <span>{page.words.toLocaleString()}w</span>}
          {page.charts > 0 && <span className="wiki__card-charts">{page.charts} charts</span>}
          {page.brief && <span className="wiki__card-brief">brief</span>}
          {page.links > 0 && <span>{page.links} links</span>}
          {draft && <span className="wiki__card-draft">edited</span>}
        </span>
      </Link>
    </li>
  )
}
