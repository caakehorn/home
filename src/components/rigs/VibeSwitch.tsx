import { VIBES } from '../../state/portal-context'
import { usePortal, useRig } from '../../state/usePortal'
import './vibe-switch.css'

export function VibeSwitch() {
  const { vibe, setVibe } = usePortal()
  const poke = useRig('VIBE SWITCH')

  return (
    <div className="vibes">
      <div className="vibes__grid" role="radiogroup" aria-label="Colour palette">
        {VIBES.map((option, i) => {
          const active = option.id === vibe
          return (
            <button
              key={option.id}
              type="button"
              role="radio"
              aria-checked={active}
              className={`vibe${active ? ' vibe--on' : ''}`}
              style={{ ['--rot' as string]: `${(i % 2 ? 1 : -1) * 1.6}deg` }}
              onClick={() => {
                setVibe(option.id)
                poke()
              }}
            >
              <span className="vibe__swatches" aria-hidden="true">
                {option.swatch.map((hex) => (
                  <span key={hex} className="vibe__chip" style={{ background: hex }} />
                ))}
              </span>
              <span className="vibe__kana jp" aria-hidden="true">
                {option.kana}
              </span>
              <span className="vibe__name">{option.name}</span>
              <span className="vibe__blurb">{option.blurb}</span>
              <span className="vibe__state" aria-hidden="true">
                {active ? '● LIVE' : '○ LOAD'}
              </span>
            </button>
          )
        })}
      </div>
      <p className="vibes__note">
        Six palettes: one raw canvas, one photocopier, four rooms with the lights on. The whole
        site repaints — every panel, every glow, the canvas, the cursor.
      </p>
    </div>
  )
}
