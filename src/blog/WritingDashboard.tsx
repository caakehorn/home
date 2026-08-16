/**
 * The writing dashboard — where transmissions get written and published.
 *
 * A markdown editor with frontmatter fields, preview pane, autosave to
 * localStorage, and a PUBLISH button that commits the post to this
 * repository through the GitHub API (same keyring as the gate).
 *
 * Posts are markdown files in `src/blog/posts/` — same as the bundled
 * ones. Publishing adds a new file (or updates an existing one) and the
 * site rebuilds with it live on /blog.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Marquee } from '../components/Marquee'
import { Markdown } from '../wiki/Markdown'
import { configured, ready, unlock } from '../wiki/keyring'
import { publishPost, slugify, toMarkdown } from './publish-blog'
import { type Post } from './posts'
import { banner } from '../content/slogans'
import './writing-dashboard.css'

type Meta = {
  title: string
  slug: string
  date: string
  dek: string
  tags: string
  kana: string
  tone: number
}

const blankMeta = (today: string): Meta => ({
  title: '',
  slug: '',
  date: today,
  dek: '',
  tags: '',
  kana: '通信',
  tone: 5,
})

const STORAGE_KEY = 'danfrank:blog-draft:'

function loadDraft(slug: string): { meta: Meta; body: string } | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY + slug)
    if (!raw) return null
    return JSON.parse(raw)
  } catch {
    return null
  }
}

function saveDraft(slug: string, meta: Meta, body: string) {
  try {
    localStorage.setItem(
      STORAGE_KEY + slug,
      JSON.stringify({ meta, body, saved: Date.now() }),
    )
  } catch {
    /* storage full — fail silently, the textarea still works */
  }
}

function clearDraft(slug: string) {
  localStorage.removeItem(STORAGE_KEY + slug)
}

function todayISO(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

type Props = {
  /** When editing an existing post */
  post?: Post
}

export function WritingDashboard({ post }: Props) {
  const navigate = useNavigate()
  const today = todayISO()

  const initialMeta = post
    ? {
        title: post.title,
        slug: post.slug,
        date: post.date,
        dek: post.dek,
        tags: post.tags.join(', '),
        kana: post.kana,
        tone: post.tone,
      }
    : blankMeta(today)

  const [meta, setMeta] = useState<Meta>(() => {
    if (post) return initialMeta
    const saved = loadDraft('')
    return saved?.meta ?? initialMeta
  })
  const [body, setBody] = useState<string>(() => {
    if (post) return post.body
    const saved = loadDraft('')
    return saved?.body ?? ''
  })
  const [tab, setTab] = useState<'write' | 'preview'>('write')
  const [status, setStatus] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [asking, setAsking] = useState(false)
  const [published, setPublished] = useState<string | null>(null)

  const slugManuallyEdited = useRef(false)
  const savedTimer = useRef<number | undefined>(undefined)

  // Autosave to localStorage, debounced
  const dirty = meta !== initialMeta || body !== (post?.body ?? '')
  useEffect(() => {
    if (!dirty) return
    window.clearTimeout(savedTimer.current)
    savedTimer.current = window.setTimeout(() => {
      saveDraft(post?.slug ?? '', meta, body)
      setStatus(`saved locally · ${new Date().toLocaleTimeString()}`)
    }, 700)
    return () => window.clearTimeout(savedTimer.current)
  }, [meta, body, dirty, post?.slug])

  // Auto-generate slug from title (only if not manually edited)
  useEffect(() => {
    if (slugManuallyEdited.current || post) return
    setMeta((m) => ({ ...m, slug: slugify(m.title) }))
  }, [meta.title, post])

  const wordCount = useMemo(() => body.split(/\s+/).filter(Boolean).length, [body])
  const minuteCount = Math.max(1, Math.round(wordCount / 220))

  const updateMeta = (key: keyof Meta, value: string | number) => {
    setMeta((m) => ({ ...m, [key]: value }))
  }

  const publish = async () => {
    if (!meta.title.trim()) {
      setStatus('a transmission needs a title')
      return
    }
    if (!meta.slug.trim()) {
      setStatus('a transmission needs a slug')
      return
    }
    if (!body.trim()) {
      setStatus('a transmission needs a body — write something first')
      return
    }

    if (!(await ready()) && (await configured())) {
      setAsking(true)
      return
    }

    setBusy(true)
    setPublished(null)
    try {
      const commitUrl = await publishPost(
        meta,
        body,
        (note) => setStatus(note),
      )
      setPublished(commitUrl)
      if (!post) clearDraft('')
      setStatus(
        'published — live on /blog in about two minutes once the deploy finishes',
      )
    } catch (e) {
      setStatus((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const downloadFile = () => {
    const md = toMarkdown(meta, body)
    const blob = new Blob([md], { type: 'text/markdown' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${meta.slug || 'post'}.md`
    a.click()
    URL.revokeObjectURL(url)
    setStatus('downloaded — drop it into src/blog/posts/ to commit it')
  }

  const revert = () => {
    if (post) {
      setMeta(initialMeta)
      setBody(post.body)
    } else {
      setMeta(blankMeta(today))
      setBody('')
      clearDraft('')
    }
    setStatus('reverted to the shipped version')
  }

  return (
    <div className="wd">
      <Marquee text={banner('blog')} duration={19} tone={5} size="clamp(0.75rem, 1.6vw, 1.1rem)" />

      <header className="wrap wd__head">
        <Ransom as="h1" className="wd__title">
          THE DESK
        </Ransom>
        <p className="wd__sub">
          Write a transmission. It autosaves to this browser. PUBLISH commits it to the
          repository and the site rebuilds with it live.
        </p>
      </header>

      {asking && (
        <PassPanel
          onDone={(ok) => {
            setAsking(false)
            if (ok) void publish()
          }}
        />
      )}

      <div className="wrap wd__meta-row">
        <label className="wd__field wd__field--title">
          <span className="wd__label">TITLE</span>
          <input
            className="wd__input"
            type="text"
            value={meta.title}
            onChange={(e) => updateMeta('title', e.target.value)}
            placeholder="FOUR AM IS A METHODOLOGY"
            spellCheck={false}
          />
        </label>

        <label className="wd__field wd__field--slug">
          <span className="wd__label">SLUG</span>
          <input
            className="wd__input"
            type="text"
            value={meta.slug}
            onChange={(e) => {
              slugManuallyEdited.current = true
              updateMeta('slug', e.target.value)
            }}
            placeholder="four-am-is-a-methodology"
            spellCheck={false}
          />
        </label>

        <label className="wd__field wd__field--date">
          <span className="wd__label">DATE</span>
          <input
            className="wd__input"
            type="date"
            value={meta.date}
            onChange={(e) => updateMeta('date', e.target.value)}
          />
        </label>

        <label className="wd__field wd__field--tone">
          <span className="wd__label">TONE</span>
          <select
            className="wd__input"
            value={meta.tone}
            onChange={(e) => updateMeta('tone', Number(e.target.value))}
          >
            <option value={1}>1 · ink</option>
            <option value={2}>2 · toner</option>
            <option value={3}>3 · red</option>
            <option value={4}>4 · blue</option>
            <option value={5}>5 · neon</option>
          </select>
        </label>
      </div>

      <div className="wrap wd__meta-row">
        <label className="wd__field wd__field--dek">
          <span className="wd__label">DEK</span>
          <input
            className="wd__input"
            type="text"
            value={meta.dek}
            onChange={(e) => updateMeta('dek', e.target.value)}
            placeholder="One sentence. The standfirst on the card and under the headline."
            spellCheck={false}
          />
        </label>

        <label className="wd__field wd__field--tags">
          <span className="wd__label">TAGS</span>
          <input
            className="wd__input"
            type="text"
            value={meta.tags}
            onChange={(e) => updateMeta('tags', e.target.value)}
            placeholder="method, argument, den"
            spellCheck={false}
          />
        </label>

        <label className="wd__field wd__field--kana">
          <span className="wd__label">KANA</span>
          <input
            className="wd__input"
            type="text"
            value={meta.kana}
            onChange={(e) => updateMeta('kana', e.target.value)}
            placeholder="通信"
            spellCheck={false}
          />
        </label>
      </div>

      <div className="wrap wd__bar">
        <span className="wd__tabs" role="group" aria-label="Editor pane">
          <button
            type="button"
            className={`wd__tab${tab === 'write' ? ' wd__tab--on' : ''}`}
            aria-pressed={tab === 'write'}
            onClick={() => setTab('write')}
          >
            WRITE
          </button>
          <button
            type="button"
            className={`wd__tab${tab === 'preview' ? ' wd__tab--on' : ''}`}
            aria-pressed={tab === 'preview'}
            onClick={() => setTab('preview')}
          >
            PREVIEW
          </button>
        </span>

        <span className="wd__stats">
          {wordCount.toLocaleString()} words · {minuteCount} min
        </span>

        <button
          type="button"
          className="wd__btn wd__btn--go"
          onClick={publish}
          disabled={busy}
        >
          {busy ? 'PUBLISHING…' : 'PUBLISH'}
        </button>
        <button type="button" className="wd__btn" onClick={downloadFile}>
          DOWNLOAD .MD
        </button>
        {(dirty || post) && (
          <button type="button" className="wd__btn wd__btn--warn" onClick={revert}>
            REVERT
          </button>
        )}
        <button
          type="button"
          className="wd__btn wd__btn--close"
          onClick={() => navigate('/blog')}
        >
          ← BACK
        </button>
      </div>

      <div className="wrap wd__editor">
        {tab === 'write' ? (
          <textarea
            className="wd__area"
            spellCheck={false}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="The body. Markdown. Same renderer as the wiki — [[wiki/…]] links, tables become charts, whatever you write here is what ships."
          />
        ) : (
          <div className="wd__preview">
            <Markdown source={body} />
          </div>
        )}
      </div>

      <p className="wrap wd__note" role="status">
        {status ?? (
          <>
            Edits autosave to <b>this browser</b>. <b>PUBLISH</b> commits the file to
            this repository and rebuilds the site.
          </>
        )}
        {published && (
          <>
            {' '}
            <a href={published} target="_blank" rel="noreferrer noopener" className="wd__link">
              see the commit →
            </a>
          </>
        )}
      </p>
    </div>
  )
}

function Ransom({
  as: Tag,
  className,
  children,
}: {
  as: 'h1'
  className?: string
  children: React.ReactNode
}) {
  return <Tag className={className}>{children}</Tag>
}

/**
 * Passphrase panel — same as the wiki editor.
 */
function PassPanel({ onDone }: { onDone: (ok: boolean) => void }) {
  const [value, setValue] = useState('')
  const [wrong, setWrong] = useState(false)
  const [trying, setTrying] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!value.trim() || trying) return
    setTrying(true)
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
    <form className="wd__pass" onSubmit={submit}>
      <p className="wd__pass-head">THE PASSPHRASE</p>
      <p className="wd__pass-note">
        The same one the door takes. This tab does not have it.
      </p>
      <input
        className="wd__pass-field"
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
      {wrong && <p className="wd__pass-wrong">Not it.</p>}
      <div className="wd__pass-row">
        <button type="submit" className="wd__btn wd__btn--go" disabled={trying}>
          {trying ? 'OPENING…' : 'UNLOCK'}
        </button>
        <button type="button" className="wd__btn" onClick={() => onDone(false)}>
          CANCEL
        </button>
      </div>
    </form>
  )
}
