import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Frame } from '../Frame'
import { useSet, type Instrument, type WikiSet } from '../core'

type Rank = 'byOverlap' | 'byShared'

/**
 * ◈ WIKI XVIII · THE ECHO
 *
 * Where the wiki repeats itself: 59,586 page pairs measured, ranked two ways.
 *
 * ---- the measurement -------------------------------------------------------
 *
 * Jaccard over the distinct four-letter-or-longer words of two pages — the size
 * of the intersection over the size of the union. A set operation and nothing
 * else. No embedding, no model, no similarity threshold, and the pairs are
 * **ranked by the number rather than filtered by it**.
 *
 * ---- the finding, which is left where it landed ----------------------------
 *
 * By overlap the top of this list is a wall of 1.000s between one-line concert
 * stubs, which share a vocabulary because they share a template. The first
 * instinct is to threshold that away as noise. It is not noise: **the wiki does
 * repeat itself most in its own boilerplate**, and an instrument that quietly
 * filtered that out would be reporting a prettier corpus than the one that
 * exists. So it stays at the top, and a second ranking — by the raw count of
 * shared words — surfaces the long pages that genuinely cover the same ground.
 *
 * Two rankings of one measurement, no filter between them.
 */
export function Echo({ instrument }: { instrument: Instrument }) {
  const { data, error, loading } = useSet<WikiSet>('wiki.json')
  const [rank, setRank] = useState<Rank>('byShared')
  const [sameOnly, setSameOnly] = useState<'all' | 'same' | 'cross'>('all')

  if (loading)
    return (
      <Frame instrument={instrument}>
        <p className="inst__state">comparing every pair…</p>
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

  const { echo } = data
  const pairs = echo[rank].filter((p) =>
    sameOnly === 'all' ? true : sameOnly === 'same' ? p.sameDomain : !p.sameDomain,
  )
  const peak =
    rank === 'byOverlap'
      ? Math.max(...pairs.map((p) => p.overlap), 0.0001)
      : Math.max(...pairs.map((p) => p.shared), 1)

  return (
    <Frame
      instrument={instrument}
      controls={
        <div className="pt-chips" role="group" aria-label="Ranking">
          <button
            type="button"
            className={`pt-chip${rank === 'byShared' ? ' pt-chip--on' : ''}`}
            aria-pressed={rank === 'byShared'}
            onClick={() => setRank('byShared')}
          >
            BY SHARED WORDS
          </button>
          <button
            type="button"
            className={`pt-chip${rank === 'byOverlap' ? ' pt-chip--on' : ''}`}
            aria-pressed={rank === 'byOverlap'}
            onClick={() => setRank('byOverlap')}
          >
            BY OVERLAP
          </button>
          {(
            [
              ['all', 'ANY PAIR'],
              ['same', 'SAME DOMAIN'],
              ['cross', 'ACROSS DOMAINS'],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              className={`pt-chip${sameOnly === value ? ' pt-chip--on' : ''}`}
              aria-pressed={sameOnly === value}
              onClick={() => setSameOnly(value)}
            >
              {label}
            </button>
          ))}
        </div>
      }
      footer={
        <p className="inst__method">
          <b>THE BOILERPLATE STAYS AT THE TOP</b> Ranked by overlap, the head of this list is a wall
          of 1.000s between one-line concert stubs that share a vocabulary because they share a
          template. The instinct is to threshold that away as noise. It is not noise — the wiki does
          repeat itself most in its own boilerplate, and an instrument that filtered that out would
          be reporting a prettier corpus than the one that exists. It stays, and the second ranking
          surfaces the long pages that cover the same ground instead. Two rankings of one
          measurement, and no filter between them.
        </p>
      }
    >
      <div className="pt-split pt-split--wide">
        <div className="pt-stack">
          <h3 className="pt-sub">
            {rank === 'byOverlap' ? 'LOUDEST BY OVERLAP' : 'LOUDEST BY SHARED VOCABULARY'} ·{' '}
            {pairs.length} SHOWN
          </h3>
          <ol className="pt-cards pt-scroll pt-scroll--tall">
            {pairs.slice(0, 120).map((pair) => (
              <li key={`${pair.a}-${pair.b}`} className="pt-card">
                <span className="pt-card__head">
                  <Link to={`/brain/${pair.a}`}>{pair.aTitle}</Link>
                  <span aria-hidden="true">~</span>
                  <Link to={`/brain/${pair.b}`}>{pair.bTitle}</Link>
                </span>
                <span className="pt-bar">
                  <span
                    className={`pt-fill${pair.overlap === 1 ? ' pt-fill--warn' : ''}`}
                    style={{
                      inlineSize: `${((rank === 'byOverlap' ? pair.overlap : pair.shared) / peak) * 100}%`,
                    }}
                  />
                </span>
                <span className="pt-card__meta">
                  {pair.shared.toLocaleString()} words in common · overlap{' '}
                  {pair.overlap.toFixed(3)}
                  {pair.overlap === 1 ? ' · IDENTICAL VOCABULARY' : ''} ·{' '}
                  {pair.sameDomain ? 'same domain' : 'across domains'}
                </span>
              </li>
            ))}
          </ol>
        </div>

        <div className="pt-stack">
          <p className="pt-note">
            Jaccard over the distinct four-letter-or-longer words of two pages: the size of the
            intersection over the size of the union. A set operation and nothing else — no
            embedding, no model, no similarity threshold.
          </p>

          <dl className="pt-facts" style={{ marginTop: 0 }}>
            <dt>PAGES MEASURED</dt>
            <dd>
              {echo.measured} of {data.counts.pages} — a page needs 40 distinct words to have a
              vocabulary to compare, and the shorter ones are counted out here rather than compared
              badly
            </dd>
            <dt>PAIRS FOUND</dt>
            <dd>{echo.total.toLocaleString()} sharing at least 20 words</dd>
            <dt>IDENTICAL VOCABULARY</dt>
            <dd>
              {echo.identical} pairs at overlap 1.000 — two pages using exactly the same set of
              words, which is the signature of a template
            </dd>
            <dt>BIGGEST OVERLAP BY COUNT</dt>
            <dd>
              {echo.byShared[0]?.shared.toLocaleString()} words shared ·{' '}
              {echo.byShared[0]?.aTitle} ~ {echo.byShared[0]?.bTitle}
            </dd>
          </dl>

          <p className="pt-note">
            <b>THE TWO CUT-OFFS</b> A page needs 40 distinct words to be measured and a pair needs
            20 in common to be listed. Both are stated because both are choices: they keep the
            comparison from being dominated by pages too short to have a vocabulary, and they are
            the only numbers on this instrument that somebody picked.
          </p>
        </div>
      </div>
    </Frame>
  )
}
