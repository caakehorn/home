import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { VIBES, isVibeId } from '../../state/portal-context'
import { usePortal, useRig } from '../../state/usePortal'
import { SECTIONS } from '../../content/sections'
import { loadIndex, type IndexEntry } from '../../wiki/data'
import './terminal.css'

type Line = { kind: 'in' | 'out' | 'err' | 'art'; text: string }

const BANNER: Line[] = [
  { kind: 'art', text: '薬窟 SHELL v0.2 — "argue first, cite afterwards"' },
  { kind: 'out', text: 'type `help` for the verbs. most of them are not in `help`.' },
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

const GLYPHS = 'アイウエオカキクケコサシスセソタチツテトナニヌネノ0123456789ｱｲｳｴｵ▓▒░'

const VERDICTS = [
  'YES. ANNOYINGLY, YES.',
  'NO, AND YOU ALREADY KNEW THAT.',
  'THE PREMISE IS THE PROBLEM.',
  'ASK AGAIN WHEN YOU HAVE SLEPT.',
  'BOTH. THAT IS WHAT DIALECTIC MEANS.',
  'CITE IT OR DROP IT.',
  'YOU ARE ARGUING WITH SOMEONE WHO IS NOT HERE.',
  'CORRECT, AND IT WILL NOT HELP.',
  'THE RECORD SAYS OTHERWISE.',
  'SOMETIME AFTER 4AM. NOT BEFORE.',
]

/** Deterministic: the same question gets the same answer forever. */
const seedOf = (text: string) => {
  let hash = 0x811c9dc5
  for (const ch of text.toLowerCase().trim()) {
    hash ^= ch.charCodeAt(0)
    hash = Math.imul(hash, 0x01000193) >>> 0
  }
  return hash
}

/** Screen effects live on <html> so they survive a re-render of this rig. */
const FX = ['inverted', 'flipped', 'napping', 'strobing', 'scanning'] as const
type Fx = (typeof FX)[number]

const setFx = (fx: Fx, on: boolean) => document.documentElement.classList.toggle(`term-fx-${fx}`, on)
const hasFx = (fx: Fx) => document.documentElement.classList.contains(`term-fx-${fx}`)
const clearFx = () => FX.forEach((fx) => setFx(fx, false))

const calm = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches

export function Terminal() {
  const { setVibe, setChaos, vibe, chaos, rigs } = usePortal()
  const poke = useRig('SHELL')
  const navigate = useNavigate()
  const [lines, setLines] = useState<Line[]>(BANNER)
  const [value, setValue] = useState('')
  const [history, setHistory] = useState<string[]>([])
  const [cursor, setCursor] = useState(-1)
  const scroller = useRef<HTMLDivElement>(null)
  const input = useRef<HTMLInputElement>(null)
  const born = useRef(Date.now())
  const timers = useRef<number[]>([])

  useEffect(() => {
    const el = scroller.current
    if (el) el.scrollTop = el.scrollHeight
  }, [lines])

  // Nothing this rig turns on outlives it.
  useEffect(
    () => () => {
      clearFx()
      timers.current.forEach(window.clearTimeout)
    },
    [],
  )

  const print = (...next: Line[]) => setLines((current) => [...current, ...next])
  const out = (text: string) => print({ kind: 'out', text })
  const err = (text: string) => print({ kind: 'err', text })
  const art = (text: string) => print({ kind: 'art', text })
  const later = (fn: () => void, ms: number) => timers.current.push(window.setTimeout(fn, ms))

  /** The wiki index, for the commands that actually read the corpus. */
  const withIndex = (fn: (pages: IndexEntry[]) => void) => {
    loadIndex()
      .then((data) => fn(data.pages))
      .catch(() => err('the corpus is not reachable from here.'))
  }

  const open = (slug: string) => {
    out(`opening ${slug}…`)
    later(() => navigate(`/brain/${slug}`), 420)
  }

  type Command = {
    /** Shown by `help`. Hidden verbs are found, not advertised. */
    listed?: boolean
    usage?: string
    blurb: string
    run: (arg: string, argv: string[]) => void
  }

  const COMMANDS: Record<string, Command> = {
    // ---- the listed ones -------------------------------------------------
    help: {
      listed: true,
      blurb: 'this',
      run: () => {
        Object.entries(COMMANDS)
          .filter(([, c]) => c.listed)
          .forEach(([name, c]) => out(`${(c.usage ?? name).padEnd(14)}${c.blurb}`))
        out('')
        out(`${Object.keys(COMMANDS).length} verbs exist. ${Object.values(COMMANDS).filter((c) => c.listed).length} are listed.`)
        out('`man <verb>` documents any of them, listed or not.')
      },
    },
    ls: {
      listed: true,
      blurb: 'list the rooms',
      run: () =>
        SECTIONS.forEach((s) => out(`${s.slug.padEnd(12)} ${s.kana}  ${s.title} — ${s.status}`)),
    },
    goto: {
      listed: true,
      usage: 'goto <room>',
      blurb: 'walk there (try: goto brain)',
      run: (arg) => {
        const target = SECTIONS.find(
          (s) => s.slug === arg.toLowerCase() || s.title.toLowerCase() === arg.toLowerCase(),
        )
        if (!target) return err(`no room called "${arg}". try \`ls\`.`)
        out(`opening ${target.title}…`)
        later(() => navigate(`/${target.slug}`), 420)
      },
    },
    vibe: {
      listed: true,
      usage: 'vibe <name>',
      blurb: `repaint — ${VIBES.map((v) => v.id).join(' | ')} | next`,
      run: (arg) => {
        if (arg === 'next') {
          const next = VIBES[(VIBES.findIndex((v) => v.id === vibe) + 1) % VIBES.length]
          setVibe(next.id)
          return out(`repainted → ${next.name}`)
        }
        if (!isVibeId(arg)) return err(`unknown vibe "${arg}". one of: ${VIBES.map((v) => v.id).join(', ')}`)
        setVibe(arg)
        out(`repainted → ${VIBES.find((v) => v.id === arg)?.name}`)
      },
    },
    chaos: {
      listed: true,
      usage: 'chaos <0-11>',
      blurb: 'turn it up',
      run: (arg) => {
        const n = Number(arg)
        if (!arg || Number.isNaN(n)) return err('usage: chaos <0-11>')
        const clamped = Math.min(11, Math.max(0, n))
        setChaos(clamped / 11)
        out(clamped >= 11 ? 'ELEVEN. hold on to something.' : `chaos := ${clamped}`)
      },
    },
    grep: {
      listed: true,
      usage: 'grep <term>',
      blurb: 'search 458 pages',
      run: (arg) => {
        if (!arg) return err('usage: grep <term>')
        const q = arg.toLowerCase()
        withIndex((pages) => {
          const hits = pages.filter(
            (p) =>
              p.title.toLowerCase().includes(q) ||
              p.slug.toLowerCase().includes(q) ||
              (p.knownFor ?? '').toLowerCase().includes(q),
          )
          if (!hits.length) return err(`no page matches "${arg}".`)
          hits
            .sort((a, b) => b.words - a.words)
            .slice(0, 12)
            .forEach((p) => out(`${p.slug.padEnd(42)} ${String(p.words).padStart(6)}w`))
          if (hits.length > 12) out(`… and ${hits.length - 12} more`)
        })
      },
    },
    status: {
      listed: true,
      blurb: 'what the console currently thinks',
      run: () => {
        out(`vibe    ${vibe}`)
        out(`chaos   ${(chaos * 11).toFixed(1)} / 11`)
        out(`rooms   ${SECTIONS.length} (${SECTIONS.filter((s) => s.status === 'LIVE').length} live)`)
        out(`rigs    ${rigs.length} online`)
        const on = FX.filter(hasFx)
        out(`fx      ${on.length ? on.join(', ') : 'none'}`)
      },
    },
    clear: { listed: true, blurb: 'wipe the screen', run: () => setLines([]) },

    // ---- the corpus ------------------------------------------------------
    whois: {
      usage: 'whois <name>',
      blurb: 'resolve a name to a page and read its card',
      run: (arg) => {
        if (!arg) return err('usage: whois <name>')
        const q = arg.toLowerCase()
        withIndex((pages) => {
          // Shortest title among the partial matches: "Annie (Anne Louise
          // Ulmer)" is the page about Annie, "The Dan/Annie Fallout — Was He
          // Correct to Feel Wronged?" is a page that mentions her.
          const loose = pages
            .filter((p) => p.title.toLowerCase().includes(q))
            .sort((a, b) => a.title.length - b.title.length)
          const hit =
            pages.find((p) => p.title.toLowerCase() === q) ??
            pages.find((p) => p.slug.split('/').pop() === q.replace(/\s+/g, '-')) ??
            loose[0]
          if (!hit) return err(`nobody here by that name. try \`grep ${arg}\`.`)
          out(`${hit.title}  [${hit.domain}]`)
          if (hit.knownFor) out(`  ${hit.knownFor}`)
          out(`  ${hit.words.toLocaleString()} words · ${hit.links} links out${hit.brief ? ' · has a brief' : ''}`)
          out(`  read: goto brain, or \`open ${hit.slug}\``)
        })
      },
    },
    open: {
      usage: 'open <slug>',
      blurb: 'open a wiki page by slug',
      run: (arg) => (arg ? open(arg) : err('usage: open <slug>')),
    },
    lucky: {
      blurb: 'open a page at random',
      run: () => withIndex((pages) => open(pages[Math.floor(Math.random() * pages.length)].slug)),
    },
    backlinks: {
      usage: 'backlinks <term>',
      blurb: 'who points at it',
      run: (arg) => {
        if (!arg) return err('usage: backlinks <term>')
        withIndex((pages) => {
          const hit = pages.find((p) => p.slug.includes(arg.toLowerCase()) || p.title.toLowerCase().includes(arg.toLowerCase()))
          if (!hit) return err(`no page matches "${arg}".`)
          out(`${hit.title} — ${hit.links} links out. the graph is on the map: goto brain.`)
        })
      },
    },
    corpus: {
      blurb: 'the headline counts',
      run: () =>
        loadIndex()
          .then((d) =>
            out(
              `${d.counts.pages} pages · ${d.counts.words.toLocaleString()} words · ` +
                `${(d.counts.edges ?? 0).toLocaleString()} links · ${d.counts.chartables} charted tables`,
            ),
          )
          .catch(() => err('the corpus is not reachable from here.')),
    },
    cite: {
      blurb: 'a citation, pulled at random, real',
      run: () =>
        withIndex((pages) => {
          const p = pages[Math.floor(Math.random() * pages.length)]
          out(`"${p.title}", wiki-brain, ${p.words.toLocaleString()} words. /${p.slug}.`)
        }),
    },
    hegel: {
      blurb: 'a dialectic, assembled from three real pages',
      run: () =>
        withIndex((pages) => {
          const pick = () => pages[Math.floor(Math.random() * pages.length)].title
          out(`THESIS      ${pick()}`)
          out(`ANTITHESIS  ${pick()}`)
          out(`SYNTHESIS   ${pick()}`)
          out('')
          out('the third one is doing a lot of work.')
        }),
    },

    // ---- state -----------------------------------------------------------
    overdose: {
      blurb: 'chaos to eleven, no ramp',
      run: () => {
        setChaos(1)
        art('  ██  ELEVEN  ██\n  everything is louder now. `narcan` if you regret it.')
      },
    },
    narcan: {
      blurb: 'chaos to zero, effects off, immediately',
      run: () => {
        setChaos(0)
        clearFx()
        out('came down. the room is still here.')
      },
    },
    sober: { blurb: 'alias for narcan', run: () => COMMANDS.narcan.run('', []) },
    invert: {
      blurb: 'flip every colour on the site',
      run: () => {
        setFx('inverted', !hasFx('inverted'))
        out(hasFx('inverted') ? 'inverted. run it again to undo.' : 'back to normal.')
      },
    },
    flip: {
      blurb: 'turn the whole page upside down',
      run: () => {
        setFx('flipped', !hasFx('flipped'))
        out(hasFx('flipped') ? 'ʇı ǝsɹǝʌǝɹ oʇ uıɐƃɐ dılɟ' : 'right way up.')
      },
    },
    scanlines: {
      blurb: 'CRT the whole document',
      run: () => {
        setFx('scanning', !hasFx('scanning'))
        out(hasFx('scanning') ? 'scanlines on.' : 'scanlines off.')
      },
    },
    nap: {
      blurb: 'lights out for four seconds',
      run: () => {
        setFx('napping', true)
        out('…')
        later(() => {
          setFx('napping', false)
          out('back. you were out for four seconds.')
        }, 4000)
      },
    },
    strobe: {
      blurb: 'a slow pulse, well under the seizure threshold',
      run: () => {
        if (calm()) return out('you asked for reduced motion, so: no. everything else still works.')
        setFx('strobing', true)
        out('pulsing at 1.5 Hz for six seconds. half the WCAG flash limit.')
        later(() => setFx('strobing', false), 6000)
      },
    },
    party: {
      blurb: 'cycle every palette, one a second',
      run: () => {
        out(`${VIBES.length} palettes, one second each.`)
        VIBES.forEach((v, i) => later(() => setVibe(v.id), i * 1000))
      },
    },
    lock: {
      blurb: 'throw the bolt on the front door',
      run: () => {
        out('bolting the door. you will need the passphrase again.')
        later(() => {
          window.location.hash = 'lock'
        }, 600)
      },
    },

    // ---- lore, jokes, unix cosplay ---------------------------------------
    man: {
      usage: 'man <verb>',
      blurb: 'documentation for any verb',
      run: (arg) => {
        const cmd = COMMANDS[arg.toLowerCase()]
        if (!cmd) return err(`no manual entry for "${arg}".`)
        out(`${(cmd.usage ?? arg).toUpperCase()}`)
        out(`  ${cmd.blurb}`)
        out(`  ${cmd.listed ? 'listed in help' : 'not listed in help'}`)
      },
    },
    '8ball': {
      usage: '8ball <question>',
      blurb: 'a verdict. the same question always gets the same one',
      run: (arg) => {
        if (!arg) return err('usage: 8ball <question>')
        out(VERDICTS[seedOf(arg) % VERDICTS.length])
      },
    },
    fortune: { blurb: 'an unsolicited verdict', run: () => out(VERDICTS[Math.floor(Math.random() * VERDICTS.length)]) },
    roll: {
      usage: 'roll <NdN>',
      blurb: 'dice',
      run: (arg) => {
        const m = (arg || '1d20').match(/^(\d*)d(\d+)$/i)
        if (!m) return err('usage: roll 2d6')
        const count = Math.min(20, Number(m[1] || 1))
        const sides = Math.min(1000, Number(m[2]))
        const rolls = Array.from({ length: count }, () => 1 + Math.floor(Math.random() * sides))
        out(`${rolls.join(' + ')}${count > 1 ? ` = ${rolls.reduce((a, b) => a + b, 0)}` : ''}`)
      },
    },
    matrix: {
      blurb: 'glyph rain',
      run: () => {
        const row = () =>
          Array.from({ length: 46 }, () => GLYPHS[Math.floor(Math.random() * GLYPHS.length)]).join('')
        art(Array.from({ length: 10 }, row).join('\n'))
      },
    },
    cowsay: {
      usage: 'cowsay <text>',
      blurb: 'a cow says it',
      run: (arg) => {
        const text = arg || 'moo'
        const bar = '-'.repeat(text.length + 2)
        art(
          ` ${bar}\n< ${text} >\n ${bar}\n` +
            '        \\   ^__^\n         \\  (oo)\\_______\n            (__)\\       )\\/\\\n                ||----w |\n                ||     ||',
        )
      },
    },
    ps: {
      blurb: 'what is running',
      run: () => {
        out('  PID  RIG')
        rigs.forEach((r, i) => out(`  ${String(100 + i).padStart(4)}  ${r}`))
      },
    },
    uptime: {
      blurb: 'how long this shell has been open',
      run: () => {
        const s = Math.round((Date.now() - born.current) / 1000)
        out(`up ${Math.floor(s / 60)}m ${s % 60}s · load average: 11.00, 11.00, 11.00`)
      },
    },
    date: { blurb: 'the time here', run: () => out('4:00 AM. it is always 4am here.') },
    history: {
      blurb: 'what you have typed',
      run: () => (history.length ? [...history].reverse().forEach((h, i) => out(`  ${i + 1}  ${h}`)) : out('nothing yet.')),
    },
    tree: {
      blurb: 'the shape of the site',
      run: () => {
        art(
          '/\n' +
            SECTIONS.map((s, i) => `${i === SECTIONS.length - 1 ? '└─' : '├─'} /${s.slug}  ${s.status}`).join('\n') +
            '\n└─ /terms  the one door in front of the gate',
        )
      },
    },
    curl: {
      usage: 'curl <path>',
      blurb: 'fetch something this site serves',
      run: (arg) => {
        const path = (arg || 'llms.txt').replace(/^\//, '')
        fetch(`${import.meta.env.BASE_URL}${path}`.replace(/\/{2,}/g, '/'))
          .then((r) => (r.ok ? r.text() : Promise.reject(new Error(String(r.status)))))
          .then((body) => art(body.split('\n').slice(0, 14).join('\n') + '\n…'))
          .catch((e) => err(`curl: ${path}: ${e.message}`))
      },
    },
    whoami: { blurb: 'you', run: () => out('guest@drug-den — unverified, unmedicated, welcome anyway.') },
    sudo: { blurb: 'no', run: () => err('nice try. this establishment has no root, only priors.') },
    rm: {
      usage: 'rm -rf /',
      blurb: 'try it',
      run: (_arg, argv) =>
        argv.includes('-rf') && argv.includes('/')
          ? err('the record does not delete. that is the entire point of the record.')
          : err('rm: refusing to remove anything. everything here is evidence.'),
    },
    exit: { blurb: 'leave', run: () => err('there is no exit. there is a door, and you came in through it.') },
    echo: { blurb: 'say it back', run: (arg) => out(arg) },
    ramen: { blurb: 'cup ramen', run: () => art(RAMEN) },
    crows: { blurb: 'three crows', run: () => art(CROWS) },
    moon: { blurb: 'the moon', run: () => art('     ☾     ✦        ✧\n  the den is open. it is always 4am here.') },
    credits: {
      blurb: 'who did this',
      run: () => {
        out('written at the wrong hour by @danfrank')
        out('wiki-brain · leviathan · the lattice · this shell')
        out('every number on this site is a count. see /leviathan.')
      },
    },
  }

  const run = (raw: string) => {
    const trimmed = raw.trim()
    print({ kind: 'in', text: trimmed })
    if (!trimmed) return
    setHistory((h) => [trimmed, ...h].slice(0, 40))
    setCursor(-1)
    poke()

    const [verb, ...rest] = trimmed.split(/\s+/)
    const command = COMMANDS[verb.toLowerCase()]
    if (!command) {
      err(`command not found: ${verb}. \`help\` is right there — and it does not list everything.`)
      return
    }
    command.run(rest.join(' '), rest)
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
    } else if (event.key === 'Tab') {
      // Completion over every verb, listed or not — the way you find them.
      event.preventDefault()
      const stem = value.trim().toLowerCase()
      if (!stem) return
      const hits = Object.keys(COMMANDS).filter((c) => c.startsWith(stem))
      if (hits.length === 1) setValue(hits[0] + ' ')
      else if (hits.length > 1) print({ kind: 'out', text: hits.join('  ') })
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
            placeholder="help — or press Tab"
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={onKeyDown}
          />
        </div>
      </div>

      <div className="term__keys">
        {['help', 'grep annie', 'hegel', 'overdose', 'matrix'].map((cmd) => (
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
