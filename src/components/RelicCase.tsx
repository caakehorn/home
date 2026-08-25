import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { FULL_SET, RELICS } from '../content/relics'
import { resetRelics, useRelics } from '../state/relics'
import './relic-case.css'

/* ==========================================================================
   THE CASE — the counter, and the shelf behind it.

   Mounted once above the routes, so the count follows you off the two pages
   the relics are actually on. That is the point of it: without a counter you
   have no way of knowing there were ten, and "there are ten of these" is the
   thing that turns a decoration into a hunt.

   The shelf names the page each missing relic is on and nothing else. Telling
   you the room is the difference between a hunt and a grind; telling you the
   corner would be telling you the joke.
   ========================================================================== */

const WHERE: Record<string, string> = {
  splash: 'the front door',
  home: 'the main floor',
}

export function RelicCase() {
  const { count, total, complete, has } = useRelics()
  const [open, setOpen] = useState(false)
  // The counter flashes when it moves. Keyed off the count rather than off the
  // click, so it fires wherever the relic was found from.
  const [bumped, setBumped] = useState(false)

  useEffect(() => {
    if (count === 0) return
    setBumped(true)
    const timer = window.setTimeout(() => setBumped(false), 900)
    return () => window.clearTimeout(timer)
  }, [count])

  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation()
        setOpen(false)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  return (
    <>
      <button
        type="button"
        className={`rcase__tab${bumped ? ' rcase__tab--bump' : ''}${complete ? ' rcase__tab--full' : ''}`}
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        title="Relics — hidden references, scattered through the front door and the main floor"
      >
        <span className="jp" aria-hidden="true">
          発見
        </span>
        <b>
          {count}/{total}
        </b>
        <span className="rcase__tab-word">RELICS</span>
      </button>

      {open && (
        <div
          className="rcase"
          role="dialog"
          aria-modal="true"
          aria-label="Relics found"
          onKeyDown={(event) => event.stopPropagation()}
        >
          <button
            type="button"
            className="rcase__scrim"
            aria-label="Close"
            onClick={() => setOpen(false)}
          />

          <div className="rcase__card">
            <header className="rcase__head">
              <h2 className="rcase__title">
                RELICS <span className="jp" aria-hidden="true">遺物</span>
              </h2>
              <p className="rcase__lede">
                Ten references to one person, stuck to the front door and the main floor. They are
                objects on the page, not pixels in a corner — if a thing has a hover state and no
                obvious job, it is one of these.
              </p>
              <span className="rcase__score" aria-live="polite">
                {count} of {total}
              </span>
            </header>

            <ul className="rcase__grid">
              {RELICS.map((relic) => {
                const got = has(relic.id)
                return (
                  <li
                    key={relic.id}
                    className={`rcase__slot${got ? ' rcase__slot--got' : ''}`}
                    style={{ ['--glow' as string]: `var(--n${relic.tone})` }}
                  >
                    {got ? (
                      <>
                        <span className="rcase__slot-kana jp" aria-hidden="true">
                          {relic.kana}
                        </span>
                        <b className="rcase__slot-title">{relic.title}</b>
                        <span className="rcase__slot-stamp">{relic.stamp}</span>
                        <Link
                          to={relic.href}
                          className="rcase__slot-go"
                          onClick={() => setOpen(false)}
                        >
                          {relic.hrefLabel} →
                        </Link>
                      </>
                    ) : (
                      <>
                        <span className="rcase__slot-kana jp" aria-hidden="true">
                          ？
                        </span>
                        <b className="rcase__slot-title rcase__slot-title--dark">NOT FOUND</b>
                        <span className="rcase__slot-stamp">on {WHERE[relic.where]}</span>
                      </>
                    )}
                  </li>
                )
              })}
            </ul>

            {complete && (
              <section className="rcase__full">
                <h3 className="rcase__full-title">
                  {FULL_SET.title} <span className="jp" aria-hidden="true">{FULL_SET.kana}</span>
                </h3>
                {FULL_SET.body.map((line) => (
                  <p key={line} className="rcase__full-line">
                    {line}
                  </p>
                ))}
                <Link to={FULL_SET.href} className="rcase__full-go" onClick={() => setOpen(false)}>
                  {FULL_SET.hrefLabel} →
                </Link>
              </section>
            )}

            <footer className="rcase__foot">
              {count > 0 && (
                <button type="button" className="rcase__reset" onClick={resetRelics}>
                  FORGET THEM
                </button>
              )}
              <button type="button" className="rcase__close" onClick={() => setOpen(false)}>
                CLOSE <span className="jp" aria-hidden="true">閉</span>
              </button>
            </footer>
          </div>
        </div>
      )}
    </>
  )
}
