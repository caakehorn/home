/**
 * THE TOOL — the registry, and the contract every tool in the room signs.
 *
 *   /tool          the rack
 *   /tool/imessage a tool, selected
 *
 * ---- what this room is, and what it is not ---------------------------------
 *
 * Every other room on this site is an instrument: it draws a corpus that is
 * already here and argues about it. This one draws nothing. It is a workbench.
 * You tell a terminal what you want, and it hands you one block of shell to
 * paste into Terminal.app — after which nothing else is asked of you. That is
 * the whole promise, and it is the bar every tool in here has to clear:
 *
 *   ONE PASTE. NO TINKERING AFTERWARDS.
 *
 * A tool that emits a command needing a hand-edited path, a second command, or
 * a "now open this file and change line 3" does not ship. Where a human really
 * is unavoidable — macOS will not let a script grant itself Full Disk Access,
 * and no amount of cleverness changes that — the emitted script says so in
 * plain words, opens the right settings pane itself, and exits non-zero rather
 * than pretending it worked.
 *
 * ---- what the decor may claim ----------------------------------------------
 *
 * THE RULE at the top of `src/leviathan/core.ts` governs anything that draws
 * this corpus. This room draws no corpus, so the rule does not bind it — but
 * the spirit does. The moving parts in here are ornament, and they say so on
 * their own face, the way THE ATLAS prints THE MAP IS DRAWN BY HAND. Nothing
 * in this room may render a number that looks measured and is not.
 *
 * ---- five tools, several authors -------------------------------------------
 *
 * This room is built by more than one agent at a time. `docs/TOOL.md` is the
 * working agreement; the short version is that a tool owns
 * `src/tool/tools/<id>/**` and nothing else, and that the only shared edits are
 * one appended entry in TOOLS below and one appended line in the BUILT map in
 * `src/routes/Tool.tsx`. Append. Never reorder — a reordered array is a
 * conflict in every other agent's branch at once.
 */

import type { ComponentType } from 'react'

/* ==========================================================================
   THE CONTRACT

   A tool is data plus two pure functions. It does not own the terminal, it
   does not read the DOM, and it does not know it is on a web page: the shell
   asks its questions and calls `compose` with the answers. That is what makes
   the deliverable checkable in `scripts/check-tool.mjs` with no browser.
   ========================================================================== */

export type ToolStatus =
  /** Built, wired, and emitting a command that has been checked. */
  | 'LIVE'
  /** Slot claimed and specified; nobody has built it yet. */
  | 'SEALED'
  /** Being built right now, by somebody. Not reachable from the rack. */
  | 'WIRING'

/** One question the shell puts to the reader, in order. */
export type Step =
  | {
      kind: 'choice'
      id: string
      /** The line printed above the options. */
      ask: string
      options: { value: string; label: string; note?: string }[]
      /** Pre-selected value. A step with a default can be skipped with `next`. */
      fallback?: string
    }
  | {
      kind: 'text'
      id: string
      ask: string
      placeholder?: string
      fallback?: string
      /** Return null when the value is good, or the complaint to print. */
      validate?: (value: string) => string | null
    }
  | {
      kind: 'dates'
      id: string
      ask: string
    }
  /**
   * A step the reader answers by handing over a file rather than typing. The
   * shell renders the drop zone; the tool's own Panels do the parsing, and
   * write the result back as an ordinary answer.
   */
  | { kind: 'file'; id: string; ask: string; accept: string }

export type Answers = Record<string, string>

/**
 * What a tool hands back.
 *
 * `notes` are what the command will do, said plainly, so the reader can read
 * before they paste. `warnings` are what it cannot do, or does approximately —
 * never omitted to make the output look cleaner.
 */
export type Deliverable = {
  script: string
  notes: string[]
  warnings: string[]
}

export type ToolModule = {
  id: string
  /** Asked in this order. The shell walks them; `back` walks them backwards. */
  steps: Step[]
  /**
   * Pure, and deterministic: the same answers must produce a byte-identical
   * script forever. No Date.now(), no Math.random(), no Set/Map iteration over
   * anything the reader can reorder. `npm run tool:check` composes every
   * fixture twice and diffs, so an accidental clock reference fails the build.
   */
  compose: (answers: Answers) => Deliverable
  /** Optional extra surface mounted beside the terminal while this tool is up. */
  Panels?: ComponentType
}

/* ==========================================================================
   THE RACK

   Data only — which tool a component belongs to is resolved by the BUILT map
   in `src/routes/Tool.tsx`, the same split THE LEVIATHAN uses for its
   instruments. Appending here does not drag a component into the entry chunk.
   ========================================================================== */

export type Tool = {
  id: string
  numeral: string
  title: string
  kana: string
  /** One line on the rack card. */
  blurb: string
  /** What lands on the Desktop, or wherever it lands. Every tool owes this. */
  delivers: string
  /** What the reader must have for the command to work at all. */
  needs: string
  status: ToolStatus
  /**
   * The repaint. Three colours written as CSS custom properties on the room
   * root when this tool is selected — see `src/routes/tool.css`. They are the
   * whole of a tool's visual identity; nothing else in here is per-tool.
   */
  accent: { hue: string; edge: string; glow: string }
}

export const TOOLS: Tool[] = [
  {
    id: 'imessage',
    numeral: 'I',
    title: 'EXTRACT IMESSAGE',
    kana: '抽出',
    blurb:
      'Pull the text out of chat.db — by number, by Apple ID, over any window of dates — with every scrap of metadata the database actually holds.',
    delivers: 'A CSV or TXT on your Desktop, plus a manifest saying what was taken.',
    needs: 'A Mac, its Messages history, and one grant of Full Disk Access to Terminal.',
    status: 'WIRING',
    accent: { hue: '#00e5b0', edge: '#0affc2', glow: '#00e5b055' },
  },
]

export const toolById = (id: string) => TOOLS.find((t) => t.id === id)
