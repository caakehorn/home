import { useMemo, useState } from 'react'
import { Frame } from '../Frame'
import { useSet, type Instrument, type LexiconSet } from '../core'

type Side = 'all' | 'sent' | 'received'

/**
 * ◈ CORPUS V · THE LEXICON
 *
 * The vocabulary of 134,348 messages: 965,583 words, 19,873 of them distinct,
 * ranked. And underneath, the share of messages written in capitals, month by
 * month — the old console called that lane the seismograph and it is the only
 * thing on this page that is not a word count.
 *
 * ---- the one filter, and why it is printed --------------------------------
 *
 * A frequency table of English is a picture of the word "the". Every word cloud
 * ever built drops the closed-class words, and doing that is a choice about
 * what counts as a word — exactly the kind of choice THE RULE exists to make
 * visible rather than forbid.
 *
 * So the stoplist is closed-class only, it ships inside the dataset, and this
 * instrument **prints it in full** and shows the table **before** it as well.
 * You can read the list, disagree with it, and see precisely what removing it
 * did. A filter you can audit is not the same object as a filter you cannot.
 *
 * Nothing is dropped for being rude, boring or revealing, and the split by
 * direction is a count of who typed the word — not a claim about who owns it.
 */
export function Lexicon({ instrument }: { instrument: Instrument }) {
  const { data, error, loading } = useSet<LexiconSet>('lexicon.json')
  const [side, setSide] = useState<Side>('all')
  const [raw, setRaw] = useState(false)
  const [showStop, setShowStop] = useState(false)

  const rows = useMemo(() => {
    if (!data) return []
    const list = raw ? data.topAll : data.top
    const at = (r: LexiconSet['top'][number]) =>
      side === 'all' ? r.all : side === 'sent' ? r.sent : r.received
    return [...list].sort((a, b) => at(b) - at(a) || a.word.localeCompare(b.word)).slice(0, 120)
  }, [data, raw, side])

  if (loading)
    return (
      <Frame instrument={instrument}>
        <p className="inst__state">counting words…</p>
      </Frame>
    )

  if (error || !data)
    return (
      <Frame instrument={instrument}>
        <p className="inst__state">
          The dataset is missing ({error}). Run <code>npm run lexicon</code> and rebuild.
        </p>
      </Frame>
    )

  const at = (r: LexiconSet['top'][number]) =>
    side === 'all' ? r.all : side === 'sent' ? r.sent : r.received
  const peak = Math.max(1, ...rows.map(at))
  const shoutPeak = Math.max(1, ...data.months.map((m) => (m.count ? m.shouts / m.count : 0)))

  return (
    <Frame
      instrument={instrument}
      controls={
        <div className="pt-chips" role="group" aria-label="Direction">
          {(
            [
              ['all', 'BOTH'],
              ['sent', 'SENT'],
              ['received', 'RECEIVED'],
            ] as [Side, string][]
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              className={`pt-chip${side === value ? ' pt-chip--on' : ''}`}
              aria-pressed={side === value}
              onClick={() => setSide(value)}
            >
              {label}
            </button>
          ))}
        </div>
      }
      footer={
        <p className="inst__method">
          <b>THE STOPLIST</b> The only filter on this page, closed-class only, shipped inside the
          dataset and printed above in full. Nothing was dropped for being rude, boring or
          revealing, and no word was added to it after looking at what removing it would do to the
          chart. WITH EVERYTHING shows the table before it is applied, so the effect of the choice
          can be read rather than trusted.
        </p>
      }
    >
      <div className="pt-split pt-split--wide">
        <div className="pt-stack">
          <div className="pt-chips" style={{ marginBottom: '0.4rem' }}>
            <button
              type="button"
              className={`pt-chip${raw ? '' : ' pt-chip--on'}`}
              aria-pressed={!raw}
              onClick={() => setRaw(false)}
            >
              STOPLIST APPLIED
            </button>
            <button
              type="button"
              className={`pt-chip${raw ? ' pt-chip--on' : ''}`}
              aria-pressed={raw}
              onClick={() => setRaw(true)}
            >
              WITH EVERYTHING
            </button>
          </div>

          <h3 className="pt-sub">
            {raw ? 'EVERY WORD, IN ORDER' : 'AFTER THE STOPLIST'} · TOP {rows.length}
          </h3>
          <ol className="pt-rows pt-scroll pt-scroll--tall" style={{ ['--pt-label' as string]: '8.5rem' }}>
            {rows.map((row, i) => (
              <li key={row.word} className="pt-row">
                <span className="pt-label">
                  {String(i + 1).padStart(3, '0')} {row.word}
                </span>
                <span className="pt-bar">
                  <span className="pt-fill" style={{ inlineSize: `${(at(row) / peak) * 100}%` }} />
                </span>
                <span className="pt-value">{at(row).toLocaleString()}</span>
              </li>
            ))}
          </ol>
        </div>

        <div className="pt-stack">
          <dl className="pt-facts" style={{ marginTop: 0 }}>
            <dt>WORDS</dt>
            <dd>{data.tokens.toLocaleString()} occurrences</dd>
            <dt>DISTINCT</dt>
            <dd>{data.distinct.toLocaleString()} before the stoplist</dd>
            <dt>IN CAPITALS</dt>
            <dd>
              {data.shouts.toLocaleString()} messages ·{' '}
              {((data.shouts / data.messages) * 100).toFixed(2)}% — three letters or more, not one
              of them lowercase
            </dd>
            <dt>STOPLIST</dt>
            <dd>
              {data.stoplist.length} words ·{' '}
              <button
                type="button"
                className="pt-chip"
                style={{ padding: '0.05rem 0.35rem' }}
                aria-expanded={showStop}
                onClick={() => setShowStop((v) => !v)}
              >
                {showStop ? 'HIDE' : 'READ IT'}
              </button>
            </dd>
          </dl>

          {showStop && (
            <p className="pt-note" style={{ fontFamily: 'var(--f-mono)', fontSize: '0.62rem', lineHeight: 1.8 }}>
              {data.stoplist.join(' · ')}
            </p>
          )}

          <h3 className="pt-sub">CAPITALS, BY MONTH</h3>
          <ol className="pt-rows pt-scroll" style={{ ['--pt-label' as string]: '4.2rem' }}>
            {data.months.map((month) => {
              const share = month.count ? month.shouts / month.count : 0
              return (
                <li key={month.bin} className="pt-row">
                  <span className="pt-label">{month.bin}</span>
                  <span className="pt-bar">
                    <span
                      className="pt-fill pt-fill--alt"
                      style={{ inlineSize: `${(share / shoutPeak) * 100}%` }}
                    />
                  </span>
                  <span className="pt-value">{month.shouts}</span>
                </li>
              )
            })}
          </ol>
          <p className="pt-note">
            The bar is the share of that month&apos;s messages written in capitals, scaled to the
            highest share of any month; the number beside it is the count. Only months the exports
            cover are listed — there are 91 of them, and no bar is drawn for a month nobody has.
          </p>
        </div>
      </div>
    </Frame>
  )
}
