/**
 * The chart kit — what a series has to be before anything will draw it.
 *
 * `docs/CHARTS.md` §1.1 counts 194 of 239 auto-drawn tables carrying a hard
 * defect, and names one cause for all of them: the old analyzer "is written to
 * say yes. It asks whether a chart is *possible*, never whether it is *true*."
 * This file is the opposite default. Nothing here draws anything — it decides
 * whether drawing is allowed at all, and it **refuses rather than warns**,
 * because a warning is something a renderer can be built to ignore and a
 * refusal is not.
 *
 * A refusal is not an error. It is an outcome with a reason, and the reason is
 * shown to the reader in place of the chart. A table the site declines to draw
 * is still a table; what the reader loses is a picture that was going to be
 * wrong, and what they gain is the sentence saying which rule stopped it.
 *
 * The rules below are each a named defect from §1.1 or a clause of `foundation`
 * in §2, and nothing else. Refusals are cheap here on purpose: this kit is the
 * one gate every later lane's instrument draws through, so the cost of a rule
 * being slightly too strict is a chart that stays a table, and the cost of one
 * being too lax is 131 truncated axes shipped again.
 */

/**
 * What a number *is*, which is the only question THE RULE asks of it.
 *
 * There are three admissible kinds and they are the three words THE RULE
 * itself uses — a count, a date or a length. `rate` is the fourth and it is a
 * derived one: admissible only while it carries the `n` it was computed over,
 * which is why it is the one kind with a second required field.
 */
export type SeriesKind = 'count' | 'date' | 'length' | 'rate'

/**
 * One series, and every field it cannot be drawn without.
 *
 * `unit` is required by the type rather than defaulted, because §1.1's
 * `unit-contamination` (16 tables) is what a defaulted unit looks like from
 * the reader's side: `unitOf` sniffed `(86.7%)` out of a parenthetical two
 * columns over and printed `%` on all of them, so **120 books rendered as
 * `120%`**. A unit that was inferred is a unit that can be inferred wrong. This
 * one is stated by whoever built the payload or there is no chart.
 */
export type Series = {
  id: string
  /** Printed in full. Never abbreviated, never cut — see `Bars.tsx`. */
  label: string
  kind: SeriesKind
  /** `messages`, `days`, `words`, `km`. Stated, never sniffed. */
  unit: string
  points: Point[]
  /**
   * For `kind: 'rate'` only, and required there: what the rate was computed
   * over. `docs/CHARTS.md` §2 — "the `n` printed on every rate". A rate whose
   * denominator is not shown is a number the reader cannot weigh: 100% of two
   * and 100% of two thousand print identically.
   */
  n?: number
}

/** A label and a value. `null` is a gap in the record, never a zero. */
export type Point = {
  label: string
  /**
   * `null` means the record does not cover this position — `CLAUDE.md` §2, "a
   * hole in an archive is not a silence". It is drawn as a gap and excluded
   * from every extent, rather than sitting on the floor looking like a
   * measured nothing.
   */
  value: number | null
}

export type Refusal = {
  /** Stable, so `scripts/audit-charts.mjs` can count refusals by kind. */
  code:
    | 'empty'
    | 'no-unit'
    | 'mixed-units'
    | 'rate-without-n'
    | 'no-values'
    | 'judgement'
  /** What the reader is shown in place of the chart. A sentence, not a code. */
  says: string
}

/**
 * THE RULE's one keyword list, and why it is not a contradiction of THE RULE.
 *
 * `core.ts` bars seventeen instruments for, among other things, keyword lists.
 * This is a keyword list. The difference is the direction it can fail in: the
 * barred lists map words onto a *reading* — `src/wiki/brief.ts:438` paints
 * four sentiment tones from `closed|terminated|severed|collapsed|deceased` —
 * so being wrong about a word puts a claim on the page that the corpus never
 * made. This list can only ever cause the site to draw **less**. Its failure
 * mode is a table that stays a table, which asserts nothing about anybody.
 *
 * A list that can only subtract cannot bias a portrait.
 */
const JUDGEMENT_WORDS =
  /\b(score|rating|rank|ranking|percentile|index|verdict|grade|confidence|severity|quality|sentiment|gini)\b/i

/** A number that is really a year, which is an axis and not a magnitude. */
const YEARISH = (v: number) => Number.isInteger(v) && v >= 1000 && v <= 2999

/**
 * Every reason this set of series must not be drawn on one axis.
 *
 * Returns them all rather than the first, because a caller fixing a payload
 * wants the whole list and a reader shown the refusal deserves the real
 * reason rather than whichever one happened to be checked first.
 */
export function refusalsFor(series: Series[]): Refusal[] {
  const out: Refusal[] = []
  const say = (code: Refusal['code'], says: string) => out.push({ code, says })

  if (!series.length) {
    say('empty', 'Nothing to draw: no series was handed to the chart.')
    return out
  }

  for (const s of series) {
    if (!s.unit || !s.unit.trim())
      say(
        'no-unit',
        `“${s.label}” states no unit. A unit is stated by whoever built the payload or the ` +
          'series is not drawn — an inferred unit is one that can be inferred wrong.',
      )

    if (s.kind === 'rate' && (s.n === undefined || !Number.isFinite(s.n)))
      say(
        'rate-without-n',
        `“${s.label}” is a rate and does not carry the n it was computed over. 100% of two and ` +
          '100% of two thousand print identically; without the n the reader cannot tell them apart.',
      )

    const values = s.points.map((p) => p.value).filter((v): v is number => v !== null)
    if (!values.length)
      say('no-values', `“${s.label}” has no measured value — every point is a gap in the record.`)

    if (JUDGEMENT_WORDS.test(s.label) || JUDGEMENT_WORDS.test(s.unit))
      say(
        'judgement',
        `“${s.label}” names a score, rating or index. THE RULE: every number here is a count, a ` +
          'date or a length, and a composite is none of the three.',
      )

    // A column of years drawn as bar lengths is §1.1's `year-as-value`, 27
    // tables — `health/cocaine` draws a bar 2,015 units tall because
    // `parseNumber` took the leading integer of the era string `"2015–16"`.
    if (s.kind !== 'date' && values.length > 1 && values.every(YEARISH))
      say(
        'judgement',
        `“${s.label}” is a column of years declared as a ${s.kind}. A span of years is an axis; ` +
          'drawn as a magnitude it asserts that a date is a quantity.',
      )
  }

  // §1.1's `mixed-magnitude`, 18 tables — and the reason it is a unit check
  // rather than a magnitude check is `interests/favorites/eclecticism`, where
  // 105,405 messages shared an axis with 25 works of art. Those are far apart
  // *and* incommensurable, and only the second is a defect a reader can see.
  const units = [...new Set(series.filter((s) => s.unit?.trim()).map((s) => s.unit.trim()))]
  if (units.length > 1)
    say(
      'mixed-units',
      `One axis cannot carry ${units.map((u) => `“${u}”`).join(' and ')}. Two units on one scale ` +
        'is a comparison the numbers do not support; draw them as separate charts.',
    )

  return out
}

/** Convenience for a caller that only wants the yes or no. */
export const canDraw = (series: Series[]) => refusalsFor(series).length === 0

/**
 * The extent, over measured values only.
 *
 * Gaps are excluded rather than counted as zero, for the reason `Point.value`
 * gives: a month with no export is not a month with no messages, and a floor
 * drawn through it would assert the second.
 */
export function extentOf(series: Series[]): { min: number; max: number } | null {
  const values = series.flatMap((s) => s.points.map((p) => p.value)).filter((v): v is number => v !== null)
  if (!values.length) return null
  return { min: Math.min(...values, 0), max: Math.max(...values) }
}

/**
 * `1234567` → `1,234,567`, and `2014` → `2014`.
 *
 * The kind is passed rather than sniffed, because the two cases are
 * indistinguishable from the number alone and guessing gets one of them wrong
 * every time: a count of 2,014 messages wants its separator and the year 2014
 * emphatically does not. Which one this is, is a thing the payload already
 * knows and states.
 */
export const commas = (n: number, kind?: SeriesKind) => {
  if (kind === 'date') return String(n)
  return Number.isInteger(n)
    ? n.toLocaleString('en-US')
    : n.toLocaleString('en-US', { maximumFractionDigits: 2 })
}
