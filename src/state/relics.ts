import { useCallback, useSyncExternalStore } from 'react'
import { RELIC_COUNT } from '../content/relics'

/* ==========================================================================
   WHAT HAS BEEN FOUND

   A module-level set, mirrored into localStorage, published to React through
   `useSyncExternalStore`. It is deliberately not in PortalProvider: relics are
   found from two different pages and read by a fixed panel that outlives both,
   and threading that through the portal context would have every consumer of
   `usePortal` — which is most of the site — re-render every time somebody
   clicked a sticker.

   The snapshot has to be referentially stable between writes or
   `useSyncExternalStore` will loop, so `found` is a frozen array rebuilt only
   when the set actually changes, and never a fresh one per read.
   ========================================================================== */

const KEY = 'danfrank:relics:v1'

type Snapshot = { found: readonly string[]; count: number; complete: boolean }

let ids = new Set<string>(read())
let snapshot: Snapshot = build()
const listeners = new Set<() => void>()

function read(): string[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : []
  } catch {
    return []
  }
}

function build(): Snapshot {
  const found = Object.freeze([...ids])
  return { found, count: found.length, complete: found.length >= RELIC_COUNT }
}

function commit() {
  snapshot = build()
  try {
    window.localStorage.setItem(KEY, JSON.stringify(snapshot.found))
  } catch {
    /* private mode; the collection just will not survive the tab */
  }
  for (const listener of listeners) listener()
}

/** Idempotent: opening a relic you already have is not an event. */
export function findRelic(id: string) {
  if (ids.has(id)) return
  ids.add(id)
  commit()
}

export function resetRelics() {
  if (ids.size === 0) return
  ids = new Set()
  commit()
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

// The server snapshot is a separate frozen constant rather than `snapshot`,
// which on the client is already populated from localStorage — handing that to
// a hydration pass would be a lie about what the first paint contained.
const EMPTY: Snapshot = { found: Object.freeze([]), count: 0, complete: false }

export function useRelics() {
  const state = useSyncExternalStore(subscribe, () => snapshot, () => EMPTY)
  const has = useCallback((id: string) => state.found.includes(id), [state.found])
  return { ...state, has, total: RELIC_COUNT }
}
