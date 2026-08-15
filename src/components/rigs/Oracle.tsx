import { useEffect, useRef, useState } from 'react'
import { useRig } from '../../state/usePortal'
import './oracle.css'

const FORTUNES = [
  'Ship the ugly version. The pretty one is a rumour.',
  'The note you cannot find is the one you needed. Write it twice.',
  'Every good visualizer began as a bug you refused to fix.',
  'Turn it up two more. Yes, past the mark. Past that one too.',
  'The crows on the ridge have read your drafts. They are unimpressed but loyal.',
  'Delete the paragraph you are most proud of. It was load-bearing for your ego only.',
  'Somewhere in the wiki-brain, two unrelated notes are about to become one idea.',
  'Restraint is a wing of the building you do not live in.',
  'The game you keep not building is three evenings long.',
  'You are allowed to make the whole thing magenta.',
  'Archive nothing. Compost everything.',
  'The moon is up, the ramen is soft, the deploy is green. Go outside anyway.',
]

const CAPSULE_COLORS = ['--n1', '--n2', '--n3', '--n4', '--n5'] as const

type Phase = 'idle' | 'cranking' | 'open'

export function Oracle() {
  const poke = useRig('ORACLE')
  const [phase, setPhase] = useState<Phase>('idle')
  const [turns, setTurns] = useState(0)
  const [fortune, setFortune] = useState<string | null>(null)
  const [serial, setSerial] = useState(0)
  const timers = useRef<number[]>([])

  useEffect(() => () => timers.current.forEach(window.clearTimeout), [])

  const pull = () => {
    if (phase === 'cranking') return
    poke()
    setPhase('cranking')
    setTurns((t) => t + 1)
    setFortune(null)
    timers.current.push(
      window.setTimeout(() => {
        setFortune(FORTUNES[Math.floor(Math.random() * FORTUNES.length)])
        setSerial(Math.floor(Math.random() * 8999) + 1000)
        setPhase('open')
      }, 1150),
    )
  }

  return (
    <div className="oracle">
      <div className={`oracle__machine oracle__machine--${phase}`}>
        <div className="oracle__dome" aria-hidden="true">
          {Array.from({ length: 16 }, (_, i) => (
            <span
              key={i}
              className="oracle__ball"
              style={{
                background: `var(${CAPSULE_COLORS[i % CAPSULE_COLORS.length]})`,
                left: `${8 + ((i * 29) % 78)}%`,
                bottom: `${4 + ((i * 41) % 52)}%`,
                animationDelay: `${(i % 7) * 0.11}s`,
              }}
            />
          ))}
          <span className="oracle__glare" />
        </div>

        <div className="oracle__body">
          <span className="oracle__plate jp" aria-hidden="true">
            御神籤
          </span>
          <button
            type="button"
            className="oracle__crank"
            onClick={pull}
            aria-label="Pull the oracle lever for a fortune"
            style={{ ['--turns' as string]: turns }}
          >
            <span className="oracle__crank-arm" aria-hidden="true" />
            <span className="oracle__crank-hub" aria-hidden="true" />
          </button>
          <span className="oracle__chute" aria-hidden="true">
            <span className="oracle__capsule" />
          </span>
        </div>
      </div>

      <div className="oracle__slip" aria-live="polite">
        {fortune ? (
          <div className="oracle__receipt" key={serial}>
            <span className="oracle__receipt-head">
              薬窟 · LOT #{serial}
            </span>
            <p className="oracle__receipt-body">{fortune}</p>
            <span className="oracle__receipt-foot">NO REFUNDS · NO REDEALS · PULL AGAIN</span>
            <span className="oracle__receipt-tear" aria-hidden="true" />
          </div>
        ) : (
          <div className="oracle__blank">
            <span className="oracle__blank-head">薬窟 · LOT #————</span>
            <p className="oracle__idle">
              {phase === 'cranking'
                ? 'CLUNK… rattle… rattle…'
                : 'Pull the lever. One capsule, one verdict.'}
            </p>
            <span className="oracle__blank-foot">NO REFUNDS · NO REDEALS</span>
          </div>
        )}
      </div>
    </div>
  )
}
