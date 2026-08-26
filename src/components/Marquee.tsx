import './marquee.css'

type MarqueeProps = {
  text: string
  /** seconds for one full pass at chaos 0 */
  duration?: number
  reverse?: boolean
  tone?: 1 | 2 | 3 | 4 | 5
  size?: string
  lean?: number
}

/**
 * Two identical runs side by side, translated -50%: seamless loop with no
 * measuring. The text is duplicated in the DOM, so it is hidden from AT.
 *
 * `lean` is published as a custom property rather than written straight into
 * `transform`, because the jolt layer skews every marquee by the page's scroll
 * velocity and an inline `transform` would win over that rule outright. A band
 * that leans is a static decision; a band that leans AND drags when you scroll
 * is the page having weight.
 */
export function Marquee({
  text,
  duration = 26,
  reverse = false,
  tone = 2,
  size = 'var(--step-1)',
  lean = 0,
}: MarqueeProps) {
  // trailing separator keeps the loop seam from reading as one long word
  const run = `${text.replace(/\s*·\s*$/, '')} · `.repeat(4)
  return (
    <div
      className={`marquee${reverse ? ' marquee--rev' : ''}`}
      aria-hidden="true"
      style={{
        ['--glow' as string]: `var(--n${tone})`,
        ['--marquee-dur' as string]: `${duration}s`,
        ['--lean' as string]: lean,
        fontSize: size,
      }}
    >
      <div className="marquee__track">
        <span className="marquee__run">{run}</span>
        <span className="marquee__run">{run}</span>
      </div>
    </div>
  )
}
