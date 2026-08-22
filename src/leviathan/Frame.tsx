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
 *
 * The last line of the frame is THE RULE, and it is an assertion about the page
 * it sits on: every number above it is a count. A SCORED instrument is one the
 * house published anyway, knowing it is not — so on those the assertion would
 * be a lie, and the frame prints the declaration instead. The footer says which
 * kind of page this is either way; what it must never do is claim the wrong
 * one.
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
        {instrument.status === 'SCORED' ? (
          <p className="inst__rule inst__rule--scored">
            <b>THIS INSTRUMENT BREAKS THE RULE.</b> Every other instrument here is a count. This one
            is a classification: somebody decided what each record was and sorted it into a
            category, and the categories are not in the corpus — they were brought to it.{' '}
            {instrument.bars} It is drawn anyway, with the sorting declared and its hand-audited
            precision printed beside every lane, because the alternative to publishing a judgement
            with its error rate attached is publishing one without.
          </p>
        ) : (
          <p className="inst__rule">
            No instrument here makes a judgement. Every number is a count, a date or a length, taken
            over the whole corpus with nothing excluded and nothing weighted.
          </p>
        )}
        <Link to="/leviathan" className="inst__back">
          ← BACK TO THE RACK
        </Link>
      </footer>
    </section>
  )
}
