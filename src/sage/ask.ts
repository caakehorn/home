/**
 * Asking — how a question typed in a browser becomes work in the wiki.
 *
 * The portal is static, so there is nothing to POST to. What there is, as with
 * every other write from this site, is the repository the wiki lives in and
 * GitHub's contents API. The question is committed to `caakehorn/wiki-brain` as
 * `sage/questions/<id>.md` with the token from `keyring.ts` — shipped encrypted
 * in the deploy and opened by the passphrase the door already asked for — and
 * then the sync workflow is nudged so the question shows up in the log a minute
 * or two later instead of on the hour.
 *
 * The file's format lives in `format.ts`, apart from this, because two programs
 * in the other repository parse it and it has to be checkable without a browser.
 *
 * ---- what deliberately does not happen here --------------------------------
 *
 * Nothing answers it. There is no model call in this file, no API key on this
 * site, and no workflow behind the box that will produce an answer while you
 * wait. The question is parked; `bin/wiki-work` in wiki-brain lists it at
 * priority 1; a session working in that repository answers it with citations
 * and dated quotes from the message record.
 *
 * That is a slower promise than a chat box makes and it is a different promise.
 * An answer here is one that read the corpus — 486 pages and 134,348 messages —
 * and cites what it read. The UI says so rather than spinning.
 */

import { credential, configured } from '../wiki/keyring'
import { announceQuestion, publishFile, requestResync, SOURCE_REPO } from '../wiki/publish'
import { questionId, toMarkdown, validate, type Draft } from './format'

export { MAX_ASKER, MAX_QUESTION, validate, type Draft } from './format'
export { SOURCE_REPO }

/**
 * Commit the question, then ask the site to rebuild.
 *
 * Returns the id, which is what the log keys on.
 */
export async function ask(
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
        : 'no keyring on this deploy, so there is nowhere to put the question yet',
    )
  }

  const at = new Date()
  const id = questionId(draft.question, at)

  onProgress('filing the question…')
  await publishFile(
    `sage/questions/${id}.md`,
    toMarkdown(draft, id, at),
    `Ask the sage: ${draft.question.trim().slice(0, 60)}`,
  )

  // The commit is the durable part, and both nudges below are optimisations on
  // top of schedules that already exist. If either fails the question is still
  // upstream, the hourly sync still publishes it and the daily drain still finds
  // it — so say what happened rather than reporting a failure that lost nothing.
  onProgress('asking the site to rebuild…')
  try {
    await requestResync(`sage/${id}`)
  } catch {
    onProgress('filed — it will appear in the log on the next scheduled sync')
  }

  // And tell the wiki to look at its work list today rather than tomorrow.
  // Deliberately not awaited into the failure path above: a question that is
  // visible but not yet drained is a much better outcome than the reverse, so
  // this one is allowed to fail quietly.
  try {
    await announceQuestion(id)
  } catch {
    /* the daily drain picks it up */
  }

  return id
}
