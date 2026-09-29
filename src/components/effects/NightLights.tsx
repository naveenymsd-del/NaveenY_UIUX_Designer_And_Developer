import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import { Color, type PointLight } from 'three'
import { sky } from '@/core/dayNight'
import { playerRuntime } from '@/core/runtime'
import { SIDEWALK_Y } from '@/data/cityLayout'
import { lightAnchors } from '@/utils/buildingGen'

const POOL = 4
const RANGE = 34
const LAMP = new Color('#ffcf94')

/**
 * Real local light after dark, kept cheap: a fixed pool of point lights hops
 * to the lamps / entrances / bays nearest the player (re-assigned a few times a
 * second, fading in and out). Everything farther away stays emissive + light
 * pool decals. The light count never changes, so shaders never recompile.
 */
export function NightLights() {
  const refs = useRef<(PointLight | null)[]>([])
  const st = useRef({ t: 0, slots: Array.from({ length: POOL }, () => ({ idx: -1, level: 0 })) })
  const warm = useMemo(() => new Color(), [])

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 1 / 20)
    const s = st.current
    const p = playerRuntime.position
    s.t -= dt
    if (s.t <= 0) {
      s.t = 0.35
      if (sky.lights > 0.02) {
        // nearest anchors (cheap partial selection)
        const best: { i: number; d: number }[] = []
        for (let i = 0; i < lightAnchors.length; i++) {
          const a = lightAnchors[i]
          const d = (a.x - p.x) ** 2 + (a.z - p.z) ** 2
          if (d > RANGE * RANGE) continue
          if (best.length < POOL) best.push({ i, d })
          else {
            let w = 0
            for (let k = 1; k < POOL; k++) if (best[k].d > best[w].d) w = k
            if (d < best[w].d) best[w] = { i, d }
          }
        }
        const want = new Set(best.map((b) => b.i))
        // keep slots that are still wanted; hand the others new anchors
        const free = s.slots.filter((sl) => !want.has(sl.idx))
        for (const sl of s.slots) if (want.has(sl.idx)) want.delete(sl.idx)
        for (const idx of want) {
          const sl = free.shift()
          if (!sl) break
          sl.idx = idx
          sl.level = 0
        }
      }
    }
    s.slots.forEach((sl, k) => {
      const l = refs.current[k]
      if (!l) return
      const a = sl.idx >= 0 ? lightAnchors[sl.idx] : null
      if (!a || sky.lights <= 0.02) {
        l.intensity = 0
        return
      }
      sl.level = Math.min(1, sl.level + dt * 1.5)
      const d = Math.hypot(a.x - p.x, a.z - p.z)
      const far = 1 - Math.min(1, Math.max(0, (d - RANGE * 0.6) / (RANGE * 0.4)))
      l.position.set(a.x, SIDEWALK_Y + (a.r > 3 ? 3.4 : 2.4), a.z)
      warm.setHex(a.color).lerp(LAMP, 0.4)
      l.color.copy(warm)
      // rooms are already evenly lit; local pools there only add a gentle accent
      const indoor = p.x > 290 ? 0.45 : 1
      l.intensity = sky.lights * sl.level * far * indoor * (a.r > 3 ? 14 : 8)
      l.distance = Math.max(7, a.r * 3.2)
    })
  })

  return (
    <>
      {Array.from({ length: POOL }, (_, i) => (
        <pointLight key={i} ref={(l) => { refs.current[i] = l }} intensity={0} decay={2} distance={9} castShadow={false} />
      ))}
    </>
  )
}
