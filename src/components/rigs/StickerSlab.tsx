import { useCallback, useEffect, useRef, useState } from 'react'
import { useRig } from '../../state/usePortal'
import './sticker-slab.css'

type Sticker = {
  id: number
  label: string
  kana?: string
  tone: 1 | 2 | 3 | 4 | 5
  shape: 'slab' | 'round' | 'flag'
}

const STICKERS: Sticker[] = [
  { id: 1, label: 'OPEN', kana: '開', tone: 2, shape: 'slab' },
  { id: 2, label: '4AM', tone: 3, shape: 'round' },
  { id: 3, label: 'CITE IT', kana: '出典', tone: 1, shape: 'flag' },
  { id: 4, label: 'NO REFUNDS', tone: 5, shape: 'slab' },
  { id: 5, label: '薬窟', tone: 4, shape: 'round' },
  { id: 6, label: 'BUILT LOUD', tone: 3, shape: 'flag' },
  { id: 7, label: 'Q.E.D.', tone: 2, shape: 'round' },
  { id: 8, label: 'BETA 4EVER', tone: 1, shape: 'slab' },
]

type Body = { x: number; y: number; vx: number; vy: number; rot: number; vr: number }

const rand = (min: number, max: number) => min + Math.random() * (max - min)

export function StickerSlab() {
  const poke = useRig('STICKER SLAB')
  const board = useRef<HTMLDivElement>(null)
  const nodes = useRef(new Map<number, HTMLButtonElement>())
  const bodies = useRef(new Map<number, Body>())
  const dragging = useRef<{ id: number; dx: number; dy: number; px: number; py: number } | null>(null)
  const [peeled, setPeeled] = useState<string | null>(null)

  const scatter = useCallback(() => {
    const rect = board.current?.getBoundingClientRect()
    if (!rect) return
    for (const sticker of STICKERS) {
      const node = nodes.current.get(sticker.id)
      const w = node?.offsetWidth ?? 90
      const h = node?.offsetHeight ?? 44
      bodies.current.set(sticker.id, {
        x: rand(0, Math.max(1, rect.width - w)),
        y: rand(0, Math.max(1, rect.height - h)),
        vx: rand(-9, 9),
        vy: rand(-9, 9),
        rot: rand(-22, 22),
        vr: rand(-3, 3),
      })
    }
  }, [])

  const stack = useCallback(() => {
    const rect = board.current?.getBoundingClientRect()
    if (!rect) return
    STICKERS.forEach((sticker, i) => {
      const node = nodes.current.get(sticker.id)
      const w = node?.offsetWidth ?? 90
      const h = node?.offsetHeight ?? 44
      bodies.current.set(sticker.id, {
        x: rect.width / 2 - w / 2 + (i - STICKERS.length / 2) * 5,
        y: rect.height / 2 - h / 2 + (i - STICKERS.length / 2) * 7,
        vx: 0,
        vy: 0,
        rot: (i - STICKERS.length / 2) * 3.5,
        vr: 0,
      })
    })
  }, [])

  // physics + paint
  useEffect(() => {
    scatter()
    let raf = 0
    const step = () => {
      raf = requestAnimationFrame(step)
      const rect = board.current?.getBoundingClientRect()
      if (!rect) return

      for (const [id, body] of bodies.current) {
        const node = nodes.current.get(id)
        if (!node) continue
        const w = node.offsetWidth
        const h = node.offsetHeight
        const held = dragging.current?.id === id

        if (!held) {
          body.x += body.vx
          body.y += body.vy
          body.rot += body.vr
          body.vx *= 0.94
          body.vy *= 0.94
          body.vr *= 0.92

          const maxX = Math.max(0, rect.width - w)
          const maxY = Math.max(0, rect.height - h)
          if (body.x < 0) {
            body.x = 0
            body.vx = Math.abs(body.vx) * 0.7
            body.vr += rand(-2, 2)
          } else if (body.x > maxX) {
            body.x = maxX
            body.vx = -Math.abs(body.vx) * 0.7
            body.vr += rand(-2, 2)
          }
          if (body.y < 0) {
            body.y = 0
            body.vy = Math.abs(body.vy) * 0.7
            body.vr += rand(-2, 2)
          } else if (body.y > maxY) {
            body.y = maxY
            body.vy = -Math.abs(body.vy) * 0.7
            body.vr += rand(-2, 2)
          }
        }

        node.style.transform = `translate3d(${body.x}px, ${body.y}px, 0) rotate(${body.rot}deg)`
        node.style.zIndex = held ? '20' : '1'
      }
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [scatter])

  const onPointerDown = (event: React.PointerEvent<HTMLButtonElement>, id: number) => {
    const rect = board.current?.getBoundingClientRect()
    const body = bodies.current.get(id)
    if (!rect || !body) return
    event.currentTarget.setPointerCapture(event.pointerId)
    dragging.current = {
      id,
      dx: event.clientX - rect.left - body.x,
      dy: event.clientY - rect.top - body.y,
      px: event.clientX,
      py: event.clientY,
    }
    body.vx = 0
    body.vy = 0
    body.vr = 0
  }

  const onPointerMove = (event: React.PointerEvent<HTMLButtonElement>) => {
    const drag = dragging.current
    const rect = board.current?.getBoundingClientRect()
    if (!drag || !rect) return
    const body = bodies.current.get(drag.id)
    if (!body) return
    body.x = event.clientX - rect.left - drag.dx
    body.y = event.clientY - rect.top - drag.dy
    // carry the throw
    body.vx = (event.clientX - drag.px) * 0.9
    body.vy = (event.clientY - drag.py) * 0.9
    body.vr = (event.clientX - drag.px) * 0.25
    drag.px = event.clientX
    drag.py = event.clientY
  }

  const onPointerUp = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
    dragging.current = null
  }

  return (
    <div className="slab">
      <div className="slab__board" ref={board}>
        <span className="slab__grid" aria-hidden="true" />
        {STICKERS.map((sticker) => (
          <button
            key={sticker.id}
            type="button"
            ref={(node) => {
              if (node) nodes.current.set(sticker.id, node)
              else nodes.current.delete(sticker.id)
            }}
            className={`slab__sticker slab__sticker--${sticker.shape}`}
            style={{ ['--tone' as string]: `var(--n${sticker.tone})` }}
            onPointerDown={(e) => onPointerDown(e, sticker.id)}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            onClick={() => {
              setPeeled(sticker.label)
              poke()
            }}
          >
            {sticker.kana && (
              <span className="slab__kana jp" aria-hidden="true">
                {sticker.kana}
              </span>
            )}
            <span className="slab__label">{sticker.label}</span>
          </button>
        ))}
      </div>

      <div className="slab__controls">
        <button
          type="button"
          className="slab__btn"
          onClick={() => {
            scatter()
            poke()
          }}
        >
          SCATTER
        </button>
        <button
          type="button"
          className="slab__btn"
          onClick={() => {
            stack()
            poke()
          }}
        >
          STACK
        </button>
        <span className="slab__status" aria-live="polite">
          {peeled ? `PEELED: ${peeled}` : 'DRAG · FLING · BOUNCE'}
        </span>
      </div>
    </div>
  )
}
