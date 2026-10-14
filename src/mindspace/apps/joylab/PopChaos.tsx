import { useCallback, useEffect, useRef, useState } from 'react'
import { sfx } from '../../music/engine'
import { EMOJI_FONT, GameFrame, Overlay, type Phase, pick, rand, reduced, useBest, useCanvas, useLoop, usePauseOnHide, useToast } from './shared'

/**
 * Pop the Chaos — pop the bubbles before they float away.
 * Specials: ⭐ bonus, 💥 chain reaction, 🐌 slow motion, 🎉 party (double points).
 * Decoys: 🐡 puffs up and blocks the view, 🧅 makes everyone cry (combo lost).
 * Tap / click a bubble. Keys: arrows or W A S D move the ring, Space pops. P pauses, R restarts.
 */
const ROUND = 50
type Kind = 'n' | 'star' | 'bomb' | 'slow' | 'party' | 'puffer' | 'onion'
const ICON: Record<Kind, string> = { n: '', star: '⭐', bomb: '💥', slow: '🐌', party: '🎉', puffer: '🐡', onion: '🧅' }
const HUES = [340, 20, 45, 160, 195, 265]
interface Bubble { x: number; y: number; r: number; vy: number; ph: number; kind: Kind; hue: number }
interface Ring { x: number; y: number; r: number; life: number; hue: number }
interface Drop { x: number; y: number; vx: number; vy: number; life: number; color: string; text?: string }
const fresh = () => ({ t: ROUND, score: 0, combo: 0, bestCombo: 0, popped: 0, lastPop: -9, clock: 0, spawn: 0.3, bubbles: [] as Bubble[], rings: [] as Ring[], drops: [] as Drop[], slow: 0, party: 0, puff: 0, cry: 0, aim: { x: 0.5, y: 0.5, vx: 0, vy: 0, on: false } })
const verdict = (s: number) => (s < 200 ? 'A gentle start. The bubbles barely noticed.' : s < 600 ? 'Pop star in training.' : s < 1200 ? 'Certified chaos manager.' : 'You are the chaos now.')

function kindFor(t: number): Kind {
  const r = Math.random()
  if (r < 0.06) return 'star'
  if (r < 0.11) return 'bomb'
  if (r < 0.145) return 'slow'
  if (r < 0.18) return 'party'
  if (r < 0.215 + t * 0.0006) return 'puffer'
  if (r < 0.245 + t * 0.0008) return 'onion'
  return 'n'
}

export function PopChaos({ onBack }: { onBack: () => void }) {
  const box = useRef<HTMLDivElement>(null)
  const cv = useRef<HTMLCanvasElement>(null)
  const size = useCanvas(box, cv)
  const g = useRef(fresh())
  const [phase, setPhase] = useState<Phase>('ready')
  const phaseRef = useRef(phase)
  phaseRef.current = phase
  const [hud, setHud] = useState({ score: 0, t: ROUND, mult: 1 })
  const [best, submit] = useBest('pop')
  const [result, setResult] = useState<{ score: number; popped: number; combo: number; record: boolean } | null>(null)
  const [say, toast] = useToast()
  if (import.meta.env.DEV) (window as unknown as { __joylab: unknown }).__joylab = { game: 'pop', g, size, phase }

  const start = useCallback(() => {
    g.current = fresh()
    setResult(null)
    setHud({ score: 0, t: ROUND, mult: 1 })
    setPhase('playing')
    sfx('start')
  }, [])
  const pause = useCallback(() => setPhase((p) => (p === 'playing' ? 'paused' : p === 'paused' ? 'playing' : p)), [])
  usePauseOnHide(phase, pause)

  /** pop whatever is under (x, y) in CSS px; returns whether something popped */
  const popAt = useCallback((x: number, y: number, slack = 8) => {
    if (phaseRef.current !== 'playing') return false
    const s = g.current
    let hit: Bubble | null = null
    for (let i = s.bubbles.length - 1; i >= 0; i--) {
      const b = s.bubbles[i]
      if (Math.hypot(b.x - x, b.y - y) <= b.r + slack) { hit = b; break }
    }
    if (!hit) return false
    pop(hit, true)
    return true
  }, [])

  function pop(b: Bubble, byHand: boolean) {
    const s = g.current
    if (!s.bubbles.includes(b)) return
    s.bubbles = s.bubbles.filter((x) => x !== b)
    s.rings.push({ x: b.x, y: b.y, r: b.r, life: 0.4, hue: b.hue })
    for (let i = 0; i < 8; i++) s.drops.push({ x: b.x, y: b.y, vx: rand(-180, 180), vy: rand(-200, 60), life: rand(0.3, 0.6), color: `hsl(${b.hue} 90% 70%)` })
    if (b.kind === 'puffer') { s.puff = 2.2; s.combo = 0; s.score = Math.max(0, s.score - 20); say('You popped a pufferfish. It is now ENORMOUS.', 'bad'); sfx('bad'); return }
    if (b.kind === 'onion') { s.cry = 2.6; s.combo = 0; say('You made everyone cry 🧅😭', 'bad'); sfx('bad'); return }
    const now = s.clock
    s.combo = byHand && now - s.lastPop > 0.9 ? 1 : s.combo + 1
    if (byHand) s.lastPop = now
    s.bestCombo = Math.max(s.bestCombo, s.combo)
    s.popped++
    const mult = Math.min(5, 1 + Math.floor(s.combo / 4)) * (s.party > 0 ? 2 : 1)
    const base = b.kind === 'star' ? 50 : 10
    s.score += base * mult
    s.drops.push({ x: b.x, y: b.y - 6, vx: 0, vy: -60, life: 0.8, color: '#fff', text: `+${base * mult}` })
    if (b.kind === 'star') { say('Shiny! +50', 'good'); sfx('bonus') }
    else if (b.kind === 'slow') { s.slow = 4; say('Bullet time 🐌', 'good'); sfx('bonus') }
    else if (b.kind === 'party') { s.party = 6; say('PARTY MODE! Double points 🎉', 'good'); sfx('bonus'); for (let i = 0; i < 40; i++) s.drops.push({ x: rand(0, size.current.w), y: -10, vx: rand(-40, 40), vy: rand(60, 220), life: rand(1, 1.8), color: `hsl(${rand(0, 360)} 90% 65%)` }) }
    else if (b.kind === 'bomb') {
      say('Chain reaction! 💥', 'good'); sfx('bonus')
      const near = s.bubbles.filter((x) => x.kind !== 'puffer' && x.kind !== 'onion' && Math.hypot(x.x - b.x, x.y - b.y) < 150)
      setTimeout(() => near.forEach((x) => pop(x, false)), 90)
    } else sfx('pop')
    if (byHand && s.combo > 0 && s.combo % 8 === 0) say(`Combo ×${Math.min(5, 1 + Math.floor(s.combo / 4))}! Pop pop pop`, 'good')
  }

  useEffect(() => {
    const keys = new Set<string>()
    const down = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase()
      const s = g.current
      if (['arrowleft', 'arrowright', 'arrowup', 'arrowdown', 'w', 'a', 's', 'd'].includes(k)) { keys.add(k); s.aim.on = true; e.preventDefault() }
      else if (k === ' ' || k === 'enter') {
        e.preventDefault()
        if (phaseRef.current === 'playing') { s.aim.on = true; popAt(s.aim.x * size.current.w, s.aim.y * size.current.h, 22) }
        else if (phaseRef.current !== 'paused') start()
      } else if (k === 'p') pause()
      else if (k === 'r') start()
      s.aim.vx = (keys.has('arrowright') || keys.has('d') ? 1 : 0) - (keys.has('arrowleft') || keys.has('a') ? 1 : 0)
      s.aim.vy = (keys.has('arrowdown') || keys.has('s') ? 1 : 0) - (keys.has('arrowup') || keys.has('w') ? 1 : 0)
    }
    const up = (e: KeyboardEvent) => {
      keys.delete(e.key.toLowerCase())
      const s = g.current
      s.aim.vx = (keys.has('arrowright') || keys.has('d') ? 1 : 0) - (keys.has('arrowleft') || keys.has('a') ? 1 : 0)
      s.aim.vy = (keys.has('arrowdown') || keys.has('s') ? 1 : 0) - (keys.has('arrowup') || keys.has('w') ? 1 : 0)
    }
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up) }
  }, [pause, popAt, size, start])

  useLoop((dt) => {
    const c = cv.current
    if (!c) return
    const ctx = c.getContext('2d')!
    const { w, h, dpr } = size.current
    const s = g.current
    if (phaseRef.current === 'playing') {
      s.t -= dt
      s.clock += dt
      const k = s.slow > 0 ? 0.35 : 1
      s.slow = Math.max(0, s.slow - dt)
      s.party = Math.max(0, s.party - dt)
      s.puff = Math.max(0, s.puff - dt)
      s.cry = Math.max(0, s.cry - dt)
      const elapsed = ROUND - s.t
      s.spawn -= dt * k
      if (s.spawn <= 0) {
        const r = rand(24, 42) * Math.min(1.1, Math.max(0.8, w / 800))
        s.bubbles.push({ x: rand(r, w - r), y: h + r, r, vy: rand(70, 120) * (1 + elapsed / 45), ph: rand(0, 6), kind: kindFor(elapsed), hue: pick(HUES) })
        s.spawn = Math.max(0.18, 0.5 - elapsed / 140) * rand(0.6, 1.3)
      }
      for (const b of s.bubbles) { b.y -= b.vy * dt * k; b.x += Math.sin(s.clock * 1.6 + b.ph) * 22 * dt * k }
      s.bubbles = s.bubbles.filter((b) => b.y > -b.r - 10)
      s.aim.x = Math.min(1, Math.max(0, s.aim.x + s.aim.vx * dt * 0.55))
      s.aim.y = Math.min(1, Math.max(0, s.aim.y + s.aim.vy * dt * 0.55 * (w / h)))
      if (s.t <= 0) {
        s.t = 0
        const record = submit(s.score)
        setResult({ score: s.score, popped: s.popped, combo: s.bestCombo, record })
        setPhase('over')
        sfx('end')
      }
      const mult = Math.min(5, 1 + Math.floor(s.combo / 4)) * (s.party > 0 ? 2 : 1)
      const ti = Math.ceil(s.t)
      setHud((p) => (p.score === s.score && p.t === ti && p.mult === mult ? p : { score: s.score, t: ti, mult }))
    }
    for (const r of s.rings) { r.r += 160 * dt; r.life -= dt }
    s.rings = s.rings.filter((r) => r.life > 0)
    for (const d of s.drops) { d.x += d.vx * dt; d.y += d.vy * dt; if (!d.text) d.vy += 420 * dt; d.life -= dt }
    s.drops = s.drops.filter((d) => d.life > 0)

    // ── draw ──
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    const bg = ctx.createLinearGradient(0, 0, w, h)
    bg.addColorStop(0, s.slow > 0 ? '#2b3a67' : '#3a2f7a')
    bg.addColorStop(1, s.party > 0 ? '#b33a8f' : '#6a3fa0')
    ctx.fillStyle = bg
    ctx.fillRect(0, 0, w, h)
    for (const b of s.bubbles) {
      const r = b.r
      const grd = ctx.createRadialGradient(b.x - r * 0.35, b.y - r * 0.4, r * 0.1, b.x, b.y, r)
      const special = b.kind !== 'n'
      grd.addColorStop(0, 'rgba(255,255,255,0.95)')
      grd.addColorStop(0.25, special ? 'rgba(255,255,255,0.55)' : `hsla(${b.hue} 95% 78% / 0.75)`)
      grd.addColorStop(1, special ? 'rgba(255,255,255,0.18)' : `hsla(${b.hue} 90% 55% / 0.55)`)
      ctx.fillStyle = grd
      ctx.beginPath(); ctx.arc(b.x, b.y, r, 0, Math.PI * 2); ctx.fill()
      ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.lineWidth = 1.5
      ctx.stroke()
      if (special) { ctx.font = `${r * 1.05}px ${EMOJI_FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(ICON[b.kind], b.x, b.y + 2) }
    }
    for (const r of s.rings) { ctx.strokeStyle = `hsla(${r.hue} 100% 85% / ${r.life * 2})`; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(r.x, r.y, r.r, 0, Math.PI * 2); ctx.stroke() }
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    for (const d of s.drops) {
      ctx.globalAlpha = Math.min(1, d.life * 2)
      if (d.text) { ctx.fillStyle = '#fff'; ctx.font = '800 17px system-ui, sans-serif'; ctx.fillText(d.text, d.x, d.y) }
      else { ctx.fillStyle = d.color; ctx.beginPath(); ctx.arc(d.x, d.y, 3, 0, Math.PI * 2); ctx.fill() }
    }
    ctx.globalAlpha = 1
    // the enormous pufferfish, and the onion tears
    if (s.puff > 0) {
      const a = Math.min(1, s.puff * 2)
      ctx.globalAlpha = a
      ctx.font = `${Math.min(w, h) * 0.62 * (reduced() ? 1 : 1 + Math.sin(s.puff * 6) * 0.03)}px ${EMOJI_FONT}`
      ctx.fillText('🐡', w / 2, h / 2)
      ctx.globalAlpha = 1
    }
    if (s.cry > 0) {
      ctx.fillStyle = `rgba(80,140,255,${Math.min(0.35, s.cry * 0.2)})`
      ctx.fillRect(0, 0, w, h)
      ctx.fillStyle = 'rgba(200,230,255,0.85)'
      for (let i = 0; i < 18; i++) { const x = (i * 97) % w, y = ((s.clock * 260 + i * 63) % (h + 40)) - 20; ctx.beginPath(); ctx.ellipse(x, y, 3, 6, 0, 0, Math.PI * 2); ctx.fill() }
    }
    if (s.aim.on && phaseRef.current === 'playing') {
      const ax = s.aim.x * w, ay = s.aim.y * h
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 2.5
      ctx.beginPath(); ctx.arc(ax, ay, 22, 0, Math.PI * 2); ctx.stroke()
      ctx.beginPath(); ctx.moveTo(ax - 30, ay); ctx.lineTo(ax - 14, ay); ctx.moveTo(ax + 14, ay); ctx.lineTo(ax + 30, ay); ctx.moveTo(ax, ay - 30); ctx.lineTo(ax, ay - 14); ctx.moveTo(ax, ay + 14); ctx.lineTo(ax, ay + 30); ctx.stroke()
    }
    if (s.slow > 0) { ctx.fillStyle = 'rgba(255,255,255,0.9)'; ctx.font = '700 13px system-ui, sans-serif'; ctx.textAlign = 'left'; ctx.fillText(`🐌 slow-mo ${s.slow.toFixed(1)}s`, 14, 20) }
    if (s.party > 0) { ctx.fillStyle = 'rgba(255,255,255,0.9)'; ctx.font = '700 13px system-ui, sans-serif'; ctx.textAlign = 'right'; ctx.fillText(`🎉 ×2 ${s.party.toFixed(1)}s`, w - 14, 20) }
  })

  return (
    <GameFrame id="pop" title="Pop the Chaos" score={hud.score} best={best} phase={phase} onBack={onBack} onPause={pause} onRestart={start}
      stats={<><span><small>Time</small><b data-time>{hud.t}s</b></span><span className={hud.mult > 1 ? 'is-hot' : ''}><small>Combo</small><b>×{hud.mult}</b></span></>}>
      <div
        className="jl-stage"
        ref={box}
        onPointerDown={(e) => {
          if ((e.target as HTMLElement).tagName !== 'CANVAS') return
          const r = cv.current!.getBoundingClientRect()
          g.current.aim.on = false
          popAt(e.clientX - r.left, e.clientY - r.top, e.pointerType === 'touch' ? 14 : 6)
        }}
      >
        <canvas ref={cv} aria-label="Pop the Chaos play area. Tap or click bubbles; or move the ring with the arrow keys and press Space." role="img" />
        {toast}
        {phase === 'ready' && (
          <Overlay tone="dark">
            <p className="jl-overlay__big">🫧💥🐡</p>
            <h3>Pop everything. Mostly.</h3>
            <p><b>⭐</b> bonus · <b>💥</b> chain reaction · <b>🐌</b> slow motion · <b>🎉</b> double points. Beware <b>🐡</b> and <b>🧅</b>.</p>
            <p className="jl-keys">Tap or click · arrows + <kbd>Space</kbd> · <kbd>P</kbd> pause</p>
            <button className="jl-play" onClick={start}>Start · {ROUND}s</button>
          </Overlay>
        )}
        {phase === 'paused' && <Overlay tone="dark"><h3>Paused</h3><p>The bubbles are hovering patiently.</p><button className="jl-play" onClick={pause}>Resume</button></Overlay>}
        {phase === 'over' && result && (
          <Overlay tone="dark">
            <p className="jl-overlay__big">{result.record ? '🏆' : '🫧'}</p>
            <h3>{result.record ? 'New personal best! Maximum chaos achieved.' : verdict(result.score)}</h3>
            <dl className="jl-results"><div><dt>Score</dt><dd>{result.score}</dd></div><div><dt>Popped</dt><dd>{result.popped}</dd></div><div><dt>Best combo</dt><dd>{result.combo}</dd></div></dl>
            <div className="jl-overlay__row"><button className="jl-play" onClick={start}>Play again</button><button className="jl-ghost" onClick={onBack}>Back to Joy Lab</button></div>
          </Overlay>
        )}
      </div>
    </GameFrame>
  )
}
