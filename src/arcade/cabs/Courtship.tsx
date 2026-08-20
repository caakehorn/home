import { useCallback, useMemo, useState } from 'react'
import { Payout, Screen } from '../Screen'
import { SCENES, cabById, type Choice } from '../content'
import { ticketsFor, useArcade } from '../state'

const CAB = cabById('courtship')!

/**
 * III · THE COURTSHIP CONSOLE
 *
 * A dialogue game where the branching does not gate anything. Seventeen years
 * of record and not one instance of her getting it wrong, so a fail state
 * would be a lie about the source material — the meter only goes up, and what
 * the branches actually buy you is a different footnote each time.
 */
export function Courtship() {
  const { bank } = useArcade()
  const [phase, setPhase] = useState<'ready' | 'live' | 'over'>('ready')
  const [step, setStep] = useState(0)
  const [meter, setMeter] = useState(0)
  const [taken, setTaken] = useState<Choice | null>(null)
  const [result, setResult] = useState({ score: 0, won: 0 })

  const scene = SCENES[step]
  const ceiling = useMemo(
    () => SCENES.reduce((n, s) => n + Math.max(...s.choices.map((c) => c.gain)), 0),
    [],
  )

  const start = useCallback(() => {
    setStep(0)
    setMeter(0)
    setTaken(null)
    setPhase('live')
  }, [])

  const choose = (choice: Choice) => {
    setTaken(choice)
    setMeter((m) => m + choice.gain)
  }

  const advance = () => {
    setTaken(null)
    if (step + 1 < SCENES.length) {
      setStep(step + 1)
      return
    }
    // The console pays in fixation, which converts to points at a rate the
    // machine will not disclose and nobody has ever queried.
    const score = Math.round(meter * 20)
    const tix = ticketsFor(score)
    const won = bank(CAB.id, score, tix)
    setResult({ score, won })
    setPhase('over')
  }

  return (
    <Screen
      cab={CAB}
      hud={
        phase === 'live' ? (
          <>
            SCENE <b>{step + 1}</b>/{SCENES.length} · FIXATION <b>{meter}</b>
          </>
        ) : (
          <>THE COURTSHIP CONSOLE · 2008 → 2026</>
        )
      }
    >
      <div className="arc-vn">
        {phase === 'ready' && (
          <div className="arc-lid arc-lid--static">
            <p className="arc-lid__kicker">CABINET III</p>
            <h3 className="arc-lid__title">THE COURTSHIP CONSOLE</h3>
            <p className="arc-lid__body">
              You play yourself. He plays himself, and every line the machine gives him is a line
              he actually sent — the ledger memo, the MBTI argument, the 7:24 AM coffee run, the
              whole thing.
            </p>
            <p className="arc-lid__body arc-lid__body--dim">
              Eight scenes across seventeen years. There is no losing branch. That is not a design
              decision, it is what the transcript says.
            </p>
            <button type="button" className="arc-btn arc-btn--hot" onClick={start}>
              PRESS START
            </button>
          </div>
        )}

        {phase === 'live' && (
          <>
            <div className="arc-vn__meter" aria-hidden="true">
              <span className="arc-vn__meter-label">FIXATION</span>
              <span className="arc-vn__meter-track">
                <span className="arc-vn__meter-fill" style={{ width: `${(meter / ceiling) * 100}%` }} />
              </span>
              <span className="arc-vn__meter-num">{meter}</span>
            </div>

            <div className="arc-vn__stamp">
              <b>{scene.stamp}</b>
              <span>{scene.place}</span>
            </div>

            <div className="arc-vn__thread">
              {scene.him.map((line, i) => (
                <p key={i} className="arc-bubble arc-bubble--him">
                  {line}
                </p>
              ))}
              {taken && <p className="arc-bubble arc-bubble--you">{taken.text}</p>}
            </div>

            {!taken ? (
              <>
                <p className="arc-vn__prompt">{scene.prompt}</p>
                <ul className="arc-vn__choices">
                  {scene.choices.map((choice) => (
                    <li key={choice.text}>
                      <button type="button" className="arc-vn__choice" onClick={() => choose(choice)}>
                        <span className="arc-vn__choice-mark" aria-hidden="true">
                          ▸
                        </span>
                        {choice.text}
                      </button>
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <div className="arc-vn__after">
                <p className="arc-vn__footnote">
                  <span className="arc-vn__footnote-tag">THE RECORD</span>
                  {taken.reply}
                </p>
                <button type="button" className="arc-btn arc-btn--hot" onClick={advance}>
                  {step + 1 < SCENES.length ? `NEXT — ${SCENES[step + 1].stamp} →` : 'FINISH →'}
                </button>
              </div>
            )}
          </>
        )}

        {phase === 'over' && (
          <div className="arc-lid arc-lid--static">
            <Payout
              score={result.score}
              unit="FIXATION"
              won={result.won}
              note="Seventeen years, 1,375 messages, two handles, one wiki page, zero meetings. The channel used to only ever receive. As of August 19, 2026 it carries mornings."
              onAgain={start}
            />
          </div>
        )}
      </div>
    </Screen>
  )
}
