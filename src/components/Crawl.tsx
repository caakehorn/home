import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { OPERATOR, RATIO, ratioSentence } from '../content/ratio'
import { usePortal } from '../state/usePortal'
import './crawl.css'

/**
 * THE RATIO — a permanent crawl along the bottom of the viewport, whose speed
 * the reader drives with the scroll wheel.
 *
 * It creeps. Scroll the page in either direction and it lunges forward at a
 * rate set by how hard you scrolled, then coasts back down to a creep over
 * about a second. The feel to aim for is a flywheel: you are not steering it,
 * you are spinning it, and it always winds back down to the same idle.
 *
 * ---- why this is not a CSS animation ----------------------------------
 *
 * Every other banner on this site is two copies translated -50% by a keyframe,
 * which is the right answer when the rate is constant. It is the wrong answer
 * here: a variable rate means either restarting the animation on every scroll
 * event (which jumps, because the new animation starts from 0%) or driving
 * `animation-delay` backwards, which fights the compositor. So this owns a
 * rAF loop and writes one transform per frame — one style write, on a
 * composited property, which is cheap enough to run continuously.
 *
 * ---- why it measures itself -------------------------------------------
 *
 * The list is stated to be growing. So nothing about the geometry is written
 * down: the component measures one copy of the sequence, works out how many
 * copies it takes to cover the viewport plus one full wrap, and takes the
 * offset modulo that width. Appending to RATIO is the whole edit — there is no
 * duration to retune and no seam to chase.
 */

/** px/s at the bottom of the chaos dial. A creep, not a scroll. */
const IDLE_MIN = 12
/** px/s added at the top of the dial. */
const IDLE_RANGE = 44
/** px/s of lunge per px of page scrolled. */
const GAIN = 12
/** px/s. A hard flick should not make it unreadable. */
const CEILING = 1600
/** Fraction of the lunge surviving each 60fps frame — ~1s of coast. */
const DECAY = 0.94
/** Longest frame we integrate over; a backgrounded tab must not teleport it. */
const MAX_FRAME_MS = 64

export function Crawl() {
  const { chaos } = usePortal()
  const viewport = useRef<HTMLDivElement>(null)
  const track = useRef<HTMLDivElement>(null)
  const sequence = useRef<HTMLSpanElement>(null)
  const [copies, setCopies] = useState(2)

  // Chaos is read through a ref rather than closed over, so changing the dial
  // does not tear down and restart the loop mid-crawl.
  const idle = useRef(IDLE_MIN)
  idle.current = IDLE_MIN + IDLE_RANGE * chaos

  // Enough copies to cover the viewport plus one full sequence, so there is
  // always a whole sequence queued to the right of the wrap point.
  useLayoutEffect(() => {
    const measure = () => {
      const width = sequence.current?.offsetWidth ?? 0
      if (!width) return
      setCopies(Math.ceil((window.innerWidth + width) / width) + 1)
    }
    measure()
    window.addEventListener('resize', measure)
    // Webfonts land after first paint and change the width underneath us.
    document.fonts?.ready.then(measure).catch(() => {})
    return () => window.removeEventListener('resize', measure)
  }, [])

  useEffect(() => {
    const el = track.current
    const box = viewport.current
    if (!el || !box) return

    // Under reduced motion the crawl does not crawl. The strip stays put and
    // becomes scrollable instead (see crawl.css), so the content is still
    // reachable — the request is for less motion, not less content.
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    let offset = 0
    let lunge = 0
    let lastY = window.scrollY
    let last = performance.now()
    let frame = 0

    const onScroll = () => {
      const y = window.scrollY
      const delta = Math.abs(y - lastY)
      lastY = y
      lunge = Math.min(CEILING, lunge + delta * GAIN)
    }

    const step = (now: number) => {
      const dt = Math.min(now - last, MAX_FRAME_MS)
      last = now

      // Frame-rate independent decay, so a 120Hz display coasts for the same
      // wall-clock second as a 60Hz one rather than half of it.
      lunge *= DECAY ** (dt / (1000 / 60))
      if (lunge < 0.5) lunge = 0

      const width = sequence.current?.offsetWidth ?? 0
      if (width > 0) {
        offset = (offset + ((idle.current + lunge) * dt) / 1000) % width
        el.style.transform = `translate3d(${-offset}px, 0, 0)`
      }

      // Lets the stylesheet react to being driven without a re-render.
      box.style.setProperty('--rush', (lunge / CEILING).toFixed(3))

      frame = requestAnimationFrame(step)
    }

    // A backgrounded tab stops firing rAF; without this, `last` is stale on
    // return and the first frame back integrates the whole absence.
    const onVisible = () => {
      last = performance.now()
    }

    window.addEventListener('scroll', onScroll, { passive: true })
    document.addEventListener('visibilitychange', onVisible)
    frame = requestAnimationFrame(step)

    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('scroll', onScroll)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [])

  return (
    <aside className="crawl" ref={viewport} aria-label="The ratio">
      {/* The visual track is duplicated by construction, so AT gets the list
          once, here, and never reads the loop. */}
      <p className="crawl__a11y">{ratioSentence()}</p>

      <div className="crawl__track" ref={track} aria-hidden="true">
        {Array.from({ length: copies }, (_, copy) => (
          <span className="crawl__seq" key={copy} ref={copy === 0 ? sequence : undefined}>
            {RATIO.map((node, i) => (
              <span className="crawl__node-wrap" key={i}>
                <span className="crawl__op">{OPERATOR}</span>
                <span className={`crawl__node crawl__node--${i % 6}`}>{node}</span>
              </span>
            ))}
          </span>
        ))}
      </div>
    </aside>
  )
}
