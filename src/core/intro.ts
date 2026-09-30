import { CatmullRomCurve3, Vector3 } from 'three'
import { SPAWN } from './runtime'

/**
 * The opening sequence, as data. One clock (introRuntime.t, seconds since the
 * loading screen handed over) drives the camera flight, the AI companion's
 * entrance and the overlay copy, so every layer stays in sync — and skipping
 * simply jumps the clock to the hero moment.
 *
 *  0–7 s   a light aircraft crosses the sky right → left towing a cloth banner,
 *            "WELCOME TO MY PORTFOLIO"; the camera tracks it over the rooftops
 *  7–12 s   as it leaves, the camera tips down into the city through the haze
 *  9 s      the companion blinks awake and leads the way
 *  12–15 s  down the avenue, under the welcome arch, onto the avatar
 *  15.4 s+  hero: greeting, title, start
 */
export const INTRO = {
  planeEnd: 7.2,
  heroAt: 15.4,
  aiWakeAt: 9.2,
  aiArriveAt: 14.0,
  messages: [
    { at: 15.7, text: 'Hi. I’m your <b>AI companion</b>.', ms: 3400 },
    { at: 19.3, text: 'Let me show you around <b>Naveen’s world</b>.', ms: 4400 },
  ],
}

/** the banner plane: altitude, track and speed (world space) */
export const PLANE = { y: 60, z: 50, x0: 95, speed: 27 }
export function planeX(t: number) {
  return PLANE.x0 - PLANE.speed * t
}

const SEEN_KEY = 'mindscape:intro-seen'
/** returning in the same browser session: the intro isn't forced again */
export function introSeen() {
  try {
    return sessionStorage.getItem(SEEN_KEY) === '1'
  } catch {
    return false
  }
}
export function markIntroSeen() {
  try {
    sessionStorage.setItem(SEEN_KEY, '1')
  } catch {
    /* storage blocked */
  }
}

export const introRuntime = {
  /** seconds since the intro began (frozen at 0 during loading) */
  t: 0,
  running: false,
  skipped: false,
}

export function skipIntro() {
  if (introRuntime.t < INTRO.heroAt) {
    introRuntime.skipped = true
    introRuntime.t = INTRO.heroAt + 0.01
  }
}

const P = (x: number, y: number, z: number) => new Vector3(x, y, z)
const S = SPAWN

// plane pass: the camera drifts right → left above the rooftops, looking up at the plane
// inside the backdrop ring (z < 110) and above the rooftops
const PLANE_CAM_A = P(12, 44, 104)
const PLANE_CAM_B = P(-6, 47, 100)
function planeShot(t: number, outPos: Vector3, outTarget: Vector3) {
  const f = Math.min(1, t / INTRO.planeEnd)
  const e = f * f * (3 - 2 * f)
  outPos.lerpVectors(PLANE_CAM_A, PLANE_CAM_B, e)
  // lead the plane a little; start framed on open sky before it enters
  const px = Math.max(-40, Math.min(30, planeX(t) * 0.42))
  outTarget.set(px, PLANE.y - 5 + Math.sin(t * 0.4) * 0.4, PLANE.z)
}
const _ps = new Vector3()
const _pt = new Vector3()
planeShot(INTRO.planeEnd, _ps, _pt)

// city flight (positions and look targets share the same timing), starting exactly
// where the plane shot ends; inside the backdrop skyline ring and below the clouds,
// down the avenue axis and under the welcome arch
const TIMES = [INTRO.planeEnd, 9.4, 11.8, 13.6, INTRO.heroAt]
const posCurve = new CatmullRomCurve3([
  _ps.clone(),
  P(24, 44, 100),
  P(10, 26, 104),
  P(3, 3.4, S.z + 18),
  P(-1.6, 1.72, S.z + 4.3),
], false, 'centripetal')
const tgtCurve = new CatmullRomCurve3([
  _pt.clone(),
  P(-6, 2, 26),
  P(-3, 2, 50),
  P(-0.6, 2.0, S.z - 3),
  P(-1.25, 1.38, S.z - 0.4),
], false, 'centripetal')

export const HERO_SHOT = { position: posCurve.points[4].clone(), target: tgtCurve.points[4].clone() }

function curveParam(t: number) {
  if (t <= TIMES[0]) return 0
  if (t >= TIMES[TIMES.length - 1]) return 1
  let i = 0
  while (t > TIMES[i + 1]) i++
  const f = (t - TIMES[i]) / (TIMES[i + 1] - TIMES[i])
  // ease each leg so the flight breathes: slow start, glide, gentle landing
  const e = i === 0 ? f * f * (3 - 2 * f) * 0.6 + f * 0.4 : i === TIMES.length - 2 ? 1 - (1 - f) ** 3 : f
  return (i + e) / (TIMES.length - 1)
}

// portrait screens: the avatar is framed centred and higher, with the copy below
const PORTRAIT_POS = P(-0.9, 1.95, S.z + 5.6).sub(posCurve.points[4])
const PORTRAIT_TGT = P(0.15, 1.05, S.z - 0.2).sub(tgtCurve.points[4])

export function introCamera(t: number, outPos: Vector3, outTarget: Vector3, portrait = false) {
  if (t < INTRO.planeEnd) {
    planeShot(t, outPos, outTarget)
    return
  }
  const u = curveParam(t)
  posCurve.getPoint(u, outPos)
  tgtCurve.getPoint(u, outTarget)
  if (portrait) {
    const f = Math.min(1, Math.max(0, (t - (INTRO.heroAt - 3)) / 3))
    const e = f * f * (3 - 2 * f)
    outPos.addScaledVector(PORTRAIT_POS, e)
    outTarget.addScaledVector(PORTRAIT_TGT, e)
  }
  if (t >= INTRO.heroAt) {
    // hero: a barely-there handheld drift
    const d = t - INTRO.heroAt
    outPos.x += Math.sin(d * 0.21) * 0.14
    outPos.y += Math.sin(d * 0.33) * 0.05
  }
}

/** where the companion rests in the hero shot: just off the avatar's shoulder */
export const AI_HERO_SPOT = P(S.x + 0.82, S.y + 1.74, S.z - 0.3)

const _c = new Vector3()
const _t = new Vector3()
/**
 * Companion flight: it wakes a little ahead of the camera, hangs there as if it
 * had been waiting, then swoops down the avenue and settles beside the avatar.
 */
/** atmospheric haze that lifts as the camera descends (0 = dense, 1 = clear) */
export function introClearness(t: number) {
  const f = Math.min(1, Math.max(0, (t - 5.5) / 6.5))
  return f * f * (3 - 2 * f)
}

export function introCompanion(t: number, out: Vector3): { visible: boolean; wake: number } {
  if (t < INTRO.aiWakeAt) return { visible: false, wake: 0 }
  if (t >= INTRO.aiArriveAt) {
    out.copy(AI_HERO_SPOT)
    return { visible: true, wake: 1 }
  }
  // start point: 22% along the view ray of the camera at wake time
  introCamera(INTRO.aiWakeAt + 1.2, _c, _t)
  const start = _c.lerp(_t, 0.2).add(P(-3, -2, 0))
  const f = (t - INTRO.aiWakeAt) / (INTRO.aiArriveAt - INTRO.aiWakeAt)
  const hang = Math.min(1, f / 0.22) // first ~2 s: hover in place
  const travel = Math.max(0, (f - 0.22) / 0.78)
  const e = travel * travel * (3 - 2 * travel)
  out.copy(start).lerp(AI_HERO_SPOT, e)
  out.y += Math.sin(Math.PI * e) * 6 // a soft arc rather than a straight line
  return { visible: true, wake: hang }
}
