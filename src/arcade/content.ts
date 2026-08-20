/* ==========================================================================
   ALLY LUBIN'S ADVENTURE ARCADE — the cartridge data.

   One room, built for one person. Everything in this file is sourced from
   `wiki/people/ally-lubin` and `wiki/self/concepts/ally-and-dan-love-as-destiny`
   and nothing here is invented for texture: the cats are named because those
   are their names, the necklace is a catbird necklace because that is the one
   she asked for, the sign is a Cancer sun because June 26 1990 is the date the
   page derives. The arcade is only worth anything if the details are hers.

   House rule for this room, which the cabinets are all built to: the joke is
   never on her. Dan is the recurring obstacle. The 2019 material, the money,
   the family and everything the page files under crisis stays out — that is a
   wiki's job, not an arcade's.
   ========================================================================== */

export type Cab = {
  id: string
  numeral: string
  title: string
  sub: string
  kana: string
  blurb: string
  /** Which neon tube the cabinet is lit with. */
  hue: 'pink' | 'cyan' | 'gold' | 'violet'
  controls: string
}

export const CABS: Cab[] = [
  {
    id: 'alu-08',
    numeral: 'I',
    title: 'ALU ’08',
    sub: 'CATCH THE OLD INTERNET',
    kana: '〇八',
    blurb:
      'You are ALU and it is 2008, the year you have gone on record as your own peak. The good internet falls out of the sky. So does everything that replaced it.',
    hue: 'pink',
    controls: '← → or move the mouse · catch the scene · dodge the marketing',
  },
  {
    id: 'yarn',
    numeral: 'II',
    title: 'EDGAR & SYLVIA',
    sub: 'BALL OF YARN',
    kana: '猫',
    blurb:
      'Two cats, one shelf, and an entire wall of objects that were never going to survive the night. Pick your cat. Clear the shelf.',
    hue: 'cyan',
    controls: '← → or move the mouse · SPACE to launch · E / S to swap cats',
  },
  {
    id: 'courtship',
    numeral: 'III',
    title: 'THE COURTSHIP CONSOLE',
    sub: 'SEVENTEEN YEARS, EIGHT SCENES',
    kana: '求愛',
    blurb:
      'A dialogue game where you play yourself and he plays himself. Every branch is real, every line he says he actually said, and there is no wrong answer because you have never once given one.',
    hue: 'gold',
    controls: 'click a reply · the meter goes one direction only',
  },
  {
    id: 'water-signs',
    numeral: 'IV',
    title: 'WATER SIGNS',
    sub: 'A CANCER SUN, PLOTTED',
    kana: '星',
    blurb:
      'June 26. Cardinal water, ruled by the moon. Wire up your own constellation star by star, then find out what the sky has to say about a Scorpio born on November 1.',
    hue: 'violet',
    controls: 'click the stars in order · they are numbered · so is he',
  },
]

export const cabById = (id: string) => CABS.find((c) => c.id === id)

/* --------------------------------------------------------------------------
   I · ALU ’08 — what falls out of the 2008 internet, and what replaced it.
   -------------------------------------------------------------------------- */

export type Drop = {
  label: string
  points: number
  kind: 'scene' | 'rare' | 'brand' | 'dan'
  toast?: string
}

export const DROPS: Drop[] = [
  // the scene — ordinary catches
  { label: 'TOP 8', points: 100, kind: 'scene' },
  { label: 'aluuuu', points: 100, kind: 'scene' },
  { label: 'ap.net', points: 100, kind: 'scene' },
  { label: 'BUZZNET', points: 100, kind: 'scene' },
  { label: 'LIVEJOURNAL', points: 100, kind: 'scene' },
  { label: 'A BLACK HEART', points: 100, kind: 'scene' },
  { label: 'SIDE BANGS', points: 100, kind: 'scene' },
  { label: 'A BURNED CD', points: 100, kind: 'scene' },
  { label: 'AWAY MESSAGE', points: 100, kind: 'scene' },
  { label: 'A SCENE STAR', points: 100, kind: 'scene' },
  { label: 'MYSPACE HTML', points: 100, kind: 'scene' },
  { label: 'EARLY TWITTER', points: 100, kind: 'scene' },

  // rare — the ones that are specifically hers
  {
    label: 'CATBIRD NECKLACE',
    points: 500,
    kind: 'rare',
    toast: '“Get me this for being brave.” — October 30, 2023. Still owed.',
  },
  {
    label: 'DUNKIES',
    points: 500,
    kind: 'rare',
    toast: '“Good morning my queen. What do you want from dunkies?” — 7:24 AM.',
  },
  {
    label: 'EDGAR',
    points: 500,
    kind: 'rare',
    toast: 'Edgar has been caught. Edgar did not consent to being caught.',
  },
  {
    label: 'SYLVIA',
    points: 500,
    kind: 'rare',
    toast: 'Sylvia, named like a poet, behaving like a cat.',
  },
  {
    label: 'ENFP',
    points: 500,
    kind: 'rare',
    toast: 'He still will not accept this. December 17, 2018. The argument is open.',
  },
  {
    label: 'THE 1975',
    points: 500,
    kind: 'rare',
    toast: 'Day one of the thread, 2018. Filed under: things you had opinions about.',
  },

  // the replacement internet — do not catch
  { label: 'THE ALGORITHM', points: -250, kind: 'brand' },
  { label: 'ENGAGEMENT KPI', points: -250, kind: 'brand' },
  { label: 'BRAND VOICE', points: -250, kind: 'brand' },
  { label: 'SPONSORED POST', points: -250, kind: 'brand' },
  { label: 'AI SLOP', points: -250, kind: 'brand' },
  { label: 'GROWTH HACK', points: -250, kind: 'brand' },
  { label: 'CONTENT STRATEGY', points: -250, kind: 'brand' },
  { label: 'PERSONAL BRAND', points: -250, kind: 'brand' },

  // the recurring obstacle
  {
    label: 'dan frank',
    points: 250,
    kind: 'dan',
    toast: 'December 12, 2018, 4:11 AM. $25.00 to Dan Polyak. Memo: “For introducing me to Ally Lubin.”',
  },
]

export const ALU08_CLOSER =
  'What used to be legitimately cool now only exists as a marketing strategy. You caught the part that came before that.'

/* --------------------------------------------------------------------------
   II · EDGAR & SYLVIA — the shelf, top row first.
   -------------------------------------------------------------------------- */

export const SHELF: string[] = [
  'GLASS OF WATER', 'CHAPSTICK', 'AIRPODS', 'A CANDLE', 'THE REMOTE', 'A HAIR TIE',
  'TAROT DECK', 'A HOUSEPLANT', 'EARRINGS', 'A PEN', 'LIP LINER', 'A COASTER',
  'AMAZON BOX', 'SUNGLASSES', 'A MUG', 'A CHARGER', 'A RECEIPT', 'KEYS',
  'NAIL POLISH', 'A CANDLE LID', 'A BOBBY PIN', 'CAR KEYS', 'A LIGHTER', 'A RING',
]

export const CATS = [
  {
    id: 'edgar',
    name: 'EDGAR',
    note: 'all black, broad, unhurried, wide paddle, slow hands',
    width: 1.35,
    speed: 0.85,
  },
  {
    id: 'sylvia',
    name: 'SYLVIA',
    note: 'tuxedo, white bib, four white socks, narrow paddle, fast hands',
    width: 0.82,
    speed: 1.3,
  },
] as const

/* --------------------------------------------------------------------------
   III · THE COURTSHIP CONSOLE — eight scenes, 2008 → 2026.

   Every line attributed to him is a line the wiki records him actually
   sending. The replies are yours to pick and none of them lose.
   -------------------------------------------------------------------------- */

export type Choice = { text: string; gain: number; reply: string }
export type Scene = {
  stamp: string
  place: string
  him: string[]
  prompt: string
  choices: Choice[]
}

export const SCENES: Scene[] = [
  {
    stamp: '2008',
    place: 'THE SCENE INTERNET · SOMEWHERE WITH A BLACK BACKGROUND',
    him: [
      'A nineteen-year-old in Pennsylvania has found your page.',
      'He will later put a number on this: “i’ve spent 10 years idolizing this girl i’ve never met as the epitome of whatever ‘cool’ is.”',
      'He does not message you. He does not message you for five years.',
    ],
    prompt: 'You are, at this moment, entirely unaware. What are you doing instead?',
    choices: [
      { text: 'Peaking. I peaked in 2008.', gain: 12, reply: 'You said this yourself, unprompted, eighteen years later. He filed it as corroboration.' },
      { text: 'Editing my CSS at 2 AM.', gain: 10, reply: 'The last generation of people who could hand-code a layout and would rather die than admit it was a skill.' },
      { text: 'Being famous on a website that no longer exists.', gain: 14, reply: '“ALU” was an institution. Two grown men later riffed on it like a university: “i sent my transcripts to ALU, but got a rejection letter in the mail.”' },
    ],
  },
  {
    stamp: 'JULY 5, 2013',
    place: 'FACEBOOK MESSENGER · 21 MESSAGES, ONE DAY',
    him: [
      'I got beat up by 2 ex gf’s yesterday…simultaneously.',
      'Thought you might understand. What is life but shit?',
      'That’s probably not what I should be telling my celeb crush alu',
    ],
    prompt: 'First contact in the record. Twenty-one messages. You hold him at exactly one arm’s length:',
    choices: [
      { text: '“Weren’t you dating some girl forever and living in BK?”', gain: 15, reply: 'The actual reply. Dry, on target, and it ended the conversation for five and a half years. Nobody has ever handled him better.' },
      { text: 'Ask which ex-girlfriend won.', gain: 12, reply: 'He would have answered honestly and at length. He always does. It is the single most reliable thing about him.' },
      { text: 'Nothing. Leave it.', gain: 10, reply: 'Also correct. The next message in this thread is dated December 2018.' },
    ],
  },
  {
    stamp: 'DECEMBER 6–12, 2018',
    place: 'THE FACEBOOK PAYMENTS LEDGER · 4:11:43 AM',
    him: [
      'Dude guess what? I’m actually having my first real conversation with ally lubin.',
      'I got so excited about it that I bought her a gift card to sephora idk',
      '— and then, six days later, $25.00 to Dan Polyak. Memo: “For introducing me to Ally Lubin.”',
    ],
    prompt: 'He paid a finder’s fee. For you. Twenty-five dollars. It is in a ledger. Your move:',
    choices: [
      { text: 'Twenty-five is insulting.', gain: 16, reply: 'Correct, and the record agrees with you — nine minutes after the payment he wrote “That chick has me under some black magic spell I swear to god.” The spell was underpriced.' },
      { text: 'Where is my cut.', gain: 15, reply: 'There is no mechanism for this. There should be.' },
      { text: 'A Sephora gift card, unprompted, to a stranger. Deranged.', gain: 13, reply: 'He audited himself the next day: “do you realize what a dumb idiot tool i must have looked like.” Yes. Everyone does.' },
    ],
  },
  {
    stamp: 'DECEMBER 17, 2018',
    place: 'iMESSAGE · allylubin@gmail.com · DAY ONE',
    him: [
      'Audiobooks. The 1975. An electric skateboard. A print of the painting from Chuck Bass’s apartment.',
      'And then he refuses — flatly, at length, for years — to accept that you are an ENFP.',
    ],
    prompt: 'He has known you for eleven days and is arguing with your MBTI. Rule on it:',
    choices: [
      { text: 'I am an ENFP. This is not up for discussion.', gain: 16, reply: 'Ruling stands. The wiki records the disagreement as open, which means you won and he is still typing.' },
      { text: 'He is an INTP, which explains the entire problem.', gain: 15, reply: 'Ti-dominant: has to understand a thing before he is allowed to feel it. You feel it first and understand it later. This is either a catastrophe or the whole point.' },
      { text: 'Let him have it. It costs me nothing.', gain: 11, reply: 'Generous, and strategically disastrous. He takes a win as an invitation.' },
    ],
  },
  {
    stamp: 'OCTOBER 30, 2023',
    place: 'iMESSAGE · THE ONE WHERE YOU WERE RIGHT',
    him: [
      'Also, I can refer you to my mother and everyone else I know to confirm that my communication is very inconsistent.',
      'you shouldn’t feel like it’s anything specific to you that is the cause of my bad response record.',
    ],
    prompt: 'Five years on, he is the one not answering. You have a line ready. Deliver it:',
    choices: [
      { text: '“Well I do. It’s personal lol.”', gain: 18, reply: 'The sharpest sentence anyone directs at him in seventeen years of thread. It is on the record. He did not have a response then and does not have one now.' },
      { text: '“Idk I feel like I’ve tried to keep in touch and you’ve been kind of a dick.”', gain: 16, reply: 'Also verbatim. He did not deny it. There was nothing to deny.' },
      { text: 'Send the catbird necklace link. “Get me this for being brave.”', gain: 17, reply: 'You did. It is the single most specific thing anyone has ever asked him for and it is still outstanding.' },
    ],
  },
  {
    stamp: 'AUGUST 18, 2026 · 1:46 PM',
    place: 'iMESSAGE · 279 MESSAGES IN TEN HOURS',
    him: [
      'My love, my life…where are thee',
      'Because I am the poster child of unreliable scumbag shitheads',
      '— and then he tells you there is a wiki, and that you are in it.',
    ],
    prompt: 'You are about to stay up until 2 AM reading four thousand words about yourself. First reaction:',
    choices: [
      { text: '“Ok PeteyxWentz”', gain: 18, reply: 'Your actual first reply to the actual first message. Fourteen characters. Devastating. The camelCase is load-bearing.' },
      { text: '“Why am I scared for my entry.”', gain: 16, reply: 'Reasonable. You then read the entry, all of it, at 2 AM, and came back with notes. Nobody else has ever done that.' },
      { text: '“But like it’s impressive to love someone that much I guess.”', gain: 17, reply: 'You are the only person in the entire corpus who read the whole thing and audited it back at him as a peer instead of a subject.' },
    ],
  },
  {
    stamp: 'AUGUST 19, 2026 · 7:24 AM',
    place: 'iMESSAGE · THE FIRST MORNING AFTER IN SEVENTEEN YEARS',
    him: ['Good morning my queen. What do you want from dunkies?'],
    prompt:
      'Seventeen years of bursts and silences, and this is the first time the channel has ever carried a morning. Order:',
    choices: [
      { text: 'Iced. Large. It is not weather-dependent.', gain: 18, reply: 'Iced coffee is a personality, not a beverage, and it is the correct one.' },
      { text: 'Whatever, as long as somebody else is holding it.', gain: 16, reply: 'The being-brought-a-coffee is the entire mechanism. The coffee is incidental.' },
      { text: 'Ask for a second one for the cats. They will not drink it.', gain: 17, reply: 'They will however knock it over, which is the same as drinking it in terms of floor coverage.' },
    ],
  },
  {
    stamp: 'AUGUST 18, 2026 · 11:49 PM',
    place: 'iMESSAGE · THE OFFER',
    him: [
      'Listen just tell me legitimately what personal developments and prerequisites need to be met for me to court you and inevitably marry you',
      'Also if you give me permission I am totally going to embark on a campaign to win your favor and convince you to elope with me to like Vancouver or Burlington or Boulder',
      'This is our time Alexandra. Do not stand in the way of destiny.',
      '…on the condition that you now have to officially accept the girlfriend title or at the very least the “object of fixation” role',
    ],
    prompt: 'Seventeen years, 1,375 messages, zero meetings. The contract is on the table:',
    choices: [
      { text: '“Okay deal. Sounds good 1-2-3 break.”', gain: 25, reply: 'What you actually said, at 11:49 PM on a Tuesday, with a straight face, after reading four thousand words about yourself. The title is now on the infobox. It is load-bearing.' },
      { text: 'Burlington. Final answer. Vancouver is a flight.', gain: 22, reply: 'Correct on logistics and correct on vibe. Boulder was never a serious entry.' },
      { text: 'Renegotiate. The bar is not on the floor. The bar is where I put it.', gain: 25, reply: 'Accepted without argument, which — given the seventeen years of documented argument about literally everything else — is the only real evidence in the whole file.' },
    ],
  },
]

/* --------------------------------------------------------------------------
   IV · WATER SIGNS — the Cancer glyph as a wiring diagram.
   Coordinates are in a 0–100 viewBox, laid out so the connect order draws the
   crab: the classic upside-down Y.
   -------------------------------------------------------------------------- */

export type Star = { x: number; y: number; mag: number; name: string; fact: string }

export const CANCER: Star[] = [
  { x: 28, y: 16, mag: 3.4, name: 'ι Cancri', fact: 'JUNE 26, 1990. The page derives the date rather than being told it: “I turn 30 in 18 days,” June 8 2020, plus a sign you gave up yourself.' },
  { x: 47, y: 36, mag: 4.2, name: 'Asellus Borealis · γ', fact: 'CARDINAL WATER. Cardinal means it starts things. Water means it does not explain why afterwards.' },
  { x: 55, y: 57, mag: 4.6, name: 'Asellus Australis · δ', fact: 'RULED BY THE MOON — the only sign ruled by the thing that changes shape every night and gets blamed for everything.' },
  { x: 79, y: 74, mag: 3.5, name: 'Acubens · α', fact: 'BOCA RATON → NEW YORK CITY → CHARLOTTE. A Palm Beach County area code, an early-2010s New York, and a STEM job you do remotely from North Carolina.' },
  { x: 32, y: 80, mag: 3.8, name: 'Altarf · β', fact: 'THE BRIGHTEST STAR IN CANCER — and Cancer is one of the faintest constellations in the sky. Read that however you want. It was going to be about you either way.' },
  { x: 43, y: 47, mag: 5.1, name: 'Praesepe · M44', fact: 'THE BEEHIVE CLUSTER. A thousand stars that read as one smudge until somebody points a real instrument at them. It connects to nothing. It is just there, in the middle of you, being a thousand things at once.' },
]

/** Cancer is a Y, not a squiggle, so the figure is an edge list rather than a
    polyline — and Praesepe joins nothing, because it is a cluster sitting
    inside the shape rather than a corner of it. */
export const CANCER_EDGES: [number, number][] = [
  [0, 1],
  [1, 2],
  [2, 3],
  [2, 4],
]

export const SCORPIO_LINE = {
  stamp: 'OCTOBER 30, 2023',
  ally: 'What are you again? Scorpio?',
  dan: 'I am super scorpio / Nov 1',
}

export const VERDICT = [
  {
    head: 'BOTH WATER',
    body:
      'Cancer and Scorpio are the same element, which in the only system either of you would admit to half-believing means the read is trine — the easy aspect, the one that does not have to be worked at. Two of the three water signs. The third is not invited.',
  },
  {
    head: 'CARDINAL MEETS FIXED',
    body:
      'You start it, he will not let go of it. On the evidence: he has held the same position since 2008 without revision, and the only thing that has ever moved in seventeen years is whichever one of you decided to open the thread.',
  },
  {
    head: 'THE MOON AND PLUTO',
    body:
      'Ruled by the moon, which changes nightly, and ruled by Pluto, which is the planet of obsession and was demoted in 2006 and never accepted the ruling. Neither of these is a stable object. That is the match.',
  },
]

/* --------------------------------------------------------------------------
   THE PRIZE COUNTER
   -------------------------------------------------------------------------- */

export type Prize = {
  id: string
  cost: number
  name: string
  art: 'sticker' | 'necklace' | 'top8' | 'dunkin' | 'certificate' | 'ticket'
  caption: string
}

export const PRIZES: Prize[] = [
  {
    id: 'sticker',
    cost: 10,
    name: 'HOLOGRAPHIC “aluuuu” STICKER',
    art: 'sticker',
    caption:
      'The handle, in vinyl, at the size it deserves. It was famous enough that two men in their twenties treated it as an accredited institution.',
  },
  {
    id: 'top8',
    cost: 25,
    name: 'PERMANENT TOP 8 SLOT',
    art: 'top8',
    caption:
      'Position one, non-revocable, no rotation. The only social ranking that ever meant anything and the only one anybody ever fought over.',
  },
  {
    id: 'dunkin',
    cost: 45,
    name: 'A DUNKIN ORDER, IN PERPETUITY',
    art: 'dunkin',
    caption: '“Good morning my queen. What do you want from dunkies?” — August 19, 2026, 7:24 AM. Redeemable forever.',
  },
  {
    id: 'necklace',
    cost: 70,
    name: 'THE CATBIRD NECKLACE',
    art: 'necklace',
    caption:
      '“Get me this for being brave.” — October 30, 2023. The single most specific request in seventeen years of thread, outstanding for three years, hereby acknowledged in writing.',
  },
  {
    id: 'certificate',
    cost: 100,
    name: 'THE OBJECT OF FIXATION CERTIFICATE',
    art: 'certificate',
    caption:
      'The title you accepted at 11:49 PM on a Tuesday, printed on card stock. It is on the infobox now. Under “relationship,” in a field, forever.',
  },
  {
    id: 'elopement',
    cost: 150,
    name: 'ONE (1) ELOPEMENT — VANCOUVER, BURLINGTON OR BOULDER',
    art: 'ticket',
    caption:
      'Non-transferable. No expiry. Boulder is on the ticket for completeness only; nobody involved is going to Boulder.',
  },
]

/* --------------------------------------------------------------------------
   THE PLAQUE — bolted to the wall by the door, as arcades do.
   -------------------------------------------------------------------------- */

export const PLAQUE = [
  'ALLY LUBIN’S ADVENTURE ARCADE opened because one person read the whole wiki.',
  'Not skimmed it. Read it — four thousand words about herself, at 2 AM, and then came back the next morning with notes and a question nobody else has asked: “did it align with like your concept of who I am?”',
  'Every other person who has been shown this thing got tired somewhere on the first page. She got to the end and had opinions. That is the entire reason there is a room here with her name on it.',
]
