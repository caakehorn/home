import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { OPERATOR, sentenceOf } from '../content/crawls'
import { usePortal } from '../state/usePortal'
import './crawl.css'

/**
 * A crawl pinned to one edge of the viewport, whose speed the reader drives
 * with the scroll wheel.
 *
 * It creeps. Scroll the page in either direction and it lunges forward at a
 * rate set by how hard you scrolled, then coasts back down to a creep over
 * about a second. The feel to aim for is a flywheel: you are not steering it,
 * you are spinning it, and it always winds back down to the same idle.
 *
 * Two of them run — THE RATIO along the top travelling left, JET FUEL along
 * the bottom travelling right. They are the same component and the same
 * physics; only the edge, the direction and the list differ, so the pair
 * respond to a scroll identically and in mirror. The two directions are
 * opposed on purpose: a pair travelling the same way reads as one long strip
 * that happens to be broken in the middle.
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
 * The lists are stated to be growing. So nothing about the geometry is written
 * down: the component measures one copy of the sequence, works out how many
 * copies it takes to cover the viewport plus one full wrap, and takes the
 * offset modulo that width. Appending to a list is the whole edit — there is
 * no duration to retune and no seam to chase.
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

type CrawlProps = {
  nodes: readonly string[]
  /** Accessible name for the region. */
  label: string
  edge: 'top' | 'bottom'
  /** Which way the words travel. */
  travel: 'left' | 'right'
}

export function Crawl({ nodes, label, edge, travel }: CrawlProps) {
  const { chaos, motion } = usePortal()
  const viewport = useRef<HTMLDivElement>(null)
  const track = useRef<HTMLDivElement>(null)
  const sequence = useRef<HTMLSpanElement>(null)
  const [copies, setCopies] = useState(2)

  // Read through refs rather than closed over, so changing the dial (or, in
  // principle, the direction) does not tear down and restart the loop.
  const idle = useRef(IDLE_MIN)
  idle.current = IDLE_MIN + IDLE_RANGE * chaos
  const rightward = useRef(false)
  rightward.current = travel === 'right'

  // Enough copies to cover the viewport plus one full sequence, so there is
  // always a whole sequence queued on the side the track is travelling from.
  useLayoutEffect(() => {
    const measure = () => {
      const width = sequence.current?.offsetWidth ?? 0
      if (!width) return
      setCopies((current) => {
        const needed = Math.ceil((window.innerWidth + width) / width) + 1
        return needed === current ? current : needed
      })
    }
    measure()
    window.addEventListener('resize', measure)
    // Webfonts land after first paint and change the width underneath us.
    document.fonts?.ready.then(measure).catch(() => {})
    return () => window.removeEventListener('resize', measure)
  }, [nodes])

  useEffect(() => {
    const el = track.current
    const box = viewport.current
    if (!el || !box) return

    // Held still, the crawl does not crawl. The strip stays put and becomes
    // scrollable instead (see crawl.css), so the content is still reachable —
    // the request is for less motion, not less content.
    //
    // Read from the portal rather than from matchMedia directly: the OS
    // preference only seeds this, and the header's MOTION switch overrides it.
    // `motion` is in the dep list, so flipping the switch starts and stops the
    // loop rather than needing a reload.
    if (!motion) {
      // Drop the last transform, or the track freezes wherever it happened to
      // be — mid-word, with the first node scrolled off the left edge.
      el.style.transform = ''
      return
    }

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
        // Travelling left runs 0 -> -width, so the copies queue to the right.
        // Travelling right runs -width -> 0, so they queue to the left, which
        // is why the copy count covers the viewport PLUS one whole sequence
        // rather than just the viewport.
        const x = rightward.current ? offset - width : -offset
        el.style.transform = `translate3d(${x}px, 0, 0)`
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
  }, [motion])

  return (
    <aside className={`crawl crawl--${edge}`} ref={viewport} aria-label={label}>
      {/* The visual track is duplicated by construction, so AT gets the list
          once, here, and never reads the loop. */}
      <p className="crawl__a11y">{sentenceOf(nodes)}</p>

      <div className="crawl__track" ref={track} aria-hidden="true">
        {Array.from({ length: copies }, (_, copy) => (
          <span className="crawl__seq" key={copy} ref={copy === 0 ? sequence : undefined}>
            {nodes.map((node, i) => (
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
