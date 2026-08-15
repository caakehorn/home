import type { CSSProperties } from 'react'
import './logo.css'

/**
 * The wordmark: DAN / FRANK in heavy rounded caps, gold, over stacked red and
 * indigo offset layers.
 *
 * Reproduced in CSS rather than shipped as the source PNG so it stays crisp
 * from a 14px nav chip to a 6rem masthead and weighs nothing.
 *
 * The mark is deliberately opaque. An earlier pass used the additive RGB venn,
 * which needs a black ground to blend against and therefore dragged a plate
 * around with it that fought the page's own glows. This one composites with
 * nothing — it sits on whatever the site is already showing, unchanged.
 *
 * The colours are a brand constant and do NOT follow the palette. Everything
 * else on the site repaints with the vibe; the logo is the one thing that must
 * not, or it stops being an identity.
 */
export function Logo({
  size = 'var(--step-2)',
  className = '',
  style,
  inline = false,
}: {
  size?: string
  className?: string
  style?: CSSProperties
  /** One line instead of two — for the nav, where stacked would be cramped. */
  inline?: boolean
}) {
  return (
    <span
      className={`logo${inline ? ' logo--inline' : ''} ${className}`}
      style={{ fontSize: size, ...style }}
      role="img"
      aria-label="DAN FRANK"
    >
      <span className="logo__line" aria-hidden="true">
        DAN
      </span>
      <span className="logo__line" aria-hidden="true">
        FRANK
      </span>
    </span>
  )
}
