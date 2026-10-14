import { useFrame, useThree } from '@react-three/fiber'
import { Vector3 } from 'three'
import { PREVIEW_POINTS, ROUTE, previewRuntime } from '@/core/preview'

const _v = new Vector3()

/**
 * Keeps the welcome screen's destination markers on their buildings: each
 * frame, every stop's real world position is projected through the real
 * camera and its marker moved there (a transform — no React render). Markers
 * that fall outside the preview stage are hidden. Renders nothing itself.
 */
export function PreviewProjector() {
  const camera = useThree((s) => s.camera)
  const size = useThree((s) => s.size)
  useFrame(() => {
    if (!previewRuntime.active || !previewRuntime.markers.size) return
    const st = previewRuntime.stage
    const pts: string[] = []
    for (const id of ROUTE) {
      const el = previewRuntime.markers.get(id)
      _v.copy(PREVIEW_POINTS[id]).project(camera)
      const x = (_v.x * 0.5 + 0.5) * size.width
      const y = (-_v.y * 0.5 + 0.5) * size.height
      const inside = _v.z < 1 && x >= st.x + 8 && x <= st.x + st.w - 8 && y >= st.y + 8 && y <= st.y + st.h - 8
      if (el) {
        el.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`
        el.classList.toggle('is-out', !inside)
      }
      pts.push(`${x.toFixed(1)},${y.toFixed(1)}`)
    }
    previewRuntime.route?.setAttribute('points', pts.join(' '))
  })
  return null
}
