import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { usePortal } from '../state/usePortal'
import { BANG_FLOOR, ShutterContext, type Bang, type BangKind, type Tone } from './shutter-context'

/* ==========================================================================
   THE SHUTTER — the wiring

   ---- why this is one delegated listener and not two hundred props ---------

   The brief was "every clicked link, every button". There are, at last count,
   somewhere north of two hundred interactive elements in this repo across
   thirty routes, and the version of this that threads an `onClick` through all
   of them is a version that is 90% wired a month from now and silently stops
   being true every time somebody adds a button.

   So nothing opts in. One `pointerdown` listener in the capture phase on the
   document decides whether what you just pressed was a control, and fires. A
   button added tomorrow by somebody who has never read this file gets the
   strobe, because the strobe is a property of the site rather than of the
   button.

   `pointerdown`, not `click`, on purpose: the flash has to land on the press
   rather than on the release, or the whole thing reads as lag. It also means a
   drag on the chaos dial gets one, which is right — you did touch it.

   ---- the two guards ------------------------------------------------------

   1. BANG_FLOOR throttles it to a hair over 3 Hz, which is the photosensitive
      ceiling. See the note on it in shutter-context.
   2. STILL forces every bang to 'calm', which is a soft tint with no invert
      and no steps() in it anywhere.

   ---- the colour ----------------------------------------------------------

   It rotates. Five tubes, next one every time, so two clicks in a row are
   never the same colour and the fifth click is not the first one again unless
   you were counting.

   An element can pin its own with `data-tone="2"`, and the six palette
   swatches do. They are the one control on the site where the colour of the
   answer is information rather than decoration — a rack of six buttons that
   each flash a different, fixed tube is a rack you can learn, and a rack of
   six buttons that flash whatever came next in the rotation is a rack where
   the flash is telling you nothing.
   ========================================================================== */

/**
 * `data-bang` on an element overrides what its press is worth.
 *
 * The listener's own guess is a good one and covers almost everything — a link
 * that goes somewhere is a door, anything else is a tap. What it cannot know is
 * that a relic tag opens a panel over the whole page, or that the front door's
 * button is a door even though it is a button. Four values, and `off` is the
 * fifth: it means this control does not flash at all.
 */
const KIND_OVERRIDE = new Set<string>(['tap', 'hit', 'door'])

/**
 * What counts as something you pressed. Deliberately wide — but the inputs are
 * an ALLOW-list and that is not fussiness.
 *
 * The first cut of this was `input:not([type="text"])`, which is an attribute
 * selector, and the shell on the home console renders `<input>` with no `type`
 * at all. An input with no attribute does not match `[type="text"]`, so it
 * matched the negation, so every press in the shell — and, through the keyboard
 * path below, every SPACE BAR while typing a command — fired a full-screen
 * strobe. Naming the six inputs that are buttons is the version that cannot be
 * wrong about a seventh.
 */
const CONTROLS = [
  'a[href]',
  'button',
  'summary',
  'select',
  '[role="button"]',
  '[role="radio"]',
  '[role="tab"]',
  '[role="option"]',
  'input[type="checkbox"]',
  'input[type="radio"]',
  'input[type="range"]',
  'input[type="submit"]',
  'input[type="button"]',
  'input[type="reset"]',
  '[data-bang]',
].join(',')

/** …and what is exempt, because a flash on it would be noise. */
const QUIET = ['[data-bang="off"]', '.relic-panel__scrim'].join(',')

/** Anywhere a person is composing text. Nothing here ever fires. */
const TYPING = 'input, textarea, select, [contenteditable=""], [contenteditable="true"]'

/**
 * How hard each size hits.
 *
 * `punch` scales the page-wide half — the invert, the hue swing, the
 * saturation — from a hint to the full front-door hit. It is a multiplier
 * rather than four separate keyframe sets so that all four sizes are visibly
 * the same event at different volumes, which is the difference between a house
 * style and four unrelated animations.
 *
 * `dur` is the OVERLAY's length only. The page-wide beat is a fixed 190ms at
 * every size, because a beat scaled down with the rest would be shorter than a
 * frame on a tap and would not be painted at all. See shutter.css.
 *
 * The door stops at 0.85 rather than 1. An invert of a page this dark is a
 * page this bright, and the last fifteen percent of it bought nothing but a
 * flat white field where the site used to be.
 *
 * `calm` is punch 0 on purpose: `invert(0%)` is the identity, so STILL gets
 * the overlay's soft tint and literally nothing else. There is no version of
 * the page-wide flash that runs when motion is off.
 */
const SHAPE: Record<BangKind, { punch: number; dur: number }> = {
  tap: { punch: 0.4, dur: 220 },
  hit: { punch: 0.62, dur: 300 },
  door: { punch: 0.85, dur: 460 },
  calm: { punch: 0, dur: 260 },
}

const isTone = (value: unknown): value is Tone =>
  typeof value === 'number' && value >= 1 && value <= 5

/** What this press is worth: the element's own answer, or the listener's. */
function kindOf(el: Element): BangKind {
  const stated = (el as HTMLElement).dataset?.bang
  if (stated && KIND_OVERRIDE.has(stated)) return stated as BangKind
  return isDoor(el) ? 'door' : 'tap'
}

/** A pinned tube, where the control has one. See the note on colour above. */
function toneOf(el: Element): Tone | undefined {
  const pinned = Number((el as HTMLElement).dataset?.tone)
  return isTone(pinned) ? pinned : undefined
}

/** Same-document link → you are about to leave the page you are on. */
function isDoor(el: Element): boolean {
  const a = el.closest('a[href]') as HTMLAnchorElement | null
  if (!a) return false
  if (a.target && a.target !== '_self') return false
  if (a.hasAttribute('download')) return false
  const href = a.getAttribute('href') ?? ''
  // A bare hash is a jump within the page, not a door out of it.
  return href.startsWith('/') && !href.startsWith('//')
}

export function ShutterProvider({ children }: { children: ReactNode }) {
  const { motion } = usePortal()
  const [bang, setBang] = useState<Bang | null>(null)

  const seq = useRef(0)
  const tone = useRef<Tone>(3)
  const last = useRef(0)
  const clear = useRef(0)
  // Read inside a listener that is installed once, so it has to be a ref
  // rather than a closed-over value or the listener keeps the mount-time
  // answer forever and STILL never takes effect.
  const calm = useRef(!motion)
  calm.current = !motion

  const fire = useCallback<
    (kind?: BangKind, at?: { x: number; y: number } | null, pin?: Tone) => void
  >((kind = 'tap', at = null, pin) => {
    const now = performance.now()
    if (now - last.current < BANG_FLOOR) return
    last.current = now

    tone.current = pin ?? ((tone.current % 5) + 1) as Tone
    seq.current += 1

    const w = window.innerWidth || 1
    const h = window.innerHeight || 1

    setBang({
      id: seq.current,
      kind: calm.current ? 'calm' : kind,
      tone: tone.current,
      x: at ? (at.x / w) * 100 : 50,
      y: at ? (at.y / h) * 100 : 50,
    })

    window.clearTimeout(clear.current)
    clear.current = window.setTimeout(() => setBang(null), 900)
  }, [])

  // ---- the one listener --------------------------------------------------
  useEffect(() => {
    const onDown = (event: PointerEvent) => {
      const target = event.target as Element | null
      if (!target || typeof target.closest !== 'function') return

      const hit = target.closest(CONTROLS)
      if (!hit || hit.closest(QUIET)) return
      if (hit instanceof HTMLElement && hit.getAttribute('aria-disabled') === 'true') return
      if ((hit as HTMLButtonElement).disabled) return

      fire(
        kindOf(hit),
        { x: event.clientX, y: event.clientY },
        toneOf(hit),
      )

      // The local misregistration: the thing you actually pressed splits into
      // its channels for a moment. The page-wide flash tells you SOMETHING
      // happened; this is what tells you it was this.
      if (hit instanceof HTMLElement) {
        hit.dataset.struck = ''
        window.setTimeout(() => delete hit.dataset.struck, 320)
      }
    }

    // A keyboard activation has no pointer and therefore no origin; the
    // element's own centre is the honest answer, and it keeps the iris from
    // always opening from the middle of the screen for keyboard users.
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Enter' && event.key !== ' ') return
      if (event.repeat) return
      const el = document.activeElement
      if (!el || !(el instanceof HTMLElement) || !el.matches(CONTROLS)) return
      if (el.closest(QUIET)) return
      // Space is a character before it is an activation. A caret in a field is
      // the one place on this site where a key press is not a press.
      if (el.matches(TYPING) && !el.matches('input[type="range"]')) return
      const box = el.getBoundingClientRect()
      fire(
        kindOf(el),
        { x: box.left + box.width / 2, y: box.top + box.height / 2 },
        toneOf(el),
      )
    }

    document.addEventListener('pointerdown', onDown, { capture: true, passive: true })
    document.addEventListener('keydown', onKey, { capture: true })
    return () => {
      document.removeEventListener('pointerdown', onDown, { capture: true })
      document.removeEventListener('keydown', onKey, { capture: true })
    }
  }, [fire])

  useEffect(() => () => window.clearTimeout(clear.current), [])

  // Published on <html> so plain CSS can run the page-wide half of the effect.
  //
  // The root element is the one place a `filter` can be applied without
  // creating a containing block for fixed descendants — the Filter Effects
  // spec exempts it explicitly. That exemption is the entire reason the strobe
  // is on :root and not on a wrapper div: on any other element it would
  // re-parent the crawls, the HUD and the five screen-furniture layers for the
  // duration of every flash, and they would all jump.
  //
  // `--bang-anim` alternates between two identical keyframe names, and that is
  // not a stylistic tic. A CSS animation keyed off an attribute does not
  // restart when the attribute is set to the value it already had, so two taps
  // 300ms apart would have flashed once. Alternating the animation-name gives
  // the engine a genuinely different animation to start every single time.
  useEffect(() => {
    const root = document.documentElement
    if (!bang) {
      delete root.dataset.bang
      return
    }
    const shape = SHAPE[bang.kind]
    root.dataset.bang = bang.kind
    root.style.setProperty('--bang-tone', `var(--n${bang.tone})`)
    root.style.setProperty('--bang-punch', String(shape.punch))
    root.style.setProperty('--bang-dur', `${shape.dur}ms`)
    root.style.setProperty('--bang-anim', bang.id % 2 ? 'bang-root-a' : 'bang-root-b')
    // The strike point outlives the bang. ARRIVAL reads it when the new route
    // turns up, so the iris opens out of the same link you closed it with —
    // by then this element has been unmounted for a hundred milliseconds.
    root.style.setProperty('--bx', `${bang.x}%`)
    root.style.setProperty('--by', `${bang.y}%`)
  }, [bang])

  const value = useMemo(() => ({ bang, fire }), [bang, fire])

  return <ShutterContext.Provider value={value}>{children}</ShutterContext.Provider>
}
