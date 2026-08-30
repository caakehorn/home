import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Marquee } from '../components/Marquee'
import { Nav } from '../components/Nav'
import { SubHead } from '../components/Wordmark'
import { SectionArt } from '../components/SectionArt'
import { banner } from '../content/slogans'
import { Ask } from '../sage/Ask'
import { Log } from '../sage/Log'
import { invalidate, loadSage, type SageLog } from '../sage/log'
import './sage.css'

/**
 * THE SAGE — the one room where the wiki is asked something instead of read.
 *
 * Every other wing here is Dan looking at his own record. This one is anybody
 * else looking at it, and asking it a question he cannot answer for them
 * credibly himself — because a man's word about his own future behaviour is
 * exactly the evidence in question, and 486 pages and 134,348 messages are not.
 *
 * The latency is the design and it is stated up front rather than apologised for
 * afterwards. A question is filed to the wiki repository, listed at the top of
 * its work queue, and answered by a pass that reads the corpus for it. No model
 * sits behind this box. What comes back cites what it read.
 */
export function SageRoute() {
  const [log, setLog] = useState<SageLog | null>(null)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(() => {
    invalidate()
    loadSage().then(setLog).catch((e: Error) => setError(e.message))
  }, [])

  useEffect(() => {
    loadSage().then(setLog).catch((e: Error) => setError(e.message))
  }, [])

  return (
    <div className="sage">
      <Nav />
      <Marquee
        text={banner('sage')}
        duration={20}
        tone={4}
        size="clamp(0.75rem, 1.6vw, 1.05rem)"
      />

      <header className="wrap sage__masthead">
        <h1 className="sage__mast-title">
          <SubHead>THE SAGE</SubHead>
        </h1>
        <span className="sage__mast-kana jp" aria-hidden="true">
          賢者
        </span>
        <p className="sage__mast-note">
          Ask the record about the man. Every answer cites its sources and quotes them with
          dates, including the ones that do not flatter him.
          {log && log.counts.asked > 0 && (
            <>
              {' '}
              <span className="sage__tally">
                {log.counts.asked} asked
                {log.counts.answered > 0 ? ` · ${log.counts.answered} answered` : ''}
                {log.counts.pending > 0 ? ` · ${log.counts.pending} awaiting` : ''}
                {log.counts.declined > 0 ? ` · ${log.counts.declined} declined` : ''}
              </span>
            </>
          )}
        </p>
      </header>

      <SectionArt slug="sage" tone={4} />

      <div className="wrap sage__body">
        <Ask onAsked={refresh} />

        <aside className="sage__how">
          <b>How this works, and what it will not do.</b>
          <p>
            There is no model behind the box. Your question is committed to{' '}
            <Link to="/brain">the wiki</Link> as a file and goes to the top of its work list;
            it is answered by a pass that reads the corpus for it — the pages, and the
            message record underneath them — and writes an answer with citations you can
            follow. That takes as long as it takes, and the log below says which questions
            are still waiting.
          </p>
          <p>
            The answer, and anything new it turns up on the way, goes back into the wiki as
            source material. Questions make the brain bigger. Ask a narrow one and you get
            better proof than a broad one; ask about something the record cannot settle and
            the answer will say so.
          </p>
        </aside>

        {error && <p className="sage__state">{error}</p>}
        {!log && !error && <p className="sage__state">reading the log…</p>}
        {log && <Log log={log} />}
      </div>
    </div>
  )
}
