import { ATTACHED, REACTION, partyOf, splitOnTerm, type Row } from './core'

/**
 * One message, exactly as it was sent.
 *
 * The line number is the message's identity and is global to the record — the
 * same number the old repo's `#L1234` anchors used — so any single message can
 * be pointed at from anywhere and land here.
 */
export function Line({
  row,
  line,
  term = '',
  landed = false,
}: {
  row: Row
  line: number
  term?: string
  landed?: boolean
}) {
  const [ts, dir, text, flags] = row
  const party = partyOf(dir)
  const attached = (flags & ATTACHED) !== 0
  const reaction = (flags & REACTION) !== 0

  return (
    <li
      id={`L${line}`}
      className={
        `tsc__line tsc__line--${party.key}` +
        (reaction ? ' tsc__line--tap' : '') +
        (landed ? ' tsc__line--landed' : '')
      }
      style={{ ['--who' as string]: `var(--n${party.tone})` }}
    >
      <a className="tsc__ln" href={`#L${line}`} title={`link to message ${line}`}>
        {line.toLocaleString()}
      </a>
      <span className="tsc__ts">
        {ts.slice(0, 16)}
        {attached && <b className="tsc__att">ATT</b>}
      </span>
      <span className="tsc__who">{party.label}</span>
      <p className="tsc__tx">
        {splitOnTerm(text, term).map((part, i) =>
          part.hit ? <mark key={i}>{part.text}</mark> : <span key={i}>{part.text}</span>,
        )}
      </p>
    </li>
  )
}
