/**
 * Units of measure, and the refusal to add two things that are not the same kind
 * of thing.
 *
 * The ledger is deliberately substance-agnostic — the schema does not care
 * whether a unit is three and a half grams of something or a bottle of sixty
 * tablets — which means it has to do arithmetic across `g`, `mg`, `ml` and
 * `tab` without ever quietly adding a millilitre to a milligram. So every unit
 * of measure declares a dimension, conversion happens only inside one, and a
 * cross-dimension sum is an error rather than a number.
 *
 * The conversion factors are exact where exactness exists (an ounce is
 * 28.349523125 g by definition, not 28.35), because a rounded constant applied
 * across two hundred events is a drift nobody can see and nobody can find.
 *
 * `count` is a real dimension, not a fallback: a tablet is not 500 mg of
 * anything the ledger knows about, and pretending otherwise would let a
 * "remaining" figure be computed from a conversion nobody entered.
 */

export type Dimension = 'mass' | 'volume' | 'count'

/**
 * `bin/intake`'s FAMILIES, exactly.
 *
 * Not this portal's table any more. The upstream tool rejects a cross-family
 * log as an error rather than coercing it, and a unit this end accepts and that
 * end refuses is a row that syncs and then fails a rebuild — so the two lists
 * have to be the same list. `oz` and `floz` are absent because they are absent
 * there; a count unit converts freely to any other count unit for the same
 * reason, even though a tablet is plainly not a puff.
 *
 * Base units: mg, ml, one item.
 */
const FAMILIES: Record<Dimension, Record<string, number>> = {
  mass: { mcg: 0.001, ug: 0.001, mg: 1, g: 1000, kg: 1_000_000 },
  volume: { ml: 1, cc: 1, cl: 10, dl: 100, l: 1000 },
  count: {
    count: 1, ct: 1, tab: 1, cap: 1, pill: 1,
    dose: 1, patch: 1, puff: 1, drop: 1, unit: 1,
  },
}

/** Sensible decimal places when a figure in this unit is displayed. */
const PLACES: Record<string, number> = { mcg: 1, ug: 1, mg: 1, g: 3, kg: 4, ml: 2, l: 3 }

type Unit = { code: string; dimension: Dimension; factor: number; places: number }

const BY_CODE = new Map<string, Unit>()
for (const [dimension, table] of Object.entries(FAMILIES) as [Dimension, Record<string, number>][]) {
  for (const [code, factor] of Object.entries(table)) {
    BY_CODE.set(code, { code, dimension, factor, places: PLACES[code] ?? 2 })
  }
}

/** The order the pickers show them in: commonest first, per family. */
const ORDER = [
  'g', 'mg', 'mcg', 'kg',
  'ml', 'l', 'cc', 'cl', 'dl',
  'tab', 'cap', 'pill', 'dose', 'ct', 'count', 'patch', 'puff', 'drop', 'unit',
]

export const CODES = ORDER.filter((code) => BY_CODE.has(code))

export const lookup = (code: string): Unit | null =>
  BY_CODE.get(code.trim().toLowerCase()) ?? null

export const dimensionOf = (code: string): Dimension | null => lookup(code)?.dimension ?? null

/** Whether two units of measure can be added at all. */
export const commensurable = (a: string, b: string) => {
  const [x, y] = [lookup(a), lookup(b)]
  return Boolean(x && y && x.dimension === y.dimension)
}

/**
 * Convert, or return null.
 *
 * Strictly inside a family: milligrams are grams, millilitres are not, and two
 * tabs are never two grams. Within `count` everything converts, which is
 * upstream's call rather than this one's — a tablet is not a puff, but the
 * ledger is unit-agnostic and a count is a count.
 *
 * Null rather than a throw, and never a silent pass-through: the callers are
 * summing hundreds of rows and each one has to decide what an unconvertible row
 * means for its total. `analyze.ts` counts them as unconvertible and says so on
 * the report, which is the honest answer and the one a throw would prevent.
 */
export function convert(value: number, from: string, to: string): number | null {
  const a = lookup(from)
  const b = lookup(to)
  if (!a || !b || a.dimension !== b.dimension) return null
  return (value * a.factor) / b.factor
}

/** Round for display in the unit's own natural precision. */
export function format(value: number, code: string): string {
  const unit = lookup(code)
  const places = unit?.places ?? 3
  const fixed = value.toFixed(places)
  // Trailing zeros read as precision the number does not have. 0.180 g came off
  // a scale that showed 0.18.
  return fixed.includes('.') ? fixed.replace(/0+$/, '').replace(/\.$/, '') : fixed
}

export const quantity = (value: number, code: string) => `${format(value, code)} ${code}`
