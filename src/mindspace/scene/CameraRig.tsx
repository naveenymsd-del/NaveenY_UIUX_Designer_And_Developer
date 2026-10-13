import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useRef } from 'react'
import { Euler, MathUtils, type PerspectiveCamera, Quaternion, Vector3 } from 'three'
import { useMindspace } from '../store'
import { motion } from './motion'
import { cssRenderer, cssScene, disposeCssRenderer, gesture } from './spatial'

/**
 * Look-around camera for the room — one model for every input:
 *   drag (mouse or one finger, anywhere on the room, even starting on an icon)  turn the view
 *   arrow keys                                                                  look left / right / up / down
 *   W A S D                                                                     a few steps, inside a safe area
 *   wheel / pinch                                                               zoom (field of view: the camera never moves into anything)
 *   motion controls (phones, opt-in)                                            the phone's orientation turns the view
 * Vertical look is clamped; everything eases; nothing jumps or rolls.
 */
export const HOME = { pos: new Vector3(0, 1.58, 3.15), yaw: 0, pitch: -0.06 }
const LIMIT = { yaw: 2.6, pitchDown: -0.62, pitchUp: 0.66, fovMin: 32, fovMax: 70 }
/** where the visitor may step: in front of the coffee table, away from the chair and walls */
const AREA = { x0: -2.4, x1: 1.9, z0: 0.55, z1: 3.9 }
/** a pointer gesture becomes a look-around drag after moving this far (px) */
const DRAG_PX = 6

export const homeFov = (aspect: number) => (aspect < 0.8 ? 66 : aspect < 1.2 ? 58 : 50)
/** tall screens see more ceiling: look a little lower by default */
export const homePitch = (aspect: number) => (aspect < 0.8 ? -0.17 : HOME.pitch)

/** gestures start on the room or on an icon — never inside a window, the controls or the intro */
const NOT_THE_ROOM = '.ms-window-layer, .ms-controls, .ms-pill, .ms-intro, .ms-hint, input, textarea'

export function CameraRig({ enabled }: { enabled: boolean }) {
  const { camera, size } = useThree()
  const cam = camera as PerspectiveCamera
  const s = useRef({ yaw: HOME.yaw, pitch: homePitch(size.width / size.height), fov: homeFov(size.width / size.height), pos: HOME.pos.clone(), cur: { yaw: HOME.yaw, pitch: HOME.pitch, fov: 50 }, keys: new Set<string>(), motionBase: null as null | { device: number; yaw: number } })
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
  // reset view (motion controls re-centre on the phone's current direction)
  useEffect(() => {
    if (!resetTick) return
    const st = s.current
    st.yaw = HOME.yaw
    st.pitch = homePitch(size.width / size.height)
    st.fov = homeFov(size.width / size.height)
    st.pos.copy(HOME.pos)
    st.motionBase = null
  }, [resetTick, size.width, size.height])
  // a new screen shape gets the matching home field of view
  useEffect(() => { s.current.fov = MathUtils.clamp(homeFov(size.width / size.height), LIMIT.fovMin, LIMIT.fovMax) }, [size.width, size.height])

  useEffect(() => {
    const pointers = new Map<number, { x: number; y: number; x0: number; y0: number }>()
    let pinch = 0
    const down = (e: PointerEvent) => {
      if (!enabledRef.current || (e.target as Element)?.closest?.(NOT_THE_ROOM)) return
      if (pointers.size === 0) gesture.dragged = false
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY, x0: e.clientX, y0: e.clientY })
      if (pointers.size === 2) {
        const [a, b] = [...pointers.values()]
        pinch = Math.hypot(a.x - b.x, a.y - b.y)
        gesture.dragged = true
      }
    }
    const move = (e: PointerEvent) => {
      const p = pointers.get(e.pointerId)
      if (!p || !enabledRef.current) return
      const st = s.current
      if (pointers.size === 1) {
        if (!gesture.dragged && Math.hypot(e.clientX - p.x0, e.clientY - p.y0) < DRAG_PX) return
        gesture.dragged = true
        const k = 0.0024 * (st.fov / 50)
        // grab the scene: it follows the finger / pointer (as in 360° viewers)
        const dyaw = (e.clientX - p.x) * k
        st.yaw = MathUtils.clamp(st.yaw + dyaw, -LIMIT.yaw, LIMIT.yaw)
        if (st.motionBase) st.motionBase.yaw += dyaw
        else st.pitch = MathUtils.clamp(st.pitch + (e.clientY - p.y) * k, LIMIT.pitchDown, LIMIT.pitchUp)
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
      // the click that ends a drag fires right after this; the flag is cleared by the next press
    }
    const wheel = (e: WheelEvent) => {
      if ((e.target as Element)?.closest?.('.ms-window-layer')) return // windows scroll their own content
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
    const blur = () => { s.current.keys.clear(); pointers.clear() }
    window.addEventListener('pointerdown', down)
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', up)
    window.addEventListener('wheel', wheel, { passive: false })
    window.addEventListener('keydown', keyDown)
    window.addEventListener('keyup', keyUp)
    window.addEventListener('blur', blur)
    return () => {
      window.removeEventListener('pointerdown', down)
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', up)
      window.removeEventListener('wheel', wheel)
      window.removeEventListener('keydown', keyDown)
      window.removeEventListener('keyup', keyUp)
      window.removeEventListener('blur', blur)
    }
  }, [])

  const fwd = new Vector3()
  const right = new Vector3()
  const e = new Euler()
  useFrame((_, dt) => {
    const st = s.current
    const d = Math.min(dt, 0.05)
    // keys: arrows look, W A S D step (in the direction the visitor faces)
    if (st.keys.size && enabledRef.current) {
      const k = st.keys
      fwd.set(-Math.sin(st.yaw), 0, -Math.cos(st.yaw))
      right.set(-fwd.z, 0, fwd.x)
      const f = (k.has('w') ? 1 : 0) - (k.has('s') ? 1 : 0)
      const r = (k.has('d') ? 1 : 0) - (k.has('a') ? 1 : 0)
      st.pos.addScaledVector(fwd, f * 1.6 * d).addScaledVector(right, r * 1.6 * d)
      st.pos.x = MathUtils.clamp(st.pos.x, AREA.x0, AREA.x1)
      st.pos.z = MathUtils.clamp(st.pos.z, AREA.z0, AREA.z1)
      const turn = (k.has('arrowleft') ? 1 : 0) - (k.has('arrowright') ? 1 : 0)
      const tilt = (k.has('arrowup') ? 1 : 0) - (k.has('arrowdown') ? 1 : 0)
      st.yaw = MathUtils.clamp(st.yaw + turn * 1.4 * d, -LIMIT.yaw, LIMIT.yaw)
      st.pitch = MathUtils.clamp(st.pitch + tilt * 0.9 * d, LIMIT.pitchDown, LIMIT.pitchUp)
    }
    // motion controls: the phone's orientation, relative to where it pointed when they started
    if (motion.active && motion.has) {
      e.setFromQuaternion(motion.q as Quaternion, 'YXZ')
      if (!st.motionBase) st.motionBase = { device: e.y, yaw: st.yaw }
      let dy = e.y - st.motionBase.device
      dy = Math.atan2(Math.sin(dy), Math.cos(dy))
      st.yaw = MathUtils.clamp(st.motionBase.yaw + dy, -LIMIT.yaw, LIMIT.yaw)
      st.pitch = MathUtils.clamp(e.x, LIMIT.pitchDown, LIMIT.pitchUp)
    } else st.motionBase = null
    const c = st.cur
    c.yaw = MathUtils.damp(c.yaw, st.yaw, motion.active ? 12 : 7, d)
    c.pitch = MathUtils.damp(c.pitch, st.pitch, motion.active ? 12 : 7, d)
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
 * Draws the spatial HTML (the launcher's icons) with the room's own camera
 * (mounted after CameraRig, so the camera has already moved this frame). An icon that drifts far off the line of sight fades
 * and is then hidden (a perspective-projected element near the edge of view
 * would otherwise stretch) — the visitor finds the launcher again by turning
 * back, or with Reset view.
 */
const _f = new Vector3(), _d = new Vector3(), _p = new Vector3()
export function CssLayer() {
  const { camera, size } = useThree()
  const host = useRef<HTMLElement | null>(null)
  useEffect(() => {
    host.current = document.querySelector('.ms-anchor-layer')
    return () => disposeCssRenderer()
  }, [])
  useEffect(() => {
    if (host.current) cssRenderer(host.current).setSize(size.width, size.height)
  }, [size.width, size.height])
  useFrame(() => {
    if (!host.current) return
    camera.getWorldDirection(_f)
    for (const o of cssScene.children) {
      const cos = _d.copy(o.getWorldPosition(_p)).sub(camera.position).normalize().dot(_f)
      const fade = MathUtils.clamp((cos - 0.42) / 0.2, 0, 1)
      o.visible = fade > 0
      const el = (o as unknown as { element: HTMLElement }).element
      el.style.opacity = fade < 1 ? fade.toFixed(3) : ''
    }
    cssRenderer(host.current).render(cssScene, camera)
  })
  return null
}
