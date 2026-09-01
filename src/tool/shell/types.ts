/**
 * What the terminal prints, and what a tool can say back to it.
 *
 * Kept separate from `src/tool/core.ts` on purpose: `core.ts` is the contract a
 * tool signs and is imported by the build gate, which has no React and no DOM.
 * This file is the shell's own vocabulary.
 */

/**
 * One printed line.
 *
 * The kinds are visual, not semantic — they decide a colour and nothing else —
 * with one exception. `deliver` is the finished command, and it is marked so
 * the shell can render it as a copyable block rather than as text, because a
 * command the reader has to select by hand is a command they will get wrong.
 */
export type LineKind =
  /** What the reader typed, echoed back. */
  | 'in'
  /** Ordinary output. */
  | 'out'
  /** A complaint. Something was not understood, or was refused. */
  | 'err'
  /** A question, and the options under it. */
  | 'ask'
  /** Something settled — an answer accepted, a step passed. */
  | 'ok'
  /** Something the reader should know before pasting. Never suppressed. */
  | 'warn'
  /** Rules, banners, spacers. */
  | 'art'
  /** The finished command. Rendered as a block with its own copy button. */
  | 'deliver'

export type Line = { kind: LineKind; text: string }

/**
 * What a tool's `Panels` can do to the terminal it is sitting next to.
 *
 * Deliberately four verbs and no more. A panel can answer the question the
 * shell is asking, print something, and read what has been answered so far. It
 * cannot move the step pointer, rewrite history, or reach the input — the shell
 * owns the conversation, and a panel that could drive it would be a second
 * source of truth for where the reader is.
 */
export type ShellApi = {
  /** Answer a step by id, as though it had been typed. Advances if it is current. */
  answer: (id: string, value: string) => void
  /** Print a line. Use `warn` for anything the reader needs before pasting. */
  say: (kind: LineKind, text: string) => void
  /** Everything answered so far, including the step in progress if it is answered. */
  answers: Readonly<Record<string, string>>
  /** The id of the step the shell is waiting on, or null when it is finished. */
  waitingOn: string | null
}
