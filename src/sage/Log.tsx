import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Markdown } from '../wiki/Markdown'
import { citeSlug, isWikiCite, type SageEntry, type SageLog } from './log'

/**
 * The running log — everything ever asked, and what came back.
 *
 * Three things this does that a chat transcript would not:
 *
 * A **pending** entry renders as pending, in full, saying what it is waiting
 * for. It is not hidden until it has an answer and it is not dressed as a
 * loading state. Somebody asked; the honest thing to show is the question and
 * the fact that nobody has answered it yet.
 *
 * Every citation is a **link**. An answer's claim to be worth anything rests on
 * what it cites, and a citation you cannot follow in one click is decoration —
 * so `wiki/` paths become router links into `/brain`, and `raw/` paths render as
 * what they are: the file in the archive, named, not linked, because the archive
 * is not published.
 *
 * A **declined** entry is shown, with its reason. A question nobody wanted to
 * answer is visible as one; deleting it would make the log a curated list of
 * questions that flattered the answer.
 */

const STATUS_LABEL: Record<SageEntry['status'], string> = {
  pending: 'awaiting an answer',
  answered: 'answered',
  declined: 'declined',
}

function Cites({ cites }: { cites: string[] }) {
  if (!cites.length) return null
  const wiki = cites.filter(isWikiCite)
  const raw = cites.filter((c) => !isWikiCite(c))
  return (
    <div className="sage__cites">
      <b className="sage__cites-head">Sources</b>
      {wiki.length > 0 && (
        <ul className="sage__cite-list">
          {wiki.map((cite) => (
            <li key={cite}>
              <Link to={`/brain/${citeSlug(cite)}`} className="sage__cite">
                {citeSlug(cite)}
              </Link>
            </li>
          ))}
        </ul>
      )}
      {raw.length > 0 && (
        <ul className="sage__cite-list sage__cite-list--raw">
          {raw.map((cite) => (
            <li key={cite}>
              {/* Not a link on purpose: raw/ is the private archive behind the
                  wiki and is not published. Naming the file is the citation. */}
              <code className="sage__cite sage__cite--raw">{cite}</code>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function Entry({ entry }: { entry: SageEntry }) {
  const [open, setOpen] = useState(entry.status !== 'answered')
  const asked = entry.asked?.slice(0, 10) ?? ''

  return (
    <li className={`sage__entry sage__entry--${entry.status}`}>
      <div className="sage__entry-head">
        <span className={`sage__badge sage__badge--${entry.status}`}>
          {STATUS_LABEL[entry.status]}
        </span>
        <span className="sage__who">{entry.asker ?? 'anonymous'}</span>
        {asked && <span className="sage__when">{asked}</span>}
      </div>

      <blockquote className="sage__question">{entry.question}</blockquote>

      {entry.status === 'pending' && (
        <p className="sage__waiting">
          Nobody has answered this yet. There is no model behind the box — the question is
          on the wiki's work list at priority 1, and the answer will be written by a pass
          that reads the corpus for it and cites what it read.
        </p>
      )}

      {entry.status !== 'pending' && entry.answer && (
        <>
          <button
            type="button"
            className="sage__toggle"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
          >
            {open ? 'HIDE THE ANSWER' : 'READ THE ANSWER'}
          </button>
          {open && (
            <div className="sage__answer">
              <Markdown source={entry.answer} />
              <Cites cites={entry.cites} />
              {entry.capture && (
                <p className="sage__filed">
                  Filed to the archive as <code>{entry.capture}</code>
                  {entry.answered ? ` on ${entry.answered}` : ''}.
                </p>
              )}
            </div>
          )}
        </>
      )}
    </li>
  )
}

type Filter = 'all' | SageEntry['status']

const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all', label: 'ALL' },
  { id: 'answered', label: 'ANSWERED' },
  { id: 'pending', label: 'AWAITING' },
  { id: 'declined', label: 'DECLINED' },
]

export function Log({ log }: { log: SageLog }) {
  const [filter, setFilter] = useState<Filter>('all')

  const entries = useMemo(
    () => (filter === 'all' ? log.entries : log.entries.filter((e) => e.status === filter)),
    [log, filter],
  )

  if (!log.entries.length) {
    return (
      <p className="sage__empty">
        Nothing has been asked yet. The box above is the first question.
      </p>
    )
  }

  return (
    <div className="sage__log">
      <div className="sage__filters">
        {FILTERS.map((f) => {
          const n = f.id === 'all' ? log.counts.asked : log.counts[f.id]
          if (!n && f.id !== 'all') return null
          return (
            <button
              key={f.id}
              type="button"
              className={`sage__filter${filter === f.id ? ' sage__filter--on' : ''}`}
              onClick={() => setFilter(f.id)}
            >
              {f.label} <span className="sage__filter-n">{n}</span>
            </button>
          )
        })}
      </div>

      <ul className="sage__entries">
        {entries.map((entry) => (
          <Entry key={entry.id} entry={entry} />
        ))}
      </ul>
    </div>
  )
}
