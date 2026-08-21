import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Frame } from '../Frame'
import { useSet, type Instrument, type WikiSet } from '../core'

/**
 * ◈ WIKI III · THE CLAIMS
 *
 * The links read back as what they actually are: 689 sentences in which one
 * page says something about another, printed whole, in the wiki's own words,
 * with both ends clickable.
 *
 * ---- what changed in the port ---------------------------------------------
 *
 * The old console called these *typed* edges and drew the type on the feed.
 * This snapshot does not carry types — `meta.related` is empty on every page
 * and `lists.connections` is a bare list of paths — so there was a choice
 * between inventing a classifier and showing the thing the type was standing
 * in for. Inventing one would have been a keyword list wearing a schema, and
 * THE RULE has a word for that.
 *
 * So the instrument shows the sentence. It is strictly more information than a
 * type label and strictly less interpretation, which is the trade this building
 * takes every time it is offered.
 *
 * ---- what a claim is ------------------------------------------------------
 *
 * A sentence of prose that names another page, extracted at build time. Table
 * rows, headings and lists of bare links are not claims and are not here.
 * Nothing is ranked: the feed is in page order, and the only filters are the
 * ones the reader turns on.
 */
export function Claims({ instrument }: { instrument: Instrument }) {
  const { data, error, loading } = useSet<WikiSet>('wiki.json')
  const [domain, setDomain] = useState<string | null>(null)
  const [find, setFind] = useState('')

  const titles = useMemo(
    () => (data ? new Map(data.web.nodes.map((n) => [n.slug, n])) : new Map()),
    [data],
  )

  const shown = useMemo(() => {
    if (!data) return []
    const needle = find.trim().toLowerCase()
    return data.claims.filter((claim) => {
      if (domain && titles.get(claim.from)?.domain !== domain) return false
      if (!needle) return true
      return (
        claim.say.toLowerCase().includes(needle) ||
        claim.from.toLowerCase().includes(needle) ||
        claim.to.toLowerCase().includes(needle)
      )
    })
  }, [data, domain, find, titles])

  if (loading)
    return (
      <Frame instrument={instrument}>
        <p className="inst__state">reading the links back…</p>
      </Frame>
    )

  if (error || !data)
    return (
      <Frame instrument={instrument}>
        <p className="inst__state">
          The dataset is missing ({error}). Run <code>npm run wiki-instruments</code> and rebuild.
        </p>
      </Frame>
    )

  /** Which pages get talked about most in the feed, which is not the same as most linked. */
  const named = new Map<string, number>()
  for (const claim of shown) named.set(claim.to, (named.get(claim.to) ?? 0) + 1)
  const mostNamed = [...named]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12)
    .map(([slug, count]) => ({ slug, count, title: titles.get(slug)?.title ?? slug }))

  return (
    <Frame
      instrument={instrument}
      controls={
        <div className="pt-chips" role="group" aria-label="Domain">
          <button
            type="button"
            className={`pt-chip${domain === null ? ' pt-chip--on' : ''}`}
            aria-pressed={domain === null}
            onClick={() => setDomain(null)}
          >
            ALL
          </button>
          {data.domains.map((d) => (
            <button
              key={d.id}
              type="button"
              className={`pt-chip${domain === d.id ? ' pt-chip--on' : ''}`}
              aria-pressed={domain === d.id}
              onClick={() => setDomain(domain === d.id ? null : d.id)}
            >
              {d.id.toUpperCase()}
            </button>
          ))}
        </div>
      }
      footer={
        <p className="inst__method">
          <b>THE TYPES DID NOT COME ACROSS</b> The old console drew a type on each edge. This
          snapshot does not carry them — <code>meta.related</code> is empty on every page — so the
          choice was between inventing a classifier and showing the thing the type stood in for.
          Inventing one would have been a keyword list wearing a schema. The sentence is strictly
          more information than a type label and strictly less interpretation.
        </p>
      }
    >
      <div className="pt-split pt-split--wide">
        <div className="pt-stack">
          <label className="pt-note" style={{ display: 'grid', gap: '0.3rem' }}>
            <span>
              <b>FIND</b> in {data.claimsTotal.toLocaleString()} claims — showing{' '}
              {shown.length.toLocaleString()}
            </span>
            <input
              type="search"
              value={find}
              onChange={(e) => setFind(e.target.value)}
              placeholder="a word, or a page slug"
              style={{
                font: 'inherit',
                fontFamily: 'var(--f-mono)',
                fontSize: '0.72rem',
                padding: '0.35rem 0.5rem',
                color: 'var(--text)',
                background: 'var(--void)',
                border: 'var(--staple) solid color-mix(in srgb, var(--text-dim) 45%, transparent)',
              }}
            />
          </label>

          <ol className="pt-cards pt-scroll pt-scroll--tall">
            {shown.slice(0, 300).map((claim, i) => (
              <li key={`${claim.from}-${claim.to}-${i}`} className="pt-card">
                <span className="pt-card__head">
                  <Link to={`/brain/${claim.from}`}>{titles.get(claim.from)?.title ?? claim.from}</Link>
                  <span aria-hidden="true">→</span>
                  <Link to={`/brain/${claim.to}`}>{titles.get(claim.to)?.title ?? claim.to}</Link>
                </span>
                <p className="pt-card__say">{claim.say}</p>
              </li>
            ))}
          </ol>
          {shown.length > 300 && (
            <p className="pt-note">
              300 of {shown.length.toLocaleString()} shown. Narrow it with FIND rather than with a
              ranking — nothing here decides which claim matters.
            </p>
          )}
        </div>

        <div className="pt-stack">
          <p className="pt-note">
            One sentence per link, in page order. A claim is prose that names another page; table
            rows, headings and lists of bare links are not claims and are not here.
          </p>

          <h3 className="pt-sub">MOST NAMED IN THE FEED</h3>
          <ol className="pt-rows" style={{ ['--pt-label' as string]: '1fr' }}>
            {mostNamed.map((row) => (
              <li key={row.slug}>
                <button
                  type="button"
                  className="pt-row-btn"
                  style={{ ['--pt-label' as string]: '1fr', ['--pt-value' as string]: '2.6rem' }}
                  onClick={() => setFind(row.slug)}
                >
                  <span className="pt-label">{row.title}</span>
                  <span className="pt-bar">
                    <span
                      className="pt-fill"
                      style={{ inlineSize: `${(row.count / (mostNamed[0]?.count || 1)) * 100}%` }}
                    />
                  </span>
                  <span className="pt-value">{row.count}</span>
                </button>
              </li>
            ))}
          </ol>

          <dl className="pt-facts">
            <dt>CLAIMS</dt>
            <dd>{data.claimsTotal.toLocaleString()} sentences that name another page</dd>
            <dt>LINKS IN TOTAL</dt>
            <dd>
              {data.web.edges.length.toLocaleString()} — the rest are in tables, headings and link
              lists, which are not sentences
            </dd>
            <dt>PAGES SPEAKING</dt>
            <dd>{new Set(data.claims.map((c) => c.from)).size} of {data.counts.pages}</dd>
            <dt>PAGES SPOKEN OF</dt>
            <dd>{new Set(data.claims.map((c) => c.to)).size}</dd>
          </dl>
        </div>
      </div>
    </Frame>
  )
}
