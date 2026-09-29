import { useGLTF } from '@react-three/drei'
import { Suspense, useMemo, type ReactNode } from 'react'
import { Box3, Vector3 } from 'three'
import { SIDEWALK_Y, facingYaw, type BuildingDef } from '@/data/cityLayout'
import { AssetErrorBoundary } from './ErrorBoundary'
import { prepare } from './GLBModel'

/**
 * <BuildingModel def={...} /> renders a GLB building fitted to the lot
 * footprint (auto-scaled to width/depth). Set `model: '/models/building-a.glb'`
 * on a BuildingDef in data/cityLayout.ts to use one; collision stays data-driven.
 */
export function BuildingModel({ def, fallback }: { def: BuildingDef; fallback?: ReactNode }) {
  if (!def.model) return null
  return (
    <AssetErrorBoundary label={def.model} fallback={fallback ?? null}>
      <Suspense fallback={null}>
        <FittedGLB def={def} />
      </Suspense>
    </AssetErrorBoundary>
  )
}

function FittedGLB({ def }: { def: BuildingDef }) {
  const { scene } = useGLTF(def.model!)
  const { obj, scale, offset } = useMemo(() => {
    const o = prepare(scene.clone(true), true)
    const box = new Box3().setFromObject(o)
    const size = box.getSize(new Vector3())
    const s = Math.min(def.w / Math.max(0.001, size.x), def.d / Math.max(0.001, size.z))
    const center = box.getCenter(new Vector3())
    return { obj: o, scale: s, offset: [-center.x * s, -box.min.y * s, -center.z * s] as [number, number, number] }
  }, [scene, def])
  return (
    <group position={[def.x, SIDEWALK_Y, def.z]} rotation-y={facingYaw(def.facing)}>
      <group position={offset} scale={scale}>
        <primitive object={obj} />
      </group>
    </group>
  )
}
