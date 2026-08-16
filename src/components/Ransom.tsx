import type { CSSProperties } from 'react'
import './ransom.css'

/**
 * RANSOM — cut-up headline type.
 *
 * The Jamie Reid move: every letter is a separate scrap, cut from a different
 * page, pasted down at a slightly wrong angle. It is the one graphic device
 * that reads as *refusal* rather than as decoration, which is why it has been
 * on the front of every good record sleeve since 1977 and on the front of
 * approximately zero personal websites.
 *
 * Two things make it work rather than look like a novelty font:
 *
 *   1. It is **seeded**, not random. A headline gets one cut for the life of
 *      the build, so it does not reshuffle under the reader on every keystroke
 *      anywhere on the page — which is what `Math.random()` in a component
 *      body would do.
 *   2. It is **word-atomic**. Letters are scraps, but words are not broken
 *      across lines: each word is its own nowrap run, so a long headline wraps
 *      like text instead of shattering.
 *
 * Accessibility: the whole string is on the wrapper as an aria-label and every
 * scrap is aria-hidden, so a screen reader gets "NOTHING HERE IS TASTEFUL" and
 * not twenty-two separate letters.
 */

const CUTS = 6

/** FNV-1a. Same string, same cut, every build. */
function seedOf(text: string) {
  let hash = 0x811c9dc5
  for (const ch of text) {
    hash ^= ch.charCodeAt(0)
    hash = Math.imul(hash, 0x01000193) >>> 0
  }
  return hash
}

type RansomProps = {
  children: string
  /** Rendered element. A headline should pass its own h1/h2. */
  as?: 'span' | 'h1' | 'h2' | 'h3'
  /** How far the scraps are allowed to tilt, in degrees. */
  lean?: number
  className?: string
  style?: CSSProperties
  id?: string
}

export function Ransom({
  children,
  as: Tag = 'span',
  lean = 5,
  className = '',
  style,
  id,
}: RansomProps) {
  let hash = seedOf(children)
  const roll = () => {
    hash = (Math.imul(hash, 0x01000193) ^ (hash >>> 13)) >>> 0
    return hash / 0x100000000
  }

  return (
    <Tag className={`ransom ${className}`} style={style} id={id} aria-label={children}>
      {children.split(/(\s+)/).map((word, w) => {
        if (!word.trim()) return <span key={w}> </span>
        return (
          <span className="ransom__word" key={w} aria-hidden="true">
            {[...word].map((ch, i) => (
              <span
                key={i}
                className={`ransom__cut ransom__cut--${Math.floor(roll() * CUTS)}`}
                style={
                  {
                    '--lean': `${(roll() - 0.5) * 2 * lean}deg`,
                    '--drop': `${(roll() - 0.5) * 0.14}em`,
                    // Uneven scissors: no two scraps are trimmed the same.
                    '--pad': `${0.04 + roll() * 0.07}em`,
                  } as CSSProperties
                }
              >
                {ch}
              </span>
            ))}
          </span>
        )
      })}
    </Tag>
  )
}
