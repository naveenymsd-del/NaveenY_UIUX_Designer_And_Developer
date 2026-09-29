import { useEffect } from 'react'
import { CAMERA_DEFAULTS, cameraRuntime } from '@/core/runtime'
import { clamp } from '@/utils/movement'

/**
 * Mouse / touch orbit for the third-person camera: drag to rotate (vertical
 * rotation is clamped so the camera never flips), wheel or pinch to zoom.
 * Pointers that start on UI controls (joystick, buttons) are ignored because
 * those elements stop propagation.
 */
export function useCameraControls(element: HTMLElement | null, enabled: boolean) {
  useEffect(() => {
    if (!element) return
    const pointers = new Map<number, { x: number; y: number }>()
    let pinchDist = 0

    const down = (e: PointerEvent) => {
      if (!enabled) return
      if (e.pointerType === 'mouse' && e.button !== 0 && e.button !== 2) return
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY })
      try {
        element.setPointerCapture(e.pointerId)
      } catch {
        /* pointer already released */
      }
      if (pointers.size === 2) {
        const [a, b] = [...pointers.values()]
        pinchDist = Math.hypot(a.x - b.x, a.y - b.y)
      }
      element.classList.add('is-dragging')
    }
    const move = (e: PointerEvent) => {
      const prev = pointers.get(e.pointerId)
      if (!prev || !enabled) return
      const dx = e.clientX - prev.x
      const dy = e.clientY - prev.y
      prev.x = e.clientX
      prev.y = e.clientY
      if (pointers.size >= 2) {
        const [a, b] = [...pointers.values()]
        const d = Math.hypot(a.x - b.x, a.y - b.y)
        if (pinchDist > 0) cameraRuntime.distance = clamp(cameraRuntime.distance * (pinchDist / d), CAMERA_DEFAULTS.minDistance, CAMERA_DEFAULTS.maxDistance)
        pinchDist = d
      } else {
        const touch = e.pointerType === 'touch'
        const sx = touch ? 0.0075 : 0.0055
        const sy = touch ? 0.006 : 0.0042
        cameraRuntime.targetYaw -= dx * sx
        cameraRuntime.targetPitch = clamp(cameraRuntime.targetPitch + dy * sy, CAMERA_DEFAULTS.minPitch, CAMERA_DEFAULTS.maxPitch)
      }
      cameraRuntime.dragging = true
      cameraRuntime.lastUserInput = performance.now()
    }
    const up = (e: PointerEvent) => {
      pointers.delete(e.pointerId)
      if (pointers.size < 2) pinchDist = 0
      if (pointers.size === 0) {
        cameraRuntime.dragging = false
        element.classList.remove('is-dragging')
      }
    }
    const wheel = (e: WheelEvent) => {
      if (!enabled) return
      e.preventDefault()
      cameraRuntime.distance = clamp(cameraRuntime.distance * (1 + e.deltaY * 0.0011), CAMERA_DEFAULTS.minDistance, CAMERA_DEFAULTS.maxDistance)
      cameraRuntime.lastUserInput = performance.now()
    }
    const ctx = (e: Event) => e.preventDefault()

    element.addEventListener('pointerdown', down)
    element.addEventListener('pointermove', move)
    element.addEventListener('pointerup', up)
    element.addEventListener('pointercancel', up)
    element.addEventListener('lostpointercapture', up)
    element.addEventListener('wheel', wheel, { passive: false })
    element.addEventListener('contextmenu', ctx)
    return () => {
      element.removeEventListener('pointerdown', down)
      element.removeEventListener('pointermove', move)
      element.removeEventListener('pointerup', up)
      element.removeEventListener('pointercancel', up)
      element.removeEventListener('lostpointercapture', up)
      element.removeEventListener('wheel', wheel)
      element.removeEventListener('contextmenu', ctx)
    }
  }, [element, enabled])
}
