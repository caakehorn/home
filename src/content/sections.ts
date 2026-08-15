export type Section = {
  slug: string
  title: string
  kana: string
  blurb: string
  status: 'LIVE' | 'WIRING' | 'DARK'
  accent: 1 | 2 | 3 | 4 | 5
  /** Marquee text that runs across the portal card on hover. */
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
    chant: 'NOTES BECOME CHARTS · CHARTS BECOME PICTURES · PICTURES BECOME NOTES ·',
  },
  {
    slug: 'leviathan',
    title: 'LEVIATHAN',
    kana: '巨獣',
    blurb:
      'The good visualizers, dragged out of the old repo, rebuilt bigger and rewired for the browser. Nothing subtle survives the port.',
    status: 'LIVE',
    accent: 1,
    chant: 'SALVAGED · REIMAGINED · OVERCLOCKED · SALVAGED · REIMAGINED · OVERCLOCKED ·',
  },
  {
    slug: 'arcade',
    title: 'ARCADE',
    kana: '遊戯場',
    blurb:
      'Experimental web games. Half of them are broken on purpose. Insert nothing, play anyway.',
    status: 'DARK',
    accent: 2,
    chant: 'NO QUARTERS · NO MERCY · NO SAVE FILES · NO QUARTERS · NO MERCY ·',
  },
  {
    slug: 'blog',
    title: 'TRANSMISSIONS',
    kana: '通信',
    blurb:
      'Long posts, short posts, screenshots at 4am, and whatever the brain coughed up that week.',
    status: 'DARK',
    accent: 5,
    chant: 'BROADCASTING FROM THE ROOF · BROADCASTING FROM THE ROOF ·',
  },
]

export const sectionBySlug = (slug: string) => SECTIONS.find((s) => s.slug === slug)
