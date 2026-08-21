import { useState } from 'react'
import { Frame } from '../Frame'
import { DOMAIN_KANA, useSet, type Instrument, type WikiSet } from '../core'

/**
 * ◈ WIKI XVI · THE DICTION
 *
 * What each domain says that the others do not. Term frequency in a domain
 * against the number of domains that use the word at all, top forty per
 * domain, with the raw count printed beside every score.
 *
 * ---- the ruling this instrument was waiting on -----------------------------
 *
 * It sat SEALED, and not for want of data — every word ships at /brain. It was
 * waiting on a question: **THE RULE says nothing weighted, and IDF is a
 * weight.**
 *
 * The answer, now argued: a weight *computed from the corpus* is not the kind
 * of weight THE RULE forbids. What the rule is written against is a weight
 * somebody **chose** — a keyword list deciding in advance what matters, a
 * threshold picked for what it would surface. IDF chooses nothing. It is a
 * count of how many domains use a word, with arithmetic applied to it, and two
 * readers running it over this corpus get the same number.
 *
 * The distinction is worth stating precisely because it is the line the whole
 * wing runs along: **computed weights are counts wearing a coat; chosen
 * weights are opinions wearing one.**
 *
 * And it is disclosed rather than asserted. Every row prints its raw count and
 * how many domains use the word, so the ranking can be checked against the
 * counting rather than trusted. The one closed-class stoplist is the same one
 * THE LEXICON publishes in full.
 */
export function Diction({ instrument }: { instrument: Instrument }) {
  const { data, error, loading } = useSet<WikiSet>('wiki.json')
  const [picked, setPicked] = useState<string | null>(null)

  if (loading)
    return (
      <Frame instrument={instrument}>
        <p className="inst__state">weighing the vocabulary…</p>
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

  const domains = data.diction
  const here = picked ? domains.find((d) => d.id === picked) : null
  const shown = here ? [here] : domains

  return (
    <Frame
      instrument={instrument}
      controls={
        <div className="pt-chips" role="group" aria-label="Domain">
          <button
            type="button"
            className={`pt-chip${picked === null ? ' pt-chip--on' : ''}`}
            aria-pressed={picked === null}
            onClick={() => setPicked(null)}
          >
            ALL NINE
          </button>
          {domains.map((d) => (
            <button
              key={d.id}
              type="button"
              className={`pt-chip${picked === d.id ? ' pt-chip--on' : ''}`}
              aria-pressed={picked === d.id}
              onClick={() => setPicked(picked === d.id ? null : d.id)}
            >
              {d.id.toUpperCase()}
            </button>
          ))}
        </div>
      }
      footer={
        <p className="inst__method">
          <b>WHY A WEIGHT IS ALLOWED HERE</b> This sat SEALED on a question rather than on data:
          THE RULE says nothing weighted, and IDF is a weight. The answer is that a weight{' '}
          <i>computed from the corpus</i> is not the kind the rule forbids. What the rule is written
          against is a weight somebody <i>chose</i> — a keyword list deciding in advance what
          matters. IDF chooses nothing; it counts how many domains use a word and applies arithmetic
          to it, and two readers get the same number. Computed weights are counts wearing a coat;
          chosen weights are opinions wearing one. Every row prints its raw count so the ranking can
          be checked against the counting.
        </p>
      }
    >
      <div className="pt-stack">
        {!here && (
          <p className="pt-note">
            The words each domain uses that the others do not. Pick a domain above for its full
            forty; below is the top of each. The score is term frequency times the log of nine over
            the number of domains using the word — the raw count and that number are both printed,
            so nothing about the ranking has to be taken on trust.
          </p>
        )}

        <div className={here ? '' : 'dic__grid'}>
          {shown.map((domain) => (
            <section key={domain.id} className="dic__panel">
              <h3 className="pt-sub">
                {domain.id.toUpperCase()}{' '}
                <span className="jp" aria-hidden="true">
                  {DOMAIN_KANA[domain.id] ?? ''}
                </span>{' '}
                · {domain.distinct.toLocaleString()} distinct words in{' '}
                {domain.words.toLocaleString()}
              </h3>
              <ol
                className={`pt-rows${here ? ' pt-scroll pt-scroll--tall' : ''}`}
                style={{ ['--pt-label' as string]: '9rem', ['--pt-value' as string]: '6.4rem' }}
              >
                {(here ? domain.terms : domain.terms.slice(0, 12)).map((term) => (
                  <li
                    key={term.word}
                    className="pt-row"
                    style={{ ['--pt-label' as string]: '9rem', ['--pt-value' as string]: '6.4rem' }}
                  >
                    <span className="pt-label">{term.word}</span>
                    <span className="pt-bar">
                      <span
                        className="pt-fill"
                        style={{ inlineSize: `${(term.score / domain.terms[0].score) * 100}%` }}
                      />
                    </span>
                    <span className="pt-value">
                      {term.count}× · {Math.round(term.exclusivity * 100)}%
                    </span>
                  </li>
                ))}
              </ol>
              {here && (
                <p className="pt-note">
                  The two numbers on each row are the raw count of the word in this domain, and the
                  share of all its uses anywhere that land here. A word at 100% is used in this
                  domain and nowhere else in the corpus.
                </p>
              )}
            </section>
          ))}
        </div>

        {!here && (
          <p className="pt-note">
            Each row shows the raw count and the share of that word&apos;s uses across the whole
            corpus that fall in this domain. A word at 100% appears here and nowhere else.
          </p>
        )}
      </div>
    </Frame>
  )
}
