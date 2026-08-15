import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import {
  PortalContext,
  SESSION_KEY,
  STORAGE_KEY,
  isVibeId,
  type PortalState,
  type VibeId,
} from './portal-context'

type Prefs = { vibe: VibeId; chaos: number }

const DEFAULTS: Prefs = { vibe: 'den', chaos: 0.55 }

function readPrefs(): Prefs {
  if (typeof window === 'undefined') return DEFAULTS
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULTS
    const parsed = JSON.parse(raw) as Partial<Prefs>
    return {
      vibe: typeof parsed.vibe === 'string' && isVibeId(parsed.vibe) ? parsed.vibe : DEFAULTS.vibe,
      chaos:
        typeof parsed.chaos === 'number' && Number.isFinite(parsed.chaos)
          ? Math.min(1, Math.max(0, parsed.chaos))
          : DEFAULTS.chaos,
    }
  } catch {
    return DEFAULTS
  }
}

export function PortalProvider({ children }: { children: ReactNode }) {
  const initial = useRef<Prefs>(readPrefs())
  const [vibe, setVibe] = useState<VibeId>(initial.current.vibe)
  const [chaos, setChaos] = useState(initial.current.chaos)
  const [entered, setEntered] = useState(
    () => typeof window !== 'undefined' && window.sessionStorage.getItem(SESSION_KEY) === '1',
  )
  const [rigs, setRigs] = useState<string[]>([])
  const [lastPoked, setLastPoked] = useState<string | null>(null)

  // Paint the palette + chaos onto <html> so plain CSS can read them.
  useEffect(() => {
    document.documentElement.dataset.vibe = vibe
  }, [vibe])

  useEffect(() => {
    document.documentElement.style.setProperty('--chaos', chaos.toFixed(3))
  }, [chaos])

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ vibe, chaos }))
    } catch {
      /* private mode; preferences just will not survive the tab */
    }
  }, [vibe, chaos])

  const enter = useCallback(() => {
    setEntered(true)
    try {
      window.sessionStorage.setItem(SESSION_KEY, '1')
    } catch {
      /* no-op */
    }
  }, [])

  const registerRig = useCallback((id: string) => {
    setRigs((current) => (current.includes(id) ? current : [...current, id]))
    return () => setRigs((current) => current.filter((rig) => rig !== id))
  }, [])

  const pokeRig = useCallback((id: string) => setLastPoked(id), [])

  const value = useMemo<PortalState>(
    () => ({
      vibe,
      setVibe,
      chaos,
      setChaos,
      entered,
      enter,
      registerRig,
      rigs,
      pokeRig,
      lastPoked,
    }),
    [vibe, chaos, entered, enter, registerRig, rigs, pokeRig, lastPoked],
  )

  return <PortalContext.Provider value={value}>{children}</PortalContext.Provider>
}
