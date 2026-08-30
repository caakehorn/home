/**
 * The extras bag — four dedicated fields, and a place for everything else.
 *
 * Substance, amount, unit of measure and time are columns, because a dose
 * cannot be read without them and every statistic is arithmetic over them.
 * Everything else worth recording about a dose is open-ended and nobody knows
 * the list in advance: the route, who was there, what it was cut with, how it
 * landed, why it was bigger than the last one.
 *
 * A schema for that would be wrong twice — it would be missing the field you
 * want at four in the morning, and it would carry ten empty boxes past you
 * every other time. So it is a bag of named strings, collapsed by default and
 * one tap away, and it never stands between the log button and a saved dose.
 *
 * ---- what it deliberately is not -------------------------------------------
 *
 * It is not a second set of quantities. Nothing here is ever summed, averaged
 * or charted, and the reports read it as text — because a number typed into a
 * free-form box has no unit, no measurement class and no denominator, and the
 * whole ledger is built on refusing to compute over exactly that. A quantity
 * that matters belongs in the four fields, where the arithmetic can see what
 * kind of number it is.
 */

import { useState } from 'react'
import type { Extra } from './events.ts'

/** Suggested rather than enforced — the point is that the list is not fixed. */
const COMMON = ['route', 'with', 'setting', 'source', 'effect', 'cut with']

export function ExtrasEditor({
  value,
  onChange,
}: {
  value: Extra
  onChange: (next: Extra) => void
}) {
  const [open, setOpen] = useState(false)
  const rows = Object.entries(value)

  const set = (key: string, v: string) => onChange({ ...value, [key]: v })
  const drop = (key: string) => {
    const next = { ...value }
    delete next[key]
    onChange(next)
  }
  const add = (key: string) => {
    if (!key.trim() || key in value) return
    onChange({ ...value, [key.trim()]: '' })
    setOpen(true)
  }

  if (!open && !rows.length) {
    return (
      <button type="button" className="lg__linkish" onClick={() => setOpen(true)}>
        + ANYTHING ELSE
      </button>
    )
  }

  return (
    <div className="lg__extras">
      {rows.map(([key, v]) => (
        <div key={key} className="lg__extra-row">
          <span className="lg__extra-key">{key}</span>
          <input
            className="lg__field"
            value={v}
            onChange={(e) => set(key, e.target.value)}
            aria-label={key}
            autoFocus={v === ''}
          />
          <button
            type="button"
            className="lg__x"
            onClick={() => drop(key)}
            aria-label={`Remove ${key}`}
          >
            ✕
          </button>
        </div>
      ))}

      <div className="lg__extra-add">
        {COMMON.filter((k) => !(k in value)).map((k) => (
          <button key={k} type="button" className="lg__chip" onClick={() => add(k)}>
            {k}
          </button>
        ))}
        <NewKey onAdd={add} />
      </div>
    </div>
  )
}

/** Any name at all, because the suggestions above are not the list. */
function NewKey({ onAdd }: { onAdd: (key: string) => void }) {
  const [text, setText] = useState('')
  return (
    <input
      className="lg__field lg__field--key"
      value={text}
      onChange={(e) => setText(e.target.value)}
      onKeyDown={(e) => {
        if (e.key !== 'Enter') return
        e.preventDefault()
        onAdd(text)
        setText('')
      }}
      onBlur={() => {
        if (!text.trim()) return
        onAdd(text)
        setText('')
      }}
      placeholder="or name one…"
      aria-label="Add a field"
    />
  )
}

/** What a saved bag looks like on a report. Read as text, never as numbers. */
export function Extras({ extra }: { extra: Extra | null }) {
  if (!extra || !Object.keys(extra).length) return null
  return (
    <dl className="lg__extra-read">
      {Object.entries(extra).map(([key, value]) => (
        <div key={key}>
          <dt>{key}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  )
}
