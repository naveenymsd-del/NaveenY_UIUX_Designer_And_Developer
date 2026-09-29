/** Frame-rate independent exponential smoothing helpers. */
export function damp(current: number, target: number, lambda: number, dt: number) {
  return current + (target - current) * (1 - Math.exp(-lambda * dt))
}

export function wrapAngle(a: number) {
  while (a > Math.PI) a -= Math.PI * 2
  while (a < -Math.PI) a += Math.PI * 2
  return a
}

/** Smoothly rotate an angle toward a target with a max angular speed (rad/s). */
export function dampAngle(current: number, target: number, lambda: number, dt: number, maxSpeed = Infinity) {
  const diff = wrapAngle(target - current)
  let step = diff * (1 - Math.exp(-lambda * dt))
  const maxStep = maxSpeed * dt
  if (step > maxStep) step = maxStep
  if (step < -maxStep) step = -maxStep
  return wrapAngle(current + step)
}

export function clamp(v: number, a: number, b: number) {
  return v < a ? a : v > b ? b : v
}

export function smoothstep(a: number, b: number, x: number) {
  const t = clamp((x - a) / (b - a), 0, 1)
  return t * t * (3 - 2 * t)
}

export function easeInOutCubic(t: number) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
}

/** Player tuning — edit here to change game feel. */
export const MOVE = {
  walkSpeed: 2.3,
  runSpeed: 5.6,
  groundAccel: 7.5,
  groundDecel: 9,
  airAccel: 3.2,
  gravity: 19,
  jumpVelocity: 6.4,
  maxFall: 30,
  coyoteTime: 0.12,
  jumpBuffer: 0.14,
  turnLambda: 9,
  maxTurnSpeed: 7.5,
}
