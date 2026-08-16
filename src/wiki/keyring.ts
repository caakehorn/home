/**
 * The keyring — where SAVE gets its credential without ever asking you for one.
 *
 * Committing to `caakehorn/wiki-brain` needs a GitHub token, and a static site
 * has nowhere private to keep one. So the token ships with the site encrypted
 * under the same passphrase the door already asks for (`scripts/make-keyring.mjs`
 * writes the blob), and this module opens it.
 *
 * The result is that there is no publishing step. The gate already holds the
 * passphrase for the session — it stores it to remember that you got in — so by
 * the time you press SAVE the key is in hand and nothing is asked. `unlock()`
 * exists for the case where it is not: a tab where the gate was skipped, or
 * where session storage was cleared under it.
 *
 * The decrypted token is kept in a module variable and deliberately never
 * written to storage. The passphrase is already there and can reopen the blob
 * in about a second; a second copy of a live credential sitting in
 * localStorage would be a strictly worse thing to leave on a borrowed laptop.
 *
 * On what this does and does not protect, see the header of
 * `scripts/make-keyring.mjs`. Short version: the ciphertext is public, so the
 * token is only as private as the passphrase is unguessable, and it should be
 * scoped so that a bad day means edits to two repositories rather than
 * anything worse.
 */
import { decrypt, type Blob } from '../gate/protocol'
import { KEYS } from '../gate/config'

const url = () => `${import.meta.env.BASE_URL}gate/keyring.enc`.replace(/\/{2,}/g, '/')

let blob: Promise<Blob | null> | null = null
let token: string | null = null

/**
 * Fetch the blob, caching only success.
 *
 * Caching the failure too is the obvious version and it is wrong: a tab open
 * across the deploy that first shipped the keyring gets one 404, remembers it
 * forever, and tells its owner for the rest of the session that there is no
 * keyring on a deploy that plainly has one. A miss here is nearly always
 * temporal — not yet deployed, offline for a moment — so a retry is free and a
 * cached "no" is a lie with a long tail.
 *
 * `no-store` for the same reason: `force-cache` let the browser keep serving a
 * 404 from before the file existed.
 */
function load(): Promise<Blob | null> {
  blob ??= fetch(url(), { cache: 'no-store' })
    .then((r) => (r.ok ? (r.json() as Promise<Blob>) : Promise.reject(new Error('absent'))))
    .catch(() => {
      blob = null
      return null
    })
  return blob
}

/** The passphrase the gate recorded when it let this session in. */
function sessionPhrase(): string | null {
  try {
    return sessionStorage.getItem(KEYS.pass)
  } catch {
    return null
  }
}

/** Has a keyring been built and shipped at all? */
export async function configured(): Promise<boolean> {
  return (await load()) !== null
}

/**
 * Open the keyring with an explicit passphrase.
 *
 * Returns false on a wrong one — GCM authentication fails and `decrypt` throws,
 * which is the same check the gate makes, so there is no separate notion here
 * of a right passphrase.
 */
export async function unlock(phrase: string): Promise<boolean> {
  const b = await load()
  if (!b) return false
  try {
    token = (await decrypt(b, phrase)).trim()
    return true
  } catch {
    return false
  }
}

/**
 * The token, opening the keyring first if it can.
 *
 * Null means genuinely unavailable — no keyring was built, or this tab has no
 * passphrase to open it with. Callers distinguish those two with `configured()`
 * so they can say which it is rather than reporting a generic failure.
 */
export async function credential(): Promise<string | null> {
  if (token) return token
  const phrase = sessionPhrase()
  if (!phrase) return null
  return (await unlock(phrase)) ? token : null
}

/** True when a save would go through right now with no prompt. */
export async function ready(): Promise<boolean> {
  return (await credential()) !== null
}

/** Drop the decrypted token. The blob and the passphrase are untouched. */
export function relock() {
  token = null
}
