import { Link, NavLink } from 'react-router-dom'
import { HeaderControls } from './HeaderControls'
import { Logo } from './Logo'
import { SECTIONS } from '../content/sections'
import { usePortal } from '../state/usePortal'
import './nav.css'

export function Nav() {
  const { headerCollapsed, toggleHeaderCollapsed } = usePortal()

  return (
    <nav className={`nav${headerCollapsed ? ' nav--collapsed' : ''}`} aria-label="Portal">
      <button
        type="button"
        className="nav__mark"
        onClick={toggleHeaderCollapsed}
        aria-expanded={!headerCollapsed}
        aria-label={headerCollapsed ? 'Expand header' : 'Collapse header'}
        title={headerCollapsed ? 'Expand header' : 'Collapse header'}
      >
        <Logo size="var(--step-1)" inline />
        <span className="nav__mark-kana jp" aria-hidden="true">
          薬窟
        </span>
      </button>

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
              {section.short ?? section.title}
            </NavLink>
          </li>
        ))}
      </ul>

      <HeaderControls />
    </nav>
  )
}
