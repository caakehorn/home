/**
 * THE CRAWLS — the two banners fixed to the top and bottom of the viewport.
 *
 * Both are **lists of nodes, not sentences**. Each entry is its own reply, its
 * own scrap, its own separate thing being stacked onto the pile, and the `+`
 * between them is an operator rather than punctuation. So they live as arrays
 * and the banner renders one chip per entry; nothing here is ever joined into
 * a string and animated as prose, because then it stops being the form and
 * starts being a tagline.
 *
 * **To grow either one: append.** That is the entire maintenance story. The
 * banner measures itself after every change, so the loop stays seamless at any
 * length — there is no duration, no width and no copy count to update.
 *
 * Order is reading order. Both lists open on their signature node (`L` for the
 * ratio, the jet fuel line for the agenda), so new material goes in the middle
 * unless it is meant to be the last word.
 */

/**
 * Collapse to letters and digits: `"Don't care, didn't laugh"` and
 * `"dont care didnt laugh"` are the same node, and `"Not Funny Didn't Laugh"`
 * is a different one.
 */
const key = (node: string) => node.toLowerCase().replace(/[^a-z0-9]+/g, '')

/**
 * First occurrence wins.
 *
 * These lists get grown by pasting in a block of new lines, and a block that
 * size will contain something already on the pile — `SKILL ISSUE` twice in one
 * pass reads as a bug rather than as a joke. Rather than making that somebody's
 * job to police by hand, the source keeps every line exactly as it was written
 * and the renderer simply never draws the same node twice.
 */
function dedupe(nodes: readonly string[], listName: string): string[] {
  const seen = new Map<string, string>()
  const dropped: string[] = []
  for (const node of nodes) {
    const k = key(node)
    if (!k) continue
    if (seen.has(k)) dropped.push(node)
    else seen.set(k, node)
  }
  if (import.meta.env.DEV && dropped.length) {
    console.info(
      `[crawl] ${listName}: ${dropped.length} duplicate node(s) not drawn — ${dropped.join(', ')}`,
    )
  }
  return [...seen.values()]
}

/* ==========================================================================
   THE RATIO — bottom of the viewport, travelling left.
   ========================================================================== */
const RATIO_SOURCE = [
  'L',
  'Ratio',
  'As If',
  'The Absurdity',
  "Don't care, didn't laugh",
  'Not Based',
  'Skill Issue',
  'UR Probably White',
  'Smoke that orange pack',
  "Don't Care Didn't Ask",
  'Cry About It',
  'Stay Mad',
  'Get Real 3',
  'Mald Seethe Cope Harder',
  'Hoes Mad',
  'Basic',
  'Skill Issue',
  'You Fell Off',
  'The Audacity 4',
  'Triggered',
  'Redpilled',
  'Get A Life',
  'OK And?',
  'Cringe',
  'Touch Grass',
  'Not Based',
  'Your Probably White',
  "Not Funny Didn't Laugh",
  'Grammar Issue',
  'Go Outside',
  'Get Good',
  'Reported',
  'Ad Homenium',
  'Cry About It',
  'Basic',
  'Racially Motivated',
  'So Ass',
  // GG closes it. Anything new goes above this line.
  'GG',
]

export const RATIO = dedupe(RATIO_SOURCE, 'THE RATIO')

/* ==========================================================================
   JET FUEL — top of the viewport, travelling right.
   ========================================================================== */
const JET_FUEL_SOURCE = [
  "Jet fuel can't melt steel beams",
  'Water whip',
  'we are woke',
  'Smiley piercings are now mandatory',
  'Pronouns for everybody',
  'We will move the US Capital to Oakland, California',
  'we are wokemaxxing',
  'get mogged nerds',
  'universal healthcare and free abortion for all',
  'taxmogging the billionaires',
  'being straight is now illegal',
  'red state degenerates: you will listen to Kreayshawn',
  'you will eat the hyphyburger',
  'you will share login with your non-binary roommates',
  'you will love your immigrant neighbors',
  'just let the woke consume you',
  'get those micro bangs',
  'just put the pronouns in the bio lil bro',
]

export const JET_FUEL = dedupe(JET_FUEL_SOURCE, 'JET FUEL')

/** The operator between nodes. Drawn as its own element, never as text. */
export const OPERATOR = '+'

/** For assistive tech, which wants a list once and in one piece. */
export const sentenceOf = (nodes: readonly string[]) => nodes.join(` ${OPERATOR} `)
