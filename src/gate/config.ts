/**
 * THE DOOR — every dial and every line of copy, in one block.
 *
 * The original kept all of this at the top of one file on purpose: the door's
 * behaviour is a matter of taste and gets retuned, and hunting it through a
 * state machine is how it stops getting retuned. Same arrangement here.
 *
 * Four steps stand in front of the whole site:
 *
 *   0. THE TERMS      — an acceptance dialog. Per device, versioned, forever.
 *   1. THE QUIZ       — an empty submit passes. Anything else is a decoy.
 *   3. THE PASSPHRASE — the only one of the four that is an actual lock.
 *
 * Steps 0, 1 and 2 are doormen. Step 3 is the boundary.
 *
 * WHAT THIS DOES AND DOES NOT DO: it gates the *rendering* of the site. It
 * does not encrypt anything the site serves. `public/wiki/**` and
 * `public/leviathan/**` still resolve for anyone who types their URL, gate or
 * no gate, and while this repository is public they are readable on github.com
 * regardless of what the deployed site does. Real protection at rest means
 * encrypting those payloads, purging the history, and making the repository
 * private, in that order. Until then this is a lock on the front door of a
 * building with windows — which is worth having, and is not worth mistaking
 * for something else.
 */

/** Bump to ask every device for the passphrase again on its next visit. */
export const GATE_VERSION = 'v1'

export const KEYS = {
  /** localStorage: acceptance of the terms, keyed to the terms version. */
  terms: 'danfrank:terms',
  /** sessionStorage: the accepted passphrase. One unlock covers the tab. */
  pass: `danfrank:gate:${GATE_VERSION}`,
  /** sessionStorage: lockout deadline. A deadline, not a timer, so a reload
   *  does not skip it — which makes it the rate limit as well. */
  until: `danfrank:gate:until:${GATE_VERSION}`,
} as const

/** A wrong passphrase costs this much wall-clock time, per tab. */
export const LOCKOUT_MS = 30_000

// ---------------------------------------------------------------------------
// the lockout's voice

/**
 * The door's copy, one line every MSG_MS, rotating for as long as the
 * visitor is held. Add or remove lines freely — the rotation reads
 * the array's length. **This is the block to edit**: the voice of the door is
 * the owner's, and nothing else in the codebase reads these strings.
 */
export const TAUNTS = [
  'wrong. stand there and think about your epistemics.',
  'the door is not locked because there is anything in here worth taking.',
  'it is locked because you keep coming back.',
  'everyone inside is mid-argument and none of them want to catch you up.',
  'nothing on this screen is a hint.',
]

/** How long each line stays up. */
export const MSG_MS = 3_000

/** The line above the passphrase field. */
export const GREETING =
  'the door opens for a passphrase and for nothing else. you either have it or you do not.'

// ---------------------------------------------------------------------------
// the quiz

export const QUIZ_PROMPT = 'Before the door: what are you looking for in here?'

/** What the decoy says while it fails to arrive, forever. */
export const TRAP_HEAD = 'RECONSTRUCTING ARCHIVE INDEX'
export const TRAP_ROWS = [
  'mounting volume · PHASE B RAW',
  'reading manifest · 181,650 rows',
  'verifying checksums',
  'rebuilding index · segment 1 of 47',
  'rebuilding index · segment 2 of 47',
  'stalled — retrying segment 2',
  'rebuilding index · segment 2 of 47',
  'stalled — retrying segment 2',
]
/** A row every this often. It never finishes. That is the design. */
export const TRAP_ROW_MS = 6_500
