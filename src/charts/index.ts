/**
 * The chart kit — `docs/CHARTS.md` §2, the `foundation` lane.
 *
 * "One primitive, and it refuses rather than warns: a unit per series or it
 * does not draw; the `n` printed on every rate; a method note in the frame the
 * way `Frame.tsx` already gives every instrument; no truncated labels; touch
 * parity per `CLAUDE.md` §5."
 *
 * Every later lane draws through here, which is the point: the rules are kept
 * in one file that refuses, rather than in each instrument's author's memory.
 */
export { Bars } from './Bars'
export { Pad, usePinch } from './Pad'
export type { PadStep } from './Pad'
export { canDraw, commas, extentOf, refusalsFor } from './series'
export type { Point, Refusal, Series, SeriesKind } from './series'
