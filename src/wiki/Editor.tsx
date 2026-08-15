import { useEffect, useMemo, useRef, useState } from 'react'
import type { WikiPage } from './data'
import { frontmatterOf } from './data'
import { Markdown } from './Markdown'
import { forgetToken, getToken, publishPage, setToken, SOURCE_REPO } from './publish'
import {
  allImages,
  discardDraft,
  download,
  downscaleImage,
  getDraft,
  saveDraft,
  saveImage,
  toMarkdown,
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
    () => frontmatter !== frontmatterOf(page) || body !== page.body,
    [frontmatter, body, page],
  )

  // Autosave to this browser, debounced. There is no server to post to.
  useEffect(() => {
    if (!dirty) return
    window.clearTimeout(saved.current)
    saved.current = window.setTimeout(() => {
      const ok = saveDraft(page.slug, toMarkdown(frontmatter, body))
      setStatus(ok ? `saved locally · ${new Date().toLocaleTimeString()}` : 'could not save — browser storage is full')
    }, 700)
    return () => window.clearTimeout(saved.current)
  }, [frontmatter, body, dirty, page.slug])

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
    if (!getToken()) {
      setAsking(true)
      return
    }
    setBusy(true)
    setPublished(null)
    try {
      const { commit, pictures } = await publishPage(
        { slug: page.slug, markdown: toMarkdown(frontmatter, body), images: allImages() },
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
    download(`${page.slug.split('/').pop()}.md`, toMarkdown(frontmatter, body))
    setStatus('downloaded — drop it into wiki-brain at wiki/' + page.slug + '.md')
  }

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(toMarkdown(frontmatter, body))
      setStatus('full page copied to clipboard')
    } catch {
      setStatus('clipboard blocked — use DOWNLOAD instead')
    }
  }

  const revert = () => {
    discardDraft(page.slug)
    onChange({ frontmatter: frontmatterOf(page), body: page.body })
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
          {busy ? 'PUBLISHING…' : 'PUBLISH'}
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
        <TokenPanel
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
            Edits autosave to <b>this browser</b>. <b>PUBLISH</b> commits the page — and any
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
        {getToken() && (
          <button
            type="button"
            className="ed__forget"
            onClick={() => {
              forgetToken()
              setStatus('token forgotten on this device')
            }}
          >
            FORGET TOKEN
          </button>
        )}
      </p>
    </div>
  )
}

/**
 * Where the write credential is asked for.
 *
 * There is no server to hold a secret, so publishing needs a token from
 * whoever is doing it. It stays in this tab unless "remember" is ticked, and
 * it is never sent anywhere except api.github.com.
 */
function TokenPanel({ onDone }: { onDone: (ok: boolean) => void }) {
  const [value, setValue] = useState('')
  const [remember, setRemember] = useState(false)

  return (
    <form
      className="ed__token"
      onSubmit={(e) => {
        e.preventDefault()
        if (!value.trim()) return
        setToken(value.trim(), remember)
        setValue('')
        onDone(true)
      }}
    >
      <p className="ed__token-head">A GITHUB TOKEN, TO WRITE TO THE WIKI</p>
      <p className="ed__token-note">
        Fine-grained, with <b>contents: read and write</b> on <code>{SOURCE_REPO}</code> and{' '}
        <code>caakehorn/home</code> — nothing else. It is held in this tab, sent only to
        api.github.com, and never committed anywhere.
      </p>
      <input
        className="ed__token-field"
        type="password"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="github_pat_…"
        aria-label="GitHub token"
        autoComplete="off"
        spellCheck={false}
      />
      <label className="ed__token-check">
        <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
        remember on this device — only on a machine you own
      </label>
      <div className="ed__token-row">
        <button type="submit" className="ed__btn ed__btn--go">
          USE IT
        </button>
        <button type="button" className="ed__btn" onClick={() => onDone(false)}>
          CANCEL
        </button>
      </div>
    </form>
  )
}
