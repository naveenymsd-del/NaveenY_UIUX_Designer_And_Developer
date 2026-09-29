import { useEffect } from 'react'
import { playerRuntime } from '@/core/runtime'
import { soundManager } from '@/core/sound/SoundManager'
import { useUIStore } from '@/stores/uiStore'
import { useGameStore } from '@/stores/gameStore'

/** Connects gameplay events and the sound preference to the sound manager. */
export function useSoundBridge() {
  const enabled = useUIStore((s) => s.soundEnabled)
  useEffect(() => {
    soundManager.setEnabled(enabled)
  }, [enabled])

  useEffect(() => {
    const step = (run: boolean) => soundManager.play('footstep', { volume: run ? 0.75 : 0.5 })
    const jump = () => soundManager.play('jump', { volume: 0.6 })
    const land = (impact: number) => soundManager.play('land', { volume: 0.35 + impact * 0.5 })
    playerRuntime.onFootstep.add(step)
    playerRuntime.onJump.add(jump)
    playerRuntime.onLand.add(land)
    // soundscape follows the place: rooms by interior, the park by its footprint
    const scape = window.setInterval(() => {
      const interior = useGameStore.getState().interior
      const p = playerRuntime.position
      const inPark = p.x > -43 && p.x < -8 && p.z > 7 && p.z < 43
      soundManager.setSoundscape(interior ?? (inPark ? 'park' : 'street'))
    }, 500)
    const unlock = () => soundManager.unlock()
    window.addEventListener('pointerdown', unlock, { passive: true })
    return () => {
      playerRuntime.onFootstep.delete(step)
      playerRuntime.onJump.delete(jump)
      playerRuntime.onLand.delete(land)
      window.removeEventListener('pointerdown', unlock)
      window.clearInterval(scape)
    }
  }, [])
}
