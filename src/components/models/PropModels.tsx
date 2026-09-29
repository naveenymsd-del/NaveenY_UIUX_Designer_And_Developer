import { useGLTF } from '@react-three/drei'
import { Suspense, useMemo } from 'react'
import { MODEL_ASSETS, type ModelAsset } from '@/data/assets'
import { InstancedParts } from '@/components/environment/InstancedParts'
import type { GenContext } from '@/utils/buildingGen'
import { PartBuilder } from '@/utils/partBuilder'
import { bench, propRegistry, streetLamp, tree, type PropKind, type PropPlacement } from '@/utils/propGen'
import { createRng } from '@/utils/rng'
import { AtlasBuilder } from '@/utils/textures'
import { useAssetStore } from '@/stores/assetStore'
import { AssetErrorBoundary } from './ErrorBoundary'
import { prepare } from './GLBModel'

/**
 * Renders GLB replacements for street props at every recorded placement.
 * If a GLB fails at load time, the procedural prop is regenerated in place.
 */
export function PropModels({ placements }: { placements: PropPlacement[] }) {
  const markFailed = useAssetStore((s) => s.markFailed)
  const byKind = useMemo(() => {
    const m = new Map<PropKind, PropPlacement[]>()
    for (const p of placements) {
      const list = m.get(p.kind) ?? []
      list.push(p)
      m.set(p.kind, list)
    }
    return [...m.entries()]
  }, [placements])
  return (
    <>
      {byKind.map(([kind, list]) => (
        <AssetErrorBoundary key={kind} label={MODEL_ASSETS[kind].url} fallback={<ProceduralFallback kind={kind} placements={list} />} onError={() => markFailed(kind)}>
          <Suspense fallback={null}>
            <GLBInstances kind={kind} placements={list} />
          </Suspense>
        </AssetErrorBoundary>
      ))}
    </>
  )
}

function GLBInstances({ kind, placements }: { kind: PropKind; placements: PropPlacement[] }) {
  const asset: ModelAsset = MODEL_ASSETS[kind]
  const { scene } = useGLTF(asset.url)
  const clones = useMemo(() => placements.map(() => prepare(scene.clone(true), kind !== 'bench')), [scene, placements, kind])
  return (
    <>
      {placements.map((p, i) => (
        <group key={i} position={p.position} rotation-y={p.yaw + (asset.rotationY ?? 0)} scale={(asset.scale ?? 1) * p.scale}>
          <primitive object={clones[i]} />
        </group>
      ))}
    </>
  )
}

function ProceduralFallback({ kind, placements }: { kind: PropKind; placements: PropPlacement[] }) {
  const parts = useMemo(() => {
    const b = new PartBuilder()
    const ctx: GenContext = {
      b, signs: new AtlasBuilder(64, 64), decor: new AtlasBuilder(64, 64), screens: [], lamps: [], glassPanes: [], seats: [], lawns: [], tiles: [], waters: [],
    }
    const saved = propRegistry.replaced
    propRegistry.replaced = new Set()
    const rng = createRng(1)
    for (const p of placements) {
      b.push(p.position[0], p.position[1], p.position[2], p.yaw)
      if (kind === 'tree') tree(ctx, rng, 'round', p.scale, false)
      else if (kind === 'bench') bench(b)
      else streetLamp(ctx, rng)
      b.pop()
    }
    propRegistry.replaced = saved
    return b.parts
  }, [kind, placements])
  return <InstancedParts parts={parts} />
}
