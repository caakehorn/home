import { createContext } from 'react'

export const VIBES = [
  {
    id: 'moonlight',
    name: 'MOONLIGHT INN',
    kana: '月光宿',
    blurb: 'rooftop neon, crows, cup ramen at 4am',
    swatch: ['#b026ff', '#ff2bd6', '#00eaff'],
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
    swatch: ['#ff2d95', '#b4ff1a', '#14e6e6'],
  },
  {
    id: 'kaiju',
    name: 'KAIJU DREAM',
    kana: '怪獣夢',
    blurb: 'gumball planets, oni gate, too much of everything',
    swatch: ['#ff2d78', '#6ff2d4', '#ffd166'],
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
}

export const PortalContext = createContext<PortalState | null>(null)

export const STORAGE_KEY = 'moonlight-inn:prefs:v1'
export const SESSION_KEY = 'moonlight-inn:entered:v1'
