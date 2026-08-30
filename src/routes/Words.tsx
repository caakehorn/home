import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Marquee } from '../components/Marquee'
import { Nav } from '../components/Nav'
import { SubHead } from '../components/Wordmark'
import { SectionArt } from '../components/SectionArt'
import { banner } from '../content/slogans'
import { Catch } from '../lexicon/Catch'
import { forget, loadWords, type WordEntry, type WordLog } from '../lexicon/log'
import { Markdown } from '../wiki/Markdown'
import './words.css'

/**
 * THE NET — words caught before they are understood.
 *
 * Named for what it does rather than what it holds, because LEVIATHAN already
 * has a room called the Lexicon and that one is the *counting* — 19,873
 * distinct words ranked over the whole corpus. This is the front of that
 * pipeline: a word nobody has counted yet, held until somebody does.
 *
 * The sage room is where somebody asks the wiki a question. This is where
 * somebody hands it a word, which is a smaller act and a differently useful
 * one: a question wants an answer, and a word wants a *count*.
 *
 * That distinction is the whole room. `wiki/interests/language/vocabulary-lexicon`
 * already holds a couple of hundred words, and every one of them is there
 * because it was **selected as pleasing** in a single generated session —
 * which the page says plainly about itself. What it has almost none of is
 * words somebody actually says. The only thing that turns the first kind into
 * the second is a pass counting the word against 106,629 sent messages, and
 * this box is the front of that pipeline.
 *
 * The first word through it demonstrated the point by breaking something: it
 * was pulled off a "documented persona slang" list purely to test the loop,
 * and it turned out to appear once, in a six-term list totalling nineteen.
 * That correction exists because somebody counted, and no amount of looking at
 * the list would have produced it.
 */

const STATE = {
  pending: { label: 'WAITING', kana: '待', note: 'Caught. Nobody has counted it yet.' },
  analyzed: { label: 'COUNTED', kana: '数', note: 'Checked against the message record.' },
  rejected: { label: 'NOTHING', kana: '無', note: 'Checked and found to be nothing. Kept anyway.' },
} as const

export function WordsRoute() {
  const [log, setLog] = useState<WordLog | null>(null)
  const [missing, setMissing] = useState(false)

  const load = useCallback(() => {
    loadWords().then((l) => {
      setLog(l)
      setMissing(l === null)
    })
  }, [])

  useEffect(load, [load])

  const refresh = useCallback(() => {
    forget()
    load()
  }, [load])

  return (
    <div className="lex">
      <Nav />
      <Marquee
        text={banner('brain')}
        duration={20}
        tone={2}
        size="clamp(0.75rem, 1.6vw, 1.05rem)"
      />

      <header className="wrap lex__masthead">
        <h1 className="lex__mast-title">
          <SubHead>THE NET</SubHead>
        </h1>
        <span className="lex__mast-kana jp" aria-hidden="true">
          網
        </span>
        <p className="lex__mast-note">
          Words caught before they are understood. Type one in and it is filed to the wiki
          repository, where a pass counts it against the message record and writes what it
          finds into{' '}
          <Link to="/brain/interests/language/vocabulary-lexicon">the vocabulary page</Link>.
          Already-counted vocabulary — 19,873 distinct words, ranked — lives in{' '}
          <Link to="/leviathan/lexicon">Leviathan's lexicon</Link>; this is for the ones
          nothing has counted yet.
          {log && (
            <>
              {' '}
              {log.counts.caught} caught · {log.counts.pending} waiting ·{' '}
              {log.counts.analyzed} counted
              {log.counts.rejected ? ` · ${log.counts.rejected} came to nothing` : ''}.
            </>
          )}
        </p>
      </header>

      <SectionArt slug="words" tone={2} />

      <div className="wrap lex__body">
        <Catch onCaught={refresh} />

        <aside className="lex__why">
          <h2 className="lex__why-head">Why this asks for a word and not an opinion</h2>
          <p>
            The vocabulary page holds a couple of hundred entries and nearly all of them were{' '}
            <i>selected</i> — picked as pleasing out of a generated pool in one sitting. That is
            a real record of taste and it is not a record of speech.
          </p>
          <p>
            A word that arrives here gets the other treatment: counted, dated, and set against
            what else is in the corpus before anything is concluded from it. The first word
            through this box came off a list of “documented persona slang” and turned out to
            appear <b>once</b> in 106,629 sent messages — the six-term list it belonged to
            totalled nineteen, and one of its members turned out to be a self-description
            rather than an insult.
          </p>
          <p className="lex__why-kicker">
            Nothing on this page is answered by a machine. It waits for somebody to count it.
          </p>
        </aside>
      </div>

      {missing && (
        <p className="wrap lex__state">
          No word list has been built for this deployment yet. Run{' '}
          <code>node scripts/sync-wiki.mjs ../wiki-brain</code> and rebuild.
        </p>
      )}

      {log && log.entries.length > 0 && (
        <ul className="wrap lex__list">
          {log.entries.map((entry) => (
            <Word key={entry.id} entry={entry} />
          ))}
        </ul>
      )}

      {log && log.entries.length === 0 && (
        <p className="wrap lex__state">Nothing caught yet. The box above is how that changes.</p>
      )}
    </div>
  )
}

function Word({ entry }: { entry: WordEntry }) {
  const state = STATE[entry.status] ?? STATE.pending
  const [open, setOpen] = useState(false)

  return (
    <li className={`lex__word lex__word--${entry.status}`}>
      <div className="lex__word-head">
        <span className="lex__badge" title={state.note}>
          <span className="jp" aria-hidden="true">
            {state.kana}
          </span>
          {state.label}
        </span>
        <h2 className="lex__word-title">{entry.word}</h2>
        <span className="lex__word-meta">
          {entry.kind}
          {entry.added ? ` · caught ${entry.added.slice(0, 10)}` : ''}
          {entry.analyzed ? ` · counted ${entry.analyzed}` : ''}
        </span>
      </div>

      {entry.note && <p className="lex__word-note">{entry.note}</p>}

      {entry.reading ? (
        <>
          <button type="button" className="lex__toggle" onClick={() => setOpen((o) => !o)}>
            {open ? 'HIDE THE READING' : 'READ WHAT THE COUNT FOUND'}
          </button>
          {open && (
            <div className="lex__reading">
              <Markdown source={entry.reading} />
              {entry.targets.length > 0 && (
                <p className="lex__targets">
                  Written into{' '}
                  {entry.targets.map((t, i) => (
                    <span key={t}>
                      {i > 0 && ', '}
                      <Link to={`/brain/${t.replace(/^wiki\//, '').replace(/\.md$/, '')}`}>
                        {t.replace(/^wiki\//, '').replace(/\.md$/, '')}
                      </Link>
                    </span>
                  ))}
                  .
                </p>
              )}
            </div>
          )}
        </>
      ) : (
        // Never dressed up as a loading state: there is no model behind the box
        // and this word is genuinely waiting on a person.
        <p className="lex__word-waiting">{state.note}</p>
      )}
    </li>
  )
}
