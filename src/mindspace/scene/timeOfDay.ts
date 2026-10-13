import { Color, MathUtils, Vector3 } from 'three'

/**
 * Time of day for the Mindspace room — every lighting value in one place.
 * Four designed looks; the room shows the one for the visitor's local time
 * (the browser clock), crossfading over an hour around each boundary:
 *   morning 05–11 · afternoon 11–16 · evening 16–19 · night 19–05
 * This is a designed mood for the hour, not a claim about the weather.
 */
export type Period = 'morning' | 'afternoon' | 'evening' | 'night'

export interface Look {
  /** sky fill: hemisphere sky / ground colours and strength */
  sky: string
  ground: string
  hemi: number
  /** the sun through the glazing (direction is where the light comes FROM) */
  sun: string
  sunI: number
  sunDir: [number, number, number]
  /** interior lighting 0–1: ceiling cove, downlights, ceiling lamps, the arc lamp */
  interior: number
  /** the city outside: day picture tint and how much of the night picture shows */
  cityTint: string
  night: number
  /** reflections (scene environment intensity), tone-mapping exposure */
  env: number
  exposure: number
  /** the plaster ceiling's own soft light (it only sees bounce light) */
  ceiling: number
  /** the background behind a window: how far the room is dimmed when an app is open */
  dim: number
}

export const LOOKS: Record<Period, Look> = {
  // fresh, calm: a low sun from the east side of the glazing, cool sky, long soft shadows
  morning: { sky: '#d8e6f6', ground: '#9c7d62', hemi: 0.58, sun: '#ffd0a0', sunI: 3.0, sunDir: [-10, 4.4, -6.5], interior: 0.06, cityTint: '#dbe6f6', night: 0, env: 0.9, exposure: 1.0, ceiling: 0.26, dim: 0.74 },
  // bright, neutral: a high sun, crisper and shorter shadows, a bright view
  afternoon: { sky: '#eef3f8', ground: '#b3926f', hemi: 0.95, sun: '#fff4e6', sunI: 3.4, sunDir: [-1.5, 10, -6.5], interior: 0, cityTint: '#ffffff', night: 0, env: 1.05, exposure: 1.0, ceiling: 0.34, dim: 0.7 },
  // golden hour: a low amber sun, long shadows, the lamps starting to glow
  evening: { sky: '#f0c39a', ground: '#7d553b', hemi: 0.42, sun: '#ff9f50', sunI: 3.4, sunDir: [-10, 2.6, -6.5], interior: 0.5, cityTint: '#ffb878', night: 0.12, env: 0.72, exposure: 1.06, ceiling: 0.2, dim: 0.8 },
  // night: a navy sky, the city lit, warm pools of interior light, faint moonlight
  night: { sky: '#2b3753', ground: '#3b2b21', hemi: 0.22, sun: '#a9bbe0', sunI: 0.22, sunDir: [4, 10, -8], interior: 1, cityTint: '#ffffff', night: 1, env: 0.5, exposure: 1.12, ceiling: 0.12, dim: 0.9 },
}

const ORDER: Period[] = ['morning', 'afternoon', 'evening', 'night']
const STARTS: Record<Period, number> = { morning: 5, afternoon: 11, evening: 16, night: 19 }
/** each crossfade lasts this long (hours), centred on the boundary */
const FADE = 1

/** the period whose span contains the hour (0–24) */
export function periodAt(h: number): Period {
  if (h >= 5 && h < 11) return 'morning'
  if (h >= 11 && h < 16) return 'afternoon'
  if (h >= 16 && h < 19) return 'evening'
  return 'night'
}

/** the blended look for an hour: pure inside a period, crossfaded near each boundary */
export function lookAt(h: number): { look: Look; period: Period } {
  for (let i = 0; i < ORDER.length; i++) {
    const to = ORDER[i]
    const from = ORDER[(i + ORDER.length - 1) % ORDER.length]
    const b = STARTS[to]
    let d = h - b
    if (d > 12) d -= 24
    if (d < -12) d += 24
    if (Math.abs(d) < FADE / 2) {
      const t = MathUtils.smoothstep(d, -FADE / 2, FADE / 2)
      return { look: mix(LOOKS[from], LOOKS[to], t), period: t < 0.5 ? from : to }
    }
  }
  const p = periodAt(h)
  return { look: LOOKS[p], period: p }
}

const _a = new Color(), _b = new Color()
const mixColor = (a: string, b: string, t: number) => '#' + _a.set(a).lerp(_b.set(b), t).getHexString()
export function mix(a: Look, b: Look, t: number): Look {
  const n = (x: number, y: number) => MathUtils.lerp(x, y, t)
  return {
    sky: mixColor(a.sky, b.sky, t), ground: mixColor(a.ground, b.ground, t), hemi: n(a.hemi, b.hemi),
    sun: mixColor(a.sun, b.sun, t), sunI: n(a.sunI, b.sunI),
    sunDir: [n(a.sunDir[0], b.sunDir[0]), n(a.sunDir[1], b.sunDir[1]), n(a.sunDir[2], b.sunDir[2])],
    interior: n(a.interior, b.interior), cityTint: mixColor(a.cityTint, b.cityTint, t), night: n(a.night, b.night),
    env: n(a.env, b.env), exposure: n(a.exposure, b.exposure), ceiling: n(a.ceiling, b.ceiling), dim: n(a.dim, b.dim),
  }
}

/**
 * The hour to show: the browser's local clock — or, for previewing / testing,
 * `?tod=morning|afternoon|evening|night` or `?hour=18.5` in the address.
 */
export function currentHour(now = new Date()): number {
  const q = new URLSearchParams(window.location.search)
  const tod = q.get('tod') as Period | null
  if (tod && tod in STARTS) return { morning: 8, afternoon: 13.5, evening: 17.6, night: 22 }[tod]
  const hour = q.get('hour')
  if (hour !== null && !Number.isNaN(Number(hour))) return ((Number(hour) % 24) + 24) % 24
  return now.getHours() + now.getMinutes() / 60
}

/** a mutable, frame-to-frame copy of a look (numbers and THREE colours, no allocation per frame) */
export class LiveLook {
  sky = new Color(); ground = new Color(); sun = new Color(); cityTint = new Color()
  sunDir = new Vector3()
  hemi = 0; sunI = 0; interior = 0; night = 0; env = 0; exposure = 1; ceiling = 0; dim = 0.75
  set(l: Look) {
    this.sky.set(l.sky); this.ground.set(l.ground); this.sun.set(l.sun); this.cityTint.set(l.cityTint)
    this.sunDir.set(...l.sunDir)
    Object.assign(this, { hemi: l.hemi, sunI: l.sunI, interior: l.interior, night: l.night, env: l.env, exposure: l.exposure, ceiling: l.ceiling, dim: l.dim })
  }
  /** ease toward a target look (k = 1 snaps) */
  approach(l: LiveLook, k: number) {
    this.sky.lerp(l.sky, k); this.ground.lerp(l.ground, k); this.sun.lerp(l.sun, k); this.cityTint.lerp(l.cityTint, k)
    this.sunDir.lerp(l.sunDir, k)
    for (const key of ['hemi', 'sunI', 'interior', 'night', 'env', 'exposure', 'ceiling', 'dim'] as const) this[key] = MathUtils.lerp(this[key], l[key], k)
  }
}
