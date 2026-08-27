import { useCallback, useEffect, useRef, useState } from 'react'
import {
  DIRECTIONS,
  HIGH,
  MIN_TRAVEL,
  NUMBERS,
  POSITIONS,
  STEP,
  WIDTH,
  directionWord,
  formatCombination,
  inRange,
  isFull,
  parseTyped,
  positionAt,
} from './combination'
import { loadChallenge, tryPassphrase } from './protocol'
import { GREETING } from './config'

/* ==========================================================================
   THE PADLOCK

   Three ways through one door, and they all hand the same string to the same
   decryption. Nothing below knows or cares which one you used.

     KEYPAD   type the three numbers. The default, because this is a door
              somebody has to get through several times a day and spinning a
              dial to do it is a joke that stops being funny on the second use.
     DIAL     the object. Right, left, right, pull. Still here, still the
              nicer thing to look at, now opt-in rather than compulsory.
     PHRASE   a free-text key. This is the escape hatch, and it is load-bearing
              — see below.

   ---- why PHRASE exists --------------------------------------------------

   It began as an escape hatch. `verify.enc` used to hold exactly one blob
   against one secret, so a deployment whose blob predated the dial was keyed to
   a *sentence* and no combination on earth opened it — every one of the 64,000
   comes back from GCM as an authentication failure, which is the same answer a
   wrong combination gives. Unopenable and wrong-key are cryptographically
   indistinguishable from in here, so the door could not detect the situation
   and apologise for it. PHRASE passed whatever you typed straight to
   `tryPassphrase`, so the old key still turned.

   **Since 2026-08-27 it is a way in rather than a fallback.** `verify.enc` is
   now a `Vault` (`./protocol`) that can hold one blob per accepted phrase, and
   `scripts/make-verify.mjs` builds one for a combination and one for a typed
   passphrase when given both. So PHRASE opens for a genuinely different string
   than the numbers do, rather than only for whichever single secret the file
   happened to be built against.

   That is a real trade and it is stated where it is decided
   (`scripts/phrases.mjs`): a door that accepts two phrases is only as strong as
   the *weaker* of them, which with a 3-number dial in the set is the 64,000
   keyspace above, however long the sentence is. The mitigation is that a wrong
   entry in any mode costs the same 30-second lockout, so this is an alternative
   to the dial rather than a rate-limit bypass around it.

   `keyring.enc` is the same shape for the same reason, and it must be rebuilt
   with the same inputs — the gate stores whichever phrase opened it and the
   credential is opened with that phrase. When the two drifted apart, the door
   opened and every SAVE silently stopped committing.

   ---- the dial's one real idea ------------------------------------------

   A number is committed by REVERSING, not by clicking. On a physical padlock
   the direction change IS the commit, and everything about the feel of the
   object comes from that fact. Turn right; the moment you turn back the other
   way, the number you were sitting on is your first. The third has no reversal
   after it, so PULL commits it — which is also what a hand does.

   The same rule serves the keyboard for free: arrows rotate, and the opposite
   arrow IS the reversal. `MIN_TRAVEL` stops the jitter at the start of a drag
   from committing whatever number you were parked on before you had moved.
   ========================================================================== */

type Props = {
  onOpen: (phrase: string) => void
  onWrong: () => void
}

type Mode = 'keys' | 'dial' | 'phrase'

const MODES: { id: Mode; label: string }[] = [
  { id: 'keys', label: 'KEYPAD' },
  { id: 'dial', label: 'DIAL' },
  { id: 'phrase', label: 'PHRASE' },
]

const blank = () => Array.from({ length: NUMBERS }, () => '')

export function Padlock({ onOpen, onWrong }: Props) {
  const [mode, setMode] = useState<Mode>('keys')
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState('')
  const [unconfigured, setUnconfigured] = useState(false)
  /** Set the moment the door opens, so the shackle can spring before it goes. */
  const [sprung, setSprung] = useState(false)

  useEffect(() => {
    loadChallenge().then((blob) => setUnconfigured(blob === null))
  }, [])

  /**
   * One attempt, whichever way the string was produced.
   *
   * Every path funnels through here so the three modes cannot drift into
   * treating a wrong key differently — which on a door would mean one of them
   * quietly skipping the lockout.
   */
  const attempt = useCallback(
    async (phrase: string) => {
      if (busy || sprung || phrase === '') return
      setBusy(true)
      setNote('TESTING THE SHACKLE…')
      const verdict = await tryPassphrase(phrase)
      setBusy(false)

      if (verdict === 'open') {
        setNote('')
        setSprung(true)
        // Long enough to see the shackle go. The door is already decided.
        window.setTimeout(() => onOpen(phrase), 620)
      } else if (verdict === 'unconfigured') {
        setNote('')
        setUnconfigured(true)
      } else {
        onWrong()
      }
    },
    [busy, sprung, onOpen, onWrong],
  )

  if (unconfigured) {
    return (
      <div className="gate__box">
        <p className="gate__tag">THE DOOR</p>
        <p className="gate__note">
          No verifier has been built for this deployment, so there is nothing here to check a
          combination against. Run <code>HOME_COMBINATION='NN-NN-NN' npm run gate:verify</code> and
          commit <code>public/gate/verify.enc</code>.
        </p>
        <button type="button" className="gate__go" onClick={() => onOpen('')}>
          ENTER ANYWAY
        </button>
      </div>
    )
  }

  const locked = busy || sprung

  return (
    <div className="gate__box lock">
      <p className="gate__tag">THE DOOR</p>
      <p className="gate__say">{GREETING}</p>

      <div className={`lock__body${sprung ? ' lock__body--open' : ''}`}>
        <svg className="lock__shackle" viewBox="0 0 120 90" aria-hidden="true">
          <path
            d="M28 88 L28 40 C28 22 42 10 60 10 C78 10 92 22 92 40 L92 88"
            fill="none"
            stroke="currentColor"
            strokeWidth="15"
            strokeLinecap="round"
          />
        </svg>

        {mode === 'keys' && <Keypad locked={locked} sprung={sprung} note={note} onSubmit={attempt} />}
        {mode === 'dial' && <Dial locked={locked} sprung={sprung} note={note} onSubmit={attempt} />}
        {mode === 'phrase' && <Phrase locked={locked} sprung={sprung} note={note} onSubmit={attempt} />}
      </div>

      <div className="lock__modes" role="group" aria-label="How to open the lock">
        {MODES.map((m) => (
          <button
            key={m.id}
            type="button"
            className={`lock__mode${mode === m.id ? ' lock__mode--on' : ''}`}
            onClick={() => {
              setMode(m.id)
              setNote('')
            }}
            disabled={locked}
            aria-pressed={mode === m.id}
          >
            {m.label}
          </button>
        ))}
      </div>
    </div>
  )
}

type PartProps = {
  locked: boolean
  sprung: boolean
  note: string
  onSubmit: (phrase: string) => void
}

// ---------------------------------------------------------------------------
// KEYPAD

/**
 * Three fields, one number each.
 *
 * The whole difficulty here is that a field showing a zero-padded value is a
 * field you cannot finish typing into: pad `3` to `03` the instant it is typed
 * and the box is now two characters wide and full, so the `1` of `31` has
 * nowhere to go. So the padding happens on BLUR and never while the caret is
 * in the box — what you see while typing is exactly what you typed.
 */
function Keypad({ locked, sprung, note, onSubmit }: PartProps) {
  const [keys, setKeys] = useState<string[]>(blank)
  const [live, setLive] = useState<number | null>(null)
  const fields = useRef<(HTMLInputElement | null)[]>([])

  useEffect(() => {
    fields.current[0]?.focus()
  }, [])

  const focusAt = (i: number) => {
    const field = fields.current[i]
    field?.focus()
    field?.select()
  }

  const put = (i: number, raw: string) => {
    const digits = raw.replace(/\D/g, '').slice(0, WIDTH)
    // Reject rather than clamp: silently turning a typed 47 into 39 enters a
    // number nobody chose, and the lockout makes that expensive to discover.
    if (digits !== '' && Number(digits) > HIGH) return

    setKeys((current) => current.map((k, at) => (at === i ? digits : k)))
    if (digits !== '' && isFull(digits) && i < NUMBERS - 1) focusAt(i + 1)
  }

  const ready = keys.every(inRange)
  const submit = () => {
    if (ready) onSubmit(formatCombination(keys.map(Number)))
  }

  const onKeyDown = (i: number) => (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      submit()
    } else if (e.key === 'Backspace' && keys[i] === '' && i > 0) {
      // Backspacing out of an empty box should delete backwards, the way one
      // long field would, rather than stalling against the edge of this one.
      e.preventDefault()
      setKeys((current) => current.map((k, at) => (at === i - 1 ? '' : k)))
      focusAt(i - 1)
    } else if (e.key === 'ArrowLeft' && i > 0 && e.currentTarget.selectionStart === 0) {
      e.preventDefault()
      focusAt(i - 1)
    } else if (e.key === 'ArrowRight' && i < NUMBERS - 1 && e.currentTarget.selectionEnd === keys[i].length) {
      e.preventDefault()
      focusAt(i + 1)
    }
  }

  /** Pasting the whole combination fills every box, from any box. */
  const onPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const parsed = parseTyped(e.clipboardData.getData('text'))
    if (parsed.length === 0) return
    e.preventDefault()
    setKeys(blank().map((_, at) => parsed[at] ?? ''))
    focusAt(Math.min(parsed.length, NUMBERS) - 1)
  }

  return (
    <div className="lock__numeric">
      <div className="lock__inputs">
        {keys.map((value, i) => (
          <input
            key={i}
            ref={(el) => {
              fields.current[i] = el
            }}
            className="lock__input"
            type="text"
            inputMode="numeric"
            autoComplete="off"
            spellCheck={false}
            maxLength={WIDTH}
            placeholder="––"
            value={live === i || value === '' ? value : value.padStart(WIDTH, '0')}
            onChange={(e) => put(i, e.target.value)}
            onKeyDown={onKeyDown(i)}
            onPaste={onPaste}
            onFocus={() => {
              setLive(i)
              fields.current[i]?.select()
            }}
            onBlur={() => setLive((at) => (at === i ? null : at))}
            disabled={locked}
            aria-label={`Number ${i + 1} of ${NUMBERS}, 0 to ${HIGH}`}
          />
        ))}
      </div>

      <p className="lock__hint" aria-live="polite">
        {note || (sprung ? 'OPEN.' : `THREE NUMBERS · 0–${HIGH} · ENTER TO PULL`)}
      </p>

      <div className="lock__acts">
        <button type="button" className="gate__go" onClick={submit} disabled={locked || !ready}>
          {locked && !sprung ? 'TESTING…' : 'PULL'}
        </button>
        <button
          type="button"
          className="lock__clear"
          onClick={() => {
            setKeys(blank())
            focusAt(0)
          }}
          disabled={locked || keys.every((k) => k === '')}
        >
          CLEAR
        </button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// PHRASE

function Phrase({ locked, sprung, note, onSubmit }: PartProps) {
  const [text, setText] = useState('')
  const field = useRef<HTMLInputElement>(null)

  useEffect(() => field.current?.focus(), [])

  return (
    <form
      className="lock__numeric"
      onSubmit={(e) => {
        e.preventDefault()
        onSubmit(text)
      }}
    >
      <input
        ref={field}
        className="gate__field"
        type="password"
        value={text}
        onChange={(e) => setText(e.target.value)}
        autoComplete="current-password"
        spellCheck={false}
        disabled={locked}
        aria-label="Key phrase"
      />

      <p className="lock__hint" aria-live="polite">
        {note || (sprung ? 'OPEN.' : 'THE OLD KEY STILL TURNS')}
      </p>

      <div className="lock__acts">
        <button type="submit" className="gate__go" disabled={locked || text === ''}>
          {locked && !sprung ? 'TESTING…' : 'PULL'}
        </button>
      </div>
    </form>
  )
}

// ---------------------------------------------------------------------------
// DIAL

function Dial({ locked, sprung, note, onSubmit }: PartProps) {
  /** Accumulated rotation in degrees. Increasing is clockwise. */
  const [angle, setAngle] = useState(0)
  const [picked, setPicked] = useState<number[]>([])

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

  const turn = useCallback(
    (delta: number) => {
      if (locked) return

      const before = angleRef.current
      angleRef.current = before + delta
      setAngle(angleRef.current)

      if (done) return

      if (Math.sign(delta) === want) {
        travel.current += Math.abs(delta)
        return
      }

      // Turning against the stage. That is the reversal — but only once the
      // dial has actually gone somewhere the right way first.
      if (travel.current < MIN_TRAVEL) return

      // The number committed is the one the dial was sitting on BEFORE this
      // reversing movement: the number under your thumb at the moment you
      // decided to turn back. Committing the post-move position would quietly
      // shift every entry by however far the reversal travelled in its first
      // frame.
      setPicked((current) => (current.length >= NUMBERS ? current : [...current, positionAt(before)]))
      travel.current = 0
    },
    [locked, done, want],
  )

  /** Pointer position as an angle about the dial's centre, in degrees. */
  const angleOf = (clientX: number, clientY: number) => {
    const box = dialRef.current?.getBoundingClientRect()
    if (!box) return null
    const dx = clientX - (box.left + box.width / 2)
    const dy = clientY - (box.top + box.height / 2)
    return (Math.atan2(dy, dx) * 180) / Math.PI
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

  // The third number has no reversal after it, so the pull is its commit.
  const pull = () => {
    const numbers = picked.length >= NUMBERS ? picked : [...picked, at]
    if (numbers.length >= NUMBERS) onSubmit(formatCombination(numbers))
  }

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
      e.preventDefault()
      turn(STEP)
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
      e.preventDefault()
      turn(-STEP)
    } else if (e.key === 'Enter' && stage >= NUMBERS - 1) {
      e.preventDefault()
      pull()
    }
  }

  return (
    <>
      <div className="lock__case">
        <span className="lock__index" aria-hidden="true" />
        <div
          ref={dialRef}
          className="lock__dial"
          style={{ ['--turn' as string]: `${-angle}deg` }}
          onPointerDown={(e) => {
            ;(e.currentTarget as Element).setPointerCapture?.(e.pointerId)
            lastPointer.current = angleOf(e.clientX, e.clientY)
          }}
          onPointerMove={onPointerMove}
          onPointerUp={() => (lastPointer.current = null)}
          onPointerCancel={() => (lastPointer.current = null)}
          onKeyDown={onKeyDown}
          role="slider"
          tabIndex={0}
          aria-label={`Combination dial. Currently on ${at}. Spin ${directionWord(want)} for number ${Math.min(stage + 1, NUMBERS)} of ${NUMBERS}. Arrow keys turn it; press the opposite arrow to commit.`}
          aria-valuenow={at}
          aria-valuemin={0}
          aria-valuemax={HIGH}
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
          {String(at).padStart(WIDTH, '0')}
        </span>
      </div>

      <div className="lock__steps">
        {DIRECTIONS.slice(0, NUMBERS).map((d, i) => (
          <span
            key={i}
            className={`lock__step${i < stage ? ' lock__step--set' : ''}${i === stage && !done ? ' lock__step--now' : ''}`}
          >
            <b>{i < stage ? String(picked[i]).padStart(WIDTH, '0') : '––'}</b>
            {directionWord(d)}
          </span>
        ))}
      </div>

      <p className="lock__hint" aria-live="polite">
        {note ||
          (sprung
            ? 'OPEN.'
            : stage >= NUMBERS - 1
              ? `SPIN ${directionWord(want)} · THEN PULL`
              : `SPIN ${directionWord(want)} · REVERSE TO SET`)}
      </p>

      <div className="lock__acts">
        <button
          type="button"
          className="gate__go"
          onClick={pull}
          disabled={locked || stage < NUMBERS - 1}
        >
          {locked && !sprung ? 'TESTING…' : 'PULL'}
        </button>
        <button
          type="button"
          className="lock__clear"
          onClick={() => {
            setPicked([])
            travel.current = 0
          }}
          disabled={locked || stage === 0}
        >
          CLEAR
        </button>
      </div>
    </>
  )
}
