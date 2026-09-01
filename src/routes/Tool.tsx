import { useEffect } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Nav } from '../components/Nav'
import { TOOLS, toolById } from '../tool/core'
import type { Tool } from '../tool/core'
import './tool.css'

/**
 * THE TOOL — 工具
 *
 * A workbench, not an instrument. Every other room here draws a corpus that is
 * already in the building. This one draws nothing: you tell a terminal what you
 * want done, and it hands back one block of shell to paste into Terminal.app,
 * after which nothing further is asked of you.
 *
 * ---- why it looks nothing like the rest of the building --------------------
 *
 * The rest of the site is a Tokyo backstreet at 4am — neon, toner, hand-cut
 * paper. That register is right for an argument about a person and wrong for a
 * thing that is going to hand you a command you will run against your own
 * machine. A tool has to read as precise, because you are about to trust it, so
 * this room is monospace, flat, high-contrast and still. The header stays,
 * because a reader still needs the way out, but it is repainted to match.
 *
 * The repaint is done by writing `data-room="tool"` on <html> in the effect
 * below rather than by branching in `App.tsx`. Two reasons. The chrome this
 * room restyles — the two crawls, the HUD, the Fx layers — is mounted globally
 * and would otherwise need a pathname guard in the app shell; and this room is
 * being built by several agents at once, so the app shell is exactly the file
 * that should not collect five conflicting edits. `term-fx-*` on <html> in
 * `src/components/rigs/Terminal.tsx` is the same trick and the precedent for it.
 *
 * ---- the ornament ----------------------------------------------------------
 *
 * There are moving parts in here that mean nothing. That is allowed — THE RULE
 * upstairs governs anything that draws the corpus, and this room draws none —
 * but it is not allowed to be ambiguous about it. Anything in this room that
 * looks like a readout carries the word ORNAMENT on it. Nothing here renders a
 * number that looks measured and is not.
 *
 * See `docs/TOOL.md` for the contract, and `src/tool/core.ts` for the registry.
 */

/* ==========================================================================
   WHAT IS BUILT

   The registry in `src/tool/core.ts` stays data; this map is where an id meets
   a component, the same split THE LEVIATHAN uses for its rack. Append a line
   when a tool lands. Do not reorder — every other agent has this file open.
   ========================================================================== */

const BUILT: Record<string, () => React.ReactNode> = {}

export function ToolRoute() {
  const { id } = useParams()
  const picked = id ? toolById(id) : null

  // The repaint, and the way back out of it. Cleared on unmount so navigating
  // away cannot strand the rest of the site wearing this room's paint.
  useEffect(() => {
    const root = document.documentElement
    root.dataset.room = 'tool'
    return () => {
      delete root.dataset.room
    }
  }, [])

  // Each tool's three colours, written as custom properties on the room root.
  // This is the whole of a tool's visual identity; nothing else is per-tool.
  const accent = picked?.accent
  const paint = accent
    ? ({
        ['--t-hue' as string]: accent.hue,
        ['--t-edge' as string]: accent.edge,
        ['--t-glow' as string]: accent.glow,
      } as React.CSSProperties)
    : undefined

  return (
    <div className={`tool${picked ? ' tool--picked' : ''}`} style={paint}>
      <Nav />

      <header className="tool__mast">
        <div className="tool__mast-in">
          <h1 className="tool__title">
            THE TOOL
            <span className="tool__kana jp" aria-hidden="true">
              工具
            </span>
          </h1>
          <p className="tool__promise">
            <b>One paste. No tinkering afterwards.</b> Answer the terminal, take the block it
            gives you, run it. Everything that can be decided here is decided here.
          </p>
        </div>
      </header>

      {picked ? <Bench tool={picked} /> : <Rack />}

      <footer className="tool__foot">
        <div className="tool__foot-in">
          <span className="tool__foot-mark">工具</span>
          <p>
            Nothing you type in this room leaves your browser. The commands are assembled on
            this page and handed to you; there is no server here to send them to.
          </p>
          <Link to="/" className="tool__foot-out">
            ← BACK TO THE BUILDING
          </Link>
        </div>
      </footer>
    </div>
  )
}

/* ---- the rack ----------------------------------------------------------- */

function Rack() {
  return (
    <main className="tool__rack">
      <ol className="tool__cards">
        {TOOLS.map((tool) => (
          <li key={tool.id}>
            <Link
              to={`/tool/${tool.id}`}
              className={`tool__card tool__card--${tool.status.toLowerCase()}`}
              style={
                {
                  ['--t-hue' as string]: tool.accent.hue,
                  ['--t-edge' as string]: tool.accent.edge,
                  ['--t-glow' as string]: tool.accent.glow,
                } as React.CSSProperties
              }
            >
              <span className="tool__card-no">{tool.numeral}</span>
              <span className="tool__card-status">{tool.status}</span>
              <h2 className="tool__card-title">
                {tool.title}
                <span className="jp" aria-hidden="true">
                  {tool.kana}
                </span>
              </h2>
              <p className="tool__card-blurb">{tool.blurb}</p>
              <dl className="tool__card-spec">
                <div>
                  <dt>DELIVERS</dt>
                  <dd>{tool.delivers}</dd>
                </div>
                <div>
                  <dt>NEEDS</dt>
                  <dd>{tool.needs}</dd>
                </div>
              </dl>
            </Link>
          </li>
        ))}

        {/* The rack says how many slots are open rather than quietly listing
            only what exists. A bench that shows only its finished tools cannot
            tell you what is missing. */}
        <li className="tool__slot" aria-label="unclaimed slots">
          <span className="tool__slot-mark" aria-hidden="true">
            ⌗
          </span>
          <p>
            Four more slots on this bench are unclaimed. The contract for filling one is in{' '}
            <code>docs/TOOL.md</code>.
          </p>
        </li>
      </ol>
    </main>
  )
}

/* ---- one tool, selected -------------------------------------------------- */

function Bench({ tool }: { tool: Tool }) {
  const Built = BUILT[tool.id]

  return (
    <main className="tool__bench">
      <div className="tool__bench-head">
        <Link to="/tool" className="tool__back">
          ← THE RACK
        </Link>
        <h2 className="tool__bench-title">
          <span className="tool__card-no">{tool.numeral}</span>
          {tool.title}
          <span className="jp" aria-hidden="true">
            {tool.kana}
          </span>
        </h2>
        <span className={`tool__card-status tool__card-status--${tool.status.toLowerCase()}`}>
          {tool.status}
        </span>
      </div>

      {Built ? (
        Built()
      ) : (
        <div className="tool__pending">
          <p className="tool__pending-lead">{tool.blurb}</p>
          <dl className="tool__card-spec">
            <div>
              <dt>DELIVERS</dt>
              <dd>{tool.delivers}</dd>
            </div>
            <div>
              <dt>NEEDS</dt>
              <dd>{tool.needs}</dd>
            </div>
          </dl>
          <p className="tool__pending-note">
            The terminal for this tool is not wired yet. It is being built — the bench is
            standing, the command is not. Nothing here will hand you a half-working command in
            the meantime.
          </p>
        </div>
      )}
    </main>
  )
}
