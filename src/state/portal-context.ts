import { createContext } from 'react'

export const VIBES = [
  {
    id: 'afterglow',
    name: 'AFTERGLOW',
    kana: '余韻',
    blurb: 'hot pink through black, candy over it, one cold tube',
    swatch: ['#ff1f6f', '#ff8ad4', '#3dfaff'],
  },
  {
    id: 'void',
    name: 'VOID',
    kana: '虚空',
    blurb: 'acid green, electric violet, the old house style',
    swatch: ['#9dff00', '#b026ff', '#030308'],
  },
  {
    id: 'dmt',
    name: 'DMT',
    kana: '幻',
    blurb: 'the ceiling, from the floor, everything at once',
    swatch: ['#ff2df7', '#c6ff00', '#00fff0'],
  },
  {
    id: 'hotel',
    name: 'LOVE HOTEL',
    kana: '連込',
    blurb: 'sodium through a window that does not open',
    swatch: ['#ff2e88', '#ff8a00', '#8c00ff'],
  },
  {
    id: 'griptape',
    name: 'GRIPTAPE',
    kana: '砂紙',
    blurb: 'the deck face down, bone and one acid stripe',
    swatch: ['#0a0a0a', '#f2f0e6', '#7cff2b'],
  },
  {
    id: 'riot',
    name: 'RIOT',
    kana: '暴動',
    blurb: 'photocopied twice, stapled to a lamppost, still wet',
    swatch: ['#e8e2d4', '#e01b12', '#111110'],
  },
] as const

export type VibeId = (typeof VIBES)[number]['id']

export const isVibeId = (value: string): value is VibeId =>
  VIBES.some((vibe) => vibe.id === value)

export type PortalState = {
  vibe: VibeId
  setVibe: (vibe: VibeId) => void
  /** 0 -> 1. Drives --chaos, which every loud thing on the page reads from. */
  chaos: number
  setChaos: (chaos: number) => void
  /** Splash has been dismissed for this session. */
  entered: boolean
  enter: () => void
  /** Interactive elements report in so the HUD can count them. */
  registerRig: (id: string) => () => void
  rigs: string[]
  pokeRig: (id: string) => void
  /** Most recently used rig, for the HUD readout. */
  lastPoked: string | null
  /**
   * Whether the site is allowed to move.
   *
   * Seeded from `prefers-reduced-motion` and overridable from the header. The
   * OS setting is a default, not a verdict: someone who runs macOS with Reduce
   * Motion on for the window manager has not thereby asked this site to sit
   * still forever, and until there was a switch their only way to see the
   * crawls run was to change a system-wide accessibility setting. Every moving
   * thing on the site reads the resolved answer — via this, or via the
   * `data-still` attribute it paints on `<html>` for plain CSS.
   */
  motion: boolean
  setMotion: (motion: boolean) => void
  /** Whether the header bar is collapsed (slid up out of view) */
  headerCollapsed: boolean
  toggleHeaderCollapsed: () => void
}

export const PortalContext = createContext<PortalState | null>(null)

// A stored vibe that is no longer in VIBES fails `isVibeId` on read and falls
// back to the default, so retiring a palette does not need a key bump: nobody
// gets stranded on a room that is not there any more.
//
// v4 is a bump anyway, and for the opposite reason — the same one v3 was. VOID
// survived this redesign as a room, so `isVibeId('void')` is still true, which
// means every returning visitor would have been handed back the palette the
// redesign moved off and would never have seen the one the pictures were hung
// for. The bump is one-time amnesia on purpose: everybody arrives in AFTERGLOW
// once, and anybody who wants the acid or the photocopier back is two clicks
// from either.
export const STORAGE_KEY = 'danfrank:prefs:v4'
export const SESSION_KEY = 'danfrank:entered:v1'
