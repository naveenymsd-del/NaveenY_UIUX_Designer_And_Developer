import { create } from 'zustand'
import type { CameraShot } from '@/data/locations'
import type { InteriorId } from '@/data/interiors'

export type Phase = 'loading' | 'intro' | 'transition' | 'playing'
export type Mode = 'street' | 'projects'
/** the journey's milestones (drives companion guidance and the menu's progress) */
export type Place = 'education' | 'home' | 'office' | 'park' | 'ai' | 'projects' | 'final'

export interface LoadingState {
  worldReady: boolean
  physicsReady: boolean
  assetsProbed: boolean
  fontsReady: boolean
  compiled: boolean
  progress: number
  stage: string
}

interface GameState {
  phase: Phase
  mode: Mode
  loading: LoadingState
  /** interactive id currently in range of the player */
  nearbyId: string | null
  /** location panel open */
  activeLocationId: string | null
  /** project panel open */
  activeProjectId: string | null
  /** project highlighted in projects mode (camera focus) */
  focusedProjectId: string | null
  zoneToast: { id: string; name: string; subtitle: string; at: number } | null
  visitedZones: string[]
  tipsOpen: boolean
  /** an explicit camera shot request (menu quick-travel previews etc.) */
  shotOverride: CameraShot | null
  /** interior the player is currently inside (null = street) */
  interior: InteriorId | null
  /** performance.now() when the current interior was entered */
  interiorSince: number
  /** full-screen fade used by building transitions */
  fade: boolean
  /** establishing camera shot after entering a room */
  establishing: InteriorId | null
  /** named spot inside the room the establishing shot frames (e.g. the Project Studio) */
  establishSpot: string | null
  discovered: Place[]
  /** location whose camera shot is shown during an approach (before a fade) */
  cameraShot: string | null
  /** feedback pulses consumed by fx */
  pulse: { kind: 'open' | 'close' | 'enter' | 'select'; at: number } | null

  setLoading: (patch: Partial<LoadingState>) => void
  /** low-level patch for orchestration code (transitions) */
  setState: (patch: Partial<GameState>) => void
  setPhase: (phase: Phase) => void
  setMode: (mode: Mode) => void
  setNearby: (id: string | null) => void
  openLocation: (id: string) => void
  openProject: (id: string) => void
  focusProject: (id: string | null) => void
  closePanels: () => void
  showZone: (id: string, name: string, subtitle: string) => void
  clearZoneToast: () => void
  setTipsOpen: (open: boolean) => void
  firePulse: (kind: 'open' | 'close' | 'enter' | 'select') => void
  discover: (place: Place) => void
}

export const useGameStore = create<GameState>((set, get) => ({
  phase: 'loading',
  mode: 'street',
  loading: {
    worldReady: false, physicsReady: false, assetsProbed: false, fontsReady: false, compiled: false,
    progress: 0, stage: 'Loading environment…',
  },
  nearbyId: null,
  activeLocationId: null,
  activeProjectId: null,
  focusedProjectId: null,
  zoneToast: null,
  visitedZones: [],
  tipsOpen: false,
  shotOverride: null,
  interior: null,
  interiorSince: 0,
  fade: false,
  establishing: null,
  establishSpot: null,
  discovered: [],
  cameraShot: null,
  pulse: null,

  setLoading: (patch) => set((s) => ({ loading: { ...s.loading, ...patch } })),
  setState: (patch) => set(patch),
  setPhase: (phase) => set({ phase }),
  setMode: (mode) => {
    if (get().mode === mode) return
    set({ mode, activeLocationId: null, activeProjectId: null, focusedProjectId: null })
  },
  setNearby: (id) => {
    if (get().nearbyId !== id) set({ nearbyId: id })
  },
  openLocation: (id) => set({ activeLocationId: id, activeProjectId: null, pulse: { kind: 'open', at: performance.now() } }),
  openProject: (id) =>
    set({ activeProjectId: id, activeLocationId: null, focusedProjectId: id, pulse: { kind: 'open', at: performance.now() } }),
  focusProject: (id) => set({ focusedProjectId: id }),
  closePanels: () => {
    const s = get()
    if (!s.activeLocationId && !s.activeProjectId) return
    set({ activeLocationId: null, activeProjectId: null, focusedProjectId: null, pulse: { kind: 'close', at: performance.now() } })
  },
  showZone: (id, name, subtitle) =>
    set((s) => ({
      zoneToast: { id, name, subtitle, at: performance.now() },
      visitedZones: s.visitedZones.includes(id) ? s.visitedZones : [...s.visitedZones, id],
    })),
  clearZoneToast: () => set({ zoneToast: null }),
  setTipsOpen: (tipsOpen) => set({ tipsOpen }),
  firePulse: (kind) => set({ pulse: { kind, at: performance.now() } }),
  discover: (place) => set((s) => (s.discovered.includes(place) ? s : { discovered: [...s.discovered, place] })),
}))

/** True when the player should receive movement input. */
export function controlsEnabled(s: Pick<GameState, 'phase' | 'mode' | 'activeLocationId' | 'activeProjectId' | 'fade' | 'establishing'>) {
  return s.phase === 'playing' && s.mode === 'street' && !s.activeLocationId && !s.activeProjectId && !s.fade && !s.establishing
}
