import { useEffect, useMemo, useState } from 'react'
import { loadPage, toSource } from './data'
import { configured, ready } from './keyring'
import { capture, flag, invalidate, loadGaps, stage, type Gap, type GapIndex, type GapPage } from './gaps'
import { PassPanel } from './Editor'
import { publishFile, publishPage } from './publish'
import './gaps.css'

/** One slot: only one answer is ever being typed at a time. */
const DRAFT = 'danfrank:gap-answer:v1'

/**
 * THE GAPS — answering what the wiki says it does not know, from the wiki.
 *
 * 269 open gaps across 116 of 460 pages, and `OPEN.md` has been publishing that
 * list since it was built without anything consuming it. Most are not blocked
 * on a missing export or a better parser; they are blocked on the one source
 * that cannot be mined, who could settle most of them in a sentence. This is
 * that source's keyboard, in the place the reading already happens.
 *
 * Three panes, left to right, because that is the actual shape of the job: pick
 * the page, pick the thing it does not know, say it. Nothing is a dialog — the
 * list stays visible while you type, so answering three gaps on one page is
 * three sentences rather than three round trips.
 *
 * MANUAL is a first-class row at the top of every page's list rather than a
 * mode toggle somewhere else. Most of what an operator knows is not shaped like
 * an answer to a question the wiki already thought to write down, and putting
 * it behind a switch would say the opposite.
 */
export function Gaps() {
  const [index, setIndex] = useState<GapIndex | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [slug, setSlug] = useState<string | null>(null)
  const [picked, setPicked] = useState<Gap | null | undefined>(undefined)
  const [answer, setAnswer] = useState('')
  const [query, setQuery] = useState('')
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState<string | null>(null)
  const [asking, setAsking] = useState(false)

  /**
   * The answer box survives a reload.
   *
   * It did not, and the first time saving failed the operator lost a paragraph
   * he had just typed and had to type it again to find out whether the fix had
   * worked. An answer here is the one thing on this screen that exists nowhere
   * else yet — everything else can be re-fetched — so it is the one thing that
   * has to be written down before anything is attempted with it.
   */
  useEffect(() => {
    try {
      const held = localStorage.getItem(DRAFT)
      if (held) setAnswer(held)
    } catch {
      /* private mode */
    }
  }, [])

  useEffect(() => {
    try {
      if (answer.trim()) localStorage.setItem(DRAFT, answer)
      else localStorage.removeItem(DRAFT)
    } catch {
      /* private mode */
    }
  }, [answer])

  useEffect(() => {
    loadGaps().then(setIndex).catch((e: Error) => setError(e.message))
  }, [])

  const pages = useMemo(() => {
    if (!index) return []
    const q = query.trim().toLowerCase()
    return index.pages
      .filter((p) => !q || p.slug.toLowerCase().includes(q) || p.title.toLowerCase().includes(q))
      .sort((a, b) => b.gaps.length - a.gaps.length || a.slug.localeCompare(b.slug))
  }, [index, query])

  const page: GapPage | null = useMemo(
    () => index?.pages.find((p) => p.slug === slug) ?? null,
    [index, slug],
  )

  const choose = (next: string) => {
    setSlug(next)
    setPicked(undefined)
    setAnswer('')
    setStatus(null)
  }

  /**
   * Stage the answer and commit it.
   *
   * The page is re-fetched rather than staged from the baked dataset: that file
   * is a build artifact and may be a deploy behind the page it describes, and
   * committing a stale body would silently revert whatever landed in between.
   */
  const save = async () => {
    if (picked === undefined || !answer.trim() || !page) return
    if (!(await ready()) && (await configured())) {
      setAsking(true)
      return
    }
    setBusy(true)
    setStatus('reading the current page…')
    try {
      const live = await loadPage(page.slug)

      // The raw capture first: it is the permanent record, and the staging
      // block cites its path. Committing the page first would leave a citation
      // pointing at a file that does not exist yet.
      const note = capture(page.slug, page.domain, picked, answer)
      setStatus('filing the answer…')
      await publishFile(note.path, note.text, `Answer a gap on ${page.slug}`)

      const staged = stage(live.body, picked, answer, note.path)
      if (staged.error) {
        setStatus(staged.error)
        return
      }
      const markdown = toSource(live, {
        frontmatter: flag(live.fmRaw ?? ''),
        body: staged.body,
      })
      await publishPage({ slug: page.slug, markdown, images: {} }, setStatus)
      setStatus(
        picked
          ? 'staged — the gap is off the list and waiting for the next pass to work it in'
          : 'staged — waiting for the next pass to work out where it belongs',
      )
      setAnswer('')
      setPicked(undefined)
      invalidate()
      loadGaps().then(setIndex).catch(() => {})
    } catch (e) {
      setStatus((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  if (error) return <p className="gaps__state">{error}</p>
  if (!index) return <p className="gaps__state">reading the gaps…</p>

  return (
    <div className="gaps">
      <p className="gaps__lede">
        <b>{index.counts.open}</b> open gap{index.counts.open === 1 ? '' : 's'} across{' '}
        <b>{index.counts.pages}</b> page{index.counts.pages === 1 ? '' : 's'}
        {index.counts.staged > 0 && (
          <>
            {' · '}
            <b>{index.counts.staged}</b> page{index.counts.staged === 1 ? '' : 's'} already holding an
            answer nothing has acted on
          </>
        )}
        . Answering stages it on the page and flags it; the next pass over that page works it in and
        cascades it. Nothing here rewrites the page for you.
      </p>

      <div className="gaps__panes">
        <div className="gaps__pane gaps__pane--pages">
          <input
            className="gaps__search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="filter pages"
            aria-label="Filter pages"
            spellCheck={false}
          />
          <ul className="gaps__pages">
            {pages.map((p) => (
              <li key={p.slug}>
                <button
                  type="button"
                  className={`gaps__page${p.slug === slug ? ' gaps__page--on' : ''}`}
                  onClick={() => choose(p.slug)}
                >
                  <span className="gaps__count">{p.gaps.length}</span>
                  <span className="gaps__slug">{p.slug}</span>
                  {p.staged && <span className="gaps__staged" title={`answer staged ${p.staged}`}>●</span>}
                </button>
              </li>
            ))}
          </ul>
        </div>

        <div className="gaps__pane gaps__pane--gaps">
          {!page ? (
            <p className="gaps__empty">Pick a page.</p>
          ) : (
            <>
              <p className="gaps__head">{page.title}</p>
              <ul className="gaps__list">
                <li>
                  <button
                    type="button"
                    className={`gaps__gap gaps__gap--manual${picked === null ? ' gaps__gap--on' : ''}`}
                    onClick={() => {
                      setPicked(null)
                      setStatus(null)
                    }}
                  >
                    MANUAL — something the page never thought to ask about
                  </button>
                </li>
                {page.gaps.map((g) => (
                  <li key={g.text}>
                    <button
                      type="button"
                      className={`gaps__gap${picked?.text === g.text ? ' gaps__gap--on' : ''}`}
                      onClick={() => {
                        setPicked(g)
                        setStatus(null)
                      }}
                    >
                      {g.label}
                    </button>
                  </li>
                ))}
              </ul>
              {!page.gaps.length && (
                <p className="gaps__empty">
                  Nothing open on this page — MANUAL still takes anything you want on it.
                </p>
              )}
            </>
          )}
        </div>

        <div className="gaps__pane gaps__pane--answer">
          {picked === undefined ? (
            <p className="gaps__empty">Pick a gap, or MANUAL.</p>
          ) : (
            <>
              {picked ? (
                <pre className="gaps__quote">{picked.text}</pre>
              ) : (
                <p className="gaps__manual-note">
                  Not tied to a listed gap. Staged and ingested exactly the same way.
                </p>
              )}
              <textarea
                className="gaps__box"
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                placeholder="What you know. First person, as long as it needs to be."
                aria-label="Your answer"
                autoFocus
              />
              <div className="gaps__row">
                <button
                  type="button"
                  className="gaps__btn gaps__btn--go"
                  onClick={save}
                  disabled={busy || !answer.trim()}
                >
                  {busy ? 'SAVING…' : 'SAVE'}
                </button>
                <button
                  type="button"
                  className="gaps__btn"
                  onClick={() => {
                    setPicked(undefined)
                    setAnswer('')
                    setStatus(null)
                  }}
                >
                  CANCEL
                </button>
              </div>
              {status && (
                <p className="gaps__status" role="status">
                  {status}
                </p>
              )}
              {asking && (
                <PassPanel
                  onDone={(ok) => {
                    setAsking(false)
                    if (ok) void save()
                  }}
                />
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
