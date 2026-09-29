import { Environment, Lightformer } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useEffect, useRef } from 'react'
import type { DirectionalLight, Object3D } from 'three'
import { playerRuntime } from '@/core/runtime'
import { SUN_DIRECTION } from '@/components/environment/Sky'
import { useGameStore } from '@/stores/gameStore'

const SHADOW_EXTENT = 36

/**
 * Soft late-afternoon lighting: sky/ground hemisphere fill, a warm low sun
 * whose shadow frustum follows the player (texel-snapped to avoid shimmer),
 * a cool rim light, and a procedural environment map for reflections.
 */
export function Lighting({ shadowMapSize = 2048, shadows = true, env = true, shadowInterval = 1 }: { shadowMapSize?: number; shadows?: boolean; env?: boolean; shadowInterval?: number }) {
  const frame = useRef(0)
  const sun = useRef<DirectionalLight>(null!)
  const target = useRef<Object3D>(null!)

  useEffect(() => {
    sun.current.target = target.current
  }, [])

  useFrame(() => {
    const phase = useGameStore.getState().phase
    // during the aerial intro, centre the shadow volume under the camera's view instead
    const focus = phase === 'intro' || phase === 'loading' ? { x: 0, y: 0, z: 10 } : playerRuntime.position
    const extent = phase === 'intro' || phase === 'loading' ? 90 : SHADOW_EXTENT
    const cam = sun.current.shadow.camera
    if (cam.right !== extent) {
      cam.left = -extent
      cam.right = extent
      cam.top = extent
      cam.bottom = -extent
      cam.updateProjectionMatrix()
    }
    const texel = (extent * 2) / shadowMapSize
    const fx = Math.round(focus.x / texel) * texel
    const fz = Math.round(focus.z / texel) * texel
    target.current.position.set(fx, 0, fz)
    sun.current.position.set(fx + SUN_DIRECTION.x * 90, SUN_DIRECTION.y * 90 + 20, fz + SUN_DIRECTION.z * 90)
    target.current.updateMatrixWorld()
    // optionally refresh the shadow map every Nth frame (cheaper on integrated GPUs)
    frame.current++
    sun.current.shadow.autoUpdate = shadowInterval <= 1
    if (shadowInterval > 1 && frame.current % shadowInterval === 0) sun.current.shadow.needsUpdate = true
  })

  return (
    <>
      <hemisphereLight args={['#c3ccff', '#e9a9bb', 1.4]} />
      <ambientLight intensity={0.22} color="#e8dcff" />
      <directionalLight
        ref={sun}
        color="#ffd6b0"
        intensity={3.0}
        castShadow={shadows}
        shadow-mapSize-width={shadowMapSize}
        shadow-mapSize-height={shadowMapSize}
        shadow-camera-near={10}
        shadow-camera-far={220}
        shadow-bias={-0.0004}
        shadow-normalBias={0.035}
      />
      <object3D ref={target} />
      {env && <Environment frames={1} resolution={128} environmentIntensity={0.7}>
        <Lightformer form="rect" intensity={2.2} color="#ffd9b8" position={[-60, 30, -70]} scale={[80, 30, 1]} target={[0, 0, 0]} />
        <Lightformer form="rect" intensity={1.2} color="#b9c6ff" position={[0, 80, 0]} rotation-x={Math.PI / 2} scale={[160, 160, 1]} />
        <Lightformer form="ring" intensity={0.9} color="#f6c3cf" position={[70, 10, 60]} scale={40} target={[0, 0, 0]} />
        <Lightformer form="rect" intensity={0.6} color="#a99ae0" position={[0, 5, 90]} scale={[120, 12, 1]} target={[0, 0, 0]} />
      </Environment>}
    </>
  )
}
