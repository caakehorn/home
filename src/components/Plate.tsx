import type { CSSProperties } from 'react'
import type { Plate as PlateData } from '../content/art'
import './plate.css'

/* ==========================================================================
   A PLATE — a picture, cut out with scissors and stuck to the page

   Nothing on this site is cut square. The punk pass is four devices and one of
   them is literally called THE SCISSORS, so a picture in a rectangle would read
   as stock photography dropped into a flyer. `clip-path` is a paint-time
   operation on a static element: it costs nothing per frame, it follows the
   box at any size, and it gives an edge that looks handled rather than an
   outline that looks masked.

   ---- what this deliberately is not --------------------------------------

   An earlier version of this component tracked the pointer, sheared with the
   scroll, split into misregistered colour channels and pulled six custom
   properties off `<html>` that a separate module wrote once a frame. It is
   gone, along with the module. This is an image, a torn edge, a halftone and
   the room's own colour over the top — and it inherits everything else it
   needs from the layers the site already has.

   ---- the one thing that is not decoration --------------------------------

   `alt`. Several of these are the entire content of the section they sit in,
   and a screen reader handed "decorative image" for the largest thing on the
   page has been lied to.
   ========================================================================== */

/** The shapes of the tear. Named rather than free-form, so a page cannot
    invent a ninth cut and quietly break the family resemblance. */
export type Cut = 'torn' | 'shard' | 'rip' | 'slab' | 'none'

type PlateProps = {
  plate: PlateData
  cut?: Cut
  className?: string
  /** Override the plate's own tube, for a room that wants it in its colour. */
  tone?: 1 | 2 | 3 | 4 | 5
  /** Above the fold? Then it is not lazy and it is not low priority. */
  eager?: boolean
  style?: CSSProperties
}

export function Plate({ plate, cut = 'torn', className = '', tone, eager = false, style }: PlateProps) {
  return (
    <figure
      className={`plate plate--${cut} ${className}`}
      style={{
        ['--glow' as string]: `var(--n${tone ?? plate.tone})`,
        ['--ratio' as string]: `${plate.w} / ${plate.h}`,
        ...style,
      }}
    >
      <span className="plate__frame">
        <img
          className="plate__img"
          src={plate.src}
          width={plate.w}
          height={plate.h}
          alt={plate.alt}
          loading={eager ? 'eager' : 'lazy'}
          fetchPriority={eager ? 'high' : 'low'}
          decoding="async"
          draggable={false}
        />
        <span className="plate__screen" aria-hidden="true" />
        <span className="plate__wash" aria-hidden="true" />
        <span className="plate__kana jp" aria-hidden="true">
          {plate.kana}
        </span>
      </span>
    </figure>
  )
}
