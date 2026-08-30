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

type Unit = {
  /** What the log stores and the UI shows. */
  code: string
  dimension: Dimension
  /** How many base units one of these is. Base: mg, ml, item. */
  factor: number
  /** What a person is likely to type. */
  aliases: string[]
  /** Sensible decimal places when this unit is displayed. */
  places: number
}

const UNITS: Unit[] = [
  { code: 'g', dimension: 'mass', factor: 1000, aliases: ['gram', 'grams', 'gs'], places: 3 },
  { code: 'mg', dimension: 'mass', factor: 1, aliases: ['milligram', 'milligrams'], places: 1 },
  { code: 'kg', dimension: 'mass', factor: 1_000_000, aliases: ['kilogram', 'kilo'], places: 4 },
  { code: 'oz', dimension: 'mass', factor: 28349.523125, aliases: ['ounce', 'ounces'], places: 4 },
  { code: 'ml', dimension: 'volume', factor: 1, aliases: ['millilitre', 'milliliter'], places: 2 },
  { code: 'l', dimension: 'volume', factor: 1000, aliases: ['litre', 'liter'], places: 3 },
  { code: 'floz', dimension: 'volume', factor: 29.5735295625, aliases: ['fl oz', 'fluid ounce'], places: 2 },
  { code: 'ct', dimension: 'count', factor: 1, aliases: ['count', 'unit', 'units', 'x'], places: 2 },
  { code: 'tab', dimension: 'count', factor: 1, aliases: ['tablet', 'tablets', 'pill', 'pills'], places: 2 },
  { code: 'cap', dimension: 'count', factor: 1, aliases: ['capsule', 'capsules'], places: 2 },
  { code: 'patch', dimension: 'count', factor: 1, aliases: ['patches'], places: 2 },
  { code: 'strip', dimension: 'count', factor: 1, aliases: ['strips', 'film'], places: 2 },
]

const BY_CODE = new Map<string, Unit>()
for (const unit of UNITS) {
  BY_CODE.set(unit.code, unit)
  for (const alias of unit.aliases) BY_CODE.set(alias, unit)
}

/** Every unit of measure, in the order the pickers show them. */
export const CODES = UNITS.map((u) => u.code)

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
 * Null rather than a throw, and never a silent pass-through: the callers are
 * summing hundreds of rows and each one has to decide what an unconvertible row
 * means for its total. `analyze.ts` counts them as unconvertible and says so on
 * the report, which is the honest answer and the one a throw would prevent.
 */
export function convert(value: number, from: string, to: string): number | null {
  const a = lookup(from)
  const b = lookup(to)
  if (!a || !b || a.dimension !== b.dimension) return null
  // Count units share a dimension but not an identity — a tablet is not a
  // capsule — so they convert only to themselves and to the generic `ct`.
  if (a.dimension === 'count' && a.code !== b.code && a.code !== 'ct' && b.code !== 'ct') return null
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
