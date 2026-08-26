/* ==========================================================================
   THE PLATES

   Ten files, nine of them pictures, and the site is built around them now
   rather than having them dropped on top of it. What each file is, where it came from and why it
   is cropped the way it is lives in `public/art/README.md`; this is the part
   the components need — the size, so a plate can be laid out before it lands,
   the tube it burns in, and a description of what is actually in it.

   ---- on the descriptions -------------------------------------------------

   Every plate carries a real `alt`. Several are the entire content of the
   section they sit in, and a screen reader that is handed "decorative image"
   for the largest thing on the page has been lied to. The two that ARE
   decorative — the blurred field and the mouth that is used as a sticker — say
   so by carrying no label at all, which is the honest way to say it.
   ========================================================================== */

export type PlateId =
  | 'kiss-neon'
  | 'kiss-close'
  | 'kiss-window'
  | 'kiss-water'
  | 'kiss-dark'
  | 'kiss-uniform'
  | 'blob-figure'
  | 'blob-lips'
  | 'blob-field'
  | 'poster-mort'

export type Plate = {
  id: PlateId
  src: string
  /** Intrinsic size. Present so nothing on this site reflows when a plate
      arrives — the box is the right shape before the bytes are. */
  w: number
  h: number
  /** Omitted where the plate is genuinely decorative. */
  alt?: string
  kana: string
  /** Which tube in the neon ramp this one burns in. */
  tone: 1 | 2 | 3 | 4 | 5
  /** The caption, where a caption is wanted. */
  note?: string
}

export const PLATES: Record<PlateId, Plate> = {
  'kiss-neon': {
    id: 'kiss-neon',
    src: '/art/kiss-neon.webp',
    w: 1280,
    h: 679,
    alt: 'Two women in profile, one pink-haired with her eyes shut, one blonde, a breath apart',
    kana: '接吻',
    tone: 2,
    note: 'the one that is all sparkle and no apology',
  },
  'kiss-close': {
    id: 'kiss-close',
    src: '/art/kiss-close.webp',
    w: 800,
    h: 406,
    alt: 'The same two women, much closer — pink hair and blonde, a breath apart, sparks behind them',
    kana: '間近',
    tone: 2,
    note: 'closer than the other one, and not stopping',
  },
  'kiss-window': {
    id: 'kiss-window',
    src: '/art/kiss-window.webp',
    w: 1280,
    h: 668,
    alt: 'Two women kissing in front of a bright window, one dark-haired, one pink-haired',
    kana: '朝',
    tone: 4,
    note: 'morning, and neither of them is leaving',
  },
  'kiss-water': {
    id: 'kiss-water',
    src: '/art/kiss-water.webp',
    w: 1120,
    h: 1037,
    alt: 'Two women in green swimsuits on a ring in bright water, kissing, hands on each other’s faces',
    kana: '水',
    tone: 3,
    note: 'the middle of the afternoon, in front of everybody',
  },
  'kiss-dark': {
    id: 'kiss-dark',
    src: '/art/kiss-dark.webp',
    w: 800,
    h: 450,
    alt: 'Two women kissing with their eyes shut, one dark-haired, one blonde',
    kana: '密',
    tone: 5,
    note: 'both of them have their eyes shut',
  },
  'kiss-uniform': {
    id: 'kiss-uniform',
    src: '/art/kiss-uniform.webp',
    w: 620,
    h: 889,
    alt: 'Two women in school uniforms, one holding the other’s face, about to kiss',
    kana: '制服',
    tone: 5,
    note: 'cut out of the paper it was printed on',
  },
  'blob-figure': {
    id: 'blob-figure',
    src: '/art/blob-figure.webp',
    w: 420,
    h: 744,
    alt: 'A blonde figure in white, looking back over her shoulder, standing in a field of flowing cartoon shapes',
    kana: '流',
    tone: 1,
    note: 'the one that is not a kiss',
  },
  'blob-lips': {
    id: 'blob-lips',
    src: '/art/blob-lips.webp',
    w: 300,
    h: 186,
    kana: '口',
    tone: 2,
  },
  'blob-field': {
    id: 'blob-field',
    src: '/art/blob-field.webp',
    w: 900,
    h: 491,
    kana: '面',
    tone: 1,
  },
  'poster-mort': {
    id: 'poster-mort',
    src: '/art/poster-mort.webp',
    w: 760,
    h: 645,
    alt: 'A gig poster — MORT ROSE with VANILLE, February 7 2019 — a woman in a blue crop top standing in a field of flowing shapes',
    kana: '貼紙',
    tone: 4,
    note: 'february 7 2019 · nobody here went',
  },
}

/**
 * Everything, in the order the site introduces them.
 *
 * `blob-field` is not in it. It is a surface rather than a plate — blurred past
 * legibility on purpose, and the one file here that is never hung anywhere,
 * only laid behind something else. Anything that walks this list is looking for
 * pictures, and it is not one.
 */
export const PLATE_ORDER: PlateId[] = [
  'kiss-neon',
  'poster-mort',
  'kiss-window',
  'kiss-close',
  'kiss-water',
  'blob-figure',
  'kiss-dark',
  'kiss-uniform',
  'blob-lips',
]
