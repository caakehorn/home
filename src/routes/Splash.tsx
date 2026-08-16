import { useEffect, useState } from 'react'
import { Logo } from '../components/Logo'
import { Marquee } from '../components/Marquee'
import { banner } from '../content/slogans'
import { usePortal, useRig } from '../state/usePortal'
import './splash.css'

const STARS = Array.from({ length: 46 }, (_, i) => ({
  left: `${(i * 37.6) % 100}%`,
  top: `${(i * 61.3) % 72}%`,
  size: `${2 + ((i * 7) % 4)}px`,
  delay: `${((i * 13) % 40) / 10}s`,
}))

const SIGNS = [
  { text: '営業中', tone: 2, side: 'left', top: '16%', minor: false },
  // the mid-height pair collides with the tagline plate on narrow screens
  { text: '弁証', tone: 3, side: 'left', top: '46%', minor: true },
  { text: '資料', tone: 1, side: 'right', top: '12%', minor: false },
  { text: '薬窟', tone: 5, side: 'right', top: '44%', minor: true },
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
        {STARS.map((star, i) => (
          <span
            key={i}
            className="splash__star"
            style={{
              left: star.left,
              top: star.top,
              width: star.size,
              height: star.size,
              animationDelay: star.delay,
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
        {/* tower, per the reference */}
        <path className="splash__tower" d="M600 40 L586 150 L560 300 L640 300 L614 150 Z M566 300 L634 300 L648 420 L552 420 Z" />
        <path className="splash__tower-x" d="M572 250 L628 250 M576 200 L624 200" />
        {/* pagoda */}
        <g className="splash__pagoda">
          <path d="M760 140 L700 175 L820 175 Z" />
          <path d="M770 185 L710 220 L810 220 Z" />
          <path d="M778 230 L718 268 L802 268 Z" />
          <rect x="748" y="268" width="24" height="152" />
          <rect x="742" y="120" width="6" height="24" transform="translate(18 0)" />
        </g>
      </svg>

      {/* ---- vertical neon signs ------------------------------------ */}
      {SIGNS.map((sign) => (
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

      {/* ---- lanterns ----------------------------------------------- */}
      <div className="splash__lanterns" aria-hidden="true">
        {['占', '運', '夢'].map((glyph, i) => (
          <span key={glyph} className="splash__lantern jp" style={{ animationDelay: `${i * 0.45}s` }}>
            {glyph}
          </span>
        ))}
      </div>

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

      {/* ---- roof + crows ------------------------------------------- */}
      <div className="splash__roof" aria-hidden="true">
        <svg className="splash__crows" viewBox="0 0 600 130" preserveAspectRatio="xMidYMax meet">
          {[30, 232, 428].map((x, i) => (
            // outer <g> holds position; inner <g> owns the CSS animation, or the
            // animated transform would clobber the placement transform
            <g key={x} transform={`translate(${x}, 4) scale(${i === 1 ? 1.16 : 1})`}>
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
        <div className="splash__tiles" />
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
