import { banner } from './slogans'

export type Section = {
  slug: string
  title: string
  /** Nav-sized name, for the rooms whose real title will not fit a chip. */
  short?: string
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
    slug: 'sage',
    title: 'THE SAGE',
    kana: '賢者',
    blurb:
      'The one room where you do the asking. Put a question about him to the record — what he did, why, or what it says he will do next — and it comes back with citations and dated quotes, including the ones that do not flatter him. Slow on purpose: nothing here improvises.',
    status: 'LIVE',
    accent: 4,
    chant: banner('sage'),
  },
  {
    slug: 'words',
    title: 'THE NET',
    short: 'WORDS',
    kana: '網',
    blurb:
      'A box for words. Type in a piece of slang or a phrase and it is filed to the wiki, where a pass counts it against 106,629 sent messages before deciding what it is. The vocabulary page is full of words picked as pleasing; this is where the measured ones come from.',
    status: 'LIVE',
    accent: 2,
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
    slug: 'docket',
    title: 'THE DOCKET',
    kana: '未決',
    blurb:
      'Everything the record has not settled, and everything it has. The collisions it is holding rather than resolving, the gaps the pages write down about themselves, the bets left standing with what would kill them, and 443 dated rulings where a doubt actually got closed. Every other room here tells you what it knows.',
    status: 'LIVE',
    accent: 4,
    chant: banner('docket'),
  },
  {
    slug: 'core',
    title: 'THE CORE',
    kana: '核心',
    blurb:
      'The whole corpus as one body, with time running up the middle of it. 519 pages hung at the dates the record gives them, 2,398 argued edges between them — nineteen kinds of claim, each one carrying the sentence that says why it was made — and 134,348 messages wrapped around the axis as the mass it all rests on. Fly through it, pick anything, and read the argument in the wiki\u2019s own words.',
    status: 'LIVE',
    accent: 4,
    chant: banner('core'),
  },
  {
    slug: 'gallery',
    title: 'THE GALLERY',
    kana: '画廊',
    blurb:
      'The old repo, photographed running. Every other room here rebuilt its work in this house’s colours; this one leaves it in its own — thirteen plates and five clips of VOID + LEVIATHAN, shot off a live checkout rather than remembered.',
    status: 'LIVE',
    accent: 2,
    chant: banner('gallery'),
  },
  {
    slug: 'transcript',
    title: 'THE TRANSCRIPT',
    kana: '記録',
    blurb:
      'The complete message record, dragged over from the old repo intact — 134,348 messages across eleven years, in the order they were sent. Every other room here argues about this material. This one is the material.',
    status: 'LIVE',
    accent: 5,
    chant: banner('transcript'),
  },
  {
    slug: 'arcade',
    title: "ALLY LUBIN'S ADVENTURE ARCADE",
    short: 'THE ARCADE',
    kana: '遊戯場',
    blurb:
      'Four cabinets, a prize counter and one name in lights. Built for a specific person about that specific person — the 2008 internet, two cats, a seventeen-year courtship and a Cancer sun. Insert nothing, play anyway.',
    status: 'LIVE',
    accent: 2,
    chant: banner('arcade'),
  },
  {
    slug: 'minimart',
    title: "JERAD'S METRIC MINIMART",
    short: 'MINIMART',
    kana: '計数',
    blurb:
      "Every other room counts something about Dan. This one counts the two repositories that build the rooms that do — lines of code, commits, pull requests, and how many of them a coding agent made rather than a human at a keyboard. Open for business, receipts included.",
    status: 'LIVE',
    accent: 2,
    chant: banner('minimart'),
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
