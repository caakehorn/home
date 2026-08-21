import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Frame } from '../Frame'
import { useSet, type Instrument, type WikiSet } from '../core'

type Sort = 'start' | 'length' | 'words'

/**
 * A front-matter date at whatever precision it was written.
 *
 * These are not all `YYYY-MM-DD`: plenty are `2008-08` and a few are `2011`,
 * and `Date.parse('2008-08T00:00:00Z')` is NaN — which, on a chart whose axis
 * is derived from the maximum, quietly collapses every line on the page to a
 * pixel. So the precision is read rather than assumed, and a coarse date is
 * placed at the **edge of what it covers**: a start goes to the first instant
 * it could mean and an end to the last. That is the only reading that does not
 * make the span narrower or wider than the page actually claims.
 */
function edge(iso: string | null, which: 'start' | 'end') {
  if (!iso) return null
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number)
  if (!Number.isFinite(y)) return null
  if (Number.isFinite(d)) return Date.UTC(y, (m || 1) - 1, d)
  if (Number.isFinite(m)) return which === 'start' ? Date.UTC(y, m - 1, 1) : Date.UTC(y, m, 0)
  return which === 'start' ? Date.UTC(y, 0, 1) : Date.UTC(y, 11, 31)
}

/**
 * ◈ WIKI IV · THE CENSUS
 *
 * Every documented person the wiki gives a span to, drawn as a line on one
 * time axis. 117 of the 165 people pages carry a date range; the other 48 do
 * not, and are counted rather than guessed at.
 *
 * ---- what a line is and is not --------------------------------------------
 *
 * The span is `date_range_start` → `date_range_end` out of the page's own
 * front-matter, and it is **the range the record covers, not a lifetime**. A
 * page that starts in 2015 says the record starts in 2015; it does not say the
 * person did. Nothing is inferred into a missing end: an open range is drawn
 * open, running to the right-hand edge with no cap on it, because a bar that
 * stops somewhere would be an assertion about where.
 *
 * Where /lineage draws a family on real birth and death dates, this draws a
 * documentation record on the dates the documentation claims. They are
 * different objects and the note under the axis says so.
 */
export function Census({ instrument }: { instrument: Instrument }) {
  const { data, error, loading } = useSet<WikiSet>('wiki.json')
  const [sort, setSort] = useState<Sort>('start')

  const rows = useMemo(() => {
    if (!data) return []
    const list = data.census
      .map((row) => {
        const from = edge(row.from, 'start') ?? edge(row.to, 'start')
        const to = edge(row.to, 'end')
        if (from === null) return null
        return { ...row, at: from, until: to, open: to === null }
      })
      .filter((row): row is NonNullable<typeof row> => row !== null)
    if (sort === 'length') {
      return [...list].sort(
        (a, b) => (b.until ?? Date.now()) - b.at - ((a.until ?? Date.now()) - a.at),
      )
    }
    if (sort === 'words') return [...list].sort((a, b) => b.words - a.words)
    return [...list].sort((a, b) => a.at - b.at)
  }, [data, sort])

  if (loading)
    return (
      <Frame instrument={instrument}>
        <p className="inst__state">taking the census…</p>
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

  const people = data.domains.find((d) => d.id === 'people')?.count ?? 0
  const undated = people - data.census.length
  const now = Date.now()
  const earliest = Math.min(...rows.map((r) => r.at))
  const latest = Math.max(...rows.map((r) => r.until ?? now))
  const span = Math.max(1, latest - earliest)
  const place = (t: number) => ((t - earliest) / span) * 100
  const year = (t: number) => new Date(t).getUTCFullYear()

  // A decade grid, because a bar chart of people needs something to be read against.
  const decades: number[] = []
  for (let y = Math.floor(year(earliest) / 10) * 10; y <= year(latest); y += 10) decades.push(y)

  return (
    <Frame
      instrument={instrument}
      controls={
        <div className="pt-chips" role="group" aria-label="Order">
          {(
            [
              ['start', 'BY WHEN IT STARTS'],
              ['length', 'BY HOW LONG'],
              ['words', 'BY HOW MUCH IS WRITTEN'],
            ] as [Sort, string][]
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              className={`pt-chip${sort === value ? ' pt-chip--on' : ''}`}
              aria-pressed={sort === value}
              onClick={() => setSort(value)}
            >
              {label}
            </button>
          ))}
        </div>
      }
      footer={
        <p className="inst__method">
          <b>A SPAN IS NOT A LIFETIME</b> The line is the range the page&apos;s own front-matter
          gives for the record — <code>date_range_start</code> to <code>date_range_end</code> — not
          a birth and a death. Those dates come at whatever precision they were written, so a
          month-precision start is placed at the first day it could mean and an end at the last:
          the only reading that makes the span neither narrower nor wider than the page claims. A page starting in 2015 says the record starts in 2015; it says
          nothing about when the person did. An open range is drawn open, running off the
          right-hand edge with no cap, because a bar that stops somewhere would be an assertion
          about where. The family tree on real dates is next door at <Link to="/lineage">/lineage</Link>.
        </p>
      }
    >
      <div className="pt-split pt-split--wide">
        <div className="pt-stack">
          <div className="cen__axis" aria-hidden="true">
            {decades.map((y) => (
              <span key={y} className="cen__tick" style={{ left: `${place(Date.UTC(y, 0, 1))}%` }}>
                {y}
              </span>
            ))}
          </div>

          <ol className="pt-rows pt-scroll pt-scroll--tall" style={{ gap: '0.22rem' }}>
            {rows.map((row) => {
              const end = row.until ?? latest
              return (
                <li key={row.slug} className="cen__row">
                  <Link className="cen__name" to={`/brain/${row.slug}`}>
                    {row.title}
                  </Link>
                  <span className="cen__track">
                    {decades.map((y) => (
                      <span
                        key={y}
                        className="cen__grid"
                        style={{ left: `${place(Date.UTC(y, 0, 1))}%` }}
                        aria-hidden="true"
                      />
                    ))}
                    <span
                      className={`cen__life${row.open ? ' cen__life--open' : ''}`}
                      style={{
                        left: `${place(row.at)}%`,
                        width: `${Math.max(0.6, place(end) - place(row.at))}%`,
                      }}
                    />
                  </span>
                  <span className="cen__years">
                    {year(row.at)}
                    {row.open ? '–' : `–${year(end)}`}
                  </span>
                </li>
              )
            })}
          </ol>
        </div>

        <div className="pt-stack">
          <p className="pt-note">
            One line per documented person, on one axis, {year(earliest)} → {year(latest)}. An
            open-ended line runs to the right-hand edge and is drawn hollow.
          </p>

          <dl className="pt-facts" style={{ marginTop: 0 }}>
            <dt>PEOPLE PAGES</dt>
            <dd>{people}</dd>
            <dt>WITH A SPAN</dt>
            <dd>{data.census.length} — drawn above</dd>
            <dt>WITHOUT ONE</dt>
            <dd>
              {undated} — counted, not guessed at. A page with no dates gets no line rather than an
              invented one
            </dd>
            <dt>STILL OPEN</dt>
            <dd>{rows.filter((r) => r.open).length} spans have no end date on the page</dd>
            <dt>EARLIEST</dt>
            <dd>
              {year(earliest)} · {rows.find((r) => r.at === earliest)?.title}
            </dd>
          </dl>

          <h3 className="pt-sub">MOST WRITTEN UP</h3>
          <ol className="pt-rows" style={{ ['--pt-label' as string]: '1fr' }}>
            {[...rows]
              .sort((a, b) => b.words - a.words)
              .slice(0, 12)
              .map((row) => (
                <li key={row.slug} className="pt-row">
                  <span className="pt-label">
                    <Link to={`/brain/${row.slug}`}>{row.title}</Link>
                  </span>
                  <span className="pt-bar">
                    <span
                      className="pt-fill"
                      style={{
                        inlineSize: `${(row.words / Math.max(...rows.map((r) => r.words))) * 100}%`,
                      }}
                    />
                  </span>
                  <span className="pt-value">{row.words.toLocaleString()}</span>
                </li>
              ))}
          </ol>
        </div>
      </div>
    </Frame>
  )
}
