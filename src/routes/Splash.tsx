import { useEffect, useState } from 'react'
import { Kiss } from '../components/Kiss'
import { Logo } from '../components/Logo'
import { Marquee } from '../components/Marquee'
import { banner } from '../content/slogans'
import { usePortal, useRig } from '../state/usePortal'
import './splash.css'

/* ==========================================================================
   THE FRONT DOOR

   It used to be a postcard: a pagoda on the skyline, a row of paper lanterns
   swaying in the corner, a temple roof in perspective across the bottom. None
   of that is a city, it is a restaurant menu, and a building whose banner says
   ARGUE FIRST does not open onto a restaurant menu.

   What is here instead is the street the flyer got stapled to: a capsule
   tower, a lattice tower, an expressway on stilts, a utility pole carrying
   more wire than any pole should, crows on the top line, and a chain-link
   fence at the bottom of the frame with somebody's stickers on it. The kanji
   stayed — the kanji was never the problem, the kanji is the signage — and so
   did the crows, because crows on a wire at 4am is not a motif, it is just
   what is out there.
   ========================================================================== */

/** Out-of-focus city light. Not stars: you cannot see stars from down here. */
const BOKEH = Array.from({ length: 34 }, (_, i) => ({
  left: `${(i * 37.6) % 100}%`,
  top: `${(i * 61.3) % 78}%`,
  size: `${6 + ((i * 7) % 5) * 4}px`,
  delay: `${((i * 13) % 40) / 10}s`,
  tone: (i % 4) + 1,
}))

const SIGNS = [
  { text: '営業中', tone: 2, side: 'left', top: '15%', minor: false },
  // the mid-height pair collides with the tagline plate on narrow screens
  { text: '弁証', tone: 3, side: 'left', top: '46%', minor: true },
  { text: '資料', tone: 1, side: 'right', top: '11%', minor: false },
  { text: '薬窟', tone: 5, side: 'right', top: '43%', minor: true },
]

/**
 * One more sign, lit one day a year.
 *
 * 蟹 is the crab, which is Cancer, which is June 26 — the date the wiki
 * derives rather than the date it was told. Three hundred and sixty-four
 * nights out of the year this street has four signs on it. Nobody who is not
 * looking for a fifth will ever know there was one, and anybody standing here
 * on the right night does not need it explained.
 */
const isTheDay = () => {
  const now = new Date()
  return now.getMonth() === 5 && now.getDate() === 26
}

/**
 * Where the crows sit, in the wire rig's own coordinates.
 *
 * The top line runs `M1026 76 C 800 130 400 140 0 96` and these are points ON
 * it, solved off the curve rather than eyeballed near it — a crow floating two
 * units above its own wire is the kind of thing you cannot un-see. The art is
 * 112 wide and stands on its feet at y=84, which is what the transform below
 * subtracts.
 */
const CROWS = [
  { x: 888, y: 101, scale: 1 },
  { x: 722, y: 117, scale: 0.94 },
  { x: 642, y: 121, scale: 0.86 },
  { x: 446, y: 123, scale: 1 },
]

/** The gate. Sits over the home page until you push through it. */
export function Splash() {
  const { enter } = usePortal()
  const poke = useRig('THE GATE')
  const [leaving, setLeaving] = useState(false)

  const go = () => {
    if (leaving) return
    poke()
    setLeaving(true)
    window.setTimeout(enter, 900)
  }

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Enter' || event.key === ' ') {
        const tag = (event.target as HTMLElement | null)?.tagName
        if (tag === 'BUTTON' || tag === 'INPUT') return
        event.preventDefault()
        go()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  return (
    <div className={`splash${leaving ? ' splash--out' : ''}`} role="dialog" aria-label="Enter the portal">
      {/* ---- sky ---------------------------------------------------- */}
      <div className="splash__sky" aria-hidden="true">
        {BOKEH.map((light, i) => (
          <span
            key={i}
            className="splash__star"
            style={{
              left: light.left,
              top: light.top,
              width: light.size,
              height: light.size,
              animationDelay: light.delay,
              ['--glow' as string]: `var(--n${light.tone})`,
            }}
          />
        ))}
        <span className="splash__moon" />
      </div>

      {/* ---- skyline ------------------------------------------------ */}
      <svg className="splash__skyline" viewBox="0 0 1200 420" preserveAspectRatio="xMidYMax slice" aria-hidden="true">
        <g className="splash__towers">
          <rect x="30" y="120" width="120" height="300" />
          <rect x="170" y="60" width="76" height="360" />
          <rect x="980" y="90" width="150" height="330" />
          <rect x="880" y="180" width="80" height="240" />
          <rect x="270" y="210" width="60" height="210" />
        </g>
        <g className="splash__windows">
          {Array.from({ length: 60 }, (_, i) => {
            const col = i % 6
            const row = Math.floor(i / 6)
            return <rect key={i} x={42 + col * 18} y={134 + row * 26} width="10" height="14" />
          })}
          {Array.from({ length: 48 }, (_, i) => {
            const col = i % 6
            const row = Math.floor(i / 6)
            return <rect key={`b${i}`} x={994 + col * 23} y={106 + row * 28} width="12" height="16" />
          })}
        </g>

        {/* the lattice tower, per the reference */}
        <path className="splash__tower" d="M600 40 L586 150 L560 300 L640 300 L614 150 Z M566 300 L634 300 L648 420 L552 420 Z" />
        <path className="splash__tower-x" d="M572 250 L628 250 M576 200 L624 200" />

        {/* the capsule tower — a concrete spine with washing-machine windows
            bolted to it, none of them square with each other any more */}
        <g className="splash__capsule">
          <rect x="748" y="150" width="26" height="270" />
          {Array.from({ length: 11 }, (_, i) => {
            const right = i % 2 === 0
            const y = 158 + i * 24
            return (
              <g key={i}>
                <rect x={right ? 774 : 714} y={y} width="34" height="22" />
                <circle cx={right ? 796 : 722} cy={y + 11} r="6" className="splash__capsule-eye" />
              </g>
            )
          })}
        </g>

        {/* the expressway, on stilts, going somewhere else */}
        <g className="splash__road">
          <path d="M0 356 C 180 336 300 348 460 372 C 620 396 820 392 1200 366" />
          <path className="splash__road-line" d="M0 362 C 180 342 300 354 460 378 C 620 402 820 398 1200 372" />
          <g className="splash__piers">
            <rect x="150" y="344" width="14" height="76" />
            <rect x="440" y="372" width="14" height="48" />
            <rect x="820" y="390" width="14" height="30" />
          </g>
        </g>
      </svg>

      {/* ---- vertical neon signs ------------------------------------ */}
      {(isTheDay()
        ? [...SIGNS, { text: '蟹', tone: 2, side: 'right', top: '68%', minor: false }]
        : SIGNS
      ).map((sign) => (
        <span
          key={sign.text}
          className={`splash__sign splash__sign--${sign.side}${sign.minor ? ' splash__sign--minor' : ''} jp`}
          style={{ top: sign.top, ['--glow' as string]: `var(--n${sign.tone})` }}
          aria-hidden="true"
        >
          {/* stacked glyphs rather than writing-mode: predictable box, every engine */}
          {[...sign.text].map((glyph, i) => (
            <span key={i} className="splash__sign-glyph">
              {glyph}
            </span>
          ))}
        </span>
      ))}

      {/* ---- the two of them, down on the corner under the pole ------- */}
      <Kiss className="splash__kiss" />

      {/* ---- the mark ----------------------------------------------- */}
      <div className="splash__core">
        <span className="splash__venue jp" aria-hidden="true">
          弁証薬窟
        </span>

        <Logo size="clamp(1.9rem, 7.5vw, 5.6rem)" />

        <p className="splash__tagline">
          <span className="firetext">DIALECTICAL DATABASE &amp; DRUG DEN</span>
          <span className="splash__tagline-sep" aria-hidden="true">
            ✕
          </span>
          <span className="splash__tagline-alt">the brain · the lattice · the instruments · the noise</span>
        </p>

        <button type="button" className="splash__enter" onClick={go}>
          <span className="splash__enter-glow" aria-hidden="true" />
          <span className="splash__enter-label">ENTER</span>
          <span className="splash__enter-kana jp" aria-hidden="true">
            入
          </span>
        </button>

        <span className="splash__hint">click, or hit ENTER / SPACE</span>
      </div>

      {/* ---- wires, crows, fence ------------------------------------ */}
      <div className="splash__street" aria-hidden="true">
        {/* No preserveAspectRatio games: the element is sized by width with an
            auto height, so its box is the viewBox's own aspect and nothing in
            here is ever stretched or cropped. A stretched wire nobody notices;
            a stretched crow is all anybody sees. */}
        <svg className="splash__wires" viewBox="0 0 1200 240">
          {/* the pole carries more than it was ever rated for, and it stands on
              the far side of the frame so the two of them get the corner */}
          <g className="splash__pole">
            <rect x="1020" y="40" width="14" height="200" />
            <rect x="976" y="70" width="102" height="7" />
            <rect x="986" y="106" width="82" height="6" />
            <rect x="994" y="140" width="66" height="5" />
            <rect x="1002" y="46" width="50" height="26" className="splash__pole-can" />
          </g>
          <g className="splash__lines">
            <path d="M1026 76 C 800 130 400 140 0 96" />
            <path d="M1026 110 C 800 168 400 178 0 134" />
            <path d="M1026 144 C 800 200 400 210 0 168" />
            <path d="M1026 78 C 820 116 420 122 0 74" />
            <path d="M1034 76 C 1080 82 1140 92 1200 106" />
          </g>
          {CROWS.map((crow, i) => (
            // outer <g> holds position; inner <g> owns the CSS animation, or the
            // animated transform would clobber the placement transform
            <g key={crow.x} transform={`translate(${crow.x - 56 * crow.scale}, ${crow.y - 84 * crow.scale}) scale(${crow.scale})`}>
              <g className="splash__crow" style={{ animationDelay: `${i * 1.4}s` }}>
                {/* perched crow, facing left: beak, head, back, long tail */}
                <path
                  className="splash__crow-body"
                  d="M4 34 L22 28 L22 40 Z
                     M24 24 C31 15 45 14 53 22
                     C67 27 84 30 112 20
                     C107 36 92 49 70 55
                     C74 62 76 70 74 78
                     C66 72 58 68 48 66
                     C34 63 24 53 22 41
                     C21 34 21 28 24 24 Z"
                />
                <path
                  className="splash__crow-legs"
                  d="M44 66 L42 82 M58 68 L60 84 M36 82 L48 82 M54 84 L66 84"
                />
                <circle className="splash__crow-eye" cx="34" cy="27" r="2.6" />
              </g>
            </g>
          ))}
        </svg>
        <div className="splash__fence" />
      </div>

      <div className="splash__ticker">
        <Marquee
          text={banner('splash')}
          duration={30}
          tone={2}
          size="clamp(0.7rem, 1.4vw, 1rem)"
        />
      </div>
    </div>
  )
}
