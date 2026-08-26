import { useEffect, useRef, useState } from 'react'

/* ==========================================================================
   THE RESOLVE

   A heading arrives as noise and settles into a word, left to right, over
   about half a second. The shell on the home console has done this to its
   output since it was built; this is the same move promoted to a house
   behaviour, so every heading on the site tunes in rather than fades in.

   ---- what it does not do -------------------------------------------------

   It does not touch the DOM text a screen reader sees. `SubHead` renders the
   real string in a visually-hidden sibling and hands only the animated copy to
   this, marked `aria-hidden`. That is the whole reason this returns a string
   instead of writing into a ref: the caller has to be able to render both.

   It also does not run on a heading nobody is looking at. An IntersectionObserver
   starts it on the way in and disconnects immediately afterwards — the site has
   thirty headings on some pages and a timer per heading running forever, off
   screen, would be a genuinely stupid thing to have built.

   ---- and the frame budget ------------------------------------------------

   One `setInterval` at 45ms — about 22 frames a second — not a rAF loop. This
   is text being replaced, not something being moved: at 60fps two thirds of the
   renders would produce an identical string, and the effect is *better* at 22
   because glyph noise that changes every 16ms reads as a grey blur rather than
   as characters.
   ========================================================================== */

/**
 * Latin and symbols only, deliberately, even though the shell's own version of
 * this uses kana and this building is covered in kana.
 *
 * A heading is set in Archivo Black. There is no CJK webfont shipped here — the
 * `.jp` class leans on whatever the OS has — so a kana glyph in a heading is a
 * full-width character from a fallback family in the middle of a line of
 * condensed Latin. Every frame of the resolve would be a different width, and a
 * four-word heading would visibly stretch and snap for half a second while the
 * block of colour behind it re-laid out underneath. These are all roughly the
 * width of the characters they are standing in for, so the line does not move.
 */
const GLYPHS = '#%&@$*+=/\\|<>[]{}0123456789ABCDEFGHJKLMNPQRSTVWXYZ'

const pick = () => GLYPHS[(Math.random() * GLYPHS.length) | 0]

/** ms per tick. See the note above on why this is not a frame. */
const TICK = 45
/** ticks a character spends as noise before it settles. */
const HOLD = 3

export function useScramble(text: string, enabled: boolean) {
  const [shown, setShown] = useState(text)
  const host = useRef<HTMLElement | null>(null)
  const timer = useRef(0)

  // The text can change under us — a route swap reuses the same heading node —
  // so the resting value has to follow it or the old word is left on screen.
  useEffect(() => {
    if (!enabled) setShown(text)
  }, [text, enabled])

  useEffect(() => {
    if (!enabled) return
    const node = host.current
    if (!node) return

    const run = () => {
      window.clearInterval(timer.current)
      let tick = 0
      // Characters resolve at a hair over one per tick, so a long heading does
      // not take proportionally longer than a short one — the wave crosses the
      // word at a speed set by the word, not by the clock.
      const rate = Math.max(1, text.length / 12)

      timer.current = window.setInterval(() => {
        tick += 1
        const settled = tick * rate
        let out = ''
        let done = true

        for (let i = 0; i < text.length; i++) {
          const char = text[i]
          // Only letters and digits scramble. A heading whose spaces, dashes
          // and ampersands move around while it resolves reads as broken rather
          // than as tuning in — the word shapes have to stay put.
          if (!/[A-Za-z0-9]/.test(char)) {
            out += char
            continue
          }
          if (i < settled) {
            out += char
          } else if (i < settled + HOLD * rate) {
            out += pick()
            done = false
          } else {
            out += ' '
            done = false
          }
        }

        setShown(out)
        if (done) {
          window.clearInterval(timer.current)
          setShown(text)
        }
      }, TICK)
    }

    // Start it on the way in, once, then stop watching.
    const watch = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return
        watch.disconnect()
        run()
      },
      { rootMargin: '0px 0px -12% 0px' },
    )
    watch.observe(node)

    node.addEventListener('pointerenter', run)

    return () => {
      watch.disconnect()
      node.removeEventListener('pointerenter', run)
      window.clearInterval(timer.current)
    }
  }, [text, enabled])

  return { shown, host }
}
