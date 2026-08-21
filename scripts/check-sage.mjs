/**
 * Checks the contract between three programs that all parse one file shape.
 *
 *   node --experimental-strip-types scripts/check-sage.mjs
 *
 * A question asked on the site is written by `src/sage/format.ts`, listed as
 * outstanding work by `bin/wiki-work` in caakehorn/wiki-brain, and rendered into
 * the log by `sageEntries()` in `scripts/sync-wiki.mjs` here. None of the three
 * imports the others, and none of them fails loudly when it stops recognising a
 * file — a question `bin/wiki-work` cannot see is simply never listed, and
 * nobody is told to answer it. That silence is the whole risk, so it is checked
 * rather than trusted.
 *
 * This also covers `draftIsStale`, which is the guard against the portal
 * lost-update that deleted 30KB of `people/annie-ulmer` on 2026-08-21.
 *
 * No test framework: this repo has none, and one assertion helper is cheaper
 * than a dependency. Exits 1 on the first failure.
 */
import { questionId, toMarkdown, validate } from '../src/sage/format.ts'
import { draftIsStale } from '../src/wiki/store.ts'

let failures = 0

function check(what, condition, detail = '') {
  if (condition) {
    console.log(`  ok    ${what}`)
  } else {
    failures++
    console.log(`  FAIL  ${what}${detail ? ` — ${detail}` : ''}`)
  }
}

/**
 * The same frontmatter reader `sync-wiki.mjs` uses, in miniature.
 *
 * Deliberately re-implemented rather than imported: the point is to parse the
 * file the way a *separate* program would, so a change that only works because
 * both ends share a helper still fails here.
 */
function parse(text) {
  const end = text.indexOf('\n---', 3)
  const head = text.slice(4, end)
  const body = text.slice(text.indexOf('\n', end + 1) + 1)
  const meta = {}
  for (const line of head.split('\n')) {
    const m = line.match(/^([A-Za-z0-9_]+):\s*(.*)$/)
    if (m) meta[m[1]] = m[2].trim()
  }
  const section = (name) => {
    const at = body.search(new RegExp(`^##\\s+${name}\\s*$`, 'im'))
    if (at === -1) return null
    const rest = body.slice(at).replace(/^##.*\n/, '')
    const next = rest.search(/^##\s/m)
    return (next === -1 ? rest : rest.slice(0, next)).trim()
  }
  return { meta, question: section('Question'), answer: section('Answer') }
}

console.log('sage: the question-file contract')

const at = new Date('2026-08-21T14:30:22.512Z')
const draft = { question: 'Can Dan actually be monogamous?', asker: 'Ally' }
const id = questionId(draft.question, at)
const file = toMarkdown(draft, id, at)
const got = parse(file)

check('the id is sortable, dated and slugged', id === '2026-08-21_143022_can-dan-actually-be-monogamous', id)
check('the filename stem and the id: field agree', got.meta.id === id, got.meta.id)
check('asked: is ISO 8601 with no fractional seconds', got.meta.asked === '2026-08-21T14:30:22Z', got.meta.asked)
check('a new question is pending', got.meta.status === 'pending', got.meta.status)
check('asker: carries the name', got.meta.asker === 'Ally', got.meta.asker)
check('answered:, capture: and cites: exist and are empty',
  got.meta.answered === '' && got.meta.capture === '' && got.meta.cites === '[]')
check('## Question holds the question verbatim', got.question === draft.question, got.question)
check('## Answer exists and is empty', got.answer === '', JSON.stringify(got.answer))

// bin/wiki-work's find_sage() reads exactly these two lines to decide whether a
// question is outstanding and what to call it. If either regex stops matching,
// the question is never listed.
check('bin/wiki-work can find status:', /^status:[ \t]*(.*)$/m.exec(file)?.[1] === 'pending')
check('bin/wiki-work can find the first line of the question',
  file.split('## Question', 2)[1].split('\n## ', 1)[0].trim().split('\n')[0] === draft.question)

const anon = parse(toMarkdown({ question: draft.question, asker: '  ' }, id, at))
check('an unsigned question omits asker: rather than blanking it', anon.meta.asker === undefined)

check('a too-short question is refused', validate({ question: 'why', asker: '' }) !== null)
check('a real question passes', validate(draft) === null)
check('an over-long question is refused', validate({ question: 'x'.repeat(2000), asker: '' }) !== null)

console.log('\nsage: the lost-update guard')

const stale = { slug: 'people/annie-ulmer', source: '', savedAt: '2026-08-21T05:36:00Z', base: '2026-08-13' }
check('a draft forked before a later edit is stale', draftIsStale(stale, '2026-08-20') === true)
check('a draft forked from the current page is not', draftIsStale({ ...stale, base: '2026-08-20' }, '2026-08-20') === false)
check('two edits on the same day do not raise it', draftIsStale({ ...stale, base: '2026-08-20' }, '2026-08-20') === false)
check('a draft newer than upstream is not stale', draftIsStale({ ...stale, base: '2026-08-21' }, '2026-08-20') === false)
check('an unknown upstream date never raises it', draftIsStale(stale, undefined) === false)

// The drafts already sitting in browsers have no `base`, so the fallback has to
// work or the guard protects only drafts made after it shipped.
const legacy = {
  slug: 'people/annie-ulmer',
  savedAt: '2026-08-21T05:36:00Z',
  source: '---\ntitle: Annie\ndate_modified: 2026-08-13\n---\n\n# Annie\n',
}
check('a legacy draft falls back to its own date_modified', draftIsStale(legacy, '2026-08-20') === true)
check('a legacy draft with no date_modified is left alone',
  draftIsStale({ ...legacy, source: '---\ntitle: Annie\n---\n' }, '2026-08-20') === false)

console.log(failures ? `\nsage: ${failures} failure(s)` : '\nsage: all checks passed')
process.exit(failures ? 1 : 0)
