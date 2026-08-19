import './crown.css'

/**
 * THE CROWN — the mark, and the filter that draws it.
 *
 * `<CrownDefs>` mounts once above the routes, because the crown symbol and the
 * `#oilstick` filter are referenced by `url(#…)` from CSS and have to exist
 * exactly once in the document.
 */
export function CrownDefs() {
  return (
    <svg className="crown__defs" aria-hidden="true" focusable="false">
      <defs>
        <filter id="oilstick" x="-12%" y="-12%" width="124%" height="124%">
          <feTurbulence type="fractalNoise" baseFrequency="0.022 0.035" numOctaves="3" seed="7" result="n" />
          <feDisplacementMap in="SourceGraphic" in2="n" scale="7" xChannelSelector="R" yChannelSelector="G" />
        </filter>
        <symbol id="crown" viewBox="0 0 100 62">
          <path
            d="M6 58 L2 12 L26 34 L50 4 L74 34 L98 12 L94 58 Z"
            fill="none"
            stroke="currentColor"
            strokeWidth="7"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        </symbol>
      </defs>
    </svg>
  )
}

/** A crown, for anything that deserves one. */
export function Crown({ className = '' }: { className?: string }) {
  return (
    <svg className={`crown ${className}`} aria-hidden="true" viewBox="0 0 100 62">
      <use href="#crown" />
    </svg>
  )
}
