import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import {
  PortalContext,
  SESSION_KEY,
  STORAGE_KEY,
  isReadMode,
  isVibeId,
  type PortalState,
  type ReadMode,
  type VibeId,
} from './portal-context'

/** `motion: null` means nobody has chosen — follow the OS, and keep following it. */
type Prefs = { vibe: VibeId; chaos: number; motion: boolean | null; readMode: ReadMode }

// VOID is the house palette: acid green and electric violet on black. RIOT is
// still in the rack — it is a room off the street now rather than the street.
// Chaos opens higher than it used to, because the building is louder than it
// used to be and 0.55 now reads as the site holding something back.
// `readMode: 'full'` is the default because the wiki as written is the artifact
// — the digest is a way in, not a replacement for it. Someone who wants the
// plain edition asks for it once and it sticks.
const DEFAULTS: Prefs = { vibe: 'void', chaos: 0.68, motion: null, readMode: 'full' }

const REDUCE = '(prefers-reduced-motion: reduce)'

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
      motion: typeof parsed.motion === 'boolean' ? parsed.motion : DEFAULTS.motion,
      readMode:
        typeof parsed.readMode === 'string' && isReadMode(parsed.readMode)
          ? parsed.readMode
          : DEFAULTS.readMode,
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

  // The OS preference, tracked live — someone who turns Reduce Motion on mid-
  // session and has never touched the switch should see the site settle without
  // reloading.
  const [osCalm, setOsCalm] = useState(
    () => typeof window !== 'undefined' && window.matchMedia(REDUCE).matches,
  )
  const [motionPref, setMotionPref] = useState<boolean | null>(initial.current.motion)
  const [headerCollapsed, setHeaderCollapsed] = useState(false)
  const [readMode, setReadMode] = useState<ReadMode>(initial.current.readMode)

  useEffect(() => {
    const mq = window.matchMedia(REDUCE)
    const sync = () => setOsCalm(mq.matches)
    sync()
    mq.addEventListener('change', sync)
    return () => mq.removeEventListener('change', sync)
  }, [])

  // An explicit choice outranks the OS; absent one, the OS decides.
  const motion = motionPref ?? !osCalm

  // Paint the palette + chaos onto <html> so plain CSS can read them.
  useEffect(() => {
    document.documentElement.dataset.vibe = vibe
  }, [vibe])

  useEffect(() => {
    document.documentElement.style.setProperty('--chaos', chaos.toFixed(3))
  }, [chaos])

  // The single resolved answer, published for plain CSS. Every stylesheet keys
  // its still variant off this rather than off the media query directly, so the
  // OS preference and the switch cannot disagree about what the page is doing.
  useEffect(() => {
    document.documentElement.dataset.still = motion ? '0' : '1'
  }, [motion])

  useEffect(() => {
    try {
      window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ vibe, chaos, motion: motionPref, readMode }),
      )
    } catch {
      /* private mode; preferences just will not survive the tab */
    }
  }, [vibe, chaos, motionPref, readMode])

  // Published for plain CSS, the same way the palette and the motion answer
  // are: the digest edition wants a wider measure and a calmer type scale, and
  // that is a stylesheet's job rather than a prop threaded through every page.
  useEffect(() => {
    document.documentElement.dataset.read = readMode
  }, [readMode])

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
  const toggleHeaderCollapsed = useCallback(() => setHeaderCollapsed((c) => !c), [])

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
      motion,
      setMotion: setMotionPref,
      readMode,
      setReadMode,
      headerCollapsed,
      toggleHeaderCollapsed,
    }),
    [vibe, chaos, entered, enter, registerRig, rigs, pokeRig, lastPoked, motion, readMode, headerCollapsed, toggleHeaderCollapsed],
  )

  return <PortalContext.Provider value={value}>{children}</PortalContext.Provider>
}
