import { useCallback, useEffect, useId, useState } from 'react'
import { Link } from 'react-router-dom'
import type { Relic as RelicData } from '../content/relics'
import { RelicPlate } from './RelicArt'
import { findRelic, useRelics } from '../state/relics'
import './relic.css'

/* ==========================================================================
   A RELIC — a sticker slapped somewhere it does not belong, which opens.

   The tag is a real button with a real hover state, so it is discoverable by
   pointer, by keyboard and by screen reader without being a pixel-hunt. The
   panel it opens is the payload: the line, the date it was sent, what it
   means, and a door into the room where the long version lives.

   A relic is marked found on first open and stays found — the tag keeps its
   place on the page afterwards, stamped, because taking it away would edit
   the composition every time somebody clicked something.
   ========================================================================== */

type Props = {
  relic: RelicData
  /** Where on its host the tag sits. Free-form so the page owns the layout. */
  style?: React.CSSProperties
  className?: string
}

export function Relic({ relic, style, className = '' }: Props) {
  const [open, setOpen] = useState(false)
  const { has } = useRelics()
  const found = has(relic.id)
  const panelId = useId()

  const show = useCallback(() => {
    setOpen(true)
    findRelic(relic.id)
  }, [relic.id])

  // Escape closes it, and nothing else on the page is listening for Escape —
  // the splash listens for Enter and Space, which is why the panel swallows
  // those below rather than letting them push you through the door.
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
        className={`relic${found ? ' relic--found' : ''} ${className}`}
        style={{ ['--glow' as string]: `var(--n${relic.tone})`, ...style }}
        onClick={show}
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        title={found ? relic.title : 'Something is stuck to this'}
      >
        <span className="relic__kana jp" aria-hidden="true">
          {relic.kana}
        </span>
        <span className="relic__face">{relic.face}</span>
        <span className="relic__sr">
          {found ? `Relic found: ${relic.title}` : 'Hidden reference — open it'}
        </span>
      </button>

      {open && (
        <div
          className="relic-panel"
          id={panelId}
          role="dialog"
          aria-modal="true"
          aria-label={relic.title}
          style={{ ['--glow' as string]: `var(--n${relic.tone})` }}
          // The splash pushes you through the door on Enter or Space. A panel
          // open over it must not, so the key never reaches that listener.
          onKeyDown={(event) => event.stopPropagation()}
        >
          <button
            type="button"
            className="relic-panel__scrim"
            aria-label="Close"
            onClick={() => setOpen(false)}
          />

          <div className="relic-panel__card">
            <span className="relic-panel__eyebrow">
              <span className="jp" aria-hidden="true">
                {relic.kana}
              </span>
              RELIC · {relic.stamp}
            </span>

            <div className="relic-panel__body">
              <RelicPlate id={relic.id} art={relic.art} title={relic.title} />

              <div className="relic-panel__text">
                <h2 className="relic-panel__title">{relic.title}</h2>
                <blockquote className="relic-panel__quote">{relic.quote}</blockquote>
                <p className="relic-panel__note">{relic.note}</p>
                <Link to={relic.href} className="relic-panel__go" onClick={() => setOpen(false)}>
                  {relic.hrefLabel} →
                </Link>
              </div>
            </div>

            <button type="button" className="relic-panel__close" onClick={() => setOpen(false)}>
              CLOSE <span className="jp" aria-hidden="true">閉</span>
            </button>
          </div>
        </div>
      )}
    </>
  )
}
