import { useEffect, useMemo, useRef, useState } from 'react'
import type { WikiPage } from './data'
import { editableFrontmatter, toSource } from './data'
import { Markdown } from './Markdown'
import { configured, ready, unlock } from './keyring'
import { publishPage, SOURCE_REPO } from './publish'
import {
  allImages,
  discardDraft,
  download,
  downscaleImage,
  getDraft,
  saveDraft,
  saveImage,
} from './store'
import './editor.css'

type Props = {
  page: WikiPage
  frontmatter: string
  body: string
  onChange: (next: { frontmatter: string; body: string }) => void
  onClose: () => void
}

/** Set or replace a single top-level key in the frontmatter text. */
function setKey(frontmatter: string, key: string, value: string) {
  const lines = frontmatter.split('\n')
  const at = lines.findIndex((l) => new RegExp(`^${key}:`).test(l))
  const line = `${key}: ${value}`
  if (at >= 0) lines[at] = line
  else lines.unshift(line)
  return lines.join('\n')
}

export function Editor({ page, frontmatter, body, onChange, onClose }: Props) {
  const [tab, setTab] = useState<'body' | 'frontmatter' | 'preview'>('body')
  const [status, setStatus] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [asking, setAsking] = useState(false)
  const [published, setPublished] = useState<string | null>(null)
  const file = useRef<HTMLInputElement>(null)
  const saved = useRef<number | undefined>(undefined)

  const dirty = useMemo(
    () => frontmatter !== editableFrontmatter(page) || body !== page.body,
    [frontmatter, body, page],
  )

  // Autosave to this browser, debounced. There is no server to post to.
  //
  // Except for a sealed page: its draft would be the plaintext of a page that
  // ships as a ciphertext, sitting in localStorage where nothing asks for a
  // passphrase to read it. So a sealed page's edits stay in this tab, in memory,
  // and PUBLISH is the only way out of it — which is said plainly, because an
  // editor that silently does not save is worse than one that cannot.
  useEffect(() => {
    if (!dirty) return
    if (page.locked) {
      setStatus('sealed page — held in this tab only, not saved to this browser')
      return
    }
    window.clearTimeout(saved.current)
    saved.current = window.setTimeout(() => {
      const ok = saveDraft(page.slug, toSource(page, { frontmatter, body }))
      setStatus(ok ? `saved locally · ${new Date().toLocaleTimeString()}` : 'could not save — browser storage is full')
    }, 700)
    return () => window.clearTimeout(saved.current)
  }, [frontmatter, body, dirty, page.slug, page.locked])

  const addPicture = async (chosen: File) => {
    setBusy(true)
    setStatus(null)
    try {
      const dataUrl = await downscaleImage(chosen)
      const id = `${page.slug.replace(/\//g, '-')}-${Date.now().toString(36)}`
      if (!saveImage(id, dataUrl)) {
        setStatus('picture too large for browser storage — try a smaller one')
        return
      }
      let next = setKey(frontmatter, 'image', `upload:${id}`)
      if (!/^image_caption:/m.test(next)) next = setKey(next, 'image_caption', page.title)
      onChange({ frontmatter: next, body })
      setTab('frontmatter')
      setStatus('picture added to the infobox')
    } catch (e) {
      setStatus((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  /**
   * Push the page to the wiki everyone reads.
   *
   * The commit goes to the source repository, not to this site's snapshot of
   * it — the snapshot is a build artifact and the next sync would overwrite
   * anything written there. The site catches up when the rebuild lands, so
   * the local draft is kept until then rather than discarded on success.
   */
  const publish = async () => {
    // Normally nothing is asked: the gate already took the passphrase for this
    // session and the keyring opens on it. The prompt is the exception — a tab
    // that skipped the door, or one whose session storage was cleared under it.
    if (!(await ready()) && (await configured())) {
      setAsking(true)
      return
    }
    setBusy(true)
    setPublished(null)
    try {
      const { commit, pictures } = await publishPage(
        { slug: page.slug, markdown: toSource(page, { frontmatter, body }), images: allImages() },
        setStatus,
      )
      setPublished(commit)
      setStatus(
        `published${pictures ? ` with ${pictures} picture${pictures === 1 ? '' : 's'}` : ''} — ` +
          'live for everyone once the rebuild finishes, a minute or two from now',
      )
    } catch (e) {
      setStatus((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const exportFile = () => {
    download(`${page.slug.split('/').pop()}.md`, toSource(page, { frontmatter, body }))
    setStatus('downloaded — drop it into wiki-brain at wiki/' + page.slug + '.md')
  }

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(toSource(page, { frontmatter, body }))
      setStatus('full page copied to clipboard')
    } catch {
      setStatus('clipboard blocked — use DOWNLOAD instead')
    }
  }

  const revert = () => {
    discardDraft(page.slug)
    onChange({ frontmatter: editableFrontmatter(page), body: page.body })
    setStatus('reverted to the shipped version')
  }

  return (
    <div className="ed">
      <div className="ed__bar">
        <span className="ed__tabs" role="group" aria-label="Editor pane">
          {(['body', 'frontmatter', 'preview'] as const).map((t) => (
            <button
              key={t}
              type="button"
              className={`ed__tab${tab === t ? ' ed__tab--on' : ''}`}
              aria-pressed={tab === t}
              onClick={() => setTab(t)}
            >
              {t.toUpperCase()}
            </button>
          ))}
        </span>

        <button type="button" className="ed__btn" onClick={() => file.current?.click()} disabled={busy}>
          {busy ? 'ADDING…' : '+ PICTURE'}
        </button>
        <input
          ref={file}
          type="file"
          accept="image/*"
          hidden
          onChange={(e) => {
            const chosen = e.target.files?.[0]
            if (chosen) void addPicture(chosen)
            e.target.value = ''
          }}
        />

        <button type="button" className="ed__btn ed__btn--go" onClick={publish} disabled={busy}>
          {busy ? 'SAVING…' : 'SAVE'}
        </button>

        <button type="button" className="ed__btn" onClick={exportFile}>
          DOWNLOAD .MD
        </button>
        <button type="button" className="ed__btn" onClick={copy}>
          COPY
        </button>
        {getDraft(page.slug) && (
          <button type="button" className="ed__btn ed__btn--warn" onClick={revert}>
            REVERT
          </button>
        )}
        <button type="button" className="ed__btn ed__btn--close" onClick={onClose}>
          DONE
        </button>
      </div>

      {asking && (
        <PassPanel
          onDone={(ok) => {
            setAsking(false)
            if (ok) void publish()
          }}
        />
      )}

      {tab === 'preview' ? (
        <div className="ed__preview">
          <Markdown source={body} />
        </div>
      ) : (
        <textarea
          className="ed__area"
          spellCheck={false}
          value={tab === 'body' ? body : frontmatter}
          aria-label={tab === 'body' ? 'Page body, markdown' : 'Frontmatter'}
          onChange={(e) =>
            onChange(
              tab === 'body'
                ? { frontmatter, body: e.target.value }
                : { frontmatter: e.target.value, body },
            )
          }
        />
      )}

      <p className="ed__note" role="status">
        {status ?? (
          <>
            Edits autosave to <b>this browser</b>. <b>SAVE</b> commits the page — and any
            pictures on it — to <code>{SOURCE_REPO}</code>, and the site rebuilds from there, so it
            sticks for every machine that opens the wiki afterwards.
          </>
        )}
        {published && (
          <>
            {' '}
            <a href={published} target="_blank" rel="noreferrer noopener" className="ed__link">
              see the commit →
            </a>
          </>
        )}
      </p>
    </div>
  )
}

/**
 * The passphrase, on the rare occasion it has to be asked for.
 *
 * The keyring normally opens on the passphrase the gate already took, so this
 * panel is not part of saving — it is what happens when a tab has no
 * passphrase to open it with, which means the door was skipped or session
 * storage was cleared underneath it. Same passphrase as the door; there is
 * only one on this site.
 */
export function PassPanel({ onDone }: { onDone: (ok: boolean) => void }) {
  const [value, setValue] = useState('')
  const [wrong, setWrong] = useState(false)
  const [trying, setTrying] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!value.trim() || trying) return
    setTrying(true)
    // 250,000 PBKDF2 iterations — about a second, and the button has to say so
    // or it reads as a dead click.
    const ok = await unlock(value)
    setTrying(false)
    if (!ok) {
      setWrong(true)
      setValue('')
      return
    }
    setValue('')
    onDone(true)
  }

  return (
    <form className="ed__pass" onSubmit={submit}>
      <p className="ed__pass-head">THE PASSPHRASE</p>
      <p className="ed__pass-note">
        The same one the door takes. This tab does not have it — you came in without it, or the tab
        was cleared under you. It opens the key that writes to <code>{SOURCE_REPO}</code>.
      </p>
      <input
        className="ed__pass-field"
        type="password"
        value={value}
        onChange={(e) => {
          setValue(e.target.value)
          setWrong(false)
        }}
        placeholder="passphrase"
        aria-label="Site passphrase"
        aria-invalid={wrong}
        autoComplete="current-password"
        autoFocus
        spellCheck={false}
      />
      {wrong && <p className="ed__pass-wrong">Not it.</p>}
      <div className="ed__pass-row">
        <button type="submit" className="ed__btn ed__btn--go" disabled={trying}>
          {trying ? 'OPENING…' : 'UNLOCK'}
        </button>
        <button type="button" className="ed__btn" onClick={() => onDone(false)}>
          CANCEL
        </button>
      </div>
    </form>
  )
}
