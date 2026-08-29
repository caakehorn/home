import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { usePortal } from '../state/usePortal'
import { nameOf, VERDICT_TONE, type DocketSet, type Prediction } from './core'
import { Reading } from './Reading'

/**
 * III · THE BOARD — 賭
 *
 * Sixty-eight falsifiable claims, three of them already scored, on a
 * departures board.
 *
 * ---- why a board ------------------------------------------------------------
 *
 * A prediction is the one thing in this building with a clock on it. Everything
 * else here is a claim about what happened; these are claims about what happens
 * next, and the whole point of writing one down is that it can come back and
 * embarrass you. A departures board is the furniture that says so: rows that
 * are waiting, rows that have been called, and a split flap that moves when the
 * status does.
 *
 * ---- the column that matters ------------------------------------------------
 *
 * FALSIFIER. Nineteen of the sixty-eight state what would kill them; forty-nine
 * do not, and the board prints that as a dash rather than leaving the column
 * off. A prediction with no stated falsifier is not necessarily unfalsifiable —
 * several of these are obviously checkable against a future export — but the
 * page did not say, and the difference between "here is how to kill this" and
 * "somebody will know it when they see it" is most of what separates a
 * forecast from a horoscope. The dash is the finding.
 *
 * ---- the three that have been scored ---------------------------------------
 *
 * CONFIRMED, PARTIALLY FALSIFIED, RESOLVED. Three out of sixty-eight, which is
 * a scoring rate of four percent, and the wiki's own `the-cato-seat` predicts
 * exactly that: *"the wiki will accumulate more predictions than
 * interventions."* That prediction is on this board, unscored, being confirmed
 * by the board it is on.
 */

const FLAP = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 —·'

export function Board({ set }: { set: DocketSet }) {
  const [filter, setFilter] = useState<'ALL' | 'STANDING' | 'SCORED' | 'FALSIFIABLE'>('ALL')
  const [picked, setPicked] = useState<string | null>(null)

  const rows = useMemo(() => {
    const order = { STANDING: 1 } as Record<string, number>
    const sorted = [...set.predictions].sort(
      (a, b) => (order[a.verdict] ?? 0) - (order[b.verdict] ?? 0) || a.page.localeCompare(b.page),
    )
    if (filter === 'STANDING') return sorted.filter((p) => p.verdict === 'STANDING')
    if (filter === 'SCORED') return sorted.filter((p) => p.verdict !== 'STANDING')
    if (filter === 'FALSIFIABLE') return sorted.filter((p) => p.falsifier)
    return sorted
  }, [set, filter])

  const stated = set.predictions.filter((p) => p.falsifier).length
  const scored = set.predictions.filter((p) => p.verdict !== 'STANDING').length

  return (
    <div className="dk-board">
      <div className="dk-board__head">
        <div className="dk-controls" role="group" aria-label="What to show">
          {(
            [
              ['ALL', set.predictions.length],
              ['STANDING', set.predictions.length - scored],
              ['SCORED', scored],
              ['FALSIFIABLE', stated],
            ] as const
          ).map(([id, n]) => (
            <button
              key={id}
              type="button"
              className={`dk-chip${filter === id ? ' dk-chip--on' : ''}`}
              aria-pressed={filter === id}
              onClick={() => setFilter(id)}
            >
              {id} {n}
            </button>
          ))}
        </div>
        <p className="dk-board__rate">
          <b>{((scored / set.predictions.length) * 100).toFixed(0)}%</b> SCORED ·{' '}
          <b>{((stated / set.predictions.length) * 100).toFixed(0)}%</b> STATE A FALSIFIER
        </p>
      </div>

      <div className="dk-board__grid" role="table" aria-label="Standing predictions">
        <div className="dk-board__row dk-board__row--head" role="row">
          <span role="columnheader">STATUS</span>
          <span role="columnheader">THE CLAIM</span>
          <span role="columnheader">FALSIFIER</span>
          <span role="columnheader">FILED BY</span>
        </div>

        {rows.map((p) => (
          <Row
            key={p.id}
            set={set}
            p={p}
            open={picked === p.id}
            onToggle={() => setPicked(picked === p.id ? null : p.id)}
          />
        ))}
      </div>
    </div>
  )
}

function Row({
  set,
  p,
  open,
  onToggle,
}: {
  set: DocketSet
  p: Prediction
  open: boolean
  onToggle: () => void
}) {
  const tone = VERDICT_TONE[p.verdict] ?? '#ffb020'
  return (
    <>
      <div
        className={`dk-board__row${open ? ' dk-board__row--open' : ''}`}
        role="row"
        style={{ ['--tone' as string]: tone }}
      >
        <span className="dk-board__status" role="cell">
          <Flap text={p.verdict === 'STANDING' ? 'STANDING' : p.verdict} />
        </span>
        <span className="dk-board__claim" role="cell">
          <button type="button" className="dk-board__open" onClick={onToggle} aria-expanded={open}>
            {p.claim}
          </button>
        </span>
        <span className="dk-board__fals" role="cell">
          {p.falsifier ? (
            <em>{p.falsifier}</em>
          ) : (
            <span className="dk-board__none" title="This page did not state one">
              —
            </span>
          )}
        </span>
        <span className="dk-board__by" role="cell">
          <Link to={`/brain/${p.page}`}>{nameOf(set, p.page).toUpperCase()}</Link>
        </span>
      </div>
      {open && (
        <div className="dk-board__body" role="row">
          <div role="cell">
            <Reading text={p.text.replace(/^\s*(?:[-*]|\d+\.)\s+/, '')} />
          </div>
        </div>
      )}
    </>
  )
}

/**
 * A split flap.
 *
 * The letters roll to their value once, on mount, and never again — the status
 * of a prediction changes when somebody scores it in the wiki, which is a
 * commit, not an event this page can witness. A board that kept flickering
 * would be claiming otherwise. Under a motion preference it is already there.
 */
function Flap({ text }: { text: string }) {
  const { motion } = usePortal()
  const [shown, setShown] = useState(motion ? '' : text)
  const frame = useRef(0)

  useEffect(() => {
    if (!motion) {
      setShown(text)
      return
    }
    let n = 0
    let raf = 0
    const tick = () => {
      frame.current++
      // Each character settles in turn, left to right, after a few rolls.
      // Two frames a character: PARTIALLY FALSIFIED is nineteen of them, and at
      // three frames each the tail was still rolling a second after the row
      // arrived — which reads as a rendering bug rather than as a flap.
      const settled = Math.floor(n / 2)
      setShown(
        text
          .split('')
          .map((ch, i) =>
            i < settled ? ch : FLAP[(frame.current * 7 + i * 13) % FLAP.length],
          )
          .join(''),
      )
      n++
      if (settled <= text.length) raf = requestAnimationFrame(tick)
      else setShown(text)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [text, motion])

  return (
    <b className="dk-flap" aria-label={text}>
      <span aria-hidden="true">{shown.padEnd(text.length, ' ')}</span>
    </b>
  )
}
