import { useShutter } from './useShutter'
import './shutter.css'

/* ==========================================================================
   THE SHUTTER — what you actually see

   Seven layers, mounted only while a bang is on screen and keyed to it, so a
   re-fire is a remount and every animation in here starts from frame zero
   without a single `animation: none` reset anywhere.

     1. THE VEIL      a flat field of the bang's tube, on `difference`, on a
                      steps() strobe. This is the invert.
     2. THE BLOOM     a radial wash out of the exact point you struck.
     3. THE RINGS     two shockwaves, out of the same point, at two speeds.
     4. THE FRINGE    magenta left, cyan right, sliding apart. This is the
                      misregistration — the plate is a millimetre out and
                      nobody ran it again.
     5. THE TEAR      three horizontal bands that jump sideways on steps(),
                      which reads as the whole screen shaking without moving
                      one pixel of the page. See below for why that matters.
     6. THE IRIS      doors only: a hard circular wipe out of the strike point.
     7. THE GRID      doors only: one frame of wireframe, like a plate being
                      registered before the ink goes down.

   ---- why nothing here shakes the page ------------------------------------

   The obvious way to do a screen shake is to translate the page. It is also
   wrong here, twice: `transform` on the root element re-parents fixed
   descendants (unlike `filter`, which the spec exempts), and every alternative
   ancestor to hang it off — body, a wrapper div — takes the two crawls, the
   HUD and the five screen-furniture layers with it, all of which are fixed and
   all of which would visibly jump to a new origin and back.

   So the shake is faked, and the fake is better: bands of the picture jump
   sideways against each other rather than the whole picture jumping. That is
   what a mistracking tape does, it is what a torn frame does, and it costs
   three composited layers instead of a full-page re-raster.
   ========================================================================== */

export function Shutter() {
  const { bang } = useShutter()
  if (!bang) return null

  const door = bang.kind === 'door'
  const calm = bang.kind === 'calm'

  return (
    <div
      key={bang.id}
      className="shutter"
      data-kind={bang.kind}
      aria-hidden="true"
      style={{
        ['--glow' as string]: `var(--n${bang.tone})`,
        ['--bx' as string]: `${bang.x}%`,
        ['--by' as string]: `${bang.y}%`,
      }}
    >
      <span className="shutter__veil" />
      <span className="shutter__bloom" />

      {!calm && (
        <>
          <span className="shutter__ring" />
          <span className="shutter__ring shutter__ring--2" />
          <span className="shutter__fringe shutter__fringe--m" />
          <span className="shutter__fringe shutter__fringe--c" />
          <span className="shutter__tear shutter__tear--1" />
          <span className="shutter__tear shutter__tear--2" />
          <span className="shutter__tear shutter__tear--3" />
        </>
      )}

      {door && !calm && (
        <>
          <span className="shutter__iris" />
          <span className="shutter__plate" />
        </>
      )}
    </div>
  )
}
