import { useGLTF } from '@react-three/drei'
import { useMemo } from 'react'
import type { Mesh, Object3D } from 'three'
import type { ModelAsset } from '@/data/assets'

/** Generic static GLB: cloned per use, shadows enabled, manifest transform applied. */
export function GLBModel({ asset, castShadow = true }: { asset: ModelAsset; castShadow?: boolean }) {
  const { scene } = useGLTF(asset.url)
  const obj = useMemo(() => prepare(scene.clone(true), castShadow), [scene, castShadow])
  return (
    <group rotation-y={asset.rotationY ?? 0} position-y={asset.offsetY ?? 0} scale={asset.scale ?? 1}>
      <primitive object={obj} />
    </group>
  )
}

export function prepare(o: Object3D, castShadow: boolean) {
  o.traverse((c) => {
    const m = c as Mesh
    if (m.isMesh) {
      m.castShadow = castShadow
      m.receiveShadow = true
    }
  })
  return o
}
