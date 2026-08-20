import { useCallback, useEffect, useRef, useState } from 'react'
import { Payout, Screen } from '../Screen'
import { CATS, SHELF, cabById } from '../content'
import { ticketsFor, useArcade } from '../state'

const CAB = cabById('yarn')!

const W = 960
const H = 620
const COLS = 6
const ROWS = 4
const PAD_Y = H - 62
const BRICK_W = 138
const BRICK_H = 40
const GAP = 12
const LEFT = (W - (COLS * BRICK_W + (COLS - 1) * GAP)) / 2
const TOP = 116

type Brick = { x: number; y: number; label: string; row: number; alive: boolean; hit: number }
type Board = {
  cat: 0 | 1
  padX: number
  padTarget: number
  ball: { x: number; y: number; vx: number; vy: number; stuck: boolean }
  bricks: Brick[]
  score: number
  lives: number
  combo: number
  toasts: { text: string; life: number }[]
  shake: number
  won: boolean
}

const ROW_INK = ['#00eaff', '#ff2bd6', '#ffd400', '#8b5cf6']

const makeBricks = (): Brick[] =>
  SHELF.slice(0, COLS * ROWS).map((label, i) => {
    const row = (i / COLS) | 0
    return {
      x: LEFT + (i % COLS) * (BRICK_W + GAP),
      y: TOP + row * (BRICK_H + GAP),
      label,
      row,
      alive: true,
      hit: 0,
    }
  })

const fresh = (cat: 0 | 1): Board => ({
  cat,
  padX: W / 2,
  padTarget: W / 2,
  ball: { x: W / 2, y: PAD_Y - 26, vx: 0, vy: 0, stuck: true },
  bricks: makeBricks(),
  score: 0,
  lives: 3,
  combo: 0,
  toasts: [],
  shake: 0,
  won: false,
})

export function Yarn() {
  const { bank } = useArcade()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [phase, setPhase] = useState<'ready' | 'live' | 'over'>('ready')
  const [cat, setCat] = useState<0 | 1>(0)
  const [result, setResult] = useState({ score: 0, won: 0, cleared: false })
  // Same split as cabinet I: the board is a ref, the HUD is a slow snapshot.
  const [hud, setHud] = useState({ score: 0, lives: 3 })
  const game = useRef<Board>(fresh(0))

  const start = useCallback(
    (which: 0 | 1) => {
      game.current = fresh(which)
      setCat(which)
      setHud({ score: 0, lives: 3 })
      setPhase('live')
    },
    [],
  )

  /* ---- input ---------------------------------------------------------- */
  useEffect(() => {
    const held = new Set<string>()
    const down = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase()
      if (['arrowleft', 'arrowright', 'a', 'd', ' '].includes(k)) e.preventDefault()
      if (k === ' ') {
        if (phase !== 'live') start(cat)
        else launch()
      }
      if (phase === 'live' && (k === 'e' || k === 's')) {
        const next: 0 | 1 = k === 'e' ? 0 : 1
        game.current.cat = next
        setCat(next)
      }
      held.add(k)
    }
    const up = (e: KeyboardEvent) => held.delete(e.key.toLowerCase())
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)

    let raf = 0
    const drive = () => {
      const g = game.current
      if (held.has('arrowleft') || held.has('a')) g.padTarget -= 17
      if (held.has('arrowright') || held.has('d')) g.padTarget += 17
      g.padTarget = Math.max(70, Math.min(W - 70, g.padTarget))
      raf = requestAnimationFrame(drive)
    }
    raf = requestAnimationFrame(drive)

    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
      cancelAnimationFrame(raf)
    }
  }, [phase, cat, start])

  const launch = () => {
    const b = game.current.ball
    if (!b.stuck) return
    b.stuck = false
    b.vx = (Math.random() > 0.5 ? 1 : -1) * 190
    b.vy = -430
  }

  const aim = useCallback((clientX: number) => {
    const el = canvasRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    game.current.padTarget = Math.max(70, Math.min(W - 70, ((clientX - r.left) / r.width) * W))
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
      const dt = Math.min(0.033, (now - last) / 1000)
      last = now
      t += dt
      const g = game.current
      const cfg = CATS[g.cat]
      const halfPad = 62 * cfg.width

      if (phase === 'live' && now - hudAt > 120) {
        hudAt = now
        setHud({ score: Math.round(g.score), lives: Math.max(0, g.lives) })
      }

      if (phase === 'live') {
        g.padX += (g.padTarget - g.padX) * Math.min(1, dt * 12 * cfg.speed)
        const b = g.ball

        if (b.stuck) {
          b.x = g.padX
          b.y = PAD_Y - 26
        } else {
          // Substepped so a fast yarn ball cannot tunnel through a shelf.
          const steps = 3
          for (let s = 0; s < steps; s++) {
            b.x += (b.vx * dt) / steps
            b.y += (b.vy * dt) / steps

            if (b.x < 22) { b.x = 22; b.vx = Math.abs(b.vx) }
            if (b.x > W - 22) { b.x = W - 22; b.vx = -Math.abs(b.vx) }
            if (b.y < 46) { b.y = 46; b.vy = Math.abs(b.vy) }

            for (const brick of g.bricks) {
              if (!brick.alive) continue
              if (
                b.x > brick.x - 12 && b.x < brick.x + BRICK_W + 12 &&
                b.y > brick.y - 12 && b.y < brick.y + BRICK_H + 12
              ) {
                brick.alive = false
                brick.hit = 1
                g.combo += 1
                g.score += 100 + brick.row * 25 + Math.min(300, g.combo * 15)
                g.toasts.push({ text: `${brick.label} — off the shelf`, life: 1.7 })
                // reflect off whichever face was nearer
                const dx = b.x - (brick.x + BRICK_W / 2)
                const dy = b.y - (brick.y + BRICK_H / 2)
                if (Math.abs(dx) / BRICK_W > Math.abs(dy) / BRICK_H) b.vx = -b.vx
                else b.vy = -b.vy
                g.shake = 0.5
                break
              }
            }

            if (b.y > PAD_Y - 20 && b.y < PAD_Y + 16 && Math.abs(b.x - g.padX) < halfPad && b.vy > 0) {
              b.vy = -Math.abs(b.vy) * 1.012
              // where on the cat you land steers it, which is the whole game
              const off = (b.x - g.padX) / halfPad
              b.vx = off * 330
              g.combo = 0
            }
          }

          if (b.y > H + 30) {
            g.lives -= 1
            g.combo = 0
            g.shake = 1
            if (g.lives > 0) {
              g.toasts.push({ text: `${cfg.name} missed it. ${cfg.name} is not sorry.`, life: 2.2 })
              g.ball = { x: g.padX, y: PAD_Y - 26, vx: 0, vy: 0, stuck: true }
            }
          }
        }

        for (const brick of g.bricks) brick.hit = Math.max(0, brick.hit - dt * 3)
        for (const toast of g.toasts) toast.life -= dt
        g.toasts = g.toasts.filter((x) => x.life > 0).slice(-3)
        g.shake = Math.max(0, g.shake - dt * 3)

        const cleared = g.bricks.every((brick) => !brick.alive)
        if (cleared) g.score += 1500
        if (cleared || g.lives <= 0) {
          const score = Math.round(g.score)
          const tix = ticketsFor(score)
          const won = bank(CAB.id, score, tix)
          setResult({ score, won, cleared })
          setPhase('over')
        }
      }

      paint(ctx, g, t, phase, halfPad)
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)

    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', fit)
    }
  }, [phase, bank])

  const cfg = CATS[cat]

  return (
    <Screen
      cab={CAB}
      hud={
        phase === 'live' ? (
          <>
            <b>{hud.score.toLocaleString()}</b> · {'♥'.repeat(hud.lives)} ·{' '}
            <span className="arc-cab__hud-clock">{cfg.name}</span>
          </>
        ) : (
          <>EDGAR &amp; SYLVIA · 24 OBJECTS</>
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
          if (phase !== 'live') start(cat)
          else launch()
        }}
      />

      {phase === 'ready' && (
        <div className="arc-lid">
          <p className="arc-lid__kicker">CABINET II</p>
          <h3 className="arc-lid__title">EDGAR &amp; SYLVIA</h3>
          <p className="arc-lid__body">
            Twenty-four objects on a shelf and nothing on this earth is going to keep them there.
            Bat the yarn, clear the wall, land where the ball goes — where it hits the cat is where
            it goes next, which is the entire skill.
          </p>
          <div className="arc-picker">
            {CATS.map((c, i) => (
              <button
                key={c.id}
                type="button"
                className={`arc-picker__cat${cat === i ? ' arc-picker__cat--on' : ''}`}
                onClick={() => setCat(i as 0 | 1)}
              >
                <CatFace which={i as 0 | 1} />
                <b>{c.name}</b>
                <span>{c.note}</span>
              </button>
            ))}
          </div>
          <button type="button" className="arc-btn arc-btn--hot" onClick={() => start(cat)}>
            PRESS START — {cfg.name}
          </button>
        </div>
      )}

      {phase === 'over' && (
        <div className="arc-lid">
          <Payout
            score={result.score}
            unit="POINTS"
            won={result.won}
            note={
              result.cleared
                ? `SHELF CLEARED. ${cfg.name} is pleased, which you will be able to tell because absolutely nothing about ${cfg.name} will change.`
                : `${cfg.name} got bored. That is not a loss condition in cat, that is the end of the shift.`
            }
            onAgain={() => start(cat)}
          />
        </div>
      )}
    </Screen>
  )
}

/** The cat select portraits. Edgar is entirely black, which is a real problem
    for a black card, so the drawing carries its own rim light — the same
    problem every photograph of a black cat has ever had. */
function CatFace({ which }: { which: 0 | 1 }) {
  const tux = which === 1
  const fur = '#1b1620'
  return (
    <svg viewBox="0 0 76 68" className="arc-picker__face" aria-hidden="true">
      <ellipse cx="38" cy="38" rx="34" ry="30" fill={tux ? '#0d1a20' : '#101a1e'} />
      {/* ears */}
      <path d="M13 28 L11 6 L30 19 Z M63 28 L65 6 L46 19 Z" fill={fur} stroke="#3d4f5c" strokeWidth="1.2" />
      <path d="M16 25 L15 13 L26 21 Z M60 25 L61 13 L50 21 Z" fill={tux ? '#4a3540' : '#3a2a34'} />
      {/* head */}
      <ellipse cx="38" cy="36" rx="27" ry="23" fill={fur} stroke="#3d4f5c" strokeWidth="1.2" />

      {tux && (
        <>
          {/* the blaze: narrow at the brow, widening over the muzzle */}
          <path d="M38 18 Q32 28 31 38 L38 42 L45 38 Q44 28 38 18 Z" fill="#f4f0e7" />
          <ellipse cx="38" cy="45" rx="13" ry="9" fill="#f4f0e7" />
          {/* the bib */}
          <path d="M28 57 Q38 51 48 57 Q44 66 38 66 Q32 66 28 57 Z" fill="#f4f0e7" />
        </>
      )}

      {/* eyes */}
      <ellipse cx="27" cy="33" rx="5.2" ry="6.4" fill={tux ? '#d4b93f' : '#9ade63'} />
      <ellipse cx="49" cy="33" rx="5.2" ry="6.4" fill={tux ? '#d4b93f' : '#9ade63'} />
      <ellipse cx="27" cy="33" rx="1.7" ry="5.4" fill="#08080a" />
      <ellipse cx="49" cy="33" rx="1.7" ry="5.4" fill="#08080a" />
      <circle cx="25.4" cy="30.6" r="1.1" fill="#fff" opacity="0.9" />
      <circle cx="47.4" cy="30.6" r="1.1" fill="#fff" opacity="0.9" />

      {/* nose + mouth */}
      <path d="M34.6 41 L41.4 41 L38 44.4 Z" fill={tux ? '#e79bb0' : '#6b5560'} />
      <path d="M38 44.4 L38 47 M38 47 Q34 50 31 47 M38 47 Q42 50 45 47" fill="none" stroke={tux ? '#c3bfb4' : '#4a4450'} strokeWidth="1.1" strokeLinecap="round" />

      {/* whiskers */}
      <g stroke="#e9e4f5" strokeWidth="0.9" opacity="0.75" strokeLinecap="round">
        <path d="M25 43 L6 39 M25 45 L7 46 M51 43 L70 39 M51 45 L69 46" />
      </g>
    </svg>
  )
}

/* ==========================================================================
   THE RENDER
   ========================================================================== */

function paint(ctx: CanvasRenderingContext2D, g: Board, t: number, phase: string, halfPad: number) {
  ctx.save()
  if (g.shake > 0) ctx.translate((Math.random() - 0.5) * 8 * g.shake, (Math.random() - 0.5) * 8 * g.shake)

  const room = ctx.createLinearGradient(0, 0, 0, H)
  room.addColorStop(0, '#04141c')
  room.addColorStop(1, '#071f2b')
  ctx.fillStyle = room
  ctx.fillRect(0, 0, W, H)

  // wallpaper — a faint grid, because the shelf has to read as a wall
  ctx.strokeStyle = 'rgba(0,234,255,0.07)'
  ctx.lineWidth = 1
  for (let x = 0; x < W; x += 48) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke()
  }
  for (let y = 0; y < H; y += 48) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke()
  }

  // shelf boards
  ctx.fillStyle = 'rgba(255,255,255,0.06)'
  for (let r = 0; r < ROWS; r++) ctx.fillRect(LEFT - 18, TOP + r * (BRICK_H + GAP) + BRICK_H, COLS * (BRICK_W + GAP) - GAP + 36, 5)

  // objects
  ctx.font = '700 13px "Space Mono", monospace'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  for (const brick of g.bricks) {
    if (!brick.alive) continue
    const ink = ROW_INK[brick.row % ROW_INK.length]
    ctx.fillStyle = ink
    ctx.shadowColor = ink
    ctx.shadowBlur = 12
    ctx.fillRect(brick.x, brick.y, BRICK_W, BRICK_H)
    ctx.shadowBlur = 0
    ctx.strokeStyle = '#04141c'
    ctx.lineWidth = 3
    ctx.strokeRect(brick.x, brick.y, BRICK_W, BRICK_H)
    ctx.fillStyle = '#061018'
    ctx.fillText(brick.label, brick.x + BRICK_W / 2, brick.y + BRICK_H / 2 + 1)
  }

  if (phase === 'live') {
    // the yarn
    const b = g.ball
    ctx.save()
    ctx.translate(b.x, b.y)
    ctx.rotate(t * 3)
    ctx.fillStyle = '#ff2bd6'
    ctx.shadowColor = '#ff2bd6'
    ctx.shadowBlur = 20
    ctx.beginPath()
    ctx.arc(0, 0, 11, 0, Math.PI * 2)
    ctx.fill()
    ctx.shadowBlur = 0
    ctx.strokeStyle = 'rgba(0,0,0,0.55)'
    ctx.lineWidth = 2
    ctx.beginPath(); ctx.arc(0, 0, 11, 0.4, 2.6); ctx.stroke()
    ctx.beginPath(); ctx.arc(0, 0, 11, 3.4, 5.6); ctx.stroke()
    ctx.restore()

    drawCat(ctx, g.padX, PAD_Y, halfPad, g.cat === 1, t)
  }

  g.toasts.forEach((toast, i) => {
    ctx.globalAlpha = Math.min(1, toast.life)
    ctx.font = '400 16px "Space Mono", monospace'
    const y = H - 150 + i * 28
    const w = ctx.measureText(toast.text).width + 26
    ctx.fillStyle = 'rgba(3,12,18,0.88)'
    ctx.fillRect(W / 2 - w / 2, y - 14, w, 26)
    ctx.strokeStyle = '#00eaff'
    ctx.lineWidth = 2
    ctx.strokeRect(W / 2 - w / 2, y - 14, w, 26)
    ctx.fillStyle = '#b9f6ff'
    ctx.textAlign = 'center'
    ctx.fillText(toast.text, W / 2, y)
    ctx.globalAlpha = 1
  })

  ctx.restore()
}

/** The paddle is a cat lying down, seen from the side, because that is the only
    posture either of these animals has ever been photographed in. */
function drawCat(ctx: CanvasRenderingContext2D, x: number, y: number, half: number, tux: boolean, t: number) {
  ctx.save()
  ctx.translate(x, y)

  const glow = ctx.createRadialGradient(0, 0, 2, 0, 0, half * 1.4)
  glow.addColorStop(0, 'rgba(0,234,255,0.35)')
  glow.addColorStop(1, 'rgba(0,234,255,0)')
  ctx.fillStyle = glow
  ctx.fillRect(-half * 1.5, -40, half * 3, 90)

  // tail, doing the only thing a tail does
  ctx.strokeStyle = '#141018'
  ctx.lineWidth = 9
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.moveTo(half - 6, 6)
  ctx.quadraticCurveTo(half + 30, 4 + Math.sin(t * 3) * 14, half + 16, -22 + Math.sin(t * 3) * 10)
  ctx.stroke()

  // body
  ctx.fillStyle = '#141018'
  ctx.beginPath()
  ctx.ellipse(0, 6, half, 17, 0, 0, Math.PI * 2)
  ctx.fill()

  // head at the left end
  ctx.beginPath()
  ctx.ellipse(-half + 6, -6, 20, 17, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.beginPath()
  ctx.moveTo(-half - 6, -18); ctx.lineTo(-half - 9, -34); ctx.lineTo(-half + 5, -22); ctx.closePath()
  ctx.moveTo(-half + 18, -18); ctx.lineTo(-half + 22, -34); ctx.lineTo(-half + 8, -22); ctx.closePath()
  ctx.fill()

  if (tux) {
    ctx.fillStyle = '#f3efe6'
    ctx.beginPath()
    ctx.ellipse(-half + 8, 4, 11, 11, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.beginPath()
    ctx.ellipse(half * 0.55, 18, 12, 6, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.beginPath()
    ctx.ellipse(-half * 0.1, 19, 12, 6, 0, 0, Math.PI * 2)
    ctx.fill()
  }

  // eyes
  ctx.fillStyle = tux ? '#d8bf46' : '#9ade63'
  ctx.beginPath()
  ctx.ellipse(-half + 1, -8, 4, 5, 0, 0, Math.PI * 2)
  ctx.ellipse(-half + 13, -8, 4, 5, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = '#000'
  ctx.beginPath()
  ctx.ellipse(-half + 1, -8, 1.3, 4.4, 0, 0, Math.PI * 2)
  ctx.ellipse(-half + 13, -8, 1.3, 4.4, 0, 0, Math.PI * 2)
  ctx.fill()

  // whiskers
  ctx.strokeStyle = 'rgba(255,255,255,0.75)'
  ctx.lineWidth = 1.4
  for (const dy of [-2, 2, 6]) {
    ctx.beginPath()
    ctx.moveTo(-half + 4, 1 + dy * 0.5)
    ctx.lineTo(-half - 22, dy)
    ctx.stroke()
  }

  ctx.restore()
}
