import { useEffect, useMemo } from 'react'
import { Color, InstancedBufferAttribute, InstancedMesh } from 'three'
import type { Part } from '@/utils/partBuilder'
import { getGeometries } from '@/utils/geometries'
import { getMaterial } from '@/utils/materials'

const CHUNK = 64
const CHUNK_THRESHOLD = 1200
const NO_RECEIVE = new Set(['glow', 'emissive', 'lightPool', 'signAtlas', 'decorAtlas'])

/**
 * Batches parts into InstancedMeshes keyed by geometry + material (+ spatial
 * chunk for very large groups so frustum culling still helps the shadow and
 * main passes). The entire procedural city renders in a few dozen draw calls.
 */
export function InstancedParts({ parts, shadows = true }: { parts: Part[]; shadows?: boolean }) {
  const meshes = useMemo(() => {
    const geos = getGeometries()
    const byKind = new Map<string, Part[]>()
    for (const p of parts) {
      const key = `${p.geo}|${p.mat}|${p.cast && shadows ? 1 : 0}`
      let list = byKind.get(key)
      if (!list) byKind.set(key, (list = []))
      list.push(p)
    }
    const groups: [string, Part[]][] = []
    for (const [key, list] of byKind) {
      if (list.length < CHUNK_THRESHOLD) {
        groups.push([key, list])
        continue
      }
      const chunks = new Map<string, Part[]>()
      for (const p of list) {
        const e = p.matrix.elements
        const ck = `${Math.floor(e[12] / CHUNK)},${Math.floor(e[14] / CHUNK)}`
        let c = chunks.get(ck)
        if (!c) chunks.set(ck, (c = []))
        c.push(p)
      }
      for (const [ck, c] of chunks) groups.push([`${key}|${ck}`, c])
    }

    const color = new Color()
    return groups.map(([key, list]) => {
      const [geo, mat, cast] = key.split('|')
      const atlas = mat === 'signAtlas' || mat === 'decorAtlas'
      const geometry = atlas ? geos[geo as Part['geo']].clone() : geos[geo as Part['geo']]
      const mesh = new InstancedMesh(geometry, getMaterial(mat as Part['mat']), list.length)
      const uv = atlas ? new Float32Array(list.length * 4) : null
      list.forEach((p, i) => {
        mesh.setMatrixAt(i, p.matrix)
        mesh.setColorAt(i, color.setHex(p.color))
        if (uv && p.uv) uv.set(p.uv, i * 4)
      })
      if (uv) geometry.setAttribute('uvRect', new InstancedBufferAttribute(uv, 4))
      mesh.instanceMatrix.needsUpdate = true
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
      mesh.computeBoundingSphere()
      mesh.castShadow = cast === '1'
      mesh.receiveShadow = !NO_RECEIVE.has(mat)
      mesh.matrixAutoUpdate = false
      mesh.updateMatrix()
      mesh.name = `parts:${key}`
      if (mat === 'lightPool') mesh.renderOrder = 2
      return { mesh, atlas }
    })
  }, [parts, shadows])

  useEffect(
    () => () => {
      for (const { mesh, atlas } of meshes) {
        if (atlas) mesh.geometry.dispose()
        mesh.dispose()
      }
    },
    [meshes],
  )

  return (
    <>
      {meshes.map(({ mesh }) => (
        <primitive key={mesh.uuid} object={mesh} />
      ))}
    </>
  )
}
