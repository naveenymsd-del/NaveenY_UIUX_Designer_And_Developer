import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import { AdditiveBlending, Color, type Group, type Mesh, MeshBasicMaterial, OctahedronGeometry, RingGeometry } from 'three'
import type { InteractiveDef } from '@/data/locations'
import { useGameStore } from '@/stores/gameStore'
import { damp } from '@/utils/movement'

const ringGeo = new RingGeometry(0.78, 1, 48)
ringGeo.rotateX(-Math.PI / 2)
const gemGeo = new OctahedronGeometry(0.32, 0)

/**
 * Visual beacon for an interactive location: a floating gem and a ground
 * ring. Both brighten, grow and pulse when the player is in range, giving
 * clear feedback before the prompt appears.
 */
export function InteractiveObject({ def }: { def: InteractiveDef }) {
  const group = useRef<Group>(null!)
  const ring = useRef<Mesh>(null!)
  const gem = useRef<Mesh>(null!)
  const isProject = def.action === 'OPEN_PROJECT'
  const mats = useMemo(() => {
    const c = new Color(def.accent)
    return {
      ring: new MeshBasicMaterial({ color: c, transparent: true, opacity: 0.4, depthWrite: false, blending: AdditiveBlending, toneMapped: false }),
      gem: new MeshBasicMaterial({ color: c.clone().multiplyScalar(2.4), toneMapped: true }),
    }
  }, [def.accent])
  const st = useRef({ active: 0 })

  useFrame(({ clock }, dt) => {
    const g = useGameStore.getState()
    const near = g.nearbyId === def.id
    const hidden = g.mode === 'projects' || !!g.activeLocationId || !!g.activeProjectId || g.phase !== 'playing'
    const s = st.current
    s.active = damp(s.active, near ? 1 : 0, 8, dt)
    const t = clock.elapsedTime
    group.current.visible = !hidden || g.phase !== 'playing'
    const pulse = 1 + Math.sin(t * 3) * 0.04 + s.active * 0.18
    const r = def.interactionRadius * (isProject ? 0.55 : 0.5)
    ring.current.scale.set(r * pulse, 1, r * pulse)
    ;(ring.current.material as MeshBasicMaterial).opacity = 0.28 + s.active * 0.5 + Math.sin(t * 2) * 0.05
    gem.current.position.y = (isProject ? 2.9 : 3.1) + Math.sin(t * 2.2 + def.position[0]) * 0.15 + s.active * 0.25
    gem.current.rotation.y = t * (0.8 + s.active * 2.5)
    gem.current.scale.setScalar((isProject ? 0.7 : 1) * (1 + s.active * 0.35))
  })

  return (
    <group ref={group} position={def.position}>
      <mesh ref={ring} geometry={ringGeo} material={mats.ring} position-y={0.03} renderOrder={4} />
      <mesh ref={gem} geometry={gemGeo} material={mats.gem} scale={[1, 1.4, 1]} />
    </group>
  )
}

export function InteractiveObjects({ defs }: { defs: InteractiveDef[] }) {
  defs = defs.filter((d) => !d.quiet)
  return (
    <>
      {defs.map((d) => (
        <InteractiveObject key={d.id} def={d} />
      ))}
    </>
  )
}
