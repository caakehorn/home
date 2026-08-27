import { useMemo } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Nav } from '../components/Nav'
import { SectionArt } from '../components/SectionArt'
import { Ransom } from '../components/Ransom'
import { Markdown, outline } from '../wiki/Markdown'
import { neighbours, postBySlug, stamp } from '../blog/posts'
import './blog.css'

/**
 * One transmission.
 *
 * The body goes through the wiki's markdown renderer untouched — same charts
 * out of tables, same `[[wiki/…]]` links straight into the brain. A post and a
 * wiki page are the same organism seen from two angles, and giving the blog its
 * own second renderer would have been the moment they stopped being that.
 */
export function BlogPostRoute() {
  const { slug = '' } = useParams()
  const post = postBySlug(slug)
  const toc = useMemo(() => (post ? outline(post.body) : []), [post])
  const { newer, older } = neighbours(slug)

  if (!post) {
    return (
      <div className="blog">
        <Nav />
        <main className="wrap blog__missing">
          <Ransom as="h1" className="blog__mast-title">
            DEAD AIR
          </Ransom>
          <p className="blog__mast-note">
            No transmission at <code>{slug}</code>. It was never filed, or it was never written —
            and this site does not delete, so it is the second one.
          </p>
          <Link to="/blog" className="blog__back">
            ← BACK TO THE ARCHIVE
          </Link>
        </main>
      </div>
    )
  }

  return (
    <div className="blog blog--post" style={{ ['--glow' as string]: `var(--n${post.tone})` }}>
      <Nav />
      <SectionArt slug={`blog/${slug}`} />

      <article className="wrap post">
        <header className="post__head">
          <nav className="post__crumbs" aria-label="Breadcrumb">
            <Link to="/blog">TRANSMISSIONS</Link>
            <span aria-hidden="true"> / </span>
            <span>{stamp(post.date)}</span>
          </nav>

          <Ransom as="h1" className="post__title" lean={5}>
            {post.title}
          </Ransom>

          <p className="post__dek">{post.dek}</p>

          <div className="post__meta">
            <span className="post__chip">{stamp(post.date)}</span>
            <span className="post__chip">{post.words.toLocaleString()} words</span>
            <span className="post__chip">{post.minutes} min</span>
            {post.tags.map((tag) => (
              <Link key={tag} to={`/blog?tag=${encodeURIComponent(tag)}`} className="post__chip post__chip--tag">
                {tag}
              </Link>
            ))}
          </div>
        </header>

        {toc.length > 2 && (
          <nav className="post__toc" aria-label="Contents">
            <b>CONTENTS</b>
            <ol>
              {toc.map((heading) => (
                <li key={heading.id} data-depth={heading.depth}>
                  <a href={`#${heading.id}`}>{heading.text}</a>
                </li>
              ))}
            </ol>
          </nav>
        )}

        <div className="post__body">
          <Markdown source={post.body} />
        </div>

        <footer className="post__foot">
          <p className="post__sign">
            弁証薬窟 · filed {stamp(post.date)} · argued first, cited afterwards
          </p>

          <div className="post__pager">
            {newer ? (
              <Link to={`/blog/${newer.slug}`} className="post__step">
                <span className="post__step-dir">← NEWER</span>
                <span className="post__step-title">{newer.title}</span>
              </Link>
            ) : (
              <span className="post__step post__step--end">← THIS IS THE LATEST</span>
            )}
            {older ? (
              <Link to={`/blog/${older.slug}`} className="post__step post__step--right">
                <span className="post__step-dir">OLDER →</span>
                <span className="post__step-title">{older.title}</span>
              </Link>
            ) : (
              <span className="post__step post__step--end post__step--right">
                THE ARCHIVE STARTS HERE →
              </span>
            )}
          </div>

          <Link to="/blog" className="blog__back">
            ← ALL TRANSMISSIONS
          </Link>
        </footer>
      </article>
    </div>
  )
}
