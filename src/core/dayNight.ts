import { Color, Vector3 } from 'three'
import { create } from 'zustand'

/**
 * Day/night — one continuous time value (0–24 h) drives every environmental
 * light in the world: sun & moon, sky, hemisphere/ambient fill, fog, reflections,
 * window and street lights, vehicle lights and the UI tone. The geometry never
 * changes; only light does. Nothing outside this module hard-codes a time of
 * day — consumers read `sky` (the evaluated lighting state) every frame.
 *
 * Modes
 *   auto   — starts at the visitor's local time and advances at DAY_NIGHT_SPEED
 *   day    — eases to DAY_HOUR and holds
 *   sunset — eases to SUNSET_HOUR and holds
 *   night  — eases to NIGHT_HOUR and holds
 */

/** in-world minutes per real minute in auto mode (10 = one day in 2.4 real hours) */
export const DAY_NIGHT_SPEED = 10
export const DAY_HOUR = 14.5
export const SUNSET_HOUR = 18.2
export const NIGHT_HOUR = 21.5

export type DayNightMode = 'auto' | 'day' | 'sunset' | 'night'
export type DayPhase = 'night' | 'dawn' | 'day' | 'golden' | 'sunset' | 'blue'

/** named moments of the evening (configurable) */
export const MOMENTS = {
  dawn: 5.6,
  sunrise: 6.4,
  morning: 7.4,
  golden: 17.5,
  sunset: 18.25,
  blue: 18.85,
  night: 19.6,
}

interface Preset {
  sun: string
  sunI: number
  /** elevation of the light direction (0 = horizon, 1 = zenith) */
  elev: number
  /** 0 = the sun is the key light, 1 = the moon */
  moon: number
  hemiSky: string
  hemiGround: string
  hemiI: number
  amb: number
  skyTop: string
  skyMid: string
  skyHorizon: string
  skyGlow: string
  glowI: number
  fog: string
  fogNear: number
  fogFar: number
  env: number
  /** city lights (windows, lamps, headlights) 0 → 1 */
  lights: number
  stars: number
  clouds: string
}

// The DAY preset is exactly the original daytime look (source of truth).
const DAY: Preset = {
  sun: '#fff0dc', sunI: 3.3, elev: 0.62, moon: 0, hemiSky: '#d4e2f5', hemiGround: '#a39684', hemiI: 1.35, amb: 0.18,
  skyTop: '#4f86cf', skyMid: '#9ec2e6', skyHorizon: '#e9e2d8', skyGlow: '#fff0d6', glowI: 0.55,
  fog: '#dcdad4', fogNear: 110, fogFar: 460, env: 0.7, lights: 0, stars: 0, clouds: '#fbfbf8',
}
const GOLDEN: Preset = {
  sun: '#ffdcae', sunI: 2.9, elev: 0.3, moon: 0, hemiSky: '#d6dbe6', hemiGround: '#a18b76', hemiI: 1.15, amb: 0.16,
  skyTop: '#5584c2', skyMid: '#aec3db', skyHorizon: '#eed7b8', skyGlow: '#ffd29e', glowI: 0.8,
  fog: '#e0d4c2', fogNear: 105, fogFar: 450, env: 0.6, lights: 0, stars: 0, clouds: '#fbefe0',
}
const SUNSET: Preset = {
  sun: '#ffb47c', sunI: 1.75, elev: 0.1, moon: 0, hemiSky: '#b8c0d6', hemiGround: '#8a6f5e', hemiI: 0.85, amb: 0.13,
  skyTop: '#41619a', skyMid: '#9ea9c4', skyHorizon: '#efbb90', skyGlow: '#ffa266', glowI: 1.0,
  fog: '#c8b3a3', fogNear: 95, fogFar: 430, env: 0.42, lights: 0.28, stars: 0, clouds: '#f3c9a8',
}
const BLUE: Preset = {
  sun: '#a9bce2', sunI: 0.42, elev: 0.36, moon: 1, hemiSky: '#6a80b0', hemiGround: '#3d3c46', hemiI: 0.62, amb: 0.1,
  skyTop: '#1d2f5a', skyMid: '#3e5689', skyHorizon: '#8795b6', skyGlow: '#d6a07c', glowI: 0.35,
  fog: '#4d5b7c', fogNear: 85, fogFar: 410, env: 0.24, lights: 0.8, stars: 0.35, clouds: '#6f7a96',
}
const NIGHT: Preset = {
  sun: '#bccaea', sunI: 0.46, elev: 0.55, moon: 1, hemiSky: '#364669', hemiGround: '#1f1c23', hemiI: 0.42, amb: 0.075,
  skyTop: '#0c1633', skyMid: '#1b2b52', skyHorizon: '#3c4c70', skyGlow: '#000000', glowI: 0,
  fog: '#222d45', fogNear: 75, fogFar: 390, env: 0.13, lights: 1, stars: 1, clouds: '#2a3450',
}
const DAWN: Preset = { ...BLUE, skyHorizon: '#b59a92', skyGlow: '#e7a88a', glowI: 0.45, lights: 0.7, stars: 0.2 }
const SUNRISE: Preset = { ...GOLDEN, sun: '#ffcf9c', sunI: 2.2, elev: 0.16, skyHorizon: '#f1cda8', lights: 0.15 }

// the day as a loop of keyframes (hour → preset)
const KEYS: [number, Preset][] = [
  [0, NIGHT],
  [MOMENTS.dawn - 0.6, NIGHT],
  [MOMENTS.dawn, DAWN],
  [MOMENTS.sunrise, SUNRISE],
  [MOMENTS.morning, DAY],
  [MOMENTS.golden - 0.9, DAY],
  [MOMENTS.golden, GOLDEN],
  [MOMENTS.sunset, SUNSET],
  [MOMENTS.blue, BLUE],
  [MOMENTS.night, NIGHT],
  [24, NIGHT],
]

// ── evaluated lighting state (mutated in place every frame) ─────────────────
const C = () => new Color()
export const sky = {
  hour: 14.5,
  sunColor: C(), sunIntensity: 3.3, lightDir: new Vector3(), moon: 0,
  hemiSky: C(), hemiGround: C(), hemiIntensity: 1.35, ambient: 0.18,
  top: C(), mid: C(), horizon: C(), glow: C(), glowIntensity: 0.55, sunDir: new Vector3(),
  fog: C(), fogNear: 110, fogFar: 460, env: 0.7,
  /** 0 = daylight … 1 = full night (window, street, vehicle and park lights) */
  lights: 0,
  stars: 0,
  clouds: C(),
}

// azimuths: the sun sets toward the west-north-west, the moon rides high to the south-east
const SUN_AZ = Math.atan2(-0.48, -0.5)
const MOON_AZ = Math.atan2(0.42, 0.62)
const _a = C()
const _b = C()

const smooth = (t: number) => t * t * (3 - 2 * t)
function lerpColor(out: Color, a: string, b: string, t: number) {
  _a.set(a)
  _b.set(b)
  return out.copy(_a).lerp(_b, t)
}

export function evaluate(hour: number) {
  const h = ((hour % 24) + 24) % 24
  let i = 0
  while (i < KEYS.length - 2 && h >= KEYS[i + 1][0]) i++
  const [h0, a] = KEYS[i]
  const [h1, b] = KEYS[i + 1]
  const t = smooth(h1 > h0 ? Math.min(1, Math.max(0, (h - h0) / (h1 - h0))) : 0)
  const n = (x: number, y: number) => x + (y - x) * t
  sky.hour = h
  lerpColor(sky.sunColor, a.sun, b.sun, t)
  sky.sunIntensity = n(a.sunI, b.sunI)
  sky.moon = n(a.moon, b.moon)
  lerpColor(sky.hemiSky, a.hemiSky, b.hemiSky, t)
  lerpColor(sky.hemiGround, a.hemiGround, b.hemiGround, t)
  sky.hemiIntensity = n(a.hemiI, b.hemiI)
  sky.ambient = n(a.amb, b.amb)
  lerpColor(sky.top, a.skyTop, b.skyTop, t)
  lerpColor(sky.mid, a.skyMid, b.skyMid, t)
  lerpColor(sky.horizon, a.skyHorizon, b.skyHorizon, t)
  lerpColor(sky.glow, a.skyGlow, b.skyGlow, t)
  sky.glowIntensity = n(a.glowI, b.glowI)
  lerpColor(sky.fog, a.fog, b.fog, t)
  sky.fogNear = n(a.fogNear, b.fogNear)
  sky.fogFar = n(a.fogFar, b.fogFar)
  sky.env = n(a.env, b.env)
  sky.lights = n(a.lights, b.lights)
  sky.stars = n(a.stars, b.stars)
  lerpColor(sky.clouds, a.clouds, b.clouds, t)
  // key light: the sun sinks toward the horizon, then (while it is dimmest, in
  // blue hour) the same light becomes the moon — one shadow caster, no pop
  const elev = n(a.elev, b.elev)
  const az = sky.moon > 0.5 ? MOON_AZ : SUN_AZ
  const ce = Math.cos(elev * (Math.PI / 2))
  sky.lightDir.set(Math.cos(az) * ce, Math.sin(elev * (Math.PI / 2)), Math.sin(az) * ce).normalize()
  // the sky's sun disc/glow always follows the real sun (it slips below the horizon after sunset)
  const sunElev = sky.moon > 0.5 ? -0.25 : elev
  const cs = Math.cos(sunElev * (Math.PI / 2))
  sky.sunDir.set(Math.cos(SUN_AZ) * cs, Math.sin(sunElev * (Math.PI / 2)), Math.sin(SUN_AZ) * cs).normalize()
  return sky
}

export function phaseOf(hour: number): DayPhase {
  const h = ((hour % 24) + 24) % 24
  if (h < MOMENTS.dawn) return 'night'
  if (h < MOMENTS.morning) return 'dawn'
  if (h < MOMENTS.golden) return 'day'
  if (h < MOMENTS.sunset) return 'golden'
  if (h < MOMENTS.blue) return 'sunset'
  if (h < MOMENTS.night) return 'blue'
  return 'night'
}

// ── mode & time (UI-facing store; the per-frame clock lives in `clock`) ─────
function localHour() {
  const d = new Date()
  return d.getHours() + d.getMinutes() / 60
}

function initialState(): { mode: DayNightMode; hour: number } {
  const q = typeof location !== 'undefined' ? new URLSearchParams(location.search) : null
  const forced = q?.get('time')
  if (forced && !Number.isNaN(parseFloat(forced))) return { mode: 'day', hour: parseFloat(forced) } // ?time=19.5 (dev/testing)
  const m = q?.get('mode') as DayNightMode | null
  if (m === 'day') return { mode: m, hour: DAY_HOUR }
  if (m === 'sunset') return { mode: m, hour: SUNSET_HOUR }
  if (m === 'night') return { mode: m, hour: NIGHT_HOUR }
  return { mode: 'auto', hour: localHour() }
}

const init = initialState()

/** per-frame clock (not React state) */
export const clock = { hour: init.hour, target: null as number | null, forced: !!(typeof location !== 'undefined' && new URLSearchParams(location.search).get('time')) }

interface DayNightState {
  mode: DayNightMode
  phase: DayPhase
  /** coarse hour for the UI (updated when the minute changes) */
  hour: number
  night: boolean
  setMode: (m: DayNightMode) => void
  cycleMode: () => void
  setTime: (hour: number, animate?: boolean) => void
}

const HOLD: Record<Exclude<DayNightMode, 'auto'>, number> = { day: DAY_HOUR, sunset: SUNSET_HOUR, night: NIGHT_HOUR }

export const useDayNight = create<DayNightState>((set, get) => ({
  mode: init.mode,
  phase: phaseOf(init.hour),
  hour: init.hour,
  night: evaluate(init.hour).lights > 0.5,
  setMode: (mode) => {
    set({ mode })
    clock.target = mode === 'auto' ? localHour() : HOLD[mode]
  },
  cycleMode: () => {
    const order: DayNightMode[] = ['auto', 'day', 'sunset', 'night']
    get().setMode(order[(order.indexOf(get().mode) + 1) % order.length])
  },
  setTime: (hour, animate = true) => {
    if (animate) clock.target = hour
    else {
      clock.hour = hour
      clock.target = null
    }
  },
}))

export const getTime = () => clock.hour
export const setTime = (hour: number, animate = true) => useDayNight.getState().setTime(hour, animate)
export const setMode = (m: DayNightMode) => useDayNight.getState().setMode(m)

/**
 * Advance the clock (called once per frame by DayNightSystem). Target changes
 * ease forward through the evening rather than jumping, so switching modes
 * plays a short, smooth time-lapse instead of a cut.
 */
export function tickClock(dt: number) {
  const st = useDayNight.getState()
  if (clock.target !== null) {
    // travel the shorter way round the clock (day → sunset → night plays forward;
    // night → an earlier local time eases back), as a gradual time-lapse
    let d = clock.target - clock.hour
    if (d > 12) d -= 24
    else if (d <= -12) d += 24
    const dist = Math.abs(d)
    const step = (1.1 + dist * 0.38) * dt
    if (dist < 1e-4 || step >= dist) {
      clock.hour = clock.target
      clock.target = null
    } else clock.hour += Math.sign(d) * step
  } else if (st.mode === 'auto' && !clock.forced) {
    clock.hour += (DAY_NIGHT_SPEED / 60) * (dt / 60)
  }
  clock.hour = ((clock.hour % 24) + 24) % 24
  const s = evaluate(clock.hour)
  const phase = phaseOf(clock.hour)
  const night = s.lights > 0.5
  if (phase !== st.phase || night !== st.night || Math.abs(st.hour - clock.hour) > 1 / 60) useDayNight.setState({ phase, night, hour: clock.hour })
  return s
}
