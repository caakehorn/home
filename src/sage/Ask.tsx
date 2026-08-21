import { useState } from 'react'
import { ask, MAX_ASKER, MAX_QUESTION, validate } from './ask'

/**
 * The box.
 *
 * Two fields and a button. The name is optional and says so — a question asked
 * without one is answered the same way, and the log renders it as anonymous.
 *
 * What this does not do is spin. There is no model behind it: pressing ASK
 * commits a file to the wiki repository and the answer arrives when somebody has
 * read the corpus and written one. Saying that plainly, before the question is
 * asked rather than after, is the difference between a slow answer and a broken
 * chat box.
 */
export function Ask({ onAsked }: { onAsked: () => void }) {
  const [question, setQuestion] = useState('')
  const [asker, setAsker] = useState('')
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  const problem = question.trim() ? validate({ question, asker }) : null
  const left = MAX_QUESTION - question.trim().length

  const submit = async () => {
    setBusy(true)
    setStatus(null)
    try {
      await ask({ question, asker }, setStatus)
      setQuestion('')
      setDone(true)
      setStatus(null)
      onAsked()
    } catch (err) {
      setStatus(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  if (done) {
    return (
      <div className="sage__ask sage__ask--done">
        <p className="sage__done-head">FILED.</p>
        <p>
          Your question is in the wiki repository and on the work list, at the top of it. It
          will be answered by a pass that reads the corpus for it — not in a moment, and not
          by a machine improvising from a summary.
        </p>
        <p>
          It appears in the log below within a minute or two, marked <b>awaiting</b>, once
          the site has rebuilt.
        </p>
        <button type="button" className="sage__again" onClick={() => setDone(false)}>
          ASK ANOTHER
        </button>
      </div>
    )
  }

  return (
    <div className="sage__ask">
      <label className="sage__label" htmlFor="sage-q">
        Ask it something about Dan
      </label>
      <textarea
        id="sage-q"
        className="sage__field sage__field--question"
        value={question}
        onChange={(e) => setQuestion(e.target.value)}
        placeholder="What he did, why he did it, or what the record says he will do next. Specific questions get better proofs than broad ones."
        rows={5}
        maxLength={MAX_QUESTION + 200}
        disabled={busy}
        spellCheck
      />

      <div className="sage__row">
        <label className="sage__label sage__label--inline" htmlFor="sage-who">
          Who's asking <span className="sage__optional">— optional</span>
        </label>
        <input
          id="sage-who"
          className="sage__field sage__field--asker"
          value={asker}
          onChange={(e) => setAsker(e.target.value)}
          placeholder="leave blank to ask anonymously"
          maxLength={MAX_ASKER}
          disabled={busy}
          spellCheck={false}
        />
      </div>

      <div className="sage__actions">
        <button
          type="button"
          className="sage__submit"
          onClick={submit}
          disabled={busy || Boolean(problem) || question.trim().length < 12}
        >
          {busy ? 'FILING…' : 'ASK'}
        </button>
        {left < 200 && <span className="sage__count">{left} left</span>}
        {(problem || status) && (
          <span className={`sage__status${problem ? ' sage__status--bad' : ''}`}>
            {problem ?? status}
          </span>
        )}
      </div>
    </div>
  )
}
