import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Nav } from '../components/Nav'
import { SectionArt } from '../components/SectionArt'
import { Editor } from '../wiki/Editor'
import { Infobox } from '../wiki/Infobox'
import { Markdown, outline } from '../wiki/Markdown'
import { QuickAdd } from '../wiki/QuickAdd'
import { Sealed } from '../wiki/Sealed'
import { usePortal } from '../state/usePortal'
import { editableFrontmatter, humanize, useWikiPage, type WikiPage as Page } from '../wiki/data'
import { relock, sealed } from '../wiki/locks'
import { discardDraft, draftIsStale, getDraft } from '../wiki/store'
import { remember } from '../wiki/trail'
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
  /** A draft this browser holds that upstream has moved past. See `draftIsStale`. */
  const [stale, setStale] = useState<{ savedAt: string; upstream: string } | null>(null)

  // Prefer a local draft over the shipped snapshot — unless upstream has moved
  // since the draft was forked, in which case preferring it is how a month of
  // other people's work gets published away. Then the shipped page wins and the
  // draft is offered rather than applied.
  useEffect(() => {
    if (!data) return
    const shipped = { frontmatter: editableFrontmatter(data), body: data.body }
    const stored = getDraft(data.slug)
    const upstream = data.meta?.date_modified
    if (stored && draftIsStale(stored, upstream)) {
      setStale({ savedAt: stored.savedAt.slice(0, 10), upstream: upstream ?? '' })
      setDraft(shipped)
    } else {
      setStale(null)
      setDraft(stored ? splitMarkdown(stored.source) : shipped)
    }
    setEditing(false)
  }, [data])

  /** Open the stale draft anyway — a deliberate act, never the default. */
  const openStaleDraft = () => {
    if (!data) return
    const stored = getDraft(data.slug)
    if (stored) setDraft(splitMarkdown(stored.source))
    setStale(null)
  }

  const dropStaleDraft = () => {
    if (!data) return
    discardDraft(data.slug)
    setDraft({ frontmatter: editableFrontmatter(data), body: data.body })
    setStale(null)
  }

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

  // Mark the page read. Keyed off the loaded page rather than off the slug in
  // the URL so a 404 or a failed fetch never enters the trail — "resume
  // reading" pointing at a page that does not exist is worse than no resume.
  useEffect(() => {
    if (data) remember(data.slug, data.title)
  }, [data])

  // A sealed page is not a page that failed to load: it loaded, and this is all
  // of it. The article below is never rendered for one, so there is no frame in
  // which a body exists on screen unlocked — there is no body to have.
  const locked = sealed(data)

  // READER'S DIGEST. The switch is site-wide, but whether it can be honoured is
  // per-page: a twin has to have been written. Three states, and the third is
  // the one worth getting right —
  //
  //   digest, twin exists   -> render the plain edition
  //   digest, no twin       -> render the page, and SAY the plain one does not
  //                            exist yet. Silently serving the technical page
  //                            under a switch the reader has set is the mode
  //                            lying about itself, and they would find out by
  //                            being confused rather than by being told.
  //   full                  -> the page, as written
  //
  // Editing is always against the real page: the twin is a rendering, it is not
  // where the writing lives, and an editor opened on one would be a draft of a
  // file this repository does not own.
  const { readMode, setReadMode } = usePortal()
  const twin = data?.plain ?? null
  const wantsDigest = readMode === 'digest' && !locked
  const showDigest = wantsDigest && Boolean(twin) && !editing

  const toc = useMemo(
    () => (showDigest && twin ? outline(twin.body) : view ? outline(view.body) : []),
    [showDigest, twin, view],
  )
  const isDraft = Boolean(data && getDraft(data.slug)) && !stale

  return (
    <div className="wiki">
      <Nav />
      <SectionArt slug={`brain/${slug}`} />

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
              {showDigest && (
                <span className="wiki__chip wiki__chip--digest">reader&rsquo;s digest</span>
              )}
              {view.meta.status && <span className="wiki__chip">{view.meta.status}</span>}
              {view.meta.page_type && <span className="wiki__chip">{view.meta.page_type}</span>}
              <span className="wiki__chip">
                {(showDigest && twin ? twin.words : view.words).toLocaleString()} words
              </span>
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

          {stale && (
            <div className="wiki__stale" role="status">
              <b>This browser is holding an older draft of this page.</b>
              <p>
                It was saved on {stale.savedAt}, from a version of the page dated before{' '}
                {stale.upstream} — so somebody has written to this page since you last had it
                open. You are reading the current page, not your draft. Publishing the draft
                would delete whatever landed in between.
              </p>
              <p className="wiki__stale-actions">
                <button type="button" onClick={openStaleDraft}>
                  OPEN MY DRAFT ANYWAY
                </button>
                <button type="button" onClick={dropStaleDraft}>
                  DISCARD MY DRAFT
                </button>
              </p>
            </div>
          )}

          {editing && (
            <Editor
              page={view}
              frontmatter={draft.frontmatter}
              body={draft.body}
              base={data?.meta?.date_modified}
              onChange={setDraft}
              onClose={() => setEditing(false)}
            />
          )}

          {/* The switch is on and this page has no plain edition. Say so. The
              alternative — quietly serving the technical page — is the mode
              lying about itself to the one reader who asked it not to. */}
          {wantsDigest && !twin && !editing && (
            <div className="wiki__plainless" role="status">
              <b>There is no Reader&rsquo;s Digest version of this entry yet.</b>
              <p>
                You are reading the full, technical edition. Plain-English versions are
                written one entry at a time — this one has not been done. Nothing has been
                simplified or summarised for you automatically, because a summary nobody
                checked is not a simpler version of the truth.
              </p>
            </div>
          )}

          {/* Gated in the source repo, recomputed at sync, and surfaced here
              anyway. A plain edition that has fallen behind its page is a
              readable, confident, wrong account aimed at the reader least able
              to catch it — so if one ever ships, it ships wearing a label. */}
          {showDigest && twin?.stale && (
            <div className="wiki__stale" role="status">
              <b>This plain-English version is behind the full entry.</b>
              <p>
                It was written against an earlier draft of this page
                {twin.against ? ` (${twin.against})` : ''}, and the entry has been revised
                since. Some of what follows may no longer match what the wiki says. Switch
                to FULL for the current text.
              </p>
            </div>
          )}

          <div className="wiki__body">
            {!showDigest && <Infobox page={view} />}
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
            {/* Keyed on the edition so the tables remount and pick their
                opening face up again — `initialView` is a mount-time default,
                and without this a reader who flips the switch keeps whichever
                face the previous edition left them on. */}
            <Markdown
              key={showDigest ? 'digest' : 'full'}
              source={showDigest && twin ? twin.body : view.body}
              tables={showDigest ? 'table' : 'chart'}
            />
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
              {/* `raw/self/ancestry/23andme-…zip` is a real citation and it is
                  also noise to somebody who came here to understand one thing.
                  The plain edition's own closing note points at the full entry,
                  which is where the paths belong. */}
              {!showDigest && view.lists.sources?.length > 0 && (
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

          {/* The way back to the real thing, at the bottom of the plain
              edition, where somebody who has just understood the finding is
              most likely to want the evidence under it. The header switch does
              the same job and is easy to forget is there. */}
          {showDigest && (
            <p className="wiki__tofull">
              <button type="button" onClick={() => setReadMode('full')}>
                READ THE FULL ENTRY →
              </button>
              <i>
                Every number here, plus the sources, the cross-references and the record of
                what has been revised.
              </i>
            </p>
          )}

          <QuickAdd slug={view.slug} domain={view.domain} />
        </article>
      )}
    </div>
  )
}
