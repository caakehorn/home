import { useCallback, useState } from 'react'
import { Payout, Screen } from '../Screen'
import { CANCER, CANCER_EDGES, SCORPIO_LINE, VERDICT, cabById } from '../content'
import { ticketsFor, useArcade } from '../state'

const CAB = cabById('water-signs')!

/** Background field — fixed, not random, so the sky is the same sky every visit. */
const FIELD = Array.from({ length: 90 }, (_, i) => ({
  x: ((i * 37.7) % 100),
  y: ((i * 61.3) % 100),
  r: 0.18 + ((i * 13) % 7) / 22,
  d: (i % 11) * 0.37,
}))

/** Twelve offsets, fixed, so the Beehive is the same smudge every time. */
const CLUSTER: [number, number, number][] = [
  [0, 0, 0.7], [1.6, -1.1, 0.5], [-1.8, 0.9, 0.5], [0.9, 2, 0.45], [-1.2, -1.9, 0.45],
  [2.6, 1.4, 0.4], [-2.7, -0.6, 0.4], [0.3, -2.8, 0.38], [-0.6, 3.1, 0.35],
  [3.3, -1.9, 0.32], [-3.4, 2.1, 0.32], [1.9, 3.2, 0.3],
]

export function WaterSigns() {
  const { bank } = useArcade()
  const [phase, setPhase] = useState<'ready' | 'live' | 'over'>('ready')
  const [lit, setLit] = useState<number[]>([])
  const [miss, setMiss] = useState(0)
  const [result, setResult] = useState({ score: 0, won: 0 })

  const next = lit.length
  const done = next >= CANCER.length

  const start = useCallback(() => {
    setLit([])
    setMiss(0)
    setPhase('live')
  }, [])

  const tap = (i: number) => {
    if (lit.includes(i)) return
    if (i !== next) {
      setMiss((m) => m + 1)
      return
    }
    setLit((l) => [...l, i])
  }

  const finish = () => {
    // A clean wiring is worth more than a wiring that got there eventually,
    // but getting there eventually still pays. Nothing here is a fail state.
    const score = 2400 - miss * 150
    const clamped = Math.max(600, score)
    const tix = ticketsFor(clamped)
    const won = bank(CAB.id, clamped, tix)
    setResult({ score: clamped, won })
    setPhase('over')
  }

  return (
    <Screen
      cab={CAB}
      hud={
        phase === 'live' ? (
          <>
            <b>{lit.length}</b>/{CANCER.length} WIRED{miss > 0 ? ` · ${miss} MISFIRE${miss === 1 ? '' : 'S'}` : ''}
          </>
        ) : (
          <>WATER SIGNS · ♋ 23°N</>
        )
      }
    >
      <div className={`arc-sky${phase === 'over' ? ' arc-sky--done' : ''}`}>
        <svg className="arc-sky__map" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet">
          <defs>
            <radialGradient id="alu-star">
              <stop offset="0%" stopColor="#fff" />
              <stop offset="45%" stopColor="#c9b6ff" />
              <stop offset="100%" stopColor="#8b5cf6" stopOpacity="0" />
            </radialGradient>
            <filter id="alu-bloom" x="-60%" y="-60%" width="220%" height="220%">
              <feGaussianBlur stdDeviation="1.2" result="b" />
              <feMerge>
                <feMergeNode in="b" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {FIELD.map((s, i) => (
            <circle
              key={i}
              cx={s.x}
              cy={s.y}
              r={s.r}
              fill="#e8e2ff"
              opacity={0.35}
              style={{ animation: `alu-twinkle ${3 + (i % 5)}s ${s.d}s ease-in-out infinite` }}
            />
          ))}

          {CANCER_EDGES.filter(([a, b]) => lit.includes(a) && lit.includes(b)).map(([a, b]) => (
            <line
              key={`${a}-${b}`}
              x1={CANCER[a].x}
              y1={CANCER[a].y}
              x2={CANCER[b].x}
              y2={CANCER[b].y}
              stroke="#a78bfa"
              strokeWidth={0.45}
              strokeLinecap="round"
              filter="url(#alu-bloom)"
            />
          ))}

          {CANCER.map((star, i) => {
            const on = lit.includes(i)
            const isNext = phase === 'live' && i === next
            return (
              <g
                key={star.name}
                className={`arc-sky__star${on ? ' arc-sky__star--on' : ''}${isNext ? ' arc-sky__star--next' : ''}`}
                onClick={() => phase === 'live' && tap(i)}
                role={phase === 'live' ? 'button' : undefined}
                tabIndex={phase === 'live' && !on ? 0 : -1}
                onKeyDown={(e) => {
                  if (phase === 'live' && (e.key === 'Enter' || e.key === ' ')) {
                    e.preventDefault()
                    tap(i)
                  }
                }}
              >
                <circle cx={star.x} cy={star.y} r={5} fill="transparent" />
                {on && <circle cx={star.x} cy={star.y} r={star.mag * 1.5} fill="url(#alu-star)" opacity={0.8} />}
                {on && star.name.startsWith('Praesepe') ? (
                  // the Beehive: not one star, and it should not draw as one
                  CLUSTER.map((c, n) => (
                    <circle key={n} cx={star.x + c[0]} cy={star.y + c[1]} r={c[2]} fill="#fff" opacity={0.9} />
                  ))
                ) : (
                  <circle
                    cx={star.x}
                    cy={star.y}
                    r={on ? star.mag * 0.5 : 1}
                    fill={on ? '#fff' : '#6d5fa8'}
                    filter={on ? 'url(#alu-bloom)' : undefined}
                  />
                )}
                {phase === 'live' && !on && (
                  <text className="arc-sky__num" x={star.x} y={star.y - 3.2} textAnchor="middle">
                    {i + 1}
                  </text>
                )}
              </g>
            )
          })}
        </svg>

        {phase === 'live' && (
          <div className="arc-sky__log">
            <p className="arc-sky__log-head">
              {done ? 'CANCER · WIRED' : `WIRE STAR ${next + 1} OF ${CANCER.length}`}
            </p>
            <ul className="arc-sky__facts">
              {lit.map((i) => (
                <li key={i}>
                  <b>{CANCER[i].name}</b>
                  <span>{CANCER[i].fact}</span>
                </li>
              ))}
            </ul>
            {done && (
              <button type="button" className="arc-btn arc-btn--hot" onClick={finish}>
                READ THE CHART →
              </button>
            )}
          </div>
        )}

        {phase === 'ready' && (
          <div className="arc-lid arc-lid--static">
            <p className="arc-lid__kicker">CABINET IV</p>
            <h3 className="arc-lid__title">WATER SIGNS</h3>
            <p className="arc-lid__body">
              Cancer is one of the faintest constellations in the sky and nobody can find it without
              being told where to look. Six stars, numbered. Wire them in order and each one hands
              back something the record already knew about you.
            </p>
            <button type="button" className="arc-btn arc-btn--hot" onClick={start}>
              PRESS START
            </button>
          </div>
        )}

        {phase === 'over' && (
          <div className="arc-read">
            <p className="arc-read__kicker">THE READING</p>
            <div className="arc-read__glyphs" aria-hidden="true">
              <span className="arc-read__glyph">♋</span>
              <span className="arc-read__vs">×</span>
              <span className="arc-read__glyph arc-read__glyph--alt">♏</span>
            </div>
            <p className="arc-read__stamp">
              {SCORPIO_LINE.stamp} — <b>ALLY:</b> “{SCORPIO_LINE.ally}” <b>DAN:</b> “{SCORPIO_LINE.dan}”
            </p>
            <ul className="arc-read__rows">
              {VERDICT.map((v) => (
                <li key={v.head}>
                  <b>{v.head}</b>
                  <span>{v.body}</span>
                </li>
              ))}
            </ul>
            <Payout
              score={result.score}
              unit="ARC MINUTES"
              won={result.won}
              note="June 26, 1990, Boca Raton. November 1, Pennsylvania. Four months and one element apart."
              onAgain={start}
            />
          </div>
        )}
      </div>
    </Screen>
  )
}
