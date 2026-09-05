/* ==========================================================================
   THE SWITCHBOARD — the registry of every place in this building.

   The header used to be eleven chips off SECTIONS, every room a peer of every
   other room, and that bar was the whole of the wayfinding on all eighteen
   routes. The building is not eleven things. It is forty-eight: twenty-three
   built LEVIATHAN instruments behind /leviathan/:id, four arcade cabinets
   behind /arcade/:cab, five ways of reading the wiki behind ?view=, the core,
   the lattice, the sage, the net, the docket, the desk, the slate room. None
   of them was reachable in one jump from anywhere, and a reader two clicks
   into THE ATLAS had the wordmark and nothing else.

   A switchboard is where every line in a building terminates and where you
   patch one to another. This file is the jack field. Three surfaces read it and
   none of them owns it: the bar (src/nav/Switchbar.tsx), the palette
   (src/nav/Switchboard.tsx) and the room (src/routes/Board.tsx).

   ---- why the entries are typed out rather than imported ------------------

   The obvious build is to import INSTRUMENTS from src/leviathan/core.ts and
   CABS from src/arcade/content.ts and derive the jacks. It is also wrong. Those
   two files are 48 kB and 22 kB of source, and this module is imported by the
   header, which is on the critical path of every route on the site — the exact
   thing src/App.tsx spends thirty lines of comment refusing to do. Importing
   them here would drag the whole rack registry and the arcade's dialogue trees
   into the first bundle a visitor downloads to look at a nav bar.

   So the identity of each jack is written out, and `scripts/check-atlas.mjs`
   asserts every id, title and kana against the registry it came from and exits
   1 on any drift. SECTIONS is the one exception and is imported live: the
   header already paid for it.

   THE RULE applies here as everywhere. Every number any of these surfaces
   prints is a count of rows in this file, a count off a registry, a date off
   the reading trail or a word count off the wiki index. Nothing is scored,
   nothing is weighted, nothing is ranked by what somebody thought was good.
   ========================================================================== */

import { SECTIONS } from '../content/sections'

/** Which bank of the board a jack is wired into. */
export type Bank = 'BRAIN' | 'INSTRUMENTS' | 'RECORD' | 'ROOMS'

export type Destination = {
  /** Stable and unique across the whole board. Also a search key. */
  id: string
  bank: Bank
  /** A real route. `scripts/check-atlas.mjs` matches it against App.tsx. */
  to: string
  title: string
  /** Nav-sized name, for the jacks whose real title will not fit. */
  short?: string
  kana: string
  /** One line. Signage, not data — the long version lives in the room. */
  blurb: string
  /**
   * Which registry owns this jack's identity, for the check script. Absent
   * means this file is the origin and there is nothing to drift against.
   */
  from?: 'section' | 'instrument' | 'cab'
}

/* --------------------------------------------------------------------------
   THE BANKS

   Four, and the accents are 1..4 rather than 1..5 on purpose — griptape sets
   --n1 === --n5, so a fifth bank would be the first bank's colour. Four is not
   safe either: RIOT sets --n1 === --n4 and has three distinct inks in total,
   because a copy shop does not stock cadmium. So the hue is never the only
   thing carrying a bank. Every one of them also has a numeral and a kana, and
   both are rendered on every surface.
   -------------------------------------------------------------------------- */
export const BANKS: {
  id: Bank
  title: string
  kana: string
  numeral: string
  accent: 1 | 2 | 3 | 4
  note: string
}[] = [
  {
    id: 'BRAIN',
    title: 'THE BRAIN',
    kana: '脳',
    numeral: 'I',
    accent: 3,
    note: 'The wiki, five ways of reading it, and the three rooms that put a question to it. This is what the rest of the building is an instrument for.',
  },
  {
    id: 'INSTRUMENTS',
    title: 'THE INSTRUMENTS',
    kana: '計器',
    numeral: 'II',
    accent: 1,
    note: 'Everything that draws the corpus. The rack and the twenty-three of it that are built, plus the two that are rooms of their own because they are too big to be cards.',
  },
  {
    id: 'RECORD',
    title: 'THE RECORD',
    kana: '記録',
    numeral: 'III',
    accent: 4,
    note: 'Two. Neither of them argues with anything — one is the messages in the order they were sent, the other is the old repo photographed running. Everything else in this building is an argument about these.',
  },
  {
    id: 'ROOMS',
    title: 'THE ROOMS',
    kana: '館内',
    numeral: 'IV',
    accent: 2,
    note: 'Built here, about the people here. The arcade and its four cabinets, the transmissions, the desk they are written at, the shop that counts the building itself, the bench of terminals, the room where the pictures get hung, the front door and this board.',
  },
]

export const bankById = (id: Bank) => BANKS.find((b) => b.id === id)!

/** A section's own blurb, cut to the one clause a jack has room for. */
const fromSection = (slug: string): string => {
  const found = SECTIONS.find((s) => s.slug === slug)
  if (!found) return ''
  const first = found.blurb.split(/(?<=\.)\s/)[0] ?? found.blurb
  return first
}

/* --------------------------------------------------------------------------
   I — THE BRAIN

   /brain with no ?view= is the map: Wiki.tsx clears the parameter for MAP
   rather than writing `view=map`, so the bare route and the map view are the
   same jack and there is no sixth entry here pretending otherwise.
   -------------------------------------------------------------------------- */
const BRAIN: Destination[] = [
  {
    id: 'brain',
    bank: 'BRAIN',
    to: '/brain',
    title: 'WIKI-BRAIN',
    short: 'THE MAP',
    kana: '脳',
    blurb: fromSection('brain'),
    from: 'section',
  },
  {
    id: 'brain-list',
    bank: 'BRAIN',
    to: '/brain?view=list',
    title: 'THE INDEX',
    kana: '一覧',
    blurb: 'Every page that exists, filtered on two axes — what it is about and what it is.',
  },
  {
    id: 'brain-briefs',
    bank: 'BRAIN',
    to: '/brain?view=briefs',
    title: 'THE BRIEFS',
    kana: '要約',
    blurb: 'What the wiki says, opened out of the compressed block each page carries.',
  },
  {
    id: 'brain-gaps',
    bank: 'BRAIN',
    to: '/brain?view=gaps',
    title: 'THE GAPS',
    kana: '空白',
    blurb: 'What it admits it does not know, written down by the pages about themselves.',
  },
  {
    id: 'brain-buried',
    bank: 'BRAIN',
    to: '/brain?view=buried',
    title: 'THE BURIED',
    kana: '深部',
    blurb: 'What nothing points at, nobody finished, or somebody sealed.',
  },
  {
    id: 'sage',
    bank: 'BRAIN',
    to: '/sage',
    title: 'THE SAGE',
    kana: '賢者',
    blurb: fromSection('sage'),
    from: 'section',
  },
  {
    id: 'words',
    bank: 'BRAIN',
    to: '/words',
    title: 'THE NET',
    short: 'WORDS',
    kana: '網',
    blurb: fromSection('words'),
    from: 'section',
  },
  {
    id: 'docket',
    bank: 'BRAIN',
    to: '/docket',
    title: 'THE DOCKET',
    kana: '未決',
    blurb: fromSection('docket'),
    from: 'section',
  },
]

/* --------------------------------------------------------------------------
   II — THE INSTRUMENTS

   The twenty-three ids below are exactly the keys of the BUILT map in
   src/routes/Leviathan.tsx, which is what decides whether /leviathan/:id
   renders anything. The check script compares the two lists and fails on a
   difference in either direction — an instrument that gets built and is not
   added here is a jack nobody can find, and a jack here with no component
   behind it is a dead line on the board.

   Note `lattice` and `tagmap`: the route id and the instrument's own title
   disagree in the registry (THE HEALTH, THE TAGS). The id is what the URL
   needs, the title is what the rack calls it, and both are copied as they are
   rather than reconciled.
   -------------------------------------------------------------------------- */
const instrument = (id: string, title: string, kana: string, blurb: string): Destination => ({
  id: `lev-${id}`,
  bank: 'INSTRUMENTS',
  to: `/leviathan/${id}`,
  title,
  kana,
  blurb,
  from: 'instrument',
})

const INSTRUMENTS_BANK: Destination[] = [
  {
    id: 'leviathan',
    bank: 'INSTRUMENTS',
    to: '/leviathan',
    title: 'LEVIATHAN',
    short: 'THE RACK',
    kana: '巨獣',
    blurb: 'All thirty-seven, including the ten that are barred and say why.',
    from: 'section',
  },
  {
    id: 'core',
    bank: 'INSTRUMENTS',
    to: '/core',
    title: 'THE CORE',
    kana: '核心',
    blurb: 'The whole corpus as one body, with time running up the middle of it.',
    from: 'section',
  },
  {
    id: 'lineage',
    bank: 'INSTRUMENTS',
    to: '/lineage',
    title: 'THE LATTICE',
    kana: '血統',
    blurb: 'Five hundred and fifteen people, seven generations, on a real time axis.',
    from: 'section',
  },

  instrument('mass', 'THE MASS', '質量', 'Every message ever sent, drawn as the weight it is.'),
  instrument('chronology', 'THE CHRONOLOGY', '年代', 'The record on one line, end to end.'),
  instrument('pen', 'THE PEN', '筆', 'What was written, when, and how much of it.'),
  instrument('accretion', 'THE ACCRETION', '堆積', 'The corpus arriving, layer by layer.'),
  instrument('recorder', 'THE RECORDER', '記録計', 'The instrument that watches the instruments.'),
  instrument('pulse', 'THE PULSE', '脈', 'Messages per unit time, at the resolution you ask for.'),
  instrument('clock', 'THE CLOCK', '時計', 'What hour of the day this record happens at.'),
  instrument('atlas', 'THE ATLAS', '地図', 'Where it happened. Drawn by hand, and it says so.'),
  instrument('lexicon', 'THE LEXICON', '語彙', 'The words, counted, with nothing chosen for being interesting.'),
  instrument('rings', 'THE RINGS', '年輪', 'Years as growth rings, sized by what landed in them.'),
  instrument('silence', 'THE SILENCE', '沈黙', 'The gaps at their true width. A hole is not a quiet.'),
  instrument('ask', 'THE ASK', '請求', 'What was asked for, and how often.'),
  instrument('web', 'THE WEB', '網', 'The wiki as the links between its pages.'),
  instrument('claims', 'THE CLAIMS', '主張', 'Every argued edge, carrying the sentence that made it.'),
  instrument('census', 'THE CENSUS', '戸籍', 'Who is in here, counted.'),
  instrument('tagmap', 'THE TAGS', '標識', 'What the pages label themselves.'),
  instrument('lattice', 'THE HEALTH', '健全', 'Which pages are finished, which are stubs, which are sealed.'),
  instrument('evidence', 'THE EVIDENCE', '証拠', 'What is cited, and what is asserted with nothing behind it.'),
  instrument('attention', 'THE ATTENTION', '注意', 'Where the writing went, measured in words.'),
  instrument('schema', 'THE SCHEMA', '図式', 'The shape of the frontmatter, across every page.'),
  instrument('echo', 'THE ECHO', '谺', 'What the corpus says twice.'),
  instrument('genesis', 'THE GENESIS', '創世', 'The first appearance of everything.'),
  instrument('chronicle', 'THE CHRONICLE', '年代記', 'The wiki on a date axis, page by page.'),
]

/* --------------------------------------------------------------------------
   III — THE RECORD
   -------------------------------------------------------------------------- */
const RECORD: Destination[] = [
  {
    id: 'transcript',
    bank: 'RECORD',
    to: '/transcript',
    title: 'THE TRANSCRIPT',
    kana: '記録',
    blurb: fromSection('transcript'),
    from: 'section',
  },
  {
    id: 'gallery',
    bank: 'RECORD',
    to: '/gallery',
    title: 'THE GALLERY',
    kana: '画廊',
    blurb: fromSection('gallery'),
    from: 'section',
  },
]

/* --------------------------------------------------------------------------
   IV — THE ROOMS

   The four cabinet ids are the keys of CABS in src/arcade/content.ts, and the
   check script asserts the titles against it.
   -------------------------------------------------------------------------- */
const cab = (id: string, title: string, kana: string, blurb: string): Destination => ({
  id: `cab-${id}`,
  bank: 'ROOMS',
  to: `/arcade/${id}`,
  title,
  kana,
  blurb,
  from: 'cab',
})

const ROOMS: Destination[] = [
  {
    id: 'home',
    bank: 'ROOMS',
    to: '/',
    title: 'THE MAIN FLOOR',
    short: 'HOME',
    kana: '玄関',
    blurb: 'The front door, the rigs, and the way into everything else.',
  },
  {
    id: 'board',
    bank: 'ROOMS',
    to: '/board',
    title: 'THE SWITCHBOARD',
    short: 'THE BOARD',
    kana: '配電盤',
    blurb: 'This board, at an address of its own. Every jack in the building, in one field.',
  },
  {
    id: 'arcade',
    bank: 'ROOMS',
    to: '/arcade',
    title: "ALLY LUBIN'S ADVENTURE ARCADE",
    short: 'THE ARCADE',
    kana: '遊戯場',
    blurb: 'Four cabinets, a prize counter and one name in lights.',
    from: 'section',
  },
  cab('alu-08', 'ALU ’08', '〇八', 'Catch the old internet. Dodge what replaced it.'),
  cab('yarn', 'EDGAR & SYLVIA', '猫', 'Two cats, one shelf, and a wall of things that will not survive the night.'),
  cab('courtship', 'THE COURTSHIP CONSOLE', '求愛', 'Seventeen years, eight scenes, and every line was actually said.'),
  cab('water-signs', 'WATER SIGNS', '星', 'A Cancer sun, plotted. Wire the constellation star by star.'),
  {
    id: 'blog',
    bank: 'ROOMS',
    to: '/blog',
    title: 'TRANSMISSIONS',
    kana: '通信',
    blurb: fromSection('blog'),
    from: 'section',
  },
  {
    id: 'blog-write',
    bank: 'ROOMS',
    to: '/blog/write',
    title: 'THE DESK',
    kana: '執筆',
    blurb: 'Where the transmissions get written. Drafts live in this browser and nowhere else.',
  },
  {
    id: 'minimart',
    bank: 'ROOMS',
    to: '/minimart',
    title: "JERAD'S METRIC MINIMART",
    short: 'MINIMART',
    kana: '計数',
    blurb: fromSection('minimart'),
    from: 'section',
  },
  {
    id: 'tool',
    bank: 'ROOMS',
    to: '/tool',
    title: 'THE TOOL',
    kana: '工具',
    blurb: fromSection('tool'),
    from: 'section',
  },
  {
    id: 'slates',
    bank: 'ROOMS',
    to: '/slates',
    title: 'THE SLATE ROOM',
    short: 'THE SLATES',
    kana: '掲示',
    blurb: fromSection('slates'),
    from: 'section',
  },
]

/* --------------------------------------------------------------------------
   /ledger IS DELIBERATELY ABSENT, AND STAYS ABSENT.

   src/App.tsx routes it and says why in a comment: it is not in SECTIONS, so it
   is not a chip in the bar, and it is reached by typing its URL — which on a
   phone means the home screen, and two taps from locked to logged. It is a
   substance intake tracker. Putting it on a board that four surfaces render,
   or in a palette that fuzzy-matches three letters, undoes that on purpose.

   The check script asserts it is missing. If you are here to "fix" the
   omission, it is not one.
   -------------------------------------------------------------------------- */

/** Every jack on the board, in bank order. */
export const DESTINATIONS: Destination[] = [...BRAIN, ...INSTRUMENTS_BANK, ...RECORD, ...ROOMS]

export const inBank = (bank: Bank) => DESTINATIONS.filter((d) => d.bank === bank)

export const destinationById = (id: string) => DESTINATIONS.find((d) => d.id === id)

/**
 * The jack a path is currently sitting on, longest match first so
 * /leviathan/atlas beats /leviathan and /brain?view=list beats /brain.
 * Search strings are compared whole: ?view=list and ?view=gaps are two jacks.
 */
export function destinationFor(pathname: string, search = ''): Destination | undefined {
  const here = `${pathname}${search}`
  let best: Destination | undefined
  for (const d of DESTINATIONS) {
    if (d.to !== '/' && (here === d.to || here.startsWith(`${d.to}/`))) {
      if (!best || d.to.length > best.to.length) best = d
    }
  }
  if (!best && pathname === '/') return destinationById('home')
  return best
}
