import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Marquee } from '../components/Marquee'
import { Nav } from '../components/Nav'
import { SectionArt } from '../components/SectionArt'
import { Ransom } from '../components/Ransom'
import { POSTS, TAGS, stamp, type Post } from '../blog/posts'
import { banner } from '../content/slogans'
import './blog.css'

/**
 * TRANSMISSIONS — the archive.
 *
 * A wall, not a feed. Posts are flyposted: overlapping, taped down, at angles,
 * newest and loudest at the top left. A reverse-chronological list of cards
 * with equal weight is a CMS; this is supposed to look like somebody put it up
 * at night.
 */
export function BlogRoute() {
  const [params, setParams] = useSearchParams()
  const tag = params.get('tag')
  const [query, setQuery] = useState('')

  const posts = useMemo(() => {
    const q = query.trim().toLowerCase()
    return POSTS.filter((post) => (tag ? post.tags.includes(tag) : true)).filter((post) =>
      !q
        ? true
        : post.title.toLowerCase().includes(q) ||
          post.dek.toLowerCase().includes(q) ||
          post.body.toLowerCase().includes(q),
    )
  }, [tag, query])

  const setTag = (next: string | null) => {
    const params = new URLSearchParams()
    if (next) params.set('tag', next)
    setParams(params)
  }

  const [lead, ...rest] = posts

  return (
    <div className="blog">
      <Nav />
      <SectionArt slug="blog" />
      <Marquee text={banner('blog')} duration={19} tone={5} size="clamp(0.75rem, 1.6vw, 1.1rem)" />

      <header className="wrap blog__mast">
        <span className="blog__mast-kana jp" aria-hidden="true">
          通信
        </span>
        <Ransom as="h1" className="blog__mast-title" lean={6}>
          TRANSMISSIONS
        </Ransom>
        <p className="blog__mast-note">
          Long posts, short posts, screenshots at 4am, and whatever the brain coughed up that
          week. {POSTS.length} filed. Nothing scheduled, nothing sponsored, nothing measured —
          there is no analytics on this page and I do not know you are here.
        </p>
      </header>

      <div className="wrap blog__bar">
        <div className="blog__tags" role="group" aria-label="Filter by tag">
          <button
            type="button"
            className={`blog__tag${!tag ? ' blog__tag--on' : ''}`}
            onClick={() => setTag(null)}
          >
            ALL ({POSTS.length})
          </button>
          {TAGS.map((t) => (
            <button
              key={t.tag}
              type="button"
              className={`blog__tag${tag === t.tag ? ' blog__tag--on' : ''}`}
              onClick={() => setTag(tag === t.tag ? null : t.tag)}
            >
              {t.tag} ({t.count})
            </button>
          ))}
        </div>

        <Link to="/blog/write" className="blog__write-btn">
          + WRITE
        </Link>

        <input
          className="blog__search"
          type="search"
          placeholder="search the transmissions…"
          aria-label="Search posts"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />

        <p className="blog__count" aria-live="polite">
          {posts.length} {posts.length === 1 ? 'transmission' : 'transmissions'}
        </p>
      </div>

      {posts.length === 0 && (
        <p className="wrap blog__empty">
          Nothing filed under that. The archive is small on purpose — a zine is not a corpus, and
          the corpus is next door.
        </p>
      )}

      {lead && (
        <div className="wrap blog__lead-wrap">
          <Flyer post={lead} index={0} lead />
        </div>
      )}

      {rest.length > 0 && (
        <div className="wrap blog__wall">
          {rest.map((post, i) => (
            <Flyer key={post.slug} post={post} index={i + 1} />
          ))}
        </div>
      )}

      <footer className="wrap blog__foot">
        <p className="blog__foot-note">
          NO RSS YET · NO NEWSLETTER · NO SUBSCRIBE BUTTON · COME BACK OR DO NOT
        </p>
        <Link to="/" className="blog__back">
          ← BACK TO THE HALLWAY
        </Link>
      </footer>
    </div>
  )
}

function Flyer({ post, index, lead = false }: { post: Post; index: number; lead?: boolean }) {
  return (
    <article
      className={`flyer${lead ? ' flyer--lead' : ''}`}
      style={{
        ['--glow' as string]: `var(--n${post.tone})`,
        // Alternating tilt, so the wall reads as pasted rather than as a grid.
        ['--lean' as string]: `${index % 2 ? 0.9 : -1.1}deg`,
      }}
    >
      <span className="flyer__tape flyer__tape--a" aria-hidden="true" />
      <span className="flyer__tape flyer__tape--b" aria-hidden="true" />

      <span className="flyer__stamp">
        <span className="flyer__date">{stamp(post.date)}</span>
        <span className="flyer__read">{post.minutes} MIN</span>
      </span>

      <span className="flyer__kana jp" aria-hidden="true">
        {post.kana}
      </span>

      <h2 className="flyer__title">
        <Link to={`/blog/${post.slug}`} className="flyer__link">
          {lead ? <Ransom lean={5}>{post.title}</Ransom> : post.title}
        </Link>
      </h2>

      <p className="flyer__dek">{post.dek}</p>

      <span className="flyer__tags" aria-hidden="true">
        {post.tags.map((tag) => (
          <span key={tag} className="flyer__tag">
            {tag}
          </span>
        ))}
      </span>

      <span className="flyer__cta" aria-hidden="true">
        READ IT →
      </span>
    </article>
  )
}
