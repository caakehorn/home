import { useMemo, useState } from 'react'
import { Frame } from '../Frame'
import { useSet, type AccretionPoint, type AccretionSet, type Instrument } from '../core'

/**
 * ◈ WIKI XI · THE CHRONICLE
 *
 * The commits themselves: 147 of them, each with the word its author typed in
 * front of it and what it did to the corpus.
 *
 * ---- the four pens, and why they are not here ------------------------------
 *
 * The old console drew this as four lanes — INGEST, CONNECT, WRITE, MAINTAIN —
 * which meant somebody had a rule for sorting commits into four buckets. That
 * rule is not in the vendored data, so building the old instrument would have
 * meant writing a new one: a keyword list deciding that this commit is
 * *ingesting* and that one is *maintaining*, presented as a measurement of how
 * the wiki was built. THE RULE has a word for that.
 *
 * What is a fact rather than a reading is **the prefix the author typed**.
 * `ingest:`, `rewrite:`, `docs:`, `fix:` — those are not my classification of
 * the commit, they are the commit's own first word. So the lanes here are the
 * vocabulary the author actually used, in the proportions they actually used
 * it, and the ones that carry no prefix are grouped as carrying no prefix
 * rather than sorted into a bucket on their behalf.
 *
 * ---- what makes it a different instrument ----------------------------------
 *
 * IV · THE ACCRETION plots four cumulative counts against elapsed time. ◈ WIKI
 * XII · THE GENESIS replays the commits one at a time. This one asks what the
 * commits *were*: which kinds of work added pages, which added only bytes, and
 * which added nothing but still landed. All three read one dataset.
 */
export function Chronicle({ instrument }: { instrument: Instrument }) {
  const { data, error, loading } = useSet<AccretionSet>('accretion.json')
  const [kind, setKind] = useState<string | null>(null)

  const read = useMemo(() => {
    if (!data) return null

    const kinds = new Map<
      string,
      { kind: string; commits: number; pages: number; bytes: number; links: number; edges: number }
    >()
    const rows: (AccretionPoint & { kind: string })[] = []

    for (const point of data.points) {
      const k = prefixOf(point.subject)
      rows.push({ ...point, kind: k })
      const row = kinds.get(k) ?? { kind: k, commits: 0, pages: 0, bytes: 0, links: 0, edges: 0 }
      row.commits++
      if (point.d) {
        row.pages += point.d.pages
        row.bytes += point.d.bytes
        row.links += point.d.links
        row.edges += point.d.edges
      }
      kinds.set(k, row)
    }

    return {
      rows: rows.reverse(),
      kinds: [...kinds.values()].sort((a, b) => b.commits - a.commits || a.kind.localeCompare(b.kind)),
    }
  }, [data])

  if (loading)
    return (
      <Frame instrument={instrument}>
        <p className="inst__state">reading the log…</p>
      </Frame>
    )

  if (error || !data || !read)
    return (
      <Frame instrument={instrument}>
        <p className="inst__state">
          The dataset is missing ({error}). Run <code>npm run accretion -- ../wiki-brain</code> and
          rebuild.
        </p>
      </Frame>
    )

  const shown = kind ? read.rows.filter((r) => r.kind === kind) : read.rows
  const peak = Math.max(...read.kinds.map((k) => k.commits))
  const pagePeak = Math.max(1, ...read.kinds.map((k) => Math.abs(k.pages)))
  const silent = read.rows.filter((r) => r.d && r.d.pages === 0 && r.d.bytes === 0).length

  return (
    <Frame
      instrument={instrument}
      controls={
        <div className="pt-chips" role="group" aria-label="Commit kind">
          <button
            type="button"
            className={`pt-chip${kind === null ? ' pt-chip--on' : ''}`}
            aria-pressed={kind === null}
            onClick={() => setKind(null)}
          >
            ALL {read.rows.length}
          </button>
          {read.kinds.slice(0, 9).map((row) => (
            <button
              key={row.kind}
              type="button"
              className={`pt-chip${kind === row.kind ? ' pt-chip--on' : ''}`}
              aria-pressed={kind === row.kind}
              onClick={() => setKind(kind === row.kind ? null : row.kind)}
            >
              {row.kind} {row.commits}
            </button>
          ))}
        </div>
      }
      footer={
        <p className="inst__method">
          <b>THE LANES ARE THE AUTHOR&apos;S WORDS, NOT MINE</b> The old console drew four lanes —
          INGEST, CONNECT, WRITE, MAINTAIN — which means somebody had a rule for sorting commits
          into four buckets. That rule is not in the vendored data, so rebuilding it would have
          meant writing a new one: a keyword list deciding which commit counts as ingesting,
          presented as a measurement of how the wiki was built. What is a fact instead is the
          prefix the author typed. Commits with no prefix are grouped as having no prefix rather
          than sorted into a bucket on their behalf.
        </p>
      }
    >
      <div className="pt-split pt-split--wide">
        <div className="pt-stack">
          <h3 className="pt-sub">
            {kind ? `${kind.toUpperCase()} · ${shown.length}` : `EVERY COMMIT · ${shown.length}`} ·
            NEWEST FIRST
          </h3>
          <ol className="pt-cards pt-scroll pt-scroll--tall">
            {shown.map((row) => (
              <li key={row.sha} className="pt-card">
                <span className="pt-card__head">
                  <span>{row.kind}</span>
                  <span>{new Date(row.t * 1000).toISOString().slice(0, 10)}</span>
                  <span>{row.sha}</span>
                </span>
                <p className="pt-card__say">{row.subject}</p>
                <span className="pt-card__meta">
                  {row.d
                    ? `${sign(row.d.pages)} pages · ${sign(row.d.edges)} edges · ${sign(row.d.links)} links · ${sign(row.d.bytes)} bytes`
                    : 'the first commit — everything is new'}
                </span>
              </li>
            ))}
          </ol>
        </div>

        <div className="pt-stack">
          <h3 className="pt-sub">THE VOCABULARY · {read.kinds.length} PREFIXES</h3>
          <ol className="pt-rows" style={{ ['--pt-label' as string]: '8.5rem' }}>
            {read.kinds.map((row) => (
              <li key={row.kind}>
                <button
                  type="button"
                  className="pt-row-btn"
                  style={{ ['--pt-label' as string]: '8.5rem', ['--pt-value' as string]: '3rem' }}
                  aria-pressed={kind === row.kind}
                  onClick={() => setKind(kind === row.kind ? null : row.kind)}
                >
                  <span className="pt-label">{row.kind}</span>
                  <span className="pt-bar">
                    <span className="pt-fill" style={{ inlineSize: `${(row.commits / peak) * 100}%` }} />
                  </span>
                  <span className="pt-value">{row.commits}</span>
                </button>
              </li>
            ))}
          </ol>

          <h3 className="pt-sub">PAGES EACH KIND OF COMMIT ADDED</h3>
          <ol className="pt-rows" style={{ ['--pt-label' as string]: '8.5rem' }}>
            {read.kinds
              .filter((row) => row.pages !== 0)
              .sort((a, b) => b.pages - a.pages)
              .map((row) => (
                <li key={row.kind} className="pt-row" style={{ ['--pt-label' as string]: '8.5rem' }}>
                  <span className="pt-label">{row.kind}</span>
                  <span className="pt-bar">
                    <span
                      className={`pt-fill${row.pages < 0 ? ' pt-fill--warn' : ' pt-fill--alt'}`}
                      style={{ inlineSize: `${(Math.abs(row.pages) / pagePeak) * 100}%` }}
                    />
                  </span>
                  <span className="pt-value">{sign(row.pages)}</span>
                </li>
              ))}
          </ol>
          <p className="pt-note">
            Only the prefixes that moved the page count appear here. The rest changed bytes, links
            or nothing at all, which is its own finding: most commits to this wiki are not commits
            that add pages.
          </p>

          <dl className="pt-facts">
            <dt>COMMITS</dt>
            <dd>{read.rows.length} over {data.span.days} days</dd>
            <dt>PREFIXES USED</dt>
            <dd>
              {read.kinds.length} distinct first words, including &ldquo;no prefix&rdquo; as one
            </dd>
            <dt>CHANGED NO PROSE</dt>
            <dd>
              {silent} commits added no pages and no bytes — merges, renames and configuration
            </dd>
            <dt>BUILT ON</dt>
            <dd>
              {data.branch} · {new Date(data.built).toISOString().slice(0, 10)}
            </dd>
          </dl>
        </div>
      </div>
    </Frame>
  )
}

/**
 * The first word of a commit subject, where there is one.
 *
 * `feat(rack): …` → `feat`, `Merge pull request #15 from …` → `merge pull request`,
 * and anything else → `no prefix`. This is a read of the string rather than a
 * reading of the work: the instrument reports what the author wrote, and where
 * they wrote nothing it says so instead of guessing on their behalf.
 */
function prefixOf(subject: string) {
  const conventional = String(subject).match(/^([a-zA-Z][a-zA-Z-]{1,12})(\([^)]*\))?:/)
  if (conventional) return conventional[1].toLowerCase()
  if (/^Merge pull request/i.test(subject)) return 'merge pull request'
  if (/^Merge /i.test(subject)) return 'merge'
  return 'no prefix'
}

const sign = (n: number) => (n > 0 ? `+${n.toLocaleString()}` : n.toLocaleString())
