import { VIBES } from '../state/portal-context'
import { usePortal } from '../state/usePortal'
import './hud.css'

/**
 * One dial position is a date.
 *
 * 6.26 out of 11 is not reachable by dragging the knob — the dial rounds to a
 * tenth — so this only ever fires for somebody who went to the shell and typed
 * `chaos 6.26`, which is a thing you only type if you already know what the
 * number is. That is the whole test.
 */
const BIRTHDAY = (chaos: number) => Math.abs(chaos * 11 - 6.26) < 0.005

/** Corner telemetry. Also the honest count of live interactive rigs. */
export function Hud() {
  const { vibe, chaos, rigs, lastPoked } = usePortal()
  const current = VIBES.find((v) => v.id === vibe)

  return (
    <aside className="hud" aria-label="Portal telemetry">
      <span className="hud__row">
        <b>VIBE</b> {current?.name}
      </span>
      <span className="hud__row">
        <b>CHAOS</b>
        <span className="hud__meter" aria-hidden="true">
          <span className="hud__meter-fill" style={{ width: `${chaos * 100}%` }} />
        </span>
        {(chaos * 11).toFixed(1)}
      </span>
      <span className="hud__row">
        <b>RIGS</b> {rigs.length} ONLINE
      </span>
      <span className="hud__row hud__row--dim">
        <b>LAST</b> {lastPoked ?? '—'}
      </span>
      {BIRTHDAY(chaos) && (
        <span className="hud__row hud__row--found">
          <b>26.06</b> CARDINAL WATER
        </span>
      )}
    </aside>
  )
}
