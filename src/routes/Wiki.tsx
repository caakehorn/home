import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Marquee } from '../components/Marquee'
import { Nav } from '../components/Nav'
import { SubHead } from '../components/Wordmark'
import { banner } from '../content/slogans'
import { BriefDeck } from '../wiki/BriefDeck'
import { Cortex } from '../wiki/Cortex'
import { Gaps } from '../wiki/Gaps'
import { StartRail } from '../wiki/StartRail'
import { useWikiIndex, type IndexEntry, type WikiIndex } from '../wiki/data'
import { HIDDEN_LABELS, hiddenEntries, inboundCounts, readingTime, type HiddenKind } from '../wiki/entry'
import { allDrafts } from '../wiki/store'
import { hasRead } from '../wiki/trail'
import './wiki.css'

const DOMAIN_KANA: Record<string, string> = {
  people: '人', interests: '趣味', mind: '心', timeline: '年表',
  self: '自己', work: '仕事', places: '場所', health: '健康', legal: '法',
  meta: '書',
}

/* ==========================================================================
   TWO AXES, NOT ONE

   DOMAIN says what a page is *about* — people, mind, timeline. It was the only
   facet this page had, and it is the less useful of the two for the question
   people actually arrive with, which is not "show me everything about people"
   (174 pages) but "show me the conclusions" or "show me what happened."

   TYPE says what a page *is*, and the wiki has always carried it in
   frontmatter: a synthesis is a conclusion reasoned from other pages, an event
   is something that happened on a date, an entity is a person or a place, a
   concept is an idea the corpus keeps returning to. Filtering on it turns 516
   undifferentiated cards into "the 58 things this wiki concluded," which is a
   browse somebody would actually make.

   The two compose. TIMELINE × EVENT is the chronology; MIND × SYNTHESIS is the
   argument; PEOPLE × ENTITY is the cast.
   ========================================================================== */
const TYPE_KANA: Record<string, string> = {
  entity: '実体', synthesis: '統合', concept: '概念', event: '事件',
  summary: '概要', report: '報告', profile: '人物', index: '索引',
  period: '時代', chat: '対話', note: '記録', journey: '道',
  dataset: '数表', update: '更新',
}

/** What the type is, in one line, for the chip's tooltip. */
const TYPE_NOTE: Record<string, string> = {
  entity: 'A person, a place, a thing — the cast and the props.',
  synthesis: 'A conclusion reasoned from other pages. The wiki thinking, not reporting.',
  concept: 'An idea the corpus keeps returning to.',
  event: 'Something that happened, on a date.',
  summary: 'A domain overview — the way in, not the depth.',
  report: 'A worked analysis of one source or question.',
  profile: 'A measured read of one mind.',
  index: 'Navigation. A list of what is under it.',
  period: 'A stretch of years treated as one thing.',
  chat: 'A conversation, kept as a conversation.',
  note: 'A dated observation, too small to be an event.',
  journey: 'A curated path through pages that were written apart.',
  dataset: 'Structured numbers, drawn as a chart.',
  update: 'A dated addendum to a page that already exists.',
}

/* The three generated ledgers, mirrored into `wiki/meta/` upstream precisely so
   the portal can serve them — the sync only reads `wiki/**`, so a root-level
   DIGEST.md is invisible here. They were reachable only by knowing the slug. */
const LEDGERS = [
  { slug: 'meta/digest', label: 'DIGEST', kana: '要', note: 'The state of the thing — size, shape, what it holds.' },
  { slug: 'meta/recent-activity', label: 'RECENT', kana: '新', note: 'What moved lately, newest first.' },
  { slug: 'meta/open-questions', label: 'OPEN', kana: '問', note: "Every gap the wiki admits it hasn't closed." },
] as const

const VIEWS = [
  { id: 'map', label: 'MAP', kana: '地図' },
  { id: 'list', label: 'LIST', kana: '一覧' },
  { id: 'briefs', label: 'BRIEFS', kana: '要約' },
  // Sits with the other three because it is the same act — a way of reading the
  // wiki. MAP is what connects, LIST is what exists, BRIEFS is what it says,
  // GAPS is what it admits it does not know.
  { id: 'gaps', label: 'GAPS', kana: '空白' },
  // The fifth way of reading the wiki, and the one it did not have: what is in
  // here that nothing points at, nobody finished, or somebody sealed. LIST
  // rendered all of those as the same card with a word count on it.
  { id: 'buried', label: 'BURIED', kana: '深部' },
] as const

type View = (typeof VIEWS)[number]['id']

/**
 * What kind of hidden a page is, or nothing if it is an ordinary page.
 *
 * Same vocabulary as the front page's BURIED rail, computed the same way, so a
 * page badged ORPHAN on the home page is badged ORPHAN here. Order matters:
 * sealed outranks everything (it is the only deliberate one), and a stub that
 * is also an orphan reads as a stub, because unfinished is the more useful
 * thing to know.
 */
function hiddenKind(page: IndexEntry, inbound: number): HiddenKind | null {
  if (page.locked) return 'sealed'
  if (page.status === 'stub' || page.words < 260) return 'stub'
  if (page.status === 'archived' || page.status === 'closed') return 'archived'
  if (inbound === 0 && page.type !== 'index' && !page.slug.endsWith('/index')) return 'orphan'
  return null
}

/** The map needs coordinates; an older snapshot may not carry them. */
const mappable = (data: WikiIndex) => Boolean(data.edges?.length && data.pages.some((p) => p.x !== undefined))

export function WikiIndexRoute() {
  const { data, error, loading } = useWikiIndex()
  const [params, setParams] = useSearchParams()
  const [query, setQuery] = useState('')
  const domain = params.get('domain')
  const type = params.get('type')
  const drafts = useMemo(() => Object.keys(allDrafts()), [])

  const requested = (params.get('view') ?? 'map') as View
  const view: View = data && !mappable(data) && requested === 'map' ? 'list' : requested

  const setParam = (key: string, value: string | null) => {
    const next = new URLSearchParams(params)
    if (value === null) next.delete(key)
    else next.set(key, value)
    setParams(next)
  }

  // Inbound link counts, for the orphan badge. Computed once per snapshot
  // rather than per card: it is a full pass over 3,110 edges and the list
  // re-renders on every keystroke in the search box.
  const inbound = useMemo(() => (data ? inboundCounts(data) : new Map<string, number>()), [data])

  const buried = useMemo(() => (data ? hiddenEntries(data, 24) : []), [data])

  const results = useMemo(() => {
    if (!data) return []
    const q = query.trim().toLowerCase()
    return data.pages
      .filter((p) => (view === 'briefs' ? p.brief : true))
      .filter((p) => (domain ? p.domain === domain : true))
      .filter((p) => (type ? p.type === type : true))
      .filter((p) =>
        !q
          ? true
          : p.title.toLowerCase().includes(q) ||
            p.slug.toLowerCase().includes(q) ||
            (p.knownFor ?? '').toLowerCase().includes(q),
      )
      .sort((a, b) => b.words - a.words)
  }, [data, view, domain, type, query])

  /* Type counts respect the domain filter but not their own, so the row reads
     as "what else is in here" rather than collapsing to the one chip you just
     pressed. Same convention the domain row would want if it had counts that
     moved. */
  const types = useMemo(() => {
    if (!data) return []
    const counts = new Map<string, number>()
    for (const p of data.pages) {
      if (domain && p.domain !== domain) continue
      if (!p.type) continue
      counts.set(p.type, (counts.get(p.type) ?? 0) + 1)
    }
    return [...counts].sort((a, b) => b[1] - a[1])
  }, [data, domain])

  // The map dims rather than removes, so it wants the set, not the list.
  const visible = useMemo(() => new Set(results.map((p) => p.slug)), [results])

  // Landing on the map with a stale domain filter would frame an empty lobe.
  useEffect(() => {
    if (domain && data && !data.domains.some((d) => d.id === domain)) setParam('domain', null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, domain])

  // A type that survives a domain change into a domain that has none of it
  // leaves the page reading "0 pages" with no visible cause, because the chip
  // that caused it is no longer in the row.
  useEffect(() => {
    if (type && types.length && !types.some(([id]) => id === type)) setParam('type', null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [types, type])

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

      {/* The three generated ledgers, one click from the front of the wiki.
          They were always here — `wiki/meta/` is synced like any other page —
          but the only way to reach one was to already know its slug, which
          means they were written for a reader who could not find them. */}
      <div className="wrap wiki__ledgers" role="group" aria-label="The wiki about itself">
        {LEDGERS.map((l) => (
          <Link key={l.slug} to={`/brain/${l.slug}`} className="wiki__ledger" title={l.note}>
            <span className="jp" aria-hidden="true">
              {l.kana}
            </span>
            <b>{l.label}</b>
            <i>{l.note}</i>
          </Link>
        ))}
      </div>

      {/* Above the deck bar, because the first question on this page is "where
          do I start" and the map is an answer to a later one. */}
      {data && (
        <div className="wrap">
          <StartRail index={data} />
        </div>
      )}

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

      {/* The second axis. DOMAIN is what a page is about; this is what it is. */}
      {types.length > 1 && (
        <div className="wrap wiki__types" role="group" aria-label="Filter by kind of entry">
          <span className="wiki__types-label">KIND</span>
          <button
            type="button"
            className={`wiki__type${!type ? ' wiki__type--on' : ''}`}
            onClick={() => setParam('type', null)}
          >
            ANY
          </button>
          {types.map(([id, count]) => (
            <button
              key={id}
              type="button"
              className={`wiki__type${type === id ? ' wiki__type--on' : ''}`}
              title={TYPE_NOTE[id]}
              onClick={() => setParam('type', type === id ? null : id)}
            >
              <span className="jp" aria-hidden="true">
                {TYPE_KANA[id] ?? '書'}
              </span>
              {id.toUpperCase()} ({count})
            </button>
          ))}
        </div>
      )}

      {/* A filter that finds nothing has to say so. The map dims rather than
          removes, so it is the only view that does not need this. */}
      {data && results.length === 0 && view !== 'map' && view !== 'gaps' && (
        <p className="wrap wiki__state">
          Nothing matches{type ? ` kind ${type.toUpperCase()}` : ''}
          {domain ? ` in ${domain.toUpperCase()}` : ''}
          {query.trim() ? ` for “${query.trim()}”` : ''}.{' '}
          <button
            type="button"
            className="wiki__reset"
            onClick={() => {
              setQuery('')
              const next = new URLSearchParams(params)
              next.delete('domain')
              next.delete('type')
              setParams(next)
            }}
          >
            clear the filters
          </button>
        </p>
      )}

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

      {data && view === 'buried' && (
        <div className="wrap wiki__results">
          <p className="wiki__deck-note">
            Four different kinds of hidden, which used to render as four identical cards with a
            word count on them. <b>Sealed</b> is deliberate — the row is the whole entry until
            somebody types the phrase. <b>Orphan</b> is an accident: finished, wired into the
            corpus, and linked from nowhere, so you can only arrive on purpose. <b>Stub</b> is
            unfinished. <b>Closed</b> is over. Nothing here is reachable by browsing, which is
            exactly why it is worth reading.
          </p>

          <ul className="wiki__buried">
            {buried.map(({ kind, page }) => {
              const badge = HIDDEN_LABELS[kind]
              return (
                <li key={page.slug} style={{ ['--glow' as string]: `var(--n${badge.tone})` }}>
                  <Link to={`/brain/${page.slug}`} className={`wiki__grave wiki__grave--${kind}`}>
                    <span className="wiki__grave-badge">
                      <span className="jp" aria-hidden="true">
                        {badge.kana}
                      </span>
                      {badge.label}
                    </span>
                    <h2 className="wiki__grave-title">{page.title}</h2>
                    {page.knownFor && <p className="wiki__grave-blurb">{page.knownFor}</p>}
                    <p className="wiki__grave-why">{badge.note}</p>
                    <span className="wiki__grave-meta">
                      {page.domain} · {page.words.toLocaleString()}w · {readingTime(page.words)}
                      {hasRead(page.slug) && <em>read</em>}
                    </span>
                  </Link>
                </li>
              )
            })}
          </ul>
        </div>
      )}

      {data && view === 'list' && (
        <div className="wrap wiki__results">
          <ul className="wiki__grid">
            {results.map((page) => (
              <PageCard
                key={page.slug}
                page={page}
                draft={drafts.includes(page.slug)}
                kind={hiddenKind(page, inbound.get(page.slug) ?? 0)}
              />
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

function PageCard({
  page,
  draft,
  kind,
}: {
  page: IndexEntry
  draft: boolean
  kind: HiddenKind | null
}) {
  const badge = kind ? HIDDEN_LABELS[kind] : null
  const read = hasRead(page.slug)

  return (
    <li>
      <Link
        to={`/brain/${page.slug}`}
        className={`wiki__card${badge ? ` wiki__card--${kind}` : ''}${read ? ' wiki__card--read' : ''}`}
        style={badge ? { ['--glow' as string]: `var(--n${badge.tone})` } : undefined}
      >
        <span className="wiki__card-domain">
          {page.domain}
          {/* The one thing this grid of 487 identical cards never told you:
              which of them are not ordinary. */}
          {badge && (
            <span className="wiki__card-kind" title={badge.note}>
              <span className="jp" aria-hidden="true">
                {badge.kana}
              </span>
              {badge.label}
            </span>
          )}
        </span>
        <h2 className="wiki__card-title">{page.title}</h2>
        {page.knownFor && <p className="wiki__card-blurb">{page.knownFor}</p>}
        <span className="wiki__card-meta">
          {page.locked ? (
            <span className="wiki__card-seal">sealed</span>
          ) : (
            <span>{readingTime(page.words)}</span>
          )}
          {page.charts > 0 && <span className="wiki__card-charts">{page.charts} charts</span>}
          {page.brief && <span className="wiki__card-brief">brief</span>}
          {page.links > 0 && <span>{page.links} links</span>}
          {draft && <span className="wiki__card-draft">edited</span>}
          {read && <span className="wiki__card-read">read</span>}
        </span>
      </Link>
    </li>
  )
}
