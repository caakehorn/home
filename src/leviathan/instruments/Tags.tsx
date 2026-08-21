import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Frame } from '../Frame'
import { DOMAIN_KANA, useSet, type Instrument, type WikiSet } from '../core'

/**
 * ◈ WIKI VII · THE TAGS
 *
 * Twenty-five themes across 457 tagged pages, and what sits under each one.
 * Pick a tag and the domains it spans are counted; pick two and the pages
 * carrying both are the answer.
 *
 * ---- the interesting number is the overlap ---------------------------------
 *
 * A tag on its own is a count. Two tags together are a count of the pages the
 * wiki filed under both, which is the closest this corpus comes to saying two
 * subjects belong together without anybody writing a sentence claiming it. The
 * old console drew that as gravity, with pages torn between the tags pulling
 * them. Here it is an intersection, because a count is legible and a physics
 * simulation of a count is a mood.
 *
 * ---- the parse, which is not a filter --------------------------------------
 *
 * Tags arrive as raw front-matter text rather than parsed lists, so they come
 * out of the snapshot looking like `[music-production` and `digital-footprint]`.
 * The brackets and commas a YAML array leaves behind are stripped at build
 * time. That is a parse — nothing is dropped for what it says, and the 25 that
 * come out are every distinct tag in the corpus.
 */
export function Tags({ instrument }: { instrument: Instrument }) {
  const { data, error, loading } = useSet<WikiSet>('wiki.json')
  const [picked, setPicked] = useState<string[]>([])

  const toggle = (tag: string) =>
    setPicked((now) => (now.includes(tag) ? now.filter((t) => t !== tag) : [...now, tag]))

  const under = useMemo(() => {
    if (!data || !picked.length) return null
    const sets = picked.map(
      (tag) => new Set((data.tags.find((t) => t.tag === tag)?.pages ?? []).map((p) => p.slug)),
    )
    const all = new Map<string, { slug: string; title: string; domain: string }>()
    for (const tag of data.tags) {
      if (!picked.includes(tag.tag)) continue
      for (const page of tag.pages) all.set(page.slug, page)
    }
    const both = [...all.values()].filter((page) => sets.every((s) => s.has(page.slug)))
    return { both, any: [...all.values()] }
  }, [data, picked])

  if (loading)
    return (
      <Frame instrument={instrument}>
        <p className="inst__state">sorting the themes…</p>
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

  const top = data.tags[0]?.count ?? 1
  const tagged = new Set(data.tags.flatMap((t) => t.pages.map((p) => p.slug))).size

  /** How a tag's pages fall across the nine domains — a count, per tag. */
  const spread = (tag: string) => {
    const row = data.tags.find((t) => t.tag === tag)
    if (!row) return []
    const bins = new Map<string, number>()
    for (const page of row.pages) bins.set(page.domain, (bins.get(page.domain) ?? 0) + 1)
    return [...bins].sort((a, b) => b[1] - a[1])
  }

  return (
    <Frame
      instrument={instrument}
      controls={
        picked.length > 0 && (
          <button type="button" className="pt-chip pt-chip--on" onClick={() => setPicked([])}>
            CLEAR {picked.length} ×
          </button>
        )
      }
      footer={
        <p className="inst__method">
          <b>THE PARSE IS NOT A FILTER</b> Tags arrive as raw front-matter text rather than parsed
          lists, so they leave the snapshot looking like <code>[music-production</code> and{' '}
          <code>digital-footprint]</code>. The brackets and commas a YAML array leaves behind are
          stripped at build time and nothing else is: the 25 below are every distinct tag in the
          corpus, and none was dropped for what it says.
        </p>
      }
    >
      <div className="pt-split pt-split--wide">
        <div className="pt-stack">
          <h3 className="pt-sub">EVERY TAG · {data.tagsTotal}</h3>
          <ol className="pt-rows" style={{ ['--pt-label' as string]: '11rem' }}>
            {data.tags.map((tag) => (
              <li key={tag.tag}>
                <button
                  type="button"
                  className="pt-row-btn"
                  style={{ ['--pt-label' as string]: '11rem', ['--pt-value' as string]: '2.8rem' }}
                  aria-pressed={picked.includes(tag.tag)}
                  onClick={() => toggle(tag.tag)}
                >
                  <span className="pt-label">
                    {picked.includes(tag.tag) ? '▪ ' : ''}
                    {tag.tag}
                  </span>
                  <span className="pt-bar">
                    <span className="pt-fill" style={{ inlineSize: `${(tag.count / top) * 100}%` }} />
                  </span>
                  <span className="pt-value">{tag.count}</span>
                </button>
              </li>
            ))}
          </ol>
          <p className="pt-note">
            Click a tag to hold it. Hold two and the pages carrying both are counted — which is the
            closest this corpus comes to saying two subjects belong together without anybody writing
            a sentence that claims it.
          </p>
        </div>

        <div className="pt-stack">
          {under ? (
            <>
              <h3 className="pt-sub">{picked.join(' + ').toUpperCase()}</h3>
              <dl className="pt-facts" style={{ marginTop: 0 }}>
                <dt>{picked.length > 1 ? 'CARRYING ALL' : 'CARRYING IT'}</dt>
                <dd>
                  {under.both.length} page{under.both.length === 1 ? '' : 's'}
                </dd>
                {picked.length > 1 && (
                  <>
                    <dt>CARRYING ANY</dt>
                    <dd>{under.any.length} pages</dd>
                  </>
                )}
              </dl>
              <ol className="pt-rows pt-scroll pt-scroll--tall" style={{ ['--pt-label' as string]: '1fr' }}>
                {under.both.map((page) => (
                  <li key={page.slug} className="pt-row" style={{ ['--pt-label' as string]: '1fr' }}>
                    <span className="pt-label">
                      <Link to={`/brain/${page.slug}`}>{page.title}</Link>
                    </span>
                    <span className="pt-bar" />
                    <span className="pt-value">
                      <span className="jp">{DOMAIN_KANA[page.domain] ?? ''}</span>{' '}
                      {page.domain.slice(0, 5)}
                    </span>
                  </li>
                ))}
              </ol>
              {under.both.length === 0 && (
                <p className="pt-note">
                  No page carries all of those. That is a fact about the filing, not a gap to be
                  filled in.
                </p>
              )}
              {picked.length === 1 && (
                <>
                  <h3 className="pt-sub">WHERE IT LANDS</h3>
                  <ol className="pt-rows" style={{ ['--pt-label' as string]: '5.5rem' }}>
                    {spread(picked[0]).map(([domain, count]) => (
                      <li key={domain} className="pt-row" style={{ ['--pt-label' as string]: '5.5rem' }}>
                        <span className="pt-label">{domain}</span>
                        <span className="pt-bar">
                          <span
                            className="pt-fill pt-fill--alt"
                            style={{ inlineSize: `${(count / spread(picked[0])[0][1]) * 100}%` }}
                          />
                        </span>
                        <span className="pt-value">{count}</span>
                      </li>
                    ))}
                  </ol>
                </>
              )}
            </>
          ) : (
            <>
              <p className="pt-note">
                Nothing held. Pick a tag on the left to see what is filed under it and which domains
                it crosses.
              </p>
              <dl className="pt-facts" style={{ marginTop: 0 }}>
                <dt>TAGS</dt>
                <dd>{data.tagsTotal} distinct, across the whole corpus</dd>
                <dt>PAGES TAGGED</dt>
                <dd>
                  {tagged} of {data.counts.pages} · {data.counts.pages - tagged} carry none
                </dd>
                <dt>BIGGEST</dt>
                <dd>
                  {data.tags[0]?.tag} · {data.tags[0]?.count} pages
                </dd>
                <dt>SMALLEST</dt>
                <dd>
                  {data.tags[data.tags.length - 1]?.tag} ·{' '}
                  {data.tags[data.tags.length - 1]?.count} pages
                </dd>
              </dl>
            </>
          )}
        </div>
      </div>
    </Frame>
  )
}
