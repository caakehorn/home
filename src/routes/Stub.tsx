import { Link, useParams } from 'react-router-dom'
import { Marquee } from '../components/Marquee'
import { Nav } from '../components/Nav'
import { SubHead } from '../components/Wordmark'
import { sectionBySlug } from '../content/sections'
import './stub.css'

/**
 * Every wing exists as a door before it exists as a room. Nothing dead-ends.
 */
export function Stub() {
  const { slug = '' } = useParams()
  const section = sectionBySlug(slug)

  if (!section) {
    return (
      <div className="stub">
        <Nav />
        <main className="wrap stub__inner">
          <span className="stub__code jp" aria-hidden="true">
            四〇四
          </span>
          <h1 className="stub__title">
            <SubHead>NO SUCH ROOM</SubHead>
          </h1>
          <p className="stub__note">
            You walked into a wall. The den is still mostly walls.
          </p>
          <Link to="/" className="stub__back">
            ← BACK TO THE HALLWAY
          </Link>
        </main>
      </div>
    )
  }

  return (
    <div className="stub" style={{ ['--glow' as string]: `var(--n${section.accent})` }}>
      <Nav />
      <Marquee text={section.chant} duration={20} tone={section.accent} size="clamp(0.75rem, 1.6vw, 1.1rem)" />

      <main className="wrap stub__inner">
        <span className="stub__kana jp" aria-hidden="true">
          {section.kana}
        </span>

        <h1 className="stub__title">
          <SubHead>{section.title}</SubHead>
        </h1>

        <p className="stub__blurb">{section.blurb}</p>

        <div className="stub__plate">
          <span className="stub__plate-status firetext firetext--vibe">
            {section.status === 'WIRING' ? 'CURRENTLY WIRING' : 'STILL DARK'}
          </span>
          <p className="stub__plate-note">
            The shell is up, the aesthetic is locked, the wiring is next. This door will open.
            Nobody has ever finished a room in this building on the first attempt.
          </p>
        </div>

        <Link to="/" className="stub__back">
          ← BACK TO THE HALLWAY
        </Link>
      </main>
    </div>
  )
}
