/**
 * The word file's format, and nothing else.
 *
 * Kept apart from `submit.ts` for the same reason `sage/format.ts` is kept
 * apart from `sage/ask.ts`: that file reaches for a credential and the network,
 * and this is the half that has to be checkable without either.
 *
 * ---- three programs read this shape ----------------------------------------
 *
 * A word file written here is parsed by two other things, neither of which will
 * tell you when it stops recognising one:
 *
 *   1. `bin/wiki-work` in wiki-brain — `find_words()`, which is what lists a
 *      word as outstanding work. A word it cannot see is a word nobody is ever
 *      told to look at, which is the single failure this feature exists to
 *      prevent.
 *   2. `scripts/sync-wiki.mjs` here — `lexiconEntries()`, which derives the log
 *      the site renders. A word it cannot parse is typed into a void.
 *
 * So: `## Note` and `## Reading` are exact headings, `status:` is one of three
 * exact words, and the frontmatter keys are the ones documented in
 * `lexicon/README.md` upstream. Change any of it in three places or none.
 */

/** A phrase can be a mouthful; it is not a paragraph. */
export const MAX_WORD = 120
/** The note is optional on purpose — see `validate`. */
export const MAX_NOTE = 600

/**
 * The buckets, and they are deliberately coarse.
 *
 * This is a sorting hint for whoever drains the queue, not a taxonomy. Nobody
 * typing a word into a box knows yet whether it is slang or an insult — that is
 * the question the analysis answers — so asking for a precise category at
 * capture time would be asking for a guess and then storing it as a fact. A
 * session is free to disagree with the bucket in the reading.
 */
export const KINDS = ['word', 'slang', 'phrase', 'insult', 'praise'] as const
export type Kind = (typeof KINDS)[number]

export type Draft = { word: string; kind: Kind; note: string }

/**
 * The id, and therefore the filename: `<date>_<time>_<slug>`.
 *
 * The same shape `sage/questions/` and `bin/wiki-gaps` captures use, so the
 * three sit together in a directory listing without a second convention to
 * learn. Sortable, unique to the second, readable.
 */
export function wordId(word: string, at: Date = new Date()): string {
  const iso = at.toISOString()
  const date = iso.slice(0, 10)
  const time = iso.slice(11, 19).replace(/:/g, '')
  const slug =
    word
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 48)
      .replace(/-+$/, '') || 'word'
  return `${date}_${time}_${slug}`
}

/** The file, exactly as `lexicon/README.md` documents it. */
export function toMarkdown(draft: Draft, id: string, at: Date = new Date()): string {
  const note = draft.note.trim().slice(0, MAX_NOTE)
  return [
    '---',
    `id: ${id}`,
    `added: ${at.toISOString().replace(/\.\d+Z$/, 'Z')}`,
    // Quoted: a word can legitimately contain a colon, a leading `#`, or start
    // with a character YAML reads as structure. The word is the datum and it
    // goes in verbatim, so the quoting has to be unconditional rather than
    // clever — and the escape has to happen, or a word containing a quote
    // silently truncates the field.
    `word: "${draft.word.trim().replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`,
    `kind: ${draft.kind}`,
    'status: pending',
    'analyzed:',
    'targets: []',
    '---',
    '',
    '## Note',
    '',
    // An empty note is the common case and must stay legible as a file: the
    // heading stands with a placeholder rather than leaving two blank lines
    // that read as a truncated write.
    note || '_No note — the word was caught on its own._',
    '',
    '## Reading',
    '',
    '_Not yet analysed._',
    '',
  ].join('\n')
}

export function validate(draft: Draft): string | null {
  const word = draft.word.trim()
  if (!word) return 'type a word'
  if (word.length > MAX_WORD) return `that is ${word.length} characters; the box takes ${MAX_WORD}`
  if (draft.note.trim().length > MAX_NOTE) return `that note is longer than ${MAX_NOTE} characters`
  if (!KINDS.includes(draft.kind)) return 'pick a kind'
  return null
}
