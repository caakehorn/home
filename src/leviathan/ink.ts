/**
 * Canvas ink.
 *
 * Every drawn instrument needs the same two things: a palette token turned
 * into a colour it can paint with at an alpha, and a way to tell whether two
 * tokens are far enough apart to carry a channel each. Both were copied into
 * THE CLOCK and THE PULSE before there were three of them; they live here now.
 *
 * The palette is CSS custom properties on the element, so these take the
 * resolved string rather than a token name — `getComputedStyle(el)` is the
 * only thing that can do that lookup, and it belongs at the call site where
 * the element is.
 */

/** `#f5c400` at 0.5 → `rgba(245, 196, 0, 0.5)`. Anything not hex is passed through. */
export function colourWith(colour: string, alpha: number) {
  if (colour.startsWith('#')) {
    const hex =
      colour.length === 4 ? colour.slice(1).split('').map((c) => c + c).join('') : colour.slice(1)
    const n = Number.parseInt(hex, 16)
    return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`
  }
  return colour
}

const rgb = (hex: string) => {
  if (!hex.startsWith('#')) return null
  const full = hex.length === 4 ? hex.slice(1).split('').map((c) => c + c).join('') : hex.slice(1)
  const n = Number.parseInt(full, 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

/**
 * Far enough apart to carry a channel each.
 *
 * A blunt RGB city-block distance is the right amount of cleverness for a
 * question with one real answer: RIOT is two inks and its `--n1` and `--n3`
 * are the same red twice through the machine, so they fail it; the other four
 * palettes clear it by a mile. Where it fails, the caller falls back to bare
 * paper, which is a constant across all five.
 */
export function apart(a: string, b: string) {
  const x = rgb(a)
  const y = rgb(b)
  if (!x || !y) return true
  return Math.abs(x[0] - y[0]) + Math.abs(x[1] - y[1]) + Math.abs(x[2] - y[2]) > 180
}
