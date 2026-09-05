import { Link, useParams } from 'react-router-dom'
import { Nav } from '../components/Nav'
import { SectionArt } from '../components/SectionArt'
import { CABS, PLAQUE, PRIZES, cabById } from '../arcade/content'
import { Alu08 } from '../arcade/cabs/Alu08'
import { Courtship } from '../arcade/cabs/Courtship'
import { WaterSigns } from '../arcade/cabs/WaterSigns'
import { Yarn } from '../arcade/cabs/Yarn'
import { Prizes } from '../arcade/Prizes'
import { useArcade } from '../arcade/state'
import { sectionBySlug } from '../content/sections'
import './arcade.css'

const section = sectionBySlug('arcade')!

const BOARDS: Record<string, () => React.ReactElement> = {
  'alu-08': Alu08,
  yarn: Yarn,
  courtship: Courtship,
  'water-signs': WaterSigns,
}

/**
 * ALLY LUBIN'S ADVENTURE ARCADE
 *
 * The room used to be a door with scaffolding behind it. It is now the only
 * wing of this building addressed to one named person — which makes it the
 * one room where the house rule about leaving the contradictions in does not
 * apply, because she is a person and not a page.
 */
export function ArcadeRoute() {
  const { cab } = useParams()

  if (cab === 'prizes')
    return (
      <Floor>
        <Prizes />
      </Floor>
    )

  if (cab) {
    const entry = cabById(cab)
    const Board = entry ? BOARDS[entry.id] : undefined
    if (!entry || !Board)
      return (
        <Floor>
          <div className="wrap arc__missing">
            <h2>NO SUCH CABINET</h2>
            <p>That machine is not on this floor. It may be in the back with the others.</p>
            <Link to="/arcade" className="arc-btn">
              ← BACK TO THE FLOOR
            </Link>
          </div>
        </Floor>
      )
    return (
      <Floor>
        <div className="wrap arc__stage">
          <Board />
        </div>
      </Floor>
    )
  }

  return (
    <Floor>
      <Lobby />
    </Floor>
  )
}

/* ==========================================================================
   THE LOBBY
   ========================================================================== */

function Lobby() {
  const { purse } = useArcade()
  const played = CABS.filter((c) => (purse.best[c.id] ?? 0) > 0).length

  return (
    <>
      <header className="arc__mast">
        <div className="arc__sign">
          <span className="arc__sign-est">EST. 2008 · ONE PLAYER ONLY</span>
          <h1 className="arc__sign-name">
            <span className="arc__sign-line arc__sign-line--sm">ALLY LUBIN’S</span>
            <span className="arc__sign-line arc__sign-line--lg">ADVENTURE</span>
            <span className="arc__sign-line arc__sign-line--md">ARCADE</span>
          </h1>
          <span className="arc__sign-kana jp" aria-hidden="true">
            遊戯場
          </span>
          <span className="arc__bulbs" aria-hidden="true">
            {Array.from({ length: 28 }, (_, i) => (
              <i key={i} style={{ animationDelay: `${(i % 7) * 0.14}s` }} />
            ))}
          </span>
        </div>

        <div className="wrap arc__intro">
          <p className="arc__lede">
            The arcade was the last dark door in this building. It is now named after the only
            person who has ever read the whole wiki — four thousand words about herself, at 2 AM,
            and then came back the next morning with notes.
          </p>
          <p className="arc__meta">
            <span>{CABS.length} CABINETS</span>
            <span>{played} PLAYED</span>
            <span>{purse.tickets} TICKETS</span>
            <span>
              {purse.prizes.length}/{PRIZES.length} ON THE SHELF
            </span>
          </p>
        </div>
      </header>

      <ol className="wrap arc__row">
        {CABS.map((c) => (
          <li key={c.id}>
            <Link to={`/arcade/${c.id}`} className={`arc-unit arc-unit--${c.hue}`}>
              <span className="arc-unit__head">
                <span className="arc-unit__numeral" aria-hidden="true">
                  {c.numeral}
                </span>
                <span className="arc-unit__kana jp" aria-hidden="true">
                  {c.kana}
                </span>
              </span>
              <span className="arc-unit__screen">
                <UnitArt id={c.id} />
              </span>
              <span className="arc-unit__plate">
                <b>{c.title}</b>
                <i>{c.sub}</i>
              </span>
              <span className="arc-unit__blurb">{c.blurb}</span>
              <span className="arc-unit__foot">
                <span className="arc-unit__best">
                  {purse.best[c.id] ? `BEST ${purse.best[c.id].toLocaleString()}` : 'NO SCORE YET'}
                </span>
                <span className="arc-unit__go">INSERT NOTHING →</span>
              </span>
            </Link>
          </li>
        ))}
      </ol>

      <section className="wrap arc__counter-link">
        <Link to="/arcade/prizes" className="arc-door">
          <span className="arc-door__tix" aria-hidden="true">
            🎟
          </span>
          <span>
            <b>THE PRIZE COUNTER</b>
            <i>
              {purse.tickets} ticket{purse.tickets === 1 ? '' : 's'} banked · {PRIZES.length} things
              on the shelf, one of them notarised
            </i>
          </span>
          <span className="arc-door__go">→</span>
        </Link>
      </section>

      <section className="wrap arc__plaque">
        <span className="arc__plaque-screws" aria-hidden="true">
          <i />
          <i />
          <i />
          <i />
        </span>
        <h2 className="arc__plaque-head">MANAGEMENT</h2>
        {PLAQUE.map((line, i) => (
          <p key={i}>{line}</p>
        ))}
        <p className="arc__plaque-sig">
          — <Link to="/brain/people/ally-lubin">the entry she was scared of</Link>, which she read
          anyway
        </p>
      </section>
    </>
  )
}

/* ==========================================================================
   CABINET ATTRACT ART — each one a still of the game behind it.
   ========================================================================== */

function UnitArt({ id }: { id: string }) {
  if (id === 'alu-08')
    return (
      <svg viewBox="0 0 160 100" aria-hidden="true">
        <rect width="160" height="100" fill="#16022a" />
        {[12, 44, 78, 112, 140].map((x, i) => (
          <g key={x}>
            <rect x={x} y={10 + i * 9} width="30" height="11" fill={i % 2 ? '#ffd400' : '#ff2bd6'} />
          </g>
        ))}
        {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
          <line key={i} x1={80 + (i - 4) * 8} y1="72" x2={i * 24 - 20} y2="100" stroke="#ff2bd6" strokeWidth="0.7" opacity="0.55" />
        ))}
        <line x1="0" y1="72" x2="160" y2="72" stroke="#ff2bd6" strokeWidth="0.7" opacity="0.5" />
        <g transform="translate(80 78)">
          <path d="M-9 -14 Q-13 -26 0 -25 Q13 -26 9 -14 L12 8 L-12 8 Z" fill="#150f14" />
          <circle cx="0" cy="-16" r="7" fill="#f2d9c8" />
          <path d="M-8 -18 Q0 -24 8 -16 Q0 -20 -8 -14 Z" fill="#150f14" />
          <path d="M-11 -6 L-24 2 M11 -6 L24 2" stroke="#f2d9c8" strokeWidth="3.4" strokeLinecap="round" />
        </g>
      </svg>
    )

  if (id === 'yarn')
    return (
      <svg viewBox="0 0 160 100" aria-hidden="true">
        <rect width="160" height="100" fill="#04141c" />
        {[0, 1, 2, 3].map((r) =>
          [0, 1, 2, 3, 4].map((c) => (
            <rect
              key={`${r}-${c}`}
              x={12 + c * 28}
              y={10 + r * 13}
              width="24"
              height="9"
              fill={['#00eaff', '#ff2bd6', '#ffd400', '#8b5cf6'][r]}
              opacity={r === 1 && c === 3 ? 0.15 : 1}
            />
          )),
        )}
        <circle cx="104" cy="74" r="5" fill="#ff2bd6" />
        <g transform="translate(56 88)">
          <ellipse cx="0" cy="0" rx="30" ry="7" fill="#141018" />
          <ellipse cx="-27" cy="-6" rx="9" ry="8" fill="#141018" />
          <path d="M-34 -12 L-36 -21 L-29 -15 Z M-22 -12 L-19 -21 L-25 -15 Z" fill="#141018" />
          <circle cx="-30" cy="-7" r="1.7" fill="#9ade63" />
          <circle cx="-24" cy="-7" r="1.7" fill="#9ade63" />
          <path d="M28 -2 Q40 -6 36 -18" stroke="#141018" strokeWidth="4" fill="none" strokeLinecap="round" />
        </g>
      </svg>
    )

  if (id === 'courtship')
    return (
      <svg viewBox="0 0 160 100" aria-hidden="true">
        <rect width="160" height="100" fill="#1a1206" />
        <rect x="10" y="12" width="86" height="15" rx="7" fill="#2c2412" stroke="#ffd400" strokeWidth="1" />
        <rect x="10" y="33" width="66" height="12" rx="6" fill="#2c2412" stroke="#ffd400" strokeWidth="1" />
        <rect x="58" y="52" width="92" height="15" rx="7" fill="#ffd400" />
        <rect x="10" y="74" width="140" height="17" rx="2" fill="#2c2412" stroke="#ffd400" strokeWidth="1" />
        <text x="16" y="86" fontFamily="'Space Mono', monospace" fontSize="8" fill="#ffd400">
          ▸ Ok PeteyxWentz
        </text>
        {[18, 26, 34, 42, 50, 58, 66].map((x) => (
          <rect key={x} x={x} y="20" width="4" height="0" fill="none" />
        ))}
      </svg>
    )

  return (
    <svg viewBox="0 0 160 100" aria-hidden="true">
      <rect width="160" height="100" fill="#0b0620" />
      {Array.from({ length: 40 }, (_, i) => (
        <circle key={i} cx={(i * 47) % 160} cy={(i * 29) % 100} r={0.5 + (i % 3) * 0.3} fill="#cfc4ff" opacity="0.5" />
      ))}
      <polyline
        points="38,22 74,40 84,56 70,74 116,62 48,62"
        fill="none"
        stroke="#a78bfa"
        strokeWidth="1"
        strokeLinejoin="round"
      />
      {[
        [38, 22], [74, 40], [84, 56], [70, 74], [116, 62], [48, 62],
      ].map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r="2.6" fill="#fff" />
      ))}
      <text x="128" y="92" fontFamily="'Space Mono', monospace" fontSize="16" fill="#c9b6ff">
        ♋
      </text>
    </svg>
  )
}

function Floor({ children }: { children: React.ReactNode }) {
  return (
    <div className="arc" style={{ ['--glow' as string]: `var(--n${section.accent})` }}>
      <Nav />
      <SectionArt slug="arcade" />
      {children}
    </div>
  )
}
