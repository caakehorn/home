import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Brief } from './Brief'
import { segmentBriefs, type Brief as BriefData } from './brief'
import { loadPage, type IndexEntry } from './data'

/**
 * Every compressed block in the wiki, opened up, on one page.
 *
 * The visualiser is otherwise only met by landing on a page that happens to
 * have a brief. This is the front door: the index flags which pages carry one
 * and the deck reads those pages, so the reader can take the whole set of
 * machine-facing summaries as a single human-facing document.
 */
type Entry = { page: IndexEntry; briefs: BriefData[] }

export function BriefDeck({ pages }: { pages: IndexEntry[] }) {
  const [entries, setEntries] = useState<Entry[]>([])
  const [loading, setLoading] = useState(true)
  const slugs = pages.map((p) => p.slug).join('|')

  useEffect(() => {
    let live = true
    setLoading(true)
    Promise.all(
      pages.map(async (page) => {
        try {
          const data = await loadPage(page.slug)
          const briefs = segmentBriefs(data.body).flatMap((s) => (s.kind === 'brief' ? [s.brief] : []))
          return { page, briefs }
        } catch {
          return { page, briefs: [] }
        }
      }),
    ).then((all) => {
      if (!live) return
      setEntries(all.filter((e) => e.briefs.length > 0))
      setLoading(false)
    })
    return () => {
      live = false
    }
    // The slug list is the identity of the request; the array itself is fresh
    // on every render of the index.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slugs])

  if (loading) return <p className="wiki__state">opening the briefs…</p>
  if (!entries.length) return <p className="wiki__state">No brief on these pages.</p>

  return (
    <div className="deck">
      {entries.map(({ page, briefs }) => (
        <section key={page.slug} className="deck__item">
          <h2 className="deck__title">
            <Link to={`/brain/${page.slug}`}>{page.title}</Link>
            <span className="deck__domain">{page.domain}</span>
          </h2>
          {briefs.map((brief, i) => (
            <Brief key={i} brief={brief} anchor={`${page.slug.replace(/\//g, '-')}-${brief.id}`} />
          ))}
        </section>
      ))}
    </div>
  )
}
