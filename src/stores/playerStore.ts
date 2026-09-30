import { create } from 'zustand'
import type { MoveState } from '@/core/runtime'

/**
 * Low-frequency player state for the UI (minimap, debug HUD). The per-frame
 * values live in core/runtime.ts; this store is updated at ~8 Hz or on change.
 */
interface PlayerState {
  moveState: MoveState
  x: number
  z: number
  heading: number
  setMoveState: (s: MoveState) => void
  setPose: (x: number, z: number, heading: number) => void
}

export const usePlayerStore = create<PlayerState>((set, get) => ({
  moveState: 'idle',
  x: 0,
  z: 72.5,
  heading: Math.PI,
  setMoveState: (moveState) => {
    if (get().moveState !== moveState) set({ moveState })
  },
  setPose: (x, z, heading) => {
    const s = get()
    // standing still costs nothing: only publish real movement
    if (Math.abs(s.x - x) < 0.05 && Math.abs(s.z - z) < 0.05 && Math.abs(s.heading - heading) < 0.02) return
    set({ x, z, heading })
  },
}))
