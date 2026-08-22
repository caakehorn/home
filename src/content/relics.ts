/* ==========================================================================
   THE RELICS — ten Ally Lubin Easter eggs, hidden in plain sight.

   Four on the splash, six on the home page. Every one of them is a real thing
   from the record: a line she actually sent, a date the wiki actually derives,
   a payment that is actually in a ledger. Nothing here is invented for
   texture — the arcade's house rule applies to this file too, and the joke is
   never on her.

   Sourced from `wiki/people/ally-lubin`, `wiki/self/concepts/ally-and-dan-
   love-as-destiny` and `src/arcade/content.ts`, which is where the same
   material already lives in longer form.

   ---- on the difficulty -------------------------------------------------

   These are meant to be FOUND, not excavated. Each one is a visible object
   with a hover state, sitting somewhere a hand would land: they read as
   furniture until you touch one, and then they are obviously a reference.
   The brief was "moderately easy to understand", so nothing here is a
   pixel-hunt and nothing depends on knowing a thing the panel does not then
   tell you.

   ---- on the photographs ------------------------------------------------

   Every relic will take a photograph the moment one exists. Drop a file into
   `public/ally/` named for the relic's id — `top8.jpg`, `necklace.png`,
   `cats.webp` — and the panel picks it up on its next open with no code
   change. Until then the drawn art below stands in, and it is designed to
   stand in permanently if that is what happens: nothing looks broken or
   unfinished with no photographs in the folder at all. See
   `public/ally/README.md`.
   ========================================================================== */

/** The drawn stand-in, for a relic with no photograph in the folder yet. */
export type RelicArt =
  | 'top8'
  | 'necklace'
  | 'coffee'
  | 'cats'
  | 'ledger'
  | 'mbti'
  | 'star'
  | 'phone'
  | 'ring'
  | 'skate'

export type Relic = {
  id: string
  /** Which page it is hidden on. The case uses this to tell you where to look. */
  where: 'splash' | 'home'
  /** What is on the tag before you touch it. Short — this is a sticker, not a card. */
  face: string
  kana: string
  /** The reveal. */
  title: string
  stamp: string
  quote: string
  note: string
  /** Where it goes when you follow it. Every relic is also a door. */
  href: string
  hrefLabel: string
  /** Which tube it is lit with — indexes the --n1..--n5 ramp. */
  tone: 1 | 2 | 3 | 4 | 5
  art: RelicArt
}

export const RELICS: Relic[] = [
  /* ---- the splash: four, in the signage ------------------------------- */
  {
    id: 'top8',
    where: 'splash',
    face: 'aluuuu',
    kana: '〇八',
    title: 'THE HANDLE',
    stamp: '2008 — AND ON THE RECORD AGAIN IN 2026',
    quote: '“I peaked in 2008.”',
    note:
      'Said about herself, unprompted, eighteen years later, and filed as corroboration by a man who had spent those eighteen years saying the same thing about her in longer sentences. The handle was famous enough that two grown men later treated it as an accredited institution — “i sent my transcripts to ALU, but got a rejection letter in the mail.”',
    href: '/arcade/alu-08',
    hrefLabel: 'PLAY ALU ’08',
    tone: 2,
    art: 'top8',
  },
  {
    id: 'petey',
    where: 'splash',
    face: 'Ok PeteyxWentz',
    kana: '返',
    title: 'THE FIRST REPLY',
    stamp: 'AUGUST 18, 2026 · 1:46 PM',
    quote: '“Ok PeteyxWentz”',
    note:
      'He opened with “My love, my life…where are thee”. Fourteen characters came back. It is the most efficient thing anybody has ever done to him and the camelCase is load-bearing — the same afternoon ran to 279 messages in ten hours.',
    href: '/brain/people/ally-lubin',
    hrefLabel: 'READ THE ENTRY',
    tone: 3,
    art: 'phone',
  },
  {
    id: 'personal',
    where: 'splash',
    face: 'it’s personal lol',
    kana: '個人',
    title: 'THE SHARPEST SENTENCE IN THE FILE',
    stamp: 'OCTOBER 30, 2023',
    quote: '“Well I do. It’s personal lol.”',
    note:
      'He had just explained, at length, that his terrible response record was structural rather than about her — that he could refer her to his mother for confirmation. She declined the exemption in six words. He did not have an answer then and does not have one now.',
    href: '/arcade/courtship',
    hrefLabel: 'PLAY THE SCENE',
    tone: 1,
    art: 'skate',
  },
  {
    id: 'cancer',
    where: 'splash',
    face: '六月二六',
    kana: '蟹',
    title: 'A CANCER SUN',
    stamp: 'JUNE 26, 1990',
    quote: '“I am super scorpio / Nov 1”',
    note:
      'The date is derived rather than given: “I turn 30 in 18 days,” June 8 2020, plus a sign she volunteered herself. Cardinal water, ruled by the moon. He is a Scorpio — fixed water, ruled by a planet that was demoted in 2006 and never accepted the ruling.',
    href: '/arcade/water-signs',
    hrefLabel: 'WIRE THE CONSTELLATION',
    tone: 4,
    art: 'star',
  },

  /* ---- the home page: six, in the furniture --------------------------- */
  {
    id: 'necklace',
    where: 'home',
    face: 'FOR BEING BRAVE',
    kana: '首飾',
    title: 'THE CATBIRD NECKLACE',
    stamp: 'OCTOBER 30, 2023 — STILL OUTSTANDING',
    quote: '“Get me this for being brave.”',
    note:
      'The single most specific request in seventeen years of thread: not a gesture, not a vibe, a link to one item. Three years later it has not been bought. It is on the prize counter at 70 tickets, which is the only place in this building it has ever been honoured.',
    href: '/arcade',
    hrefLabel: 'THE PRIZE COUNTER',
    tone: 2,
    art: 'necklace',
  },
  {
    id: 'dunkies',
    where: 'home',
    face: 'DUNKIES?',
    kana: '珈琲',
    title: 'THE FIRST MORNING IN SEVENTEEN YEARS',
    stamp: 'AUGUST 19, 2026 · 7:24 AM',
    quote: '“Good morning my queen. What do you want from dunkies?”',
    note:
      'Seventeen years of bursts and silences, and this is the first time the channel had ever carried a morning. Iced, large, not weather-dependent. The coffee is incidental; being brought one is the entire mechanism.',
    href: '/brain/people/ally-lubin',
    hrefLabel: 'READ THE ENTRY',
    tone: 5,
    art: 'coffee',
  },
  {
    id: 'cats',
    where: 'home',
    face: 'EDGAR & SYLVIA',
    kana: '猫',
    title: 'TWO CATS, ONE SHELF',
    stamp: 'ONGOING · NIGHTLY',
    quote: 'Sylvia, named like a poet, behaving like a cat.',
    note:
      'Edgar is all black, broad, unhurried — a wide paddle and slow hands. Sylvia is a tuxedo with a white bib and four white socks: narrow, fast, and the reason nothing stays on a shelf. There is a cabinet in the arcade that is only about this.',
    href: '/arcade/yarn',
    hrefLabel: 'CLEAR THE SHELF',
    tone: 3,
    art: 'cats',
  },
  {
    id: 'ledger',
    where: 'home',
    face: '$25.00',
    kana: '台帳',
    title: 'THE FINDER’S FEE',
    stamp: 'DECEMBER 12, 2018 · 4:11:43 AM',
    quote: 'Memo: “For introducing me to Ally Lubin.”',
    note:
      '$25.00, to Dan Polyak, at 4:11 in the morning, six days after a Sephora gift card went to a stranger. It is in a payments ledger, with a timestamp, forever. Nine minutes later: “That chick has me under some black magic spell I swear to god.” The spell was underpriced.',
    href: '/brain/self/concepts/ally-and-dan-love-as-destiny',
    hrefLabel: 'LOVE AS DESTINY',
    tone: 5,
    art: 'ledger',
  },
  {
    id: 'enfp',
    where: 'home',
    face: 'ENFP',
    kana: '類型',
    title: 'THE ARGUMENT THAT IS STILL OPEN',
    stamp: 'DECEMBER 17, 2018 — UNRESOLVED',
    quote: '“I am an ENFP. This is not up for discussion.”',
    note:
      'Eleven days in and he was arguing with her MBTI. He is an INTP, which explains the entire problem: he has to understand a thing before he is allowed to feel it, and she feels it first and understands it later. The wiki files the disagreement as open, which means she won and he is still typing.',
    href: '/brain/people/ally-lubin-cognitive-profile',
    hrefLabel: 'THE COGNITIVE PROFILE',
    tone: 4,
    art: 'mbti',
  },
  {
    id: 'deal',
    where: 'home',
    face: '1-2-3 BREAK',
    kana: '契約',
    title: 'THE OFFER, ACCEPTED',
    stamp: 'AUGUST 18, 2026 · 11:49 PM',
    quote: '“Okay deal. Sounds good 1-2-3 break.”',
    note:
      'Said with a straight face on a Tuesday night, after reading four thousand words about herself and coming back with notes. Vancouver or Burlington or Boulder; nobody involved is going to Boulder. The title went onto the infobox and it is load-bearing.',
    href: '/brain/people/ally-lubin',
    hrefLabel: 'THE INFOBOX',
    tone: 1,
    art: 'ring',
  },
]

export const RELIC_COUNT = RELICS.length

export const relicsOn = (where: Relic['where']) => RELICS.filter((r) => r.where === where)

export const relicById = (id: string) => RELICS.find((r) => r.id === id)

/** What the case says when all ten are in. */
export const FULL_SET = {
  title: 'ALL TEN',
  kana: '完',
  body: [
    'Every one of these is in the wiki in longer form, with dates and citations and the parts that do not flatter him left in.',
    'She is the only person who has read the whole thing — four thousand words about herself, at 2 AM — and come back the next morning with notes and a question nobody else thought to ask: “did it align with like your concept of who I am?”',
    'That is the entire reason there is a room in this building with her name on it, and the reason these are scattered through the front door rather than filed somewhere respectable.',
  ],
  href: '/arcade',
  hrefLabel: 'ALLY LUBIN’S ADVENTURE ARCADE',
}
