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
  'Ratio + L',
  'Who asked',
  'Didn\'t ask',
  'No one asked',
  'Common W',
  'Take the L',
  'Certified L',
  'Cope',
  'Seethe',
  'Mald',
  'Cope harder',
  'Get real',
  'Skill Issue',
  'Git gud',
  'Uninstall',
  'Touch Grass',
  'Nobody cares',
  'Delete this',
  'Delete your account',
  'Blocked and reported',
  'Screenshot this',
  'Pin this',
  'Quote tweet fail',
  'Opinion rejected',
  'Opinion discarded',
  'Application denied',
  'Yikes',
  'Big yikes',
  'This ain\'t it chief',
  'The audacity',
  'Not slick',
  'We see you',
  'Caught in 4k',
  'This you?',
  'Receipts?',
  'He should not have cooked',
  'And I oop',
  'Sit down',
  'Womp womp',
  '💀',
  'I\'m deceased',
  'I can\'t 💀',
  'Say less',
  'Ok buddy',
  'Sure Jan',
  'Found the one',
  'Confidently incorrect',
  'Wrong but confident',
  'Conviction: high, correctness: 0',
  'Bro really said that',
  'Bro thought',
  'Ain\'t no way',
  'No way bro really said this',
  'The confidence though',
  'The disrespect',
  'Not the take',
  'Negative aura',
  'Aura: -9000',
  'No rizz',
  'Rizzless',
  'Negative rizz',
  'This ain\'t the rizz you think it is',
  'Aura points revoked',
  'Rizz denied',
  'Zero rizz detected',
  'Rizz: not found',
  'NPC behavior',
  'NPC dialogue',
  'Bot behavior',
  'Clown behavior',
  '🤡',
  'Clown take',
  'Certified clown moment',
  'Who let him cook',
  'He should not have cooked',
  'Get cooked',
  'He\'s cooked',
  'She\'s cooked',
  'Burnt take',
  'Microwave take',
  'Cold take',
  'Stale take',
  'Reheated take',
  'Take: rejected',
  'This take belongs in the trash',
  'Expired take',
  'Aged like milk',
  'This aged badly',
  'Take gone cold',
  'Hot take gone cold',
  'L + ratio + expired',
  'Down bad',
  'In shambles',
  'Crying rn',
  'The way I—',
  'Not the confidence',
  'This is bait right?',
  'Please tell me this is bait',
  'Not falling for the bait',
  'Unhinged take alert',
  'Red flag take',
  'Green flag? Never heard of her',
  'Big if true (it\'s not)',
  'Source?',
  'Citation needed',
  'Trust me bro',
  'Cap detected',
  'No cap fr fr',
  'Big cap',
  'Cap alert',
  'That\'s cap',
  'Cap or no cap, still an L',
  'Detected: cap',
  'Certified cap',
  'Cap radar going off',
  'This has capped out',
  'farmed',
  'Engagement farming detected',
  'Clapped',
  'Ratio farm',
  'Bait and I\'m not biting',
  'Numbers don\'t lie',
  'The ratio speaks for itself',
  'Ratio: confirmed',
  'Certified ratio moment',
  'Ratio + fell off + cope',
  'L + ratio + you fell off',
  'Quote this and cry about it',
  'Nobody: ... This guy:',
  'Logic: not found',
  'Big skill issue',
  'Opinion has been ratio\'d',
  'No bitches',
  'This is why we can\'t have nice things',
  'Cooked and served',
  'Case closed, L confirmed',
  'As If',
  'The Absurdity',
  "Don't care, didn't laugh",
  'Not Based',
  'UR Probably White',
  'Smoke that orange pack',
  "Don't Care Didn't Ask",
  'Cry About It',
  'Stay Mad',
  'Get Real 3',
  'Mald Seethe Cope Harder',
  'Hoes Mad',
  'Basic',
  'You Fell Off',
  'The Audacity 4',
  'Triggered',
  'Redpilled',
  'Get A Life',
  'OK And?',
  'Cringe',
  'Your Probably White',
  "Not Funny Didn't Laugh",
  'Grammar Issue',
  'Go Outside',
  'Reported',
  'Ad Homenium',
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
