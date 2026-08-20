import { useCallback, useEffect, useRef, useState } from 'react'
import { Payout, Screen } from '../Screen'
import { ALU08_CLOSER, DROPS, cabById, type Drop } from '../content'
import { ticketsFor, useArcade } from '../state'

const CAB = cabById('alu-08')!

/* The board is drawn at a fixed logical size and scaled to fit, so the game
   plays identically on a phone and a 4K monitor and nothing has to be
   recomputed when the window moves. */
const W = 960
const H = 620
const ROUND = 60 // seconds

type Falling = {
  drop: Drop
  x: number
  y: number
  vy: number
  spin: number
  w: number
  dead: boolean
}

type Toast = { text: string; life: number }

type Board = {
  x: number
  target: number
  score: number
  lives: number
  combo: number
  time: number
  items: Falling[]
  toasts: Toast[]
  spawn: number
  shake: number
  caught: number
}

const SCENE = DROPS.filter((d) => d.kind === 'scene')
const RARE = DROPS.filter((d) => d.kind === 'rare')
const BRAND = DROPS.filter((d) => d.kind === 'brand')
const DAN = DROPS.find((d) => d.kind === 'dan')!

const pick = <T,>(xs: T[]) => xs[(Math.random() * xs.length) | 0]

const INK = {
  scene: '#ff2bd6',
  rare: '#ffd400',
  brand: '#5e5a6b',
  dan: '#00eaff',
} as const

export function Alu08() {
  const { bank } = useArcade()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [phase, setPhase] = useState<'ready' | 'live' | 'over'>('ready')
  const [result, setResult] = useState({ score: 0, won: 0 })
  // The board lives in a ref so the loop does not re-render the cabinet sixty
  // times a second; the HUD is the one thing that has to reach React, so it
  // gets its own low-rate snapshot instead of reading the ref mid-render.
  const [hud, setHud] = useState({ score: 0, lives: 3, time: ROUND })

  // Everything the loop mutates sixty times a second lives in a ref: React
  // state here would re-render the whole cabinet on every frame.
  const game = useRef<Board>({
    x: W / 2,
    target: W / 2,
    score: 0,
    lives: 3,
    combo: 0,
    time: ROUND,
    items: [] as Falling[],
    toasts: [] as Toast[],
    spawn: 0,
    shake: 0,
    caught: 0,
  })

  const reset = useCallback(() => {
    game.current = {
      x: W / 2, target: W / 2, score: 0, lives: 3, combo: 0, time: ROUND,
      items: [], toasts: [], spawn: 0, shake: 0, caught: 0,
    }
  }, [])

  const start = useCallback(() => {
    reset()
    setPhase('live')
  }, [reset])

  /* ---- input ---------------------------------------------------------- */
  useEffect(() => {
    const held = new Set<string>()
    const down = (e: KeyboardEvent) => {
      if (['ArrowLeft', 'ArrowRight', 'a', 'd', 'A', 'D', ' '].includes(e.key)) e.preventDefault()
      if (e.key === ' ' && phase !== 'live') start()
      held.add(e.key)
    }
    const up = (e: KeyboardEvent) => held.delete(e.key)
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)

    let raf = 0
    const drive = () => {
      const g = game.current
      const left = held.has('ArrowLeft') || held.has('a') || held.has('A')
      const right = held.has('ArrowRight') || held.has('d') || held.has('D')
      if (left) g.target -= 16
      if (right) g.target += 16
      g.target = Math.max(60, Math.min(W - 60, g.target))
      raf = requestAnimationFrame(drive)
    }
    raf = requestAnimationFrame(drive)

    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
      cancelAnimationFrame(raf)
    }
  }, [phase, start])

  const aim = useCallback((clientX: number) => {
    const el = canvasRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    game.current.target = Math.max(60, Math.min(W - 60, ((clientX - r.left) / r.width) * W))
  }, [])

  /* ---- the loop ------------------------------------------------------- */
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const fit = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1)
      canvas.width = W * dpr
      canvas.height = H * dpr
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    fit()
    window.addEventListener('resize', fit)

    let raf = 0
    let last = performance.now()
    let t = 0
    let hudAt = 0

    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      t += dt
      const g = game.current

      if (phase === 'live' && now - hudAt > 120) {
        hudAt = now
        setHud({ score: Math.round(g.score), lives: Math.max(0, g.lives), time: Math.max(0, g.time) })
      }

      if (phase === 'live') {
        g.time -= dt
        g.x += (g.target - g.x) * Math.min(1, dt * 14)

        // difficulty ramps with the clock, not the score: the last ten seconds
        // are always the loud ones.
        const pressure = 1 - g.time / ROUND
        g.spawn -= dt
        if (g.spawn <= 0) {
          g.spawn = 0.62 - 0.34 * pressure
          const roll = Math.random()
          const drop =
            roll < 0.07 ? DAN : roll < 0.2 ? pick(RARE) : roll < 0.2 + 0.52 ? pick(SCENE) : pick(BRAND)
          ctx.font = '700 22px "Space Mono", monospace'
          const w = ctx.measureText(drop.label).width + 36
          g.items.push({
            drop,
            x: 40 + Math.random() * (W - 80 - w) + w / 2,
            y: -40,
            vy: 130 + Math.random() * 70 + 180 * pressure,
            spin: (Math.random() - 0.5) * 0.5,
            w,
            dead: false,
          })
        }

        for (const it of g.items) {
          it.y += it.vy * dt
          if (it.dead) continue
          // the basket is the arms, not the whole sprite
          if (it.y > H - 118 && it.y < H - 40 && Math.abs(it.x - g.x) < it.w / 2 + 54) {
            it.dead = true
            g.caught += 1
            if (it.drop.kind === 'brand') {
              g.lives -= 1
              g.combo = 0
              g.shake = 1
              g.score = Math.max(0, g.score + it.drop.points)
              g.toasts.push({ text: `${it.drop.label} — that is not the internet you liked`, life: 2.4 })
            } else {
              g.combo += 1
              const mult = 1 + Math.min(4, Math.floor(g.combo / 5))
              g.score += it.drop.points * mult
              if (it.drop.toast) g.toasts.push({ text: it.drop.toast, life: 3.4 })
              else if (g.combo > 0 && g.combo % 5 === 0)
                g.toasts.push({ text: `×${mult} — ${g.combo} in a row`, life: 1.6 })
            }
          }
          if (it.y > H + 60) {
            it.dead = true
            // letting the scene fall past you is not punished; letting a brand
            // fall past you is the correct play.
            if (it.drop.kind === 'scene' || it.drop.kind === 'rare') g.combo = 0
          }
        }
        g.items = g.items.filter((it) => !it.dead && it.y < H + 60)

        for (const toast of g.toasts) toast.life -= dt
        g.toasts = g.toasts.filter((x) => x.life > 0).slice(-3)
        g.shake = Math.max(0, g.shake - dt * 3)

        if (g.time <= 0 || g.lives <= 0) {
          const score = Math.round(g.score)
          const tix = ticketsFor(score)
          const won = bank(CAB.id, score, tix)
          setResult({ score, won })
          setPhase('over')
        }
      }

      draw(ctx, game.current, t, phase)
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)

    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', fit)
    }
  }, [phase, bank])

  return (
    <Screen
      cab={CAB}
      hud={
        phase === 'live' ? (
          <>
            <b>{hud.score.toLocaleString()}</b> SCENE PTS · {'♥'.repeat(hud.lives)}
            <span className="arc-cab__hud-clock"> {Math.ceil(hud.time)}s</span>
          </>
        ) : (
          <>ALU ’08 · 60 SECONDS</>
        )
      }
    >
      <canvas
        ref={canvasRef}
        className="arc-board"
        style={{ aspectRatio: `${W} / ${H}` }}
        onPointerMove={(e) => aim(e.clientX)}
        onPointerDown={(e) => {
          aim(e.clientX)
          if (phase !== 'live') start()
        }}
      />

      {phase === 'ready' && (
        <div className="arc-lid">
          <p className="arc-lid__kicker">CABINET I</p>
          <h3 className="arc-lid__title">ALU ’08</h3>
          <p className="arc-lid__body">
            You are ALU and the year is 2008 — the year you nominated, unprompted and in writing,
            as your own peak. Everything good about that internet is falling out of the sky, and so
            is everything that came along afterwards and ate it.
          </p>
          <p className="arc-lid__body arc-lid__body--dim">
            Catch the scene. Let the marketing hit the floor. Three hearts, sixty seconds, and one
            hundred points is one ticket.
          </p>
          <button type="button" className="arc-btn arc-btn--hot" onClick={start}>
            PRESS START
          </button>
        </div>
      )}

      {phase === 'over' && (
        <div className="arc-lid">
          <Payout
            score={result.score}
            unit="SCENE PTS"
            won={result.won}
            note={ALU08_CLOSER}
            onAgain={start}
          />
        </div>
      )}
    </Screen>
  )
}

/* ==========================================================================
   THE RENDER
   ========================================================================== */

function draw(ctx: CanvasRenderingContext2D, g: Board, t: number, phase: string) {
  ctx.save()
  if (g.shake > 0) {
    ctx.translate((Math.random() - 0.5) * 10 * g.shake, (Math.random() - 0.5) * 10 * g.shake)
  }

  // ---- the room -------------------------------------------------------
  const sky = ctx.createLinearGradient(0, 0, 0, H)
  sky.addColorStop(0, '#12001f')
  sky.addColorStop(0.55, '#1d0330')
  sky.addColorStop(1, '#26063d')
  ctx.fillStyle = sky
  ctx.fillRect(0, 0, W, H)

  // stars
  ctx.fillStyle = 'rgba(255,255,255,0.5)'
  for (let i = 0; i < 60; i++) {
    const x = ((i * 137.5) % W)
    const y = ((i * 71.3) % (H * 0.7))
    const tw = 0.4 + 0.6 * Math.abs(Math.sin(t * 1.4 + i))
    ctx.globalAlpha = tw * 0.6
    ctx.fillRect(x, y, 2, 2)
  }
  ctx.globalAlpha = 1

  // perspective floor
  ctx.strokeStyle = 'rgba(255,43,214,0.30)'
  ctx.lineWidth = 2
  const horizon = H - 150
  for (let i = 0; i <= 16; i++) {
    const x = (i / 16) * W
    ctx.beginPath()
    ctx.moveTo(W / 2 + (x - W / 2) * 0.18, horizon)
    ctx.lineTo(x * 1.6 - W * 0.3, H)
    ctx.stroke()
  }
  for (let i = 1; i <= 8; i++) {
    const y = horizon + Math.pow(i / 8, 2.1) * 150
    ctx.globalAlpha = 0.25 + (i / 8) * 0.4
    ctx.beginPath()
    ctx.moveTo(0, y)
    ctx.lineTo(W, y)
    ctx.stroke()
  }
  ctx.globalAlpha = 1

  // ---- falling chips ---------------------------------------------------
  ctx.font = '700 22px "Space Mono", monospace'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  for (const it of g.items) {
    const ink = INK[it.drop.kind as keyof typeof INK]
    ctx.save()
    ctx.translate(it.x, it.y)
    ctx.rotate(Math.sin(t * 2 + it.x) * 0.05 + it.spin * 0.4)
    const w = it.w
    const h = 44
    ctx.shadowColor = ink
    ctx.shadowBlur = it.drop.kind === 'brand' ? 0 : 18
    ctx.fillStyle = it.drop.kind === 'brand' ? '#0d0b12' : ink
    ctx.fillRect(-w / 2, -h / 2, w, h)
    ctx.shadowBlur = 0
    ctx.lineWidth = 3
    ctx.strokeStyle = it.drop.kind === 'brand' ? '#6d6880' : '#000'
    ctx.strokeRect(-w / 2, -h / 2, w, h)
    ctx.fillStyle = it.drop.kind === 'brand' ? '#8b8699' : '#0b0a09'
    ctx.fillText(it.drop.label, 0, 1)
    ctx.restore()
  }

  // ---- ALU -------------------------------------------------------------
  if (phase === 'live') drawAlu(ctx, g.x, H - 96, t)

  // ---- toasts ----------------------------------------------------------
  ctx.textAlign = 'center'
  g.toasts.forEach((toast, i) => {
    const a = Math.min(1, toast.life)
    ctx.globalAlpha = a
    ctx.font = '400 17px "Space Mono", monospace'
    const y = 64 + i * 30
    const w = ctx.measureText(toast.text).width + 28
    ctx.fillStyle = 'rgba(8,4,14,0.86)'
    ctx.fillRect(W / 2 - w / 2, y - 15, w, 28)
    ctx.strokeStyle = '#ffd400'
    ctx.lineWidth = 2
    ctx.strokeRect(W / 2 - w / 2, y - 15, w, 28)
    ctx.fillStyle = '#ffeaa0'
    ctx.fillText(toast.text, W / 2, y)
    ctx.globalAlpha = 1
  })

  ctx.restore()
}

/** The player sprite. Long dark hair with the era's heavy side-swept fringe,
    a black long-sleeve, arms out — the arms are the hit box, so they are drawn
    at exactly the width the collision test uses. Deliberately stylised and
    deliberately not a portrait: a likeness at forty pixels is a caricature,
    and this room does not do caricature of her. */
function drawAlu(ctx: CanvasRenderingContext2D, x: number, y: number, t: number) {
  const bob = Math.sin(t * 5) * 2
  ctx.save()
  ctx.translate(x, y + bob)
  ctx.scale(1.2, 1.2)

  // stage light
  const halo = ctx.createRadialGradient(0, 42, 2, 0, 42, 84)
  halo.addColorStop(0, 'rgba(255,43,214,0.55)')
  halo.addColorStop(1, 'rgba(255,43,214,0)')
  ctx.fillStyle = halo
  ctx.fillRect(-92, -24, 184, 116)

  const HAIR = '#191220'
  const SKIN = '#f0d3c0'

  // hair, back mass — long, past the shoulders, with a wave at the ends
  ctx.fillStyle = HAIR
  ctx.beginPath()
  ctx.moveTo(-17, -30)
  ctx.quadraticCurveTo(-31, 4, -24, 46)
  ctx.quadraticCurveTo(-16, 40, -9, 46)
  ctx.quadraticCurveTo(0, 40, 9, 46)
  ctx.quadraticCurveTo(16, 40, 24, 46)
  ctx.quadraticCurveTo(31, 4, 17, -30)
  ctx.closePath()
  ctx.fill()

  // arms — the basket, at the collision half-width (54 game px / 1.2 scale)
  ctx.strokeStyle = SKIN
  ctx.lineWidth = 6.5
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.moveTo(-13, 14)
  ctx.lineTo(-45, -2)
  ctx.moveTo(13, 14)
  ctx.lineTo(45, -2)
  ctx.stroke()

  // torso — shoulders, then in at the waist
  ctx.fillStyle = '#100c14'
  ctx.beginPath()
  ctx.moveTo(-15, 8)
  ctx.quadraticCurveTo(0, 1, 15, 8)
  ctx.quadraticCurveTo(13, 26, 17, 50)
  ctx.lineTo(-17, 50)
  ctx.quadraticCurveTo(-13, 26, -15, 8)
  ctx.closePath()
  ctx.fill()
  ctx.strokeStyle = '#ff2bd6'
  ctx.lineWidth = 1.8
  ctx.stroke()

  // face
  ctx.fillStyle = SKIN
  ctx.beginPath()
  ctx.ellipse(0, -16, 11.5, 15, 0, 0, Math.PI * 2)
  ctx.fill()

  // the fringe: one heavy sweep, left brow across to the right temple
  ctx.fillStyle = HAIR
  ctx.beginPath()
  ctx.moveTo(-16, -33)
  ctx.quadraticCurveTo(0, -37, 16, -30)
  ctx.quadraticCurveTo(17, -22, 14, -18)
  ctx.quadraticCurveTo(-1, -27, -16, -19)
  ctx.closePath()
  ctx.fill()

  // curtains down each side of the face
  ctx.beginPath()
  ctx.moveTo(-11, -29)
  ctx.quadraticCurveTo(-16, -10, -12, 8)
  ctx.quadraticCurveTo(-21, -10, -18, -29)
  ctx.closePath()
  ctx.moveTo(11, -29)
  ctx.quadraticCurveTo(16, -10, 12, 8)
  ctx.quadraticCurveTo(21, -10, 18, -29)
  ctx.closePath()
  ctx.fill()

  // a single highlight, so the hair reads as hair and not as a hole
  ctx.strokeStyle = 'rgba(180,150,200,0.35)'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(-19, -14)
  ctx.quadraticCurveTo(-23, 8, -20, 30)
  ctx.moveTo(19, -14)
  ctx.quadraticCurveTo(23, 8, 20, 30)
  ctx.stroke()

  // eyes — two lined almonds and a wing each, which is the entire face
  ctx.strokeStyle = '#241a24'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(-8, -15)
  ctx.quadraticCurveTo(-5.5, -18, -2.5, -15)
  ctx.moveTo(2.5, -15)
  ctx.quadraticCurveTo(5.5, -18, 8, -15)
  ctx.stroke()
  ctx.lineWidth = 1.4
  ctx.beginPath()
  ctx.moveTo(-8, -15); ctx.lineTo(-11, -17)
  ctx.moveTo(8, -15); ctx.lineTo(11, -17)
  ctx.stroke()

  ctx.restore()
}
