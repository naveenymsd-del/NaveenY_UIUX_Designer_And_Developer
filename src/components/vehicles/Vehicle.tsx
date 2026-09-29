import { CuboidCollider, RigidBody, type RapierRigidBody } from '@react-three/rapier'
import { Suspense, useEffect, useRef } from 'react'
import type { Group } from 'three'
import { GLBModel } from '@/components/models/GLBModel'
import { AssetErrorBoundary } from '@/components/models/ErrorBoundary'
import { MODEL_ASSETS } from '@/data/assets'
import type { VehicleDef } from '@/data/vehiclePaths'
import { useAssetStore } from '@/stores/assetStore'
import { ProceduralVehicle, VEHICLE_SIZE, type VehicleParts } from './ProceduralVehicle'

export interface VehicleHandle {
  group: Group
  body: RapierRigidBody | null
  parts: VehicleParts | null
}

/**
 * A vehicle = kinematic collider + replaceable model. /models/car.glb,
 * van.glb and bus.glb replace the procedural bodies automatically.
 */
export function Vehicle({ def, onReady }: { def: VehicleDef; onReady: (id: string, h: VehicleHandle) => void }) {
  const group = useRef<Group>(null!)
  const body = useRef<RapierRigidBody>(null)
  const handle = useRef<VehicleHandle>({ group: null!, body: null, parts: null })
  const hasGLB = useAssetStore((s) => !!s.models[def.kind])
  const markFailed = useAssetStore((s) => s.markFailed)
  const size = VEHICLE_SIZE[def.kind]

  useEffect(() => {
    handle.current.group = group.current
    handle.current.body = body.current
    onReady(def.id, handle.current)
  }, [def.id, onReady])

  const procedural = <ProceduralVehicle def={def} register={(p) => (handle.current.parts = p)} />
  return (
    <>
      <RigidBody ref={body} type="kinematicPosition" colliders={false}>
        <CuboidCollider args={size.half} position={[0, size.half[1] + 0.05, 0]} />
      </RigidBody>
      <group ref={group}>
        {hasGLB ? (
          <AssetErrorBoundary label={MODEL_ASSETS[def.kind].url} fallback={procedural} onError={() => markFailed(def.kind)}>
            <Suspense fallback={procedural}>
              <GLBModel asset={MODEL_ASSETS[def.kind]} />
            </Suspense>
          </AssetErrorBoundary>
        ) : (
          procedural
        )}
      </group>
    </>
  )
}
