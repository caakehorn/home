import { VIBES } from '../state/portal-context'
import { usePortal } from '../state/usePortal'
import './header-controls.css'

/**
 * The site-wide dials, in the header, on every page.
 *
 * Chaos, motion and the palette already existed as rigs on the home console,
 * but they drive every page you visit afterwards — so being able to reach them
 * only by going home was backwards. These are compact heads on the same state:
 * the console keeps the big draggable knob and the palette cards, and both
 * surfaces move together because neither owns the value.
 *
 * The chaos control is a real `<input type="range">` rather than the console's
 * bespoke knob: in a 40px-tall bar it has to be operable by keyboard, by
 * screen reader and by thumb, and the platform slider is all three for free.
 *
 * EDITION is the odd one out and rides at the front of the bar because of it.
 * The other three change how the site looks; this one changes what it says —
 * FULL is the wiki as written, READER'S DIGEST is the plain-language edition of
 * the same findings. It lives up here rather than on the page because it is a
 * standing preference about how you read, not a per-entry choice.
 */
export function HeaderControls() {
  const { vibe, setVibe, chaos, setChaos, motion, setMotion, readMode, setReadMode, headerCollapsed } =
    usePortal()
  const digest = readMode === 'digest'

  return (
    <div className={`hctl${headerCollapsed ? ' hctl--collapsed' : ''}`} aria-hidden={headerCollapsed}>
      <div className={`hctl__panel${headerCollapsed ? ' hctl__panel--collapsed' : ''}`}>
        {/* The edition switch, first in the bar because it changes what you are
            reading rather than how it looks — the other three are decoration
            and this one is the text. A two-state switch rather than a checkbox:
            both editions are real, neither is "off", and a checkbox labelled
            READER'S DIGEST leaves the unchecked state unnamed. */}
        <div className="hctl__editions" role="radiogroup" aria-label="Edition">
          <span className="hctl__label">EDITION</span>
          <button
            type="button"
            role="radio"
            aria-checked={!digest}
            className={`hctl__edition${!digest ? ' hctl__edition--on' : ''}`}
            onClick={() => setReadMode('full')}
            title="The wiki as written — every number, every citation, every falsifier"
          >
            <span className="jp" aria-hidden="true">全</span>
            FULL
          </button>
          <button
            type="button"
            role="radio"
            aria-checked={digest}
            className={`hctl__edition${digest ? ' hctl__edition--on' : ''}`}
            onClick={() => setReadMode('digest')}
            title="Reader's Digest — the same findings in plain English, for a reader who has never been here before"
          >
            <span className="jp" aria-hidden="true">要</span>
            READER'S DIGEST
          </button>
        </div>

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

        {/* Shows its state in the label rather than only in the pressed styling —
            someone looking for why nothing is moving is scanning for the word,
            and a dim outline is not an answer. */}
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
    </div>
  )
}
