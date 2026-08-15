import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { VIBES, isVibeId } from '../../state/portal-context'
import { usePortal, useRig } from '../../state/usePortal'
import { SECTIONS } from '../../content/sections'
import './terminal.css'

type Line = { kind: 'in' | 'out' | 'err' | 'art'; text: string }

const BANNER: Line[] = [
  { kind: 'art', text: '薬窟 SHELL v0.1 — "argue first, cite afterwards"' },
  { kind: 'out', text: 'type `help` for the verbs. type `sudo` and see what happens.' },
]

const RAMEN = String.raw`
   ( ( (
    ) ) )
  .-------.
  |CUP    |   カップ
  |RAMEN  |   ラーメン
  '-------'   3 min. no lid.
`

const CROWS = String.raw`
      _                _                _
     (o>              (o>              (o>
   \\_//)           \\_//)           \\_//)
    \_/_)            \_/_)            \_/_)
     _|_              _|_              _|_
  three crows on the ridge, waiting for you to ship
`

export function Terminal() {
  const { setVibe, setChaos, vibe, chaos } = usePortal()
  const poke = useRig('SHELL')
  const navigate = useNavigate()
  const [lines, setLines] = useState<Line[]>(BANNER)
  const [value, setValue] = useState('')
  const [history, setHistory] = useState<string[]>([])
  const [cursor, setCursor] = useState(-1)
  const scroller = useRef<HTMLDivElement>(null)
  const input = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const el = scroller.current
    if (el) el.scrollTop = el.scrollHeight
  }, [lines])

  const print = (...next: Line[]) => setLines((current) => [...current, ...next])

  const run = (raw: string) => {
    const trimmed = raw.trim()
    print({ kind: 'in', text: trimmed })
    if (!trimmed) return
    setHistory((h) => [trimmed, ...h].slice(0, 40))
    setCursor(-1)
    poke()

    const [verb, ...rest] = trimmed.split(/\s+/)
    const arg = rest.join(' ')

    switch (verb.toLowerCase()) {
      case 'help':
        print(
          { kind: 'out', text: 'help          this' },
          { kind: 'out', text: 'ls            list the wings of the portal' },
          { kind: 'out', text: 'goto <wing>   walk there (try: goto brain)' },
          { kind: 'out', text: 'vibe <name>   repaint everything — ' + VIBES.map((v) => v.id).join(' | ') },
          { kind: 'out', text: 'chaos <0-11>  turn it up' },
          { kind: 'out', text: 'status        what the console currently thinks' },
          { kind: 'out', text: 'ramen / crows / moon / sudo / clear' },
        )
        break

      case 'ls':
      case 'sections':
        SECTIONS.forEach((s) =>
          print({ kind: 'out', text: `${s.slug.padEnd(12)} ${s.kana}  ${s.title} — ${s.status}` }),
        )
        break

      case 'goto':
      case 'cd': {
        const target = SECTIONS.find(
          (s) => s.slug === arg.toLowerCase() || s.title.toLowerCase() === arg.toLowerCase(),
        )
        if (!target) {
          print({ kind: 'err', text: `no wing called "${arg}". try \`ls\`.` })
          break
        }
        print({ kind: 'out', text: `opening ${target.title}…` })
        window.setTimeout(() => navigate(`/${target.slug}`), 420)
        break
      }

      case 'vibe': {
        if (arg === 'next') {
          const i = VIBES.findIndex((v) => v.id === vibe)
          const next = VIBES[(i + 1) % VIBES.length]
          setVibe(next.id)
          print({ kind: 'out', text: `repainted → ${next.name}` })
          break
        }
        if (isVibeId(arg)) {
          setVibe(arg)
          print({ kind: 'out', text: `repainted → ${VIBES.find((v) => v.id === arg)?.name}` })
        } else {
          print({ kind: 'err', text: `unknown vibe "${arg}". one of: ${VIBES.map((v) => v.id).join(', ')}` })
        }
        break
      }

      case 'chaos': {
        const n = Number(arg)
        if (!arg || Number.isNaN(n)) {
          print({ kind: 'err', text: 'usage: chaos <0-11>' })
          break
        }
        const clamped = Math.min(11, Math.max(0, n))
        setChaos(clamped / 11)
        print({
          kind: 'out',
          text: clamped >= 11 ? 'ELEVEN. hold on to something.' : `chaos := ${clamped}`,
        })
        break
      }

      case 'status':
        print(
          { kind: 'out', text: `vibe   ${vibe}` },
          { kind: 'out', text: `chaos  ${(chaos * 11).toFixed(1)} / 11` },
          { kind: 'out', text: `wings  ${SECTIONS.length} (${SECTIONS.filter((s) => s.status === 'LIVE').length} live)` },
        )
        break

      case 'ramen':
        print({ kind: 'art', text: RAMEN })
        break

      case 'crows':
        print({ kind: 'art', text: CROWS })
        break

      case 'moon':
        print({ kind: 'art', text: '     ☾     ✦        ✧\n  the den is open. it is always 4am here.' })
        break

      case 'whoami':
        print({ kind: 'out', text: 'guest@drug-den — unverified, unmedicated, welcome anyway.' })
        break

      case 'sudo':
        print({ kind: 'err', text: 'nice try. this establishment has no root, only priors.' })
        break

      case 'echo':
        print({ kind: 'out', text: arg })
        break

      case 'clear':
        setLines([])
        break

      default:
        print({ kind: 'err', text: `command not found: ${verb}. \`help\` is right there.` })
    }
  }

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
    }
  }

  return (
    <div className="term" onClick={() => input.current?.focus()}>
      <div className="term__bar" aria-hidden="true">
        <span className="term__led" />
        guest@drug-den:~
        <span className="term__baud">9600 8N1</span>
      </div>

      <div className="term__screen" ref={scroller} role="log" aria-live="polite" aria-label="Shell output">
        {lines.map((line, i) => (
          <pre key={i} className={`term__line term__line--${line.kind}`}>
            {line.kind === 'in' ? `> ${line.text}` : line.text}
          </pre>
        ))}
        <div className="term__prompt">
          <span aria-hidden="true">&gt;</span>
          <input
            ref={input}
            className="term__input"
            value={value}
            spellCheck={false}
            autoComplete="off"
            aria-label="Shell command"
            placeholder="help"
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={onKeyDown}
          />
        </div>
      </div>

      <div className="term__keys">
        {['help', 'ls', 'chaos 11', 'vibe next', 'ramen'].map((cmd) => (
          <button
            key={cmd}
            type="button"
            className="term__key"
            onClick={(e) => {
              e.stopPropagation()
              run(cmd)
            }}
          >
            {cmd}
          </button>
        ))}
      </div>
    </div>
  )
}
