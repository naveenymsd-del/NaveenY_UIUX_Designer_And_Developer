import { type ReactNode, type RefObject, useCallback, useEffect, useRef, useState } from 'react'

/** Joy Lab shared bits: best scores, a crisp canvas that follows its box, the game frame. */
export type GameId = 'emoji' | 'tower' | 'pop'
export type Phase = 'ready' | 'playing' | 'paused' | 'over'

const KEY = (id: GameId) => `joylab:best:${id}`
export function readBest(id: GameId) {
  try {
    return Number(localStorage.getItem(KEY(id))) || 0
  } catch {
    return 0
  }
}
/** the personal best; `submit` stores a new one and says whether it was beaten */
export function useBest(id: GameId) {
  const [best, setBest] = useState(() => readBest(id))
  const submit = useCallback((score: number) => {
    if (score <= readBest(id)) return false
    try { localStorage.setItem(KEY(id), String(score)) } catch { /* storage blocked: the best lasts this visit */ }
    setBest(score)
    return true
  }, [id])
  return [best, submit] as const
}

export const reduced = () => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches
export const rand = (a: number, b: number) => a + Math.random() * (b - a)
export const pick = <T,>(a: readonly T[]) => a[Math.floor(Math.random() * a.length)]
export const EMOJI_FONT = '"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif'

/**
 * A canvas that fills its box at the device's pixel density. `size.current`
 * holds the box in CSS pixels; drawing code works in CSS pixels.
 */
export function useCanvas(box: RefObject<HTMLDivElement | null>, cv: RefObject<HTMLCanvasElement | null>) {
  const size = useRef({ w: 600, h: 400, dpr: 1 })
  useEffect(() => {
    const el = box.current, c = cv.current
    if (!el || !c) return
    const fit = () => {
      const r = el.getBoundingClientRect()
      const dpr = Math.min(2, window.devicePixelRatio || 1)
      size.current = { w: Math.max(200, r.width), h: Math.max(200, r.height), dpr }
      c.width = Math.round(size.current.w * dpr)
      c.height = Math.round(size.current.h * dpr)
    }
    fit()
    const ro = new ResizeObserver(fit)
    ro.observe(el)
    return () => ro.disconnect()
  }, [box, cv])
  return size
}

/** one rAF loop for the life of the game; `step(dt)` gets seconds (clamped) */
export function useLoop(step: (dt: number) => void) {
  const fn = useRef(step)
  fn.current = step
  useEffect(() => {
    let raf = 0, last = performance.now()
    const tick = (now: number) => {
      fn.current(Math.min(0.05, (now - last) / 1000))
      last = now
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [])
}

/** pause when the tab is hidden (nobody likes losing a round to a notification) */
export function usePauseOnHide(phase: Phase, pause: () => void) {
  useEffect(() => {
    const onVis = () => { if (document.hidden && phase === 'playing') pause() }
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [phase, pause])
}

interface FrameProps {
  id: GameId
  title: string
  score: number
  best: number
  stats?: ReactNode
  phase: Phase
  onBack: () => void
  onPause: () => void
  onRestart: () => void
  children: ReactNode
}
/** the shared game frame: back to Joy Lab, score / best, pause and restart */
export function GameFrame({ id, title, score, best, stats, phase, onBack, onPause, onRestart, children }: FrameProps) {
  return (
    <div className={`jl-game jl-game--${id}`} data-keys-own data-phase={phase}>
      <header className="jl-hud">
        <button className="jl-back" onClick={onBack}>
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 6l-6 6 6 6" /></svg>Joy Lab
        </button>
        <h2>{title}</h2>
        <div className="jl-hud__stats" aria-live="off">
          <span><small>Score</small><b data-score>{score}</b></span>
          {stats}
          <span><small>Best</small><b>{best}</b></span>
        </div>
        <div className="jl-hud__ctl">
          <button onClick={onPause} disabled={phase !== 'playing' && phase !== 'paused'} aria-label={phase === 'paused' ? 'Resume' : 'Pause'} title={phase === 'paused' ? 'Resume (P)' : 'Pause (P)'}>
            <svg viewBox="0 0 24 24" aria-hidden="true">{phase === 'paused' ? <path d="M8 5.5v13l10.5-6.5z" className="is-fill" /> : <path d="M8 5.5v13M16 5.5v13" />}</svg>
          </button>
          <button onClick={onRestart} aria-label="Restart" title="Restart (R)">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4.5 12a7.5 7.5 0 1 0 2.2-5.3M4.5 4.5v3.8h3.8" /></svg>
          </button>
        </div>
      </header>
      {children}
    </div>
  )
}

export function Overlay({ children, tone = 'light' }: { children: ReactNode; tone?: 'light' | 'dark' }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => { ref.current?.querySelector<HTMLElement>('button')?.focus({ preventScroll: true }) }, [])
  return <div className={`jl-overlay jl-overlay--${tone}`} ref={ref}>{children}</div>
}

/** a short floating message ("Combo ×3!", "Ouch, grumpy!") that fades by itself */
export function useToast() {
  const [toast, setToast] = useState<{ text: string; key: number; tone: 'good' | 'bad' | 'info' } | null>(null)
  const t = useRef(0)
  const say = useCallback((text: string, tone: 'good' | 'bad' | 'info' = 'info') => {
    setToast({ text, key: Date.now(), tone })
    clearTimeout(t.current)
    t.current = window.setTimeout(() => setToast(null), 1400)
  }, [])
  useEffect(() => () => clearTimeout(t.current), [])
  const node = toast ? <p key={toast.key} className={`jl-toast is-${toast.tone}`} role="status">{toast.text}</p> : null
  return [say, node] as const
}
