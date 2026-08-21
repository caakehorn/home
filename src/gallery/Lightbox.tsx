import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { asset, weigh, type Picture } from './core'
import { usePortal } from '../state/usePortal'

type LightboxProps = {
  picture: Picture
  /** The pictures the arrows walk — the filtered wall, not the whole manifest. */
  neighbours: Picture[]
  onClose: () => void
}

/**
 * One picture, taken over the whole screen, with what is known about it printed
 * underneath rather than hidden behind a hover.
 *
 * It is a route rather than a piece of state: /gallery/the-gravity-well is a
 * link somebody can send. Closing it goes back to the wall, and the arrows walk
 * the filtered wall rather than the whole manifest, so a viewer who narrowed to
 * MOTION does not get silently handed a still.
 */
export function Lightbox({ picture, neighbours, onClose }: LightboxProps) {
  const navigate = useNavigate()
  const { motion } = usePortal()
  const dialog = useRef<HTMLDivElement>(null)
  const restore = useRef<Element | null>(null)

  const at = neighbours.findIndex((p) => p.id === picture.id)
  const step = (by: number) => {
    if (at < 0 || neighbours.length < 2) return
    const next = neighbours[(at + by + neighbours.length) % neighbours.length]
    navigate(`/gallery/${next.id}`, { replace: true })
  }

  useEffect(() => {
    restore.current = document.activeElement
    dialog.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      else if (e.key === 'ArrowRight') step(1)
      else if (e.key === 'ArrowLeft') step(-1)
      else return
      e.preventDefault()
    }
    window.addEventListener('keydown', onKey)
    // The wall behind must not scroll under the overlay.
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = overflow
      if (restore.current instanceof HTMLElement) restore.current.focus()
    }
    // `at` and `neighbours` are in the closure of step(); re-binding the
    // listener on them is what keeps the arrows pointing at the right picture.
  }, [at, neighbours, onClose])

  return (
    <div className="gal__lightbox" onClick={onClose}>
      <div
        ref={dialog}
        className="gal__box"
        role="dialog"
        aria-modal="true"
        aria-label={picture.title}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="gal__box-stage">
          {picture.kind === 'motion' ? (
            <video
              key={picture.id}
              className="gal__box-media"
              src={asset(picture.src)}
              poster={picture.poster ? asset(picture.poster) : undefined}
              controls
              loop
              muted
              playsInline
              autoPlay={motion}
              preload="metadata"
            />
          ) : (
            <img
              key={picture.id}
              className="gal__box-media"
              src={asset(picture.src)}
              alt={picture.caption ? `${picture.title} — ${picture.caption}` : picture.title}
              width={picture.w}
              height={picture.h}
            />
          )}

          {neighbours.length > 1 && (
            <>
              <button
                type="button"
                className="gal__step gal__step--prev"
                aria-label="Previous picture"
                onClick={() => step(-1)}
              >
                ←
              </button>
              <button
                type="button"
                className="gal__step gal__step--next"
                aria-label="Next picture"
                onClick={() => step(1)}
              >
                →
              </button>
            </>
          )}

          <button type="button" className="gal__shut" aria-label="Close" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="gal__plate">
          <h2 className="gal__plate-title">
            {picture.title}
            {picture.kana && (
              <span className="jp gal__plate-kana" aria-hidden="true">
                {picture.kana}
              </span>
            )}
          </h2>
          {picture.caption && <p className="gal__plate-say">{picture.caption}</p>}
          <dl className="gal__plate-facts">
            {picture.source && (
              <>
                <dt>OF</dt>
                <dd>{picture.source}</dd>
              </>
            )}
            {picture.shot && (
              <>
                <dt>SHOT</dt>
                <dd>{picture.shot}</dd>
              </>
            )}
            <dt>FILE</dt>
            <dd>
              {picture.kind === 'motion' ? 'WebM' : 'JPEG'} · {picture.w}×{picture.h} ·{' '}
              {weigh(picture.bytes)} ·{' '}
              <a href={asset(picture.src)} target="_blank" rel="noreferrer">
                open the original
              </a>
            </dd>
          </dl>
          {at >= 0 && neighbours.length > 1 && (
            <p className="gal__plate-count">
              {at + 1} / {neighbours.length} · ← → to walk the wall · ESC to close
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
