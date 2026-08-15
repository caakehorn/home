/**
 * The data-display palette, kept apart from the site's `--n*` neons.
 *
 * The raw neons fail as a chart palette: magenta and violet collapse to ΔE 6.9
 * under protanopia. MARKS are the snapped equivalents — validated on the dark
 * chart surface for chroma, adjacent-pair CVD separation (worst 9.2 protan),
 * normal-vision separation (20.6) and 3:1 contrast. They sit brighter than the
 * standard lightness band, which is the deliberate house style; identity never
 * rests on colour alone here — every chart carries a legend, direct labels and
 * a table view.
 *
 * Order is fixed. Series take slots in order and never cycle.
 */
export const MARKS = ['#00d5e8', '#ff3ba7', '#a86bff', '#ffb020', '#3ddc84']

/**
 * Status is a reserved role, never "series 6". These four are deliberately
 * off the MARKS ramp so a state can never impersonate a series, and every
 * status in the UI ships with a glyph and a word — the hue is the third
 * channel, never the only one.
 */
export const STATUS = {
  good: '#3ddc84',
  warning: '#fab219',
  serious: '#ec835a',
  critical: '#ff5c5c',
} as const

export type StatusTone = keyof typeof STATUS

/** The glyph half of the icon+label pairing. */
export const STATUS_GLYPH: Record<StatusTone, string> = {
  good: '●',
  warning: '▲',
  serious: '◆',
  critical: '■',
}
