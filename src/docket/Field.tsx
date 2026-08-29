import { useDeferredValue, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { DOMAIN_KANA, nameOf, type DocketSet, type Gap } from './core'
import { Reading } from './Reading'

/**
 * II · THE FIELD — 空白
 *
 * Four hundred and eighty-four gaps, one mark each, on a wall.
 *
 * ---- why a tally and not a bar chart ---------------------------------------
 *
 * A bar chart of gaps-per-page is a picture of a ranking, and a ranking implies
 * that the top of it is the problem. It is not: a page with nineteen gaps is a
 * page that has been read carefully enough to know nineteen things it is
 * missing, and a page with none is far more likely to be thin than complete.
 * `wiki/mind/concepts/*` sits at the top of this wall because it is the most
 * worked part of the corpus.
 *
 * A tally makes the individual mark the unit instead of the column, which is
 * the honest reading: every stroke is one specific thing one specific page says
 * it does not know, and you can take any of them off the wall and read it. The
 * fives are crossed because that is what a tally does, and because it lets you
 * count a column without a scale.
 *
 * ---- what is not on this wall ----------------------------------------------
 *
 * Anything struck through, and anything a page marked CLOSED, RESOLVED or
 * SETTLED. So the wall gets shorter only when something is actually answered —
 * never because somebody deleted the question.
 */

const STROKE = 7.5
const ROW = 15
const PER_ROW = 15

export function Field({ set }: { set: DocketSet }) {
  const [domain, setDomain] = useState<string | null>(null)
  const [page, setPage] = useState<string | null>(null)
  const [gap, setGap] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const q = useDeferredValue(query).trim().toLowerCase()

  /** Pages with gaps, grouped into domains, each ordered by how many. */
  const wall = useMemo(() => {
    const byPage = new Map<string, Gap[]>()
    for (const g of set.gaps) {
      if (!byPage.has(g.page)) byPage.set(g.page, [])
      byPage.get(g.page)!.push(g)
    }
    const byDomain = new Map<string, { page: string; gaps: Gap[] }[]>()
    for (const [slug, gaps] of byPage) {
      const d = gaps[0].domain
      if (!byDomain.has(d)) byDomain.set(d, [])
      byDomain.get(d)!.push({ page: slug, gaps })
    }
    return [...byDomain.entries()]
      .map(([id, pages]) => ({
        id,
        pages: pages.sort((a, b) => b.gaps.length - a.gaps.length || a.page.localeCompare(b.page)),
        total: pages.reduce((n, p) => n + p.gaps.length, 0),
      }))
      .sort((a, b) => b.total - a.total)
  }, [set])

  const listed = useMemo(() => {
    let out = set.gaps
    if (page) out = out.filter((g) => g.page === page)
    else if (domain) out = out.filter((g) => g.domain === domain)
    if (q) out = out.filter((g) => g.label.toLowerCase().includes(q))
    return out
  }, [set, page, domain, q])

  const shownWall = domain ? wall.filter((d) => d.id === domain) : wall

  return (
    <div className="dk-bench dk-bench--field">
      <div className="dk-plot">
        <div className="dk-controls" role="group" aria-label="Domain">
          <button
            type="button"
            className={`dk-chip${domain === null ? ' dk-chip--on' : ''}`}
            aria-pressed={domain === null}
            onClick={() => {
              setDomain(null)
              setPage(null)
            }}
          >
            ALL {set.gaps.length}
          </button>
          {wall.map((d) => (
            <button
              key={d.id}
              type="button"
              className={`dk-chip${domain === d.id ? ' dk-chip--on' : ''}`}
              aria-pressed={domain === d.id}
              onClick={() => {
                setDomain(domain === d.id ? null : d.id)
                setPage(null)
              }}
            >
              <span className="jp" aria-hidden="true">
                {DOMAIN_KANA[d.id] ?? ''}
              </span>
              {d.id.toUpperCase()} {d.total}
            </button>
          ))}
        </div>

        <div className="dk-wall">
          {shownWall.map((d) => (
            <section key={d.id} className="dk-wall__band">
              <h3 className="dk-wall__band-title">
                <span className="jp" aria-hidden="true">
                  {DOMAIN_KANA[d.id] ?? ''}
                </span>
                {d.id.toUpperCase()}
                <b>{d.total}</b>
                <i>{d.pages.length} pages</i>
              </h3>
              <div className="dk-wall__pages">
                {d.pages.map((p) => (
                  <button
                    key={p.page}
                    type="button"
                    className={`dk-tally${page === p.page ? ' dk-tally--on' : ''}`}
                    aria-pressed={page === p.page}
                    onClick={() => {
                      setPage(page === p.page ? null : p.page)
                      setGap(null)
                    }}
                    title={`${nameOf(set, p.page)} — ${p.gaps.length} open`}
                  >
                    <Strokes gaps={p.gaps} active={gap} onPick={setGap} />
                    <span className="dk-tally__name">{nameOf(set, p.page)}</span>
                    <span className="dk-tally__n">{p.gaps.length}</span>
                  </button>
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>

      <div className="dk-side">
        <div className="dk-side__head">
          <h3 className="dk-side__title">
            {page ? nameOf(set, page).toUpperCase() : `${listed.length} OPEN`}
          </h3>
          <p className="dk-side__meta">
            {page ? (
              <>
                <Link to={`/brain/${page}`}>READ THE PAGE →</Link>{' '}
                <button type="button" className="dk-chip" onClick={() => setPage(null)}>
                  CLEAR
                </button>
              </>
            ) : (
              <>
                {set.gaps.length} across {new Set(set.gaps.map((g) => g.page)).size} pages. Take one
                off the wall, or search them.
              </>
            )}
          </p>
          <label className="dk-search">
            <span className="jp" aria-hidden="true">
              探
            </span>
            <input
              type="search"
              value={query}
              placeholder="SEARCH THE GAPS"
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Search the gaps"
            />
          </label>
        </div>

        <ol className="dk-list">
          {listed.slice(0, 240).map((g) => (
            <li
              key={g.id}
              id={`gap-${g.id}`}
              className={`dk-case${gap === g.id ? ' dk-case--lit' : ''}`}
            >
              <p className="dk-case__head">
                <span className="dk-case__no">{g.id.toUpperCase()}</span>
                <Link className="dk-case__page" to={`/brain/${g.page}`}>
                  {nameOf(set, g.page).toUpperCase()}
                </Link>
                <span className="dk-case__dom">{g.domain.toUpperCase()}</span>
              </p>
              <Reading text={g.text.replace(/^\s*[-*]\s+/, '')} />
            </li>
          ))}
        </ol>
        {listed.length > 240 && (
          <p className="dk-side__more">
            {(listed.length - 240).toLocaleString()} more — narrow it with a domain, a page or the
            search box. The wall shows all {set.gaps.length}.
          </p>
        )}
      </div>
    </div>
  )
}

/**
 * One page's gaps as tally strokes, fives crossed.
 *
 * The strokes are drawn rather than listed: 484 focusable elements in one view
 * is a keyboard trap, and the page group above is already a button, so this is
 * the picture and the group is the control. A pointer can still pick an
 * individual mark — the click reads the stroke's own id off the target — which
 * is what makes it a wall you take something off rather than a chart.
 */
function Strokes({
  gaps,
  active,
  onPick,
}: {
  gaps: Gap[]
  active: string | null
  onPick: (id: string) => void
}) {
  const rows = Math.ceil(gaps.length / PER_ROW)
  const w = Math.min(gaps.length, PER_ROW) * STROKE + 6
  const h = rows * ROW + 2

  return (
    <svg
      className="dk-tally__svg"
      width={w}
      height={h}
      viewBox={`0 0 ${w} ${h}`}
      aria-hidden="true"
      onClick={(e) => {
        const id = (e.target as SVGElement).dataset?.id
        if (id) {
          e.stopPropagation()
          onPick(id)
          document.getElementById(`gap-${id}`)?.scrollIntoView({ block: 'center' })
        }
      }}
    >
      {gaps.map((g, i) => {
        const row = Math.floor(i / PER_ROW)
        const col = i % PER_ROW
        const x = 3 + col * STROKE
        const y = 1 + row * ROW
        const fifth = col % 5 === 4
        return (
          <line
            key={g.id}
            data-id={g.id}
            className={`dk-stroke${active === g.id ? ' dk-stroke--on' : ''}`}
            x1={fifth ? x - STROKE * 3.6 : x}
            y1={fifth ? y + ROW - 3 : y + 1}
            x2={fifth ? x + 2.4 : x + 2.2}
            y2={fifth ? y + 2 : y + ROW - 3}
          />
        )
      })}
    </svg>
  )
}
