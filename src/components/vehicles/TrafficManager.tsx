import { useFrame } from '@react-three/fiber'
import { useCallback, useMemo, useRef } from 'react'
import { Color, Quaternion, Vector3 } from 'three'
import { sky } from '@/core/dayNight'
import { agentPositions, playerRuntime, vehiclePositions } from '@/core/runtime'
import { soundManager } from '@/core/sound/SoundManager'
import { buildLoop, LOOPS, samplePath, VEHICLES, type SampledPath, type VehicleDef } from '@/data/vehiclePaths'
import { dampAngle } from '@/utils/movement'
import { Vehicle, type VehicleHandle } from './Vehicle'
import { VEHICLE_SIZE } from './ProceduralVehicle'

interface Sim {
  def: VehicleDef
  path: SampledPath
  s: number
  speed: number
  yaw: number
  pos: Vector3
  hx: number
  hz: number
  braking: number
  wheelSpin: number
  handle: VehicleHandle | null
  /** QA only (?debug): parked here, ignoring its lane */
  parked?: { x: number; z: number; yaw: number }
}

const _q = new Quaternion()
const _up = new Vector3(0, 1, 0)
const _out = { x: 0, z: 0, hx: 0, hz: 1 }
const BRAKE_ON = new Color(3.2, 0.35, 0.4)
const BRAKE_OFF = new Color(1.3, 0.22, 0.28)
const TAIL_NIGHT = new Color(2.1, 0.3, 0.32)
const _off = new Color()

/**
 * Path-based traffic: no vehicle physics, just arc-length motion along lane
 * loops with smooth acceleration, braking for pedestrians / the player /
 * vehicles ahead, rolling wheels, brake lights and engine-hum proximity.
 */
export function TrafficManager() {
  const paths = useMemo(() => {
    const m = new Map<string, SampledPath>()
    for (const [k, corners] of Object.entries(LOOPS)) m.set(k, buildLoop(corners))
    return m
  }, [])
  const sims = useMemo<Sim[]>(
    () =>
      VEHICLES.map((def) => {
        const path = paths.get(def.loop)!
        const s = def.start * path.length
        samplePath(path, s, _out)
        return { def, path, s, speed: def.speed, yaw: Math.atan2(_out.hx, _out.hz), pos: new Vector3(_out.x, 0, _out.z), hx: _out.hx, hz: _out.hz, braking: 0, wheelSpin: 0, handle: null }
      }),
    [paths],
  )
  const handles = useRef(new Map<string, VehicleHandle>())
  // QA hook (?debug only): park a vehicle across the route to test guided walks around traffic
  if (typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('debug')) {
    const w = window as unknown as { __parkVehicle?: unknown; __unparkVehicles?: unknown }
    w.__parkVehicle = (x: number, z: number, yaw = 0, i = 0) => {
      const v = sims[i % sims.length]
      v.parked = { x, z, yaw }
      return v.def.kind
    }
    w.__unparkVehicles = () => sims.forEach((v) => delete v.parked)
  }
  const onReady = useCallback((id: string, h: VehicleHandle) => {
    handles.current.set(id, h)
    const sim = sims.find((s) => s.def.id === id)
    if (sim) sim.handle = h
  }, [sims])

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 1 / 20)
    const pp = playerRuntime.position
    let nearest = Infinity
    for (const v of sims) {
      if (v.parked) {
        v.pos.set(v.parked.x, 0, v.parked.z)
        v.yaw = v.parked.yaw
        v.hx = Math.sin(v.yaw)
        v.hz = Math.cos(v.yaw)
        v.speed = 0
        vehiclePositions.set(v.def.id, v.pos)
        const ph = v.handle
        if (ph?.group) {
          ph.group.position.copy(v.pos)
          ph.group.rotation.y = v.yaw
          _q.setFromAxisAngle(_up, v.yaw)
          ph.body?.setNextKinematicTranslation({ x: v.pos.x, y: 0, z: v.pos.z })
          ph.body?.setNextKinematicRotation(_q)
        }
        continue
      }
      const size = VEHICLE_SIZE[v.def.kind]
      const front = size.half[2]
      let target = v.def.speed
      // obstacles: player + pedestrians
      const check = (ox: number, oz: number, halfWidth: number) => {
        const rx = ox - v.pos.x
        const rz = oz - v.pos.z
        const ahead = rx * v.hx + rz * v.hz
        const lateral = Math.abs(rx * -v.hz + rz * v.hx)
        if (ahead > 0 && ahead < front + 9 && lateral < halfWidth) {
          target = Math.min(target, Math.max(0, (ahead - front - 2.2) * 1.3))
        }
      }
      check(pp.x, pp.z, 1.9)
      for (const a of agentPositions.values()) check(a.x, a.z, 1.7)
      // vehicles ahead in the same lane direction
      for (const o of sims) {
        if (o === v) continue
        if (o.hx * v.hx + o.hz * v.hz < 0.4) continue
        const rx = o.pos.x - v.pos.x
        const rz = o.pos.z - v.pos.z
        const ahead = rx * v.hx + rz * v.hz
        const lateral = Math.abs(rx * -v.hz + rz * v.hx)
        const gap = front + VEHICLE_SIZE[o.def.kind].half[2] + 3
        if (ahead > 0 && ahead < gap + 8 && lateral < 1.8) target = Math.min(target, Math.max(0, (ahead - gap) * 1.1))
      }
      // slow down in corners
      const aheadDir = samplePath(v.path, v.s + 6, _out)
      const turn = 1 - (aheadDir.hx * v.hx + aheadDir.hz * v.hz)
      target = Math.min(target, v.def.speed * (1 - Math.min(0.5, turn * 1.6)))

      const accel = target > v.speed ? 2.6 : 7.5
      v.speed += Math.max(-accel * dt, Math.min(accel * dt, target - v.speed))
      v.braking += ((target < v.speed - 0.2 || v.speed < 0.3 ? 1 : 0) - v.braking) * Math.min(1, dt * 8)
      v.s += v.speed * dt
      samplePath(v.path, v.s, _out)
      v.pos.set(_out.x, 0, _out.z)
      v.hx = _out.hx
      v.hz = _out.hz
      v.yaw = dampAngle(v.yaw, Math.atan2(_out.hx, _out.hz), 10, dt)
      vehiclePositions.set(v.def.id, v.pos)

      const h = v.handle
      if (h?.group) {
        h.group.position.copy(v.pos)
        h.group.rotation.y = v.yaw
        _q.setFromAxisAngle(_up, v.yaw)
        h.body?.setNextKinematicTranslation({ x: v.pos.x, y: 0, z: v.pos.z })
        h.body?.setNextKinematicRotation(_q)
        if (h.parts) {
          v.wheelSpin += (v.speed * dt) / 0.36
          for (const w of h.parts.wheels) if (w) w.rotation.x = v.wheelSpin
          // running lights come up after dark; braking still reads brighter
          _off.copy(BRAKE_OFF).lerp(TAIL_NIGHT, sky.lights)
          h.parts.tail.color.lerpColors(_off, BRAKE_ON, v.braking)
        }
      }
      nearest = Math.min(nearest, Math.hypot(v.pos.x - pp.x, v.pos.z - pp.z))
    }
    soundManager.setVehicleProximity(1 - nearest / 26)
    agentPositions.set('player', pp)
  })

  return (
    <group name="traffic">
      {sims.map((s) => (
        <Vehicle key={s.def.id} def={s.def} onReady={onReady} />
      ))}
    </group>
  )
}
