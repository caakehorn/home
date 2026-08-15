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

let challenge: Promise<Blob | null> | null = null

/**
 * The blob the passphrase is checked against.
 *
 * Resolves to null when none has been built. That is not a silent failure: the
 * gate says so on the passphrase step and lets the visitor through, because a
 * missing build secret should not brick a site for everyone including its
 * owner — and this door gates rendering, not access, either way.
 */
export function loadChallenge(): Promise<Blob | null> {
  challenge ??= fetch(verifyUrl(), { cache: 'force-cache' })
    .then((r) => (r.ok ? (r.json() as Promise<Blob>) : null))
    .catch(() => null)
  return challenge
}

export async function tryPassphrase(phrase: string): Promise<'open' | 'wrong' | 'unconfigured'> {
  const blob = await loadChallenge()
  if (!blob) return 'unconfigured'
  try {
    await decrypt(blob, phrase)
    return 'open'
  } catch {
    return 'wrong'
  }
}
