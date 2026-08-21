import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { unlock } from './locks'
import type { WikiPage } from './data'

/**
 * What a sealed page shows instead of itself.
 *
 * Not a redaction bar over prose that is loaded underneath it: the page in the
 * browser's memory at this point is a slug, a domain, a title and a ciphertext,
 * and there is nothing on this screen standing between the reader and a body.
 * Typing the phrase is what produces one.
 *
 * The door has taunts. This does not — the door is for strangers and this is
 * usually the owner, one page deep, having forgotten which phrase. Wrong says
 * wrong.
 */
export function Sealed({ page }: { page: WikiPage }) {
  const [phrase, setPhrase] = useState('')
  const [state, setState] = useState<'idle' | 'trying' | 'wrong'>('idle')

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!phrase.trim() || state === 'trying') return
    setState('trying')
    // Nothing is handed back here on success: `unlock` bumps the lock epoch,
    // every `useWikiPage` in the tab re-reads through it, and this screen is
    // replaced by the page it was standing in for.
    if (!(await unlock(page, phrase))) {
      setState('wrong')
      setPhrase('')
      return
    }
    setState('idle')
  }

  return (
    <section className="wiki__sealed" aria-labelledby="sealed-title">
      <p className="wiki__sealed-mark jp" aria-hidden="true">
        錠
      </p>
      <h2 id="sealed-title">THIS PAGE IS SEALED</h2>
      <p className="wiki__sealed-note">
        It is in the index because it exists. It is not in the building because the door's
        passphrase does not open it — this one has its own, and what you would be reading is a
        ciphertext until that passphrase decrypts it in this browser.
      </p>

      <form className="wiki__sealed-form" onSubmit={submit}>
        <label htmlFor="sealed-phrase">passphrase</label>
        <input
          id="sealed-phrase"
          type="password"
          autoComplete="off"
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          value={phrase}
          onChange={(e) => {
            setPhrase(e.target.value)
            if (state === 'wrong') setState('idle')
          }}
        />
        <button type="submit" disabled={state === 'trying' || !phrase.trim()}>
          {state === 'trying' ? 'OPENING…' : 'OPEN'}
        </button>
      </form>

      <p className="wiki__sealed-state" aria-live="polite">
        {state === 'wrong' && 'wrong. that is the whole check — nothing here decrypted.'}
        {state === 'trying' && '250,000 iterations…'}
      </p>

      <Link to="/brain" className="wiki__back">
        ← BACK TO THE INDEX
      </Link>
    </section>
  )
}
