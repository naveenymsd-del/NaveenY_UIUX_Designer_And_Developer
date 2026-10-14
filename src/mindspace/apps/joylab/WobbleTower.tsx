import { useCallback, useEffect, useRef, useState } from 'react'
import { sfx } from '../../music/engine'
import { GameFrame, Overlay, type Phase, pick, rand, reduced, useBest, useCanvas, useLoop, usePauseOnHide, useToast } from './shared'

/**
 * Wobble Tower — drop silly objects from a swinging crane and stack them.
 * A small custom physics model: a piece must land on the one below, and for
 * every piece the combined centre of mass of everything above it must sit over
 * its support — otherwise that part of the tower topples. The stack wobbles
 * (a damped spring) after each landing.
 * Tap / click / Space / ↓ to drop. P pauses, R restarts.
 */
type Kind = 'duck' | 'cube' | 'donut' | 'plant' | 'book' | 'loaf'
const SIZES: Record<Kind, [number, number]> = { duck: [66, 46], cube: [54, 54], donut: [84, 32], plant: [48, 62], book: [100, 22], loaf: [74, 40] }
const NAMES: Record<Kind, string> = { duck: 'rubber duck', cube: 'smiley cube', donut: 'donut', plant: 'tiny plant', book: 'book', loaf: 'bread loaf' }
interface Piece { kind: Kind; w: number; h: number; x: number; y: number; squash: number }
interface Body { p: Piece; vx: number; vy: number; ang: number; va: number }
const LAND = ['Snug!', 'Steady…', 'Chef’s kiss', 'Tower vibes', 'The duck approves', 'Architecturally sound-ish']
const FALL = ['Gravity: 1, You: 0', 'That was structurally ambitious', 'The duck has left the building', 'Bold design choice. Gravity disagreed.']

function newPiece(u: number): Piece {
  const kind = pick(Object.keys(SIZES) as Kind[])
  const [w, h] = SIZES[kind]
  return { kind, w: w * u, h: h * u, x: 0, y: 0, squash: 0 }
}
const fresh = (u = 1) => ({ stack: [] as Piece[], cur: newPiece(u), falling: false, vy: 0, swing: 0, cam: 0, lean: 0, leanV: 0, bodies: [] as Body[], score: 0, streak: 0, overAt: 0, u })

export function WobbleTower({ onBack }: { onBack: () => void }) {
  const box = useRef<HTMLDivElement>(null)
  const cv = useRef<HTMLCanvasElement>(null)
  const size = useCanvas(box, cv)
  const g = useRef(fresh())
  const [phase, setPhase] = useState<Phase>('ready')
  const phaseRef = useRef(phase)
  phaseRef.current = phase
  const [hud, setHud] = useState({ score: 0, floors: 0 })
  const [best, submit] = useBest('tower')
  const [result, setResult] = useState<{ score: number; floors: number; record: boolean; line: string } | null>(null)
  const [say, toast] = useToast()
  if (import.meta.env.DEV) (window as unknown as { __joylab: unknown }).__joylab = { game: 'tower', g, size, phase }

  const unit = () => Math.min(1.15, Math.max(0.72, size.current.w / 700))
  const start = useCallback(() => {
    g.current = fresh(unit())
    setResult(null)
    setHud({ score: 0, floors: 0 })
    setPhase('playing')
    sfx('start')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const pause = useCallback(() => setPhase((p) => (p === 'playing' ? 'paused' : p === 'paused' ? 'playing' : p)), [])
  usePauseOnHide(phase, pause)
  const drop = useCallback(() => {
    if (phaseRef.current !== 'playing') return
    const s = g.current
    if (s.falling || s.overAt) return
    s.falling = true
    s.vy = 0
    sfx('drop')
  }, [])

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase()
      if (k === ' ' || k === 'enter' || k === 'arrowdown') {
        e.preventDefault()
        if (phaseRef.current === 'playing') drop()
        else if (phaseRef.current !== 'paused') start()
      } else if (k === 'p') pause()
      else if (k === 'r') start()
    }
    window.addEventListener('keydown', down)
    return () => window.removeEventListener('keydown', down)
  }, [drop, pause, start])

  useLoop((dt) => {
    const c = cv.current
    if (!c) return
    const ctx = c.getContext('2d')!
    const { w, h, dpr } = size.current
    const s = g.current
    const base = { x: w / 2, w: Math.min(260, w * 0.46) * 1, h: 26, y: 0 }
    const top = () => (s.stack.length ? s.stack[s.stack.length - 1] : null)
    const topY = () => { const t = top(); return t ? t.y + t.h : base.h }
    const hangY = topY() + 150 * s.u + s.cur.h
    const playing = phaseRef.current === 'playing'

    if (playing) {
      if (!s.falling && !s.overAt) {
        s.swing += dt * (1.3 + Math.min(2.3, s.stack.length * 0.1))
        s.cur.x = w / 2 + Math.sin(s.swing) * Math.min(w * 0.36, 230)
        s.cur.y = hangY - s.cur.h
      } else if (s.falling) {
        s.vy += 1700 * dt
        s.cur.y -= s.vy * dt
        if (s.cur.y <= topY()) {
          s.cur.y = topY()
          s.falling = false
          land(s, base)
        }
      }
      if (s.overAt && performance.now() > s.overAt) {
        const record = submit(s.score)
        setResult({ score: s.score, floors: s.stack.length, record, line: pick(FALL) })
        setPhase('over')
        sfx('end')
      }
      setHud((p) => (p.score === s.score && p.floors === s.stack.length ? p : { score: s.score, floors: s.stack.length }))
    }
    // the wobble: a damped spring on the tower's lean
    s.leanV += (-60 * s.lean - 4.5 * s.leanV) * dt
    s.lean += s.leanV * dt
    if (reduced()) s.lean = 0
    for (const p of s.stack) p.squash = Math.max(0, p.squash - dt * 4)
    for (const b of s.bodies) { b.vy -= 1500 * dt; b.p.x += b.vx * dt; b.p.y += b.vy * dt; b.ang += b.va * dt }
    // camera: keep the crane near the top of the view
    const camT = Math.max(0, hangY + 60 - (h - 36 - 40))
    s.cam += (camT - s.cam) * Math.min(1, dt * 3)

    function land(st: typeof s, b: typeof base) {
      const p = st.cur
      const sup = st.stack.length ? st.stack[st.stack.length - 1] : { x: b.x, w: b.w }
      const overlap = Math.min(p.x + p.w / 2, sup.x + sup.w / 2) - Math.max(p.x - p.w / 2, sup.x - sup.w / 2)
      if (overlap < p.w * 0.18) {
        // missed: it bounces off the edge and tumbles away
        const dir = Math.sign(p.x - sup.x) || 1
        st.bodies.push({ p: { ...p }, vx: dir * 160, vy: 120, ang: 0, va: dir * 4 })
        st.overAt = performance.now() + 1300
        say(`The ${NAMES[p.kind]} missed the tower entirely`, 'bad')
        sfx('fall')
        return
      }
      const offset = p.x - sup.x
      if (Math.abs(offset) < 4 * st.u) p.x = sup.x
      st.stack.push({ ...p, squash: 1 })
      // stability: everything above each piece must have its centre of mass over that piece's support
      for (let i = st.stack.length - 1; i >= 0; i--) {
        let m = 0, mx = 0
        for (let j = i; j < st.stack.length; j++) { const q = st.stack[j]; const a = q.w * q.h; m += a; mx += a * q.x }
        const com = mx / m
        const S = i === 0 ? { x: b.x, w: b.w } : st.stack[i - 1]
        if (com < S.x - S.w / 2 || com > S.x + S.w / 2) {
          const dir = com > S.x ? 1 : -1
          for (const q of st.stack.splice(i)) st.bodies.push({ p: q, vx: dir * rand(70, 170), vy: rand(40, 160), ang: 0, va: dir * rand(1.5, 3.8) })
          st.overAt = performance.now() + 1500
          st.leanV += dir * 2.5
          say('TIMBERRR!', 'bad')
          sfx('fall')
          return
        }
      }
      const perfect = Math.abs(offset) < 4 * st.u
      st.streak = perfect ? st.streak + 1 : 0
      const pts = perfect ? 25 + st.streak * 5 : 10 + Math.round(10 * Math.max(0, 1 - Math.abs(offset) / (sup.w / 2)))
      st.score += pts
      st.leanV += (offset / sup.w) * 1.4 * (1 + st.stack.length * 0.04)
      // how close is the whole tower to tipping? a gentle warning
      let m = 0, mx = 0
      for (const q of st.stack) { const a = q.w * q.h; m += a; mx += a * q.x }
      const margin = b.w / 2 - Math.abs(mx / m - b.x)
      if (perfect) { say(st.streak > 1 ? `Perfect ×${st.streak}! 🎯` : 'Perfect! 🎯', 'good'); sfx('perfect') }
      else if (margin < 18 * st.u) { say('Uh oh… it’s wobbling 😬', 'info'); sfx('land') }
      else { if (st.stack.length % 3 === 0) say(pick(LAND), 'good'); sfx('land') }
      st.cur = newPiece(st.u)
    }

    // ── draw ──
    const sy = (y: number) => h - 36 - (y - s.cam)
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    const sky = ctx.createLinearGradient(0, 0, 0, h)
    sky.addColorStop(0, '#c9f2e7')
    sky.addColorStop(1, '#7fd3c3')
    ctx.fillStyle = sky
    ctx.fillRect(0, 0, w, h)
    // height marks every 100 units
    ctx.fillStyle = 'rgba(20,70,64,0.35)'
    ctx.font = '600 11px system-ui, sans-serif'
    ctx.textAlign = 'left'
    for (let y = 100; y < s.cam + h; y += 100) { const yy = sy(y); if (yy > 0 && yy < h) { ctx.fillRect(0, yy, 10, 1.5); ctx.fillText(`${y / 10} m`, 14, yy + 4) } }
    // ground + base
    ctx.fillStyle = '#4fa596'
    ctx.fillRect(0, sy(0), w, h)
    roundRect(ctx, base.x - base.w / 2, sy(base.h), base.w, base.h, 8)
    ctx.fillStyle = '#2f6f66'
    ctx.fill()
    // the tower, leaning around the base's top centre
    ctx.save()
    ctx.translate(base.x, sy(base.h))
    ctx.rotate(s.lean * 0.06)
    ctx.translate(-base.x, -sy(base.h))
    for (const p of s.stack) drawPiece(ctx, p, p.x, sy(p.y), 0)
    ctx.restore()
    for (const b of s.bodies) drawPiece(ctx, b.p, b.p.x, sy(b.p.y), b.ang)
    // crane + current piece
    if (!s.overAt && phaseRef.current !== 'over') {
      const cy = sy(s.falling ? hangY : s.cur.y + s.cur.h)
      if (!s.falling) {
        ctx.strokeStyle = 'rgba(20,60,56,0.55)'
        ctx.lineWidth = 2
        ctx.beginPath(); ctx.moveTo(s.cur.x, 0); ctx.lineTo(s.cur.x, cy); ctx.stroke()
        ctx.fillStyle = '#ffd23f'
        ctx.fillRect(s.cur.x - 9, cy - 6, 18, 6)
        // drop guide
        ctx.setLineDash([4, 6])
        ctx.strokeStyle = 'rgba(20,60,56,0.25)'
        ctx.beginPath(); ctx.moveTo(s.cur.x, sy(s.cur.y)); ctx.lineTo(s.cur.x, sy(topY())); ctx.stroke()
        ctx.setLineDash([])
      }
      drawPiece(ctx, s.cur, s.cur.x, sy(s.cur.y), 0)
    }
  })

  return (
    <GameFrame id="tower" title="Wobble Tower" score={hud.score} best={best} phase={phase} onBack={onBack} onPause={pause} onRestart={start}
      stats={<span><small>Floors</small><b data-floors>{hud.floors}</b></span>}>
      <div className="jl-stage" ref={box} onPointerDown={(e) => { if ((e.target as HTMLElement).tagName === 'CANVAS') drop() }}>
        <canvas ref={cv} aria-label="Wobble Tower play area. Tap, click or press Space to drop the swinging object." role="img" />
        {toast}
        {phase === 'ready' && (
          <Overlay>
            <p className="jl-overlay__big">🦆🍩🪴</p>
            <h3>Stack the silly stuff.</h3>
            <p>Drop each object from the swinging crane. Land it dead centre for a <b>Perfect</b>. Lean too far and… well, you’ll see.</p>
            <p className="jl-keys">Tap or click to drop · <kbd>Space</kbd> · <kbd>P</kbd> pause</p>
            <button className="jl-play" onClick={start}>Start stacking</button>
          </Overlay>
        )}
        {phase === 'paused' && <Overlay tone="dark"><h3>Paused</h3><p>The tower is holding its breath.</p><button className="jl-play" onClick={pause}>Resume</button></Overlay>}
        {phase === 'over' && result && (
          <Overlay>
            <p className="jl-overlay__big">{result.record ? '🏆' : '🫠'}</p>
            <h3>{result.record ? 'New personal best! A skyscraper of silliness.' : result.line}</h3>
            <dl className="jl-results"><div><dt>Score</dt><dd>{result.score}</dd></div><div><dt>Floors</dt><dd>{result.floors}</dd></div></dl>
            <div className="jl-overlay__row"><button className="jl-play" onClick={start}>Stack again</button><button className="jl-ghost" onClick={onBack}>Back to Joy Lab</button></div>
          </Overlay>
        )}
      </div>
    </GameFrame>
  )
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.roundRect(x, y, w, h, r)
}
const face = (ctx: CanvasRenderingContext2D, x: number, y: number, s: number) => {
  ctx.fillStyle = '#2a1c18'
  ctx.beginPath(); ctx.arc(x - 6 * s, y, 2.4 * s, 0, Math.PI * 2); ctx.arc(x + 6 * s, y, 2.4 * s, 0, Math.PI * 2); ctx.fill()
  ctx.strokeStyle = '#2a1c18'; ctx.lineWidth = 2 * s; ctx.lineCap = 'round'
  ctx.beginPath(); ctx.arc(x, y + 3 * s, 5 * s, 0.15 * Math.PI, 0.85 * Math.PI); ctx.stroke()
}

/** each object, drawn in its box (bottom centre at x, y), slightly squashed just after landing */
function drawPiece(ctx: CanvasRenderingContext2D, p: Piece, x: number, y: number, ang: number) {
  const { w, h } = p
  const sq = 1 + Math.sin(p.squash * Math.PI) * 0.12
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(ang)
  ctx.scale(sq, 1 / sq)
  const s = h / 50
  ctx.fillStyle = 'rgba(0,0,0,0.12)'
  ctx.fillRect(-w / 2 + 3, -h + 4, w, h)
  switch (p.kind) {
    case 'duck': {
      ctx.fillStyle = '#ffd23f'
      ctx.beginPath(); ctx.ellipse(-w * 0.08, -h * 0.34, w * 0.42, h * 0.34, 0, 0, Math.PI * 2); ctx.fill()
      ctx.beginPath(); ctx.arc(w * 0.22, -h * 0.68, h * 0.3, 0, Math.PI * 2); ctx.fill()
      ctx.fillStyle = '#ff8c42'
      ctx.beginPath(); ctx.ellipse(w * 0.44, -h * 0.62, w * 0.1, h * 0.08, 0, 0, Math.PI * 2); ctx.fill()
      ctx.fillStyle = '#2a1c18'
      ctx.beginPath(); ctx.arc(w * 0.28, -h * 0.74, 2.6 * s, 0, Math.PI * 2); ctx.fill()
      ctx.fillStyle = 'rgba(255,255,255,0.55)'
      ctx.beginPath(); ctx.ellipse(-w * 0.22, -h * 0.44, w * 0.12, h * 0.08, -0.4, 0, Math.PI * 2); ctx.fill()
      break
    }
    case 'cube':
      roundRect(ctx, -w / 2, -h, w, h, 10 * s); ctx.fillStyle = '#ff6f61'; ctx.fill()
      ctx.fillStyle = 'rgba(255,255,255,0.25)'; roundRect(ctx, -w / 2 + 5, -h + 5, w - 10, h * 0.3, 6 * s); ctx.fill()
      face(ctx, 0, -h * 0.5, s * 1.1)
      break
    case 'donut':
      roundRect(ctx, -w / 2, -h, w, h, h / 2); ctx.fillStyle = '#d9a066'; ctx.fill()
      ctx.fillStyle = '#ff8fb8'
      ctx.beginPath()
      ctx.moveTo(-w / 2 + 4, -h * 0.6)
      for (let i = 0; i <= 8; i++) ctx.quadraticCurveTo(-w / 2 + (i + 0.5) * (w / 8), -h * (i % 2 ? 0.42 : 0.5), -w / 2 + (i + 1) * (w / 8) - (i === 8 ? 4 : 0), -h * 0.58)
      ctx.lineTo(w / 2 - 6, -h + 6); ctx.quadraticCurveTo(0, -h - 2, -w / 2 + 6, -h + 6); ctx.closePath(); ctx.fill()
      for (let i = 0; i < 9; i++) { ctx.fillStyle = ['#fff', '#3bceac', '#ffd23f', '#7b6cff'][i % 4]; ctx.fillRect(-w / 2 + 10 + i * (w - 20) / 9, -h * (0.78 + (i % 3) * 0.05), 5 * s, 2 * s) }
      break
    case 'plant':
      ctx.fillStyle = '#c96a43'
      ctx.beginPath(); ctx.moveTo(-w / 2, -h * 0.5); ctx.lineTo(w / 2, -h * 0.5); ctx.lineTo(w * 0.38, 0); ctx.lineTo(-w * 0.38, 0); ctx.closePath(); ctx.fill()
      ctx.fillStyle = '#a95533'; ctx.fillRect(-w / 2, -h * 0.5, w, h * 0.1)
      ctx.fillStyle = '#4caf6d'
      for (const [lx, ly, r, a] of [[-0.18, -0.72, 0.26, -0.6], [0.2, -0.76, 0.26, 0.6], [0, -0.88, 0.22, 0]] as const) { ctx.beginPath(); ctx.ellipse(w * lx, h * ly, w * r, h * 0.13, a, 0, Math.PI * 2); ctx.fill() }
      face(ctx, 0, -h * 0.28, s * 0.9)
      break
    case 'book':
      roundRect(ctx, -w / 2, -h, w, h, 3 * s); ctx.fillStyle = '#4361ee'; ctx.fill()
      ctx.fillStyle = '#f4f1ea'; ctx.fillRect(-w / 2 + 4, -h * 0.4, w - 8, h * 0.28)
      ctx.fillStyle = '#ffd23f'; ctx.fillRect(-w * 0.2, -h * 0.82, w * 0.4, h * 0.2)
      break
    case 'loaf':
      ctx.fillStyle = '#e0a458'
      ctx.beginPath(); ctx.moveTo(-w / 2, 0); ctx.lineTo(-w / 2, -h * 0.55); ctx.quadraticCurveTo(-w / 2, -h, -w * 0.2, -h); ctx.lineTo(w * 0.2, -h); ctx.quadraticCurveTo(w / 2, -h, w / 2, -h * 0.55); ctx.lineTo(w / 2, 0); ctx.closePath(); ctx.fill()
      ctx.strokeStyle = '#b97a35'; ctx.lineWidth = 2 * s
      for (const lx of [-0.22, 0, 0.22]) { ctx.beginPath(); ctx.moveTo(w * lx - 5 * s, -h * 0.88); ctx.lineTo(w * lx + 5 * s, -h * 0.72); ctx.stroke() }
      face(ctx, 0, -h * 0.38, s * 1.05)
      break
  }
  ctx.restore()
}
