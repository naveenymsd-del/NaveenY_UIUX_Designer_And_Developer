import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useRef } from 'react'
import { MathUtils, type PerspectiveCamera, Vector3 } from 'three'
import { useMindspace } from '../store'

/**
 * Look-around camera for the room. Drag (mouse or one finger) turns the view,
 * the wheel or a pinch zooms (field of view, so the camera never moves into
 * anything), WASD / arrow keys take a few steps inside a safe area clear of
 * the furniture. Everything eases; nothing jumps or rolls.
 */
export const HOME = { pos: new Vector3(0, 1.58, 3.15), yaw: 0, pitch: -0.06 }
const LIMIT = { yaw: 2.6, pitchDown: -0.62, pitchUp: 0.66, fovMin: 32, fovMax: 70 }
/** where the visitor may step: in front of the coffee table, away from the chair and walls */
const AREA = { x0: -2.4, x1: 1.9, z0: 0.55, z1: 3.9 }

export const homeFov = (aspect: number) => (aspect < 0.8 ? 66 : aspect < 1.2 ? 58 : 50)
/** tall screens see more ceiling: look a little lower by default */
export const homePitch = (aspect: number) => (aspect < 0.8 ? -0.17 : HOME.pitch)

export function CameraRig({ enabled }: { enabled: boolean }) {
  const { camera, gl, size } = useThree()
  const cam = camera as PerspectiveCamera
  const s = useRef({ yaw: HOME.yaw, pitch: homePitch(size.width / size.height), fov: homeFov(size.width / size.height), pos: HOME.pos.clone(), cur: { yaw: HOME.yaw, pitch: HOME.pitch, fov: 50 }, keys: new Set<string>() })
  const enabledRef = useRef(enabled)
  enabledRef.current = enabled
  const resetTick = useMindspace((m) => m.resetTick)

  // arriving from the intro (or a fresh load): start exactly at home, no fly-in
  useEffect(() => {
    const st = s.current
    cam.position.copy(st.pos)
    st.cur.yaw = st.yaw
    st.cur.pitch = st.pitch
    st.cur.fov = st.fov
    cam.rotation.set(st.pitch, st.yaw, 0, 'YXZ')
    cam.fov = st.fov
    cam.updateProjectionMatrix()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  // reset view
  useEffect(() => {
    if (!resetTick) return
    const st = s.current
    st.yaw = HOME.yaw
    st.pitch = homePitch(size.width / size.height)
    st.fov = homeFov(size.width / size.height)
    st.pos.copy(HOME.pos)
  }, [resetTick, size.width, size.height])
  // a new screen shape gets the matching home field of view
  useEffect(() => { s.current.fov = MathUtils.clamp(homeFov(size.width / size.height), LIMIT.fovMin, LIMIT.fovMax) }, [size.width, size.height])

  useEffect(() => {
    const el = gl.domElement
    const pointers = new Map<number, { x: number; y: number }>()
    let pinch = 0
    const down = (e: PointerEvent) => {
      if (!enabledRef.current) return
      el.setPointerCapture(e.pointerId)
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY })
      if (pointers.size === 2) {
        const [a, b] = [...pointers.values()]
        pinch = Math.hypot(a.x - b.x, a.y - b.y)
      }
    }
    const move = (e: PointerEvent) => {
      const p = pointers.get(e.pointerId)
      if (!p || !enabledRef.current) return
      const st = s.current
      if (pointers.size === 1) {
        const k = 0.0024 * (st.fov / 50)
        // grab the scene: it follows the finger / pointer (as in 360° viewers)
        st.yaw = MathUtils.clamp(st.yaw + (e.clientX - p.x) * k, -LIMIT.yaw, LIMIT.yaw)
        st.pitch = MathUtils.clamp(st.pitch + (e.clientY - p.y) * k, LIMIT.pitchDown, LIMIT.pitchUp)
      }
      p.x = e.clientX
      p.y = e.clientY
      if (pointers.size === 2) {
        const [a, b] = [...pointers.values()]
        const d = Math.hypot(a.x - b.x, a.y - b.y)
        if (pinch) st.fov = MathUtils.clamp(st.fov * (pinch / d), LIMIT.fovMin, LIMIT.fovMax)
        pinch = d
      }
    }
    const up = (e: PointerEvent) => {
      pointers.delete(e.pointerId)
      if (pointers.size < 2) pinch = 0
    }
    const wheel = (e: WheelEvent) => {
      e.preventDefault()
      if (!enabledRef.current) return
      s.current.fov = MathUtils.clamp(s.current.fov + e.deltaY * 0.025, LIMIT.fovMin, LIMIT.fovMax)
    }
    const keyDown = (e: KeyboardEvent) => {
      if (!enabledRef.current || (e.target as HTMLElement)?.closest?.('input, textarea, [data-keys-own]')) return
      const k = e.key.toLowerCase()
      if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(k)) {
        s.current.keys.add(k)
        e.preventDefault()
      }
    }
    const keyUp = (e: KeyboardEvent) => s.current.keys.delete(e.key.toLowerCase())
    const blur = () => s.current.keys.clear()
    el.addEventListener('pointerdown', down)
    el.addEventListener('pointermove', move)
    el.addEventListener('pointerup', up)
    el.addEventListener('pointercancel', up)
    el.addEventListener('wheel', wheel, { passive: false })
    window.addEventListener('keydown', keyDown)
    window.addEventListener('keyup', keyUp)
    window.addEventListener('blur', blur)
    return () => {
      el.removeEventListener('pointerdown', down)
      el.removeEventListener('pointermove', move)
      el.removeEventListener('pointerup', up)
      el.removeEventListener('pointercancel', up)
      el.removeEventListener('wheel', wheel)
      window.removeEventListener('keydown', keyDown)
      window.removeEventListener('keyup', keyUp)
      window.removeEventListener('blur', blur)
    }
  }, [gl])

  const fwd = new Vector3()
  const right = new Vector3()
  useFrame((_, dt) => {
    const st = s.current
    const d = Math.min(dt, 0.05)
    // a few steps with the keys, in the direction the visitor faces
    if (st.keys.size && enabledRef.current) {
      fwd.set(-Math.sin(st.yaw), 0, -Math.cos(st.yaw))
      right.set(-fwd.z, 0, fwd.x)
      const k = st.keys
      const f = (k.has('w') || k.has('arrowup') ? 1 : 0) - (k.has('s') || k.has('arrowdown') ? 1 : 0)
      const r = (k.has('d') ? 1 : 0) - (k.has('a') ? 1 : 0)
      const turn = (k.has('arrowleft') ? 1 : 0) - (k.has('arrowright') ? 1 : 0)
      st.pos.addScaledVector(fwd, f * 1.6 * d).addScaledVector(right, r * 1.6 * d)
      st.pos.x = MathUtils.clamp(st.pos.x, AREA.x0, AREA.x1)
      st.pos.z = MathUtils.clamp(st.pos.z, AREA.z0, AREA.z1)
      st.yaw = MathUtils.clamp(st.yaw + turn * 1.4 * d, -LIMIT.yaw, LIMIT.yaw)
    }
    const c = st.cur
    c.yaw = MathUtils.damp(c.yaw, st.yaw, 7, d)
    c.pitch = MathUtils.damp(c.pitch, st.pitch, 7, d)
    c.fov = MathUtils.damp(c.fov, st.fov, 6, d)
    cam.position.lerp(st.pos, 1 - Math.exp(-6 * d))
    cam.rotation.set(c.pitch, c.yaw, 0, 'YXZ')
    if (Math.abs(cam.fov - c.fov) > 0.01) {
      cam.fov = c.fov
      cam.updateProjectionMatrix()
    }
  })
  return null
}

/**
 * Pins an HTML element to a point in the room: every frame it is projected
 * through the camera and given the matching 2D transform (position, scale and
 * the slant of the plane), so the launcher sits *in* the space and stays put as
 * the visitor looks around — while staying real, crisp, clickable HTML.
 */
export const anchors = new Map<string, { el: HTMLElement; pos: Vector3; width: number; px: number }>()
const _a = new Vector3(), _x = new Vector3(), _y = new Vector3()
export function AnchorProjector() {
  const { camera, size } = useThree()
  useFrame(() => {
    for (const a of anchors.values()) {
      _a.copy(a.pos).project(camera)
      const behind = _a.z > 1
      if (behind) {
        a.el.style.visibility = 'hidden'
        continue
      }
      _x.copy(a.pos).setX(a.pos.x + a.width / 2).project(camera)
      _y.copy(a.pos).setY(a.pos.y + a.width / 2).project(camera)
      const sx = (v: Vector3) => (v.x * 0.5 + 0.5) * size.width
      const sy = (v: Vector3) => (-v.y * 0.5 + 0.5) * size.height
      const cx = sx(_a), cy = sy(_a)
      // screen-space basis of the plane, per CSS pixel of the design width
      const k = 2 / a.px
      const ax = (sx(_x) - cx) * k, ay = (sy(_x) - cy) * k
      const bx = -(sx(_y) - cx) * k, by = -(sy(_y) - cy) * k
      a.el.style.visibility = 'visible'
      a.el.style.transform = `translate(${cx.toFixed(1)}px, ${cy.toFixed(1)}px) matrix(${ax.toFixed(4)}, ${ay.toFixed(4)}, ${bx.toFixed(4)}, ${by.toFixed(4)}, 0, 0) translate(-50%, -50%)`
    }
  })
  return null
}
