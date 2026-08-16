import type { CSSProperties } from 'react'
import { Crown } from './Canvas'

const SPARKS = [
  { top: '-14%', left: '-5%', s: '26px', color: '#ffd400', delay: '0s' },
  { top: '4%', left: '101%', s: '20px', color: '#21d4ee', delay: '-0.7s' },
  { top: '74%', left: '-8%', s: '16px', color: '#ff2e6b', delay: '-1.3s' },
  { top: '88%', left: '96%', s: '22px', color: '#a855f7', delay: '-1.9s' },
  { top: '-20%', left: '58%', s: '14px', color: '#fff', delay: '-0.4s' },
]

type WordmarkProps = {
  /** Rendered twice — once as the black shell, once as the rainbow face. */
  text: string
  /** Katakana line under the logo, as in the reference. */
  kana?: string
  size?: string
  sparks?: boolean
  className?: string
  style?: CSSProperties
}

export function Wordmark({
  text,
  kana,
  size = 'var(--step-4)',
  sparks = true,
  className = '',
  style,
}: WordmarkProps) {
  return (
    <span className={`wordmark-set ${className}`} style={{ fontSize: size, ...style }}>
      <span className="wordmark" role="img" aria-label={text}>
        <span className="wordmark__shell" aria-hidden="true">
          {text}
        </span>
        <span className="wordmark__face" aria-hidden="true">
          {text}
        </span>
      </span>
      {sparks &&
        SPARKS.map((spark, i) => (
          <span
            key={i}
            className="wordmark-set__spark"
            aria-hidden="true"
            style={
              {
                top: spark.top,
                left: spark.left,
                '--s': spark.s,
                '--spark-color': spark.color,
                '--delay': spark.delay,
              } as CSSProperties
            }
          />
        ))}
      {kana && (
        <span className="wordmark-set__kana jp" aria-hidden="true">
          {kana}
        </span>
      )}
    </span>
  )
}

type SubHeadProps = {
  children: string
  /**
   * The block of colour behind the words. It was the additive R/G/B bloom of
   * reference #2; it is now a slab of paint on raw canvas and a hard block of
   * spot red everywhere else — same element, doing the job the bloom was
   * pretending to do.
   */
  venn?: boolean
  /** A crown, for the headings that earn one. Drawn only where it belongs. */
  crown?: boolean
  size?: string
  className?: string
  id?: string
}

export function SubHead({
  children,
  venn = true,
  crown = false,
  size,
  className = '',
  id,
}: SubHeadProps) {
  return (
    <span
      className={`subhead-set${crown ? ' crowned' : ''} ${className}`}
      style={size ? { fontSize: size } : undefined}
    >
      {venn && (
        <span className="subhead-set__venn" aria-hidden="true">
          <span className="subhead-set__lobe" />
          <span className="subhead-set__lobe" />
          <span className="subhead-set__lobe" />
        </span>
      )}
      <span className="subhead" id={id}>
        {children}
      </span>
      {crown && <Crown />}
    </span>
  )
}
