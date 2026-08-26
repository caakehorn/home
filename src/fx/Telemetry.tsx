import { useEffect } from 'react'
import { usePortal } from '../state/usePortal'

/* ==========================================================================
   TELEMETRY — where the pointer is, how fast it is going, where the page is

   Six numbers, published as custom properties on <html>, written at most once
   a frame. Nothing in here draws anything. It exists so that the answer to
   "how does this element react to the pointer" can be a line of CSS in the
   component's own stylesheet instead of another listener and another
   requestAnimationFrame loop in another file.

     --px  --py    pointer, 0 → 1 across the viewport
     --pdx --pdy   the same thing signed from the centre, -1 → 1
     --pvel        pointer speed, 0 → 1, saturating around a hard flick
     --sv          scroll velocity, signed, -1 → 1
     --sva         the same, unsigned, for anything that does not care which
                   way you are going (shear, blur, speed-up)
     --sp          scroll progress through the document, 0 → 1

   ---- why this is one module and not a hook per component -----------------

   The cutouts parallax, the haze follows the pointer, the marquees speed up
   when you scroll, the plates shear, the grid leans. That is five components
   wanting the same two numbers. Five copies of a pointermove listener is five
   times the listener work and — worse — five independent rAF loops that wake
   the compositor at five different moments in the frame.

   One writer, many readers. The readers are stylesheets and cost nothing.

   ---- the two things that stop it being expensive --------------------------

   NOTHING IS WRITTEN UNLESS IT CHANGED by more than a thousandth. Setting a
   custom property on the root element invalidates style for every rule that
   reads it, so writing --px sixty times a second with the same value is sixty
   style recalculations of the whole document for no reason.

   THE LOOP SLEEPS. There is no `requestAnimationFrame` running while the
   pointer is parked and the page is still. The loop is started by an event and
   returns without rescheduling itself once the velocities have decayed to
   nothing.
   ========================================================================== */

/** px/frame at which --pvel reads 1. Roughly a fast flick on a 1440 display. */
const FLICK = 40
/** px/frame of scroll at which --sv reads 1. Roughly a trackpad shove. */
const SHOVE = 55

export function Telemetry() {
  const { motion } = usePortal()

  useEffect(() => {
    const root = document.documentElement

    // STILL means the page does not respond to how fast you are moving. The
    // static half — where the pointer is — is not motion and stays on, because
    // parallax that tracks the pointer is a response, not an animation.
    const style = root.style
    const written: Record<string, number> = {}

    const put = (name: string, value: number, precision = 3) => {
      const rounded = Number(value.toFixed(precision))
      if (written[name] === rounded) return
      written[name] = rounded
      style.setProperty(name, String(rounded))
    }

    let px = 0.5
    let py = 0.5
    let lastX = -1
    let lastY = -1
    let pvel = 0

    let lastScroll = window.scrollY
    let sv = 0

    let raf = 0
    let idle = 0

    const frame = () => {
      raf = 0

      put('--px', px)
      put('--py', py)
      put('--pdx', px * 2 - 1)
      put('--pdy', py * 2 - 1)
      put('--pvel', motion ? pvel : 0)
      put('--sv', motion ? sv : 0)
      put('--sva', motion ? Math.abs(sv) : 0)

      const doc = document.documentElement
      const span = doc.scrollHeight - window.innerHeight
      put('--sp', span > 0 ? Math.min(1, Math.max(0, window.scrollY / span)) : 0)

      // Decay. Both velocities fall off on their own so a hand that stops and
      // a page that stops both settle without needing an event to say so.
      pvel *= 0.86
      sv *= 0.82
      if (pvel < 0.002) pvel = 0
      if (Math.abs(sv) < 0.002) sv = 0

      // Two quiet frames and the loop goes back to sleep. One is not enough:
      // the frame that zeroes the velocities still has to be painted.
      if (pvel === 0 && sv === 0) {
        idle += 1
        if (idle > 1) return
      } else {
        idle = 0
      }

      raf = requestAnimationFrame(frame)
    }

    const wake = () => {
      idle = 0
      if (raf === 0) raf = requestAnimationFrame(frame)
    }

    /** The element the pointer is currently inside, if it asked to know. */
    let held: HTMLElement | null = null

    const onMove = (event: PointerEvent) => {
      const w = window.innerWidth || 1
      const h = window.innerHeight || 1
      px = event.clientX / w
      py = event.clientY / h

      if (lastX >= 0) {
        const d = Math.hypot(event.clientX - lastX, event.clientY - lastY)
        pvel = Math.min(1, Math.max(pvel * 0.5, d / FLICK))
      }
      lastX = event.clientX
      lastY = event.clientY

      // ---- the magnet ---------------------------------------------------
      // Any element carrying `data-magnet` gets the pointer's position inside
      // its own box, signed from its centre, as --mx / --my. One delegated
      // lookup rather than a listener per card: `closest` is a walk up an
      // ancestor chain that is a dozen nodes deep on this site, and it happens
      // on a move we are already handling.
      const target = event.target as Element | null
      const magnet =
        target && typeof target.closest === 'function'
          ? (target.closest('[data-magnet]') as HTMLElement | null)
          : null

      if (magnet !== held) {
        if (held) {
          held.style.removeProperty('--mx')
          held.style.removeProperty('--my')
        }
        held = magnet
      }

      if (magnet) {
        const box = magnet.getBoundingClientRect()
        if (box.width > 0 && box.height > 0) {
          magnet.style.setProperty(
            '--mx',
            ((event.clientX - box.left) / box.width - 0.5).toFixed(3),
          )
          magnet.style.setProperty(
            '--my',
            ((event.clientY - box.top) / box.height - 0.5).toFixed(3),
          )
        }
      }

      wake()
    }

    const onScroll = () => {
      const y = window.scrollY
      const d = y - lastScroll
      lastScroll = y
      sv = Math.max(-1, Math.min(1, d / SHOVE))
      wake()
    }

    window.addEventListener('pointermove', onMove, { passive: true })
    window.addEventListener('scroll', onScroll, { passive: true })
    wake()

    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('scroll', onScroll)
      if (raf !== 0) cancelAnimationFrame(raf)
      if (held) {
        held.style.removeProperty('--mx')
        held.style.removeProperty('--my')
      }
    }
  }, [motion])

  return null
}
