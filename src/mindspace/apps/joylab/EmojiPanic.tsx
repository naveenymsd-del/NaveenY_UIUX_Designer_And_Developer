import { useCallback, useEffect, useRef, useState } from 'react'
import { sfx } from '../../music/engine'
import { EMOJI_FONT, GameFrame, Overlay, type Phase, pick, rand, reduced, useBest, useCanvas, useLoop, usePauseOnHide, useToast } from './shared'

/**
 * Emoji Panic — catch the happy ones in the Joy Bowl, dodge the grumpy ones.
 * Mouse / finger: the bowl follows you. Keys: ← → (or A D). P pauses, R restarts.
 */
const ROUND = 45
const GOOD = ['😀', '😂', '🥳', '😍', '🤩', '😺', '🌈', '⭐', '🍀', '🎉', '🦄', '🍦']
const BAD = ['😠', '💣', '🌶️', '👿', '🧟']
const BAD_LINES: Record<string, string> = { '😠': 'Grumpy got you. −15', '💣': 'BOOM. −5 seconds!', '🌶️': 'Too spicy! −15', '👿': 'A tiny devil. Combo gone.', '🧟': 'Braaains… −15' }
const COMBO_LINES: Record<number, string> = { 5: 'Nice streak! ×2', 10: 'Joy overload! ×3', 15: 'Emoji whisperer ×4', 20: 'Unstoppable ×5', 30: 'Are you a professional catcher?', 45: 'The emojis are forming a fan club' }
const verdict = (s: number) => (s < 120 ? 'Warm-up round. The emojis believe in you.' : s < 350 ? 'Solid vibes. Your bowl is getting good.' : s < 700 ? 'Certified joy collector.' : 'Legend. The emojis are writing songs about you.')

interface Item { x: number; y: number; vy: number; e: string; good: boolean; rot: number; vr: number }
interface Bit { x: number; y: number; vx: number; vy: number; life: number; color?: string; text?: string }
const fresh = () => ({ t: ROUND, score: 0, combo: 0, bestCombo: 0, caught: 0, items: [] as Item[], bits: [] as Bit[], spawn: 0.4, bowl: 0.5, target: 0.5, keys: 0, shake: 0, flash: 0, wobble: 0 })

export function EmojiPanic({ onBack }: { onBack: () => void }) {
  const box = useRef<HTMLDivElement>(null)
  const cv = useRef<HTMLCanvasElement>(null)
  const size = useCanvas(box, cv)
  const g = useRef(fresh())
  const [phase, setPhase] = useState<Phase>('ready')
  const phaseRef = useRef(phase)
  phaseRef.current = phase
  const [hud, setHud] = useState({ score: 0, t: ROUND, mult: 1 })
  const [best, submit] = useBest('emoji')
  const [result, setResult] = useState<{ score: number; caught: number; combo: number; record: boolean } | null>(null)
  const [say, toast] = useToast()
  if (import.meta.env.DEV) (window as unknown as { __joylab: unknown }).__joylab = { game: 'emoji', g, size, phase }

  const start = useCallback(() => {
    g.current = fresh()
    setResult(null)
    setHud({ score: 0, t: ROUND, mult: 1 })
    setPhase('playing')
    sfx('start')
  }, [])
  const pause = useCallback(() => setPhase((p) => (p === 'playing' ? 'paused' : p === 'paused' ? 'playing' : p)), [])
  usePauseOnHide(phase, pause)
  const finish = useCallback(() => {
    const s = g.current
    const record = submit(s.score)
    setResult({ score: s.score, caught: s.caught, combo: s.bestCombo, record })
    setPhase('over')
    sfx('end')
  }, [submit])

  // keys: arrows / A D steer; P pause; R restart
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase()
      if (k === 'arrowleft' || k === 'a') { g.current.keys = -1; e.preventDefault() }
      else if (k === 'arrowright' || k === 'd') { g.current.keys = 1; e.preventDefault() }
      else if (k === 'p') pause()
      else if (k === 'r') start()
      else if ((k === ' ' || k === 'enter') && phaseRef.current !== 'playing' && phaseRef.current !== 'paused') { e.preventDefault(); start() }
    }
    const up = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase()
      if (((k === 'arrowleft' || k === 'a') && g.current.keys < 0) || ((k === 'arrowright' || k === 'd') && g.current.keys > 0)) g.current.keys = 0
    }
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up) }
  }, [pause, start])

  const steer = (e: React.PointerEvent) => {
    const r = cv.current!.getBoundingClientRect()
    g.current.target = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width))
  }

  useLoop((dt) => {
    const c = cv.current
    if (!c) return
    const ctx = c.getContext('2d')!
    const { w, h, dpr } = size.current
    const s = g.current
    const bowlW = Math.min(118, w * 0.2), bowlY = h - 44
    if (phaseRef.current === 'playing') {
      s.t -= dt
      if (s.keys) s.target = Math.min(1, Math.max(0, s.target + s.keys * dt * 1.3))
      s.bowl += (s.target - s.bowl) * Math.min(1, dt * 16)
      // spawn: faster, and a little nastier, as the score climbs
      s.spawn -= dt
      if (s.spawn <= 0) {
        const badChance = Math.min(0.4, 0.16 + s.score / 2600)
        const good = Math.random() > badChance
        s.items.push({ x: rand(28, w - 28), y: -30, vy: Math.min(560, 150 + s.score / 4.5 + rand(0, 70)), e: good ? pick(GOOD) : pick(BAD), good, rot: rand(-0.4, 0.4), vr: rand(-2, 2) })
        s.spawn = Math.max(0.26, 0.82 - s.score / 1500) * rand(0.7, 1.25)
      }
      const bx = s.bowl * w
      for (const it of s.items) {
        it.y += it.vy * dt
        it.rot += it.vr * dt
      }
      const keep: Item[] = []
      for (const it of s.items) {
        const inBowl = it.y > bowlY - 18 && it.y < bowlY + 14 && Math.abs(it.x - bx) < bowlW / 2 + 8
        if (inBowl) {
          if (it.good) {
            s.combo++
            s.caught++
            s.bestCombo = Math.max(s.bestCombo, s.combo)
            const mult = Math.min(5, 1 + Math.floor(s.combo / 5))
            s.score += 10 * mult
            s.wobble = 1
            s.bits.push({ x: it.x, y: it.y - 20, vx: 0, vy: -50, life: 0.9, text: `+${10 * mult}` })
            for (let i = 0; i < 10; i++) s.bits.push({ x: it.x, y: it.y, vx: rand(-160, 160), vy: rand(-220, -40), life: rand(0.4, 0.8), color: pick(['#ffd23f', '#ff5d8f', '#3bceac', '#7b6cff', '#ff8c42']) })
            if (COMBO_LINES[s.combo]) { say(COMBO_LINES[s.combo], 'good'); sfx('combo') } else sfx('catch')
          } else {
            s.combo = 0
            if (it.e === '💣') s.t = Math.max(0, s.t - 5)
            else if (it.e !== '👿') s.score = Math.max(0, s.score - 15)
            s.shake = reduced() ? 0 : 10
            s.flash = 1
            say(BAD_LINES[it.e] ?? 'Ouch!', 'bad')
            sfx('bad')
          }
          continue
        }
        if (it.y > h + 30) {
          if (it.good && s.combo >= 5) { say('It got away 🥲 Combo lost.', 'info'); s.combo = 0 }
          continue
        }
        keep.push(it)
      }
      s.items = keep
      if (s.t <= 0) { s.t = 0; finish() }
      const mult = Math.min(5, 1 + Math.floor(s.combo / 5))
      const ti = Math.ceil(s.t)
      setHud((p) => (p.score === s.score && p.t === ti && p.mult === mult ? p : { score: s.score, t: ti, mult }))
    }
    for (const b of s.bits) { b.x += b.vx * dt; b.y += b.vy * dt; if (b.color) b.vy += 520 * dt; b.life -= dt }
    s.bits = s.bits.filter((b) => b.life > 0)
    s.shake = Math.max(0, s.shake - dt * 40)
    s.flash = Math.max(0, s.flash - dt * 3)
    s.wobble = Math.max(0, s.wobble - dt * 4)

    // ── draw ──
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, w, h)
    ctx.save()
    if (s.shake) ctx.translate(rand(-s.shake, s.shake), rand(-s.shake, s.shake))
    const sky = ctx.createLinearGradient(0, 0, 0, h)
    sky.addColorStop(0, '#ffe7c2')
    sky.addColorStop(1, '#ffb3a7')
    ctx.fillStyle = sky
    ctx.fillRect(-20, -20, w + 40, h + 40)
    ctx.fillStyle = 'rgba(255,255,255,0.35)'
    for (let y = 18; y < h; y += 34) for (let x = (y / 34) % 2 ? 18 : 35; x < w; x += 34) { ctx.beginPath(); ctx.arc(x, y, 1.6, 0, Math.PI * 2); ctx.fill() }
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.font = `40px ${EMOJI_FONT}`
    for (const it of s.items) {
      ctx.save()
      ctx.translate(it.x, it.y)
      ctx.rotate(it.rot)
      ctx.fillText(it.e, 0, 0)
      ctx.restore()
    }
    // the Joy Bowl: a glossy smiling bowl that squishes when it catches
    const bx = s.bowl * w, sq = 1 + Math.sin(s.wobble * Math.PI) * 0.12
    ctx.save()
    ctx.translate(bx, bowlY)
    ctx.scale(sq, 1 / sq)
    ctx.fillStyle = 'rgba(80,40,30,0.18)'
    ctx.beginPath(); ctx.ellipse(0, 30, bowlW / 2, 6, 0, 0, Math.PI * 2); ctx.fill()
    const body = ctx.createLinearGradient(0, -10, 0, 26)
    body.addColorStop(0, '#ffffff')
    body.addColorStop(1, '#ffd6cc')
    ctx.fillStyle = body
    ctx.beginPath()
    ctx.moveTo(-bowlW / 2, -8)
    ctx.quadraticCurveTo(-bowlW / 2 + 4, 26, 0, 26)
    ctx.quadraticCurveTo(bowlW / 2 - 4, 26, bowlW / 2, -8)
    ctx.closePath()
    ctx.fill()
    ctx.fillStyle = '#ff7a6b'
    ctx.beginPath(); ctx.ellipse(0, -8, bowlW / 2, 6, 0, 0, Math.PI * 2); ctx.fill()
    ctx.fillStyle = '#3b2420'
    ctx.beginPath(); ctx.arc(-12, 6, 3, 0, Math.PI * 2); ctx.arc(12, 6, 3, 0, Math.PI * 2); ctx.fill()
    ctx.strokeStyle = '#3b2420'; ctx.lineWidth = 2.5; ctx.lineCap = 'round'
    ctx.beginPath(); ctx.arc(0, 10, 7, 0.15 * Math.PI, 0.85 * Math.PI); ctx.stroke()
    ctx.restore()
    for (const b of s.bits) {
      ctx.globalAlpha = Math.min(1, b.life * 2)
      if (b.text) { ctx.fillStyle = '#3b2420'; ctx.font = '800 18px system-ui, sans-serif'; ctx.fillText(b.text, b.x, b.y) }
      else { ctx.fillStyle = b.color!; ctx.fillRect(b.x - 3, b.y - 3, 6, 6) }
    }
    ctx.globalAlpha = 1
    ctx.restore()
    if (s.flash) { ctx.fillStyle = `rgba(220,40,40,${s.flash * 0.22})`; ctx.fillRect(0, 0, w, h) }
  })

  return (
    <GameFrame id="emoji" title="Emoji Panic" score={hud.score} best={best} phase={phase} onBack={onBack} onPause={pause} onRestart={start}
      stats={<><span><small>Time</small><b data-time>{hud.t}s</b></span><span className={hud.mult > 1 ? 'is-hot' : ''}><small>Combo</small><b>×{hud.mult}</b></span></>}>
      <div className="jl-stage" ref={box} onPointerMove={steer} onPointerDown={steer}>
        <canvas ref={cv} aria-label="Emoji Panic play area. Move the bowl with the mouse, your finger or the arrow keys." role="img" />
        {toast}
        {phase === 'ready' && (
          <Overlay>
            <p className="jl-overlay__big">😀 → 🥣 ← 😠</p>
            <h3>Catch the joy. Dodge the grumps.</h3>
            <p>Happy emojis = points and combos. Grumpy, spicy and explosive ones = trouble. 💣 steals 5 seconds.</p>
            <p className="jl-keys">Mouse or finger to move · <kbd>←</kbd> <kbd>→</kbd> · <kbd>P</kbd> pause</p>
            <button className="jl-play" onClick={start}>Start · {ROUND}s</button>
          </Overlay>
        )}
        {phase === 'paused' && <Overlay tone="dark"><h3>Paused</h3><p>The emojis are politely waiting.</p><button className="jl-play" onClick={pause}>Resume</button></Overlay>}
        {phase === 'over' && result && (
          <Overlay>
            <p className="jl-overlay__big">{result.record ? '🏆' : '🥣'}</p>
            <h3>{result.record ? 'New personal best! Frame it.' : verdict(result.score)}</h3>
            <dl className="jl-results"><div><dt>Score</dt><dd>{result.score}</dd></div><div><dt>Caught</dt><dd>{result.caught}</dd></div><div><dt>Best combo</dt><dd>{result.combo}</dd></div></dl>
            <div className="jl-overlay__row"><button className="jl-play" onClick={start}>Play again</button><button className="jl-ghost" onClick={onBack}>Back to Joy Lab</button></div>
          </Overlay>
        )}
      </div>
    </GameFrame>
  )
}
