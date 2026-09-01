import { useState } from 'react'
import { usePortal } from '../state/usePortal'
import { ago, stamp, useSyncStatus } from './sync-status'
import './sync-light.css'

/**
 * THE SYNC LIGHT — whether the wiki on this page is the wiki that exists.
 *
 * Blue dot: the snapshot is standing on the newest wiki-brain commit that could
 * have changed it. Flashing yellow triangle with a red exclamation: it is not,
 * and what you are reading is behind the source by however long the panel says.
 *
 * `sync-status.ts` carries the reasoning about what is compared. This file is
 * about three decisions in how it is drawn.
 *
 * **The colours are hard-coded, and that is deliberate.** Every other coloured
 * thing on this site takes its hue from the palette — five of them, and two
 * collapse the accent ramp, so a design needing separable colours breaks in two
 * of five. A status light cannot work that way. Blue-means-fine and
 * yellow-triangle-means-look are the only two facts this control has, and a
 * reader who has to know which palette they picked before they can read it has
 * not been told anything. So it holds its own colours in every palette, with
 * a stroke on the triangle so it survives `riot`, where the page is paper.
 *
 * **It flashes only when it may.** `motion` from `usePortal()` gates the
 * animation, and the system's Reduce Motion setting feeds that. Held still it
 * is still a yellow triangle with a red exclamation in it — the alarm is the
 * shape and the colour, and the flashing is emphasis on top. That is the right
 * way round: a warning that is *only* an animation disappears for the readers
 * most likely to need the plain version.
 *
 * **Only "behind" is loud.** Checking is a dim dot. So is not being able to find
 * out — rate-limited, offline, GitHub down. A light that goes yellow when it
 * cannot see is one people learn to ignore before the day it is right.
 */
export function SyncLight({ compact = false }: { compact?: boolean }) {
  const status = useSyncStatus()
  const { motion } = usePortal()
  const [open, setOpen] = useState(false)

  const behind = status.state === 'behind'
  const label =
    status.state === 'behind'
      ? 'SYNC BEHIND'
      : status.state === 'current'
        ? 'SYNC CURRENT'
        : status.state === 'unknown'
          ? 'SYNC UNKNOWN'
          : 'SYNC…'

  const title =
    status.state === 'behind'
      ? `The published wiki is behind its source. This snapshot was built from a commit of ${stamp(status.sourceAt)}; ${status.paths.join(', ')} moved at ${stamp(status.newestAt)} (${ago(status.newestAt)}).`
      : status.state === 'current'
        ? `Current. Built ${ago(status.snapshotAt)} from the newest wiki-brain commit that could have changed it (${stamp(status.sourceAt)}).`
        : status.state === 'unknown'
          ? `Cannot tell: ${status.reason}.`
          : 'Asking GitHub whether the source has moved…'

  return (
    <div className={`synclight${compact ? ' synclight--compact' : ''}`}>
      <button
        type="button"
        className={`synclight__btn synclight__btn--${status.state}${
          behind && motion ? ' synclight__btn--flash' : ''
        }`}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        title={title}
      >
        <span className="synclight__mark" aria-hidden="true">
          {behind ? <WarnTriangle /> : <Dot />}
        </span>
        <span className="synclight__label">{label}</span>
      </button>

      {/* aria-live rather than an alert: it is worth announcing when it changes
          under a reader, and it is not worth interrupting them for. */}
      <span className="synclight__sr" role="status" aria-live="polite">
        {title}
      </span>

      {open && (
        <div className="synclight__panel">
          {status.state === 'behind' && (
            <>
              <p className="synclight__lede">
                <b>This page is behind the source.</b> The wiki you are reading is a snapshot,
                rebuilt every few minutes from{' '}
                <a href="https://github.com/caakehorn/wiki-brain" target="_blank" rel="noreferrer">
                  caakehorn/wiki-brain
                </a>
                . That rebuild has not caught up with the newest writing.
              </p>
              <dl className="synclight__rows">
                <div>
                  <dt>this snapshot</dt>
                  <dd>
                    {stamp(status.snapshotAt)} · {ago(status.snapshotAt)}
                  </dd>
                </div>
                <div>
                  <dt>built from a commit of</dt>
                  <dd>{stamp(status.sourceAt)}</dd>
                </div>
                <div>
                  <dt>source last moved</dt>
                  <dd>
                    {stamp(status.newestAt)} · {ago(status.newestAt)}
                  </dd>
                </div>
                <div>
                  <dt>waiting on</dt>
                  <dd>{status.paths.join(' · ')}</dd>
                </div>
              </dl>
              <p className="synclight__note">
                Nothing here is wrong — it is older than the source. The{' '}
                <a
                  href="https://github.com/caakehorn/home/actions/workflows/sync-wiki.yml"
                  target="_blank"
                  rel="noreferrer"
                >
                  sync workflow
                </a>{' '}
                is what closes the gap — on its own schedule every few minutes, or the moment
                an edit is made from this site.
              </p>
            </>
          )}

          {status.state === 'current' && (
            <>
              <p className="synclight__lede">
                <b>Current.</b> This snapshot stands on the newest commit that could have changed
                it.
              </p>
              <dl className="synclight__rows">
                <div>
                  <dt>this snapshot</dt>
                  <dd>
                    {stamp(status.snapshotAt)} · {ago(status.snapshotAt)}
                  </dd>
                </div>
                <div>
                  <dt>source commit</dt>
                  <dd>{stamp(status.sourceAt)}</dd>
                </div>
              </dl>
              <p className="synclight__note">
                Checked against <code>wiki/</code>, <code>sage/questions/</code>, <code>plain/</code>{' '}
                and <code>lexicon/words/</code> — every path the sync reads. A commit touching only
                the source repo&rsquo;s own logs changes nothing here and is not counted.
              </p>
            </>
          )}

          {status.state === 'unknown' && (
            <p className="synclight__lede">
              <b>Cannot tell.</b> {status.reason}. This is not a warning about the wiki — it is the
              light saying it could not ask. It will try again on the next visit.
            </p>
          )}

          {status.state === 'checking' && <p className="synclight__lede">Asking…</p>}
        </div>
      )}
    </div>
  )
}

/** Blue when current; the same dot, drained, for checking and unknown. */
function Dot() {
  return (
    <svg viewBox="0 0 16 16" width="100%" height="100%">
      <circle cx="8" cy="8" r="5" className="synclight__dot" />
    </svg>
  )
}

/** Yellow triangle, red exclamation, dark stroke so it holds on paper. */
function WarnTriangle() {
  return (
    <svg viewBox="0 0 16 16" width="100%" height="100%">
      <path
        d="M8 1.4 15 14.2H1L8 1.4Z"
        className="synclight__tri"
        strokeLinejoin="round"
        strokeWidth="1.2"
      />
      <rect x="7.15" y="5.6" width="1.7" height="4.6" rx="0.85" className="synclight__bang" />
      <circle cx="8" cy="12" r="1" className="synclight__bang" />
    </svg>
  )
}
