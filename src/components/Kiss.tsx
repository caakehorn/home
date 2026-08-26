import { useId } from 'react'
import { CANCER, CANCER_EDGES } from '../arcade/content'
import { KISS_FACES } from '../content/art'
import './kiss.css'

/* ==========================================================================
   THE KISS — two figures in profile, cut out of the dark.

   ---- why it is drawn this way -------------------------------------------

   Two profiles facing each other cannot both keep their noses. A nose sticks
   out further than a mouth does, so the moment the lips touch, in a flat side
   view, the noses are in the same square inch of canvas and the whole thing
   collapses into one blob with two ears. Every attempt to solve that by
   tilting the heads just moves the collision somewhere else.

   So it is not solved, it is staged. One figure is IN FRONT of the other, the
   way one of them always is, and the figure in front carries a thick stroke in
   the background colour — a cut — that separates her from everything behind
   her. Where the two silhouettes overlap you get a hairline of void instead of
   a merge, which is what makes two people read as two people.

   The lips are the one place the cut is allowed to be tight: the figure behind
   sits seven units to the left, so after the cut eats its four, there are three
   units of night between her mouth and the other one. That gap is the whole
   drawing. Any wider and they are talking.

   ---- what is lit --------------------------------------------------------

   Nothing here is filled with a colour. The fills are all void; the only
   colour is a rim on each face — magenta on the one behind, cyan on the one in
   front — which is a light source standing between them and the viewer, and is
   also the reason a silhouette this dark is legible on a screen this dark at
   all.

   ---- and then there are faces in it ------------------------------------

   Two frames of animation fill the silhouettes, clipped to the exact same
   paths that draw them. The drawing is a WINDOW onto the picture now rather
   than a shape cut out of the dark, and the void fills underneath are still
   there — they are what shows through wherever a plate has not loaded yet, so
   the composition never has a hole in it.

   The clip paths carry no transform of their own. A `clipPath` is resolved in
   the user space of whatever references it, so the untransformed head sits
   inside the rotated group and rotates with it for free; giving the clip its
   own copy of the rotation would apply it twice.

   Everything the rim and the cut were doing survives, in the same order. The
   images go UNDER the rim and OVER the ink, and the front figure's cut is a
   stroke with `paint-order: stroke fill`, so it grows outward from the
   silhouette and is not covered by the image sitting inside it.
   ========================================================================== */

/** Facing right, closed, with the lip contact at (210,131). */
const HEAD = `M 210 131
C 205 129 202 127 202 123
C 205 121 210 119 214 116
C 218 113 210 104 205 98
C 201 94 198 92 198 87
C 199 76 200 67 197 59
C 190 45 172 37 151 39
C 129 42 113 59 110 83
C 107 103 109 123 115 139
C 120 152 127 159 135 164
C 149 172 171 171 186 163
C 195 158 201 152 203 146
C 205 142 201 138 199 135
C 202 133 206 132 210 131 Z`

/**
 * The lit edge: the same contour as HEAD from the crown to the jaw, open, so
 * it can be stroked without ringing the whole head. A full outline would read
 * as a sticker; an edge reads as a light behind somebody's face.
 */
const RIM = `M 151 39
C 172 37 190 45 197 59
C 200 67 199 76 198 87
C 198 92 201 94 205 98
C 210 104 218 113 214 116
C 210 119 205 121 202 123
C 202 127 205 129 210 131
C 206 132 202 133 199 135
C 201 138 205 142 203 146
C 201 152 196 157 189 161`

/** Neck and shoulders, unrotated — the head turns on the neck, not with it. */
const TORSO = `M 134 152 L 134 196
C 112 202 90 214 76 234
C 62 250 54 260 51 264
L 214 264 L 214 236
C 210 222 202 208 190 200
L 190 152 Z`

/* Two heads of hair, both cut for the same room. One is shaved at the side
   with the length swept over and knotted up; the other is blunt at the front
   with the length gathered low and left alone. */
const HAIR_BACK = `M 110 116
C 104 88 112 56 137 42
C 163 28 194 36 200 58
C 205 42 197 24 177 16
C 152 7 119 14 103 34
C 88 53 90 94 100 114 Z`

const KNOT_BACK = `M 130 34 C 123 24 131 13 143 14
C 154 15 159 25 153 33 C 147 41 136 42 130 34 Z`

const HAIR_FRONT = `M 112 104
C 107 76 120 48 145 38
C 172 27 197 40 201 62
C 204 46 196 24 175 16
C 149 6 118 16 105 36
C 92 55 96 84 102 102 Z`

const TAIL_FRONT = `M 116 90
C 100 96 90 114 87 136
C 84 158 89 178 97 192
C 103 202 112 205 118 201
C 111 186 106 168 107 148
C 108 128 111 106 116 90 Z`

/**
 * Cancer, in the void behind them.
 *
 * The stars and the wiring are the ones the arcade uses, imported rather than
 * copied so the sky over this drawing cannot drift out of agreement with the
 * sky in WATER SIGNS. The constellation is laid into the upper-left corner at
 * a fifth of its brightness, which is roughly what Cancer looks like anyway:
 * it is one of the faintest figures up there, and you only find it because you
 * know where to look.
 */
const SKY_X = (x: number) => 18 + x * 0.95
const SKY_Y = (y: number) => 12 + y * 0.8

type KissProps = {
  className?: string
  /** Rendered as an accessible name; omit and the drawing is decorative. */
  label?: string
}

export function Kiss({ className = '', label }: KissProps) {
  // Four clip paths, and an SVG id is document-global. Two of these on one
  // page with hard-coded ids and the second drawing silently clips itself to
  // the first one's shapes.
  const uid = useId().replace(/:/g, '')

  return (
    <svg
      className={`kiss ${className}`}
      viewBox="0 0 420 264"
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      focusable="false"
    >
      <defs>
        {/* No transforms in here on purpose: a clipPath resolves in the user
            space of the element that references it, so each of these inherits
            the rotation and the mirror of the group it is used inside. */}
        <clipPath id={`${uid}-back-head`}>
          <path d={HEAD} />
          <path d={HAIR_BACK} />
          <path d={KNOT_BACK} />
        </clipPath>
        <clipPath id={`${uid}-back-torso`}>
          <path d={TORSO} />
        </clipPath>
        <clipPath id={`${uid}-front-head`}>
          <path d={HEAD} />
          <path d={HAIR_FRONT} />
          <path d={TAIL_FRONT} />
        </clipPath>
        <clipPath id={`${uid}-front-torso`}>
          <path d={TORSO} />
        </clipPath>
      </defs>

      <ellipse className="kiss__bloom" cx="210" cy="120" rx="140" ry="112" />

      <g className="kiss__sky" aria-hidden="true">
        {CANCER_EDGES.map(([a, b]) => (
          <line
            key={`${a}-${b}`}
            x1={SKY_X(CANCER[a].x)}
            y1={SKY_Y(CANCER[a].y)}
            x2={SKY_X(CANCER[b].x)}
            y2={SKY_Y(CANCER[b].y)}
          />
        ))}
        {CANCER.map((star) => (
          <circle
            key={star.name}
            cx={SKY_X(star.x)}
            cy={SKY_Y(star.y)}
            // magnitude runs backwards — a bigger number is a fainter star
            r={(6.2 - star.mag) * 0.7}
          />
        ))}
      </g>

      {/* ---- the one behind ------------------------------------------- */}
      <g transform="translate(-7 0)">
        <path className="kiss__ink" d={TORSO} />

        {/* A chain and a bird, at her throat. It is the one she asked for. */}
        <path className="kiss__chain" d="M 150 196 C 162 208 182 208 194 197" />
        <path className="kiss__chain kiss__chain--bird" d="M 168 208 l 5 -4 l 6 4 l -4 3 l 1 5 l -5 -4 l -5 2 Z" />

        <g clipPath={`url(#${uid}-back-torso)`}>
          <image
            className="kiss__face"
            href={KISS_FACES.back}
            x="44"
            y="146"
            width="180"
            height="126"
            preserveAspectRatio="xMidYMin slice"
          />
        </g>

        <g transform="rotate(-10 210 131)">
          <path className="kiss__ink" d={HEAD} />
          <path className="kiss__ink" d={HAIR_BACK} />
          <path className="kiss__ink" d={KNOT_BACK} />
          <g clipPath={`url(#${uid}-back-head)`}>
            <image
              className="kiss__face"
              href={KISS_FACES.back}
              x="84"
              y="8"
              width="142"
              height="172"
              /* Anchored to the RIGHT edge, which is where her profile is and
                 also where the silhouette's profile runs. Centred, `slice`
                 trims both sides evenly and takes the front of her face off
                 with it. */
              preserveAspectRatio="xMaxYMid slice"
            />
          </g>
          <path className="kiss__rim kiss__rim--back" d={RIM} />
        </g>
      </g>

      {/* ---- the one in front, and the cut that says so ---------------- */}
      <g transform="translate(420 0) scale(-1 1)">
        <path className="kiss__ink kiss__cut" d={TORSO} />
        <g clipPath={`url(#${uid}-front-torso)`}>
          <image
            className="kiss__face"
            href={KISS_FACES.front}
            x="44"
            y="146"
            width="180"
            height="126"
            preserveAspectRatio="xMidYMin slice"
          />
        </g>

        <g transform="rotate(5 210 131)">
          <path className="kiss__ink kiss__cut" d={TAIL_FRONT} />
          <path className="kiss__ink kiss__cut" d={HEAD} />
          <path className="kiss__ink kiss__cut" d={HAIR_FRONT} />
          <g clipPath={`url(#${uid}-front-head)`}>
            <image
              className="kiss__face"
              href={KISS_FACES.front}
              x="84"
              y="8"
              width="142"
              height="172"
              preserveAspectRatio="xMidYMid slice"
            />
          </g>
          <path className="kiss__rim kiss__rim--front" d={RIM} />
        </g>
      </g>
    </svg>
  )
}
