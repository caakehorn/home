/**
 * The lock.
 *
 * Same protocol the original deployment has always used: PBKDF2-SHA256 over
 * the passphrase (250,000 iterations), AES-256-GCM for the payload. The check
 * is a *decryption*: a wrong passphrase fails GCM authentication and throws.
 *
 * There is no stored hash, so there is nothing on the wire to grind offline
 * any faster than 250k iterations per guess. `scripts/make-verify.mjs` writes
 * the blob; the passphrase itself never touches this repository.
 */

export type Blob = {
  v: string
  kdf: string
  /** Iterations, as a string in the on-disk format. */
  iter: string | number
  salt: string
  iv: string
  ct: string
}

/**
 * A file holding one blob, or several.
 *
 * The door accepts more than one way in — a dialled combination and a typed
 * passphrase — and a blob authenticates exactly one string, so a file has to be
 * able to carry one per accepted phrase. `{ v: '2', blobs: [...] }` is that
 * shape; a bare blob is the original single-phrase file and still reads.
 *
 * **What this costs, and it is not nothing:** an attacker attacks whichever
 * accepted phrase is weakest, so the security of the door is the security of
 * the *worst* way in, not the best. With a 3-number dial in the set that is the
 * 64,000-combination keyspace `./combination` already documents, no matter how
 * long the typed alternative is. Adding a way in never makes a door stronger.
 */
export type Vault = Blob | { v: '2'; blobs: Blob[] }

/** Every blob in a vault, whichever shape it is on disk. */
export const blobsOf = (vault: Vault): Blob[] =>
  'blobs' in vault && Array.isArray(vault.blobs) ? vault.blobs : [vault as Blob]

/**
 * Decrypt against any blob in the vault, or throw if none accepts the phrase.
 *
 * Every blob is tried even after one fails, because a failure here is the
 * expected case: with two ways in, the phrase that opens the second blob fails
 * the first one every time.
 */
export async function decryptVault(vault: Vault, phrase: string): Promise<string> {
  const blobs = blobsOf(vault)
  for (const blob of blobs) {
    try {
      return await decrypt(blob, phrase)
    } catch {
      /* the next one may take it */
    }
  }
  throw new Error('no blob in this vault accepts that phrase')
}

const bytes = (b64: string) => Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))

/** Decrypt a blob in this project's format. Throws on a wrong passphrase. */
export async function decrypt(blob: Blob, phrase: string): Promise<string> {
  const base = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(phrase),
    'PBKDF2',
    false,
    ['deriveKey'],
  )
  const key = await crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: bytes(blob.salt), iterations: Number(blob.iter), hash: 'SHA-256' },
    base,
    { name: 'AES-GCM', length: 256 },
    false,
    ['decrypt'],
  )
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: bytes(blob.iv) }, key, bytes(blob.ct))
  return new TextDecoder().decode(plain)
}

const verifyUrl = () => `${import.meta.env.BASE_URL}gate/verify.enc`.replace(/\/{2,}/g, '/')

let challenge: Promise<Vault | null> | null = null

/**
 * The vault the entry is checked against.
 *
 * Resolves to null when none has been built. That is not a silent failure: the
 * gate says so on the passphrase step and lets the visitor through, because a
 * missing build secret should not brick a site for everyone including its
 * owner — and this door gates rendering, not access, either way.
 *
 * ---- why `no-store`, and why only a success is remembered ------------------
 *
 * This asked for `cache: 'force-cache'` until 2026-08-31, which tells the
 * browser to serve whatever copy it already holds however old it is, and to
 * reach the network only when it holds none. The vault is the only part of this
 * door that ever moves, so that pinned every returning reader to the first
 * `verify.enc` their browser had ever seen — and since the check is a
 * decryption, a stale vault is not a stale page. It is a lock that keeps
 * opening for a key that was withdrawn.
 *
 * This deployment was re-keyed twice, on 2026-08-26 and again on 2026-08-27,
 * and neither re-key reached a browser that had been through the door before.
 * The owner's own machine went on taking the retired phrase while a private
 * window — no cache, so a real fetch — demanded the current one. That split is
 * what finally named the cause.
 *
 * `src/wiki/keyring.ts` had already met this and answered it with `no-store`.
 * The gate never got the same fix, which is the wrong way round: the keyring
 * fails visibly when it is stale, and this fails by opening.
 *
 * Only a success is cached, for the reason that file also gives. A `null`
 * remembered here does not mean "no verifier was built", it means "one request
 * failed once" — and the gate answers a null by offering ENTER ANYWAY. Since
 * `Padlock` asks exactly once, on mount, a single dropped packet used to be
 * enough to draw that button and leave it there for the session.
 *
 * So `ask` retries, and it distinguishes the two cases the old code collapsed:
 * a served 404 is an answer and resolves null immediately, while an unreachable
 * host is not an answer and is asked again. A failure that outlives the retries
 * still resolves null — the door gates rendering rather than access, and its
 * owner locking themselves out over a flat network would be the worse bug — but
 * it is no longer remembered, so the next call starts clean.
 */
export function loadChallenge(): Promise<Vault | null> {
  challenge ??= ask().catch(() => {
    // Could not ask. Never remember that as an answer.
    challenge = null
    return null
  })
  return challenge
}

/** How many times to ask before accepting that the vault cannot be reached. */
const ATTEMPTS = 3
const BACKOFF_MS = 400

/**
 * Fetch the vault, separating "nothing was built" from "could not ask".
 *
 * A served 404 is an answer and returns null on the spot: that deployment has
 * no verifier and the gate should say so. A thrown request or a 5xx is not an
 * answer, and resolving it to null would be the gate telling the reader the
 * door does not exist because one packet went missing. Those are retried, and
 * if they never come back the caller throws them away without remembering.
 */
async function ask(): Promise<Vault | null> {
  for (let attempt = 1; ; attempt++) {
    let response: Response
    try {
      response = await fetch(verifyUrl(), { cache: 'no-store' })
    } catch {
      if (attempt >= ATTEMPTS) throw new Error('the verifier could not be reached')
      await wait(BACKOFF_MS * attempt)
      continue
    }

    if (response.ok) return (await response.json()) as Vault
    if (response.status === 404) return null

    if (attempt >= ATTEMPTS) throw new Error(`the verifier answered ${response.status}`)
    await wait(BACKOFF_MS * attempt)
  }
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

export async function tryPassphrase(phrase: string): Promise<'open' | 'wrong' | 'unconfigured'> {
  const vault = await loadChallenge()
  if (!vault) return 'unconfigured'
  try {
    await decryptVault(vault, phrase)
    return 'open'
  } catch {
    return 'wrong'
  }
}
