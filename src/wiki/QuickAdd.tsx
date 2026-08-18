import { useState } from 'react'
import { loadPage, toSource } from './data'
import { configured, ready } from './keyring'
import { capture, flag, stage } from './gaps'
import { PassPanel } from './Editor'
import { publishFile, publishPage } from './publish'
import './quick-add.css'

type Props = {
  slug: string
  domain: string
}

/**
 * QUICK ADD — one-click manual entry from the article footer.
 *
 * Functionally identical to the MANUAL path in Gaps.tsx (picked === null):
 * the answer is captured to raw/, staged onto the page under
 * `## Operator answers — pending ingest`, and `pending_ingest:` is flagged
 * in frontmatter. The next pass reads it and works it in.
 *
 * The only difference from Gaps is there is no page picker, no gap list,
 * no quote box — you are already on the page, so the whole interaction is
 * one button → one textarea → SAVE.
 */
export function QuickAdd({ slug, domain }: Props) {
  const [open, setOpen] = useState(false)
  const [answer, setAnswer] = useState('')
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState<string | null>(null)
  const [asking, setAsking] = useState(false)
  const [published, setPublished] = useState<string | null>(null)

  const save = async () => {
    if (!answer.trim()) return
    if (!(await ready()) && (await configured())) {
      setAsking(true)
      return
    }
    setBusy(true)
    setStatus('reading the current page…')
    try {
      const live = await loadPage(slug)

      const note = capture(slug, domain, null, answer)
      setStatus('filing the answer…')
      await publishFile(note.path, note.text, `Manual note on ${slug}`)

      const staged = stage(live.body, null, answer, note.path)
      if (staged.error) {
        setStatus(staged.error)
        return
      }
      const markdown = toSource(live, {
        frontmatter: flag(live.fmRaw ?? ''),
        body: staged.body,
      })
      const { commit } = await publishPage({ slug, markdown, images: {} }, setStatus)
      setPublished(commit)
      setStatus('staged — waiting for the next pass to work it in')
      setAnswer('')
      setOpen(false)
    } catch (e) {
      setStatus((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const cancel = () => {
    setOpen(false)
    setAnswer('')
    setStatus(null)
    setPublished(null)
  }

  return (
    <div className="qa">
      {!open ? (
        <button type="button" className="qa__btn" onClick={() => setOpen(true)}>
          + ADD NOTE
        </button>
      ) : (
        <div className="qa__panel">
          <p className="qa__label">MANUAL ENTRY</p>
          <p className="qa__note">
            Not tied to a listed gap. Staged and ingested exactly the same way — the
            next pass decides where it belongs and whether it contradicts anything already there.
          </p>
          <textarea
            className="qa__box"
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            placeholder="What you know. First person, as long as it needs to be."
            aria-label="Your note"
            autoFocus
          />
          <div className="qa__row">
            <button
              type="button"
              className="qa__btn qa__btn--go"
              onClick={save}
              disabled={busy || !answer.trim()}
            >
              {busy ? 'SAVING…' : 'SAVE'}
            </button>
            <button type="button" className="qa__btn" onClick={cancel} disabled={busy}>
              CANCEL
            </button>
          </div>
          {status && (
            <p className="qa__status" role="status">
              {status}
            </p>
          )}
          {published && (
            <p className="qa__commit">
              <a href={published} target="_blank" rel="noreferrer noopener">
                see the commit →
              </a>
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
        </div>
      )}
    </div>
  )
}
