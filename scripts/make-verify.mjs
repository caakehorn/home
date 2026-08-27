/**
 * Writes the vault the gate checks an entry against.
 *
 *   HOME_COMBINATION='6-9-6'                       node scripts/make-verify.mjs
 *   HOME_PASSPHRASE='…'                            node scripts/make-verify.mjs
 *   HOME_COMBINATION='6-9-6' HOME_PASSPHRASE='…'   node scripts/make-verify.mjs
 *   npm run gate:verify
 *
 * Each accepted phrase gets a tiny AES-256-GCM ciphertext under a PBKDF2-SHA256
 * key (250,000 iterations). The gate checks an entry by *decrypting*: a wrong
 * phrase fails GCM authentication and throws. Set both inputs and the door takes
 * either — one blob each, in a `{ v: '2', blobs: [...] }` vault.
 *
 * There is no stored hash, so committing this file leaks nothing but the cost
 * of guessing. No phrase is ever written anywhere and none can be recovered
 * from this repository, which is the point of the design.
 *
 * **Run `npm run keyring` with the same inputs whenever you run this.** The gate
 * stores whichever phrase opened it and the keyring is opened with that phrase,
 * so rebuilding one without the other leaves a door that opens onto a
 * credential nobody can decrypt — see `scripts/phrases.mjs` for the day that
 * actually happened here.
 *
 * Which phrases the door takes, how a combination is normalised, and what
 * accepting more than one costs: `scripts/phrases.mjs`. In CI, put each phrase
 * in a repository secret and export it for this one step. Do not echo them, and
 * do not pass them as arguments — argv is visible to every process on the box.
 */
import { webcrypto as crypto } from 'node:crypto'
import { mkdirSync, writeFileSync } from 'node:fs'
import { phrases, vault } from './phrases.mjs'

const ITERATIONS = 250_000
const OUT = 'public/gate/verify.enc'

// The plaintext is deliberately boring: a blob exists to authenticate, not to
// carry anything. What it says is never shown.
const PLAINTEXT = '薬窟 — the door is open'

const b64 = (bytes) => Buffer.from(bytes).toString('base64')

async function seal(phrase, plaintext) {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const base = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(phrase),
    'PBKDF2',
    false,
    ['deriveKey'],
  )
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
    new TextEncoder().encode(plaintext),
  )
  return {
    v: '1',
    kdf: 'PBKDF2-SHA256',
    iter: String(ITERATIONS),
    salt: b64(salt),
    iv: b64(iv),
    ct: b64(new Uint8Array(ct)),
  }
}

const ways = phrases()
const blobs = []
for (const { phrase, label } of ways) {
  blobs.push(await seal(phrase, PLAINTEXT))
  console.log(`gate: sealed a blob for the ${label}`)
}

mkdirSync('public/gate', { recursive: true })
writeFileSync(OUT, JSON.stringify(vault(blobs)))

console.log(
  `gate: verifier written -> ${OUT} (${blobs.length} way${blobs.length === 1 ? '' : 's'} in, ` +
    `${ITERATIONS.toLocaleString()} iterations each)`,
)
if (blobs.length > 1) {
  console.log('gate: the door is only as strong as the weakest of those — see scripts/phrases.mjs.')
}
console.log('Now run `npm run keyring` with the SAME inputs, or SAVE will stop publishing.')
console.log('Commit the result. No phrase enters the repository.')
