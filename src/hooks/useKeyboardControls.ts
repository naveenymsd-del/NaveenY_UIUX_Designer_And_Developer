import { getTime, setMode, setTime } from '@/core/dayNight'
import { skipIntro } from '@/core/intro'
import { useEffect } from 'react'
import { clearMovement, input, pressJump } from '@/core/input'
import { triggerNearby } from '@/components/interactions/InteractionManager'
import { soundManager } from '@/core/sound/SoundManager'
import { useGameStore } from '@/stores/gameStore'
import { useUIStore } from '@/stores/uiStore'

const MOVE_KEYS: Record<string, keyof typeof input> = {
  KeyW: 'forward', ArrowUp: 'forward',
  KeyS: 'backward', ArrowDown: 'backward',
  KeyA: 'left', ArrowLeft: 'left',
  KeyD: 'right', ArrowRight: 'right',
  ShiftLeft: 'sprint', ShiftRight: 'sprint',
}

function isTyping(e: KeyboardEvent) {
  const t = e.target as HTMLElement | null
  return !!t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)
}

/**
 * Desktop controls: WASD / arrows to move, Shift to run, Space to jump,
 * E to interact, Esc to close panels/menus, H to toggle the controls tip.
 * Space/arrows are only captured while the game has focus (not in the menu).
 */
const DEV_KEYS = import.meta.env.DEV || (typeof location !== 'undefined' && new URLSearchParams(location.search).has('debug'))

export function useKeyboardControls() {
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (isTyping(e)) return
      soundManager.unlock()
      const ui = useUIStore.getState()
      const game = useGameStore.getState()
      if (e.code === 'Escape') {
        if (game.phase === 'intro') skipIntro()
        else if (ui.menuOpen) ui.setMenuOpen(false)
        else if (game.activeLocationId || game.activeProjectId) {
          game.closePanels()
          soundManager.play('close')
        } else if (game.tipsOpen) game.setTipsOpen(false)
        return
      }
      if (ui.menuOpen) return
      const k = MOVE_KEYS[e.code]
      if (k) {
        ;(input as Record<string, unknown>)[k] = true
        if (e.code.startsWith('Arrow')) e.preventDefault()
        if (game.tipsOpen && k !== 'sprint' && game.phase === 'playing') game.setTipsOpen(false)
        return
      }
      if (e.code === 'Space') {
        e.preventDefault()
        if (!e.repeat) pressJump()
        return
      }
      if (e.code === 'KeyE' || e.code === 'Enter') {
        if (e.code === 'Enter' && (e.target as HTMLElement)?.tagName === 'BUTTON') return
        if (triggerNearby()) e.preventDefault()
        return
      }
      if (e.code === 'KeyH') game.setTipsOpen(!game.tipsOpen)
      // developer shortcuts (dev server or ?debug only): N night · M day ("morning") · T +1 hour
      if (DEV_KEYS) {
        if (e.code === 'KeyN') setMode('night')
        else if (e.code === 'KeyM') setMode('day')
        else if (e.code === 'KeyT') setTime((getTime() + 1) % 24)
      }
    }
    const up = (e: KeyboardEvent) => {
      const k = MOVE_KEYS[e.code]
      if (k) (input as Record<string, unknown>)[k] = false
    }
    const blur = () => clearMovement()
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    window.addEventListener('blur', blur)
    document.addEventListener('visibilitychange', blur)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
      window.removeEventListener('blur', blur)
      document.removeEventListener('visibilitychange', blur)
    }
  }, [])
}
