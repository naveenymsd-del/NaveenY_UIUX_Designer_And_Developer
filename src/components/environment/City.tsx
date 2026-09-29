import { useEffect, useMemo } from 'react'
import { BuildingModel } from '@/components/models/BuildingModel'
import { PropModels } from '@/components/models/PropModels'
import { BUILDINGS } from '@/data/cityLayout'
import { useAssetStore } from '@/stores/assetStore'
import { useGameStore } from '@/stores/gameStore'
import { generateCity, type CityData } from '@/utils/cityGen'
import { setAtlasTextures } from '@/utils/materials'
import type { PropKind } from '@/utils/propGen'
import { CityColliders } from './CityColliders'
import { GlassPanes } from './GlassPanes'
import { Ground } from './Ground'
import { InstancedParts } from './InstancedParts'
import { Screens } from './Screens'
import { WaterSurfaces } from './WaterSurfaces'

let cityCache: { key: string; data: CityData } | null = null

/** Generates the neighbourhood once (deterministic) and renders every layer of it. */
export function useCityData() {
  const models = useAssetStore((s) => s.models)
  return useMemo(() => {
    const replaceProps = new Set<PropKind>((['tree', 'bench', 'lamp'] as const).filter((k) => models[k]))
    const modelBuildingIds = new Set(BUILDINGS.filter((b) => b.model).map((b) => b.id))
    const key = [...replaceProps].join(',') + '|' + [...modelBuildingIds].join(',')
    if (cityCache?.key === key) return cityCache.data
    const t0 = performance.now()
    const data = generateCity({ replaceProps, modelBuildingIds })
    setAtlasTextures(data.signTexture, data.decorTexture)
    if (import.meta.env.DEV) {
      console.info(`[city] generated ${data.parts.length} parts, ${data.colliders.length + data.cylColliders.length} colliders in ${(performance.now() - t0).toFixed(0)} ms`)
    }
    cityCache = { key, data }
    return data
  }, [models])
}

export function City({ shadows = true, parts = true }: { shadows?: boolean; parts?: boolean }) {
  const data = useCityData()
  const setLoading = useGameStore((s) => s.setLoading)
  useEffect(() => {
    setLoading({ worldReady: true })
  }, [setLoading])
  return (
    <group name="city">
      <Ground lawns={data.lawns} tiles={data.tiles} />
      {parts && <InstancedParts parts={data.parts} shadows={shadows} />}
      <Screens screens={data.screens} />
      <WaterSurfaces waters={data.waters} />
      <GlassPanes panes={data.glassPanes} />
      <CityColliders boxes={data.colliders} cylinders={data.cylColliders} walls={data.walls} />
      {data.propPlacements.length > 0 && <PropModels placements={data.propPlacements} />}
      {data.modelBuildings.map((b) => (
        <BuildingModel key={b.id} def={b} />
      ))}
    </group>
  )
}
