import { useState } from 'react'
import { KINDS, MAX_NOTE, MAX_WORD, submit, validate, type Kind } from './submit'

/**
 * The box.
 *
 * One field that matters, one bucket, one optional note. Deliberately the
 * smallest capture surface in this building, because the whole value of it is
 * that using it costs nothing — a word noticed in passing has a short half-life
 * and a form that asks four questions is a form that loses the word.
 *
 * The note is optional and says so. The bucket defaults to `word` and can be
 * left there: nobody typing something into a box yet knows whether it is slang
 * or an insult, and asking for a category at capture time is asking for a guess
 * and then storing it as a fact. A session may disagree with it in the reading.
 *
 * What this does not do is spin. There is no model behind it. Pressing CATCH
 * commits a file to the wiki repository, and the reading arrives when somebody
 * has counted the word against the message record.
 */
export function Catch({ onCaught }: { onCaught: () => void }) {
  const [word, setWord] = useState('')
  const [kind, setKind] = useState<Kind>('word')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState<string | null>(null)
  const [caught, setCaught] = useState<string | null>(null)

  const problem = word.trim() ? validate({ word, kind, note }) : null
  const left = MAX_NOTE - note.trim().length

  const send = async () => {
    setBusy(true)
    setStatus(null)
    try {
      await submit({ word, kind, note }, setStatus)
      setCaught(word.trim())
      setWord('')
      setNote('')
      setStatus(null)
      onCaught()
    } catch (err) {
      setStatus(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  if (caught) {
    return (
      <div className="lex__catch lex__catch--done">
        <p className="lex__done-head">CAUGHT — “{caught}”.</p>
        <p>
          It is in the wiki repository and on the work list. A pass will count it against the
          message record before concluding anything about it, then fold the reading into the
          vocabulary page.
        </p>
        <p>
          That step is the point. The vocabulary page already holds a hundred words{' '}
          <i>selected</i> as pleasing; what it has almost none of is words <i>measured</i>, and
          counting is the only thing that turns one into the other.
        </p>
        <button type="button" className="lex__again" onClick={() => setCaught(null)}>
          CATCH ANOTHER
        </button>
      </div>
    )
  }

  return (
    <div className="lex__catch">
      <label className="lex__label" htmlFor="lex-word">
        A word, a piece of slang, a phrase
      </label>
      <input
        id="lex-word"
        className="lex__field"
        value={word}
        maxLength={MAX_WORD}
        placeholder="type it exactly as you heard it"
        onChange={(e) => setWord(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !problem && word.trim() && !busy) send()
        }}
        disabled={busy}
      />

      <div className="lex__kinds" role="group" aria-label="What kind">
        {KINDS.map((k) => (
          <button
            key={k}
            type="button"
            className={`lex__kind${kind === k ? ' lex__kind--on' : ''}`}
            aria-pressed={kind === k}
            onClick={() => setKind(k)}
            disabled={busy}
          >
            {k.toUpperCase()}
          </button>
        ))}
      </div>

      <label className="lex__label" htmlFor="lex-note">
        Where you heard it, what you think it means — optional
      </label>
      <textarea
        id="lex-note"
        className="lex__field lex__field--note"
        value={note}
        rows={3}
        placeholder="leave it blank if you just want the word down"
        onChange={(e) => setNote(e.target.value)}
        disabled={busy}
      />

      <p className="lex__meter" aria-live="polite">
        {problem ?? status ?? (note.trim() && left < 120 ? `${left} characters left` : '')}
      </p>

      <button
        type="button"
        className="lex__go"
        onClick={send}
        disabled={busy || !word.trim() || Boolean(problem)}
      >
        {busy ? 'FILING…' : 'CATCH IT'}
      </button>
    </div>
  )
}
