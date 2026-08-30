/**
 * The small pieces every screen in the ledger renders, and the reason they are
 * components rather than string interpolation.
 *
 * `project.ts` is careful to distinguish a quantity that is known from one that
 * is bounded, and `analyze.ts` is careful to carry the denominator of every
 * mean. All of that care is undone by one screen that prints `2.3 g` where the
 * data said "at most 2.3 g". So the distinction is a component: `<Bound>` takes
 * the tally and cannot render a bare figure when the bound is loose, because
 * the branch is inside it rather than at nine call sites.
 *
 * Same for `<Blank>` — a null from `analyze.ts` means "the log cannot answer
 * this", and it renders as an em dash with the reason on hover rather than as
 * `0`, `NaN`, or a hopeful zero.
 */

import { instant } from './events.ts'
import { duration } from './analyze.ts'
import { format, quantity as withUnit } from './uom.ts'
import type { Tally } from './project.ts'

/** A figure the log knows exactly. */
export const Amount = ({ value, uom }: { value: number; uom: string }) => (
  <span className="lg__amount">{withUnit(value, uom)}</span>
)

/**
 * A figure the log knows only as a ceiling.
 *
 * The `≤` is not decoration. While an unquantified event stands against a unit,
 * the material left is at most the subtraction — those events took an unknown
 * positive amount — and a screen that drops the sign is asserting something the
 * projection deliberately refused to.
 */
export function Bound({ value, uom, exact }: { value: number; uom: string; exact: boolean }) {
  if (exact) return <Amount value={value} uom={uom} />
  return (
    <span className="lg__amount lg__amount--bound" title="an upper bound: unquantified events took an unknown amount">
      <span aria-hidden="true">≤ </span>
      <span className="lg__sr">at most </span>
      {withUnit(value, uom)}
    </span>
  )
}

/** What the log cannot answer, and why. Never a zero standing in for a null. */
export const Blank = ({ why }: { why: string }) => (
  <span className="lg__blank" title={why}>
    —
  </span>
)

export function Figure({
  value,
  uom,
  why,
  places,
}: {
  value: number | null
  uom?: string
  why: string
  places?: number
}) {
  if (value === null || !Number.isFinite(value)) return <Blank why={why} />
  if (uom) return <Amount value={value} uom={uom} />
  return <span className="lg__amount">{places === undefined ? value : value.toFixed(places)}</span>
}

export const Span = ({ ms, why = 'no interval to measure' }: { ms: number | null; why?: string }) =>
  ms === null || !Number.isFinite(ms) ? <Blank why={why} /> : <span className="lg__amount">{duration(ms)}</span>

// ---------------------------------------------------------------------------
// instants

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/**
 * An instant printed in the clock it was recorded on, not the reader's.
 *
 * The offset was kept in the log precisely so that four in the morning stays
 * four in the morning when the same record is read in another timezone six
 * months later. Reformatting through `Date` would undo that, so the string is
 * sliced instead.
 */
export function when(iso: string, withDate = true): string {
  const time = iso.slice(11, 16)
  if (!withDate) return time
  const [y, m, d] = iso.slice(0, 10).split('-')
  const year = new Date().getFullYear() === Number(y) ? '' : ` ${y}`
  return `${MONTHS[Number(m) - 1]} ${Number(d)}${year} · ${time}`
}

export const Instant = ({ iso, dateless }: { iso: string; dateless?: boolean }) => (
  <time className="lg__when" dateTime={iso}>
    {when(iso, !dateless)}
  </time>
)

/** "4h 12m ago", or "just now" under a minute. */
export function since(iso: string, now = Date.now()): string {
  const ms = now - instant(iso)
  if (ms < 60_000) return 'just now'
  return `${duration(ms)} ago`
}

// ---------------------------------------------------------------------------
// the measurement classes

/**
 * How well a quantity is known, said in words and in shape rather than colour.
 *
 * Two of the five palettes collapse the accent ramp — `griptape` has
 * `--n1 === --n5`, `riot` has two collisions and inverts the ground — so three
 * classes distinguished only by hue would be two classes in two of five themes.
 * The border style carries it instead: solid, dashed, dotted.
 */
export function Class({ measurement, confidence }: { measurement: string; confidence?: string | null }) {
  const label =
    measurement === 'measured'
      ? 'MEASURED'
      : measurement === 'estimated'
        ? `EST${confidence ? ` · ${confidence.toUpperCase()}` : ''}`
        : 'NO FIGURE'
  return <span className={`lg__class lg__class--${measurement}`}>{label}</span>
}

/** The tally, as the one line that says how much of a unit the log can speak for. */
export function Coverage({ tally }: { tally: Tally }) {
  const percent = Math.round(tally.coverage * 100)
  return (
    <span className="lg__coverage" title="quantified intake as a share of the unit">
      <span className="lg__coverage-bar" aria-hidden="true">
        <span className="lg__coverage-fill" style={{ width: `${Math.min(100, percent)}%` }} />
      </span>
      {percent}% accounted for
    </span>
  )
}

export const pluralise = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`

export { format }
