import { CatmullRomCurve3, Vector3 } from 'three'
import { SPAWN } from './runtime'

/**
 * The opening sequence, as data. One clock (introRuntime.t, seconds since the
 * loading screen handed over) drives the camera flight, the AI companion's
 * entrance and the overlay copy, so every layer stays in sync — and skipping
 * simply jumps the clock to the hero moment.
 *
 *  0 s   high above the neighbourhood, drifting
 *  5 s   the companion blinks awake, waiting in the air
 *  6–13  camera sweeps in over the park and down the avenue; the companion leads
 *  13–16 settle on the street: the avatar is revealed, the companion arrives
 *  16 s+ hero: greeting, title, start
 */
export const INTRO = {
  heroAt: 16,
  aiWakeAt: 5,
  aiArriveAt: 14.2,
  messages: [
    { at: 16.2, text: 'Hi. I’m your <b>AI companion</b>.', ms: 3600 },
    { at: 20.0, text: 'Let me show you around <b>Naveen’s world</b>.', ms: 4600 },
  ],
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

// camera flight (positions and look targets share the same timing)
const TIMES = [0, 5.5, 9.5, 13, INTRO.heroAt]
// inside the backdrop skyline ring (z < 110, |x| < 84) and below the clouds;
// it comes down along the avenue axis and glides under the welcome arch
const posCurve = new CatmullRomCurve3([
  P(62, 80, 104),
  P(46, 60, 102),
  P(12, 30, 104),
  P(3, 3.4, S.z + 18),
  P(-1.6, 1.72, S.z + 4.3),
], false, 'centripetal')
const tgtCurve = new CatmullRomCurve3([
  P(0, 0, 14),
  P(-4, 0, 22),
  P(-3, 2, 50),
  P(-0.6, 2.0, S.z - 3),
  P(-1.25, 1.38, S.z - 0.4),
], false, 'centripetal')

export const HERO_SHOT = { position: posCurve.points[4].clone(), target: tgtCurve.points[4].clone() }

function curveParam(t: number) {
  if (t <= 0) return 0
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
  const f = Math.min(1, Math.max(0, (t - 0.6) / 9.5))
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
