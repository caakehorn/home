import { useEffect, useRef, useState } from 'react'
import { usePortal, useRig } from '../../state/usePortal'
import './scry-pool.css'

type Mode = 'flow' | 'orbit' | 'shatter'

const MODES: { id: Mode; label: string; kana: string }[] = [
  { id: 'flow', label: 'FLOW', kana: '流' },
  { id: 'orbit', label: 'ORBIT', kana: '環' },
  { id: 'shatter', label: 'SHATTER', kana: '砕' },
]

type Particle = { x: number; y: number; vx: number; vy: number; tone: number; age: number }

const readPalette = () => {
  const styles = getComputedStyle(document.documentElement)
  return ['--n1', '--n2', '--n3', '--n4', '--n5'].map((token) =>
    styles.getPropertyValue(token).trim() || '#ffffff',
  )
}

export function ScryPool() {
  const { vibe, chaos } = usePortal()
  const poke = useRig('SCRY POOL')
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [mode, setMode] = useState<Mode>('flow')

  // Live values the animation loop reads without being torn down and rebuilt.
  const modeRef = useRef(mode)
  const chaosRef = useRef(chaos)
  const paletteRef = useRef<string[]>([])
  const pointerRef = useRef({ x: -1e5, y: -1e5, down: false })
  const shocksRef = useRef<{ x: number; y: number; r: number }[]>([])

  modeRef.current = mode
  chaosRef.current = chaos

  useEffect(() => {
    paletteRef.current = readPalette()
  }, [vibe])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d', { alpha: false })
    if (!ctx) return

    paletteRef.current = readPalette()
    const calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    let width = 0
    let height = 0
    let raf = 0
    let t = 0
    const particles: Particle[] = []

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      const rect = canvas.getBoundingClientRect()
      width = Math.max(1, Math.round(rect.width))
      height = Math.max(1, Math.round(rect.height))
      canvas.width = Math.round(width * dpr)
      canvas.height = Math.round(height * dpr)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.fillStyle = '#000'
      ctx.fillRect(0, 0, width, height)
    }

    const observer = new ResizeObserver(resize)
    observer.observe(canvas)
    resize()

    const spawn = (): Particle => ({
      x: Math.random() * width,
      y: Math.random() * height,
      vx: 0,
      vy: 0,
      tone: Math.floor(Math.random() * 5),
      age: Math.random() * 260,
    })

    const frame = () => {
      raf = requestAnimationFrame(frame)
      const c = chaosRef.current
      const target = calm ? 90 : Math.round(140 + c * 420)
      while (particles.length < target) particles.push(spawn())
      if (particles.length > target) particles.length = target

      t += calm ? 0.0016 : 0.003 + c * 0.008

      // Fade the previous frame instead of clearing: that is the trail.
      ctx.globalCompositeOperation = 'source-over'
      ctx.fillStyle = `rgba(2, 0, 8, ${0.16 - c * 0.09})`
      ctx.fillRect(0, 0, width, height)

      ctx.globalCompositeOperation = 'lighter'
      const palette = paletteRef.current
      const pointer = pointerRef.current
      const m = modeRef.current
      const speed = 0.6 + c * 2.4
      const scale = 0.0032 + c * 0.004

      for (const p of particles) {
        const angle =
          Math.sin(p.x * scale + t) * Math.cos(p.y * scale - t * 0.7) * Math.PI * 2 + t * 2
        p.vx += Math.cos(angle) * 0.16
        p.vy += Math.sin(angle) * 0.16

        const dx = pointer.x - p.x
        const dy = pointer.y - p.y
        const d2 = dx * dx + dy * dy
        const reach = 190 * 190
        if (d2 < reach && d2 > 1) {
          const d = Math.sqrt(d2)
          const pull = (1 - d / 190) * (pointer.down ? 2.4 : 1)
          if (m === 'flow') {
            p.vx += (dx / d) * pull * 0.9
            p.vy += (dy / d) * pull * 0.9
          } else if (m === 'orbit') {
            p.vx += (-dy / d) * pull * 1.5
            p.vy += (dx / d) * pull * 1.5
            p.vx += (dx / d) * pull * 0.2
            p.vy += (dy / d) * pull * 0.2
          } else {
            p.vx -= (dx / d) * pull * 2.2
            p.vy -= (dy / d) * pull * 2.2
          }
        }

        for (const shock of shocksRef.current) {
          const sx = p.x - shock.x
          const sy = p.y - shock.y
          const sd = Math.hypot(sx, sy) || 1
          const band = Math.abs(sd - shock.r)
          if (band < 46) {
            const push = (1 - band / 46) * 3.6
            p.vx += (sx / sd) * push
            p.vy += (sy / sd) * push
          }
        }

        p.vx *= 0.94
        p.vy *= 0.94
        const x0 = p.x
        const y0 = p.y
        p.x += p.vx * speed
        p.y += p.vy * speed
        p.age += 1

        // Wrapping teleports the particle, so the trail segment for that one
        // frame has to be dropped or it draws a line clean across the canvas.
        let wrapped = false
        if (p.x < -20) {
          p.x = width + 20
          wrapped = true
        } else if (p.x > width + 20) {
          p.x = -20
          wrapped = true
        }
        if (p.y < -20) {
          p.y = height + 20
          wrapped = true
        } else if (p.y > height + 20) {
          p.y = -20
          wrapped = true
        }
        if (p.age > 900) {
          Object.assign(p, spawn())
          wrapped = true
        }
        if (wrapped) continue

        ctx.strokeStyle = palette[p.tone] ?? '#fff'
        ctx.lineWidth = 1 + c * 1.6
        ctx.beginPath()
        ctx.moveTo(x0, y0)
        ctx.lineTo(p.x, p.y)
        ctx.stroke()
      }

      shocksRef.current = shocksRef.current
        .map((s) => ({ ...s, r: s.r + 9 }))
        .filter((s) => s.r < Math.hypot(width, height))

      if (shocksRef.current.length) {
        ctx.lineWidth = 2
        for (const shock of shocksRef.current) {
          ctx.strokeStyle = palette[2] ?? '#fff'
          ctx.globalAlpha = Math.max(0, 1 - shock.r / Math.hypot(width, height))
          ctx.beginPath()
          ctx.arc(shock.x, shock.y, shock.r, 0, Math.PI * 2)
          ctx.stroke()
        }
        ctx.globalAlpha = 1
      }
    }

    raf = requestAnimationFrame(frame)
    return () => {
      cancelAnimationFrame(raf)
      observer.disconnect()
    }
  }, [])

  const track = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = event.currentTarget.getBoundingClientRect()
    pointerRef.current.x = event.clientX - rect.left
    pointerRef.current.y = event.clientY - rect.top
  }

  return (
    <div className="scry">
      <canvas
        ref={canvasRef}
        className="scry__canvas"
        aria-label="Interactive particle field. Move the pointer to steer it, click to send a shockwave."
        role="img"
        onPointerMove={track}
        onPointerDown={(event) => {
          track(event)
          pointerRef.current.down = true
          shocksRef.current.push({ ...pointerRef.current, r: 4 })
          poke()
        }}
        onPointerUp={() => {
          pointerRef.current.down = false
        }}
        onPointerLeave={() => {
          pointerRef.current.x = -1e5
          pointerRef.current.y = -1e5
          pointerRef.current.down = false
        }}
      />
      <div className="scry__controls">
        <div className="scry__modes" role="group" aria-label="Field behaviour">
          {MODES.map((option) => (
            <button
              key={option.id}
              type="button"
              className={`scry__mode${mode === option.id ? ' scry__mode--on' : ''}`}
              aria-pressed={mode === option.id}
              onClick={() => {
                setMode(option.id)
                poke()
              }}
            >
              <span className="jp" aria-hidden="true">
                {option.kana}
              </span>
              {option.label}
            </button>
          ))}
        </div>
        <p className="scry__note">
          A LEVIATHAN offcut. Steer with the pointer, click for a shockwave. Density and speed
          are wired to the chaos dial.
        </p>
      </div>
    </div>
  )
}
