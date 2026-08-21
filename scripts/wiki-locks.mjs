/**
 * PER-PAGE LOCKS — sealing individual wiki pages inside the vendored snapshot.
 *
 *   WIKI_LOCK_PASSPHRASE='…' npm run wiki:lock
 *   WIKI_LOCK_PASSPHRASE='…' node scripts/sync-wiki.mjs ../wiki-brain   (runs it)
 *
 * ---- the problem this exists for ---------------------------------------
 *
 * The gate in front of the site gates *rendering*, not access: `public/wiki/**`
 * resolves for anyone who types the URL, and while this repository is public it
 * is readable on github.com whatever the deployed site does. The README has
 * said for months what the real fix is — encrypt the payload and have the page
 * decrypt it in the browser. This is that, applied one page at a time.
 *
 * A sealed page ships as a ciphertext. There is no plaintext of it anywhere in
 * the build, in the repository, or in the derived datasets, and the only thing
 * that opens it is a passphrase that never touches this repository.
 *
 * ---- what stays visible, on purpose ------------------------------------
 *
 * The slug, the domain and the title. A sealed page keeps its URL and its place
 * in the index, on the map and in the LIST view, marked SEALED — the site says
 * "there is a page here and you cannot read it" rather than pretending the page
 * does not exist. Hiding the title while the slug sits in the address bar would
 * be theatre, and a hole in an index that counts itself is louder than a lock.
 *
 * Everything else is inside the blob: the body, the frontmatter, the infobox,
 * every list, the word and chart counts, the gaps, and the page's own outbound
 * links. Links are in there because an association is a fact about the page —
 * so a sealed page is also struck out of the map's edge list, out of every
 * other page's `backlinks`, and out of GAPS.
 *
 * ---- what this does not protect ----------------------------------------
 *
 * The same arithmetic as the keyring: the ciphertext is public, so the page is
 * only as private as the passphrase is unguessable. PBKDF2 at 250,000
 * iterations buys time against a guesser, not immunity, and nothing here is a
 * rate limit on an attacker who has downloaded the file. Pick a phrase that
 * survives a wordlist, and pick a *different* one from the door's — a lock that
 * opens to the key everyone in the building already has is a drawer, not a
 * lock.
 *
 * Sealing is also not retroactive: git keeps every plaintext blob ever
 * committed, so a page that has been synced in the clear stays readable in the
 * history until the history is purged. Seal a page before its first sync, or
 * purge, or accept that this closes the door in front of new readers only.
 *
 * Same protocol as `make-verify.mjs`, `make-keyring.mjs` and the gate:
 * PBKDF2-SHA256 at 250,000 iterations, AES-256-GCM, checked by decrypting.
 */
import { webcrypto as crypto } from 'node:crypto'
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const ITERATIONS = 250_000

/** The list of what is sealed. Slugs, or a `prefix/*` for a whole branch. */
export const MANIFEST = 'wiki.locks.json'

/**
 * Read the manifest.
 *
 * A missing file means nothing is locked, which is the state this repository
 * shipped in for its whole life and has to keep working. A *malformed* one is
 * an error rather than an empty list: silently treating a typo'd manifest as
 * "lock nothing" is how a page you believe is sealed goes out in the clear.
 */
export function readManifest(file = MANIFEST) {
  if (!existsSync(file)) return { locked: [] }
  let parsed
  try {
    parsed = JSON.parse(readFileSync(file, 'utf8'))
  } catch (err) {
    throw new Error(`${file} is not valid JSON (${err.message}). Refusing to sync with a manifest I cannot read.`)
  }
  const locked = parsed.locked ?? []
  if (!Array.isArray(locked) || locked.some((p) => typeof p !== 'string')) {
    throw new Error(`${file}: "locked" must be an array of slug patterns.`)
  }
  return { locked }
}

/**
 * A matcher over the manifest's patterns.
 *
 * Exact slugs, and `people/*` for a branch. Deliberately not a glob library:
 * the surface of what can be written here is the surface of what can be
 * mistyped, and a mistyped lock is a page published in the clear.
 */
export function matcher(patterns) {
  const exact = new Set(patterns.filter((p) => !p.endsWith('*')))
  const prefixes = patterns.filter((p) => p.endsWith('*')).map((p) => p.replace(/\*$/, ''))
  return (slug) => exact.has(slug) || prefixes.some((p) => slug.startsWith(p))
}

/** The passphrase sealed pages are encrypted under. Never read from argv. */
export const passphrase = () => process.env.WIKI_LOCK_PASSPHRASE ?? null

/**
 * Refuse to build a snapshot that would publish a page the manifest seals.
 *
 * Called before anything is written, so the failure mode of "locks configured,
 * passphrase forgotten" is a build that stops, not a build that leaks.
 */
export function requirePassphrase({ locked }, where = MANIFEST) {
  if (!locked.length) return null
  const phrase = passphrase()
  if (!phrase) {
    throw new Error(
      `${locked.length} page${locked.length === 1 ? ' is' : 's are'} sealed (${where}) and ` +
        'WIKI_LOCK_PASSPHRASE is not set.\n' +
        "  WIKI_LOCK_PASSPHRASE='…' npm run wiki:lock\n" +
        'Refusing to write them in the clear.',
    )
  }
  if (phrase.length < 8) {
    throw new Error('That lock passphrase is too short to be worth the 250,000 iterations.')
  }
  return phrase
}

const b64 = (bytes) => Buffer.from(bytes).toString('base64')

async function encrypt(plaintext, phrase) {
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
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(plaintext))
  return {
    v: '1',
    kdf: 'PBKDF2-SHA256',
    iter: String(ITERATIONS),
    salt: b64(salt),
    iv: b64(iv),
    ct: b64(new Uint8Array(ct)),
  }
}

/**
 * The fields that go inside the blob, and the husk left outside it.
 *
 * Written as one pair so the two can never drift: anything added to a page by
 * `sync-wiki.mjs` and not named here stays in the husk, which is the safe
 * direction only for fields that are already public. Check this function when
 * the page shape grows a field.
 */
function split(page) {
  const { slug, domain, title, ...secret } = page
  return [
    { slug, domain, title },
    secret,
  ]
}

/** Write only when the bytes changed — a no-op run should be a no-op diff. */
function writeIfChanged(file, value) {
  const next = JSON.stringify(value)
  if (existsSync(file) && readFileSync(file, 'utf8') === next) return false
  writeFileSync(file, next)
  return true
}

/**
 * Seal every page the manifest names, in a snapshot that is already built.
 *
 * Idempotent: a page carrying a `lock` is already a ciphertext and is left
 * alone, so this can run after every sync, and running it twice by hand costs
 * nothing. Returns what it did, for the caller to print.
 */
export async function sealSnapshot(dir, { locked, phrase }) {
  if (!locked.length) return { sealed: [], missing: [], already: 0 }

  const isLocked = matcher(locked)
  const pagesDir = join(dir, 'pages')
  const files = readdirSync(pagesDir).filter((f) => f.endsWith('.json'))

  const sealed = []
  let already = 0
  const seen = new Set()

  for (const file of files) {
    const path = join(pagesDir, file)
    const page = JSON.parse(readFileSync(path, 'utf8'))
    seen.add(page.slug)
    if (!isLocked(page.slug)) continue
    if (page.lock) {
      already++
      sealed.push(page.slug)
      continue
    }
    const [husk, secret] = split(page)
    writeFileSync(
      path,
      JSON.stringify({
        ...husk,
        locked: true,
        // A husk has to satisfy the same reader as an open page: empty rather
        // than absent, so nothing downstream has to learn a second shape.
        meta: {},
        infobox: null,
        lists: {},
        links: [],
        backlinks: [],
        body: '',
        words: 0,
        charts: 0,
        brief: false,
        gaps: [],
        staged: null,
        lock: await encrypt(JSON.stringify(secret), phrase),
      }),
    )
    sealed.push(page.slug)
  }

  const sealedSet = new Set(sealed)
  const missing = locked.filter((p) => !p.endsWith('*') && !seen.has(p))

  // A sealed page's outbound links are inside its blob; the trace they left on
  // the pages they point at has to go too, or "Linked from: <sealed page>" says
  // the thing the seal was for.
  for (const file of files) {
    const path = join(pagesDir, file)
    const page = JSON.parse(readFileSync(path, 'utf8'))
    if (sealedSet.has(page.slug)) continue
    const kept = (page.backlinks ?? []).filter((s) => !sealedSet.has(s))
    if (kept.length === (page.backlinks ?? []).length) continue
    writeIfChanged(path, { ...page, backlinks: kept })
  }

  redactIndex(join(dir, 'index.json'), sealedSet)
  redactGaps(join(dir, 'gaps.json'), sealedSet)

  return { sealed, missing, already }
}

/**
 * The index entry a sealed page gets.
 *
 * Name and place, nothing else: the counts and the blurb are as much a
 * description of the page as its first paragraph is. The coordinates stay, so
 * the node keeps its position on the map rather than the map rearranging itself
 * around what is missing.
 */
function redactIndex(file, sealed) {
  if (!existsSync(file) || !sealed.size) return
  const index = JSON.parse(readFileSync(file, 'utf8'))

  const locked = new Set()
  index.pages = index.pages.map((entry, i) => {
    if (!sealed.has(entry.slug)) return entry
    locked.add(i)
    return {
      ...entry,
      type: null,
      status: null,
      knownFor: null,
      relationship: null,
      words: 0,
      charts: 0,
      links: 0,
      brief: false,
      locked: true,
    }
  })

  // Undirected pairs carry no direction, so there is no telling which end wrote
  // the link. Every edge that touches a sealed page goes.
  if (index.edges) index.edges = index.edges.filter(([a, b]) => !locked.has(a) && !locked.has(b))

  index.counts = {
    ...index.counts,
    words: index.pages.reduce((n, p) => n + p.words, 0),
    chartables: index.pages.reduce((n, p) => n + p.charts, 0),
    briefs: index.pages.filter((p) => p.brief).length,
    ...(index.edges ? { edges: index.edges.length } : {}),
    sealed: locked.size,
  }

  writeIfChanged(file, index)
}

/** A sealed page admits nothing, including what it does not know. */
function redactGaps(file, sealed) {
  if (!existsSync(file) || !sealed.size) return
  const gaps = JSON.parse(readFileSync(file, 'utf8'))
  const pages = gaps.pages.filter((p) => !sealed.has(p.slug))
  if (pages.length === gaps.pages.length) return
  writeIfChanged(file, {
    ...gaps,
    counts: {
      open: pages.reduce((n, p) => n + p.gaps.length, 0),
      pages: pages.filter((p) => p.gaps.length).length,
      staged: pages.filter((p) => p.staged).length,
    },
    pages,
  })
}

/**
 * The datasets a seal cannot reach.
 *
 * LEVIATHAN's wiki instruments are baked from the snapshot and *committed*, so
 * sealing a page in `public/wiki/` leaves that page's words sitting in
 * `public/leviathan/wiki.json` — a lock on a door with the contents already
 * photocopied in the next room. The builders now skip sealed pages, which fixes
 * it on the next run and not before, so this looks for the traces and says so.
 *
 * A name match rather than a parse: these are nine instruments over one corpus
 * with nine shapes, and a scan for the slug and the title finds a mention in
 * any of them without this file having to know what any of them look like.
 */
export function staleDerived(sealed, dir = 'public/leviathan') {
  if (!existsSync(dir) || !sealed.size) return []
  const names = [...sealed]
  const stale = []
  for (const file of readdirSync(dir).filter((f) => f.endsWith('.json'))) {
    const text = readFileSync(join(dir, file), 'utf8')
    if (names.some((slug) => text.includes(`"${slug}"`))) stale.push(join(dir, file))
  }
  return stale
}

/** What to say about them. Printed by both entry points, in the same words. */
export function warnStale(stale) {
  if (!stale.length) return
  console.warn(`locks: ${stale.length} committed dataset${stale.length === 1 ? '' : 's'} still name a sealed page:`)
  for (const file of stale) console.warn(`  ${file}`)
  console.warn('  Rebuild them — they skip sealed pages now: npm run wiki-instruments && npm run leviathan')
}

// ---------------------------------------------------------------------------
// as a command: seal the snapshot that is already vendored, in place.
//
// Run it after editing wiki.locks.json. It needs no wiki-brain checkout — the
// pages it seals are the ones public/wiki already carries — which is what makes
// locking a page a thing the owner can do from this repository alone.

if (import.meta.url === `file://${process.argv[1]}`) {
  const dir = process.argv[2] ?? 'public/wiki'
  if (!existsSync(join(dir, 'index.json'))) {
    console.error(`No wiki snapshot to seal: ${dir}/index.json`)
    process.exit(1)
  }
  let manifest
  try {
    manifest = readManifest()
  } catch (err) {
    console.error(err.message)
    process.exit(1)
  }
  if (!manifest.locked.length) {
    console.log(`locks: ${MANIFEST} seals nothing. Add a slug to "locked" and run this again.`)
    process.exit(0)
  }
  let phrase
  try {
    phrase = requirePassphrase(manifest)
  } catch (err) {
    console.error(err.message)
    process.exit(1)
  }
  const { sealed, missing, already } = await sealSnapshot(dir, { locked: manifest.locked, phrase })
  for (const slug of missing) console.warn(`locks: no page "${slug}" in the snapshot — typo, or not synced yet?`)
  warnStale(staleDerived(new Set(sealed)))
  console.log(
    `locks: ${sealed.length} page${sealed.length === 1 ? '' : 's'} sealed` +
      (already ? ` (${already} already were)` : '') +
      ` -> ${dir}`,
  )
  if (sealed.length) console.log('The plaintext is gone from the snapshot. It is still in git history.')
}
