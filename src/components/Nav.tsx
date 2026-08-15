import { Link, NavLink } from 'react-router-dom'
import { SECTIONS } from '../content/sections'
import { VIBES } from '../state/portal-context'
import { usePortal } from '../state/usePortal'
import './nav.css'

export function Nav() {
  const { vibe, setVibe } = usePortal()
  const index = VIBES.findIndex((v) => v.id === vibe)

  return (
    <nav className="nav" aria-label="Portal">
      <Link to="/" className="nav__mark">
        <span className="nav__mark-face">DAN FRANK</span>
        <span className="nav__mark-kana jp" aria-hidden="true">
          月光宿
        </span>
      </Link>

      <ul className="nav__links">
        {SECTIONS.map((section) => (
          <li key={section.slug}>
            <NavLink
              to={`/${section.slug}`}
              className={({ isActive }) => `nav__link${isActive ? ' nav__link--on' : ''}`}
              style={{ ['--glow' as string]: `var(--n${section.accent})` }}
            >
              <span className="jp" aria-hidden="true">
                {section.kana}
              </span>
              {section.title}
            </NavLink>
          </li>
        ))}
      </ul>

      <button
        type="button"
        className="nav__cycle"
        onClick={() => setVibe(VIBES[(index + 1) % VIBES.length].id)}
        aria-label={`Palette: ${VIBES[index]?.name}. Next palette.`}
      >
        <span className="nav__cycle-chips" aria-hidden="true">
          {VIBES[index]?.swatch.map((hex) => (
            <span key={hex} style={{ background: hex }} />
          ))}
        </span>
        NEXT VIBE
      </button>
    </nav>
  )
}
