import { useFrame, useThree } from '@react-three/fiber'
import { useRef } from 'react'
import { Vector3 } from 'three'
import { playerRuntime, requestTeleport } from '@/core/runtime'

/** ?debug — publishes renderer stats to window.__mindscape for the HUD and automated QA. */
export const debugStats = { fps: 0, calls: 0, triangles: 0, geometries: 0, textures: 0, x: 0, y: 0, z: 0, state: 'idle', grounded: true }

export function DebugProbe() {
  const gl = useThree((s) => s.gl)
  const scene = useThree((s) => s.scene)
  const acc = useRef({ frames: 0, t: 0 })
  useFrame((_, dt) => {
    const a = acc.current
    a.frames++
    a.t += dt
    if (a.t >= 0.5) {
      debugStats.fps = Math.round(a.frames / a.t)
      a.frames = 0
      a.t = 0
    }
    gl.info.autoReset = false
    debugStats.calls = gl.info.render.calls
    debugStats.triangles = gl.info.render.triangles
    debugStats.geometries = gl.info.memory.geometries
    debugStats.textures = gl.info.memory.textures
    gl.info.reset()
    const p = playerRuntime.position
    debugStats.x = +p.x.toFixed(2)
    debugStats.y = +p.y.toFixed(2)
    debugStats.z = +p.z.toFixed(2)
    debugStats.state = playerRuntime.anim.state
    debugStats.grounded = playerRuntime.grounded
    ;(window as unknown as { __mindscape: typeof debugStats; __scene: unknown }).__mindscape = debugStats
    ;(window as unknown as { __scene: unknown }).__scene = scene
    ;(window as unknown as { __teleport: unknown }).__teleport = (x: number, z: number, yaw: number) => requestTeleport(new Vector3(x, 0.8, z), yaw)
  })
  return null
}
