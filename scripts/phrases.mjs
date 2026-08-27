/**
 * Which phrases open the door — resolved once, for both builders.
 *
 * `make-verify.mjs` writes what the gate checks an entry against;
 * `make-keyring.mjs` writes the token the site publishes with, sealed under the
 * same phrase the gate records. **If those two disagree the failure is silent
 * and total**: the door opens, the site renders, and every SAVE and every
 * question typed into the sage box stops committing, with nothing on screen to
 * say why.
 *
 * That is not a hypothetical. On 2026-08-27 this deployment was in exactly that
 * state — `verify.enc` had been rebuilt for the combination dial while
 * `keyring.enc` was still sealed under the typed passphrase the dial replaced,
 * so the credential could not be opened by anybody who came through the door.
 * The two scripts each read the environment for themselves and there was
 * nothing to notice the drift.
 *
 * So the resolution lives here, once, and both import it.
 *
 * ---- the inputs ------------------------------------------------------------
 *
 *   HOME_COMBINATION='6-9-6'                  the dial
 *   HOME_PASSPHRASE='…'                       a typed phrase
 *
 * Set either, or both. Both means the door takes either, and the artifacts are
 * built with one blob per phrase.
 *
 * ---- what two ways in costs, stated plainly --------------------------------
 *
 * An attacker attacks the weakest accepted phrase, so **the door is only as
 * strong as the worst way into it.** With a 3-number dial in the set that is
 * the 64,000-combination keyspace `src/gate/combination.ts` documents, however
 * long the typed alternative is. Adding a way in never makes a door stronger,
 * and the honest reason to do it anyway is that the dial is the object and the
 * phrase is the way its owner gets in without dialling.
 */

const POSITIONS = 40
const NUMBERS = 3

/**
 * `[6, 9, 6]` → `"06-09-06"` — each number zero-padded to two digits, joined by
 * single hyphens.
 *
 * `src/gate/combination.ts` produces exactly this string from the dial, and if
 * these two ever disagree the door never opens for anybody including its owner.
 * That is why the normalisation lives in the script rather than in the
 * operator's fingers: `'6-9-6'`, `'06 09 06'` and `'6,9,6'` all land on the
 * same string, so a stray space or a missing zero cannot brick the deployment.
 */
export function fromCombination(raw) {
  const parts = raw.trim().split(/[^0-9]+/).filter(Boolean)
  if (parts.length !== NUMBERS) {
    console.error(`A combination is ${NUMBERS} numbers. Got ${parts.length}: "${raw}"`)
    process.exit(1)
  }
  const numbers = parts.map(Number)
  for (const n of numbers) {
    if (!Number.isInteger(n) || n < 0 || n >= POSITIONS) {
      console.error(`Every number must be 0–${POSITIONS - 1}. Got ${n}.`)
      process.exit(1)
    }
  }
  return numbers.map((n) => String(n).padStart(2, '0')).join('-')
}

/**
 * Every phrase to build a blob for, in order, as `{ phrase, label }`.
 *
 * Exits with a usage message when nothing is set — never returns an empty list,
 * so no caller has to decide what an unconfigured door means.
 */
export function phrases() {
  const out = []

  const combo = process.env.HOME_COMBINATION
  if (combo) out.push({ phrase: fromCombination(combo), label: 'combination' })

  const typed = process.env.HOME_PASSPHRASE
  if (typed) {
    // The floor is about a *typed* phrase being worth the iterations. A
    // combination is a fixed 8 characters by construction and its cost is its
    // keyspace, not its length, so the check is deliberately not applied to it.
    if (typed.length < 8) {
      console.error('That passphrase is too short to be worth the 250,000 iterations.')
      process.exit(1)
    }
    out.push({ phrase: typed, label: 'passphrase' })
  }

  if (out.length === 0) {
    console.error(
      'Set HOME_COMBINATION (e.g. "6-9-6") or HOME_PASSPHRASE in the environment,\n' +
        'or both to accept either. Neither is ever read from argv or a file.',
    )
    process.exit(1)
  }

  // Two blobs under the same string is a real mistake — it looks like two ways
  // in and is one — and it happens the moment somebody sets HOME_PASSPHRASE to
  // the dialled string by hand.
  const seen = new Set()
  return out.filter(({ phrase, label }) => {
    if (seen.has(phrase)) {
      console.warn(`gate: the ${label} is the same string as an earlier one — skipped.`)
      return false
    }
    seen.add(phrase)
    return true
  })
}

/** One blob, or a v2 vault when there is more than one way in. */
export const vault = (blobs) => (blobs.length === 1 ? blobs[0] : { v: '2', blobs })
