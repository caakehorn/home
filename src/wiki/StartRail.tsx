import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import type { WikiIndex } from './data'
import { randomPage, readingTime, routes } from './entry'
import { lastRead } from './trail'
import './console.css'

/* ==========================================================================
   THE READING DESK — a strip across the top of the index.

   /brain opens on a force-directed map of 487 unlabelled dots. It is the best
   thing on the site and it is a terrible first screen: it answers "how does
   this connect" for somebody who has already read enough to have the question,
   and it answers nothing at all for somebody who has not.

   This sits above it and answers the other question. It is the front page's
   console with the search box taken out — the search box is six inches below
   in the deck bar, and two of them on one screen is one too many.
   ========================================================================== */

export function StartRail({ index }: { index: WikiIndex }) {
  const navigate = useNavigate()
  const paths = useMemo(() => routes(index), [index])
  // localStorage, read once: only the page route writes it, and that is a full
  // navigation away from here.
  const [resume] = useState(() => lastRead())
  const [open, setOpen] = useState(false)

  if (paths.length === 0) return null

  return (
    <section className={`rail${open ? ' rail--open' : ''}`} aria-label="Ways in">
      <div className="rail__bar">
        <h2 className="rail__title">
          START READING <span className="jp" aria-hidden="true">読始</span>
        </h2>

        {resume && (
          <Link to={`/brain/${resume.slug}`} className="rail__resume">
            <span className="jp" aria-hidden="true">続</span>
            PICK IT BACK UP · <i>{resume.title}</i>
          </Link>
        )}

        <button
          type="button"
          className="rail__die"
          onClick={() => {
            const page = randomPage(index)
            if (page) navigate(`/brain/${page.slug}`)
          }}
        >
          <span className="jp" aria-hidden="true">乱</span>
          THROW ME SOMEWHERE
        </button>

        <button
          type="button"
          className="rail__toggle"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
        >
          {open ? 'HIDE THE ROUTES' : `${paths.length} ROUTES IN`}
          <span className="rail__caret" aria-hidden="true" />
        </button>
      </div>

      {open && (
        <ol className="rail__routes">
          {paths.map((route) => (
            <li
              key={route.id}
              className="rail__route"
              style={{ ['--glow' as string]: `var(--n${route.tone})` }}
            >
              <h3 className="rail__route-label">
                {route.label} <span className="jp" aria-hidden="true">{route.kana}</span>
              </h3>
              <p className="rail__route-note">{route.note}</p>
              <ol className="rail__stops">
                {route.stops.map((stop, i) => (
                  <li key={stop.slug}>
                    <Link to={`/brain/${stop.slug}`} className="rail__stop">
                      <b>{String(i + 1).padStart(2, '0')}</b>
                      {stop.title}
                      <em>{readingTime(stop.words)}</em>
                    </Link>
                  </li>
                ))}
              </ol>
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}
