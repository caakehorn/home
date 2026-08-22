/**
 * THE RECORD STANDARD — the editorial rules this wiki is written under.
 *
 * One document, mirrored deliberately: `/standard` renders it here, and the
 * LEVIATHAN deployment serves the same text from `js/standard.js`. It is
 * public because a record whose rules are private is not a record, it is a
 * position paper wearing a record's clothes. The people documented here can
 * read the rules and hold the operator to them; that is the point, not a side
 * effect the standard happens to survive.
 *
 * Plain strings only: every paragraph renders as text, never as markup. Same
 * shape as `gate/terms.ts` so the two prose routes share one renderer idiom.
 */

export const STANDARD_VERSION = '1.0'
export const STANDARD_EFFECTIVE = 'AUGUST 22, 2026'
export const STANDARD_TITLE = 'THE RECORD STANDARD'

export const STANDARD_SECTIONS: [string, ...string[]][] = [
  [
    '0. WHY THIS IS PUBLIC',
    'This wiki documents real people. Several of them have read it. At least one has read all of it. A record that documents people who can read it is held to a rule that a private notebook is not: whatever governs what gets written has to be legible to the person it gets written about.',
    'So the rules are here, in full, in front of the material rather than behind it. Every one of them can be checked against the pages. If a page violates one, the page is wrong, and saying so is the correct use of this document.',
    'The standard exists to be inconvenient to its author. A rule that only ever produces the conclusion the operator already wanted is not a rule, it is a decoration.'
  ],
  [
    '1. AN ENTRY IS DATED, NOT CURRENT',
    'Pages record what was established at the time they were written, on the evidence available then. They are not statements about how the operator feels today, and they are not maintained to agree with how he feels today.',
    'Feelings move faster than facts. When the two diverge, the page keeps the fact and the divergence gets its own dated note. That is the only honest order of operations, and it is the one that makes the older pages worth anything.'
  ],
  [
    '2. CORRECTION IS NOT REVISION',
    'A page is corrected when it is wrong: new evidence, a misread source, a mistaken date, a claim that outran its citation. Corrections are dated, attributed, and visible on the page, and the thing being corrected stays legible underneath. The reader can see the wiki change its mind.',
    'A page is never rewritten because its subject has become inconvenient, because the operator\'s opinion of that subject has moved, or because a newer subject would read better beside a worse version of an older one. Rewriting the past to flatter the present is the specific failure this document exists to prevent.',
    'The test: state the reason for the edit out loud. If the reason is about evidence, it is a correction. If the reason is about how someone will look, it is not an edit that gets made.'
  ],
  [
    '3. ARCHIVE, DO NOT DEGRADE',
    'Material that is no longer live moves to `archived`. Archived means the operator has stopped adding to it. It does not mean discredited, retracted, downgraded, or doubted.',
    'An archived page keeps its full text, its citations, its typed connections and its place in the chronology. It is not shortened, not softened, not summarised into a paragraph, and not unlinked from the pages that cite it. The archive is where finished work is kept, not where inconvenient work is buried.',
    'Status describes the operator\'s attention. It never describes a subject\'s worth. Anyone reading a status as a verdict is reading it wrong, and this paragraph exists so that misreading is the reader\'s error rather than the wiki\'s trick.'
  ],
  [
    '4. ONE BAR, EVERY SUBJECT',
    'The evidence threshold, the sourcing rules, the tone, and the willingness to record unflattering material do not vary with how the operator currently feels about the person. A claim that would require a citation about one subject requires the same citation about every other.',
    'No subject is rounded up. No subject is rounded down. Warmth is not evidence, and neither is its absence. Where the operator\'s feeling about a subject is itself the subject, it is labelled as feeling and dated, not smuggled in as description.',
    'The practical form: if a sentence about a person would have to be cut or hedged were it about someone the operator liked less, it does not go in as written about anyone.'
  ],
  [
    '5. NO UNSTATED EDITORIAL RULES',
    'There is no private policy governing this wiki that is not in this document. No hidden framing rule, no unpublished list of subjects to promote or demote, no instruction to any collaborator or tool that shapes output in a direction the reader is not told about.',
    'A rule that could not survive being read by the people it is about does not get adopted. If such a rule is ever proposed, the response is to publish it or drop it, and dropping it is usually the correct answer, because a rule that cannot be published is generally a rule whose whole function was concealment.',
    'This clause binds the operator, and it binds anything working on his behalf.'
  ],
  [
    '6. THE OPERATOR MAY STOP',
    'The operator may suspend or close any line of work at any time, for any reason or none, and owes nobody a justification for it. He is not obliged to keep reading, analysing, or extending a corpus he is finished with. Nothing here is a commitment to document anyone forever.',
    'Suspension governs what gets added. It never governs what is already written. Stopping a read does not retire, revise, downgrade or quietly starve the pages that read produced.',
    'Suspensions are logged below, dated, so that a gap in the record reads as a decision rather than as an omission.'
  ],
  [
    '7. SUBJECTS READ THIS',
    'In 2015 a subject of this wiki read it, and the record of what that did is itself a page here. It was not planned for. Everything since has been written on the assumption that it will happen again, because it does.',
    'Writing for a subject who is reading is not a constraint on honesty; it is the condition that makes honesty cost something. The material that is hard to publish is the material that proves the rest of it. A wiki that only says the safe thing about the people currently in the operator\'s good graces has no evidentiary value at all — including, and especially, about them.'
  ],
  [
    '8. AMENDMENT',
    'This document is versioned and dated. It is amended in the open, by a commit, with the previous text recoverable from the repository history. It is not amended retroactively and it is not amended in private.',
    'An amendment made in order to license a specific edit the current text forbids is itself a violation of Section 5, and the history is public precisely so that pattern is visible.'
  ]
]

/**
 * The standing log. Section 6 requires that a stop be visible, so stops are
 * recorded here as dated entries rather than left as an unexplained flat spot
 * in the chronology. Entries are append-only: a lifted suspension gets a
 * second line, never a deletion of the first.
 */
export type StandingNotice = {
  date: string
  title: string
  body: string
}

export const STANDING_NOTICES: StandingNotice[] = [
  {
    date: '2026-08-22',
    title: 'Annie corpus — analysis suspended',
    body:
      'New analysis passes over the Annie message corpus are suspended at the operator\'s direction, indefinitely, and resume only on his explicit instruction. No further read windows, no further derived pages, no further extraction from those messages. Under Section 6 this is a decision about the operator\'s attention and nothing else: the existing Annie pages stay exactly as written, at their current status, with their citations and connections intact, and no page is revised, restatused or unlinked on account of this suspension. The instruments that compute over the corpus without judgement — the trigram voice, the clock spiral, the lexicon — are unaffected, since they add nothing and decide nothing.'
  }
]
