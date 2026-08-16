/**
 * Writes the keyring: the GitHub token, encrypted under the site passphrase.
 *
 *   HOME_PASSPHRASE='…' GITHUB_TOKEN='github_pat_…' npm run keyring
 *
 * ---- what this is for --------------------------------------------------
 *
 * Saving an edit means committing to `caakehorn/wiki-brain`, and there is no
 * server here to hold a credential — this is a static site on GitHub Pages. So
 * the credential ships *with* the site, encrypted, and the passphrase the door
 * already asks for is the key. Press EDIT, type, press SAVE. No token to paste,
 * no second place to keep one, no step in between.
 *
 * Same protocol as `make-verify.mjs` and the gate: PBKDF2-SHA256 at 250,000
 * iterations, AES-256-GCM. The difference is only the plaintext — the gate's
 * blob decrypts to a throwaway string because it exists to authenticate, and
 * this one decrypts to the token because it exists to carry it.
 *
 * ---- read this before running it ---------------------------------------
 *
 * The ciphertext is public. Anyone who loads the site can download it and
 * grind the passphrase offline at 250k iterations a guess, and a short
 * dictionary passphrase does not survive that — the KDF buys time, not
 * secrecy. So the token inside is only as private as the passphrase is
 * unguessable, and it should be scoped as if it were already known:
 *
 *   - a FINE-GRAINED personal access token, never a classic one
 *   - repository access limited to `caakehorn/wiki-brain` and `caakehorn/home`
 *   - permissions: Contents = read and write. Nothing else. No org scopes, no
 *     workflow, no packages, no delete.
 *   - the shortest expiry you can stand — regenerating is one command
 *
 * That way the worst case is edits to two repositories you own and can revert
 * from history, rather than anything reaching the rest of the account. If the
 * passphrase is ever guessed, revoke the token on GitHub and re-run this; the
 * old ciphertext becomes worthless the moment the token dies.
 *
 * The token is read from the environment and never from argv — argv is visible
 * to every process on the box — and it is never written anywhere in this
 * repository in plaintext.
 */
import { webcrypto as crypto } from 'node:crypto'
import { mkdirSync, writeFileSync } from 'node:fs'

const ITERATIONS = 250_000
const OUT = 'public/gate/keyring.enc'

const phrase = process.env.HOME_PASSPHRASE
const token = process.env.GITHUB_TOKEN

if (!phrase || !token) {
  console.error('Set both HOME_PASSPHRASE and GITHUB_TOKEN in the environment.')
  console.error("  HOME_PASSPHRASE='…' GITHUB_TOKEN='github_pat_…' npm run keyring")
  console.error('Neither is read from argv or from a file.')
  process.exit(1)
}
if (phrase.length < 8) {
  console.error('That passphrase is too short to be worth the 250,000 iterations.')
  process.exit(1)
}
if (token.startsWith('ghp_')) {
  console.error('That is a CLASSIC token — it carries your whole account.')
  console.error('Make a fine-grained one scoped to caakehorn/wiki-brain and caakehorn/home,')
  console.error('with Contents: read and write, and nothing else.')
  process.exit(1)
}

const b64 = (bytes) => Buffer.from(bytes).toString('base64')

const salt = crypto.getRandomValues(new Uint8Array(16))
const iv = crypto.getRandomValues(new Uint8Array(12))

const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(phrase), 'PBKDF2', false, [
  'deriveKey',
])
const key = await crypto.subtle.deriveKey(
  { name: 'PBKDF2', salt, iterations: ITERATIONS, hash: 'SHA-256' },
  base,
  { name: 'AES-GCM', length: 256 },
  false,
  ['encrypt'],
)

const ct = await crypto.subtle.encrypt(
  { name: 'AES-GCM', iv },
  key,
  new TextEncoder().encode(token),
)

mkdirSync('public/gate', { recursive: true })
writeFileSync(
  OUT,
  JSON.stringify({ v: '1', kdf: `PBKDF2-SHA256/${ITERATIONS}`, iter: String(ITERATIONS), salt: b64(salt), iv: b64(iv), ct: b64(ct) }),
)

console.log(`keyring: wrote ${OUT} (${token.slice(0, 7)}…, ${ITERATIONS.toLocaleString()} iterations)`)
console.log('Commit it. The passphrase is not in it and cannot be recovered from it.')
