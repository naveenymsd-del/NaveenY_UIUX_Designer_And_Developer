import { useMemo } from 'react'
import { MeshBasicMaterial, PlaneGeometry } from 'three'
import { blobShadowTexture } from '@/utils/textures'

let geo: PlaneGeometry | null = null
const mats = new Map<number, MeshBasicMaterial>()

/** Soft contact shadow that grounds characters even where the shadow map is coarse. */
export function BlobShadow({ size = 1, opacity = 0.45 }: { size?: number; opacity?: number }) {
  const g = useMemo(() => {
    if (!geo) {
      geo = new PlaneGeometry(1, 1)
      geo.rotateX(-Math.PI / 2)
    }
    return geo
  }, [])
  const m = useMemo(() => {
    const key = Math.round(opacity * 100)
    let mat = mats.get(key)
    if (!mat) {
      mat = new MeshBasicMaterial({
        map: blobShadowTexture(), transparent: true, depthWrite: false, opacity, toneMapped: false,
        polygonOffset: true, polygonOffsetFactor: -6, polygonOffsetUnits: -6,
      })
      mats.set(key, mat)
    }
    return mat
  }, [opacity])
  return <mesh geometry={g} material={m} scale={[size, 1, size]} renderOrder={2} />
}
