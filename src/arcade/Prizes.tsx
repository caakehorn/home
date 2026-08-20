import { Link } from 'react-router-dom'
import { useState } from 'react'
import { PRIZES, type Prize } from './content'
import { useArcade } from './state'

/**
 * THE PRIZE COUNTER
 *
 * The part of an arcade that everyone knew was a bad exchange rate and queued
 * for anyway. Tickets are only minted on a personal best, so the top shelf
 * costs something — and the top shelf is the point.
 */
export function Prizes() {
  const { purse, redeem } = useArcade()
  const [flash, setFlash] = useState<string | null>(null)

  const take = (prize: Prize) => {
    if (redeem(prize.id, prize.cost)) {
      setFlash(prize.id)
      window.setTimeout(() => setFlash(null), 1400)
    }
  }

  const held = PRIZES.filter((p) => purse.prizes.includes(p.id))

  return (
    <div className="arc-till">
      <header className="arc-till__head">
        <h2 className="arc-till__title">THE PRIZE COUNTER</h2>
        <p className="arc-till__note">
          One ticket per hundred points, every round, no exceptions and no house edge. Nothing on
          this shelf is redeemable anywhere else, and two of them are not redeemable anywhere at
          all — which has never once stopped an arcade from putting a thing behind glass.
        </p>
        <p className="arc-till__bank">
          <span>
            TICKETS <b>{purse.tickets}</b>
          </span>
          <span>
            EARNED <b>{purse.earned}</b>
          </span>
          <span>
            SHELF <b>
              {held.length}/{PRIZES.length}
            </b>
          </span>
        </p>
      </header>

      <ul className="arc-till__shelf">
        {PRIZES.map((prize) => {
          const owned = purse.prizes.includes(prize.id)
          const afford = purse.tickets >= prize.cost
          return (
            <li
              key={prize.id}
              className={`prize${owned ? ' arc-prize--owned' : ''}${flash === prize.id ? ' arc-prize--flash' : ''}`}
            >
              <div className="arc-prize__art">
                <PrizeArt art={prize.art} />
              </div>
              <div className="arc-prize__body">
                <p className="arc-prize__cost">{owned ? 'REDEEMED' : `${prize.cost} TICKETS`}</p>
                <h3 className="arc-prize__name">{prize.name}</h3>
                <p className="arc-prize__caption">{prize.caption}</p>
              </div>
              <button
                type="button"
                className={`arc-btn arc-prize__take${afford && !owned ? ' arc-btn--hot' : ''}`}
                disabled={owned || !afford}
                onClick={() => take(prize)}
              >
                {owned ? '✓ ON THE SHELF' : afford ? 'REDEEM' : `NEED ${prize.cost - purse.tickets} MORE`}
              </button>
            </li>
          )
        })}
      </ul>

      <p className="arc-till__foot">
        <Link to="/arcade" className="arc-btn">
          ← BACK TO THE FLOOR
        </Link>
      </p>
    </div>
  )
}

/* ==========================================================================
   THE ART — drawn, not sourced. Nothing in this room is a stock asset.
   ========================================================================== */

function PrizeArt({ art }: { art: Prize['art'] }) {
  if (art === 'sticker')
    return (
      <svg viewBox="0 0 120 90" aria-hidden="true">
        <defs>
          <linearGradient id="holo" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#ff2bd6" />
            <stop offset="35%" stopColor="#ffd400" />
            <stop offset="70%" stopColor="#00eaff" />
            <stop offset="100%" stopColor="#8b5cf6" />
          </linearGradient>
        </defs>
        <rect x="10" y="22" width="100" height="46" rx="4" fill="url(#holo)" transform="rotate(-4 60 45)" />
        <text
          x="60" y="52" textAnchor="middle" transform="rotate(-4 60 45)"
          fontFamily="'Space Mono', monospace" fontWeight="700" fontSize="22" fill="#100c14"
        >
          aluuuu
        </text>
      </svg>
    )

  if (art === 'top8')
    return (
      <svg viewBox="0 0 120 90" aria-hidden="true">
        <rect x="6" y="8" width="108" height="74" rx="3" fill="#0d0b14" stroke="#00eaff" strokeWidth="2" />
        <text x="14" y="24" fontFamily="'Space Mono', monospace" fontSize="11" fill="#00eaff">
          TOP 8
        </text>
        <rect x="14" y="30" width="30" height="30" fill="#ff2bd6" />
        <text x="29" y="50" textAnchor="middle" fontFamily="'Space Mono', monospace" fontWeight="700" fontSize="16" fill="#0d0b14">
          1
        </text>
        {[0, 1, 2, 3].map((i) => (
          <rect key={i} x={50 + (i % 2) * 32} y={30 + ((i / 2) | 0) * 16} width="28" height="13" fill="#2a2438" />
        ))}
        <text
          x="14" y="74" textLength="92" lengthAdjust="spacingAndGlyphs"
          fontFamily="'Space Mono', monospace" fontSize="8.5" fill="#6d6880"
        >
          NO ROTATION · NON-REVOCABLE
        </text>
      </svg>
    )

  if (art === 'dunkin')
    return (
      <svg viewBox="0 0 120 90" aria-hidden="true">
        <path d="M40 22 L80 22 L74 82 L46 82 Z" fill="#f3efe6" stroke="#100c14" strokeWidth="2.5" />
        <path d="M42 40 L78 40 L74 78 L46 78 Z" fill="#5b3a24" />
        <rect x="36" y="14" width="48" height="10" rx="3" fill="#ff2bd6" stroke="#100c14" strokeWidth="2.5" />
        <rect x="46" y="4" width="6" height="12" fill="#ffd400" stroke="#100c14" strokeWidth="2" />
        <text x="60" y="60" textAnchor="middle" fontFamily="'Space Mono', monospace" fontWeight="700" fontSize="9" fill="#f3efe6">
          ICED
        </text>
        <text x="60" y="71" textAnchor="middle" fontFamily="'Space Mono', monospace" fontSize="7" fill="#e5cfa0">
          LARGE
        </text>
      </svg>
    )

  if (art === 'necklace')
    return (
      <svg viewBox="0 0 120 90" aria-hidden="true">
        <path d="M22 14 Q60 74 98 14" fill="none" stroke="#ffd400" strokeWidth="2.4" strokeDasharray="1 3.4" strokeLinecap="round" />
        {/* the bird, small, gold, on the chain */}
        <g transform="translate(60 62)">
          <ellipse cx="0" cy="0" rx="14" ry="9" fill="#ffd400" stroke="#8a6b00" strokeWidth="1.2" />
          <circle cx="-11" cy="-6" r="6" fill="#ffd400" stroke="#8a6b00" strokeWidth="1.2" />
          <path d="M-16 -7 L-22 -5 L-16 -3 Z" fill="#e08a00" />
          <circle cx="-12.5" cy="-7" r="1.3" fill="#3a2c00" />
          <path d="M-2 -3 Q6 -9 12 -1 Q5 2 -2 -3 Z" fill="#e8b400" />
          <path d="M13 1 L26 -6 L24 3 L13 4 Z" fill="#ffd400" stroke="#8a6b00" strokeWidth="1" />
        </g>
      </svg>
    )

  if (art === 'certificate')
    return (
      <svg viewBox="0 0 120 90" aria-hidden="true">
        <rect x="8" y="10" width="104" height="70" fill="#f3efe6" stroke="#100c14" strokeWidth="2.5" />
        <rect x="14" y="16" width="92" height="58" fill="none" stroke="#ff2bd6" strokeWidth="1.2" />
        <text
          x="60" y="33" textAnchor="middle" textLength="68" lengthAdjust="spacingAndGlyphs"
          fontFamily="'Space Mono', monospace" fontSize="7" fill="#6d6880"
        >
          THIS CERTIFIES THAT
        </text>
        <text
          x="60" y="47" textAnchor="middle" textLength="84" lengthAdjust="spacingAndGlyphs"
          fontFamily="'Space Mono', monospace" fontWeight="700" fontSize="11" fill="#100c14"
        >
          ALEXANDRA LUBIN
        </text>
        <text
          x="60" y="59" textAnchor="middle" textLength="86" lengthAdjust="spacingAndGlyphs"
          fontFamily="'Space Mono', monospace" fontSize="7" fill="#100c14"
        >
          IS THE OBJECT OF FIXATION
        </text>
        <text
          x="60" y="69" textAnchor="middle" textLength="80" lengthAdjust="spacingAndGlyphs"
          fontFamily="'Space Mono', monospace" fontSize="6" fill="#6d6880"
        >
          ACCEPTED 11:49 PM · 08.18.2026
        </text>
        <circle cx="99" cy="24" r="8" fill="#e01b12" opacity="0.8" />
      </svg>
    )

  return (
    <svg viewBox="0 0 120 90" aria-hidden="true">
      <rect x="8" y="24" width="104" height="42" rx="3" fill="#ffd400" stroke="#100c14" strokeWidth="2.5" />
      <line x1="80" y1="24" x2="80" y2="66" stroke="#100c14" strokeWidth="2" strokeDasharray="3 3" />
      <text x="44" y="41" textAnchor="middle" fontFamily="'Space Mono', monospace" fontWeight="700" fontSize="9" fill="#100c14">
        ONE (1)
      </text>
      <text x="44" y="53" textAnchor="middle" fontFamily="'Space Mono', monospace" fontWeight="700" fontSize="9" fill="#100c14">
        ELOPEMENT
      </text>
      <text x="96" y="41" textAnchor="middle" fontFamily="'Space Mono', monospace" fontSize="6" fill="#100c14">
        YVR
      </text>
      <text x="96" y="49" textAnchor="middle" fontFamily="'Space Mono', monospace" fontSize="6" fill="#100c14">
        BTV
      </text>
      <text x="96" y="57" textAnchor="middle" fontFamily="'Space Mono', monospace" fontSize="6" fill="#6d6880">
        DEN
      </text>
    </svg>
  )
}
