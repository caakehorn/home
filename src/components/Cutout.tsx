import { PLATES, type PlateId } from '../content/art'
import './cutout.css'

/* ==========================================================================
   A CUTOUT — a plate, cut out with scissors and stuck to the page

   ---- what this is instead of ---------------------------------------------

   The obvious thing to do with seven pictures is put them in rectangles. This
   building has spent two redesigns establishing that nothing in it is cut
   square — the punk pass is four devices and one of them is literally called
   THE SCISSORS — and a rectangle would have read as stock photography dropped
   into a flyer.

   So every plate is clipped to a torn polygon, and only one of the seven has
   a real alpha channel. `clip-path` is a paint-time operation on a static
   element: it costs nothing per frame, it follows the element's box at any
   size, and it gives an edge that looks handled rather than an outline that
   looks masked.

   ---- the misregistration -------------------------------------------------

   Two ghosts of the same file sit under the plate, one pushed left and tinted
   magenta, one pushed right and tinted cyan, both on `screen`. That is the
   chromatic aberration off the front door, applied to the art itself, and it
   is the reason the plates belong to this site rather than looking like they
   were pasted onto it.

   The split is not constant. It reads `--sva` — the scroll velocity published
   by TELEMETRY — so the channels come apart when the page moves and settle
   when it stops. A plate that misregisters harder the faster you scroll reads
   as a physical thing being dragged past a badly aligned print head, which is
   what the whole house style is about.

   The tint is `sepia → saturate → hue-rotate` rather than a blend of a solid
   colour. All three are colour-matrix operations, which is one shader pass;
   the alternative, a coloured layer multiplied into a copy, is a second full
   composite of the same pixels for a worse result.

   ---- one decode, three layers --------------------------------------------

   Both ghosts use the same URL as the plate, so the browser decodes the file
   once and composites it three times. Compositing the same texture three times
   is cheap; decoding a 1280px WebP three times is not, and using three
   differently-processed files would have tripled what the folder weighs.
   ========================================================================== */

/** The shapes of the tear. Named rather than passed in, so a page cannot
    invent a ninth cut and quietly break the family resemblance. */
export type Cut = 'torn' | 'shard' | 'rip' | 'slab' | 'none'

type CutoutProps = {
  plate: PlateId
  cut?: Cut
  className?: string
  /** How far the plate drifts against the pointer. 0 pins it. */
  drift?: number
  /** Override the plate's own tube — for a room that wants it in its colour. */
  tone?: 1 | 2 | 3 | 4 | 5
  /** First screen? Then it is not lazy and it is not low priority. */
  eager?: boolean
  /** Show the plate's caption under it. */
  captioned?: boolean
  style?: React.CSSProperties
}

export function Cutout({
  plate,
  cut = 'torn',
  className = '',
  drift = 1,
  tone,
  eager = false,
  captioned = false,
  style,
}: CutoutProps) {
  const art = PLATES[plate]
  const ghost = { backgroundImage: `url(${art.src})` }

  return (
    <figure
      className={`cut cut--${cut} ${className}`}
      data-magnet=""
      style={{
        ['--glow' as string]: `var(--n${tone ?? art.tone})`,
        ['--drift' as string]: drift,
        ['--ratio' as string]: `${art.w} / ${art.h}`,
        ...style,
      }}
    >
      <span className="cut__frame">
        <span className="cut__ghost cut__ghost--m" style={ghost} aria-hidden="true" />
        <span className="cut__ghost cut__ghost--c" style={ghost} aria-hidden="true" />

        <img
          className="cut__plate"
          src={art.src}
          width={art.w}
          height={art.h}
          alt={art.alt ?? ''}
          /* No label means decorative, and a decorative image that announces
             itself as an image is noise in a screen reader. */
          aria-hidden={art.alt ? undefined : true}
          loading={eager ? 'eager' : 'lazy'}
          fetchPriority={eager ? 'high' : 'low'}
          decoding="async"
          draggable={false}
        />

        <span className="cut__screen" aria-hidden="true" />
        <span className="cut__wash" aria-hidden="true" />
        <span className="cut__kana jp" aria-hidden="true">
          {art.kana}
        </span>
      </span>

      {captioned && art.note && (
        <figcaption className="cut__note">
          <span className="jp" aria-hidden="true">
            {art.kana}
          </span>
          {art.note}
        </figcaption>
      )}
    </figure>
  )
}
