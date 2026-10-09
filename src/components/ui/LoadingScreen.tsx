import { useProgress } from '@react-three/drei'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useGameStore } from '@/stores/gameStore'
import { CompanionGlyph } from './CompanionGlyph'

/** long enough for the opening to play: the companion, the name, one round of greetings */
const MIN_TIME = 4600
/** welcome — in English, Telugu (Naveen's home language) and Hindi */
const GREETINGS: { text: string; lang: string }[] = [
  { text: 'Welcome', lang: 'en' },
  { text: 'స్వాగతం', lang: 'te' },
  { text: 'स्वागत है', lang: 'hi' },
]
const RING = 2 * Math.PI * 54

/**
 * The opening scene. Darkness, a few drifting motes of light, then the
 * orange companion wakes and looks around; the name arrives, the welcome
 * passes through three languages, and the city on the horizon lights up
 * window by window as the world is built — that, and the thin ring around the
 * companion, are the progress. No bar in the middle of the screen.
 * Progress is weighted by real milestones (fonts, asset probe, city build,
 * physics, shader compile, GLB downloads) and eased so it never jumps.
 */
export function LoadingScreen() {
  const loading = useGameStore((s) => s.loading)
  const phase = useGameStore((s) => s.phase)
  const setPhase = useGameStore((s) => s.setPhase)
  const { progress: assetProgress, active } = useProgress()
  const [shown, setShown] = useState(0)
  const [gone, setGone] = useState(false)
  const [ready, setReady] = useState(false)
  const [hello, setHello] = useState(0)
  const start = useRef(performance.now())

  let target = 4
  if (loading.fontsReady) target += 10
  if (loading.assetsProbed) target += 12
  if (loading.worldReady) target += 32
  if (loading.physicsReady) target += 16
  if (loading.compiled) target += 26
  if (active) target = Math.min(target, 40 + assetProgress * 0.5)
  const done = loading.fontsReady && loading.assetsProbed && loading.worldReady && loading.physicsReady && loading.compiled && !active

  useEffect(() => {
    let raf = 0
    const tick = () => {
      setShown((v) => Math.min(target, v + (target - v) * 0.06 + (v < target ? 0.12 : 0)))
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [target])

  // the welcome, once in each language (it begins after the name has arrived)
  useEffect(() => {
    if (ready) return
    const t = setInterval(() => setHello((h) => h + 1), 1350)
    return () => clearInterval(t)
  }, [ready])

  // the companion introduces the world, then the cinematic takes over
  useEffect(() => {
    if (!done || phase !== 'loading' || shown < 99.5) return
    const wait = Math.max(0, MIN_TIME - (performance.now() - start.current))
    const t1 = setTimeout(() => setReady(true), wait)
    const t2 = setTimeout(() => setPhase('intro'), wait + 1500)
    return () => {
      clearTimeout(t1)
      clearTimeout(t2)
    }
  }, [done, phase, shown, setPhase])

  useEffect(() => {
    if (phase === 'loading') return
    const t = setTimeout(() => setGone(true), 1800)
    return () => clearTimeout(t)
  }, [phase])

  const skyline = useMemo(buildSkyline, [])
  if (gone) return null
  const stage = ready
    ? 'Ready.'
    : !loading.fontsReady || !loading.assetsProbed
      ? 'Preparing the neighbourhood…'
      : !loading.worldReady
        ? 'Preparing the people…'
        : !loading.physicsReady
          ? 'Preparing the office…'
          : !loading.compiled
            ? 'Preparing the projects…'
            : 'Preparing your guide…'
  const pct = Math.round(shown)
  const lit = shown / 100
  // the greeting starts once the name is in (~2.4 s), then cycles
  const g = GREETINGS[Math.max(0, hello - 1) % GREETINGS.length]
  return (
    <div
      className={`ui-loading ui-splash ${phase !== 'loading' ? 'is-done' : ''} ${ready ? 'is-ready' : ''}`}
      role="status"
      aria-live="polite"
      aria-label={`Naveen — interactive portfolio. Preparing your journey, ${pct} percent. ${stage}`}
      style={{ ['--lit' as string]: lit }}
    >
      <div className="ui-splash__glow" aria-hidden="true" />
      <div className="ui-loading__dust" aria-hidden="true">
        {Array.from({ length: 30 }, (_, i) => <span key={i} style={{ ['--i' as string]: i }} />)}
      </div>
      <svg className="ui-loading__city" viewBox="0 0 1600 360" preserveAspectRatio="xMidYMax slice" aria-hidden="true">
        <defs>
          <linearGradient id="ld-fade" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#1b2029" />
            <stop offset="1" stopColor="#0d1015" />
          </linearGradient>
        </defs>
        {skyline.buildings.map((b, i) => <rect key={i} x={b.x} y={360 - b.h} width={b.w} height={b.h} fill={b.far ? '#141820' : 'url(#ld-fade)'} />)}
        {skyline.windows.map((w, i) => (
          <rect key={i} x={w.x} y={w.y} width={3} height={4} className={w.at < lit ? 'is-on' : ''} style={{ transitionDelay: `${(w.at * 900) % 700}ms` }} />
        ))}
      </svg>
      <div className="ui-splash__inner">
        <div className="ui-splash__guide" aria-hidden="true">
          <svg className="ui-splash__ring" viewBox="0 0 120 120">
            <circle cx="60" cy="60" r="54" className="ui-splash__track" />
            <circle cx="60" cy="60" r="54" className="ui-splash__arc" style={{ strokeDasharray: RING, strokeDashoffset: RING * (1 - shown / 100) }} />
          </svg>
          <CompanionGlyph awake size={78} />
        </div>
        <p className="ui-splash__brand" aria-hidden="true">
          {'NAVEEN'.split('').map((c, i) => <span key={i} style={{ ['--n' as string]: i }}>{c}</span>)}
        </p>
        <p className="ui-splash__title">Interactive portfolio</p>
        <p className="ui-splash__hello" lang={g.lang} key={`${hello}-${ready}`}>
          {ready ? 'Welcome to Naveen’s world.' : hello === 0 ? ' ' : g.text}
        </p>
        <p className="ui-splash__stage">
          <span key={stage}>{ready ? 'Your journey begins.' : stage}</span>
        </p>
      </div>
    </div>
  )
}

/** deterministic skyline silhouette with windows that switch on in progress order */
function buildSkyline() {
  let seed = 7
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
  const buildings: { x: number; w: number; h: number; far: boolean }[] = []
  const windows: { x: number; y: number; at: number }[] = []
  for (const far of [true, false]) {
    let x = -20
    while (x < 1620) {
      const w = far ? 50 + rnd() * 70 : 60 + rnd() * 90
      const h = far ? 120 + rnd() * 150 : 60 + rnd() * 140
      buildings.push({ x, w, h, far })
      if (!far) {
        for (let wy = 360 - h + 14; wy < 346; wy += 14)
          for (let wx = x + 10; wx < x + w - 10; wx += 12) if (rnd() < 0.34) windows.push({ x: wx, y: wy, at: rnd() * 0.96 })
      }
      x += w + (far ? 4 : 10 + rnd() * 20)
    }
  }
  return { buildings, windows }
}
