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
      {/* The wordmark is the way home, which is what a wordmark in the corner
          of a header has meant since there were headers. It used to be the
          collapse toggle instead, so the one thing on the page everybody
          already knows how to use did something nobody expected. */}
      <Link to="/" className="nav__mark">
        <Logo size="var(--nav-mark-size)" inline />
        <span className="nav__mark-kana jp" aria-hidden="true">
          薬窟
        </span>
      </Link>

      <ul className="nav__links" aria-hidden={headerCollapsed}>
        {SECTIONS.map((section) => (
          <li key={section.slug}>
            <NavLink
              to={`/${section.slug}`}
              /* The brain is not one of eight peers in this bar. It is what the
                 other seven are instruments for, and it was previously the
                 first of eight identical chips — which is the same as being
                 unmarked. */
              className={({ isActive }) =>
                `nav__link${section.slug === 'brain' ? ' nav__link--primary' : ''}${
                  isActive ? ' nav__link--on' : ''
                }`
              }
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

      {/* Collapse now has a control of its own, at the far right of the bar.
          It is the one thing that survives the collapse — everything else in
          here is hidden by then, so this is also the re-open affordance. */}
      <button
        type="button"
        className="nav__collapse"
        onClick={toggleHeaderCollapsed}
        aria-expanded={!headerCollapsed}
        aria-label={headerCollapsed ? 'Expand the header' : 'Collapse the header'}
        title={headerCollapsed ? 'Expand the header' : 'Collapse the header'}
      >
        <span className="nav__collapse-kana jp" aria-hidden="true">
          {headerCollapsed ? '開' : '閉'}
        </span>
        <span className="nav__collapse-caret" aria-hidden="true" />
      </button>
    </nav>
  )
}
