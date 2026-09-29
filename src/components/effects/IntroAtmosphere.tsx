import { useFrame, useThree } from '@react-three/fiber'
import type { Fog } from 'three'
import { introClearness, introRuntime } from '@/core/intro'
import { useGameStore } from '@/stores/gameStore'

const NEAR = 110
const FAR = 460

/**
 * During the opening flight the neighbourhood emerges from a soft haze: fog
 * starts dense and lifts as the camera comes down, which also keeps the far
 * edges of the world out of the first aerial shots.
 */
export function IntroAtmosphere() {
  const scene = useThree((s) => s.scene)
  useFrame(() => {
    const fog = scene.fog as Fog | null
    if (!fog) return
    const phase = useGameStore.getState().phase
    const c = phase === 'loading' ? 0 : phase === 'intro' ? introClearness(introRuntime.t) : 1
    fog.near = 18 + (NEAR - 18) * c
    fog.far = 175 + (FAR - 175) * c
  })
  return null
}
