import { useCallback, useEffect, useRef, useState } from 'react'
import {
  DIRECTIONS,
  MIN_TRAVEL,
  NUMBERS,
  POSITIONS,
  STEP,
  directionWord,
  formatCombination,
  positionAt,
} from './combination'
import { loadChallenge, tryPassphrase } from './protocol'
import { GREETING } from './config'

/* ==========================================================================
   THE PADLOCK

   A combination dial, worked the way a real one is: spin RIGHT to the first
   number, LEFT to the second, RIGHT to the third, then pull the shackle.

   ---- how a number gets committed ---------------------------------------

   By REVERSING, not by clicking. That is the whole reason this is a lock
   rather than three number pickers stacked up: on a physical padlock the
   direction change is the commit, and everything about the feel of the object
   comes from that one fact. Turn right, and the moment you turn back the other
   way the number you were sitting on is your first. Turn left, reverse again,
   that is your second. The third has no reversal after it, so PULL is what
   commits it — which is also what a hand does.

   The same rule serves the keyboard for free: → and ← rotate, and pressing
   the opposite arrow IS the reversal, so a keyboard user performs the
   identical gesture rather than a bolted-on alternative. Enter pulls.

   `MIN_TRAVEL` stops the jitter at the start of a drag counting as a
   reversal, which would otherwise commit whatever number you were parked on
   before you had moved at all.

   ---- what it is checking against ---------------------------------------

   The combination is the passphrase. `formatCombination` turns the dialled
   numbers into one string and `tryPassphrase` decrypts the same blob the
   typed door always used — the crypto is untouched. `./combination` states
   what that costs in keyspace, and does not soften it.
   ========================================================================== */

type Props = {
  onOpen: (phrase: string) => void
  onWrong: () => void
}

export function Padlock({ onOpen, onWrong }: Props) {
  /** Accumulated rotation in degrees. Increasing is clockwise. */
  const [angle, setAngle] = useState(0)
  const [picked, setPicked] = useState<number[]>([])
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState('')
  const [unconfigured, setUnconfigured] = useState(false)
  /** Set the moment the door opens, so the shackle can spring before it goes. */
  const [sprung, setSprung] = useState(false)

  const dialRef = useRef<HTMLDivElement>(null)
  /**
   * The live angle.
   *
   * Mirrored in a ref because `turn` needs to read the current angle AND write
   * the next one in the same call, and reading it from state would read the
   * value from the render that installed the handler — which during a drag is
   * always at least one move behind.
   */
  const angleRef = useRef(0)
  /** Signed travel since the last commit, in the direction this stage wants. */
  const travel = useRef(0)
  /** Where the pointer last was, in dial-space degrees, mid-drag. */
  const lastPointer = useRef<number | null>(null)

  const stage = picked.length
  const want = DIRECTIONS[Math.min(stage, DIRECTIONS.length - 1)]
  const done = stage >= NUMBERS
  const at = positionAt(angle)

  useEffect(() => {
    loadChallenge().then((blob) => setUnconfigured(blob === null))
  }, [])

  /**
   * Rotate by `delta` degrees and commit a number if that was a reversal.
   *
   * One function for pointer and keyboard both, so the two cannot drift into
   * behaving differently — which on a lock would mean the keyboard opening
   * doors the mouse could not.
   */
  const turn = useCallback(
    (delta: number) => {
      if (busy || sprung) return

      const before = angleRef.current
      angleRef.current = before + delta
      setAngle(angleRef.current)

      if (done) return

      const forward = Math.sign(delta) === want
      if (forward) {
        travel.current += Math.abs(delta)
        return
      }

      // Turning against the stage. That is the reversal — but only once the
      // dial has actually gone somewhere the right way first.
      if (travel.current < MIN_TRAVEL) return

      // The number committed is the one the dial was sitting on BEFORE this
      // reversing movement, which is the number under your thumb at the moment
      // you decided to turn back. Committing the post-move position would
      // quietly shift every entry by however far the reversal happened to
      // travel in its first frame.
      setPicked((current) => (current.length >= NUMBERS ? current : [...current, positionAt(before)]))
      travel.current = 0
    },
    [busy, done, sprung, want],
  )

  // ---- pointer ----------------------------------------------------------

  /** Pointer position as an angle about the dial's centre, in degrees. */
  const angleOf = (clientX: number, clientY: number) => {
    const box = dialRef.current?.getBoundingClientRect()
    if (!box) return null
    const dx = clientX - (box.left + box.width / 2)
    const dy = clientY - (box.top + box.height / 2)
    return (Math.atan2(dy, dx) * 180) / Math.PI
  }

  const onPointerDown = (e: React.PointerEvent) => {
    ;(e.currentTarget as Element).setPointerCapture?.(e.pointerId)
    lastPointer.current = angleOf(e.clientX, e.clientY)
  }

  const onPointerMove = (e: React.PointerEvent) => {
    if (lastPointer.current === null) return
    const now = angleOf(e.clientX, e.clientY)
    if (now === null) return
    // Shortest way round, so dragging across the ±180° seam does not read as
    // a 359° spin in the wrong direction — which would commit a number.
    let delta = now - lastPointer.current
    if (delta > 180) delta -= 360
    if (delta < -180) delta += 360
    lastPointer.current = now
    if (delta !== 0) turn(delta)
  }

  const endDrag = () => {
    lastPointer.current = null
  }

  // ---- keyboard ---------------------------------------------------------

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
      e.preventDefault()
      turn(STEP)
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
      e.preventDefault()
      turn(-STEP)
    } else if (e.key === 'Enter' && done) {
      e.preventDefault()
      void pull()
    }
  }

  // ---- the pull ---------------------------------------------------------

  const pull = async () => {
    if (busy || sprung) return
    // The third number has no reversal after it, so the pull is its commit.
    const numbers = picked.length >= NUMBERS ? picked : [...picked, at]
    if (numbers.length < NUMBERS) return

    setBusy(true)
    setNote('TESTING THE SHACKLE…')
    const verdict = await tryPassphrase(formatCombination(numbers))
    setBusy(false)

    if (verdict === 'open') {
      setNote('')
      setSprung(true)
      // Long enough to see the shackle go. The door is already decided.
      window.setTimeout(() => onOpen(formatCombination(numbers)), 620)
    } else if (verdict === 'unconfigured') {
      setNote('')
      setUnconfigured(true)
    } else {
      onWrong()
    }
  }

  const reset = () => {
    setPicked([])
    travel.current = 0
    setNote('')
  }

  // Keep the ref honest if anything ever sets `angle` outside `turn`.
  useEffect(() => {
    angleRef.current = angle
  }, [angle])

  if (unconfigured) {
    return (
      <div className="gate__box">
        <p className="gate__tag">THE DOOR</p>
        <p className="gate__note">
          No verifier has been built for this deployment, so there is nothing here to check a
          combination against. Run <code>HOME_COMBINATION='7-31-22' npm run gate:verify</code> and
          commit <code>public/gate/verify.enc</code>.
        </p>
        <button type="button" className="gate__go" onClick={() => onOpen('')}>
          ENTER ANYWAY
        </button>
      </div>
    )
  }

  return (
    <div className="gate__box lock">
      <p className="gate__tag">THE DOOR</p>
      <p className="gate__say">{GREETING}</p>

      <div className={`lock__body${sprung ? ' lock__body--open' : ''}`}>
        {/* ---- the shackle ------------------------------------------- */}
        <svg className="lock__shackle" viewBox="0 0 120 90" aria-hidden="true">
          <path
            d="M28 88 L28 40 C28 22 42 10 60 10 C78 10 92 22 92 40 L92 88"
            fill="none"
            stroke="currentColor"
            strokeWidth="15"
            strokeLinecap="round"
          />
        </svg>

        {/* ---- the dial ---------------------------------------------- */}
        <div className="lock__case">
          <span className="lock__index" aria-hidden="true" />
          <div
            ref={dialRef}
            className="lock__dial"
            style={{ ['--turn' as string]: `${-angle}deg` }}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
            onKeyDown={onKeyDown}
            role="slider"
            tabIndex={0}
            aria-label={`Combination dial. Currently on ${at}. Spin ${directionWord(want)} for number ${Math.min(stage + 1, NUMBERS)} of ${NUMBERS}. Arrow keys turn it; press the opposite arrow to set a number; Enter pulls the shackle.`}
            aria-valuenow={at}
            aria-valuemin={0}
            aria-valuemax={POSITIONS - 1}
            aria-valuetext={`${at}`}
          >
            <svg viewBox="-100 -100 200 200" aria-hidden="true">
              {Array.from({ length: POSITIONS }, (_, i) => {
                const major = i % 5 === 0
                return (
                  <g key={i} transform={`rotate(${i * STEP})`}>
                    <line
                      className={major ? 'lock__tick lock__tick--major' : 'lock__tick'}
                      x1="0"
                      y1="-92"
                      x2="0"
                      y2={major ? -78 : -85}
                    />
                    {major && (
                      <text className="lock__num" x="0" y="-62" textAnchor="middle">
                        {i}
                      </text>
                    )}
                  </g>
                )
              })}
            </svg>
          </div>

          {/* The reading, held still in the middle while the face turns. */}
          <span className="lock__read" aria-hidden="true">
            {String(at).padStart(2, '0')}
          </span>
        </div>
      </div>

      {/* ---- what it wants next -------------------------------------- */}
      <div className="lock__steps">
        {DIRECTIONS.slice(0, NUMBERS).map((d, i) => (
          <span
            key={i}
            className={`lock__step${i < stage ? ' lock__step--set' : ''}${i === stage && !done ? ' lock__step--now' : ''}`}
          >
            <b>{i < stage ? String(picked[i]).padStart(2, '0') : '––'}</b>
            {directionWord(d)}
          </span>
        ))}
      </div>

      <p className="lock__hint" aria-live="polite">
        {note ||
          (sprung
            ? 'OPEN.'
            : done || stage === NUMBERS - 1
              ? // The last number has no reversal after it — the pull is its
                // commit — so telling you to "reverse to set" here is telling
                // you to do something that does not work.
                `SPIN ${directionWord(want)} · THEN PULL`
              : `SPIN ${directionWord(want)} · REVERSE TO SET`)}
      </p>

      <div className="lock__acts">
        <button
          type="button"
          className="gate__go"
          onClick={pull}
          disabled={busy || sprung || stage < NUMBERS - 1}
        >
          {busy ? 'TESTING…' : 'PULL'}
        </button>
        <button
          type="button"
          className="lock__clear"
          onClick={reset}
          disabled={busy || sprung || stage === 0}
        >
          CLEAR
        </button>
      </div>
    </div>
  )
}
