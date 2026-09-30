import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import { AdditiveBlending, type Group, MeshBasicMaterial, RingGeometry } from 'three'
import { SIDEWALK_Y } from '@/data/cityLayout'
import { useGameStore } from '@/stores/gameStore'

/** A soft, temporary ring marking where the guide is taking you (fades after arrival). */
export function NavMarker() {
  const ref = useRef<Group>(null!)
  const res = useMemo(() => ({
    ring: new RingGeometry(0.75, 0.95, 48),
    inner: new RingGeometry(0.2, 1.6, 48),
    mat: new MeshBasicMaterial({ color: '#ffb57a', transparent: true, opacity: 0, depthWrite: false, blending: AdditiveBlending, toneMapped: false }),
    glow: new MeshBasicMaterial({ color: '#ec7a2c', transparent: true, opacity: 0, depthWrite: false, blending: AdditiveBlending, toneMapped: false }),
  }), [])
  useFrame(({ clock }) => {
    const m = useGameStore.getState().navMarker
    const now = performance.now()
    const left = m ? (m.until - now) / 1000 : 0
    const a = m && left > 0 ? Math.min(1, left / 1.2) * Math.min(1, (6.5 - left) / 0.5) : 0
    ref.current.visible = a > 0.01
    if (!m || a <= 0.01) return
    ref.current.position.set(m.x, SIDEWALK_Y + 0.05, m.z)
    const pulse = 1 + Math.sin(clock.elapsedTime * 3) * 0.08
    ref.current.scale.setScalar(pulse)
    res.mat.opacity = 0.7 * a
    res.glow.opacity = 0.18 * a
  })
  return (
    <group ref={ref} visible={false}>
      <mesh geometry={res.ring} material={res.mat} rotation-x={-Math.PI / 2} renderOrder={3} />
      <mesh geometry={res.inner} material={res.glow} rotation-x={-Math.PI / 2} renderOrder={3} />
    </group>
  )
}
