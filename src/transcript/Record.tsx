import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { Line } from './Line'
import { Rail } from './Rail'
import {
  loadWholeRecord,
  monthLabel,
  monthOfLine,
  parseQuery,
  passesFilter,
  useIndex,
  useMonth,
  type DirFilter,
  type Row,
  type TranscriptIndex,
} from './core'
import './transcript.css'

/** Rows added per growth step. The record is long; the DOM does not have to be. */
const CHUNK = 400

/** A row on screen: the message, and the line number it carries in the record. */
type Cite = { row: Row; line: number }

const hashLine = () => {
  const at = /^#L(\d+)$/.exec(location.hash)
  return at ? Number(at[1]) : null
}

export function Record() {
  const { data: index, error, loading } = useIndex()

  if (loading) return <p className="tsc__state">opening the record…</p>
  if (error || !index)
    return (
      <p className="tsc__state">
        The record is not on this deploy ({error}). Run{' '}
        <code>npm run transcript -- ../leviathan</code> against a checkout of the old repo and
        rebuild.
      </p>
    )

  return <Reader index={index} />
}

function Reader({ index }: { index: TranscriptIndex }) {
  const { hash } = useLocation()

  const [bin, setBin] = useState(index.months[0].bin)
  const [filter, setFilter] = useState<DirFilter>(0)
  const [query, setQuery] = useState('')
  const [landed, setLanded] = useState<number | null>(null)
  const [shown, setShown] = useState(CHUNK)

  // Typing stays responsive: the input updates on every keystroke, the scan
  // across 134,000 rows runs against the value React has caught up to.
  const deferred = useDeferredValue(query)
  const { term, line: typedLine } = useMemo(() => parseQuery(deferred), [deferred])
  const searching = term.length > 0

  const month = useMonth(searching ? null : bin)

  const open = useCallback((pick: string) => {
    setBin(pick)
    setLanded(null)
    scrollTo({ top: 0 })
  }, [])

  // ---- the whole record, once somebody asks a question of all of it --------
  const [corpus, setCorpus] = useState<Row[] | null>(null)
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null)
  const [corpusError, setCorpusError] = useState<string | null>(null)

  useEffect(() => {
    if (!searching) {
      setCorpusError(null)
      return
    }
    if (corpus || progress || corpusError) return
    setProgress({ done: 0, total: index.months.length })
    loadWholeRecord(index, (done, total) => setProgress({ done, total }))
      .then((rows) => {
        setCorpus(rows)
        setProgress(null)
      })
      .catch((e: Error) => {
        setCorpusError(e.message)
        setProgress(null)
      })
  }, [searching, corpus, progress, corpusError, index])

  // Folded once when the corpus lands, rather than per row per keystroke.
  const folded = useMemo(() => corpus?.map((row) => row[2].toLowerCase()) ?? null, [corpus])

  // ---- what is on screen ---------------------------------------------------
  const rows: Cite[] = useMemo(() => {
    const out: Cite[] = []
    if (searching) {
      if (!corpus || !folded) return out
      for (let i = 0; i < corpus.length; i++) {
        if (!passesFilter(corpus[i][1], filter)) continue
        if (folded[i].includes(term)) out.push({ row: corpus[i], line: i + 1 })
      }
      return out
    }
    if (!month.data) return out
    const from = month.data.from
    month.data.m.forEach((row, i) => {
      if (passesFilter(row[1], filter)) out.push({ row, line: from + i })
    })
    return out
  }, [searching, corpus, folded, term, filter, month.data])

  // Any change to what is being read starts it from the top again.
  useEffect(() => setShown(CHUNK), [bin, filter, term, month.data])

  // ---- deep links ----------------------------------------------------------
  // `#L1234` is the record's own address for a message, and the same one the
  // old repo used. It has to work cold: the month it lives in is very likely
  // not the month on screen, and may not be loaded at all. `hashchange` is
  // listened for as well as the router's location, because clicking an in-page
  // anchor moves the hash without going through the router.
  const goToLine = useCallback(
    (line: number) => {
      const home = monthOfLine(index, line)
      if (!home) return
      setBin(home.bin)
      setLanded(line)
    },
    [index],
  )

  useEffect(() => {
    const follow = () => {
      const line = hashLine()
      if (line === null) return
      setQuery('')
      goToLine(line)
    }
    follow()
    addEventListener('hashchange', follow)
    return () => removeEventListener('hashchange', follow)
  }, [hash, goToLine])

  // A typed `#1234` is the same gesture as a link, so it goes the same place.
  // The box is left alone — clearing it would eat the digits still being typed.
  useEffect(() => {
    if (typedLine !== null) goToLine(typedLine)
  }, [typedLine, goToLine])

  // Grow far enough to hold the landed line, then put it under the reader's eye.
  useEffect(() => {
    if (landed === null || searching || !month.data) return
    const at = rows.findIndex((r) => r.line === landed)
    if (at === -1) return
    if (at >= shown) {
      setShown(at + CHUNK)
      return
    }
    document.getElementById(`L${landed}`)?.scrollIntoView({ block: 'center' })
  }, [landed, rows, shown, searching, month.data])

  // ---- growth --------------------------------------------------------------
  const total = rows.length
  const visible = useMemo(() => rows.slice(0, shown), [rows, shown])
  const more = total > shown

  const observer = useRef<IntersectionObserver | null>(null)
  const sentinel = useCallback((node: HTMLDivElement | null) => {
    observer.current?.disconnect()
    observer.current = null
    if (!node) return
    const io = new IntersectionObserver(
      ([entry]) => entry.isIntersecting && setShown((n) => n + CHUNK),
      { rootMargin: '1400px 0px' },
    )
    io.observe(node)
    observer.current = io
  }, [])

  const at = index.months.findIndex((m) => m.bin === bin)
  const prev = index.months[at - 1]
  const next = index.months[at + 1]

  return (
    <div className="tsc">
      <Ledger index={index} />

      <div className="tsc__bar">
        <input
          type="search"
          className="tsc__q"
          value={query}
          placeholder="search the whole record — or #1234 for a line"
          autoComplete="off"
          spellCheck={false}
          aria-label="Search the record"
          onChange={(e) => {
            setQuery(e.target.value)
            setLanded(null)
          }}
        />

        <div className="tsc__filters" role="group" aria-label="Who sent it">
          {(
            [
              [0, 'BOTH'],
              [1, 'DAN ONLY'],
              [2, 'ANNIE ONLY'],
            ] as [DirFilter, string][]
          ).map(([value, label]) => (
            <button
              key={label}
              type="button"
              className="tsc__filter"
              aria-pressed={filter === value}
              onClick={() => setFilter(value)}
            >
              {label}
            </button>
          ))}
        </div>

        <span className="tsc__count" aria-live="polite">
          {/* Until the whole record is in hand there is no answer yet, and
              "0 matches" would be a wrong one rather than an early one. */}
          {searching
            ? corpusError
              ? `could not read the record — ${corpusError}`
              : corpus
                ? `${total.toLocaleString()} of ${index.count.toLocaleString()} lines match`
                : `reading the record · ${progress?.done ?? 0} / ${index.months.length} months`
            : `${monthLabel(bin)} · ${total.toLocaleString()} lines${filter ? ' shown' : ''}`}
        </span>
      </div>

      {!searching && <Rail index={index} current={bin} onPick={open} />}

      {searching && !corpus && !corpusError && (
        <p className="tsc__state">
          Searching all of it means having all of it — about 9 MB, arriving a month at a time. It
          is cached once it lands, so the wait is per session and not per search.
        </p>
      )}

      {!searching && month.loading && <p className="tsc__state">reading {monthLabel(bin)}…</p>}
      {!searching && month.error && (
        <p className="tsc__state">This month is not on the deploy ({month.error}).</p>
      )}
      {searching && corpus && total === 0 && (
        <p className="tsc__state">
          Nothing in the record matches “{term}”{filter ? ' under this filter' : ''}.
        </p>
      )}

      <ol className="tsc__doc">
        {visible.map((cite) => (
          <Line
            key={cite.line}
            row={cite.row}
            line={cite.line}
            term={searching ? term : ''}
            landed={!searching && cite.line === landed}
          />
        ))}
      </ol>

      {more && (
        <div className="tsc__more" ref={sentinel}>
          <button type="button" className="tsc__filter" onClick={() => setShown((n) => n + CHUNK)}>
            {(total - shown).toLocaleString()} MORE
          </button>
        </div>
      )}

      {searching && total > 0 && (
        <p className="tsc__note">
          Every match is a line in the record and links back into it: the number on the left opens
          the month it was sent in, at that message.
        </p>
      )}

      {!searching && !month.loading && (
        <div className="tsc__step">
          {prev ? (
            <button type="button" className="tsc__filter" onClick={() => open(prev.bin)}>
              ← {monthLabel(prev.bin)}
            </button>
          ) : (
            <span className="tsc__end">the record starts here</span>
          )}
          {next ? (
            <button type="button" className="tsc__filter" onClick={() => open(next.bin)}>
              {monthLabel(next.bin)} →
            </button>
          ) : (
            <span className="tsc__end">the record ends here</span>
          )}
        </div>
      )}
    </div>
  )
}

/**
 * What the record is, before a word of it is read.
 *
 * Every number here is a count taken over the whole file — no sample, no
 * exclusion, no rounding. The provenance is stated in the same breath, because
 * a transcript with no account of where it came from is an assertion.
 */
function Ledger({ index }: { index: TranscriptIndex }) {
  const { counts } = index
  const chips: [string, string][] = [
    ['MESSAGES', index.count.toLocaleString()],
    ['FROM DAN', counts.sent.toLocaleString()],
    ['FROM ANNIE', counts.received.toLocaleString()],
    ['FIRST', index.first.slice(0, 10)],
    ['LAST', index.last.slice(0, 10)],
    ['MONTHS COVERED', `${index.span.covered} of ${index.span.months}`],
    ['CHARACTERS', counts.characters.toLocaleString()],
    ['REACTIONS', counts.reactions.toLocaleString()],
    ['WITH AN ATTACHMENT', counts.attachments.toLocaleString()],
  ]

  const missing = index.gaps.reduce((n, gap) => n + gap.months, 0)

  return (
    <header className="tsc__ledger">
      <dl className="tsc__chips">
        {chips.map(([label, value]) => (
          <div key={label} className="tsc__chip">
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>

      <p className="tsc__note">
        The message history between Dan and Annie, in the order it was sent — nothing removed and
        nothing edited. It runs across all three of her numbers and is assembled from every export
        on file, because no single export holds the whole thing. Each line says who sent it and
        carries a line number, so any one message can be pointed at exactly: <code>#L1234</code> in
        the address bar, or the number on the left of any line. Faded lines are reactions — a heart
        or a thumb on someone else&rsquo;s message, not a message of its own. <b>ATT</b> marks one
        that carried a photo or an attachment.
      </p>

      <p className="tsc__note">
        <b>THE GAPS ARE IN THE EXPORTS, NOT IN THE RELATIONSHIP.</b> The record covers{' '}
        {index.span.covered} of the {index.span.months} months it spans; {missing.toLocaleString()}{' '}
        months are missing entirely
        {index.gaps.length > 0 && (
          <>
            {' '}
            —{' '}
            {index.gaps
              .map((gap) => (gap.from === gap.to ? gap.from : `${gap.from} → ${gap.to}`))
              .join(', ')}
          </>
        )}
        . Those runs are computed from the file rather than remembered, and the rail below draws
        them at their real width so an absence cannot pass for a quiet stretch.
      </p>

      <p className="tsc__source">
        SOURCE {index.source}
        {index.builtAt && <> · BUILT {index.builtAt.slice(0, 10)}</>} · VENDORED{' '}
        {index.generatedAt.slice(0, 10)} · SPLIT BY MONTH, OTHERWISE UNTOUCHED
      </p>
    </header>
  )
}
