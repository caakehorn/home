import { useMemo, useState } from 'react'
import { useWidth } from '../wiki/useWidth'
import {
  DESCENT,
  LINES,
  PEOPLE,
  descentPath,
  dnaShare,
  fractionLabel,
  shareLabel,
  type LineId,
  type Person,
} from './data'
import './lattice.css'

/**
 * The lattice.
 *
 * Vertical position is the real birth year, not the generation index — so the
 * pedigree doubles as a timeline, the gaps between generations are true, and
 * the point where the paper record stops is something you can see rather than
 * something you have to be told. Horizontal position is which line you are on:
 * paternal to the left, maternal to the right, fanning as it goes back.
 *
 * Size carries autosomal share, halving every generation. Colour is state,
 * never identity — one accent, brighter for the descent chain under the
 * cursor, receding for anything filtered out. Five lines in five hues would
 * be prettier and would say less.
 */

const TOP_YEAR = 1775
const BASE_YEAR = 2002

type Placed = Person & { x: number; y: number; r: number; share: number | null }

export function Lattice({
  selected,
  onSelect,
  activeLines,
  showCollateral,
  depth,
}: {
  selected: string | null
  onSelect: (id: string | null) => void
  activeLines: Set<LineId>
  showCollateral: boolean
  depth: number
}) {
  const [wrapRef, width] = useWidth<HTMLDivElement>(900, 320)
  const [hover, setHover] = useState<string | null>(null)

  // Tall enough that six generations of labels never crowd each other.
  const height = Math.round(Math.min(1180, Math.max(720, width * 0.95)))
  const pad = { top: 64, bottom: 92, left: 16, right: 16 }

  const placed = useMemo<Placed[]>(() => {
    const plotH = height - pad.top - pad.bottom
    const lane = (width - pad.left - pad.right) / 10
    const cx = width / 2

    return PEOPLE.filter((p) => p.gen <= depth)
      .filter((p) => showCollateral || !p.collateral)
      .map((p) => {
        const line = LINES.find((l) => l.id === p.line)!
        // Undated people sit at the midpoint of their generation's span.
        const year = p.born ?? TOP_YEAR + (BASE_YEAR - TOP_YEAR) * (1 - p.gen / 7) - 18
        const t = (BASE_YEAR - year) / (BASE_YEAR - TOP_YEAR)
        const y = pad.top + t * plotH
        // lanes fan outward with depth; the slot separates spouse pairs that
        // would otherwise land on the same lane within a year or two
        const spread = 1 + p.gen * 0.13
        const x = cx + (line.lane * spread + (p.slot ?? 0)) * lane
        const share = dnaShare(p)
        const r = p.id === 'dan' ? 20 : share === null ? 7 : 9 + Math.sqrt(share) * 20
        return { ...p, x, y, r, share }
      })
  }, [width, height, depth, showCollateral, pad.top, pad.bottom, pad.left, pad.right])

  const byId = useMemo(() => new Map(placed.map((p) => [p.id, p])), [placed])
  const focus = hover ?? selected
  const chain = useMemo(() => new Set(focus ? descentPath(focus) : []), [focus])

  const dimmed = (p: Person) => !activeLines.has(p.line) && p.line !== 'core'

  const yearTicks = [1800, 1850, 1900, 1950, 2000]
  const yearY = (year: number) => {
    const plotH = height - pad.top - pad.bottom
    return pad.top + ((BASE_YEAR - year) / (BASE_YEAR - TOP_YEAR)) * plotH
  }

  // The Atlantic rule: everything above it was born outside the United States.
  const crossers = placed.filter((p) => p.crossed)

  return (
    <div className="lat" ref={wrapRef}>
      <svg
        className="lat__svg"
        width={width}
        height={height}
        role="application"
        aria-label="Family lattice. Vertical position is birth year, horizontal position is ancestral line."
        onClick={() => onSelect(null)}
      >
        <defs>
          <filter id="lat-void">
            <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="3" seed="11" result="n" />
            <feDisplacementMap in="SourceGraphic" in2="n" scale="6" />
          </filter>
        </defs>

        {/* year rules */}
        {yearTicks.map((year) => (
          <g key={year}>
            <line className="lat__rule" x1={0} x2={width} y1={yearY(year)} y2={yearY(year)} />
            <text className="lat__year" x={6} y={yearY(year) - 5}>
              {year}
            </text>
          </g>
        ))}

        {/* descent edges */}
        {placed.map((p) => {
          const parentId = DESCENT[p.id]
          const child = parentId ? byId.get(parentId) : null
          if (!child) return null
          const lit = chain.has(p.id) && chain.has(child.id)
          const mid = (p.y + child.y) / 2
          return (
            <path
              key={`e-${p.id}`}
              className={`lat__edge${lit ? ' lat__edge--lit' : ''}${dimmed(p) ? ' lat__edge--dim' : ''}`}
              d={`M${p.x},${p.y} C${p.x},${mid} ${child.x},${mid} ${child.x},${child.y}`}
            />
          )
        })}

        {/* nodes */}
        {placed.map((p) => {
          const lit = chain.has(p.id)
          const isVoid = p.documented === false
          return (
            <g
              key={p.id}
              className={`lat__node${lit ? ' lat__node--lit' : ''}${dimmed(p) ? ' lat__node--dim' : ''}${
                selected === p.id ? ' lat__node--on' : ''
              }`}
              transform={`translate(${p.x},${p.y})`}
              tabIndex={0}
              role="button"
              aria-label={`${p.name}${p.bornLabel ? `, born ${p.bornLabel}` : ''}${
                p.share ? `, ${shareLabel(p.share)} of Dan's DNA` : ''
              }`}
              onPointerEnter={() => setHover(p.id)}
              onPointerLeave={() => setHover(null)}
              onFocus={() => setHover(p.id)}
              onBlur={() => setHover(null)}
              onClick={(e) => {
                e.stopPropagation()
                onSelect(selected === p.id ? null : p.id)
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  onSelect(selected === p.id ? null : p.id)
                }
              }}
            >
              {/* the share ring: how much of Dan this person is */}
              {p.share !== null && (
                <circle className="lat__ring" r={p.r + 5} pathLength={100} strokeDasharray={`${p.share * 100} 100`} />
              )}
              <circle
                className={`lat__dot${isVoid ? ' lat__dot--void' : ''}${p.id === 'dan' ? ' lat__dot--root' : ''}`}
                r={p.r}
                filter={isVoid ? 'url(#lat-void)' : undefined}
              />
              {p.crossed && <circle className="lat__crossed" r={p.r + 10} />}
              <text
                className={`lat__label${p.id === 'dan' ? ' lat__label--root' : ''}`}
                y={p.r + 15}
                textAnchor="middle"
              >
                {shortName(p)}
              </text>
              {p.born && (
                <text className="lat__born" y={p.r + 27} textAnchor="middle">
                  {p.born}
                  {p.died ? `–${p.died}` : ''}
                </text>
              )}
            </g>
          )
        })}

        {/* the crossing markers */}
        {crossers.map((p) => (
          <text key={`c-${p.id}`} className="lat__origin" x={p.x} y={p.y - p.r - 13} textAnchor="middle">
            ↑ {p.crossed === 'Czechoslovakia' ? 'CZECH.' : p.crossed}
          </text>
        ))}
      </svg>

      <p className="lat__legend">
        <span><b className="lat__key lat__key--ring" /> ring = share of Dan's DNA</span>
        <span><b className="lat__key lat__key--void" /> undocumented</span>
        <span><b className="lat__key lat__key--crossed" /> born outside the US</span>
        <span>hover to trace the descent · click to open the dossier</span>
      </p>
    </div>
  )
}

function shortName(p: Person) {
  if (p.short) return p.short
  const parts = p.name.replace(/"[^"]*"\s*/g, '').split(' ')
  if (parts.length <= 2) return p.name
  return `${parts[0]} ${parts[parts.length - 1]}`
}

export { fractionLabel }
