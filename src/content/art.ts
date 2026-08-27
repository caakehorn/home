/* ==========================================================================
   THE PLATES

   Fourteen pictures hung around the building: nine frames of animation, and
   five photographs of one person.

   ---- the path, and why it is built rather than written -------------------

   `asset()` exists because of a bug that shipped. The first version of this
   file wrote `src: '/art/kiss-neon.webp'` — an absolute path, which is correct
   on a site served from a domain root and wrong on this one. The site deploys
   to a SUBPATH, `caakehorn.github.io/home/`, and Vite is given `base: '/home/'`
   to match.

   Vite rewrites `url()` references inside CSS when you do that. It does not
   rewrite string literals inside TypeScript, because it has no way to know a
   string is a URL. So every plate in CSS resolved and every plate in a `<img
   src>` asked the server for `/art/…` instead of `/home/art/…` and got a 404.
   Every single image on the site was broken in production and fine in every
   local check, because `vite preview` serves from the root.

   `import.meta.env.BASE_URL` is the value Vite actually resolved — `/` in dev,
   `/home/` on Pages — and it always ends in a slash. Nothing in this file may
   hard-code a leading slash again.
   ========================================================================== */

const asset = (file: string) => `${import.meta.env.BASE_URL}${file}`

export type Plate = {
  id: string
  src: string
  /** Intrinsic size, so a box is the right shape before the bytes land. */
  w: number
  h: number
  alt: string
  kana: string
  /** Which tube in the neon ramp this one burns in. */
  tone: 1 | 2 | 3 | 4 | 5
}

/* ==========================================================================
   THE SCENES — eight frames, nobody in particular

   Cels rather than photographs, and that distinction is the whole reason they
   can hang in a building that is otherwise a wiki about one real person: a
   drawing of two people at four in the morning is about the hour, not about
   anybody. They are the only thing here that is not an argument about the
   record.
   ========================================================================== */

export const SCENES: Plate[] = [
  {
    id: 'kiss-neon',
    src: asset('art/kiss-neon.webp'),
    w: 1280,
    h: 679,
    alt: 'Two women in profile, one pink-haired with her eyes shut, one blonde, a breath apart',
    kana: '接吻',
    tone: 2,
  },
  {
    id: 'kiss-close',
    src: asset('art/kiss-close.webp'),
    w: 800,
    h: 406,
    alt: 'The same two, much closer — pink hair and blonde, sparks behind them',
    kana: '間近',
    tone: 2,
  },
  {
    id: 'kiss-window',
    src: asset('art/kiss-window.webp'),
    w: 1280,
    h: 668,
    alt: 'Two women kissing in front of a bright window, one dark-haired, one pink-haired',
    kana: '朝',
    tone: 4,
  },
  {
    id: 'kiss-water',
    src: asset('art/kiss-water.webp'),
    w: 1120,
    h: 1037,
    alt: 'Two women in green swimsuits on a ring in bright water, kissing, hands on each other’s faces',
    kana: '水',
    tone: 3,
  },
  {
    id: 'kiss-dark',
    src: asset('art/kiss-dark.webp'),
    w: 800,
    h: 450,
    alt: 'Two women kissing with their eyes shut, one dark-haired, one blonde',
    kana: '密',
    tone: 5,
  },
  {
    id: 'kiss-butterfly',
    src: asset('art/kiss-butterfly.webp'),
    w: 1026,
    h: 1410,
    alt: 'Two women in headphones with butterfly wings on the ear cups, teal-haired and pink-haired, foreheads together',
    kana: '蝶',
    tone: 4,
  },
  {
    id: 'kiss-mirror',
    src: asset('art/kiss-mirror.webp'),
    w: 1200,
    h: 849,
    alt: 'Two women close together, one holding a mirror, the other holding a makeup brush to her face',
    kana: '化粧',
    tone: 2,
  },
  {
    id: 'kiss-blush',
    src: asset('art/kiss-blush.webp'),
    w: 348,
    h: 345,
    alt: 'Two women in school uniforms, hands clasped together, both blushing, close',
    kana: '照',
    tone: 1,
  },
  {
    id: 'kiss-uniform',
    src: asset('art/kiss-uniform.webp'),
    w: 620,
    h: 889,
    alt: 'Two women in school uniforms, one holding the other’s face, about to kiss',
    kana: '制服',
    tone: 5,
  },
]

export const sceneById = (id: string) => SCENES.find((s) => s.id === id) as Plate

/**
 * The scenes in hanging order, as ids.
 *
 * Derived rather than written down so a plate added to `SCENES` is hung
 * automatically and the two lists cannot drift apart. `SectionArt` indexes into
 * this modulo its length, which is why it wants ids in a stable order rather
 * than the objects.
 */
export const SCENE_ORDER: string[] = SCENES.map((s) => s.id)

/* ==========================================================================
   THE PHOTOGRAPHS

   These were the payload of the relics: ten stickers hidden across the front
   door and the main floor, each one opening a panel with a line, a date and a
   door into the wiki. Five of the ten had a real photograph behind them.

   The hunt is gone. What it was hiding is not — it is a section on the main
   floor now, with the photographs at a size you can actually see and the same
   writing underneath them. A hidden thing that nobody finds is not a thing on
   the site, and five photographs of the only person who has read the whole
   wiki were the wrong thing to have made into a pixel hunt.

   The five drawn stand-ins that had no photograph are not carried over; their
   material is all in the wiki in longer form, which is where every one of
   these links to anyway.
   ========================================================================== */

export type Photo = Plate & {
  title: string
  stamp: string
  quote: string
  note: string
  href: string
  hrefLabel: string
}

export const ALLY: Photo[] = [
  {
    id: 'top8',
    src: asset('ally/top8.jpg'),
    w: 800,
    h: 800,
    alt: 'Ally Lubin, from the 2008 scene internet',
    kana: '〇八',
    tone: 2,
    title: 'THE HANDLE',
    stamp: '2008 — AND ON THE RECORD AGAIN IN 2026',
    quote: '“I peaked in 2008.”',
    note:
      'Said about herself, unprompted, eighteen years later, and filed as corroboration by a man who had spent those eighteen years saying the same thing about her in longer sentences. The handle was famous enough that two grown men later treated it as an accredited institution — “i sent my transcripts to ALU, but got a rejection letter in the mail.”',
    href: '/arcade/alu-08',
    hrefLabel: 'PLAY ALU ’08',
  },
  {
    id: 'personal',
    src: asset('ally/personal.jpg'),
    w: 800,
    h: 800,
    alt: 'Ally Lubin, deadpan',
    kana: '個人',
    tone: 1,
    title: 'THE SHARPEST SENTENCE IN THE FILE',
    stamp: 'OCTOBER 30, 2023',
    quote: '“Well I do. It’s personal lol.”',
    note:
      'He had just explained, at length, that his terrible response record was structural rather than about her — that he could refer her to his mother for confirmation. She declined the exemption in six words. He did not have an answer then and does not have one now.',
    href: '/arcade/courtship',
    hrefLabel: 'PLAY THE SCENE',
  },
  {
    id: 'dunkies',
    src: asset('ally/dunkies.jpg'),
    w: 800,
    h: 800,
    alt: 'Ally Lubin, the morning of August 19 2026',
    kana: '珈琲',
    tone: 5,
    title: 'THE FIRST MORNING IN SEVENTEEN YEARS',
    stamp: 'AUGUST 19, 2026 · 7:24 AM',
    quote: '“Good morning my queen. What do you want from dunkies?”',
    note:
      'Seventeen years of bursts and silences, and this is the first time the channel had ever carried a morning. Iced, large, not weather-dependent. The coffee is incidental; being brought one is the entire mechanism.',
    href: '/brain/people/ally-lubin',
    hrefLabel: 'READ THE ENTRY',
  },
  {
    id: 'cats',
    src: asset('ally/cats.jpg'),
    w: 800,
    h: 800,
    alt: 'Ally Lubin with the cats, and the shelf',
    kana: '猫',
    tone: 3,
    title: 'TWO CATS, ONE SHELF',
    stamp: 'ONGOING · NIGHTLY',
    quote: 'Sylvia, named like a poet, behaving like a cat.',
    note:
      'Edgar is all black, broad, unhurried — a wide paddle and slow hands. Sylvia is a tuxedo with a white bib and four white socks: narrow, fast, and the reason nothing stays on a shelf. There is a cabinet in the arcade that is only about this.',
    href: '/arcade/yarn',
    hrefLabel: 'CLEAR THE SHELF',
  },
  {
    id: 'deal',
    src: asset('ally/deal.jpg'),
    w: 800,
    h: 800,
    alt: 'Ally Lubin, the night the offer was accepted',
    kana: '契約',
    tone: 1,
    title: 'THE OFFER, ACCEPTED',
    stamp: 'AUGUST 18, 2026 · 11:49 PM',
    quote: '“Okay deal. Sounds good 1-2-3 break.”',
    note:
      'Said with a straight face on a Tuesday night, after reading four thousand words about herself and coming back with notes. Vancouver or Burlington or Boulder; nobody involved is going to Boulder. The title went onto the infobox and it is load-bearing.',
    href: '/brain/people/ally-lubin',
    hrefLabel: 'THE INFOBOX',
  },
]

/* ==========================================================================
   THE TWO FACES INSIDE THE DRAWING

   Not plates — nothing hangs these on a wall. `src/components/Kiss.tsx` draws
   two profiles as flat silhouettes and these fill them, so the drawing is a
   window onto the picture rather than a shape cut out of the dark.

   They go through `asset()` like everything else: an SVG `<image href>` is a
   URL in a TypeScript string, which is exactly the kind Vite does not rewrite.
   ========================================================================== */

export const KISS_FACES = {
  /** The one behind, facing right. */
  back: asset('art/face-back.webp'),
  /** The one in front. Flopped at build time — see build-art.mjs for why. */
  front: asset('art/face-front.webp'),
}
