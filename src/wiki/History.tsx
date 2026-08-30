/**
 * THE HISTORY PANEL — what this page used to say, and when it stopped.
 *
 * Every other view on the site shows the wiki as it stands. This is the only
 * one that shows it moving, and the thing it is really for is the move nobody
 * announced: a synthesis whose thesis was rewritten, a number that was
 * corrected, a paragraph that quietly went away. `date_modified` in the header
 * says a page changed; this says how.
 *
 * Two things it deliberately does not do:
 *
 * - It does not let you restore a revision. The writing lives in wiki-brain and
 *   is edited there or through the page editor; a restore button here would be
 *   a second, worse write path that skips every gate in that repository.
 * - It does not diff across a gap. Every revision is against its immediate
 *   predecessor, because a diff between two versions six weeks apart reads as
 *   one enormous change and tells you nothing about which commit did what.
 */
import { useEffect, useMemo, useState } from 'react'
import { Markdown } from './Markdown'
import {
  ago,
  changesIn,
  condense,
  shortDate,
  snapshotAt,
  splitSnapshot,
  type PageHistory,
} from './history'
import './history.css'

/** wiki-brain, so a revision can be opened against the record it came from. */
const SOURCE_REPO = 'https://github.com/caakehorn/wiki-brain'

type Props = {
  history: PageHistory
  /** Index into `history.revisions`; 0 is the current page. */
  selected: number
  onSelect: (index: number) => void
  onClose: () => void
}

export function History({ history, selected, onSelect, onClose }: Props) {
  const [mode, setMode] = useState<'changed' | 'was'>('changed')
  const revisions = history.revisions
  const revision = revisions[selected]

  // The oldest revision has no predecessor in this dataset, so there is no
  // "what changed" to show — fall to the snapshot rather than an empty pane.
  const diffable = selected < revisions.length - 1 && !history.withheld
  useEffect(() => {
    if (!diffable && mode === 'changed') setMode('was')
  }, [diffable, mode])

  const changes = useMemo(
    () => (mode === 'changed' && diffable ? condense(changesIn(history, selected) ?? []) : null),
    [history, selected, mode, diffable],
  )
  const snapshot = useMemo(
    () => (mode === 'was' ? snapshotAt(history, selected) : null),
    [history, selected, mode],
  )

  const span = revisions.length
    ? `${shortDate(revisions[revisions.length - 1].date)} — ${shortDate(revisions[0].date)}`
    : ''

  return (
    <section className="hist" aria-label="Page history">
      <header className="hist__head">
        <h2>
          HISTORY<span className="jp" aria-hidden="true"> 履歴</span>
        </h2>
        <p className="hist__span">
          {revisions.length} revision{revisions.length === 1 ? '' : 's'} · {span}
        </p>
        <button type="button" className="hist__close" onClick={onClose}>
          CLOSE
        </button>
      </header>

      {history.withheld === 'moratorium' && (
        <p className="hist__withheld" role="status">
          <b>The revisions of this page are listed but not readable here.</b> The dates,
          the commit messages and the sizes are below; the text of each older version is
          not published on this site, under the standing directive in the wiki&rsquo;s own
          instructions. Nothing has been deleted — every version is still in the
          repository the wiki is written in.
        </p>
      )}

      <div className="hist__grid">
        <ol className="hist__list">
          {revisions.map((rev, i) => (
            <li key={rev.sha}>
              <button
                type="button"
                className={`hist__rev${i === selected ? ' hist__rev--on' : ''}`}
                onClick={() => onSelect(i)}
                aria-current={i === selected ? 'true' : undefined}
              >
                <span className="hist__when">
                  {shortDate(rev.date)}
                  {i === 0 && <b className="hist__now">NOW</b>}
                  {rev.created && <b className="hist__born">CREATED</b>}
                </span>
                <span className="hist__subject">{rev.subject}</span>
                <span className="hist__stat">
                  {rev.op && <i className="hist__op">{rev.op}</i>}
                  {/* Counts, not a judgement: lines the commit put in and took
                      out, straight off the patch this page is built from. */}
                  {rev.added > 0 && <i className="hist__add">+{rev.added}</i>}
                  {rev.removed > 0 && <i className="hist__del">&minus;{rev.removed}</i>}
                  <i className="hist__by">{rev.author}</i>
                </span>
                {rev.renamedFrom && (
                  <span className="hist__moved">moved from {rev.renamedFrom}</span>
                )}
              </button>
            </li>
          ))}
        </ol>

        <div className="hist__pane">
          <div className="hist__tabs" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'changed'}
              disabled={!diffable}
              onClick={() => setMode('changed')}
              title={diffable ? undefined : 'This is the oldest version there is.'}
            >
              WHAT CHANGED
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'was'}
              disabled={Boolean(history.withheld)}
              onClick={() => setMode('was')}
            >
              THE WHOLE PAGE
            </button>
            <a
              className="hist__commit"
              href={`${SOURCE_REPO}/commit/${revision.sha}`}
              target="_blank"
              rel="noreferrer"
            >
              {revision.sha} ↗
            </a>
          </div>

          <p className="hist__stamp">
            {shortDate(revision.date)} · {ago(revision.date)} · {revision.author} ·{' '}
            {revision.lines.toLocaleString()} lines
          </p>

          {mode === 'changed' && changes && (
            <div className="hist__diff">
              {changes.length === 0 && (
                <p className="hist__none">
                  This commit touched the page without changing a line of it — a rename,
                  or a change git recorded against the file with no textual difference.
                </p>
              )}
              <pre>
                {changes.map((line, i) =>
                  line.kind === 'gap' ? (
                    <span key={i} className="hist__gap">
                      ⋯ {line.n} unchanged line{line.n === 1 ? '' : 's'}
                    </span>
                  ) : (
                    <span key={i} className={`hist__line hist__line--${line.kind}`}>
                      {line.kind === 'add' ? '+' : line.kind === 'del' ? '−' : ' '}
                      {line.text}
                    </span>
                  ),
                )}
              </pre>
            </div>
          )}

          {mode === 'was' && snapshot !== null && (
            <div className="hist__snapshot">
              {selected > 0 && (
                <p className="hist__warn" role="status">
                  <b>This is not the current page.</b> You are reading it as it stood on{' '}
                  {shortDate(revision.date)}, {ago(revision.date)}. {selected} later
                  revision{selected === 1 ? ' has' : 's have'} changed it since — some of
                  what follows is no longer what the wiki says.
                </p>
              )}
              <Snapshot raw={snapshot} />
            </div>
          )}

          {mode === 'was' && snapshot === null && (
            <p className="hist__none">The text of this revision is not published here.</p>
          )}
        </div>
      </div>
    </section>
  )
}

/**
 * A historical file, rendered through the same markdown path as a live page.
 *
 * Tables render as tables rather than charts: a chart of a table that was
 * corrected two revisions later is a picture of a number the wiki has since
 * withdrawn, and it would sit on the page looking exactly like the live ones.
 */
function Snapshot({ raw }: { raw: string }) {
  const { h1, body, frontmatter } = useMemo(() => splitSnapshot(raw), [raw])
  const modified = /^date_modified:\s*(.+)$/m.exec(frontmatter)?.[1]?.trim()
  return (
    <article className="hist__page">
      {h1 && <h1>{h1}</h1>}
      {modified && <p className="hist__fm">frontmatter said: date_modified {modified}</p>}
      <Markdown source={body} tables="table" />
    </article>
  )
}
