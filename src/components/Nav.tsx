import { Link, NavLink } from 'react-router-dom'
import { HeaderControls } from './HeaderControls'
import { Logo } from './Logo'
import { SECTIONS } from '../content/sections'
import './nav.css'

export function Nav() {
  return (
    <nav className="nav" aria-label="Portal">
      <Link to="/" className="nav__mark">
        <Logo size="var(--step-1)" inline />
        <span className="nav__mark-kana jp" aria-hidden="true">
          薬窟
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

      <HeaderControls />
    </nav>
  )
}
