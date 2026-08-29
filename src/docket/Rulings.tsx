import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { KIND_ORDER, KIND_TONE, nameOf, shortDate, type DocketSet, type Ruling } from './core'
import { Reading, stripHead } from './Reading'

/**
 * IV · THE RULINGS — 裁定
 *
 * Four hundred and forty-three dated blocks in which the wiki recorded what
 * happened to one of its own claims, plotted against the day it happened.
 *
 * ---- what this bench is for -------------------------------------------------
 *
 * The other three benches are a list of things that are not settled, and a list
 * of things that are not settled is a complaint. This is the other half of the
 * ledger: 199 re-checks, 105 corrections, 86 revisions, 34 gaps closed, and
 * eleven rarer verdicts including two retractions and one page superseded
 * outright — every one of them dated, attributed and kept whole.
 *
 * Read the chart rather than the total. The corpus's own house rule is that a
 * stale premise is never cleared by bumping a date — you re-read what moved and
 * record the decision — and 199 RE-CHECKED blocks are what that rule looks like
 * from outside. Most of them conclude that nothing on the page changed. That is
 * the expensive outcome, and it is the one that proves the rule is real: a
 * corpus that only recorded the re-checks that found something would have no
 * way to tell a careful pass from a lucky one.
 *
 * ---- the shape of the chart is a fact about the project, not about Dan ------
 *
 * 397 of the 443 fall in a single month. That is not a burst of error; it is
 * when the repository started running the check. The two-day peaks — 42 on 20
 * August, 39 on the 23rd, 36 on the 26th — are audit passes, and the days with
 * none are days nobody worked. Nothing here is smoothed and no day is dropped.
 */

const DAY = 86_400_000

export function Rulings({ set }: { set: DocketSet }) {
  const [kind, setKind] = useState<string | null>(null)
  const [day, setDay] = useState<string | null>(null)

  const { days, span, peak, kinds } = useMemo(() => {
    const counts = new Map<string, Map<string, number>>()
    const kinds = new Map<string, number>()
    for (const r of set.rulings) {
      kinds.set(r.kind, (kinds.get(r.kind) ?? 0) + 1)
      if (!r.date) continue
      if (!counts.has(r.date)) counts.set(r.date, new Map())
      const m = counts.get(r.date)!
      m.set(r.kind, (m.get(r.kind) ?? 0) + 1)
    }
    const dated = [...counts.keys()].sort()
    const from = Date.parse(dated[0])
    const to = Date.parse(dated[dated.length - 1])
    const total = Math.round((to - from) / DAY) + 1

    // Every calendar day in the span, not just the ones with a ruling — a gap
    // in a record is not a quiet day drawn at zero width.
    const days = Array.from({ length: total }, (_, i) => {
      const iso = new Date(from + i * DAY).toISOString().slice(0, 10)
      const m = counts.get(iso) ?? new Map<string, number>()
      return { iso, by: m, total: [...m.values()].reduce((a, b) => a + b, 0) }
    })
    return {
      days,
      span: { from: dated[0], to: dated[dated.length - 1], days: total, worked: dated.length },
      peak: Math.max(...days.map((d) => d.total)),
      kinds: [...kinds.entries()].sort(
        (a, b) => KIND_ORDER.indexOf(a[0] as never) - KIND_ORDER.indexOf(b[0] as never),
      ),
    }
  }, [set])

  const listed = useMemo(() => {
    let out: Ruling[] = [...set.rulings].reverse()
    if (kind) out = out.filter((r) => r.kind === kind)
    if (day) out = out.filter((r) => r.date === day)
    return out
  }, [set, kind, day])

  return (
    <div className="dk-bench dk-bench--rulings">
      <div className="dk-plot">
        <div className="dk-controls" role="group" aria-label="Kind of ruling">
          <button
            type="button"
            className={`dk-chip${kind === null ? ' dk-chip--on' : ''}`}
            aria-pressed={kind === null}
            onClick={() => setKind(null)}
          >
            ALL {set.rulings.length}
          </button>
          {kinds.map(([id, n]) => (
            <button
              key={id}
              type="button"
              className={`dk-chip${kind === id ? ' dk-chip--on' : ''}`}
              aria-pressed={kind === id}
              onClick={() => setKind(kind === id ? null : id)}
              style={{ ['--tone' as string]: KIND_TONE[id] ?? '#9aa0b5' }}
            >
              <i className="dk-chip__ink" aria-hidden="true" />
              {id} {n}
            </button>
          ))}
        </div>

        <div className="dk-chart">
          <div className="dk-chart__scale" aria-hidden="true">
            <span>{peak}</span>
            <span>0</span>
          </div>
          <ol className="dk-chart__days">
            {days.map((d) => (
              <li
                key={d.iso}
                className={`dk-chart__day${day === d.iso ? ' dk-chart__day--on' : ''}${
                  d.total ? '' : ' dk-chart__day--quiet'
                }`}
              >
                <button
                  type="button"
                  onClick={() => setDay(day === d.iso ? null : d.iso)}
                  disabled={!d.total}
                  aria-label={`${d.iso}: ${d.total} rulings`}
                  title={`${shortDate(d.iso)} — ${d.total || 'nothing'}`}
                >
                  <span className="dk-chart__stack" style={{ height: `${(d.total / peak) * 100}%` }}>
                    {KIND_ORDER.filter((k) => d.by.get(k)).map((k) => (
                      <i
                        key={k}
                        style={{
                          flexGrow: d.by.get(k),
                          background: KIND_TONE[k] ?? '#9aa0b5',
                        }}
                      />
                    ))}
                  </span>
                </button>
              </li>
            ))}
          </ol>
          <p className="dk-chart__axis">
            <span>{shortDate(span.from)}</span>
            <b>
              {span.worked} DAYS WORKED OF {span.days} · PEAK {peak}
            </b>
            <span>{shortDate(span.to)}</span>
          </p>
        </div>
      </div>

      <div className="dk-side">
        <div className="dk-side__head">
          <h3 className="dk-side__title">
            {day ? shortDate(day) : kind ? kind : `${set.rulings.length} SETTLED`}
          </h3>
          <p className="dk-side__meta">
            {day || kind ? (
              <>
                {listed.length} on this cut ·{' '}
                <button
                  type="button"
                  className="dk-chip"
                  onClick={() => {
                    setDay(null)
                    setKind(null)
                  }}
                >
                  CLEAR
                </button>
              </>
            ) : (
              <>Newest first. Pick a day off the chart, or a kind off the row above.</>
            )}
          </p>
        </div>

        <ol className="dk-list">
          {listed.slice(0, 160).map((r) => (
            <li key={r.id} className="dk-case">
              <p className="dk-case__head">
                <span
                  className="dk-case__kind"
                  style={{ ['--tone' as string]: KIND_TONE[r.kind] ?? '#9aa0b5' }}
                >
                  {r.kind}
                </span>
                <Link className="dk-case__page" to={`/brain/${r.page}`}>
                  {nameOf(set, r.page).toUpperCase()}
                </Link>
                <span className="dk-case__date">{shortDate(r.date)}</span>
              </p>
              {r.headline && <p className="dk-case__line">{r.headline}</p>}
              <Reading text={stripHead(r.text)} />
            </li>
          ))}
        </ol>
        {listed.length > 160 && (
          <p className="dk-side__more">
            {(listed.length - 160).toLocaleString()} more — narrow it by kind or by day.
          </p>
        )}
      </div>
    </div>
  )
}
