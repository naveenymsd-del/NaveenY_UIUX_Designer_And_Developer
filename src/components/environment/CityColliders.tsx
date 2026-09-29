import { CuboidCollider, CylinderCollider, interactionGroups, RigidBody } from '@react-three/rapier'
import { memo, useMemo } from 'react'
import { Euler, Quaternion } from 'three'
import type { BoxColliderDef, CylColliderDef } from '@/utils/partBuilder'

const WALL_GROUPS = interactionGroups(1)

/**
 * All static collision in fixed rigid bodies: simplified cuboids for
 * buildings, ramps and furniture; cylinders for trunks and poles; invisible
 * boundary walls in their own group (the camera ray skips them). No trimesh
 * colliders are used anywhere.
 */
export const CityColliders = memo(function CityColliders({ boxes, cylinders, walls }: { boxes: BoxColliderDef[]; cylinders: CylColliderDef[]; walls: BoxColliderDef[] }) {
  const quats = useMemo(() => {
    const e = new Euler()
    const q = new Quaternion()
    return boxes.map((b) => {
      e.set(b.rotX ?? 0, b.rotY, 0, 'YXZ')
      q.setFromEuler(e)
      return [q.x, q.y, q.z, q.w] as [number, number, number, number]
    })
  }, [boxes])
  return (
    <>
      <RigidBody type="fixed" colliders={false} name="city-static">
        {boxes.map((b, i) => (
          <CuboidCollider key={`b${i}`} args={b.half} position={b.center} quaternion={quats[i]} friction={0.4} />
        ))}
        {cylinders.map((c, i) => (
          <CylinderCollider key={`c${i}`} args={[c.halfHeight, c.radius]} position={c.center} />
        ))}
      </RigidBody>
      <RigidBody type="fixed" colliders={false} name="world-bounds">
        {walls.map((w, i) => (
          <CuboidCollider key={`w${i}`} args={w.half} position={w.center} collisionGroups={WALL_GROUPS} />
        ))}
      </RigidBody>
    </>
  )
})
