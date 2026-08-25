import { VIBES } from '../state/portal-context'
import { usePortal } from '../state/usePortal'
import './hud.css'

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
    </aside>
  )
}
