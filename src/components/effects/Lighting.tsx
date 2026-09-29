import { Environment, Lightformer } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useEffect, useRef } from 'react'
import { type AmbientLight, Color, type DirectionalLight, type HemisphereLight, type Object3D } from 'three'
import { sky } from '@/core/dayNight'
import { playerRuntime } from '@/core/runtime'
import { useGameStore } from '@/stores/gameStore'

const SHADOW_EXTENT = 36

// rooms keep their own warm, even indoor light whatever the hour outside
const ROOM_SKY = new Color('#e9e6e0')
const ROOM_GROUND = new Color('#a79a88')
const ROOM_NIGHT = new Color('#f1dcc0')

/**
 * Time-of-day lighting (values from core/dayNight): sky/ground hemisphere fill,
 * a key light that is the sun by day and the moon by night, sky/ground hemisphere fill, a warm low sun
 * whose shadow frustum follows the player (texel-snapped to avoid shimmer),
 * a cool rim light, and a procedural environment map for reflections.
 */
export function Lighting({ shadowMapSize = 2048, shadows = true, env = true, shadowInterval = 1 }: { shadowMapSize?: number; shadows?: boolean; env?: boolean; shadowInterval?: number }) {
  const frame = useRef(0)
  const sun = useRef<DirectionalLight>(null!)
  const target = useRef<Object3D>(null!)
  const hemi = useRef<HemisphereLight>(null!)
  const amb = useRef<AmbientLight>(null!)

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
    const inside = !!useGameStore.getState().interior
    const d = sky.lightDir
    sun.current.position.set(fx + d.x * 90, d.y * 90 + 20, fz + d.z * 90)
    if (inside) {
      // the daytime balance indoors; a touch warmer in the evening (lamps, not daylight)
      hemi.current.color.copy(ROOM_SKY).lerp(ROOM_NIGHT, sky.lights * 0.55)
      hemi.current.groundColor.copy(ROOM_GROUND)
      hemi.current.intensity = 1.35
      amb.current.intensity = 0.18
      sun.current.color.set('#fff0dc')
      sun.current.intensity = 3.3 * (1 - sky.lights * 0.35)
    } else {
      hemi.current.color.copy(sky.hemiSky)
      hemi.current.groundColor.copy(sky.hemiGround)
      hemi.current.intensity = sky.hemiIntensity
      amb.current.intensity = sky.ambient
      sun.current.color.copy(sky.sunColor)
      sun.current.intensity = sky.sunIntensity
    }
    target.current.updateMatrixWorld()
    // optionally refresh the shadow map every Nth frame (cheaper on integrated GPUs)
    frame.current++
    sun.current.shadow.autoUpdate = shadowInterval <= 1
    if (shadowInterval > 1 && frame.current % shadowInterval === 0) sun.current.shadow.needsUpdate = true
  })

  return (
    <>
      <hemisphereLight ref={hemi} args={['#d4e2f5', '#a39684', 1.35]} />
      <ambientLight ref={amb} intensity={0.18} color="#f2efe8" />
      <directionalLight
        ref={sun}
        color="#fff0dc"
        intensity={3.3}
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
        <Lightformer form="rect" intensity={2.2} color="#fff1dc" position={[-60, 30, -70]} scale={[80, 30, 1]} target={[0, 0, 0]} />
        <Lightformer form="rect" intensity={1.2} color="#cfe0ff" position={[0, 80, 0]} rotation-x={Math.PI / 2} scale={[160, 160, 1]} />
        <Lightformer form="ring" intensity={0.9} color="#efe6da" position={[70, 10, 60]} scale={40} target={[0, 0, 0]} />
        <Lightformer form="rect" intensity={0.6} color="#b9c7d6" position={[0, 5, 90]} scale={[120, 12, 1]} target={[0, 0, 0]} />
      </Environment>}
    </>
  )
}
