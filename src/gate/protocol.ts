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
 */
export function loadChallenge(): Promise<Vault | null> {
  challenge ??= fetch(verifyUrl(), { cache: 'force-cache' })
    .then((r) => (r.ok ? (r.json() as Promise<Vault>) : null))
    .catch(() => null)
  return challenge
}

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
