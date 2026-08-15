import { Link } from 'react-router-dom'
import { Nav } from '../components/Nav'
import { SubHead } from '../components/Wordmark'
import { TERMS_EFFECTIVE, TERMS_SECTIONS, TERMS_TITLE, TERMS_VERSION } from '../gate/terms'
import './terms.css'

/**
 * The one route in front of the gate rather than behind it.
 *
 * Terms you cannot read before agreeing to them are not terms, so the same
 * document the acceptance dialog serves is readable in the open, from the same
 * source — there is no second copy to drift.
 */
export function TermsRoute() {
  return (
    <div className="terms">
      <Nav />
      <main className="wrap terms__inner">
        <h1 className="terms__title">
          <SubHead>{TERMS_TITLE}</SubHead>
        </h1>
        <p className="terms__meta">
          Version {TERMS_VERSION} · Effective {TERMS_EFFECTIVE}
        </p>

        {TERMS_SECTIONS.map(([heading, ...paragraphs]) => (
          <section key={heading} className="terms__section">
            <h2>{heading}</h2>
            {paragraphs.map((text, i) => (
              <p key={i}>{text}</p>
            ))}
          </section>
        ))}

        <Link to="/" className="terms__back">
          ← BACK TO THE DOOR
        </Link>
      </main>
    </div>
  )
}
