import { Link } from 'react-router-dom'
import { Frame } from '../Frame'
import { useSet, type Instrument, type WikiSet } from '../core'

/**
 * ◈ WIKI IX · THE HEALTH
 *
 * Forensics on the graph itself rather than on what it says: how many links
 * go both ways, how the out-degree is distributed, which domains point outward
 * and which are only pointed at, and the ring of pages nothing links to.
 *
 * ---- "health" is the old name, and it is the wrong word --------------------
 *
 * The old console called this instrument HEALTH, which implies a diagnosis — a
 * graph that is well or unwell, and by extension a corpus doing better or worse
 * than it should. Nothing here knows what a healthy wiki looks like, so nothing
 * here says. **An orphan is a page with an inbound link count of zero**, which
 * is a count, not a symptom. Reciprocity is the share of links whose reverse
 * also exists, which is a count over a count. Neither is scored, thresholded,
 * or coloured red for being low.
 *
 * The name is kept because the rack keeps the old console's names. The reading
 * is the reader's.
 */
export function Health({ instrument }: { instrument: Instrument }) {
  const { data, error, loading } = useSet<WikiSet>('wiki.json')

  if (loading)
    return (
      <Frame instrument={instrument}>
        <p className="inst__state">counting the edges both ways…</p>
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

  const { health } = data
  const degreePeak = Math.max(...health.outDegrees.map((d) => d.count))
  const domainPeak = Math.max(...health.byDomain.map((d) => d.out + d.in))

  return (
    <Frame
      instrument={instrument}
      footer={
        <p className="inst__method">
          <b>NOTHING HERE IS A DIAGNOSIS</b> The old console called this HEALTH, which implies a
          graph that is well or unwell. Nothing in this building knows what a healthy wiki looks
          like, so nothing says. An orphan is a page whose inbound link count is zero — a count,
          not a symptom. Reciprocity is the share of links whose reverse also exists — a count over
          a count. Neither is scored, thresholded, or coloured for being low. The old name is kept
          because the rack keeps the old console&apos;s names; the reading is the reader&apos;s.
        </p>
      }
    >
      <div className="pt-split pt-split--wide">
        <div className="pt-stack">
          <h3 className="pt-sub">HOW MANY PAGES EACH PAGE POINTS AT</h3>
          <ol className="pt-rows" style={{ ['--pt-label' as string]: '5.5rem' }}>
            {health.outDegrees.map((row) => (
              <li key={row.degree} className="pt-row" style={{ ['--pt-label' as string]: '5.5rem' }}>
                <span className="pt-label">
                  {row.degree} link{row.degree === 1 ? '' : 's'}
                </span>
                <span className="pt-bar">
                  <span
                    className="pt-fill"
                    style={{ inlineSize: `${(row.count / degreePeak) * 100}%` }}
                  />
                </span>
                <span className="pt-value">{row.count}</span>
              </li>
            ))}
          </ol>
          <p className="pt-note">
            One row per out-degree. The long tail on the right is the handful of index and timeline
            pages that name most of the corpus; the block at the top is every page that names
            nothing.
          </p>

          <h3 className="pt-sub">BY DOMAIN · OUT AND IN</h3>
          <ol className="pt-rows" style={{ ['--pt-label' as string]: '5.5rem' }}>
            {health.byDomain.map((row) => (
              <li key={row.id} className="pt-row" style={{ ['--pt-label' as string]: '5.5rem' }}>
                <span className="pt-label">{row.id}</span>
                <span className="pt-bar pt-bar--tall" style={{ position: 'relative' }}>
                  <span
                    className="pt-fill"
                    style={{ inlineSize: `${(row.out / domainPeak) * 100}%`, blockSize: '50%' }}
                  />
                  <span
                    className="pt-fill pt-fill--alt"
                    style={{ inlineSize: `${(row.in / domainPeak) * 100}%`, blockSize: '50%' }}
                  />
                </span>
                <span className="pt-value">
                  {row.out} / {row.in}
                </span>
              </li>
            ))}
          </ol>
          <p className="pt-note">
            Top half is links the domain makes, bottom half links it receives, both on one scale.
            The two are not the same number for any domain, and the gap is the whole panel.
          </p>
        </div>

        <div className="pt-stack">
          <dl className="pt-facts" style={{ marginTop: 0 }}>
            <dt>PAGES</dt>
            <dd>{health.pages.toLocaleString()}</dd>
            <dt>LINKS</dt>
            <dd>{health.edges.toLocaleString()} one page naming another</dd>
            <dt>BOTH WAYS</dt>
            <dd>
              {(health.reciprocal / 2).toLocaleString()} pairs · {health.reciprocal.toLocaleString()}{' '}
              of {health.edges.toLocaleString()} links (
              {((health.reciprocal / health.edges) * 100).toFixed(1)}%) have their reverse in the
              corpus too
            </dd>
            <dt>MEAN OUT-DEGREE</dt>
            <dd>{(health.edges / health.pages).toFixed(1)} links per page</dd>
            <dt>POINTED AT BY NOTHING</dt>
            <dd>{health.orphans.length} pages, listed below</dd>
          </dl>

          <h3 className="pt-sub">THE ORPHAN RING · {health.orphans.length}</h3>
          <p className="pt-note">
            Pages no other page links to. They are reachable from the index and from search — an
            orphan is unreferenced, not unreachable, and the difference matters enough to print.
          </p>
          <ol
            className="pt-rows pt-scroll"
            style={{ ['--pt-label' as string]: '1fr', ['--pt-value' as string]: '6.4rem' }}
          >
            {health.orphans.map((row) => (
              <li
                key={row.slug}
                className="pt-row"
                style={{ ['--pt-label' as string]: '1fr', ['--pt-value' as string]: '6.4rem' }}
              >
                <span className="pt-label">
                  <Link to={`/brain/${row.slug}`}>{row.title}</Link>
                </span>
                <span className="pt-bar" />
                <span className="pt-value">
                  {row.domain.slice(0, 6)} · {row.out}→
                </span>
              </li>
            ))}
          </ol>
          <p className="pt-note">
            The number after each is the domain and how many pages it points at itself. Nine of the
            ten are a domain&apos;s own index: the pages that name the most are the pages nothing
            names back. That is a fact about how this wiki is wired rather than a fault in it, and
            it is left as a count.
          </p>
        </div>
      </div>
    </Frame>
  )
}
