import { useState } from 'react'
import { Link } from 'react-router-dom'
import { segments } from './core'

/**
 * A docket item, as the wiki wrote it.
 *
 * Everything on this floor is prose rather than a number, which makes the
 * decision of how much of it to show the only real interface question in the
 * room. Three rules:
 *
 *  1. **Nothing is summarised.** The item is the finding; a shortened
 *     contradiction is a different claim from the one the page is holding.
 *  2. **Long items collapse rather than truncate.** A cut-off sentence with an
 *     ellipsis is a promise the reader cannot cash. A block that folds says how
 *     much more there is and opens on a click.
 *  3. **`[[wiki/…]]` becomes a router link, not an `<a>`.** Half the value of a
 *     collision is walking to the page on the other side of it, and a full page
 *     load between two rooms of one site is a broken navigation.
 */

/** Longer than this and it folds. Two paragraphs, near enough. */
const FOLD = 520

export function Reading({ text, className = '' }: { text: string; className?: string }) {
  const [open, setOpen] = useState(false)
  const long = text.length > FOLD
  const shown = long && !open ? cut(text, FOLD) : text

  return (
    <div className={`dk-read${long && !open ? ' dk-read--folded' : ''} ${className}`}>
      {shown.split(/\n{2,}/).map((para, i) => (
        <p key={i} className="dk-read__p">
          {segments(para).map((seg, j) => {
            if (seg.t === 'bi')
              return (
                <b key={j}>
                  <em>{seg.v}</em>
                </b>
              )
            if (seg.t === 'b') return <b key={j}>{seg.v}</b>
            if (seg.t === 'i') return <em key={j}>{seg.v}</em>
            if (seg.t === 'code') return <code key={j}>{seg.v}</code>
            if (seg.t === 'link')
              return (
                <Link key={j} to={`/brain/${seg.to}`} className="dk-read__link">
                  {seg.v}
                </Link>
              )
            return <span key={j}>{seg.v}</span>
          })}
        </p>
      ))}
      {long && (
        <button type="button" className="dk-read__more" onClick={() => setOpen(!open)}>
          {open ? '— LESS' : `+ ${(text.length - FOLD).toLocaleString()} MORE CHARACTERS`}
        </button>
      )}
    </div>
  )
}

/** Cut on a sentence boundary where there is one within reach, never mid-word. */
function cut(text: string, at: number) {
  const window = text.slice(0, at + 160)
  const stop = window.lastIndexOf('. ')
  if (stop > at * 0.6) return balance(window.slice(0, stop + 1))
  const space = text.lastIndexOf(' ', at)
  return `${balance(text.slice(0, space > 0 ? space : at))}…`
}

/**
 * A cut that lands inside `**a bold span**` leaves the opening delimiter with
 * nothing to close it, and the renderer prints the asterisks. Which is exactly
 * what happened on `favorites/books`, whose contradiction runs its argument in
 * one 300-character bold sentence that the fold landed in the middle of.
 *
 * Truncating markdown means re-closing it. Anything left open is dropped back
 * to its opening delimiter rather than closed artificially — a bold span the
 * reader is seeing half of should stop being bold, not pretend it ended.
 */
function balance(text: string) {
  let out = text
  for (const mark of ['***', '**', '`', '*']) {
    const n = out.split(mark).length - 1
    // `*` is counted after `**` has been settled, so an even count there is a
    // pair of bolds rather than an italic; only an odd one is an open span.
    if (n % 2 === 1) out = out.slice(0, out.lastIndexOf(mark)).trimEnd()
  }
  return out
}

/**
 * The bold head off the front of a dated block.
 *
 * `**CONTRADICTION [2026-08-19] — "98 unique authors" is not evidence of
 * range.**` is already printed above every item as its kind, its date and its
 * headline. Left in the body it is printed twice, and the second one is the
 * one the reader's eye lands on. Where a block has no head — a handful open
 * straight into the argument — the text stands as it is rather than losing its
 * first bold sentence to a rule about a different shape.
 */
export function stripHead(text: string) {
  return text.replace(/^\*\*[\s\S]*?\*\*\s*:?\s*/, '').trim() || text
}
