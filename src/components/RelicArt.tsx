import { useState } from 'react'
import type { RelicArt as ArtKind } from '../content/relics'

/* ==========================================================================
   THE PLATE — a photograph if there is one, a drawing if there is not.

   ---- how a photograph gets in ------------------------------------------

   Drop a file into `public/ally/` named for the relic's id and it appears the
   next time that relic is opened. No manifest to edit, no import to add, no
   rebuild step beyond the one that copies `public/`.

   The probe is three extensions deep — .jpg, .png, .webp, in that order — and
   it only ever runs for a relic somebody has actually opened, so a folder with
   no photographs in it costs nothing on load and at most two dead requests on
   the click. The moment a .jpg is there it is one request and the fallbacks
   never fire.

   The drawing underneath is not a placeholder in the apologetic sense. It is
   the intended object until a better one exists, and the panel is designed to
   look finished with all ten of them drawn.
   ========================================================================== */

const EXTENSIONS = ['jpg', 'png', 'webp'] as const

const src = (id: string, step: number) =>
  `${import.meta.env.BASE_URL}ally/${id}.${EXTENSIONS[step]}`.replace(/\/{2,}/g, '/')

export function RelicPlate({ id, art, title }: { id: string; art: ArtKind; title: string }) {
  // -1 once every extension has 404'd: the drawing is the plate.
  const [step, setStep] = useState(0)

  if (step < 0 || step >= EXTENSIONS.length) {
    return <span className="relic__plate relic__plate--drawn">{drawing(art)}</span>
  }

  return (
    <span className="relic__plate">
      <img
        src={src(id, step)}
        alt={title}
        loading="lazy"
        decoding="async"
        onError={() => setStep((s) => (s + 1 >= EXTENSIONS.length ? -1 : s + 1))}
      />
    </span>
  )
}

/* --------------------------------------------------------------------------
   THE DRAWINGS

   One viewBox, one weight of line, `currentColor` throughout so each one
   lights with the tube its relic was assigned. Flat, stencilled, no gradients:
   these are stickers, and a sticker is cut from one sheet of vinyl.
   -------------------------------------------------------------------------- */

function drawing(art: ArtKind) {
  const common = {
    viewBox: '0 0 100 100',
    'aria-hidden': true as const,
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 4,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  }

  switch (art) {
    case 'top8':
      // a profile grid: one big slot and seven small ones
      return (
        <svg {...common}>
          <rect x="10" y="18" width="34" height="34" />
          <path d="M18 46 L27 34 L34 42 L38 38 L44 46" />
          <circle cx="34" cy="27" r="4" />
          {[0, 1, 2, 3].map((i) => (
            <rect key={i} x={52 + (i % 2) * 20} y={18 + Math.floor(i / 2) * 20} width="14" height="14" />
          ))}
          {[0, 1, 2].map((i) => (
            <rect key={`b${i}`} x={10 + i * 20} y={60} width="14" height="14" />
          ))}
          <path d="M70 62 L86 62 M70 70 L82 70 M70 78 L88 78" strokeWidth="3" />
        </svg>
      )

    case 'necklace':
      // a chain with a bird on it
      return (
        <svg {...common}>
          <path d="M22 20 C22 52 34 62 50 62 C66 62 78 52 78 20" />
          <path d="M50 62 L50 70" />
          <path d="M42 78 C42 72 46 70 50 70 C54 70 58 72 58 78 C58 84 54 88 50 88 C46 88 42 84 42 78 Z" />
          <path d="M50 70 L57 64 L54 73" strokeWidth="3" />
          <circle cx="47" cy="77" r="1.6" strokeWidth="3" />
        </svg>
      )

    case 'coffee':
      // an iced coffee, because it is not weather-dependent
      return (
        <svg {...common}>
          <path d="M32 26 L36 84 C36 88 40 90 50 90 C60 90 64 88 64 84 L68 26 Z" />
          <path d="M28 26 L72 26" />
          <path d="M50 26 L50 10" />
          <path d="M50 14 L62 6" strokeWidth="3" />
          <path d="M38 44 L62 44 M39 58 L61 58" strokeWidth="3" opacity="0.7" />
          <rect x="41" y="34" width="10" height="10" transform="rotate(14 46 39)" strokeWidth="3" />
          <rect x="52" y="50" width="10" height="10" transform="rotate(-18 57 55)" strokeWidth="3" />
        </svg>
      )

    case 'cats':
      // two of them, one broad and one narrow, on the same shelf
      return (
        <svg {...common}>
          <path d="M6 78 L94 78" />
          <path d="M16 78 C16 60 22 54 32 54 C42 54 48 60 48 78" />
          <path d="M22 56 L20 44 L30 51 M42 56 L44 44 L34 51" />
          <circle cx="27" cy="64" r="2" strokeWidth="3" />
          <circle cx="37" cy="64" r="2" strokeWidth="3" />
          <path d="M58 78 C58 64 62 58 70 58 C78 58 82 64 82 78" />
          <path d="M63 60 L61 50 L69 56 M77 60 L79 50 L71 56" />
          <circle cx="66" cy="67" r="1.8" strokeWidth="3" />
          <circle cx="74" cy="67" r="1.8" strokeWidth="3" />
          <path d="M84 78 C92 74 92 62 86 58" strokeWidth="3" />
          <path d="M12 34 L20 26 M88 34 L80 26" strokeWidth="3" opacity="0.6" />
        </svg>
      )

    case 'ledger':
      // a receipt with a torn bottom
      return (
        <svg {...common}>
          <path d="M26 10 L74 10 L74 84 L68 78 L62 84 L56 78 L50 84 L44 78 L38 84 L32 78 L26 84 Z" />
          <path d="M36 28 L64 28 M36 40 L64 40 M36 52 L56 52" strokeWidth="3" />
          <path d="M36 64 L64 64" strokeWidth="5" />
        </svg>
      )

    case 'mbti':
      // four letters' worth of boxes, one of them argued with
      return (
        <svg {...common}>
          {[0, 1, 2, 3].map((i) => (
            <rect key={i} x={10 + i * 21} y={30} width="17" height="26" />
          ))}
          <path d="M14 62 L23 74 M23 62 L14 74" strokeWidth="3" />
          <path d="M8 20 L92 20" strokeWidth="3" opacity="0.5" />
          <path d="M8 84 L92 84" strokeWidth="3" opacity="0.5" />
        </svg>
      )

    case 'star':
      // the crab: the classic upside-down Y, wired
      return (
        <svg {...common}>
          <path d="M28 18 L47 38 L55 58 L79 74 M55 58 L32 80" />
          {[
            [28, 18, 4],
            [47, 38, 3],
            [55, 58, 3.4],
            [79, 74, 3.8],
            [32, 80, 3.6],
          ].map(([x, y, r], i) => (
            <circle key={i} cx={x} cy={y} r={r} strokeWidth="3" />
          ))}
          <circle cx="43" cy="49" r="6" strokeWidth="2" strokeDasharray="3 4" />
        </svg>
      )

    case 'phone':
      // a message bubble with fourteen characters in it
      return (
        <svg {...common}>
          <path d="M14 22 L86 22 L86 66 L44 66 L26 82 L28 66 L14 66 Z" />
          <path d="M28 38 L72 38 M28 50 L58 50" strokeWidth="3" />
        </svg>
      )

    case 'ring':
      // a handshake that is also a contract
      return (
        <svg {...common}>
          <rect x="18" y="14" width="64" height="72" />
          <path d="M30 30 L70 30 M30 42 L70 42 M30 54 L54 54" strokeWidth="3" />
          <path d="M32 68 C40 62 46 74 54 68 C60 64 66 72 70 68" strokeWidth="4" />
        </svg>
      )

    case 'skate':
      // a deck, standing on its tail
      return (
        <svg {...common}>
          <path d="M50 8 C40 8 34 14 34 26 L34 74 C34 86 40 92 50 92 C60 92 66 86 66 74 L66 26 C66 14 60 8 50 8 Z" />
          <path d="M34 34 L66 34 M34 66 L66 66" strokeWidth="3" />
          <circle cx="50" cy="50" r="9" strokeWidth="3" />
          <path d="M22 26 L28 26 M72 26 L78 26 M22 74 L28 74 M72 74 L78 74" strokeWidth="3" />
        </svg>
      )
  }
}
