import { banner } from './slogans'

export type Section = {
  slug: string
  title: string
  kana: string
  blurb: string
  status: 'LIVE' | 'WIRING' | 'DARK'
  accent: 1 | 2 | 3 | 4 | 5
  /** Marquee text on the card and across the room's own header. */
  chant: string
}

export const SECTIONS: Section[] = [
  {
    slug: 'brain',
    title: 'WIKI-BRAIN',
    kana: '脳',
    blurb:
      'The whole tangle, searchable. Now it eats its own notes and spits out charts, diagrams, maps and images of whatever it just told you.',
    status: 'LIVE',
    accent: 3,
    chant: banner('brain'),
  },
  {
    slug: 'lineage',
    title: 'THE LATTICE',
    kana: '血統',
    blurb:
      'The family tree on a real time axis — 515 people, seven generations, every ancestor sized by how much of the genome came through them. Including the one the record loses.',
    status: 'LIVE',
    accent: 4,
    chant: banner('lineage'),
  },
  {
    slug: 'leviathan',
    title: 'LEVIATHAN',
    kana: '巨獣',
    blurb:
      'The good visualizers, dragged out of the old repo, rebuilt bigger and rewired for the browser. Nothing subtle survives the port.',
    status: 'LIVE',
    accent: 1,
    chant: banner('leviathan'),
  },
  {
    slug: 'arcade',
    title: 'ARCADE',
    kana: '遊戯場',
    blurb:
      'Experimental web games. Half of them are broken on purpose. Insert nothing, play anyway.',
    status: 'DARK',
    accent: 2,
    chant: banner('arcade'),
  },
  {
    slug: 'blog',
    title: 'TRANSMISSIONS',
    kana: '通信',
    blurb:
      'Long posts, short posts, screenshots at 4am, and whatever the brain coughed up that week. Flyposted, not published. No RSS, no newsletter, no metrics — nobody is counting you.',
    status: 'LIVE',
    accent: 5,
    chant: banner('blog'),
  },
]

export const sectionBySlug = (slug: string) => SECTIONS.find((s) => s.slug === slug)
