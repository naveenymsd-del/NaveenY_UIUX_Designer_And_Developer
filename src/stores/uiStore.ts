import { create } from 'zustand'
import { detectQuality, isTouchDevice, type Quality } from '@/utils/performance'

export type MenuSection = 'places' | 'about' | 'workflow' | 'contact' | 'feedback'

const SOUND_KEY = 'mindscape-avenue:sound'

function readSoundPref(): boolean {
  try {
    const v = localStorage.getItem(SOUND_KEY)
    return v === null ? true : v === '1'
  } catch {
    return true
  }
}

// v2: the introduction now shows on every load; earlier opt-outs (made while it was once per session) start fresh
const ONBOARDING_KEY = 'naveen-city:onboarding-v2'

/** every load (refresh included) — unless the visitor said "don't show again", or QA turned it off */
function shouldShowOnboarding(): boolean {
  if (typeof location === 'undefined') return false
  const q = new URLSearchParams(location.search)
  if (q.has('debug') || q.get('onboarding') === 'off') return false
  try {
    if (localStorage.getItem(ONBOARDING_KEY) === 'off') return false
  } catch {
    /* storage unavailable — show it; dismissing still works in memory */
  }
  return true
}

/** the visitor closed the introduction: remember only an explicit "don't show again" */
export function rememberOnboarding(never: boolean) {
  try {
    if (never) localStorage.setItem(ONBOARDING_KEY, 'off')
    else localStorage.removeItem(ONBOARDING_KEY)
  } catch {
    /* private mode — nothing to remember */
  }
}
export function onboardingDisabled(): boolean {
  try {
    return localStorage.getItem(ONBOARDING_KEY) === 'off'
  } catch {
    return false
  }
}

interface UIState {
  menuOpen: boolean
  /** the "how this world works" guide, shown before the opening flight on a first visit */
  onboarding: boolean
  setOnboarding: (open: boolean) => void
  /** first-run hint currently pointing at part of the interface */
  hint: 'city' | 'move' | 'ai' | 'menu' | null
  setHint: (hint: 'city' | 'move' | 'ai' | 'menu' | null) => void
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
  onboarding: shouldShowOnboarding(),
  setOnboarding: (onboarding) => set({ onboarding }),
  hint: null,
  setHint: (hint) => set({ hint }),
  menuSection: 'places',
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
