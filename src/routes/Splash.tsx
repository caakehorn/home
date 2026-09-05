import { useEffect, useState } from 'react'
import { Crown } from '../components/Crown'
import { Logo } from '../components/Logo'
import { Plate } from '../components/Plate'
import { hangs } from '../content/slates'
import { usePortal, useRig } from '../state/usePortal'
import { useWikiIndex } from '../wiki/data'
import './splash.css'

/* ==========================================================================
   THE FRONT DOOR

   It used to be a picture postcard: a crescent moon, a twinkling starfield, a
   pagoda, three paper lanterns and a row of crows on a tiled roof. Drawn well
   and completely toothless — a tourist's idea of Tokyo, and the wrong thing to
   put in front of a building whose banner says EAT THE RICH.

   What replaced it is the other Tokyo, the one shot from a helicopter at 4am
   with the colour pushed until it hurts: a city grid running away underneath
   you, signage stacked vertically in every direction, and a title card that
   strobes rather than fades. The Japanese stays — more of it than before, and
   harder. The crown stays, over the mark, because it was always the one piece
   of the old front door with teeth in it.

   ---- what it is made of ------------------------------------------------

   Five layers, and between them they animate exactly two properties:

     1. THE GRID     one element, rotated into perspective, translated on Y
                     forever. The city, from above.
     2. THE BLOOM    two conic gradients counter-rotating behind the mark.
     3. THE SIGNAGE  vertical kanji columns, drifting on Y at four speeds.
     4. THE BARRAGE  the title card, on a steps() opacity strobe.
     5. THE PLATES   two frames of animation, torn, on the walls the
                     composition leaves empty. They stand where four hidden
                     relic stickers used to, which is a straight trade: a
                     picture you can see for a sticker you had to find.

   No blurs, no backdrop filters, no per-frame JavaScript. The old door ran a
   46-element twinkling starfield with a `filter: drop-shadow` on every one of
   them, which is 46 separate blur passes a frame before anything else on the
   page has painted; this runs on the compositor and leaves the main thread
   free for the thing the door is actually in front of.
   ========================================================================== */

/** Vertical signage. Real words, and none of them are welcoming. */
const SIGNS = [
  { text: '虚空', side: 'left', top: '9%', tone: 3, speed: 26, minor: false },
  { text: '入口', side: 'left', top: '46%', tone: 2, speed: 34, minor: true },
  { text: '弁証', side: 'left', top: '74%', tone: 5, speed: 30, minor: true },
  { text: '薬窟', side: 'right', top: '7%', tone: 1, speed: 30, minor: false },
  { text: '不眠', side: 'right', top: '40%', tone: 4, speed: 24, minor: true },
  { text: '出口', side: 'right', top: '70%', tone: 2, speed: 38, minor: false },
] as const

/** The title barrage — the credits, one word at a time, too fast to read. */
const BARRAGE = [
  'ENTER', '入場', 'THE', 'VOID', '虚空', 'ARGUE', '弁証', 'FIRST',
  'CITE', '引用', 'AFTER', 'ASK', '誰何', 'NOBODY',
]

/** The horizon: sodium windows in towers you are flying over, not past. */
const BLOCKS = Array.from({ length: 34 }, (_, i) => ({
  left: `${(i * 29.7) % 100}%`,
  width: `${3 + ((i * 13) % 7)}%`,
  height: `${18 + ((i * 31) % 62)}%`,
  tone: (i % 5) + 1,
  delay: `${((i * 17) % 70) / 10}s`,
}))

export function Splash() {
  const { enter } = usePortal()
  const poke = useRig('THE GATE')
  const [leaving, setLeaving] = useState(false)

  // The door is the one moment on the site where nothing is being read yet, so
  // it is the right place to pay for the index: the brain console on the other
  // side of it needs the same 487 rows, `loadIndex` caches the promise, and the
  // console is therefore populated before anybody has finished the click. The
  // counts in the tagline are the honest by-product rather than the reason.
  const { data } = useWikiIndex()

  const go = () => {
    if (leaving) return
    poke()
    setLeaving(true)
    window.setTimeout(enter, 760)
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
    <div
      className={`splash${leaving ? ' splash--out' : ''}`}
      role="dialog"
      aria-label="Enter the portal"
    >
      {/* ---- 1 · the grid, running away underneath -------------------- */}
      <div className="splash__floor" aria-hidden="true">
        <div className="splash__grid" />
      </div>

      {/* ---- the blocks you are flying over -------------------------- */}
      <div className="splash__city" aria-hidden="true">
        {BLOCKS.map((block, i) => (
          <span
            key={i}
            className="splash__block"
            style={{
              left: block.left,
              width: block.width,
              height: block.height,
              ['--glow' as string]: `var(--n${block.tone})`,
              animationDelay: block.delay,
            }}
          />
        ))}
      </div>

      {/* ---- 2 · the bloom ------------------------------------------- */}
      <div className="splash__bloom" aria-hidden="true">
        <span className="splash__bloom-ring splash__bloom-ring--a" />
        <span className="splash__bloom-ring splash__bloom-ring--b" />
      </div>

      {/* ---- 3 · the signage ----------------------------------------- */}
      {SIGNS.map((sign) => (
        <span
          key={`${sign.side}${sign.top}`}
          className={`splash__sign splash__sign--${sign.side}${sign.minor ? ' splash__sign--minor' : ''} jp`}
          style={{
            top: sign.top,
            ['--glow' as string]: `var(--n${sign.tone})`,
            ['--drift' as string]: `${sign.speed}s`,
          }}
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

      {/* ---- 5 · the plates ------------------------------------------
          Torn on different angles so the pair does not read as a symmetrical
          frame, and UNDER the core in the stack: the mark has to win, and a
          title card competing with two pictures at the same depth loses. */}
      <div className="splash__plates">
        <Plate
          plate={hangs('door-left')}
          cut="shard"
          className="splash__plate splash__plate--l"
          eager
        />
        <Plate
          plate={hangs('door-right')}
          cut="torn"
          className="splash__plate splash__plate--r"
        />
      </div>

      {/* ---- 4 · the mark -------------------------------------------- */}
      <div className="splash__core">
        <div className="splash__barrage" aria-hidden="true">
          {BARRAGE.map((word, i) => (
            <span
              key={`${word}${i}`}
              className={`splash__barrage-word${/[^\x20-\x7E]/.test(word) ? ' jp' : ''}`}
              style={{
                ['--i' as string]: i,
                ['--glow' as string]: `var(--n${(i % 5) + 1})`,
              }}
            >
              {word}
            </span>
          ))}
        </div>

        <span className="splash__crown-mount" aria-hidden="true">
          <Crown className="splash__crown" />
        </span>

        <Logo size="clamp(1.9rem, 7.5vw, 5.6rem)" />

        <span className="splash__venue jp" aria-hidden="true">
          弁証薬窟
        </span>

        <p className="splash__tagline">
          <span className="firetext">DIALECTICAL DATABASE &amp; DRUG DEN</span>
          <span className="splash__tagline-alt">
            {data
              ? `${data.counts.pages.toLocaleString()} pages · ${data.counts.words.toLocaleString()} words · ${(data.counts.edges ?? 0).toLocaleString()} links · nobody asked for any of it`
              : 'the brain · the lattice · the instruments · the noise'}
          </span>
        </p>

        <button type="button" className="splash__enter" onClick={go}>
          <span className="splash__enter-label">ENTER THE VOID</span>
          <span className="splash__enter-kana jp" aria-hidden="true">
            入
          </span>
        </button>

        <span className="splash__hint">
          click, or hit ENTER / SPACE
        </span>
      </div>
    </div>
  )
}
