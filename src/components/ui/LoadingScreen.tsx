import { useProgress } from '@react-three/drei'
import { useEffect, useRef, useState } from 'react'
import { useGameStore } from '@/stores/gameStore'
import { useUIStore } from '@/stores/uiStore'

/**
 * The rain-covered glass opening is switched off: the site opens straight into
 * the existing experience. Set to true to bring the glass back (nothing else changes).
 */
const RAIN_GLASS = false

/** a hands-off visitor sees the glass clear in about this long */
const AUTO_MS = 7000
/** until the world is ready the glass only clears this far (no blank screen behind it) */
const PRE_READY_CAP = 0.42
/** with the glass this clear (and the world ready) the opening cinematic takes over */
const HANDOFF_AT = 0.86

/**
 * The opening: the world seen through a rain-covered window. Droplets and
 * condensation sit on a frosted pane over the (blurred) live 3D canvas; the
 * pointer — a mouse moving, or a finger swiping — wipes it clear, and the pane
 * also clears by itself in ~7 s. One small mask canvas carries both: wipes are
 * painted into it, the automatic evaporation is composed on top, and the pane
 * (blurred world, fog, droplets) is cut by it on one canvas.
 * Readiness is the same as before (fonts, assets, city, physics, shaders,
 * downloads); until then a soft blue-grey cover stands in for the scene.
 */
export function LoadingScreen() {
  return RAIN_GLASS ? <RainGlass /> : <DirectStart />
}

/**
 * No splash: a plain cover in the world's own haze colour (no text, logo or
 * progress) holds only until the same readiness flags are met, then fades as the
 * existing opening flight begins — so there is never a blank or half-built frame.
 */
function DirectStart() {
  const loading = useGameStore((s) => s.loading)
  const phase = useGameStore((s) => s.phase)
  const setPhase = useGameStore((s) => s.setPhase)
  const onboarding = useUIStore((s) => s.onboarding)
  const { active } = useProgress()
  const [gone, setGone] = useState(false)
  const done = loading.fontsReady && loading.assetsProbed && loading.worldReady && loading.physicsReady && loading.compiled && !active

  // a first visit reads the "how it works" guide first; the opening flight starts when they enter
  useEffect(() => {
    if (done && !onboarding && phase === 'loading') setPhase('intro')
  }, [done, onboarding, phase, setPhase])
  useEffect(() => {
    if (phase === 'loading') return
    const t = setTimeout(() => setGone(true), 1800)
    return () => clearTimeout(t)
  }, [phase])

  if (gone) return null
  return (
    <div
      className={`ui-loading ui-start ${phase !== 'loading' ? 'is-done' : ''}`}
      role="status"
      aria-live="polite"
      aria-label={done ? 'Naveen’s interactive portfolio is ready.' : 'Loading Naveen’s interactive portfolio.'}
    />
  )
}

function RainGlass() {
  const loading = useGameStore((s) => s.loading)
  const phase = useGameStore((s) => s.phase)
  const setPhase = useGameStore((s) => s.setPhase)
  const { active } = useProgress()
  const [gone, setGone] = useState(false)
  const root = useRef<HTMLDivElement>(null)
  const view = useRef<HTMLCanvasElement>(null)
  const done = loading.fontsReady && loading.assetsProbed && loading.worldReady && loading.physicsReady && loading.compiled && !active
  const readyRef = useRef(done)
  readyRef.current = done
  const [ready, setReady] = useState(false)
  useEffect(() => { if (done) setReady(true) }, [done])

  useEffect(() => {
    const el = root.current, out = view.current
    if (!el || !out) return
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches
    const octx = out.getContext('2d')!
    // static pane (fog + droplets), painted once per size
    const glass = document.createElement('canvas'), gctx = glass.getContext('2d')!
    // the live world, shrunk (that's the blur) — two steps so the upscale stays soft
    const tiny = document.createElement('canvas'), tctx = tiny.getContext('2d')!
    const soft = document.createElement('canvas'), sctx2 = soft.getContext('2d')!
    const manual = document.createElement('canvas'), mctx = manual.getContext('2d')!
    const mask = document.createElement('canvas'), kctx = mask.getContext('2d')!
    let W = 0, H = 0, dpr = 1, mw = 160, mh = 90
    let sliders: Slider[] = []
    let laidOut = false
    let blobs: Blob[] = []

    const layout = () => {
      W = innerWidth
      H = innerHeight
      dpr = Math.min(devicePixelRatio || 1, 1.5)
      for (const c of [out, glass]) {
        c.width = Math.round(W * dpr)
        c.height = Math.round(H * dpr)
      }
      tiny.width = Math.max(8, Math.round(W / 24))
      tiny.height = Math.max(8, Math.round(H / 24))
      soft.width = Math.max(16, Math.round(W / 6))
      soft.height = Math.max(16, Math.round(H / 6))
      // keep what was wiped when the window resizes or the phone rotates
      const old = laidOut ? manual : null
      const prev = old ? Object.assign(document.createElement('canvas'), { width: old.width, height: old.height }) : null
      if (prev && old) prev.getContext('2d')!.drawImage(old, 0, 0)
      mw = 160
      mh = Math.max(60, Math.round((160 * H) / Math.max(1, W)))
      manual.width = mask.width = mw
      manual.height = mask.height = mh
      mctx.fillStyle = '#fff'
      mctx.fillRect(0, 0, mw, mh)
      if (prev) {
        mctx.globalCompositeOperation = 'copy'
        mctx.drawImage(prev, 0, 0, mw, mh)
        mctx.globalCompositeOperation = 'source-over'
      }
      laidOut = true
      paintGlass(gctx, W * dpr, H * dpr, dpr)
      sliders = reduced ? [] : makeSliders(W * dpr, H * dpr, dpr)
      blobs = makeBlobs()
    }

    /** blur the live 3D canvas behind the pane; false if it can't be read yet */
    const world = document.querySelector<HTMLCanvasElement>('.game-canvas canvas')
    let worldOk = false
    const blurWorld = () => {
      if (!world || !world.width) return false
      try {
        tctx.drawImage(world, 0, 0, tiny.width, tiny.height)
        if (!worldOk) {
          // a blank (unreadable) frame comes back fully black — don't show that
          const px = tctx.getImageData(tiny.width >> 1, tiny.height >> 2, 1, 1).data
          if (px[0] + px[1] + px[2] < 12) return false
          worldOk = true
        }
        sctx2.imageSmoothingQuality = 'high'
        sctx2.drawImage(tiny, 0, 0, soft.width, soft.height)
        return true
      } catch {
        return false
      }
    }
    // ── wiping ───────────────────────────────────────────────────────────
    let boost = 0
    let last: { x: number; y: number } | null = null
    const stamp = (x: number, y: number) => {
      const r = Math.min(mw, mh) * 0.1
      const g = mctx.createRadialGradient(x, y, 0, x, y, r)
      g.addColorStop(0, 'rgba(0,0,0,0.85)')
      g.addColorStop(0.55, 'rgba(0,0,0,0.45)')
      g.addColorStop(1, 'rgba(0,0,0,0)')
      mctx.globalCompositeOperation = 'destination-out'
      mctx.fillStyle = g
      mctx.fillRect(x - r, y - r, r * 2, r * 2)
      mctx.globalCompositeOperation = 'source-over'
    }
    const wipe = (e: PointerEvent) => {
      const x = (e.clientX / W) * mw, y = (e.clientY / H) * mh
      const step = Math.min(mw, mh) * 0.035
      if (last) {
        const d = Math.hypot(x - last.x, y - last.y)
        const n = Math.min(40, Math.ceil(d / step))
        for (let i = 1; i <= n; i++) stamp(last.x + ((x - last.x) * i) / n, last.y + ((y - last.y) * i) / n)
        boost = Math.min(3, boost + d / mw * 1.6)
      } else stamp(x, y)
      last = { x, y }
    }
    const lift = () => { last = null }
    const key = () => { boost = 3 }
    el.addEventListener('pointermove', wipe)
    el.addEventListener('pointerdown', wipe)
    el.addEventListener('pointerup', lift)
    el.addEventListener('pointercancel', lift)
    el.addEventListener('pointerleave', lift)
    addEventListener('keydown', key)

    // ── resize / rotate ──────────────────────────────────────────────────
    let rt = 0
    const onResize = () => {
      clearTimeout(rt)
      rt = window.setTimeout(layout, 120)
    }
    addEventListener('resize', onResize)
    addEventListener('orientationchange', onResize)
    layout()

    // ── the clock: evaporation + the hand-off ────────────────────────────
    let p = 0
    let prevT = performance.now()
    let handed = false
    let raf = 0
    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - prevT) / 1000)
      prevT = now
      boost *= Math.pow(0.25, dt)
      const cap = readyRef.current ? 1 : PRE_READY_CAP
      if (p < cap) p = Math.min(cap, p + (dt * 1000 / AUTO_MS) * (1 + boost))
      else if (!readyRef.current) p = cap
      const w = out.width, h = out.height
      octx.globalCompositeOperation = 'source-over'
      octx.clearRect(0, 0, w, h)
      // behind the pane: the live world, out of focus (until it's ready the cover shows through)
      if (readyRef.current && blurWorld()) {
        octx.imageSmoothingQuality = 'high'
        octx.drawImage(soft, 0, 0, w, h)
        octx.fillStyle = 'rgba(96, 116, 136, 0.34)'
        octx.fillRect(0, 0, w, h)
      }
      octx.drawImage(glass, 0, 0)
      if (!reduced) drawSliders(octx, sliders, dt, w, h)
      // wipes + evaporation cut the pane away
      composeMask(kctx, manual, blobs, p, mw, mh, reduced)
      octx.globalCompositeOperation = 'destination-in'
      octx.imageSmoothingQuality = 'high'
      octx.drawImage(mask, 0, 0, w, h)
      octx.globalCompositeOperation = 'source-over'
      if (!handed && readyRef.current && p >= HANDOFF_AT && useGameStore.getState().phase === 'loading') {
        handed = true
        setPhase('intro')
      }
      if (p < 1 || useGameStore.getState().phase === 'loading') raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)

    return () => {
      cancelAnimationFrame(raf)
      clearTimeout(rt)
      el.removeEventListener('pointermove', wipe)
      el.removeEventListener('pointerdown', wipe)
      el.removeEventListener('pointerup', lift)
      el.removeEventListener('pointercancel', lift)
      el.removeEventListener('pointerleave', lift)
      removeEventListener('keydown', key)
      removeEventListener('resize', onResize)
      removeEventListener('orientationchange', onResize)
    }
  }, [setPhase])

  useEffect(() => {
    if (phase === 'loading') return
    const t = setTimeout(() => setGone(true), 1800)
    return () => clearTimeout(t)
  }, [phase])

  if (gone) return null
  return (
    <div
      ref={root}
      className={`ui-loading ui-rain ${phase !== 'loading' ? 'is-done' : ''} ${ready ? 'is-ready' : ''}`}
      role="status"
      aria-live="polite"
      aria-label={ready ? 'Naveen’s interactive portfolio is ready.' : 'Loading Naveen’s interactive portfolio.'}
    >
      <div className="ui-rain__cover" aria-hidden="true" />
      <canvas ref={view} className="ui-rain__glass" aria-hidden="true" />
    </div>
  )
}

// ── the pane ─────────────────────────────────────────────────────────────

let seed = 11
const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)

/** condensation, slide trails and droplets, painted once per size */
function paintGlass(ctx: CanvasRenderingContext2D, w: number, h: number, dpr: number) {
  seed = 11
  ctx.clearRect(0, 0, w, h)
  const s = (Math.min(w, h) / dpr / 900) * dpr
  const area = w * h / (dpr * dpr)

  // the misted film: cool, slightly brighter at the top where the light is
  const fog = ctx.createLinearGradient(0, 0, 0, h)
  fog.addColorStop(0, 'rgba(214, 226, 236, 0.30)')
  fog.addColorStop(0.6, 'rgba(176, 194, 210, 0.24)')
  fog.addColorStop(1, 'rgba(150, 170, 188, 0.30)')
  ctx.fillStyle = fog
  ctx.fillRect(0, 0, w, h)

  // micro-condensation
  const micro = Math.min(16000, area / 150)
  for (let i = 0; i < micro; i++) {
    const x = rnd() * w, y = rnd() * h, r = (0.35 + rnd() * 1.1) * dpr
    ctx.fillStyle = `rgba(28, 40, 54, ${0.12 + rnd() * 0.14})`
    ctx.beginPath(); ctx.arc(x, y + r * 0.3, r, 0, Math.PI * 2); ctx.fill()
    ctx.fillStyle = `rgba(236, 244, 250, ${0.18 + rnd() * 0.25})`
    ctx.beginPath(); ctx.arc(x - r * 0.25, y - r * 0.25, r * 0.55, 0, Math.PI * 2); ctx.fill()
  }

  // trails where drops have already run down the glass
  const trails = Math.round(3 + w / dpr / 420)
  ctx.globalCompositeOperation = 'destination-out'
  for (let i = 0; i < trails; i++) {
    let x = rnd() * w
    const y0 = rnd() * h * 0.5, len = h * (0.25 + rnd() * 0.5), wd = (3 + rnd() * 4) * s
    ctx.strokeStyle = 'rgba(0,0,0,0.5)'
    ctx.lineWidth = wd
    ctx.lineCap = 'round'
    ctx.beginPath()
    ctx.moveTo(x, y0)
    for (let y = y0; y < y0 + len; y += 14 * dpr) {
      x += (rnd() - 0.5) * 3 * dpr
      ctx.lineTo(x, y)
    }
    ctx.stroke()
  }
  ctx.globalCompositeOperation = 'source-over'

  // droplets: many small, some medium, a few large
  const smallN = Math.min(1400, area / 1500)
  for (let i = 0; i < smallN; i++) drawDrop(ctx, rnd() * w, rnd() * h, (1.6 + rnd() * 3.2) * s)
  const midN = Math.min(420, area / 5200)
  for (let i = 0; i < midN; i++) drawDrop(ctx, rnd() * w, rnd() * h, (4.5 + rnd() * 5) * s)
  const bigN = Math.min(48, area / 42000)
  for (let i = 0; i < bigN; i++) drawDrop(ctx, rnd() * w, rnd() * h, (9 + rnd() * 9) * s)
}

/** one refracting droplet: dark rim below, light pooled at the bottom (the inverted sky), a sharp highlight on top */
function drawDrop(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, k = 1.04 + rnd() * 0.22) {
  const ry = r * k
  // body + rim
  const body = ctx.createRadialGradient(x, y - ry * 0.15, r * 0.1, x, y, r * 1.08)
  body.addColorStop(0, 'rgba(120, 140, 160, 0.10)')
  body.addColorStop(0.7, 'rgba(40, 56, 72, 0.22)')
  body.addColorStop(1, 'rgba(14, 22, 32, 0.55)')
  ctx.fillStyle = body
  ctx.beginPath(); ctx.ellipse(x, y, r, ry, 0, 0, Math.PI * 2); ctx.fill()
  // refracted light pooled low in the drop
  const pool = ctx.createRadialGradient(x, y + ry * 0.42, 0, x, y + ry * 0.42, r * 0.85)
  pool.addColorStop(0, 'rgba(226, 236, 246, 0.55)')
  pool.addColorStop(1, 'rgba(226, 236, 246, 0)')
  ctx.fillStyle = pool
  ctx.beginPath(); ctx.ellipse(x, y, r * 0.92, ry * 0.92, 0, 0, Math.PI * 2); ctx.fill()
  // specular highlight
  if (r > 1.4) {
    ctx.fillStyle = 'rgba(255, 255, 255, 0.85)'
    ctx.beginPath(); ctx.ellipse(x - r * 0.32, y - ry * 0.42, r * 0.24, r * 0.14, -0.6, 0, Math.PI * 2); ctx.fill()
  }
  if (r > 5) {
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.16)'
    ctx.lineWidth = Math.max(0.6, r * 0.06)
    ctx.beginPath(); ctx.ellipse(x, y, r * 0.96, ry * 0.96, 0, 0.15 * Math.PI, 0.85 * Math.PI); ctx.stroke()
  }
}

// ── a few drops running down the pane (stick, then slip) ─────────────────

interface Slider { x: number; y: number; r: number; v: number; hold: number }
function makeSliders(w: number, h: number, dpr: number): Slider[] {
  const s = (Math.min(w, h) / dpr / 900) * dpr
  return Array.from({ length: Math.round(3 + w / dpr / 420) }, () => ({ x: rnd() * w, y: rnd() * h * 0.6, r: (7 + rnd() * 6) * s, v: 0, hold: rnd() * 2 }))
}
function drawSliders(ctx: CanvasRenderingContext2D, list: Slider[], dt: number, w: number, h: number) {
  for (const d of list) {
    if (d.hold > 0) {
      d.hold -= dt
      d.v = 0
    } else {
      d.v = Math.min(h * 0.35, d.v + h * 0.6 * dt)
      d.y += d.v * dt
      d.x += (Math.random() - 0.5) * d.r * 0.15
      if (Math.random() < dt * 1.2) d.hold = 0.3 + Math.random() * 1.4
      if (d.y > h + d.r * 2) {
        d.y = -d.r * 2
        d.x = Math.random() * w
      }
    }
    drawDrop(ctx, d.x, d.y, d.r, 1.18)
  }
}

// ── the mask: wipes, then evaporation patches growing over the pane ──────

interface Blob { x: number; y: number; rate: number }
function makeBlobs(): Blob[] {
  return [
    { x: 0.5, y: 0.48, rate: 1.0 },
    { x: 0.22, y: 0.3, rate: 0.75 },
    { x: 0.8, y: 0.34, rate: 0.8 },
    { x: 0.3, y: 0.78, rate: 0.7 },
    { x: 0.76, y: 0.74, rate: 0.72 },
  ]
}
function smooth(a: number, b: number, v: number) {
  const t = Math.min(1, Math.max(0, (v - a) / (b - a)))
  return t * t * (3 - 2 * t)
}
function composeMask(ctx: CanvasRenderingContext2D, manual: HTMLCanvasElement, blobs: Blob[], p: number, mw: number, mh: number, reduced: boolean) {
  ctx.clearRect(0, 0, mw, mh)
  ctx.globalAlpha = 1 - smooth(reduced ? 0.3 : 0.72, 1, p)
  ctx.drawImage(manual, 0, 0)
  ctx.globalAlpha = 1
  if (reduced) return
  const diag = Math.hypot(mw, mh)
  ctx.globalCompositeOperation = 'destination-out'
  for (const b of blobs) {
    const r = Math.max(0.01, smooth(0.04, 1, p * b.rate * 1.05) * diag * 0.62)
    const x = b.x * mw, y = b.y * mh
    const g = ctx.createRadialGradient(x, y, r * 0.35, x, y, r)
    g.addColorStop(0, 'rgba(0,0,0,1)')
    g.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, mw, mh)
  }
  ctx.globalCompositeOperation = 'source-over'
}
