import { CapsuleCollider, RigidBody, type RapierRigidBody } from '@react-three/rapier'
import { useEffect, useRef } from 'react'
import type { Group, Vector3 } from 'three'
import { CharacterModel } from '@/components/models/CharacterModel'
import { BlobShadow } from '@/components/effects/BlobShadow'
import type { Agent } from './NPCManager'

export interface NPCHandle {
  sync: (pos: Vector3, yaw: number) => void
  setVisible: (v: boolean) => void
  setShadow: (v: boolean) => void
}

/**
 * A pedestrian: replaceable character model + kinematic capsule so the
 * player bumps into people instead of walking through them. The manager
 * owns the simulation and pushes transforms through a handle (no re-renders).
 */
export function NPC({ agent }: { agent: Agent }) {
  const group = useRef<Group>(null!)
  const body = useRef<RapierRigidBody>(null)
  const lastBody = useRef({ x: NaN, z: NaN })

  useEffect(() => {
    agent.handle = {
      sync: (pos, yaw) => {
        const g = group.current
        if (!g) return
        g.position.copy(pos)
        g.rotation.y = yaw
        const rb = body.current
        const lb = lastBody.current
        if (rb && (Math.abs(lb.x - pos.x) > 0.01 || Math.abs(lb.z - pos.z) > 0.01)) {
          rb.setNextKinematicTranslation({ x: pos.x, y: pos.y, z: pos.z })
          lb.x = pos.x
          lb.z = pos.z
        }
      },
      setVisible: (v) => {
        const g = group.current
        if (!g) return
        g.visible = v
        // hidden people drop out of the per-frame scene-graph update entirely (23 bones each)
        g.matrixWorldAutoUpdate = v
        if (v) g.updateMatrixWorld(true)
      },
      setShadow: (v) => {
        group.current?.traverse((o) => {
          if ((o as { isSkinnedMesh?: boolean }).isSkinnedMesh) o.castShadow = v
        })
      },
    }
    agent.handle.sync(agent.pos, agent.yaw)
    agent.handle.setShadow(false)
    // the manager may have decided LOD before this handle existed: apply it now
    agent.handle.setVisible(agent.lod < 2)
    return () => {
      agent.handle = null
    }
  }, [agent])

  const sitting = agent.seated
  return (
    <>
      {!sitting && (
        <RigidBody ref={body} type="kinematicPosition" colliders={false} position={[agent.pos.x, agent.pos.y, agent.pos.z]}>
          <CapsuleCollider args={[0.58, 0.25]} position={[0, 0.84, 0]} />
        </RigidBody>
      )}
      <group ref={group}>
        {/* interior people are seen up close; street pedestrians use the lighter mesh */}
        <CharacterModel anim={agent.anim} look={agent.look} asset="npc" castShadow={false} detail={agent.pos.x > 300 ? 'high' : 'low'} />
        {!sitting && <BlobShadow size={0.95} opacity={0.35} />}
      </group>
    </>
  )
}
