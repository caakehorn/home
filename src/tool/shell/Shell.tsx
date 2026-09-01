import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Answers, Step, Tool, ToolModule } from '../core'
import { ShellContext } from './context'
import { parseRange, describeRange, encodeRange } from './dates'
import type { Line, LineKind, ShellApi } from './types'
import './shell.css'

/**
 * The terminal every tool in this room is asked through.
 *
 * ---- what it is, and what it is not ----------------------------------------
 *
 * It is not an emulator and does not pretend to be: there is no PTY, no shell,
 * no filesystem, and nothing typed here executes anywhere. It is a conversation
 * with a fixed script — the tool's `steps`, in order — wearing a terminal's
 * clothes, because a command line is the honest shape for a thing whose output
 * is a command line. Anything else would be a form pretending to be dangerous.
 *
 * What it does have, because a terminal that lacks them is a text box with a
 * green font: command history on the arrow keys, Tab completion over whatever
 * the current question will accept, a scrollback that is a real log element for
 * a screen reader, and verbs (`back`, `restart`, `answers`) that work at every
 * step rather than only at the end.
 *
 * ---- the step machine ------------------------------------------------------
 *
 * The shell owns the conversation and the tool owns the answers. A step is
 * asked, an input is validated, and on acceptance the pointer moves; `back`
 * moves it the other way and drops the answer it passes, so a reader who
 * mistyped step two does not restart at step one. When the pointer runs off the
 * end the shell calls the tool's `compose` — once — and prints what comes back.
 *
 * `compose` is pure and total: it is handed a plain object of strings and
 * returns a script, some notes and some warnings. It cannot print, cannot ask
 * anything further, and cannot see the DOM. That is what makes the deliverable
 * reproducible in `scripts/check-tool.mjs` with no browser in the loop, and it
 * is the constraint the whole room is built around.
 *
 * ---- warnings are not decoration -------------------------------------------
 *
 * A tool's `warnings` are printed last, in their own colour, immediately above
 * the command. They say what the command cannot do or does only approximately.
 * They are never collapsed, never behind a disclosure, and never dropped to
 * make the output look finished — a reader about to paste a command against
 * their own machine is owed the caveats at the moment of pasting, not in a
 * footnote they scrolled past four questions ago.
 */

const META = ['help', 'back', 'restart', 'answers', 'clear'] as const

/**
 * Whether a step applies, given what has been answered.
 *
 * A step with no `when` always applies. This is the whole of the branching in
 * the room: rather than a graph of next-step pointers, the tool lists every
 * question it might ask and says which ones apply, and the shell walks past the
 * ones that do not. It reads in one glance, and there is no unreachable state
 * to get wrong.
 */
const applies = (step: Step, answers: Answers) => step.when?.(answers) ?? true

/** The next applicable step at or after `from`, or `steps.length` when none. */
function seekForward(steps: Step[], from: number, answers: Answers) {
  let i = from
  while (i < steps.length && !applies(steps[i], answers)) i += 1
  return i
}

/** The previous applicable step strictly before `from`, or -1 when none. */
function seekBack(steps: Step[], from: number, answers: Answers) {
  let i = from - 1
  while (i >= 0 && !applies(steps[i], answers)) i -= 1
  return i
}

export function Shell({ tool, module }: { tool: Tool; module: ToolModule }) {
  const banner = useMemo<Line[]>(
    () => [
      { kind: 'art', text: `${tool.title} — ${tool.kana}` },
      { kind: 'out', text: tool.blurb },
      { kind: 'art', text: '─'.repeat(64) },
      {
        kind: 'out',
        text:
          'Answer the questions. At the end you get one block of shell — copy it, paste it ' +
          'into Terminal.app, and it finishes on its own.',
      },
      { kind: 'out', text: '`help` for the verbs · `back` to change an answer · `restart` to begin again' },
      { kind: 'art', text: '' },
    ],
    [tool],
  )

  const [lines, setLines] = useState<Line[]>(banner)
  const [answers, setAnswers] = useState<Answers>({})
  const [at, setAt] = useState(() => seekForward(module.steps, 0, {}))
  const [value, setValue] = useState('')
  const [history, setHistory] = useState<string[]>([])
  const [cursor, setCursor] = useState(-1)
  const [copied, setCopied] = useState(false)

  const scroller = useRef<HTMLDivElement>(null)
  const input = useRef<HTMLInputElement>(null)
  /** Which step the question has already been printed for, so it prints once. */
  const asked = useRef(-1)
  /** Set once `compose` has run, so it runs once rather than on every render. */
  const composed = useRef(false)

  const steps = module.steps
  const step: Step | null = at < steps.length ? steps[at] : null
  const done = at >= steps.length

  // Counted over the questions that actually apply, so a reader who chose
  // "everybody" is not told they are on 3 of 6 and then handed the command
  // after question four.
  const askable = steps.filter((s) => applies(s, answers)).length
  const asking = steps.slice(0, at).filter((s) => applies(s, answers)).length + 1

  const print = useCallback((...next: Line[]) => setLines((cur) => [...cur, ...next]), [])
  const say = useCallback((kind: LineKind, text: string) => print({ kind, text }), [print])

  useEffect(() => {
    const el = scroller.current
    if (el) el.scrollTop = el.scrollHeight
  }, [lines])

  /* ---- asking ------------------------------------------------------------ */

  const askStep = useCallback(
    (s: Step) => {
      const rows: Line[] = [{ kind: 'ask', text: s.ask }]
      if (s.kind === 'choice') {
        s.options.forEach((o, i) => {
          const mark = s.fallback === o.value ? '·' : ' '
          rows.push({
            kind: 'out',
            text: `${mark} ${i + 1}) ${o.value.padEnd(10)} ${o.label}${o.note ? ` — ${o.note}` : ''}`,
          })
        })
        rows.push({ kind: 'out', text: '  type a number or a name' })
      } else if (s.kind === 'dates') {
        rows.push({ kind: 'out', text: '  all · 90 days · 6 months · 1 nov 2018 - 1 dec 2022' })
      } else if (s.kind === 'file') {
        rows.push({ kind: 'out', text: '  use the panel beside this terminal, or type `skip`' })
      } else if (s.placeholder) {
        rows.push({ kind: 'out', text: `  e.g. ${s.placeholder}` })
      }
      if ('fallback' in s && s.fallback !== undefined) {
        rows.push({ kind: 'out', text: `  press enter for ${s.fallback}` })
      }
      print(...rows)
    },
    [print],
  )

  // Print the current question exactly once, when the pointer reaches it.
  useEffect(() => {
    if (!step || asked.current === at) return
    asked.current = at
    askStep(step)
  }, [at, step, askStep])

  /* ---- finishing --------------------------------------------------------- */

  const deliverable = useMemo(() => (done ? module.compose(answers) : null), [done, answers, module])

  useEffect(() => {
    if (!done || composed.current || !deliverable) return
    composed.current = true

    const rows: Line[] = [{ kind: 'art', text: '' }, { kind: 'ok', text: 'READY.' }]
    deliverable.notes.forEach((n) => rows.push({ kind: 'out', text: `  · ${n}` }))
    // Warnings sit last, immediately above the command, where they cannot be
    // scrolled past on the way to the thing the reader came for.
    if (deliverable.warnings.length) {
      rows.push({ kind: 'art', text: '' })
      deliverable.warnings.forEach((w) => rows.push({ kind: 'warn', text: `  ! ${w}` }))
    }
    rows.push({ kind: 'art', text: '' })
    print(...rows)
  }, [done, deliverable, print])

  /* ---- answering --------------------------------------------------------- */

  const accept = useCallback(
    (id: string, stored: string, echo: string) => {
      // The answer decides which question comes next — a target of "everybody"
      // skips the two questions about which person — so the pointer is moved
      // against the answers INCLUDING this one, not the ones on screen.
      const next = { ...answers, [id]: stored }
      setAnswers(next)
      print({ kind: 'ok', text: `  ✓ ${echo}` }, { kind: 'art', text: '' })
      setAt((n) => seekForward(steps, n + 1, next))
    },
    [print, answers, steps],
  )

  /** Read one raw input against one step. Returns the complaint, or null. */
  const submit = useCallback(
    (s: Step, raw: string): string | null => {
      const text = raw.trim()

      if (s.kind === 'choice') {
        const fell = !text && s.fallback
        const want = fell ? s.fallback! : text.toLowerCase()
        const byNumber = /^\d+$/.test(want) ? s.options[Number(want) - 1] : undefined
        const hit =
          byNumber ??
          s.options.find((o) => o.value.toLowerCase() === want) ??
          s.options.find((o) => o.label.toLowerCase() === want)
        if (!hit) return `not one of the options: ${s.options.map((o) => o.value).join(', ')}`
        accept(s.id, hit.value, `${hit.value} — ${hit.label}`)
        return null
      }

      if (s.kind === 'dates') {
        const read = parseRange(text)
        if ('error' in read) return read.error
        accept(s.id, encodeRange(read.range), describeRange(read.range))
        return null
      }

      if (s.kind === 'file') {
        if (text.toLowerCase() === 'skip') {
          accept(s.id, '', 'skipped')
          return null
        }
        return 'this one is answered with the panel beside the terminal, or `skip`.'
      }

      const settled = !text && s.fallback !== undefined ? s.fallback : text
      if (!settled) return 'that cannot be empty.'
      const complaint = s.validate?.(settled, answers)
      if (complaint) return complaint
      accept(s.id, settled, settled)
      return null
    },
    [accept, answers],
  )

  /* ---- the verbs --------------------------------------------------------- */

  const restart = useCallback(() => {
    asked.current = -1
    composed.current = false
    setAnswers({})
    setAt(seekForward(steps, 0, {}))
    setCopied(false)
    setLines([...banner, { kind: 'ok', text: 'started over.' }, { kind: 'art', text: '' }])
  }, [banner, steps])

  const back = useCallback(() => {
    const target = seekBack(steps, at, answers)
    if (target < 0) return print({ kind: 'err', text: 'already at the first question.' })
    const dropped = steps[target]
    // Re-asking means the question must be allowed to print again, and the
    // answer being replaced must not linger — otherwise `answers` would show a
    // value for a question currently on screen unanswered.
    asked.current = -1
    composed.current = false
    setAnswers((cur) => {
      const next = { ...cur }
      delete next[dropped.id]
      return next
    })
    setAt(target)
    print({ kind: 'ok', text: `back to: ${dropped.ask}` })
  }, [at, steps, answers, print])

  const runVerb = useCallback(
    (verb: string): boolean => {
      switch (verb) {
        case 'help':
          print(
            { kind: 'out', text: 'back      change the previous answer' },
            { kind: 'out', text: 'restart   start this tool over' },
            { kind: 'out', text: 'answers   what has been settled so far' },
            { kind: 'out', text: 'clear     wipe the scrollback, keep the answers' },
            { kind: 'out', text: 'help      this' },
            { kind: 'art', text: '' },
          )
          return true
        case 'back':
          back()
          return true
        case 'restart':
          restart()
          return true
        case 'answers': {
          const entries = steps
            .slice(0, at)
            .filter((s) => applies(s, answers))
            .map((s) => `${s.id.padEnd(12)}${answers[s.id] || '—'}`)
          print(
            ...(entries.length
              ? entries.map((text): Line => ({ kind: 'out', text }))
              : [{ kind: 'out', text: 'nothing settled yet.' } as Line]),
            { kind: 'art', text: '' },
          )
          return true
        }
        case 'clear':
          setLines([])
          asked.current = -1
          return true
        default:
          return false
      }
    },
    [print, back, restart, steps, at, answers],
  )

  const run = useCallback(
    (raw: string) => {
      const text = raw.trim()
      print({ kind: 'in', text })
      if (text) {
        setHistory((h) => [text, ...h].slice(0, 40))
        setCursor(-1)
      }

      // A verb beats a step answer, so `back` is never swallowed as the answer
      // to a free-text question. The cost is that a tool cannot have an answer
      // literally called "back" — worth it, and documented in TOOL.md.
      if ((META as readonly string[]).includes(text.toLowerCase())) {
        runVerb(text.toLowerCase())
        return
      }

      if (!step) {
        print({ kind: 'out', text: 'this tool is finished. `restart` to run it again.' })
        return
      }

      const complaint = submit(step, text)
      if (complaint) print({ kind: 'err', text: `  ${complaint}` })
    },
    [print, runVerb, step, submit],
  )

  /* ---- keys -------------------------------------------------------------- */

  /** What Tab will complete against, for whatever is being asked right now. */
  const completions = useMemo(() => {
    const verbs = [...META]
    if (!step) return verbs
    if (step.kind === 'choice') return [...step.options.map((o) => o.value), ...verbs]
    if (step.kind === 'dates') return ['all', ...verbs]
    if (step.kind === 'file') return ['skip', ...verbs]
    return verbs
  }, [step])

  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      run(value)
      setValue('')
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      const next = Math.min(history.length - 1, cursor + 1)
      if (next >= 0) {
        setCursor(next)
        setValue(history[next])
      }
    } else if (event.key === 'ArrowDown') {
      event.preventDefault()
      const next = cursor - 1
      setCursor(next)
      setValue(next >= 0 ? history[next] : '')
    } else if (event.key === 'Tab') {
      event.preventDefault()
      const stem = value.trim().toLowerCase()
      if (!stem) return
      const hits = completions.filter((c) => c.startsWith(stem))
      if (hits.length === 1) setValue(hits[0] + ' ')
      else if (hits.length > 1) print({ kind: 'out', text: hits.join('  ') })
    }
  }

  /* ---- the api a tool's panels get --------------------------------------- */

  const api = useMemo<ShellApi>(
    () => ({
      answers,
      waitingOn: step?.id ?? null,
      say,
      answer: (id, val) => {
        const target = steps.findIndex((s) => s.id === id)
        if (target === -1) return
        // A panel answering the question on screen advances the conversation; a
        // panel answering some other step records the value without moving the
        // pointer, so an upload three steps early is remembered rather than
        // skipping the questions in between.
        const next = { ...answers, [id]: val }
        setAnswers(next)
        if (target === at) {
          print({ kind: 'ok', text: `  ✓ ${val || 'answered'}` }, { kind: 'art', text: '' })
          setAt((n) => seekForward(steps, n + 1, next))
        }
      },
    }),
    [answers, step, steps, at, say, print],
  )

  /* ---- copy -------------------------------------------------------------- */

  const copy = async () => {
    if (!deliverable) return
    try {
      await navigator.clipboard.writeText(deliverable.script)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2200)
    } catch {
      // Clipboard access is refused in some contexts and there is nothing to be
      // done about it from here. Say so, and leave the block selectable.
      say('err', 'the browser refused the clipboard — select the block and copy it by hand.')
    }
  }

  const Panels = module.Panels

  return (
    <ShellContext.Provider value={api}>
      <div className="sh">
        <div className="sh__stack">
          <div className="sh__term" onClick={() => input.current?.focus()}>
            <div className="sh__bar" aria-hidden="true">
              <span className="sh__led" />
              <span className="sh__bar-name">{tool.id}</span>
              <span className="sh__bar-step">{done ? 'DONE' : `${asking}/${askable}`}</span>
            </div>

            <div
              className="sh__screen"
              ref={scroller}
              role="log"
              aria-live="polite"
              aria-label={`${tool.title} terminal`}
            >
              {lines.map((line, i) => (
                <pre key={i} className={`sh__line sh__line--${line.kind}`}>
                  {line.kind === 'in' ? `> ${line.text}` : line.text}
                </pre>
              ))}

              {!done && (
                <div className="sh__prompt">
                  <span aria-hidden="true">&gt;</span>
                  <input
                    ref={input}
                    className="sh__input"
                    value={value}
                    spellCheck={false}
                    autoComplete="off"
                    autoCapitalize="off"
                    autoCorrect="off"
                    aria-label={step?.ask ?? 'Answer'}
                    placeholder={step?.kind === 'text' ? (step.placeholder ?? '') : ''}
                    onChange={(e) => setValue(e.target.value)}
                    onKeyDown={onKeyDown}
                  />
                </div>
              )}
            </div>

            {/* Real buttons, not only a gesture and not only a keyboard: the
                options for the current question, tappable. A phone keyboard
                covering half the screen makes typing `conversation` a chore
                nobody signed up for. */}
            <div className="sh__keys">
              {step?.kind === 'choice'
                ? step.options.map((o) => (
                    <button
                      key={o.value}
                      type="button"
                      className="sh__key"
                      onClick={(e) => {
                        e.stopPropagation()
                        run(o.value)
                      }}
                    >
                      {o.value}
                    </button>
                  ))
                : (step?.kind === 'dates' ? ['all', '30 days', '12 months'] : []).map((c) => (
                    <button
                      key={c}
                      type="button"
                      className="sh__key"
                      onClick={(e) => {
                        e.stopPropagation()
                        run(c)
                      }}
                    >
                      {c}
                    </button>
                  ))}
              <span className="sh__keys-gap" />
              {(['back', 'restart'] as const).map((v) => (
                <button
                  key={v}
                  type="button"
                  className="sh__key sh__key--meta"
                  onClick={(e) => {
                    e.stopPropagation()
                    run(v)
                  }}
                >
                  {v}
                </button>
              ))}
            </div>
          </div>

          {deliverable && (
            <div className="sh__deliver">
              <div className="sh__deliver-bar">
                <span>THE COMMAND — paste this into Terminal.app</span>
                <button type="button" className="sh__copy" onClick={copy}>
                  {copied ? 'COPIED' : 'COPY'}
                </button>
              </div>
              <pre className="sh__script">{deliverable.script}</pre>
              <p className="sh__deliver-note">
                Nothing above was sent anywhere. It was assembled in this browser and it runs
                only when you paste it.
              </p>
            </div>
          )}
        </div>

        {Panels && (
          <aside className="sh__panels">
            <Panels />
          </aside>
        )}
      </div>
    </ShellContext.Provider>
  )
}
