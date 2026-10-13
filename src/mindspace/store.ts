import { create } from 'zustand'

/** the applications on the spatial launcher, in launcher order */
export type AppId = 'about' | 'education' | 'experience' | 'projects' | 'gallery' | 'process' | 'skills' | 'games' | 'contact'

/**
 * Mindspace state, kept deliberately small and explicit:
 *   phase   intro → room (the intro can be skipped at any time)
 *   app     the one open application window (null = the launcher)
 *   closing the window is playing its close animation
 * The camera keeps its own state in CameraRig; `resetTick` asks it to go home.
 */
interface MindspaceState {
  phase: 'intro' | 'room'
  /** seconds into the intro, published a few times a second for the overlay copy */
  introBeat: number
  app: AppId | null
  /** where the window grows from: the launcher icon's centre on screen */
  origin: { x: number; y: number } | null
  closing: boolean
  resetTick: number
  /** the 3D scene could not start: the launcher is shown without the room */
  fallback: boolean
  /** the room's time of day (from the visitor's local clock) — the UI adapts its contrast to it */
  tod: 'morning' | 'afternoon' | 'evening' | 'night'
  setTod: (t: MindspaceState['tod']) => void
  enterRoom: () => void
  setBeat: (t: number) => void
  open: (id: AppId, origin?: { x: number; y: number } | null) => void
  /** switch to another app from inside a window (no close/open choreography) */
  swap: (id: AppId) => void
  close: () => void
  finishClose: () => void
  resetView: () => void
  setFallback: () => void
}

/**
 * The intro plays on every visit — following the link from the city or reloading the page.
 * Only `?intro=off` in the address (used by the automated checks) starts straight in the room.
 */
function introOff() {
  return new URLSearchParams(window.location.search).get('intro') === 'off'
}

export const reducedMotion = () => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches

export const useMindspace = create<MindspaceState>((set, get) => ({
  phase: introOff() || reducedMotion() ? 'room' : 'intro',
  introBeat: 0,
  app: null,
  origin: null,
  closing: false,
  resetTick: 0,
  fallback: false,
  tod: 'afternoon',
  setTod: (tod) => { if (get().tod !== tod) set({ tod }) },
  enterRoom: () => {
    if (get().phase !== 'room') set({ phase: 'room' })
  },
  setBeat: (t) => set({ introBeat: t }),
  open: (id, origin = null) => {
    if (get().phase !== 'room') return
    set({ app: id, origin, closing: false })
  },
  swap: (id) => set({ app: id, closing: false }),
  close: () => {
    if (!get().app || get().closing) return
    set({ closing: true })
  },
  finishClose: () => set({ app: null, closing: false, origin: null }),
  resetView: () => set((s) => ({ resetTick: s.resetTick + 1 })),
  setFallback: () => set({ fallback: true, phase: 'room' }),
}))
