import { Link } from 'react-router-dom'
import { Nav } from '../components/Nav'
import { SubHead } from '../components/Wordmark'
import {
  STANDARD_EFFECTIVE,
  STANDARD_SECTIONS,
  STANDARD_TITLE,
  STANDARD_VERSION,
  STANDING_NOTICES,
} from '../content/standard'
import './standard.css'

/**
 * THE RECORD STANDARD, rendered in the open.
 *
 * Behind the gate rather than in front of it — unlike the terms, this is not a
 * document you have to agree to before you can read the site. But it is linked
 * from the door and from every wing, because the people it protects are the
 * people most likely to arrive at a page without going looking for the rules.
 */
export function StandardRoute() {
  return (
    <div className="standard">
      <Nav />
      <main className="wrap standard__inner">
        <h1 className="standard__title">
          <SubHead>{STANDARD_TITLE}</SubHead>
        </h1>
        <p className="standard__meta">
          Version {STANDARD_VERSION} · Effective {STANDARD_EFFECTIVE} · Amended in the open
        </p>

        {STANDARD_SECTIONS.map(([heading, ...paragraphs]) => (
          <section key={heading} className="standard__section">
            <h2>{heading}</h2>
            {paragraphs.map((text, i) => (
              <p key={i}>{text}</p>
            ))}
          </section>
        ))}

        <section className="standard__section standard__log">
          <h2>STANDING NOTICES</h2>
          <p className="standard__log-note">
            Section 6 requires that a stop be visible. Entries are append-only — a suspension that
            lifts gets a second line, never the deletion of the first.
          </p>
          {STANDING_NOTICES.map((notice) => (
            <article key={notice.date + notice.title} className="standard__notice">
              <h3>
                <time dateTime={notice.date}>{notice.date}</time> · {notice.title}
              </h3>
              <p>{notice.body}</p>
            </article>
          ))}
        </section>

        <Link to="/" className="standard__back">
          ← BACK TO THE HALLWAY
        </Link>
      </main>
    </div>
  )
}
