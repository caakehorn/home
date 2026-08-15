import type { ReactNode } from 'react'
import './rig.css'

type RigProps = {
  index: number
  title: string
  kana: string
  hint: string
  accent: 1 | 2 | 3 | 4 | 5
  wide?: boolean
  children: ReactNode
}

/**
 * The chrome every interactive element sits in: a numbered, taped-down
 * control panel. Keeps six very different toys reading as one console.
 */
export function Rig({ index, title, kana, hint, accent, wide, children }: RigProps) {
  return (
    <section
      className={`rig${wide ? ' rig--wide' : ''}`}
      style={{ ['--glow' as string]: `var(--n${accent})` }}
      aria-labelledby={`rig-${index}-title`}
    >
      <span className="rig__tape rig__tape--tl" aria-hidden="true" />
      <span className="rig__tape rig__tape--br" aria-hidden="true" />

      <header className="rig__head">
        <span className="rig__index" aria-hidden="true">
          {String(index).padStart(2, '0')}
        </span>
        <div className="rig__titles">
          <h2 className="rig__title" id={`rig-${index}-title`}>
            {title}
          </h2>
          <span className="rig__kana jp" aria-hidden="true">
            {kana}
          </span>
        </div>
        <p className="rig__hint">{hint}</p>
      </header>

      <div className="rig__body">{children}</div>

      <div className="rig__foot" aria-hidden="true">
        <span className="rig__bolt" />
        <span className="rig__stripes" />
        <span className="rig__bolt" />
      </div>
    </section>
  )
}
