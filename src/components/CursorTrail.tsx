import { useEffect, useRef } from 'react'
import { usePortal } from '../state/usePortal'

type Dot = { x: number; y: number; life: number; tone: number }

/**
 * A neon comet that follows the pointer. Fine pointers only — on touch it
 * would just be a smear behind your thumb.
 */
export function CursorTrail() {
  const { vibe, chaos, motion } = usePortal()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const chaosRef = useRef(chaos)
  const paletteRef = useRef<string[]>([])
  chaosRef.current = chaos

  useEffect(() => {
    const styles = getComputedStyle(document.documentElement)
    paletteRef.current = ['--n1', '--n2', '--n3', '--n5'].map(
      (token) => styles.getPropertyValue(token).trim() || '#fff',
    )
  }, [vibe])

  useEffect(() => {
    const fine = window.matchMedia('(hover: hover) and (pointer: fine)').matches
    const canvas = canvasRef.current
    if (!fine || !motion || !canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let raf = 0
    let tone = 0
    const dots: Dot[] = []
    const dpr = Math.min(window.devicePixelRatio || 1, 2)

    const resize = () => {
      canvas.width = Math.round(window.innerWidth * dpr)
      canvas.height = Math.round(window.innerHeight * dpr)
      canvas.style.width = `${window.innerWidth}px`
      canvas.style.height = `${window.innerHeight}px`
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    resize()
    window.addEventListener('resize', resize)

    const onMove = (event: PointerEvent) => {
      tone = (tone + 1) % 4
      dots.push({ x: event.clientX, y: event.clientY, life: 1, tone })
      if (dots.length > 90) dots.shift()
    }
    window.addEventListener('pointermove', onMove, { passive: true })

    const frame = () => {
      raf = requestAnimationFrame(frame)
      ctx.clearRect(0, 0, window.innerWidth, window.innerHeight)
      const c = chaosRef.current
      ctx.globalCompositeOperation = 'lighter'
      for (let i = dots.length - 1; i >= 0; i--) {
        const dot = dots[i]
        dot.life -= 0.045
        if (dot.life <= 0) {
          dots.splice(i, 1)
          continue
        }
        ctx.globalAlpha = dot.life * (0.35 + c * 0.5)
        ctx.fillStyle = paletteRef.current[dot.tone] ?? '#fff'
        ctx.beginPath()
        ctx.arc(dot.x, dot.y, dot.life * (5 + c * 16), 0, Math.PI * 2)
        ctx.fill()
      }
      ctx.globalAlpha = 1
    }
    raf = requestAnimationFrame(frame)

    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', resize)
      window.removeEventListener('pointermove', onMove)
    }
  }, [motion])

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      style={{
        position: 'fixed',
        inset: 0,
        pointerEvents: 'none',
        zIndex: 9500,
        mixBlendMode: 'screen',
      }}
    />
  )
}
