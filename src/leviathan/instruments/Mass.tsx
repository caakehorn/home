import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Frame } from '../Frame'
import { useSet, type Instrument, type MassSet } from '../core'
import '../mass.css'

const DOMAIN_KANA: Record<string, string> = {
  people: '人', interests: '趣味', mind: '心', timeline: '年表',
  self: '自己', work: '仕事', places: '場所', health: '健康', legal: '法',
}

/** Buckets wide enough to hold 458 pages without a column of ones. */
const BUCKETS = [0, 250, 500, 1000, 2000, 4000, 8000, Infinity]
const bucketLabel = (i: number) =>
  BUCKETS[i + 1] === Infinity ? `${BUCKETS[i].toLocaleString()}+` : `${BUCKETS[i].toLocaleString()}–${(BUCKETS[i + 1] - 1).toLocaleString()}`

/**
 * I · THE MASS
 *
 * Magnitude across nine domains, so: bars, one hue, more is brighter. Every
 * value is direct-labelled — the ramp is there to be scanned, never to be
 * read off, and nothing here depends on telling two colours apart.
 */
export function Mass({ instrument }: { instrument: Instrument }) {
  const { data, error, loading } = useSet<MassSet>('mass.json')
  const [picked, setPicked] = useState<string | null>(null)

  const totals = useMemo(() => {
    if (!data) return null
    return {
      words: data.domains.reduce((n, d) => n + d.words, 0),
      pages: data.domains.reduce((n, d) => n + d.pages, 0),
      top: Math.max(...data.domains.map((d) => d.words)),
    }
  }, [data])

  const histogram = useMemo(() => {
    if (!data) return []
    const rows = data.pages.filter((p) => !picked || p.domain === picked)
    return BUCKETS.slice(0, -1).map((_, i) => ({
      label: bucketLabel(i),
      count: rows.filter((p) => p.words >= BUCKETS[i] && p.words < BUCKETS[i + 1]).length,
    }))
  }, [data, picked])

  const longest = useMemo(
    () => (data ? data.pages.filter((p) => !picked || p.domain === picked).slice(0, 10) : []),
    [data, picked],
  )

  if (loading) return <Frame instrument={instrument}><p className="inst__state">counting…</p></Frame>
  if (error || !data || !totals)
    return (
      <Frame instrument={instrument}>
        <p className="inst__state">
          The dataset is missing ({error}). Run <code>npm run leviathan</code> and rebuild.
        </p>
      </Frame>
    )

  const peak = Math.max(1, ...histogram.map((h) => h.count))

  return (
    <Frame
      instrument={instrument}
      controls={
        picked && (
          <button type="button" className="mass__clear" onClick={() => setPicked(null)}>
            ALL DOMAINS ×
          </button>
        )
      }
      footer={
        <p className="inst__note">
          Domain totals are the sum of every page's own word count, which is the count the wiki
          index already carries — the same number the reader sees on the page.
        </p>
      }
    >
      <ol className="mass__bars">
        {data.domains.map((d) => {
          const on = picked === d.id
          return (
            <li key={d.id} className={`mass__row${on ? ' mass__row--on' : ''}`}>
              <button
                type="button"
                className="mass__bar"
                aria-pressed={on}
                onClick={() => setPicked(on ? null : d.id)}
              >
                <span className="mass__name">
                  <span className="jp" aria-hidden="true">
                    {DOMAIN_KANA[d.id] ?? '書'}
                  </span>
                  {d.id}
                </span>
                <span className="mass__track">
                  <span
                    className="mass__fill"
                    style={{
                      width: `${(d.words / totals.top) * 100}%`,
                      // sequential: one hue, more is brighter
                      opacity: 0.4 + 0.6 * (d.words / totals.top),
                    }}
                  />
                </span>
                <span className="mass__value">{d.words.toLocaleString()}</span>
                <span className="mass__sub">
                  {d.pages} pages · {d.links} links
                  {d.briefs > 0 && ` · ${d.briefs} briefs`}
                </span>
              </button>
            </li>
          )
        })}
      </ol>

      <div className="mass__split">
        <section className="mass__panel">
          <h2 className="mass__sub-head">
            Page lengths{picked && <span className="mass__scope"> · {picked}</span>}
          </h2>
          <ol className="mass__hist">
            {histogram.map((b) => (
              <li key={b.label}>
                <span className="mass__hist-label">{b.label}</span>
                <span className="mass__hist-track">
                  <span className="mass__hist-fill" style={{ width: `${(b.count / peak) * 100}%` }} />
                </span>
                <span className="mass__hist-count">{b.count}</span>
              </li>
            ))}
          </ol>
        </section>

        <section className="mass__panel">
          <h2 className="mass__sub-head">
            Heaviest pages{picked && <span className="mass__scope"> · {picked}</span>}
          </h2>
          <ol className="mass__list">
            {longest.map((p) => (
              <li key={p.slug}>
                <Link to={`/brain/${p.slug}`}>{p.title}</Link>
                <b>{p.words.toLocaleString()}</b>
              </li>
            ))}
          </ol>
        </section>
      </div>
    </Frame>
  )
}
