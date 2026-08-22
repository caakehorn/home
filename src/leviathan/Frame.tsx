import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import type { Instrument } from './core'
import './frame.css'
import './parts.css'

/**
 * The chrome every instrument wears.
 *
 * In the old site each page drew its own header and each one drifted. Here the
 * frame is the contract: a numeral, a name, what it was computed over, and —
 * always, never optional — how. An instrument that cannot say how it got its
 * numbers has no business being read.
 */
export function Frame({
  instrument,
  controls,
  children,
  footer,
}: {
  instrument: Instrument
  controls?: ReactNode
  children: ReactNode
  footer?: ReactNode
}) {
  return (
    <section className="inst">
      <header className="inst__head">
        <span className="inst__numeral" aria-hidden="true">
          {instrument.numeral}
        </span>
        <div className="inst__id">
          <h1 className="inst__title">
            {instrument.title}
            <span className="jp inst__kana" aria-hidden="true">
              {instrument.kana}
            </span>
          </h1>
          <p className="inst__corpus">{instrument.corpus}</p>
        </div>
        {controls && <div className="inst__controls">{controls}</div>}
      </header>

      <div className="inst__body">{children}</div>

      <footer className="inst__foot">
        <p className="inst__method">
          <b>METHOD</b> {instrument.method}
        </p>
        {footer}
        {/* THE RULE, unless the instrument has something more exact to say in
            its place — see `Instrument.rule`. An instrument that does make a
            judgement printing the boilerplate anyway would be the one lie the
            wing cannot afford. */}
        <p className={`inst__rule${instrument.rule ? ' inst__rule--own' : ''}`}>
          {instrument.rule ??
            'No instrument here makes a judgement. Every number is a count, a date or a length, taken over the whole corpus with nothing excluded and nothing weighted.'}
        </p>
        <Link to="/leviathan" className="inst__back">
          ← BACK TO THE RACK
        </Link>
      </footer>
    </section>
  )
}
