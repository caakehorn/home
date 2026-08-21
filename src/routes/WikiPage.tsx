import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Nav } from '../components/Nav'
import { Editor } from '../wiki/Editor'
import { Infobox } from '../wiki/Infobox'
import { Markdown, outline } from '../wiki/Markdown'
import { QuickAdd } from '../wiki/QuickAdd'
import { Sealed } from '../wiki/Sealed'
import { editableFrontmatter, humanize, useWikiPage, type WikiPage as Page } from '../wiki/data'
import { relock, sealed } from '../wiki/locks'
import { getDraft } from '../wiki/store'
import './wiki.css'
import '../wiki/quick-add.css'

/** Split a stored draft back into its frontmatter block and body. */
function splitMarkdown(text: string) {
  if (!text.startsWith('---')) return { frontmatter: '', body: text }
  const end = text.indexOf('\n---', 3)
  if (end === -1) return { frontmatter: '', body: text }
  return {
    frontmatter: text.slice(4, end),
    body: text.slice(text.indexOf('\n', end + 1) + 1).replace(/^\s*\n/, ''),
  }
}

export function WikiPageRoute() {
  const params = useParams()
  const slug = params['*'] || ''
  const { data, error, loading } = useWikiPage(slug)

  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState<{ frontmatter: string; body: string } | null>(null)

  // Prefer a local draft over the shipped snapshot.
  useEffect(() => {
    if (!data) return
    const stored = getDraft(data.slug)
    setDraft(stored ? splitMarkdown(stored.source) : { frontmatter: editableFrontmatter(data), body: data.body })
    setEditing(false)
  }, [data])

  const edited = useMemo(() => {
    if (!data || !draft) return null
    return { ...data, body: draft.body } satisfies Page
  }, [data, draft])

  const view = useMemo(() => {
    if (!edited || !draft) return null
    // Re-parse the edited frontmatter so infobox + image changes show live.
    const meta: Record<string, string> = {}
    const infobox: Record<string, string> = {}
    let inInfobox = false
    for (const line of draft.frontmatter.split('\n')) {
      if (/^infobox:/.test(line)) {
        inInfobox = true
        continue
      }
      if (inInfobox && /^\s{2,}\S/.test(line)) {
        const m = line.match(/^\s+([A-Za-z0-9_]+):\s*(.*)$/)
        if (m) infobox[m[1]] = m[2].trim().replace(/^["']|["']$/g, '')
        continue
      }
      const m = line.match(/^([A-Za-z0-9_]+):\s*(.+)$/)
      if (m) {
        inInfobox = false
        meta[m[1]] = m[2].trim().replace(/^["']|["']$/g, '')
      }
    }
    return {
      ...edited,
      meta,
      infobox: Object.keys(infobox).length ? infobox : edited.infobox,
    } satisfies Page
  }, [edited, draft])

  const toc = useMemo(() => (view ? outline(view.body) : []), [view])
  const isDraft = Boolean(data && getDraft(data.slug))
  // A sealed page is not a page that failed to load: it loaded, and this is all
  // of it. The article below is never rendered for one, so there is no frame in
  // which a body exists on screen unlocked — there is no body to have.
  const locked = sealed(data)

  return (
    <div className="wiki">
      <Nav />

      {loading && <p className="wiki__state">reading the brain…</p>}

      {error && (
        <div className="wrap wiki__state">
          <h1 className="wiki__title">NO SUCH PAGE</h1>
          <p>
            <code>{slug}</code> — {error}
          </p>
          <Link to="/brain" className="wiki__back">
            ← BACK TO THE INDEX
          </Link>
        </div>
      )}

      {data && locked && (
        <article className="wrap wiki__article">
          <header className="wiki__head">
            <nav className="wiki__crumbs" aria-label="Breadcrumb">
              <Link to="/brain">WIKI-BRAIN</Link>
              <span aria-hidden="true"> / </span>
              <Link to={`/brain?domain=${data.domain}`}>{data.domain.toUpperCase()}</Link>
            </nav>

            <h1 className="wiki__title">{data.title}</h1>
            <div className="wiki__meta">
              <span className="wiki__chip wiki__chip--sealed">sealed</span>
            </div>
          </header>

          <Sealed page={data} />
        </article>
      )}

      {view && draft && !locked && (
        <article className="wrap wiki__article">
          <header className="wiki__head">
            <nav className="wiki__crumbs" aria-label="Breadcrumb">
              <Link to="/brain">WIKI-BRAIN</Link>
              <span aria-hidden="true"> / </span>
              <Link to={`/brain?domain=${view.domain}`}>{view.domain.toUpperCase()}</Link>
            </nav>

            <h1 className="wiki__title">{view.title}</h1>

            <div className="wiki__meta">
              {view.meta.status && <span className="wiki__chip">{view.meta.status}</span>}
              {view.meta.page_type && <span className="wiki__chip">{view.meta.page_type}</span>}
              <span className="wiki__chip">{view.words.toLocaleString()} words</span>
              {view.charts > 0 && <span className="wiki__chip wiki__chip--hot">{view.charts} charted</span>}
              {isDraft && <span className="wiki__chip wiki__chip--draft">local draft</span>}
              {view.open && (
                <button
                  type="button"
                  className="wiki__chip wiki__chip--sealed wiki__reseal"
                  onClick={relock}
                  title="Drop the lock passphrase this tab is holding"
                >
                  sealed · SEAL AGAIN
                </button>
              )}
              <button type="button" className="wiki__edit" onClick={() => setEditing((v) => !v)}>
                {editing ? 'CLOSE EDITOR' : 'EDIT THIS PAGE'}
              </button>
            </div>
          </header>

          {editing && (
            <Editor
              page={view}
              frontmatter={draft.frontmatter}
              body={draft.body}
              onChange={setDraft}
              onClose={() => setEditing(false)}
            />
          )}

          <div className="wiki__body">
            <Infobox page={view} />
            {toc.length > 2 && (
              <nav className="wiki__toc" aria-label="Contents">
                <b>Contents</b>
                <ol>
                  {toc.map((h) => (
                    <li key={h.id} data-depth={h.depth}>
                      <a href={`#${h.id}`}>{h.text}</a>
                    </li>
                  ))}
                </ol>
              </nav>
            )}
            <Markdown source={view.body} />
            <div className="wiki__clear" />
          </div>

          {(view.lists.sources?.length || view.backlinks.length || view.links.length) > 0 && (
            <footer className="wiki__foot">
              {view.backlinks.length > 0 && (
                <section className="wiki__rel">
                  <h2>Linked from</h2>
                  <ul>
                    {view.backlinks.map((s) => (
                      <li key={s}>
                        <Link to={`/brain/${s}`}>{humanize(s)}</Link>
                      </li>
                    ))}
                  </ul>
                </section>
              )}
              {view.lists.related?.length > 0 && (
                <section className="wiki__rel">
                  <h2>Related</h2>
                  <ul>
                    {view.lists.related.map((s) => {
                      const slugged = s.replace(/^wiki\//, '')
                      return (
                        <li key={s}>
                          <Link to={`/brain/${slugged}`}>{humanize(slugged)}</Link>
                        </li>
                      )
                    })}
                  </ul>
                </section>
              )}
              {view.lists.sources?.length > 0 && (
                <section className="wiki__rel">
                  <h2>Sources</h2>
                  <ul className="wiki__sources">
                    {view.lists.sources.map((s) => (
                      <li key={s}>
                        <code>{s}</code>
                      </li>
                    ))}
                  </ul>
                </section>
              )}
            </footer>
          )}

          <QuickAdd slug={view.slug} domain={view.domain} />
        </article>
      )}
    </div>
  )
}
