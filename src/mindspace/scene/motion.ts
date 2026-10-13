import { Euler, MathUtils, Quaternion, Vector3 } from 'three'

/**
 * Optional motion controls: on a phone or tablet, the device's orientation
 * sensors turn the view (like looking around through a window into the room).
 * Never automatic — only after the visitor taps "Enable motion controls"; on
 * iOS that tap is also when the browser asks for permission. This is the
 * device's orientation, not head or eye tracking.
 */
type Status = 'off' | 'on' | 'denied' | 'unsupported'
type OrientationCtor = typeof DeviceOrientationEvent & { requestPermission?: () => Promise<'granted' | 'denied'> }

export const motion = {
  active: false,
  /** at least one reading has arrived since enabling */
  has: false,
  /** the latest device orientation, as a camera quaternion */
  q: new Quaternion(),
}

export function motionSupported() {
  return typeof window !== 'undefined' && 'DeviceOrientationEvent' in window && window.isSecureContext && matchMedia('(pointer: coarse)').matches
}

const zee = new Vector3(0, 0, 1)
const euler = new Euler()
const q0 = new Quaternion()
const q1 = new Quaternion(-Math.sqrt(0.5), 0, 0, Math.sqrt(0.5)) // camera looks out the back of the device, not the top
const screenAngle = () => MathUtils.degToRad(screen.orientation?.angle ?? (window as unknown as { orientation?: number }).orientation ?? 0)

function onOrientation(e: DeviceOrientationEvent) {
  if (e.alpha === null || e.beta === null || e.gamma === null) return
  // the standard device → camera mapping ('ZXY' device angles as 'YXZ'), then the screen's rotation
  euler.set(MathUtils.degToRad(e.beta), MathUtils.degToRad(e.alpha), -MathUtils.degToRad(e.gamma), 'YXZ')
  motion.q.setFromEuler(euler).multiply(q1).multiply(q0.setFromAxisAngle(zee, -screenAngle()))
  motion.has = true
}

/** turn motion controls on; resolves to the resulting status */
export async function enableMotion(): Promise<Status> {
  if (!motionSupported()) return 'unsupported'
  const Ctor = DeviceOrientationEvent as OrientationCtor
  try {
    if (typeof Ctor.requestPermission === 'function') {
      const answer = await Ctor.requestPermission()
      if (answer !== 'granted') return 'denied'
    }
  } catch {
    return 'denied'
  }
  motion.has = false
  window.addEventListener('deviceorientation', onOrientation)
  motion.active = true
  // no reading within a moment means there is no usable sensor
  await new Promise((r) => setTimeout(r, 900))
  if (!motion.has) {
    disableMotion()
    return 'unsupported'
  }
  return 'on'
}

export function disableMotion() {
  window.removeEventListener('deviceorientation', onOrientation)
  motion.active = false
  motion.has = false
}
