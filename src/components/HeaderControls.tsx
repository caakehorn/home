import { VIBES } from '../state/portal-context'
import { usePortal } from '../state/usePortal'
import './header-controls.css'

/**
 * The two site-wide dials, in the header, on every page.
 *
 * Both already existed as rigs on the home console, but they drive every page
 * you visit afterwards — so being able to reach them only by going home was
 * backwards. These are compact heads on the same state: the console keeps the
 * big draggable knob and the palette cards, and both surfaces move together
 * because neither owns the value.
 *
 * The chaos control is a real `<input type="range">` rather than the console's
 * bespoke knob: in a 40px-tall bar it has to be operable by keyboard, by
 * screen reader and by thumb, and the platform slider is all three for free.
 */
export function HeaderControls() {
  const { vibe, setVibe, chaos, setChaos, drawing, setDrawing, motion, setMotion } = usePortal()

  return (
    <div className="hctl">
      <label className="hctl__chaos">
        <span className="hctl__label">CHAOS</span>
        <input
          type="range"
          min={0}
          max={100}
          value={Math.round(chaos * 100)}
          onChange={(e) => setChaos(Number(e.target.value) / 100)}
          aria-label="Chaos"
          aria-valuetext={`${(chaos * 11).toFixed(1)} of 11`}
        />
        <b className="hctl__read">{(chaos * 11).toFixed(1)}</b>
      </label>

      <button
        type="button"
        className={`hctl__draw${drawing ? ' hctl__draw--on' : ''}`}
        aria-pressed={drawing}
        onClick={() => setDrawing(!drawing)}
        title="Oil stick — drag anywhere to leave a mark"
      >
        <span className="jp" aria-hidden="true">筆</span>
        DRAW
      </button>

      {/* Sits next to DRAW because it is the same kind of switch: a thing the
          reader turns on and off about how the site behaves, not a setting.
          It shows its state in the label rather than only in the pressed
          styling — someone looking for why nothing is moving is scanning for
          the word, and a dim outline is not an answer. */}
      <button
        type="button"
        className={`hctl__motion${motion ? ' hctl__motion--on' : ''}`}
        aria-pressed={motion}
        onClick={() => setMotion(!motion)}
        title={
          motion
            ? 'Motion on — the crawls run and the marquees loop'
            : "Motion off — everything holds still. Your system's Reduce Motion setting turns this off by default; this switch overrides it."
        }
      >
        <span className="jp" aria-hidden="true">動</span>
        MOTION {motion ? 'ON' : 'OFF'}
      </button>

      <div className="hctl__vibes" role="radiogroup" aria-label="Palette">
        {VIBES.map((v) => (
          <button
            key={v.id}
            type="button"
            role="radio"
            aria-checked={v.id === vibe}
            className={`hctl__vibe${v.id === vibe ? ' hctl__vibe--on' : ''}`}
            title={`${v.name} — ${v.blurb}`}
            onClick={() => setVibe(v.id)}
          >
            <span className="hctl__swatch" aria-hidden="true">
              {v.swatch.map((hex) => (
                <span key={hex} style={{ background: hex }} />
              ))}
            </span>
            <span className="hctl__vibe-name">{v.name}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
