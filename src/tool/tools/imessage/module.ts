/**
 * EXTRACT IMESSAGE — the questions, and what they compose into.
 *
 * The hard parts are next door: `sql.ts` builds the statement, `body.ts` gets
 * the text out of the blob Apple moved it into, `script.ts` wraps both in
 * something a person can paste. This file is the conversation, and it is
 * deliberately short — six questions, two of which are skipped when they do not
 * apply, and every one of them a thing the command genuinely cannot work out
 * for itself.
 *
 * ---- what is NOT asked -----------------------------------------------------
 *
 * Nothing that can be discovered at run time. Not the macOS version, not
 * whether python3 is installed, not whether Messages has ever been signed in,
 * not the timezone. Every one of those is decided inside the emitted script on
 * the machine that will actually run it. A question here that the script could
 * answer there is a question that will eventually be answered wrong, because
 * the reader may be generating this on a phone for a Mac in another room.
 *
 * The home directory IS asked, for exactly that reason: `$HOME` is right when
 * you paste it into the Mac you are sitting at and wrong when you do not, so it
 * is offered as the default and overridable rather than assumed.
 */

import type { Answers, ToolModule } from '../../core'
import { Panels } from './Panels'
import { decodeRange, describeRange } from '../../shell/dates'
import { buildScript, outputName } from './script'
import type { Format } from './script'
import type { Scope, Target } from './sql'
import { digitsOf } from './sql'

/**
 * Read the handles out of the answer.
 *
 * Two shapes, because there are two ways in. Typed by hand it is a bare number
 * or address; picked from the address book beside the terminal it arrives as
 * `Name <handle>`, which reads correctly in the echo and carries the name into
 * the export without the panel having to reach into the plan. Keeping the name
 * inside the answer string is what lets `compose` stay a pure function of the
 * answers, and therefore what lets the build gate reproduce any deliverable.
 */
/**
 * Does this look like something chat.db could match on?
 *
 * The separator between several targets is a comma — and a great many people
 * are filed in an address book as "Example, Annie". So the comma cannot be
 * split on blindly, and the ambiguity is resolved by content rather than by
 * punctuation: a piece is a handle if it has an @ or at least five digits, and
 * anything else sitting in front of a <handle> is part of that person's name.
 */
const looksLikeHandle = (piece: string) => piece.includes('@') || digitsOf(piece).length >= 5

export function readHandles(raw: string): Target[] {
  const out: Target[] = []
  const angle = /<([^<>]+)>/g
  let cursor = 0
  let found: RegExpExecArray | null

  while ((found = angle.exec(raw))) {
    const pieces = raw.slice(cursor, found.index).split(/[,\n]+/).map((s) => s.trim())
    // Walk back from the < : everything that is not itself a handle belongs to
    // this entry's name, and the first thing that IS one ends the name.
    const nameParts: string[] = []
    while (pieces.length && !looksLikeHandle(pieces[pieces.length - 1])) {
      const piece = pieces.pop()
      if (piece) nameParts.unshift(piece)
    }
    for (const piece of pieces) if (piece) out.push({ handle: piece })
    const name = nameParts.join(', ').trim()
    const handle = found[1].trim()
    out.push(name ? { handle, name } : { handle })
    cursor = found.index + found[0].length
  }

  for (const piece of raw.slice(cursor).split(/[,\n]+/).map((s) => s.trim())) {
    if (piece) out.push({ handle: piece })
  }
  return out
}

function readTargets(answers: Answers): Target[] {
  if (answers.target === 'everyone') return []
  return readHandles(answers.handle ?? '')
}

export const imessage: ToolModule = {
  id: 'imessage',
  Panels,

  steps: [
    {
      kind: 'text',
      id: 'home',
      ask: 'Which Mac account is the history on?',
      placeholder: 'the short username, e.g. dan — or press enter for this one',
      fallback: '$HOME',
      validate: (value) => {
        if (value === '$HOME') return null
        if (value.includes('..')) return 'no `..` in a path this is going to write into.'
        if (/[\n\r\0]/.test(value)) return 'that is not a username.'
        return null
      },
    },
    {
      kind: 'choice',
      id: 'target',
      ask: 'Whose messages?',
      options: [
        { value: 'number', label: 'A phone number', note: 'SMS or iMessage' },
        { value: 'appleid', label: 'An Apple ID or email', note: 'iMessage only' },
        { value: 'everyone', label: 'Everybody', note: 'the whole database' },
      ],
      fallback: 'number',
    },
    {
      kind: 'text',
      id: 'handle',
      ask: 'Which one? Several is fine — separate them with commas.',
      placeholder: '+1 555 010 4477   ·   someone@icloud.com',
      when: (a) => a.target !== 'everyone',
      validate: (value, a) => {
        const parts = readHandles(value)
        if (!parts.length) return 'nothing to look for.'
        for (const { handle: part } of parts) {
          if (a.target === 'appleid') {
            if (!part.includes('@') || !part.includes('.')) {
              return `"${part}" is not an email address. For a phone number, go \`back\` and pick number.`
            }
          } else if (digitsOf(part).length < 5) {
            // Five is a shortcode. Below that there is nothing to match on, and
            // a predicate that matches nothing would produce an empty export
            // that looks like "you never texted them".
            return `"${part}" has too few digits to identify anybody.`
          }
        }
        return null
      },
    },
    {
      kind: 'choice',
      id: 'scope',
      ask: 'How much of it?',
      options: [
        {
          value: 'conversation',
          label: 'The whole conversation',
          note: 'includes any group thread they are in',
        },
        {
          value: 'handle',
          label: 'Only messages to and from them',
          note: 'one-to-one; no group threads',
        },
      ],
      fallback: 'conversation',
      when: (a) => a.target !== 'everyone',
    },
    {
      kind: 'dates',
      id: 'window',
      ask: 'Over what window of time?',
    },
    {
      kind: 'choice',
      id: 'format',
      ask: 'What shape do you want it in?',
      options: [
        { value: 'csv', label: 'CSV', note: 'one row per message, every metadata column' },
        { value: 'txt', label: 'TXT', note: 'a readable transcript' },
      ],
      fallback: 'csv',
    },
  ],

  compose: (answers) => {
    const targets = readTargets(answers)
    const range = decodeRange(answers.window ?? 'all')
    const format = (answers.format === 'txt' ? 'txt' : 'csv') as Format
    const scope: Scope = answers.scope === 'handle' ? 'handle' : 'conversation'

    const plan = {
      targets,
      scope,
      range,
      format,
      home: answers.home ?? '$HOME',
      label: targets.length ? targets.map((t) => t.name ?? t.handle).join('-') : 'everyone',
    }

    const who = targets.map((t) => (t.name ? `${t.name} (${t.handle})` : t.handle)).join(', ')

    const notes = [
      `Writes ${outputName(plan)}-<timestamp>.${format} to the Desktop, and a manifest beside it.`,
      targets.length
        ? scope === 'conversation'
          ? `Everything in any conversation involving ${who}, group threads included.`
          : `Only messages to and from ${who} — no group threads.`
        : 'Every message in the database, from everybody.',
      `Covering ${describeRange(range)}.`,
      'Snapshots the database and its write-ahead log first, so a running Messages.app cannot change it mid-read and the last few days are not missed.',
      'Counts the rows back against the database when it finishes, and fails rather than leaving you a short file.',
      'Phone numbers are matched on their last ten digits, so formatting differences between devices do not split one person into several.',
    ]

    if (targets.some((t) => t.name)) {
      notes.push('Each row carries the name from your address book as well as the raw handle.')
    }

    const warnings = [
      'It will ask macOS for the Messages database. If Full Disk Access is not granted to this terminal, it stops and tells you which toggle to flip — it cannot grant that itself.',
      'On Ventura and later most message text lives in a binary blob. Where python3 is present the recovery is exact; where it is not, long messages and emoji come back mangled. The manifest beside the export says which happened.',
      'Attachment files are not copied. Only their names are recorded.',
    ]

    if (format === 'txt') {
      notes.push('Timestamps are this Mac’s local time; the CSV also carries UTC and a raw epoch.')
    }

    return { script: buildScript(plan), notes, warnings }
  },
}
