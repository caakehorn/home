import { useRef } from 'react'
import { Link } from 'react-router-dom'
import { asset, weigh, type Picture } from './core'
import { usePortal } from '../state/usePortal'

/**
 * The wall: one card per picture, laid out from the picture's own proportions.
 *
 * Every card knows how tall it will be before its media arrives — `--ar` is the
 * intrinsic ratio out of the manifest — so a wall of forty settles once instead
 * of jolting forty times as the files land. The ratio is clamped: a phone
 * screenshot is 0.46 and left alone it would make one card four times the
 * height of its neighbours and shove the rest of the row off the screen.
 */
export function Wall({ pictures }: { pictures: Picture[] }) {
  if (!pictures.length) {
    return <p className="gal__empty">Nothing on this wall. Try another filter.</p>
  }
  return (
    <ol className="gal__wall">
      {pictures.map((picture) => (
        <li key={picture.id}>
          <Card picture={picture} />
        </li>
      ))}
    </ol>
  )
}

const RATIO = (w: number, h: number) => Math.min(2.1, Math.max(0.62, w / h))

function Card({ picture }: { picture: Picture }) {
  const { motion } = usePortal()
  const video = useRef<HTMLVideoElement>(null)

  /**
   * A motion card previews on hover and stops when the pointer leaves, which is
   * the only reason it is worth `preload="none"`: nothing on this wall costs a
   * megabyte until somebody looks straight at it. With the MOTION switch off it
   * never plays — the poster is the card, and the lightbox still has controls.
   */
  const preview = (play: boolean) => {
    const el = video.current
    if (!el || !motion) return
    if (play) void el.play().catch(() => {})
    else {
      el.pause()
      el.currentTime = 0
    }
  }

  return (
    <Link
      to={`/gallery/${picture.id}`}
      className={`gal__card gal__card--${picture.kind}`}
      style={{ ['--ar' as string]: RATIO(picture.w, picture.h) }}
      onMouseEnter={() => preview(true)}
      onMouseLeave={() => preview(false)}
      onFocus={() => preview(true)}
      onBlur={() => preview(false)}
    >
      <span className="gal__frame">
        {picture.kind === 'motion' ? (
          <video
            ref={video}
            className="gal__media"
            src={asset(picture.src)}
            poster={picture.poster ? asset(picture.poster) : undefined}
            width={picture.w}
            height={picture.h}
            preload="none"
            muted
            loop
            playsInline
            tabIndex={-1}
            aria-hidden="true"
          />
        ) : (
          <img
            className="gal__media"
            src={asset(picture.src)}
            alt={picture.caption ? `${picture.title} — ${picture.caption}` : picture.title}
            width={picture.w}
            height={picture.h}
            loading="lazy"
            decoding="async"
          />
        )}
        {picture.kind === 'motion' && (
          <span className="gal__play" aria-hidden="true">
            ▶
          </span>
        )}
      </span>

      <span className="gal__card-bar">
        <span className="gal__card-title">
          {picture.title}
          {picture.kana && (
            <span className="jp gal__card-kana" aria-hidden="true">
              {picture.kana}
            </span>
          )}
        </span>
        <span className="gal__card-meta">
          {picture.kind === 'motion' ? 'MOTION' : 'STILL'} · {picture.w}×{picture.h} ·{' '}
          {weigh(picture.bytes)}
        </span>
      </span>
    </Link>
  )
}
