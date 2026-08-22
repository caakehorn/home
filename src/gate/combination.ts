/* ==========================================================================
   THE COMBINATION

   The door used to take a typed passphrase. It now takes a combination off a
   dial, and the combination IS the passphrase — the crypto underneath is
   untouched: the three numbers are formatted into one string and handed to
   the same PBKDF2-SHA256 → AES-256-GCM decryption in `./protocol`. There is
   still no stored hash and the combination itself is still nowhere in this
   repository.

   ---- what this costs, stated plainly -----------------------------------

   A dial is a much smaller keyspace than a passphrase. Three numbers on 40
   positions is 40³ = 64,000 combinations. At 250,000 PBKDF2 iterations a
   guess costs on the order of 100ms in a browser and rather less native, so
   the whole space is grindable offline against a committed `verify.enc` in
   hours rather than centuries.

   That is a real reduction and it is not hidden here. It is also roughly the
   security a physical combination padlock has ever offered, which is the
   point of the object. What it does not weaken is ONLINE guessing: a wrong
   combination still costs the 30-second lockout in `./config`, so grinding
   64,000 of them through the actual door would take some 22 days of doing
   nothing else.

   The two dials below are the mitigation if that trade is not wanted:
   POSITIONS at 60 and NUMBERS at 4 is 60⁴ = 12.9 million, which is a
   different conversation, and neither the dial nor the verifier needs any
   other change to honour it.

   ---- the format contract -----------------------------------------------

   `scripts/make-verify.mjs` has to produce a blob under EXACTLY the string
   this file produces, or the door never opens for anybody including its
   owner. That is the single most breakable thing about this design, so the
   rule is short, total, and stated in both places:

       each number zero-padded to two digits, joined by single hyphens

       [12, 34, 5]  ->  "12-34-05"

   The script accepts HOME_COMBINATION and applies this same normalisation
   itself, so nobody has to hand-format anything and a stray space or a
   missing zero cannot brick the deployment.
   ========================================================================== */

/** Positions on the dial face, numbered 0 to POSITIONS-1. A Master lock has 40. */
export const POSITIONS = 40

/** How many numbers make a combination. */
export const NUMBERS = 3

/**
 * Which way each number is dialled: +1 right (clockwise), -1 left.
 *
 * Right, left, right — the sequence every combination padlock has used since
 * they were invented, and the reason the dial is a lock rather than three
 * spinners in a row. A number is committed by REVERSING onto the next
 * direction, which is exactly the physical gesture.
 */
export const DIRECTIONS: readonly (1 | -1)[] = [1, -1, 1]

/** Degrees between adjacent positions. */
export const STEP = 360 / POSITIONS

/**
 * How far you must travel the right way before a reversal counts.
 *
 * Without it, the jitter at the start of a drag reads as a reversal and
 * commits whatever number you happened to be parked on before you had moved.
 */
export const MIN_TRAVEL = 18

/** The passphrase for a set of dialled numbers. See the format contract above. */
export const formatCombination = (numbers: readonly number[]) =>
  numbers.map((n) => String(n).padStart(2, '0')).join('-')

/** Which position an accumulated angle is pointing at. */
export const positionAt = (angle: number) =>
  ((Math.round(angle / STEP) % POSITIONS) + POSITIONS) % POSITIONS

export const directionWord = (d: 1 | -1) => (d === 1 ? 'RIGHT' : 'LEFT')
