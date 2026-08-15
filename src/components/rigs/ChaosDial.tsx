import { useCallback, useRef } from 'react'
import { usePortal, useRig } from '../../state/usePortal'
import './chaos-dial.css'

const MARKS = ['CALM', 'WARM', 'LOUD', 'FERAL', 'ELEVEN']

/** 0..1 -> the "0 to 11" face value. */
const toEleven = (v: number) => Math.round(v * 110) / 10

export function ChaosDial() {
  const { chaos, setChaos } = usePortal()
  const poke = useRig('CHAOS DIAL')
  const knob = useRef<HTMLDivElement>(null)
  const drag = useRef<{ y: number; x: number; from: number } | null>(null)

  const commit = useCallback(
    (next: number) => {
      setChaos(Math.min(1, Math.max(0, next)))
      poke()
    },
    [setChaos, poke],
  )

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    knob.current?.setPointerCapture(event.pointerId)
    drag.current = { y: event.clientY, x: event.clientX, from: chaos }
  }

  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const start = drag.current
    if (!start) return
    // Up and right both wind it up. 220px of travel covers the whole range.
    const delta = start.y - event.clientY + (event.clientX - start.x)
    commit(start.from + delta / 220)
  }

  const onPointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    if (knob.current?.hasPointerCapture(event.pointerId)) {
      knob.current.releasePointerCapture(event.pointerId)
    }
    drag.current = null
  }

  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const step = event.shiftKey ? 0.2 : 0.05
    const moves: Record<string, number> = {
      ArrowUp: step,
      ArrowRight: step,
      ArrowDown: -step,
      ArrowLeft: -step,
      PageUp: 0.25,
      PageDown: -0.25,
    }
    if (event.key in moves) {
      event.preventDefault()
      commit(chaos + moves[event.key])
    } else if (event.key === 'Home') {
      event.preventDefault()
      commit(0)
    } else if (event.key === 'End') {
      event.preventDefault()
      commit(1)
    }
  }

  const face = toEleven(chaos)
  const band = MARKS[Math.min(MARKS.length - 1, Math.floor(chaos * MARKS.length))]
  const angle = -135 + chaos * 270

  return (
    <div className="dial">
      <div
        className="dial__knob"
        ref={knob}
        role="slider"
        tabIndex={0}
        aria-label="Chaos level, zero to eleven"
        aria-valuemin={0}
        aria-valuemax={11}
        aria-valuenow={face}
        aria-valuetext={`${face.toFixed(1)} — ${band}`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onKeyDown={onKeyDown}
        onDoubleClick={() => commit(1)}
      >
        <svg className="dial__face" viewBox="0 0 140 140" aria-hidden="true">
          <circle className="dial__track" cx="70" cy="70" r="54" pathLength={100} />
          <circle
            className="dial__fill"
            cx="70"
            cy="70"
            r="54"
            pathLength={100}
            strokeDasharray={`${chaos * 75} 100`}
          />
          {Array.from({ length: 23 }, (_, i) => {
            const a = (-135 + (i / 22) * 270) * (Math.PI / 180)
            const long = i % 2 === 0
            const r1 = long ? 40 : 44
            return (
              <line
                key={i}
                className={`dial__tick${i === 22 ? ' dial__tick--max' : ''}`}
                x1={70 + Math.sin(a) * r1}
                y1={70 - Math.cos(a) * r1}
                x2={70 + Math.sin(a) * 48}
                y2={70 - Math.cos(a) * 48}
              />
            )
          })}
        </svg>
        <div className="dial__cap" style={{ transform: `rotate(${angle}deg)` }}>
          <span className="dial__needle" />
        </div>
        <span className="dial__grip" aria-hidden="true" />
      </div>

      <div className="dial__readout">
        <output className="dial__number">{face.toFixed(1)}</output>
        <span className="dial__band">{band}</span>
        <span className="dial__scale" aria-hidden="true">
          0 ————— 11
        </span>
        <p className="dial__note">
          Drag the knob, or arrow-key it. Double-click for eleven. Everything on this page —
          grain, glow, tilt, tempo, particle count — reads off this one number.
        </p>
      </div>
    </div>
  )
}
