import { useProgress } from '@react-three/drei'
import { useEffect, useRef, useState } from 'react'
import { useGameStore } from '@/stores/gameStore'

const MIN_TIME = 1900

/**
 * Covers the canvas until fonts, asset probes, city generation, physics and
 * shader compilation are all done. Progress is weighted by those milestones
 * (plus any GLB downloads) and eased so it never jumps or stalls visibly.
 */
export function LoadingScreen() {
  const loading = useGameStore((s) => s.loading)
  const phase = useGameStore((s) => s.phase)
  const setPhase = useGameStore((s) => s.setPhase)
  const { progress: assetProgress, active } = useProgress()
  const [shown, setShown] = useState(0)
  const [gone, setGone] = useState(false)
  const start = useRef(performance.now())

  let target = 4
  if (loading.fontsReady) target += 12
  if (loading.assetsProbed) target += 14
  if (loading.worldReady) target += 30
  if (loading.physicsReady) target += 15
  if (loading.compiled) target += 25
  if (active) target = Math.min(target, 40 + assetProgress * 0.5)
  const done = loading.fontsReady && loading.assetsProbed && loading.worldReady && loading.physicsReady && loading.compiled && !active

  useEffect(() => {
    let raf = 0
    const tick = () => {
      setShown((v) => {
        const next = v + (target - v) * 0.08 + (v < target ? 0.15 : 0)
        return Math.min(target, next)
      })
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [target])

  useEffect(() => {
    if (!done || phase !== 'loading') return
    const wait = Math.max(0, MIN_TIME - (performance.now() - start.current))
    const t = setTimeout(() => {
      if (shown > 98 || target >= 100) setPhase('intro')
    }, wait + 250)
    return () => clearTimeout(t)
  }, [done, phase, shown, target, setPhase])

  useEffect(() => {
    if (phase === 'loading') return
    const t = setTimeout(() => setGone(true), 1100)
    return () => clearTimeout(t)
  }, [phase])

  if (gone) return null
  const stage = !loading.fontsReady || !loading.assetsProbed
    ? 'Loading environment…'
    : !loading.worldReady
      ? 'Building the city…'
      : !loading.physicsReady
        ? 'Loading character…'
        : !loading.compiled
          ? 'Preparing experience…'
          : 'Welcome'
  const pct = Math.round(shown)
  return (
    <div className={`ui-loading ${phase !== 'loading' ? 'is-done' : ''}`} role="status" aria-live="polite" aria-label={`Loading experience, ${pct} percent. ${stage}`}>
      <div className="ui-loading__inner">
        <div className="ui-loading__mark" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
        <p className="ui-loading__brand">Mindscape <b>AVENUE</b></p>
        <p className="ui-loading__title">LOADING EXPERIENCE</p>
        <div className="ui-loading__bar" aria-hidden="true">
          <div className="ui-loading__fill" style={{ transform: `scaleX(${shown / 100})` }} />
        </div>
        <div className="ui-loading__meta">
          <span>{stage}</span>
          <span>{pct}%</span>
        </div>
      </div>
    </div>
  )
}
