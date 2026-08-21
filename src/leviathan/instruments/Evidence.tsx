import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Frame } from '../Frame'
import { useSet, type Instrument, type WikiSet } from '../core'

type View = 'roots' | 'collections' | 'extensions'

/**
 * ◈ WIKI X · THE EVIDENCE
 *
 * What the wiki cites: 1,170 source references across 486 pages, sorted by the
 * directory each path names and the file type it ends in.
 *
 * ---- this one was SEALED and should not have been -------------------------
 *
 * The rack had it waiting on "the raw/ tree the citations point into", which is
 * true and is the wrong reason. The **citations themselves ship** — they are in
 * `lists.sources` on every page in the snapshot. Being unable to open a source
 * does not stop you counting how many there are and what they point at, and
 * that count is the instrument. What cannot be done here is checking a citation
 * against the thing it cites, which is a different instrument nobody has built.
 *
 * ---- sorted by the path, not by a guess about it ---------------------------
 *
 * The first cut of the dataset behind this ran a table of regexes over each
 * path, mapping them onto categories like AI CHATS and PLATFORM EXPORTS. That
 * is a hand-made semantic guess about somebody else's filing — the exact shape
 * THE RULE is written against — and it dumped 546 of the 1,170 references into
 * OTHER, so it was inaccurate as well as editorial. Sorting by the directory
 * the path names and the extension it ends in is a fact about the string, and
 * it leaves nothing unclassified.
 *
 * **A count of citations is not a measure of rigour.** A page with forty
 * references is a page with forty references. Nothing here ranks pages for
 * being well-sourced, and the 139 pages that cite nothing are counted rather
 * than flagged.
 */
export function Evidence({ instrument }: { instrument: Instrument }) {
  const { data, error, loading } = useSet<WikiSet>('wiki.json')
  const [view, setView] = useState<View>('roots')

  const rows = useMemo(() => {
    if (!data) return []
    return data.evidence[view] ?? []
  }, [data, view])

  if (loading)
    return (
      <Frame instrument={instrument}>
        <p className="inst__state">counting the citations…</p>
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

  const { evidence } = data
  const peak = Math.max(1, ...rows.map((r) => r.count))
  const cited = evidence.pages.filter((p) => p.sources > 0)
  const mostCited = cited.slice(0, 16)

  return (
    <Frame
      instrument={instrument}
      controls={
        <div className="pt-chips" role="group" aria-label="Sort by">
          {(
            [
              ['roots', 'BY DIRECTORY'],
              ['collections', 'BY COLLECTION'],
              ['extensions', 'BY FILE TYPE'],
            ] as [View, string][]
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              className={`pt-chip${view === value ? ' pt-chip--on' : ''}`}
              aria-pressed={view === value}
              onClick={() => setView(value)}
            >
              {label}
            </button>
          ))}
        </div>
      }
      footer={
        <p className="inst__method">
          <b>WHY THIS IS NOT SEALED ANY MORE</b> The rack had it waiting on the <code>raw/</code>
          {' '}tree the citations point into, which is true and is the wrong reason. The citations
          themselves ship, in <code>lists.sources</code> on every page. Being unable to open a
          source does not stop you counting how many there are and what they point at, and that
          count is this instrument. Checking a citation against the thing it cites is a different
          instrument, and nobody has built it.
        </p>
      }
    >
      <div className="pt-split pt-split--wide">
        <div className="pt-stack">
          <h3 className="pt-sub">
            {view === 'roots'
              ? 'WHERE THE CITATIONS POINT'
              : view === 'collections'
                ? 'WHICH COLLECTION'
                : 'WHAT KIND OF FILE'}{' '}
            · {evidence.references.toLocaleString()} REFERENCES
          </h3>
          <ol className="pt-rows pt-scroll" style={{ ['--pt-label' as string]: '14rem' }}>
            {rows.map((row) => (
              <li key={row.name} className="pt-row" style={{ ['--pt-label' as string]: '14rem' }}>
                <span className="pt-label" title={row.name}>
                  {row.name}
                </span>
                <span className="pt-bar">
                  <span className="pt-fill" style={{ inlineSize: `${(row.count / peak) * 100}%` }} />
                </span>
                <span className="pt-value">{row.count}</span>
              </li>
            ))}
          </ol>
          <p className="pt-note">
            Sorted by the directory the path names and the extension it ends in — both facts about
            the string. Nothing is classified by guessing what a file probably contains, and
            nothing lands in an OTHER bucket.
          </p>

          <h3 className="pt-sub">MOST CITED PAGES</h3>
          <ol className="pt-rows" style={{ ['--pt-label' as string]: '1fr' }}>
            {mostCited.map((page) => (
              <li key={page.slug} className="pt-row" style={{ ['--pt-label' as string]: '1fr' }}>
                <span className="pt-label">
                  <Link to={`/brain/${page.slug}`}>{page.title}</Link>
                </span>
                <span className="pt-bar">
                  <span
                    className="pt-fill pt-fill--alt"
                    style={{ inlineSize: `${(page.sources / mostCited[0].sources) * 100}%` }}
                  />
                </span>
                <span className="pt-value">{page.sources}</span>
              </li>
            ))}
          </ol>
        </div>

        <div className="pt-stack">
          <dl className="pt-facts" style={{ marginTop: 0 }}>
            <dt>REFERENCES</dt>
            <dd>{evidence.references.toLocaleString()} across the corpus</dd>
            <dt>PAGES CITING</dt>
            <dd>
              {cited.length} of {data.counts.pages}
            </dd>
            <dt>PAGES CITING NOTHING</dt>
            <dd>
              {evidence.uncited} — counted, not flagged. A page with no citation is a page with no
              citation
            </dd>
            <dt>MEAN, WHERE THERE IS ONE</dt>
            <dd>
              {(evidence.references / Math.max(1, cited.length)).toFixed(1)} references per citing
              page
            </dd>
            <dt>DIRECTORIES NAMED</dt>
            <dd>{evidence.roots.length}</dd>
            <dt>FILE TYPES</dt>
            <dd>{evidence.extensions.length}</dd>
          </dl>

          <p className="pt-note">
            <b>A COUNT IS NOT A MEASURE OF RIGOUR</b> A page with forty references is a page with
            forty references. Nothing here ranks pages for being well-sourced, and nothing marks a
            page for being thin — the 139 that cite nothing include index pages, which have nothing
            to cite.
          </p>

          <h3 className="pt-sub">CITATIONS PER PAGE</h3>
          <ol className="pt-rows" style={{ ['--pt-label' as string]: '5.5rem' }}>
            {bucket(evidence.pages.map((p) => p.sources)).map((row) => (
              <li key={row.label} className="pt-row" style={{ ['--pt-label' as string]: '5.5rem' }}>
                <span className="pt-label">{row.label}</span>
                <span className="pt-bar">
                  <span
                    className="pt-fill"
                    style={{
                      inlineSize: `${(row.count / Math.max(...bucket(evidence.pages.map((p) => p.sources)).map((r) => r.count))) * 100}%`,
                    }}
                  />
                </span>
                <span className="pt-value">{row.count}</span>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </Frame>
  )
}

/** Disclosed buckets, and the only thresholds on the page. They shape a histogram; they decide nothing. */
const EDGES = [0, 1, 2, 3, 5, 10, 20]

function bucket(values: number[]) {
  return EDGES.map((edge, i) => {
    const next = EDGES[i + 1]
    const label =
      edge === 0 ? 'none' : next === undefined ? `${edge}+` : next - edge === 1 ? `${edge}` : `${edge}–${next - 1}`
    const count = values.filter((v) =>
      edge === 0 ? v === 0 : next === undefined ? v >= edge : v >= edge && v < next,
    ).length
    return { label, count }
  })
}
