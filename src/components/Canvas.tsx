import { useMemo } from 'react'
import { usePortal } from '../state/usePortal'
import './canvas.css'

/**
 * THE CANVAS — only ever drawn for the UNTITLED palette.
 *
 * This is not a wash laid over the dark site; it is a different surface. Raw
 * bone-white ground, packed edge to edge with oil-stick scrawl, and the two
 * figures out of the reference standing in it: the yellow head on the left,
 * the red one on the right, both grinning with grid teeth.
 *
 * The filter definitions live here regardless of palette, because the rest of
 * the site borrows `#oilstick` to draw its own frames and it has to exist
 * exactly once, above the routes.
 */

/** Deterministic noise so the canvas is the same painting on every load. */
function rng(seed: number) {
  let s = seed
  return () => {
    s = (s * 1103515245 + 12345) % 2147483648
    return s / 2147483648
  }
}

export function Canvas() {
  const { chaos, vibe } = usePortal()
  const on = vibe === 'basquiat'

  // Packed. The count climbs with the dial and starts high — a thin scrawl
  // reads as decoration, a dense one reads as a surface that got worked.
  const strokes = useMemo(() => {
    const r = rng(20260815)
    const n = Math.round(160 + chaos * 220)
    return Array.from({ length: n }, () => {
      const x = r() * 100
      const y = r() * 100
      const kind = Math.floor(r() * 9)
      return {
        x,
        y,
        kind,
        len: 3 + r() * 13,
        rot: r() * 360,
        tone: Math.floor(r() * 5),
        w: 2.5 + r() * 5,
      }
    })
  }, [chaos])

  const glyphs = useMemo(() => {
    const r = rng(773)
    const alphabet = 'AAARPKSEXO357©™+×'.split('')
    return Array.from({ length: Math.round(30 + chaos * 40) }, () => ({
      x: r() * 100,
      y: r() * 100,
      ch: alphabet[Math.floor(r() * alphabet.length)],
      size: 2 + r() * 4,
      rot: (r() - 0.5) * 40,
      tone: Math.floor(r() * 5),
    }))
  }, [chaos])

  return (
    <>
      <svg className="cv__defs" aria-hidden="true" focusable="false">
        <defs>
          <filter id="oilstick" x="-12%" y="-12%" width="124%" height="124%">
            <feTurbulence type="fractalNoise" baseFrequency="0.022 0.035" numOctaves="3" seed="7" result="n" />
            <feDisplacementMap in="SourceGraphic" in2="n" scale="7" xChannelSelector="R" yChannelSelector="G" />
          </filter>
          <filter id="oilstick-rough" x="-20%" y="-20%" width="140%" height="140%">
            <feTurbulence type="fractalNoise" baseFrequency="0.014 0.03" numOctaves="4" seed="19" result="n" />
            <feDisplacementMap in="SourceGraphic" in2="n" scale="13" xChannelSelector="R" yChannelSelector="G" />
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

      {on && (
        <div className="cv" aria-hidden="true">
          {/* the scrawl, everywhere */}
          <svg className="cv__scrawl" viewBox="0 0 100 100" preserveAspectRatio="none">
            <g filter="url(#oilstick-rough)">
              {strokes.map((s, i) => (
                <g key={i} className={`cv__mark cv__mark--${s.tone}`} strokeWidth={s.w}>
                  {s.kind === 0 && <path d={`M${s.x} ${s.y} L${s.x + s.len} ${s.y + s.len * 0.2}`} />}
                  {s.kind === 1 && (
                    <path d={`M${s.x} ${s.y} L${s.x + s.len} ${s.y} M${s.x + s.len / 2} ${s.y - s.len / 2} L${s.x + s.len / 2} ${s.y + s.len / 2}`} />
                  )}
                  {s.kind === 2 && (
                    <path d={`M${s.x} ${s.y} L${s.x + s.len} ${s.y + s.len} M${s.x + s.len} ${s.y} L${s.x} ${s.y + s.len}`} />
                  )}
                  {s.kind === 3 && (
                    <path d={`M${s.x} ${s.y} h${s.len} v${s.len * 0.6} h${-s.len} Z`} fill="none" />
                  )}
                  {s.kind === 4 && (
                    <path d={`M${s.x} ${s.y} q${s.len / 2} ${-s.len} ${s.len} 0`} fill="none" />
                  )}
                  {s.kind === 5 && (
                    <path d={`M${s.x} ${s.y} l${s.len * 0.5} ${-s.len * 0.5} l${s.len * 0.5} ${s.len * 0.5}`} fill="none" />
                  )}
                  {/* the triangle, which is everywhere in the references */}
                  {s.kind === 6 && (
                    <path
                      d={`M${s.x} ${s.y} l${s.len * 0.5} ${-s.len * 0.8} l${s.len * 0.5} ${s.len * 0.8} Z`}
                      fill="none"
                    />
                  )}
                  {/* a boxed grid — his diagrams and ledgers */}
                  {s.kind === 7 && (
                    <path
                      d={`M${s.x} ${s.y} h${s.len} v${s.len * 0.7} h${-s.len} Z M${s.x} ${s.y + s.len * 0.35} h${s.len} M${s.x + s.len / 2} ${s.y} v${s.len * 0.7}`}
                      fill="none"
                    />
                  )}
                  {/* an arrow */}
                  {s.kind === 8 && (
                    <path
                      d={`M${s.x} ${s.y} h${s.len} M${s.x + s.len} ${s.y} l${-s.len * 0.25} ${-s.len * 0.2} M${s.x + s.len} ${s.y} l${-s.len * 0.25} ${s.len * 0.2}`}
                      fill="none"
                    />
                  )}
                </g>
              ))}
            </g>
          </svg>

          {/* scattered characters — the references are littered with them */}
          <svg className="cv__glyphs" viewBox="0 0 100 100" preserveAspectRatio="none">
            {glyphs.map((g, i) => (
              <text
                key={i}
                className={`cv__glyph cv__mark--${g.tone}`}
                x={g.x}
                y={g.y}
                fontSize={g.size}
                transform={`rotate(${g.rot} ${g.x} ${g.y})`}
              >
                {g.ch}
              </text>
            ))}
          </svg>

          {/* ---- the figures ------------------------------------------- */}
          <svg className="cv__figure cv__figure--left" viewBox="0 0 300 620" aria-hidden="true">
            <g filter="url(#oilstick)">
              {/* yellow head */}
              <path className="cv__fill-y" d="M52 24 h190 v250 h-190 Z" />
              <path className="cv__ink" d="M52 24 h190 v250 h-190 Z" fill="none" strokeWidth="9" />
              {/* eyes */}
              <circle className="cv__ink" cx="108" cy="112" r="36" fill="none" strokeWidth="9" />
              <circle className="cv__fill-b" cx="108" cy="112" r="17" />
              <circle className="cv__ink" cx="196" cy="112" r="36" fill="none" strokeWidth="9" />
              <circle className="cv__fill-r" cx="196" cy="112" r="17" />
              {/* nose */}
              <circle className="cv__fill-r" cx="152" cy="176" r="15" />
              {/* grid teeth */}
              <path className="cv__fill-r" d="M76 206 h146 v46 h-146 Z" />
              <path
                className="cv__ink"
                d="M76 206 h146 v46 h-146 Z M100 206 v46 M124 206 v46 M148 206 v46 M172 206 v46 M196 206 v46 M76 229 h146"
                fill="none"
                strokeWidth="6"
              />
              {/* stick body + ribs */}
              <path className="cv__bone" d="M148 274 v120 M96 330 h108 M96 366 h108 M96 402 h108" fill="none" strokeWidth="12" />
              <path className="cv__bone" d="M148 394 l-58 96 M148 394 l58 96" fill="none" strokeWidth="12" />
              {/* drips */}
              <path className="cv__fill-b" d="M100 148 v70 M196 148 v54 M152 192 v58" strokeWidth="7" stroke="#1244c4" fill="none" />
            </g>
          </svg>

          <svg className="cv__figure cv__figure--right" viewBox="0 0 320 640" aria-hidden="true">
            <g filter="url(#oilstick)">
              {/* red body */}
              <path className="cv__fill-r" d="M74 250 h172 v300 h-172 Z" />
              <path className="cv__ink" d="M74 250 h172 v300 h-172 Z" fill="none" strokeWidth="9" />
              {/* arms out */}
              <path className="cv__ink" d="M74 300 L10 210 M246 300 L306 200" fill="none" strokeWidth="14" />
              {/* white head */}
              <circle className="cv__fill-w" cx="160" cy="140" r="118" />
              <circle className="cv__ink" cx="160" cy="140" r="118" fill="none" strokeWidth="10" />
              {/* huge eyes */}
              <circle className="cv__ink" cx="110" cy="112" r="40" fill="none" strokeWidth="10" />
              <circle className="cv__fill-b" cx="110" cy="112" r="15" />
              <circle className="cv__ink" cx="212" cy="112" r="40" fill="none" strokeWidth="10" />
              <circle className="cv__ink" cx="212" cy="112" r="15" />
              {/* grin with grid teeth */}
              <path className="cv__ink" d="M78 176 q82 84 164 0" fill="none" strokeWidth="10" />
              <path
                className="cv__ink"
                d="M104 200 v34 M132 214 v32 M160 220 v32 M188 214 v32 M216 200 v34"
                fill="none"
                strokeWidth="8"
              />
              {/* hair spikes */}
              <path className="cv__ink" d="M74 44 v-40 M106 28 v-44 M138 18 v-46 M170 18 v-46 M202 28 v-44 M234 44 v-40" fill="none" strokeWidth="9" />
              {/* drips off the chin */}
              <path className="cv__ink" d="M120 254 v70 M160 258 v96 M200 254 v64" fill="none" strokeWidth="7" />
              {/* legs */}
              <path className="cv__ink" d="M112 550 v66 M208 550 v66" fill="none" strokeWidth="14" />
            </g>
          </svg>

          {/* a third, smaller one — crowned, teeth bared, no body */}
          <svg className="cv__figure cv__figure--third" viewBox="0 0 240 300" aria-hidden="true">
            <g filter="url(#oilstick)">
              <path className="cv__fill-y" d="M40 78 h160 v170 h-160 Z" />
              <path className="cv__ink" d="M40 78 h160 v170 h-160 Z" fill="none" strokeWidth="8" />
              {/* crown, sat straight on the head */}
              <g className="cv__crown-on">
                <path
                  d="M46 74 L40 26 L82 52 L120 14 L158 52 L200 26 L194 74"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="9"
                  strokeLinejoin="round"
                  strokeLinecap="round"
                />
              </g>
              {/* eyes — one blown out, one crossed */}
              <circle className="cv__ink" cx="84" cy="126" r="26" fill="none" strokeWidth="8" />
              <circle className="cv__fill-b" cx="84" cy="126" r="11" />
              <path className="cv__ink" d="M136 104 L184 148 M184 104 L136 148" fill="none" strokeWidth="8" />
              {/* teeth */}
              <path className="cv__fill-w" d="M62 186 h116 v40 h-116 Z" />
              <path
                className="cv__ink"
                d="M62 186 h116 v40 h-116 Z M82 186 v40 M102 186 v40 M122 186 v40 M142 186 v40 M162 186 v40"
                fill="none"
                strokeWidth="6"
              />
              {/* neck */}
              <path className="cv__ink" d="M120 248 v46" fill="none" strokeWidth="12" />
            </g>
          </svg>

          {/* crossed-out words — the strike is what makes you read them */}
          <span className="cv__word cv__word--1">ORIGINAL</span>
          <span className="cv__word cv__word--2">NOTARY</span>
          <span className="cv__word cv__word--3">SAMO©</span>
          <span className="cv__word cv__word--4">TAR</span>
          <span className="cv__word cv__word--5">MILK</span>

          {/* crowns, loose on the canvas */}
          <svg className="cv__crown cv__crown--1" viewBox="0 0 100 62" aria-hidden="true">
            <use href="#crown" />
          </svg>
          <svg className="cv__crown cv__crown--2" viewBox="0 0 100 62" aria-hidden="true">
            <use href="#crown" />
          </svg>
        </div>
      )}
    </>
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
