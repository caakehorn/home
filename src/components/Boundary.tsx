import { Component, type ErrorInfo, type ReactNode } from 'react'
import './boundary.css'

/* ==========================================================================
   THE BOUNDARY — what the building does instead of going black

   Every room on this site is a separate chunk, fetched the first time somebody
   walks into it. That is the right arrangement — see the note at the top of
   `App.tsx` about the 729 kB bundle it replaced — and it has one failure mode
   nobody had written down:

   **A deploy replaces every chunk, and a tab that is already open still has
   the old file names.** Vite hashes chunks by content, the deploy publishes
   `Lineage-a1b2c3.js` and deletes `Lineage-Qw0rN5.js`, and the tab that
   loaded ten minutes ago is still holding a module graph that points at the
   file that is gone. Walk into a room that tab has not been to yet and the
   dynamic import 404s.

   With no boundary, React's answer to a rejected `lazy()` is to unmount the
   entire tree. Not the room — the tree. `#root` ends up with zero children,
   which on this site's black page is indistinguishable from the site simply
   going dark, and there is nothing on screen to click and no error to read.

   This was always possible and almost never seen, because a deploy used to
   mean somebody merged a pull request and nobody was standing inside the
   building when it landed. THE SLATE ROOM changed that: saving a picture
   commits, committing triggers the deploy, and the deploy lands under the tab
   of the person who pressed the button. What was a rare race is now the
   ordinary path, which is how it got found.

   ---- so: reload, once, and say so ----------------------------------------

   A missing chunk is not a bug to report, it is a tab that is out of date, and
   the fix is deterministic — fetch `index.html` again and get the new names.
   So that case reloads itself. The guard is a timestamp in sessionStorage: a
   reload that lands in another missing chunk within ten seconds is a loop
   rather than a recovery, and it stops and shows the panel instead of
   thrashing the browser against a broken deploy.

   Every other error gets the panel with its own message on it. A room that
   throws for its own reasons is a bug, and a bug that shows you a black page
   is a bug nobody can report.
   ========================================================================== */

/** Long enough for the reload to finish; short enough to still be one gesture. */
const LOOP_MS = 10_000
const KEY = 'danfrank:stale-reload'

/**
 * Is this a chunk that is no longer on the server?
 *
 * Matched on the message because that is all any of the three engines give:
 * Chrome says "Failed to fetch dynamically imported module", Firefox says
 * "error loading dynamically imported module", Safari says "Importing a module
 * script failed". Vite's own preload helper throws its own wording again.
 */
export function isStaleChunk(error: unknown): boolean {
  const message = error instanceof Error ? `${error.name}: ${error.message}` : String(error)
  return (
    /dynamically imported module/i.test(message) ||
    /Importing a module script failed/i.test(message) ||
    /ChunkLoadError/i.test(message) ||
    /Failed to fetch/i.test(message)
  )
}

/** Reload, unless we just did — in which case this is a loop, not a recovery. */
export function reloadOnce(): boolean {
  let last = 0
  try {
    last = Number(sessionStorage.getItem(KEY) ?? 0)
  } catch {
    /* private mode: no memory of a previous try, so allow this one */
  }
  if (Date.now() - last < LOOP_MS) return false
  try {
    sessionStorage.setItem(KEY, String(Date.now()))
  } catch {
    /* nothing to do — the reload below is still the right move */
  }
  window.location.reload()
  return true
}

type Props = { children: ReactNode }
type State = { error: Error | null; stale: boolean; reloading: boolean }

export class Boundary extends Component<Props, State> {
  state: State = { error: null, stale: false, reloading: false }

  static getDerivedStateFromError(error: Error): State {
    return { error, stale: isStaleChunk(error), reloading: false }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // No telemetry on this site and none is being added. The console is where
    // a stack trace belongs when the only person debugging is the one holding
    // the laptop.
    console.error('[boundary]', error, info.componentStack)
    if (isStaleChunk(error) && reloadOnce()) this.setState({ reloading: true })
  }

  render() {
    const { error, stale, reloading } = this.state
    if (!error) return this.props.children

    return (
      <div className="boundary">
        <div className="boundary__panel">
          <p className="boundary__kana jp" aria-hidden="true">
            {stale ? '再読' : '故障'}
          </p>
          <h1 className="boundary__title">
            {stale ? 'THIS TAB IS A DEPLOY BEHIND' : 'THIS ROOM FELL OVER'}
          </h1>

          {stale ? (
            <p className="boundary__note">
              The site rebuilt while you had it open, which renames every room's
              JavaScript, and this tab was still asking for the old names.{' '}
              {reloading
                ? 'Reloading now — nothing was lost.'
                : 'Reloading did not fix it, so something is wrong with the deploy rather than with this tab. Give it a minute and try again.'}
            </p>
          ) : (
            <p className="boundary__note">
              Not your fault and nothing you did. The message is below, and the
              same thing is in the console with a stack.
            </p>
          )}

          <pre className="boundary__what">{error.message}</pre>

          <p className="boundary__acts">
            <button type="button" className="boundary__go" onClick={() => window.location.reload()}>
              RELOAD
            </button>
            <a className="boundary__alt" href={import.meta.env.BASE_URL}>
              THE FRONT DOOR
            </a>
          </p>
        </div>
      </div>
    )
  }
}
