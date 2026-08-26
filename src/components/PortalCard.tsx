import { Link } from 'react-router-dom'
import type { Section } from '../content/sections'
import { Marquee } from './Marquee'
import './portal-card.css'

export function PortalCard({ section, index }: { section: Section; index: number }) {
  return (
    <Link
      to={`/${section.slug}`}
      className="portal"
      style={{
        ['--glow' as string]: `var(--n${section.accent})`,
        ['--lean' as string]: index % 2 ? 0.8 : -0.8,
      }}
    >
      <span className="portal__num" aria-hidden="true">
        {String(index + 1).padStart(2, '0')}
      </span>

      <span className="portal__kana jp" aria-hidden="true">
        {section.kana}
      </span>

      <h3 className="portal__title firetext firetext--vibe">{section.title}</h3>

      <p className="portal__blurb">{section.blurb}</p>

      <span className={`portal__status portal__status--${section.status.toLowerCase()}`}>
        {section.status === 'LIVE' ? '● OPEN' : section.status === 'WIRING' ? '◐ WIRING' : '○ DARK'}
      </span>

      <span className="portal__chant" aria-hidden="true">
        <Marquee text={section.chant} duration={18} size="0.7rem" tone={section.accent} />
      </span>
    </Link>
  )
}
