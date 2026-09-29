import { useMemo } from 'react'
import { BoxGeometry, Color, CylinderGeometry, type Group, MeshBasicMaterial, MeshStandardMaterial, PlaneGeometry } from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import { lightPoolTexture } from '@/utils/textures'
import type { VehicleDef } from '@/data/vehiclePaths'

let shared: ReturnType<typeof makeShared> | null = null
function makeShared() {
  const beam = new PlaneGeometry(1, 1)
  beam.rotateX(-Math.PI / 2)
  return {
    body: new RoundedBoxGeometry(1, 1, 1, 3, 0.16),
    box: new BoxGeometry(1, 1, 1),
    wheel: new CylinderGeometry(0.36, 0.36, 0.28, 16).rotateZ(Math.PI / 2),
    hub: new CylinderGeometry(0.18, 0.18, 0.3, 10).rotateZ(Math.PI / 2),
    beam,
    glass: new MeshStandardMaterial({ color: '#4a5a8a', roughness: 0.06, metalness: 0.4, envMapIntensity: 1.6 }),
    tyre: new MeshStandardMaterial({ color: '#2b2350', roughness: 0.9 }),
    hubMat: new MeshStandardMaterial({ color: '#d6cfd9', roughness: 0.3, metalness: 0.7 }),
    trim: new MeshStandardMaterial({ color: '#3b3650', roughness: 0.6 }),
    head: new MeshBasicMaterial({ color: new Color(3.2, 3.0, 2.6) }),
    beamMat: new MeshBasicMaterial({ map: lightPoolTexture(), transparent: true, opacity: 0.35, depthWrite: false, toneMapped: false, color: '#ffe9c6' }),
    ivory: new MeshStandardMaterial({ color: '#fbf5ea', roughness: 0.5 }),
  }
}
export function vehicleShared() {
  if (!shared) shared = makeShared()
  return shared
}

const paintCache = new Map<number, MeshStandardMaterial>()
function paint(color: number) {
  let m = paintCache.get(color)
  if (!m) {
    m = new MeshStandardMaterial({ color, roughness: 0.3, metalness: 0.08, envMapIntensity: 1.2 })
    paintCache.set(color, m)
  }
  return m
}

export interface VehicleParts {
  wheels: Group[]
  tail: MeshBasicMaterial
}

export const VEHICLE_SIZE: Record<VehicleDef['kind'], { half: [number, number, number]; wheelBase: number; length: number }> = {
  car: { half: [0.95, 0.85, 2.1], wheelBase: 1.3, length: 4.2 },
  van: { half: [1.0, 1.15, 2.3], wheelBase: 1.5, length: 4.6 },
  bus: { half: [1.25, 1.6, 5.3], wheelBase: 3.6, length: 10.6 },
}

/**
 * Stylised original vehicles. Registers wheel groups and the tail-light
 * material so the traffic system can spin wheels and flash brake lights.
 */
export function ProceduralVehicle({ def, register }: { def: VehicleDef; register: (p: VehicleParts) => void }) {
  const s = vehicleShared()
  const body = paint(def.color)
  const tail = useMemo(() => new MeshBasicMaterial({ color: new Color(1.4, 0.25, 0.3) }), [])
  const wheelRefs = useMemo(() => [] as Group[], [])
  const size = VEHICLE_SIZE[def.kind]
  const wb = size.wheelBase
  const wheelX = def.kind === 'bus' ? 1.08 : 0.86

  const wheelNodes = [[-wheelX, -wb], [wheelX, -wb], [-wheelX, wb], [wheelX, wb]].map(([x, z], i) => (
    <group key={i} position={[x, 0.36, z]} ref={(g) => { if (g) wheelRefs[i] = g }}>
      <mesh geometry={s.wheel} material={s.tyre} castShadow />
      <mesh geometry={s.hub} material={s.hubMat} />
    </group>
  ))

  return (
    <group ref={() => register({ wheels: wheelRefs, tail })}>
      {def.kind === 'car' && (
        <>
          <mesh geometry={s.body} material={body} position={[0, 0.74, 0]} scale={[1.82, 0.72, 4.1]} castShadow />
          <mesh geometry={s.body} material={body} position={[0, 1.28, -0.25]} scale={[1.6, 0.7, 2.2]} castShadow />
          <mesh geometry={s.body} material={s.glass} position={[0, 1.3, -0.25]} scale={[1.64, 0.5, 2.0]} />
          <mesh geometry={s.box} material={s.glass} position={[0, 1.28, 0.9]} rotation-x={-0.55} scale={[1.44, 0.55, 0.05]} />
          <mesh geometry={s.box} material={s.trim} position={[0, 0.48, 2.06]} scale={[1.72, 0.22, 0.1]} />
          <mesh geometry={s.box} material={s.trim} position={[0, 0.48, -2.06]} scale={[1.72, 0.22, 0.1]} />
        </>
      )}
      {def.kind === 'van' && (
        <>
          <mesh geometry={s.body} material={body} position={[0, 1.2, -0.1]} scale={[1.95, 1.75, 4.5]} castShadow />
          <mesh geometry={s.body} material={s.glass} position={[0, 1.55, 1.6]} scale={[1.82, 0.75, 1.2]} />
          <mesh geometry={s.box} material={s.glass} position={[0.98, 1.55, -0.4]} scale={[0.02, 0.55, 2.4]} />
          <mesh geometry={s.box} material={s.glass} position={[-0.98, 1.55, -0.4]} scale={[0.02, 0.55, 2.4]} />
          <mesh geometry={s.box} material={paint(0xef8a78)} position={[0, 0.95, -0.1]} scale={[1.97, 0.18, 4.3]} />
          <mesh geometry={s.box} material={s.trim} position={[0, 0.48, 2.18]} scale={[1.8, 0.25, 0.1]} />
        </>
      )}
      {def.kind === 'bus' && (
        <>
          <mesh geometry={s.body} material={body} position={[0, 1.65, 0]} scale={[2.5, 2.6, 10.6]} castShadow />
          <mesh geometry={s.box} material={s.glass} position={[0, 2.05, 0]} scale={[2.52, 0.9, 9.6]} />
          <mesh geometry={s.box} material={s.glass} position={[0, 1.9, 5.3]} scale={[2.2, 1.4, 0.04]} />
          <mesh geometry={s.box} material={s.ivory} position={[0, 1.1, 0]} scale={[2.53, 0.22, 10.3]} />
          <mesh geometry={s.box} material={paint(0xf5dd92)} position={[0, 0.8, 0]} scale={[2.53, 0.12, 10.3]} />
          <mesh geometry={s.box} material={s.head} position={[0, 2.78, 5.31]} scale={[1.6, 0.28, 0.03]} />
          <mesh geometry={s.box} material={s.ivory} position={[0, 3.0, 0]} scale={[1.6, 0.25, 4]} />
        </>
      )}
      {/* lights */}
      {(() => {
        const zf = def.kind === 'bus' ? 5.32 : def.kind === 'van' ? 2.3 : 2.07
        const y = def.kind === 'bus' ? 0.95 : 0.78
        const x = def.kind === 'bus' ? 0.9 : 0.62
        return (
          <>
            <mesh geometry={s.box} material={s.head} position={[-x, y, zf]} scale={[0.36, 0.16, 0.04]} />
            <mesh geometry={s.box} material={s.head} position={[x, y, zf]} scale={[0.36, 0.16, 0.04]} />
            <mesh geometry={s.box} material={tail} position={[-x, y + 0.02, -zf]} scale={[0.32, 0.14, 0.04]} />
            <mesh geometry={s.box} material={tail} position={[x, y + 0.02, -zf]} scale={[0.32, 0.14, 0.04]} />
            <mesh geometry={s.beam} material={s.beamMat} position={[0, 0.03, zf + 3.2]} scale={[3.4, 1, 6]} renderOrder={2} />
          </>
        )
      })()}
      {wheelNodes}
    </group>
  )
}
