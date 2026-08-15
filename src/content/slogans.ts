/**
 * The banner. Every marquee on the site runs this list.
 *
 * Add or pull a line here and it lands everywhere at once — nothing else in
 * the codebase holds banner copy any more.
 */
export const SLOGANS = [
  'GET FUCKED',
  'DO DRUGS',
  'GLOBAL COMMUNISM',
  'JET FUEL CAN’T MELT STEEL BEAMS',
  'EAT THE RICH',
  'TRANS RIGHTS',
  'SOLIDARITY FOREVER',
]

/**
 * The same lines in a different order per banner, so two marquees on one
 * screen never read as the same strip scrolling twice.
 *
 * Seeded rather than random: a given banner has one order for the life of the
 * build, so it does not reshuffle under the reader on every re-render — which
 * is what `Math.random()` in a component body would do, once per keystroke
 * anywhere on the page.
 */
export function banner(seed: string): string {
  let hash = 0x811c9dc5
  for (const ch of seed) {
    hash ^= ch.charCodeAt(0)
    hash = Math.imul(hash, 0x01000193) >>> 0
  }

  // Fisher-Yates, driven by that hash rolled forward.
  const lines = [...SLOGANS]
  for (let i = lines.length - 1; i > 0; i--) {
    hash = (Math.imul(hash, 0x01000193) ^ i) >>> 0
    const j = hash % (i + 1)
    ;[lines[i], lines[j]] = [lines[j], lines[i]]
  }
  return `${lines.join(' · ')} · `
}
