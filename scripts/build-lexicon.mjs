/**
 * Bakes ◈ CORPUS V · THE LEXICON out of the vendored transcript.
 *
 *   npm run lexicon
 *
 * Word frequencies over 134,348 messages, and the share of them written in
 * capitals, month by month. Reads `public/transcript/`, writes
 * `public/leviathan/lexicon.json`.
 *
 * ---- the one editorial decision, published rather than hidden --------------
 *
 * A word cloud of raw frequencies is a picture of the word "the". Every such
 * instrument that has ever been built drops the closed-class words, and doing
 * that is a choice about what counts as a word — the exact kind of choice THE
 * RULE exists to make visible.
 *
 * So: the stoplist is **closed-class only** — articles, pronouns, prepositions,
 * conjunctions, auxiliaries, and the contraction fragments a naive tokeniser
 * produces. Nothing was dropped for being rude, boring, revealing or off-topic,
 * and no word was added to it after looking at what removing it would do to the
 * chart. It **ships inside the dataset** as `stoplist`, and the instrument
 * prints it in full, so anyone can read the list and disagree with it. That is
 * the same arrangement the old repo used (`LVAnnie.STOP`) and the reason it
 * gave for it.
 *
 * `topAll` is the frequency table **before** the stoplist is applied, so the
 * effect of the choice is inspectable rather than asserted.
 *
 * ---- what is counted ------------------------------------------------------
 *
 * A word is a run of letters and apostrophes, lowercased. Numbers, punctuation
 * and emoji are not words and are not counted. A message written in capitals is
 * one with at least three letters and no lowercase letter in it — a definition
 * with an obvious edge (a one-word "OK" is not counted) which is stated on the
 * instrument rather than tuned.
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const IN = 'public/transcript'
const OUT = 'public/leviathan'
const KEEP = 400

if (!existsSync(join(IN, 'index.json'))) {
  console.error(`No transcript to read: ${IN}/index.json`)
  console.error('Get the record over first: npm run transcript -- ../leviathan')
  process.exit(1)
}

/**
 * Closed-class English, plus the fragments an apostrophe-splitting tokeniser
 * leaves behind. Open-class words — nouns, verbs, adjectives, adverbs, names —
 * are not in here and were never considered for it.
 */
const STOP = `a about above after again against all am an and any are aren't as at
be because been before being below between both but by
can cannot could couldn't
did didn't do does doesn't doing don't down during
each
few for from further
had hadn't has hasn't have haven't having he he'd he'll he's her here here's hers herself him himself his how how's
i i'd i'll i'm i've if in into is isn't it it's its itself
let's
me more most mustn't my myself
no nor not
of off on once only or other ought our ours ourselves out over own
same shan't she she'd she'll she's should shouldn't so some such
than that that's the their theirs them themselves then there there's these they they'd they'll they're they've this those through to too
under until up
very
was wasn't we we'd we'll we're we've were weren't what what's when when's where where's which while who who's whom why why's will with won't would wouldn't
you you'd you'll you're you've your yours yourself yourselves
ll re ve s t m d
`
  .split(/\s+/)
  .filter(Boolean)

const stop = new Set(STOP)

const months = readdirSync(join(IN, 'months')).filter((f) => f.endsWith('.json')).sort()
if (!months.length) {
  console.error(`No months under ${IN}/months — the record is not vendored.`)
  process.exit(1)
}

const WORD = /[a-z']+/g

/** @type {Map<string, { all: number, sent: number, received: number }>} */
const words = new Map()
const perMonth = []
let messages = 0
let letters = 0
let shouts = 0

for (const file of months) {
  const bin = JSON.parse(readFileSync(join(IN, 'months', file), 'utf8'))
  let monthShouts = 0

  for (const [, dir, text] of bin.m) {
    messages++
    const body = String(text ?? '')

    // A shout: at least three letters, and not one of them lowercase.
    const alpha = body.replace(/[^A-Za-z]/g, '')
    if (alpha.length >= 3 && alpha === alpha.toUpperCase()) {
      shouts++
      monthShouts++
    }

    for (const match of body.toLowerCase().matchAll(WORD)) {
      const word = match[0].replace(/^'+|'+$/g, '')
      if (word.length < 2) continue
      letters++
      const row = words.get(word) ?? { all: 0, sent: 0, received: 0 }
      row.all++
      if (dir) row.sent++
      else row.received++
      words.set(word, row)
    }
  }

  perMonth.push({ bin: bin.bin, count: bin.count, shouts: monthShouts })
}

const ranked = [...words.entries()]
  .map(([word, row]) => ({ word, ...row }))
  .sort((a, b) => b.all - a.all || a.word.localeCompare(b.word))

const top = ranked.filter((row) => !stop.has(row.word)).slice(0, KEEP)
const topAll = ranked.slice(0, 60)

const set = {
  generatedAt: new Date().toISOString(),
  source: `${IN} · ${months.length} months`,
  messages,
  /** Every word occurrence counted, stoplist or not. */
  tokens: letters,
  /** Distinct words before the stoplist. */
  distinct: words.size,
  shouts,
  /** Kept for the instrument to print in full. It is the only filter here. */
  stoplist: STOP,
  /** After the stoplist. */
  top,
  /** Before it, so the effect of the stoplist can be read rather than trusted. */
  topAll,
  months: perMonth,
}

mkdirSync(OUT, { recursive: true })
writeFileSync(join(OUT, 'lexicon.json'), JSON.stringify(set) + '\n')

console.log(
  `${OUT}/lexicon.json — ${messages.toLocaleString()} messages · ` +
    `${letters.toLocaleString()} words · ${words.size.toLocaleString()} distinct · ` +
    `${shouts.toLocaleString()} in capitals · ${(JSON.stringify(set).length / 1e3).toFixed(0)} kB`,
)
console.log(`  top five after the stoplist: ${top.slice(0, 5).map((t) => t.word).join(', ')}`)
console.log(`  top five before it: ${topAll.slice(0, 5).map((t) => t.word).join(', ')}`)
