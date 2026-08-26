import { useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { usePortal } from '../state/usePortal'
import './arrival.css'

/* ==========================================================================
   ARRIVAL — the other half of the door

   Clicking an internal link fires a `door` bang: the strobe, the fringe, the
   iris shutting out of the point you clicked. That is the leaving half, and on
   its own it is a slam with nothing on the other side of it.

   This is what the room does when it turns up. The iris opens again — out of
   the same corner of the screen, because the pointer has not moved since — and
   the new page's first paint arrives inside a two-frame misregistration that
   settles. Four hundred milliseconds, once per navigation.

   ---- what it deliberately does not do -------------------------------------

   It does not hold the new route back. There is no exit animation on the old
   page and nothing waits for this to finish before rendering — the route is
   already mounted and painting underneath while this plays over the top of it.
   A transition that gates the content on its own animation is a transition
   that has made the site slower to use in exchange for looking faster, and
   this building already code-splits every room specifically so that the
   navigation is not something you sit through.
   ========================================================================== */

export function Arrival() {
  const { pathname } = useLocation()
  const { motion, entered } = usePortal()
  const first = useRef(true)
  const [seq, setSeq] = useState(0)

  useEffect(() => {
    // The very first render of the session is not an arrival, it is a load,
    // and it already has the splash or the gate in front of it.
    if (first.current) {
      first.current = false
      return
    }
    setSeq((n) => n + 1)
  }, [pathname])

  // Nothing to open into: the door has not been used yet this session.
  if (!entered || seq === 0) return null

  return (
    <div
      key={seq}
      className={`arrival${motion ? '' : ' arrival--calm'}`}
      aria-hidden="true"
      style={{ ['--glow' as string]: `var(--n${(seq % 5) + 1})` }}
    >
      <span className="arrival__iris" />
      {motion && <span className="arrival__wipe" />}
      {motion && <span className="arrival__scan" />}
    </div>
  )
}
