/**
 * THE RATIO — the crawl along the bottom of the site.
 *
 * These are **nodes**, not a sentence. The whole form of the thing is that it
 * is a list being concatenated at you — each one is its own reply, its own
 * scrap, its own separate insult, and the `+` between them is an operator
 * rather than punctuation. So they live as an array and the banner renders one
 * chip per entry with the operator drawn between; nothing here is ever joined
 * into a string and animated as prose, because then it stops being the meme
 * and starts being a tagline.
 *
 * **To grow it: append.** That is the entire maintenance story. The banner
 * measures itself after every change, so the loop stays seamless at any
 * length and there is no duration, no width and no copy count to update. Order
 * is the order they get read in, and it is intentional — `L` opens and `GG`
 * closes, so new material goes in the middle unless it is meant to be the
 * last word.
 */
export const RATIO = [
  'L',
  'Ratio',
  'As If',
  'The Absurdity',
  "Don't care, didn't laugh",
  'Not Based',
  'Skill Issue',
  'UR Probably White',
  'Smoke that orange pack',
  'GG',
] as const

/** The operator between nodes. Drawn as its own element, never as text. */
export const OPERATOR = '+'

/** For assistive tech, which wants the list once and in one piece. */
export const ratioSentence = () => RATIO.join(` ${OPERATOR} `)
