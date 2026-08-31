/**
 * Catching a word — how something typed in a browser becomes work in the wiki.
 *
 * The same route every other write from this site takes, and for the same
 * reason: the portal is static, so there is nothing to POST to. What there is
 * is the repository the wiki lives in and GitHub's contents API. The word is
 * committed to `caakehorn/wiki-brain` as `lexicon/words/<id>.md` with the token
 * from `../wiki/keyring` — shipped encrypted in the deploy and opened by the
 * phrase the door already asked for — and then the sync workflow is nudged so
 * the word appears in the log in a minute or two rather than on the hour.
 *
 * The file's format lives in `./format`, apart from this, because two programs
 * in the other repository parse it and it has to be checkable without a
 * browser. See that file's header for which two.
 *
 * ---- what deliberately does not happen here --------------------------------
 *
 * Nothing analyses it. There is no model call in this file and no workflow
 * behind the box that will produce a reading while you wait. The word is
 * parked; `bin/wiki-work` in wiki-brain lists it; a session checks it against
 * the message record — 106,629 sent messages — and folds the finding into
 * `wiki/interests/language/vocabulary-lexicon.md`.
 *
 * That latency is the design, and here it is doing more work than it does for
 * the sage box. The destination page's standing caveat is that it holds words
 * **selected as pleasing**, never words **observed**, and the only thing that
 * turns the first into the second is somebody counting. A box that answered
 * immediately would produce exactly the kind of entry that page already has too
 * many of.
 */

import { credential, configured } from '../wiki/keyring'
import { publishFile, requestResync, SOURCE_REPO } from '../wiki/publish'
import { toMarkdown, validate, wordId, type Draft } from './format'

export { KINDS, MAX_NOTE, MAX_WORD, validate, type Draft, type Kind } from './format'
export { SOURCE_REPO }

/**
 * Commit the word, then ask the site to rebuild.
 *
 * Returns the id, which is what the log keys on.
 */
export async function submit(
  draft: Draft,
  onProgress: (note: string) => void = () => {},
): Promise<string> {
  const problem = validate(draft)
  if (problem) throw new Error(problem)

  const token = await credential()
  if (!token) {
    throw new Error(
      (await configured())
        ? 'this tab has no passphrase — reload and come in through the door'
        : 'no keyring on this deploy, so there is nowhere to put the word yet',
    )
  }

  const at = new Date()
  const id = wordId(draft.word, at)

  onProgress('filing the word…')
  await publishFile(
    `lexicon/words/${id}.md`,
    toMarkdown(draft, id, at),
    `Catch a word: ${draft.word.trim().slice(0, 60)}`,
  )

  // The commit is the durable part. If the nudge fails the word is still
  // upstream and the scheduled sync will pick it up, so say what happened rather
  // than reporting a failure that lost nothing.
  onProgress('asking the site to rebuild…')
  try {
    await requestResync(`lexicon/${id}`)
  } catch {
    onProgress('filed — it will appear in the list on the next scheduled sync')
  }

  return id
}
