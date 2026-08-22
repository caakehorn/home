import { useCallback, useEffect, useRef, useState } from 'react'
import {
  GATE_ENABLED,
  KEYS,
  LOCKOUT_MS,
  MSG_MS,
  QUIZ_PROMPT,
  TAUNTS,
  TRAP_HEAD,
  TRAP_ROWS,
  TRAP_ROW_MS,
} from './config'
import { Padlock } from './Padlock'
import { TERMS_EFFECTIVE, TERMS_SECTIONS, TERMS_TITLE, TERMS_VERSION } from './terms'
import './gate.css'

/**
 * THE GATE — four steps in front of the whole site.
 *
 * Nothing behind it mounts: the router is not rendered until this resolves, so
 * there is no frame in which the site exists on screen unlocked. One unlock
 * covers the tab, and skips the quiz for the rest of it.
 *
 * `#lock` on any URL throws the bolt again — an unlock lasts as long as the
 * tab, which otherwise means the owner cannot see their own front door without
 * opening a new one.
 *
 * The last step is a combination padlock (`./Padlock`) rather than a typed
 * passphrase. The crypto is unchanged — the dialled combination IS the
 * passphrase, checked by the same decryption — but the keyspace is a dial's
 * rather than a sentence's, and `./combination` states what that costs
 * instead of glossing it.
 *
 * `GATE_ENABLED` in `./config` turns the whole thing off in one word. The flag
 * is read in the wrapper rather than inside the flow so that "off" means the
 * state machine never mounts — hooks and all — instead of mounting and then
 * being told to stand down.
 */

type Step = 'boot' | 'terms' | 'declined' | 'quiz' | 'trap' | 'pass' | 'punish' | 'open'

const read = (store: Storage | undefined, key: string) => {
  try {
    return store?.getItem(key) ?? null
  } catch {
    return null // private mode
  }
}

const write = (store: Storage | undefined, key: string, value: string) => {
  try {
    store?.setItem(key, value)
  } catch {
    /* private mode: the door still works, it just forgets */
  }
}

const drop = (store: Storage | undefined, key: string) => {
  try {
    store?.removeItem(key)
  } catch {
    /* ditto */
  }
}

const wantsLock = () => /(^|[?&#])lock\b/.test(location.search + location.hash)

export function Gate({ children }: { children: React.ReactNode }) {
  if (!GATE_ENABLED) return <>{children}</>
  return <GateFlow>{children}</GateFlow>
}

function GateFlow({ children }: { children: React.ReactNode }) {
  // Compute initial UI state synchronously so the gate renders the correct
  // step on first paint instead of showing the empty "boot" placeholder.
  const computeInitial = (): { step: Step; until: number } => {
    try {
      if (wantsLock()) {
        // Clear stored unlocks and deadlines immediately so the computed
        // initial state reflects the intent of the fragment.
        drop(sessionStorage, KEYS.pass)
        drop(sessionStorage, KEYS.until)
      }
    } catch {
      /* ignore storage errors */
    }

    const agreed = read(localStorage, KEYS.terms) === TERMS_VERSION
    const unlocked = read(sessionStorage, KEYS.pass) !== null
    const deadline = Number(read(sessionStorage, KEYS.until) ?? 0)

    if (!agreed) return { step: 'terms', until: 0 }
    if (unlocked) return { step: 'open', until: 0 }
    if (deadline > Date.now()) return { step: 'punish', until: deadline }
    return { step: 'pass', until: 0 }
  }

  const initial = computeInitial()
  const [step, setStep] = useState<Step>(initial.step)
  const [until, setUntil] = useState<number>(initial.until)

  // Handle URL fragment cleanup and hash navigation side-effects. The heavy
  // synchronous decision above already dealt with storage so this effect only
  // needs to manipulate the URL and listen for hash changes.
  useEffect(() => {
    if (wantsLock()) {
      try {
        const q = location.search.replace(/([?&])lock\b&?/, '$1').replace(/[?&]$/, '')
        const h = location.hash.replace(/([#&])lock\b&?/, '$1').replace(/[#&]$/, '')
        history.replaceState(null, '', location.pathname + q + h)
      } catch {
        /* file:// and the like */
      }
    }
  }, [])

  // Typing #lock into the bar of an open page is a fragment navigation: the
  // document never reloads, so catch it and reload by hand.
  useEffect(() => {
    const onHash = () => {
      if (wantsLock()) location.reload()
    }
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  const open = useCallback((phrase: string) => {
    write(sessionStorage, KEYS.pass, phrase)
    setStep('open')
  }, [])

  const punish = useCallback(() => {
    const deadline = Date.now() + LOCKOUT_MS
    write(sessionStorage, KEYS.until, String(deadline))
    setUntil(deadline)
    setStep('punish')
  }, [])

  if (step === 'open') return <>{children}</>
  if (step === 'boot') return <div className="gate gate--boot" />

  return (
    <div className="gate" role="dialog" aria-modal="true" aria-label="Entry">
      {step === 'terms' && (
        <TermsStep
          onAgree={() => {
            // Per device, against the version: bump TERMS_VERSION and every
            // device is asked again, which is the only way a change to the
            // document means anything.
            write(localStorage, KEYS.terms, TERMS_VERSION)
            setStep('pass')
          }}
          onDecline={() => setStep('declined')}
        />
      )}
      {step === 'declined' && <Declined />}
      {step === 'quiz' && <QuizStep onPass={() => setStep('pass')} onFail={() => setStep('trap')} />}
      {step === 'trap' && <Trap />}
      {step === 'pass' && <Padlock onOpen={open} onWrong={punish} />}
      {step === 'punish' && (
        <Punish
          until={until}
          onServed={() => {
            drop(sessionStorage, KEYS.until)
            setStep('pass')
          }}
        />
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// 0 · THE TERMS

function TermsStep({ onAgree, onDecline }: { onAgree: () => void; onDecline: () => void }) {
  const [ticked, setTicked] = useState(false)

  return (
    <div className="gate__box gate__box--wide">
      <p className="gate__tag">STEP ZERO</p>
      <h1 className="gate__head">{TERMS_TITLE}</h1>
      <p className="gate__meta">
        Version {TERMS_VERSION} · Effective {TERMS_EFFECTIVE} · Acceptance is recorded on this device.
      </p>

      <div className="gate__scroll" tabIndex={0} aria-label="Terms of Service">
        {TERMS_SECTIONS.map(([heading, ...paragraphs]) => (
          <section key={heading}>
            <h2>{heading}</h2>
            {paragraphs.map((text, i) => (
              <p key={i}>{text}</p>
            ))}
          </section>
        ))}
      </div>

      <label className="gate__check">
        <input type="checkbox" checked={ticked} onChange={(e) => setTicked(e.target.checked)} />
        <span>I have read these Terms in full and I agree to be bound by every provision of them.</span>
      </label>

      <div className="gate__row">
        <button type="button" className="gate__go" disabled={!ticked} onClick={onAgree}>
          I AGREE — ENTER
        </button>
        <button type="button" className="gate__no" onClick={onDecline}>
          DECLINE
        </button>
      </div>
    </div>
  )
}

function Declined() {
  return (
    <div className="gate__box">
      <p className="gate__tag">DECLINED</p>
      <p className="gate__say">
        You are not licensed to access this Site. Close the tab.
      </p>
    </div>
  )
}

// ---------------------------------------------------------------------------
// 1 · THE QUIZ — an empty submit passes

function QuizStep({ onPass, onFail }: { onPass: () => void; onFail: () => void }) {
  const [answer, setAnswer] = useState('')
  const field = useRef<HTMLInputElement>(null)

  useEffect(() => field.current?.focus(), [])

  return (
    <form
      className="gate__box"
      onSubmit={(e) => {
        e.preventDefault()
        if (answer.trim() === '') onPass()
        else onFail()
      }}
    >
      <p className="gate__tag">ONE QUESTION</p>
      <p className="gate__say">{QUIZ_PROMPT}</p>
      <input
        ref={field}
        className="gate__field"
        value={answer}
        onChange={(e) => setAnswer(e.target.value)}
        aria-label={QUIZ_PROMPT}
        autoComplete="off"
        spellCheck={false}
      />
      <button type="submit" className="gate__go">
        SUBMIT
      </button>
    </form>
  )
}

/** The decoy. It is always about to arrive. It never arrives. */
function Trap() {
  const [rows, setRows] = useState<string[]>([])

  useEffect(() => {
    let at = 0
    const id = setInterval(() => {
      setRows((prior) => [...prior, TRAP_ROWS[at % TRAP_ROWS.length]])
      at++
    }, TRAP_ROW_MS)
    setRows([TRAP_ROWS[0]])
    return () => clearInterval(id)
  }, [])

  return (
    <div className="gate__box gate__box--wide">
      <p className="gate__tag">{TRAP_HEAD}</p>
      <div className="gate__track" aria-hidden="true">
        <span className="gate__fill" style={{ width: `${Math.min(96, rows.length * 7)}%` }} />
      </div>
      <ol className="gate__rows">
        {rows.map((row, i) => (
          <li key={i}>{row}</li>
        ))}
      </ol>
    </div>
  )
}

/**
 * Getting it wrong costs the same screen for LOCKOUT_MS, with a countdown and
 * no way through. It flashes at 0.34s per on-off cycle — about 2.9 flashes a
 * second, just under the 3 Hz general-flash threshold in WCAG 2.3.1 — and
 * under reduced motion it stops strobing but still takes the whole page for
 * the whole time.
 */
function Punish({ until, onServed }: { until: number; onServed: () => void }) {
  const [now, setNow] = useState(() => Date.now())
  const [line, setLine] = useState(0)

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 250)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    if (TAUNTS.length < 2) return
    const id = setInterval(() => setLine((n) => (n + 1) % TAUNTS.length), MSG_MS)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    if (now >= until) onServed()
  }, [now, until, onServed])

  return (
    <div className="gate__flash gate__flash--punish">
      <div className="gate__box">
        <p className="gate__tag">NO</p>
        <p className="gate__say gate__say--big">{TAUNTS[line]}</p>
        <p className="gate__count" aria-live="polite">
          {Math.max(0, Math.ceil((until - now) / 1000))}
        </p>
      </div>
    </div>
  )
}
