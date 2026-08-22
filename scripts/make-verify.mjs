/**
 * Writes the blob the gate checks a passphrase against.
 *
 *   HOME_COMBINATION='NN-NN-NN' node scripts/make-verify.mjs
 *   HOME_PASSPHRASE='…'         node scripts/make-verify.mjs
 *   npm run gate:verify
 *
 * The blob is a tiny AES-256-GCM ciphertext under a PBKDF2-SHA256 key
 * (250,000 iterations) derived from the passphrase. The gate checks an entry
 * by *decrypting* it: a wrong passphrase fails GCM authentication and throws.
 *
 * There is no stored hash, so committing this file leaks nothing but the cost
 * of guessing — 250k iterations per attempt, offline or not. The passphrase
 * itself is never written anywhere and cannot be recovered from this
 * repository, which is the point of the design.
 *
 * In CI, put the passphrase in a repository secret and export it as
 * HOME_PASSPHRASE for this one step. Do not echo it, and do not pass it as an
 * argument — argv is visible to every process on the box.
 */
import { webcrypto as crypto } from 'node:crypto'
import { mkdirSync, writeFileSync } from 'node:fs'

const ITERATIONS = 250_000
const OUT = 'public/gate/verify.enc'

/*
 * THE COMBINATION FORMAT
 *
 * The door is a combination padlock now, and the dialled numbers ARE the
 * passphrase. That means this script and `src/gate/combination.ts` have to
 * agree on one string exactly, or the door never opens for anybody including
 * its owner — so the normalisation lives here rather than in the operator's
 * fingers. HOME_COMBINATION takes whatever is natural to type:
 *
 *     HOME_COMBINATION='12-34-5'    npm run gate:verify
 *     HOME_COMBINATION='12 34 05'   npm run gate:verify
 *     HOME_COMBINATION='12,34,5'    npm run gate:verify
 *
 * All three become "12-34-05", which is what the dial produces: each number
 * zero-padded to two digits, joined by single hyphens.
 *
 * HOME_PASSPHRASE still works and is still passed through untouched, for a
 * deployment that has not switched the door over.
 */
const POSITIONS = 40
const NUMBERS = 3

function fromCombination(raw) {
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

const combo = process.env.HOME_COMBINATION
const phrase = combo ? fromCombination(combo) : process.env.HOME_PASSPHRASE

if (!phrase) {
  console.error(
    'Set HOME_COMBINATION (e.g. "12-34-05") or HOME_PASSPHRASE in the environment.\n' +
      'Neither is ever read from argv or a file.',
  )
  process.exit(1)
}

// The length floor is about a typed passphrase being worth the iterations. A
// combination is a fixed 8 characters by construction and its cost is the
// 64,000-guess keyspace, not its length — so the floor would only ever reject
// a correctly-formatted combination. `src/gate/combination.ts` documents that
// trade honestly rather than pretending the floor covers it.
if (!combo && phrase.length < 8) {
  console.error('That passphrase is too short to be worth the 250,000 iterations.')
  process.exit(1)
}

if (combo) console.log(`combination normalised to ${NUMBERS} numbers on a ${POSITIONS}-position dial`)

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

// The plaintext is deliberately boring: the blob exists to authenticate, not
// to carry anything. What it says is never shown.
const ct = await crypto.subtle.encrypt(
  { name: 'AES-GCM', iv },
  key,
  new TextEncoder().encode('薬窟 — the door is open'),
)

mkdirSync('public/gate', { recursive: true })
writeFileSync(
  OUT,
  JSON.stringify({
    v: '1',
    kdf: 'PBKDF2-SHA256',
    iter: String(ITERATIONS),
    salt: b64(salt),
    iv: b64(iv),
    ct: b64(new Uint8Array(ct)),
  }),
)

console.log(`gate: verifier written -> ${OUT} (${ITERATIONS.toLocaleString()} iterations)`)
console.log('Commit it. The passphrase stays out of the repository.')
