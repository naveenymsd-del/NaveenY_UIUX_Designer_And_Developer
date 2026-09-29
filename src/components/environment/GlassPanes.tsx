import { useMemo } from 'react'
import { MeshStandardMaterial, PlaneGeometry } from 'three'
import type { GlassPane } from '@/utils/buildingGen'

/** Transparent storefront glass with environment reflections (interiors stay visible). */
export function GlassPanes({ panes }: { panes: GlassPane[] }) {
  const geo = useMemo(() => new PlaneGeometry(1, 1), [])
  const mat = useMemo(
    () =>
      new MeshStandardMaterial({
        color: '#d9ecff', roughness: 0.04, metalness: 0.2, transparent: true, opacity: 0.22, envMapIntensity: 2.2, depthWrite: false,
      }),
    [],
  )
  return (
    <group>
      {panes.map((p, i) => (
        <mesh key={i} geometry={geo} material={mat} position={p.position} rotation-y={p.yaw} scale={[p.size[0], p.size[1], 1]} renderOrder={3} />
      ))}
    </group>
  )
}
