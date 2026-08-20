import { Link } from 'react-router-dom'
import type { ReactNode } from 'react'
import type { Cab } from './content'
import { useArcade } from './state'

/**
 * The cabinet itself: bezel, marquee card, coin slot, and the screen the game
 * is actually drawn into. Every cabinet in the room is this object with a
 * different board bolted inside it, which is how a real arcade was built too.
 */
export function Screen({
  cab,
  hud,
  children,
}: {
  cab: Cab
  hud?: ReactNode
  children: ReactNode
}) {
  const { purse } = useArcade()
  const best = purse.best[cab.id] ?? 0

  return (
    <div className={`arc-cab arc-cab--${cab.hue}`}>
      <div className="arc-cab__marquee">
        <span className="arc-cab__numeral" aria-hidden="true">
          {cab.numeral}
        </span>
        <span className="arc-cab__names">
          <b className="arc-cab__title">{cab.title}</b>
          <span className="arc-cab__sub">{cab.sub}</span>
        </span>
        <span className="arc-cab__kana jp" aria-hidden="true">
          {cab.kana}
        </span>
      </div>

      <div className="arc-cab__bezel">
        <div className="arc-cab__hud">
          <span className="arc-cab__hud-slot">{hud}</span>
          <span className="arc-cab__hud-best">
            BEST <b>{best.toLocaleString()}</b>
          </span>
          <span className="arc-cab__hud-tix">
            TICKETS <b>{purse.tickets}</b>
          </span>
        </div>
        <div className="arc-cab__glass">{children}</div>
      </div>

      <div className="arc-cab__deck">
        <p className="arc-cab__controls">{cab.controls}</p>
        <Link to="/arcade" className="arc-cab__exit">
          ← BACK TO THE FLOOR
        </Link>
      </div>
    </div>
  )
}

/** The end-of-round card every cabinet closes on. */
export function Payout({
  score,
  unit,
  won,
  note,
  onAgain,
}: {
  score: number
  unit: string
  /** Tickets actually paid into the till by this round. */
  won: number
  note: string
  onAgain: () => void
}) {
  return (
    <div className="arc-payout">
      <p className="arc-payout__head">GAME OVER</p>
      <p className="arc-payout__score">
        {score.toLocaleString()} <span>{unit}</span>
      </p>
      <p className="arc-payout__tix">
        {won} TICKET{won === 1 ? '' : 'S'} TO THE COUNTER
      </p>
      <p className="arc-payout__note">{note}</p>
      <div className="arc-payout__row">
        <button type="button" className="arc-btn arc-btn--hot" onClick={onAgain}>
          PLAY AGAIN
        </button>
        <Link to="/arcade/prizes" className="arc-btn">
          PRIZE COUNTER →
        </Link>
      </div>
    </div>
  )
}
