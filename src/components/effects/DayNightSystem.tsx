import { useFrame, useThree } from '@react-three/fiber'
import { useEffect } from 'react'
import { Color, type Fog, type MeshBasicMaterial } from 'three'
import { sky, tickClock } from '@/core/dayNight'
import { introClearness, introRuntime } from '@/core/intro'
import { BUILDINGS, footprint } from '@/data/cityLayout'
import { vehicleShared } from '@/components/vehicles/ProceduralVehicle'
import { useGameStore } from '@/stores/gameStore'
import { getMaterial, nightUniforms } from '@/utils/materials'

const VIEW_NIGHT = new Color(0.17, 0.2, 0.32)
// painted shop / office interiors seen from the street read as warm lamplight after dark
const INTERIOR_NIGHT = new Color(0.9, 0.77, 0.58)
const WHITE = new Color(1, 1, 1)
const smooth = (t: number) => t * t * (3 - 2 * t)
const clamp01 = (t: number) => Math.min(1, Math.max(0, t))

/** windows in these buildings are more often lit (someone is home, people work late) */
const ZONES: [string, number][] = [
  ['home', 0.95],
  ['nfc-office', 0.88],
  ['education', 0.4],
  ['library', 0.3],
]

/**
 * Applies the evaluated time of day (core/dayNight) to everything that isn't a
 * light object: fog & background, reflections, and the shared materials that
 * carry the city's night lights — window glass, lit panes, lamp heads, light
 * pools, signage, vehicle lights and interior window views. Lights themselves
 * (sun/moon, hemisphere, ambient) are applied in Lighting; the sky in Sky.
 */
export function DayNightSystem() {
  const scene = useThree((s) => s.scene)

  useEffect(() => {
    ZONES.forEach(([id, p], i) => {
      const b = BUILDINGS.find((x) => x.id === id)
      if (!b) return
      const f = footprint(b)
      nightUniforms.uZones.value[i].set(f.x0 - 0.6, f.z0 - 0.6, f.x1 + 0.6, f.z1 + 0.6)
      nightUniforms.uZoneP.value[i] = p
    })
  }, [])

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 1 / 20)
    const s = tickClock(dt)
    const g = useGameStore.getState()

    // night intro: the city switches on while the camera flies in
    let reveal = 1
    if (g.phase === 'loading') reveal = 0.12
    else if (g.phase === 'intro') reveal = 0.12 + 0.88 * smooth(clamp01((introRuntime.t - 1.2) / 10.5))
    const lights = s.lights * reveal
    nightUniforms.uLights.value = lights

    // shared emitters: brighter after dark so the bloom pass picks up lamps and lit panes
    // lit panes: warmer, only slightly brighter (tungsten interiors, not glare)
    ;(getMaterial('glow') as MeshBasicMaterial).color.setRGB(1 + lights * 0.12, 1 - lights * 0.04, 1 - lights * 0.22)
    ;(getMaterial('emissive') as MeshBasicMaterial).color.setScalar(1.6 + lights * 1.15)
    ;(getMaterial('signAtlas') as MeshBasicMaterial).color.setScalar(1.08 + lights * 0.14)
    const pool = getMaterial('lightPool') as MeshBasicMaterial
    pool.opacity = 0.16 + lights * 0.44
    ;(getMaterial('viewAtlas') as MeshBasicMaterial).color.copy(WHITE).lerp(VIEW_NIGHT, s.lights)
    ;(getMaterial('decorAtlas') as MeshBasicMaterial).color.copy(WHITE).lerp(INTERIOR_NIGHT, g.interior ? 0 : lights * 0.85)
    const v = vehicleShared()
    v.beamMat.opacity = 0.35 + lights * 0.3
    v.head.color.setRGB(3.2 + lights, 3.0 + lights, 2.6 + lights * 0.8)

    // atmosphere (the intro haze lifts as the camera descends)
    const fog = scene.fog as Fog | null
    if (fog) {
      const c = g.phase === 'loading' ? 0 : g.phase === 'intro' ? introClearness(introRuntime.t) : 1
      fog.color.copy(s.fog)
      // the opening haze is lighter at night: dark fog over a lit city reads as a bowl from above
      const n0 = 18 + 50 * s.lights
      const f0 = 175 + 170 * s.lights
      fog.near = n0 + (s.fogNear - n0) * c
      fog.far = f0 + (s.fogFar - f0) * c
    }
    if (scene.background instanceof Color) scene.background.copy(s.fog)
    scene.environmentIntensity = g.interior ? 0.7 : s.env
  }, -3)

  return null
}

export { sky }
