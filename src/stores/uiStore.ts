import { create } from 'zustand'
import { detectQuality, isTouchDevice, type Quality } from '@/utils/performance'

export type MenuSection = 'home' | 'about' | 'projects' | 'workflow' | 'contact' | 'places'

const SOUND_KEY = 'mindscape-avenue:sound'

function readSoundPref(): boolean {
  try {
    const v = localStorage.getItem(SOUND_KEY)
    return v === null ? true : v === '1'
  } catch {
    return true
  }
}

interface UIState {
  menuOpen: boolean
  menuSection: MenuSection
  soundEnabled: boolean
  isTouch: boolean
  quality: Quality
  debug: boolean
  setMenuOpen: (open: boolean) => void
  toggleMenu: () => void
  setMenuSection: (s: MenuSection) => void
  setSoundEnabled: (on: boolean) => void
  setIsTouch: (t: boolean) => void
  setQuality: (q: Quality) => void
}

export const useUIStore = create<UIState>((set, get) => ({
  menuOpen: false,
  menuSection: 'home',
  soundEnabled: readSoundPref(),
  isTouch: isTouchDevice(),
  quality: detectQuality(),
  debug: typeof location !== 'undefined' && new URLSearchParams(location.search).has('debug'),
  setMenuOpen: (menuOpen) => set({ menuOpen }),
  toggleMenu: () => set({ menuOpen: !get().menuOpen }),
  setMenuSection: (menuSection) => set({ menuSection }),
  setSoundEnabled: (soundEnabled) => {
    try {
      localStorage.setItem(SOUND_KEY, soundEnabled ? '1' : '0')
    } catch {
      /* storage unavailable (private mode) — keep in memory only */
    }
    set({ soundEnabled })
  },
  setIsTouch: (isTouch) => set({ isTouch }),
  setQuality: (quality) => set({ quality }),
}))
