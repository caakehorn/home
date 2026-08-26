import { createContext } from 'react'

/* ==========================================================================
   THE SHUTTER — the shared vocabulary

   Every click on this site takes a photograph of the page, badly. The strobe
   and the misregistration that fire when you go through the front door were
   the best two seconds on the site and they happened exactly once a session;
   this is that same grammar, generalised, wired to everything.

   Three sizes, because a palette swatch and a nav link are not the same event
   and firing the same 260ms whiteout at both makes the site feel like it is
   having a seizure rather than like it is responding to you.
   ========================================================================== */

export type BangKind =
  /** A control did something in place: a swatch, a switch, a dial, a knob. */
  | 'tap'
  /** Something opened, closed, or committed: a relic, a panel, a submit. */
  | 'hit'
  /** You are leaving. The full strobe, the iris, the works. */
  | 'door'
  /** The still-mode substitute: one soft tint, no strobe, no invert. */
  | 'calm'

/** The neon ramp, by index. Every bang picks one and the next picks another. */
export type Tone = 1 | 2 | 3 | 4 | 5

export type Bang = {
  /** Bumped on every fire; used as the React key so a re-fire restarts it. */
  id: number
  kind: BangKind
  tone: Tone
  /** Where it was struck, in viewport percentages. The iris opens from here. */
  x: number
  y: number
}

export type ShutterState = {
  /** The bang currently on screen, or null. */
  bang: Bang | null
  /**
   * Fire one.
   *
   * `at` is a viewport point in CSS pixels — pass the pointer position where
   * there is one, and the centre of whatever was activated where there is not
   * (a keyboard activation has no pointer, and an iris that always opens from
   * dead centre gives the game away).
   */
  fire: (kind?: BangKind, at?: { x: number; y: number } | null, tone?: Tone) => void
}

export const ShutterContext = createContext<ShutterState | null>(null)

/**
 * The floor between two bangs, in ms.
 *
 * Load-bearing for two reasons, and the small one is visual: a range input
 * fires `pointerdown` once but a drag across it fires a hundred pointer
 * events, and a strobe on each of those is a strobe.
 *
 * The large one is that this is a full-screen luminance flash on a delegated
 * handler attached to every control on the site, which is exactly the shape of
 * thing that can be made to flash into somebody's face faster than is safe.
 * The guidance worth building against is the WCAG general flash threshold:
 * more than three flashes in any one-second window is over the line, where a
 * flash is a pair of opposing luminance changes over about a tenth of the
 * screen's relative luminance across more than a quarter of it.
 *
 * Three things hold this under that line, and they are structural rather than
 * probabilistic — none of them depends on nobody clicking very fast:
 *
 *   1. THIS FLOOR. 340ms between bangs is a hard ceiling of 2.9 per second.
 *   2. ONE BEAT EACH. Every bang contains exactly one full-amplitude flash.
 *      The second and third beats in the strobe are held at roughly a third of
 *      it, which is under the luminance-change bar that makes a change count
 *      as a flash at all — you see a stutter, the threshold does not see three
 *      flashes. See veil-strobe in shutter.css.
 *   3. THE PARTIAL LAYERS. Everything that DOES beat repeatedly — the tear
 *      bands, the fringe veils, the rings — is clipped to well under a quarter
 *      of the viewport, which is the other half of the same bar.
 *
 * And then STILL is the escape hatch above all three: motion off forces every
 * bang to 'calm', which has no invert, no steps and no strobe in it anywhere.
 */
export const BANG_FLOOR = 340
