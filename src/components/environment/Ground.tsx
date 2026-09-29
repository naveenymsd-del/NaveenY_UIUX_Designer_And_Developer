import { useEffect, useMemo } from 'react'
import { BoxGeometry, type BufferGeometry, MeshStandardMaterial, PlaneGeometry } from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { BLOCKS, SIDEWALK_Y } from '@/data/cityLayout'
import type { RectArea } from '@/utils/buildingGen'
import { asphaltTexture, grassTexture, paverTexture, tileTexture } from '@/utils/textures'

/** World-space UVs so textures tile seamlessly across merged slabs. */
function slabGeometry(rects: { x0: number; x1: number; z0: number; z1: number; y0: number; h: number }[], uvScale: number) {
  const parts: BufferGeometry[] = []
  for (const r of rects) {
    const w = r.x1 - r.x0
    const d = r.z1 - r.z0
    const g = new BoxGeometry(w, r.h, d)
    g.translate((r.x0 + r.x1) / 2, r.y0 + r.h / 2, (r.z0 + r.z1) / 2)
    const pos = g.attributes.position
    const nrm = g.attributes.normal
    const uv = g.attributes.uv
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i)
      const y = pos.getY(i)
      const z = pos.getZ(i)
      const ny = Math.abs(nrm.getY(i))
      const nx = Math.abs(nrm.getX(i))
      if (ny > 0.5) uv.setXY(i, x / uvScale, -z / uvScale)
      else if (nx > 0.5) uv.setXY(i, z / uvScale, y / uvScale)
      else uv.setXY(i, x / uvScale, y / uvScale)
    }
    parts.push(g)
  }
  const merged = mergeGeometries(parts, false)
  parts.forEach((p) => p.dispose())
  return merged
}

export function Ground({ lawns, tiles }: { lawns: RectArea[]; tiles: RectArea[] }) {
  const res = useMemo(() => {
    const asphalt = asphaltTexture()
    asphalt.repeat.set(70, 70)
    const road = new MeshStandardMaterial({ map: asphalt, color: 0xffffff, roughness: 0.92 })
    const paver = new MeshStandardMaterial({ map: paverTexture(), color: 0xffffff, roughness: 0.9 })
    const tile = new MeshStandardMaterial({
      map: tileTexture(), color: 0xffffff, roughness: 0.75, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1,
    })
    const grass = new MeshStandardMaterial({ map: grassTexture(), color: 0xffffff, roughness: 0.95 })
    const slabs = slabGeometry(BLOCKS.map((b) => ({ x0: b.x0, x1: b.x1, z0: b.z0, z1: b.z1, y0: 0, h: SIDEWALK_Y })), 2)
    const tileGeo = slabGeometry(tiles.map((t) => ({ ...t, y0: t.y, h: 0.006 })), 4)
    const lawnGeo = lawns.length ? slabGeometry(lawns.map((l) => ({ ...l, y0: SIDEWALK_Y, h: l.y - SIDEWALK_Y })), 5) : null
    const plane = new PlaneGeometry(700, 700)
    plane.rotateX(-Math.PI / 2)
    return { road, paver, tile, grass, slabs, tileGeo, lawnGeo, plane }
  }, [lawns, tiles])

  useEffect(
    () => () => {
      res.slabs.dispose()
      res.tileGeo.dispose()
      res.lawnGeo?.dispose()
      res.plane.dispose()
      ;[res.road, res.paver, res.tile, res.grass].forEach((m) => m.dispose())
    },
    [res],
  )

  return (
    <group>
      <mesh geometry={res.plane} material={res.road} receiveShadow name="asphalt" />
      <mesh geometry={res.slabs} material={res.paver} receiveShadow name="sidewalks" />
      <mesh geometry={res.tileGeo} material={res.tile} receiveShadow name="plaza-tiles" />
      {res.lawnGeo && <mesh geometry={res.lawnGeo} material={res.grass} receiveShadow name="lawns" />}
    </group>
  )
}
