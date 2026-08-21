/**
 * The second lock — the one on a page rather than on the building.
 *
 * The gate holds the front door, and everyone who is inside is inside for
 * everything. Some pages are not that: they are in the wiki because the wiki is
 * where thinking goes, and they are not for whoever else has the door's
 * passphrase. Those pages ship as ciphertext (`scripts/wiki-locks.mjs` seals
 * them) and this module is what opens them.
 *
 * Unlike the gate, this is not a lock on rendering. There is nothing in the
 * payload to render until the passphrase arrives: the body, the frontmatter,
 * the counts and the page's own links are all inside the blob, and the file the
 * browser fetched carries a slug, a domain and a title. Reading a sealed page
 * without the phrase is not a matter of getting past a screen.
 *
 * ---- what is kept, and where ----------------------------------------------
 *
 * The phrase goes in `sessionStorage`, so one unlock covers the tab the way the
 * door's does — a wiki is read by following links out of a page, and asking
 * again at every hop would make a sealed branch unreadable in practice. The
 * decrypted pages are kept in a module variable and never written anywhere:
 * they are the thing the seal exists for, and 250,000 PBKDF2 iterations is
 * about a third of a second, which is a cheap price to pay again on reload.
 *
 * `relock()` drops the whole keyring, not one lock. It is what the SEAL AGAIN
 * button on an opened page calls, and it is the analogue of the door's `#lock`:
 * the point of it is standing up from a borrowed laptop, and a version of that
 * which leaves the other locks open is not that.
 */
import { useSyncExternalStore } from 'react'
import { decrypt, type Blob } from '../gate/protocol'
import type { WikiPage } from './data'

/** sessionStorage: the lock passphrases this tab has proved, by lock name. */
const KEY = 'danfrank:wiki:locks:v1'

/** The fields a seal takes out of a page and a decrypt puts back. */
type Secret = Omit<WikiPage, 'slug' | 'domain' | 'title'>

/**
 * The keyring: lock name → passphrase, for the locks this tab has opened.
 *
 * Named locks rather than one phrase, because "lock some pages" turned out to
 * mean pages that are private from *different* people. A phrase that opens one
 * page should not open the next one, and a keyring keyed by lock is what makes
 * a page you gave the phrase for stay the only page you gave away.
 */
let keyring: Record<string, string> = restore()
const opened = new Map<string, WikiPage>()

// A counter rather than a boolean: components re-read through
// `useSyncExternalStore`, and unlocking twice in one tab has to be two events.
let epoch = 0
const listeners = new Set<() => void>()

function restore(): Record<string, string> {
  try {
    const raw = sessionStorage.getItem(KEY)
    const parsed = raw ? (JSON.parse(raw) as unknown) : null
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, string>) : {}
  } catch {
    return {}
  }
}

function remember() {
  try {
    if (Object.keys(keyring).length) sessionStorage.setItem(KEY, JSON.stringify(keyring))
    else sessionStorage.removeItem(KEY)
  } catch {
    /* private mode: the phrases still hold for this page's lifetime */
  }
}

function changed() {
  epoch++
  for (const listener of listeners) listener()
}

const subscribe = (listener: () => void) => {
  listeners.add(listener)
  return () => void listeners.delete(listener)
}

/**
 * Bumped whenever the keyring changes. Anything reading a sealed page depends
 * on this so that unlocking one page re-opens every sealed page already on
 * screen, and sealing again closes them.
 */
export const useLockEpoch = () => useSyncExternalStore(subscribe, () => epoch, () => epoch)

/** Is a phrase held for this page's lock? Not a claim that it still works. */
export const held = (page: WikiPage) => Boolean(page.lockId && keyring[page.lockId])

/** Is this page a sealed one that has not been opened? */
export const sealed = (page: WikiPage | null): boolean => Boolean(page?.locked && !page.open)

async function decode(page: WikiPage, blob: Blob, candidate: string): Promise<WikiPage | null> {
  try {
    const secret = JSON.parse(await decrypt(blob, candidate)) as Secret
    return { ...page, ...secret, locked: true, open: true }
  } catch {
    return null
  }
}

/**
 * A page, opened if it is sealed and this tab can open it.
 *
 * Returns the page untouched when it is not sealed, when no phrase is held, or
 * when the phrase held is the wrong one — the caller shows the lock screen for
 * all three, because from the reader's side they are the same situation.
 *
 * A held phrase that fails is dropped rather than kept. It can only be stale —
 * a phrase rotated since this tab was opened — and keeping it would mean every
 * sealed page in the tab paying for a decrypt that cannot succeed.
 */
export async function open(page: WikiPage): Promise<WikiPage> {
  if (!page.locked || !page.lock) return page
  const already = opened.get(page.slug)
  if (already) return already

  // Its own lock's phrase first, then anything else on the keyring: a snapshot
  // sealed before locks had names carries no `lockId`, and a lock that gets
  // renamed should cost a second derivation rather than a second prompt.
  const id = page.lockId ?? 'default'
  const candidates = [keyring[id], ...Object.entries(keyring).filter(([k]) => k !== id).map(([, v]) => v)]

  for (const candidate of candidates) {
    if (!candidate) continue
    const result = await decode(page, page.lock, candidate)
    if (result) {
      opened.set(page.slug, result)
      return result
    }
  }

  // Nothing held opens it. A phrase for *this* lock that no longer works can
  // only be stale — the page was re-sealed under a new one — so it is dropped
  // rather than kept to fail again on every sealed page in the tab.
  if (keyring[id]) {
    delete keyring[id]
    remember()
    changed()
  }
  return page
}

/**
 * Try a passphrase against one sealed page.
 *
 * The page is the check: there is no separate verifier blob for the seal, and
 * there should not be one — a verifier is a second thing to keep in step with
 * the ciphertext it stands in for, and the ciphertext is right here. Success
 * remembers the phrase for the tab.
 */
export async function unlock(page: WikiPage, candidate: string): Promise<WikiPage | null> {
  if (!page.lock) return null
  const result = await decode(page, page.lock, candidate)
  if (!result) return null
  keyring[page.lockId ?? 'default'] = candidate
  remember()
  opened.set(page.slug, result)
  changed()
  return result
}

/** Throw the bolt again: every phrase this tab holds and every page they opened. */
export function relock() {
  keyring = {}
  remember()
  opened.clear()
  changed()
}
