/**
 * The question file's format, and nothing else.
 *
 * Kept apart from `ask.ts` because `ask.ts` reaches for a credential and the
 * network, and this is the part that has to be checkable without either — see
 * `scripts/check-sage.mjs`.
 *
 * ---- three programs read this shape ----------------------------------------
 *
 * A question file written here is parsed by two other things in another
 * repository, and neither of them will tell you when it stops recognising one:
 *
 *   1. `bin/wiki-work` in wiki-brain — `find_sage()`, which is what lists a
 *      question as outstanding work. A question it cannot see is a question
 *      nobody is ever told to answer, which is the single failure this whole
 *      feature exists to prevent.
 *   2. `scripts/sync-wiki.mjs` here — `sageEntries()`, which derives the log
 *      the site renders. A question it cannot parse is asked into a void.
 *
 * So: `## Question` and `## Answer` are exact headings, `status:` is one of
 * three exact words, and the frontmatter keys are the ones documented in
 * `sage/README.md`. Change any of it in three places or none.
 */

/** Long enough for a real question, short enough that the box is not an essay field. */
export const MAX_QUESTION = 1200
export const MAX_ASKER = 60

export type Draft = { question: string; asker: string }

/**
 * The id, and therefore the filename: `<date>_<time>_<slug>`.
 *
 * Sortable, unique to the second, and readable in a directory listing — the
 * same shape `bin/wiki-gaps` uses for its captures, so the two sit together in
 * `raw/` without a second convention to learn.
 */
export function questionId(question: string, at: Date = new Date()): string {
  const iso = at.toISOString()
  const date = iso.slice(0, 10)
  const time = iso.slice(11, 19).replace(/:/g, '')
  const slug =
    question
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 48)
      .replace(/-+$/, '') || 'question'
  return `${date}_${time}_${slug}`
}

/** The file, exactly as `sage/README.md` documents it. */
export function toMarkdown(draft: Draft, id: string, at: Date = new Date()): string {
  const asker = draft.asker.trim().slice(0, MAX_ASKER)
  return [
    '---',
    `id: ${id}`,
    `asked: ${at.toISOString().replace(/\.\d+Z$/, 'Z')}`,
    // Omitted rather than left blank when nobody signed: the frontmatter says
    // what is true, and "asked by nobody in particular" is the absence of a
    // field, not an empty one.
    ...(asker ? [`asker: ${asker}`] : []),
    'status: pending',
    'answered:',
    'capture:',
    'cites: []',
    '---',
    '',
    '## Question',
    '',
    draft.question.trim(),
    '',
    '## Answer',
    '',
  ].join('\n')
}

export function validate(draft: Draft): string | null {
  const question = draft.question.trim()
  if (question.length < 12) return 'ask a real question — a few more words'
  if (question.length > MAX_QUESTION) return `that is ${question.length} characters; the box takes ${MAX_QUESTION}`
  if (draft.asker.trim().length > MAX_ASKER) return `that name is longer than ${MAX_ASKER} characters`
  return null
}
