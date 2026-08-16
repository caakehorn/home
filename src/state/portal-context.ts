import { createContext } from 'react'

export const VIBES = [
  {
    id: 'basquiat',
    name: 'UNTITLED',
    kana: '王冠',
    blurb: 'raw canvas, crown, teeth — the whole thing scrawled over',
    swatch: ['#f5f0e4', '#dd2a17', '#1244c4'],
  },
  {
    id: 'riot',
    name: 'RIOT',
    kana: '暴動',
    blurb: 'photocopied twice, stapled to a lamppost, still wet',
    swatch: ['#e8e2d4', '#e01b12', '#111110'],
  },
  {
    id: 'den',
    name: 'DRUG DEN',
    kana: '薬窟',
    blurb: 'back-room neon, crows on the roof, 4am and still arguing',
    swatch: ['#f5c400', '#ff2bd6', '#1244c4'],
  },
  {
    id: 'untitled',
    name: 'UNTITLED 1982',
    kana: '無題',
    blurb: 'cadmium, cobalt, bone, and a lot of black',
    swatch: ['#ffd400', '#ef2b1c', '#2a6df5'],
  },
  {
    id: 'slime',
    name: 'SLIME DRIP',
    kana: '滴',
    blurb: 'wet letterforms, chartreuse, turquoise wall',
    swatch: ['#b4ff1a', '#ff2d95', '#14e6e6'],
  },
  {
    id: 'kaiju',
    name: 'KAIJU DREAM',
    kana: '怪獣夢',
    blurb: 'gumball planets, oni gate, too much of everything',
    swatch: ['#ef8a1f', '#e8478f', '#f5c400'],
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
  /** Oil-stick mode: the scrawl layer takes the pointer instead of the page. */
  drawing: boolean
  setDrawing: (drawing: boolean) => void
}

export const PortalContext = createContext<PortalState | null>(null)

// Bumped when the default palette changed to UNTITLED. A returning visitor
// with `den` in v1 storage would otherwise never see the new house style —
// which is not a preference they expressed, it is one they were handed.
export const STORAGE_KEY = 'danfrank:prefs:v2'
export const SESSION_KEY = 'danfrank:entered:v1'
