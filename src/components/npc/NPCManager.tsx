import { useFrame } from '@react-three/fiber'
import { useRapier } from '@react-three/rapier'
import { useMemo, useRef } from 'react'
import { Vector3 } from 'three'
import { agentPositions, createAnim, playerRuntime, type CharacterAnim } from '@/core/runtime'
import { ROUTES, SIT_HINTS, STANDERS, WALKERS, WANDER_AREAS, type RouteDef } from '@/data/npcPaths'
import { PROJECTS } from '@/data/projects'
import { SIDEWALK_Y } from '@/data/cityLayout'
import { randomLook, type CharacterLook } from '@/components/models/characterLook'
import { useCityData } from '@/components/environment/City'
import { useUIStore } from '@/stores/uiStore'
import { qualitySettings } from '@/utils/performance'
import { createRng } from '@/utils/rng'
import { dampAngle } from '@/utils/movement'
import type { SeatDef } from '@/utils/buildingGen'
import { NPC, type NPCHandle } from './NPC'

type Kind = 'walker' | 'wander' | 'sit' | 'talk' | 'look' | 'phone'

export interface Agent {
  id: string
  kind: Kind
  look: CharacterLook
  anim: CharacterAnim
  pos: Vector3
  yaw: number
  speed: number
  // walker
  route?: RouteDef
  seg: number
  dir: 1 | -1
  pauseChance: number
  wait: number
  // wander
  area?: (typeof WANDER_AREAS)[number]
  target: Vector3
  // talk
  partner?: number
  talkTimer: number
  groundY: number
  groundTimer: number
  handle: NPCHandle | null
  lod: 0 | 1 | 2
}

const FAR = 78
const MID = 46

function pointAlong(route: RouteDef, frac: number) {
  const pts = route.points
  const segs = route.mode === 'loop' ? pts.length : pts.length - 1
  const lens: number[] = []
  let total = 0
  for (let i = 0; i < segs; i++) {
    const a = pts[i]
    const b = pts[(i + 1) % pts.length]
    const l = Math.hypot(b[0] - a[0], b[1] - a[1])
    lens.push(l)
    total += l
  }
  let d = frac * total
  for (let i = 0; i < segs; i++) {
    if (d <= lens[i]) {
      const a = pts[i]
      const b = pts[(i + 1) % pts.length]
      const t = d / lens[i]
      return { x: a[0] + (b[0] - a[0]) * t, z: a[1] + (b[1] - a[1]) * t, seg: (i + 1) % pts.length }
    }
    d -= lens[i]
  }
  return { x: pts[0][0], z: pts[0][1], seg: 1 }
}

function pickSeats(seats: SeatDef[]) {
  const used = new Set<number>()
  const out: SeatDef[] = []
  for (const [hx, hz] of SIT_HINTS) {
    let best = -1
    let bd = 4
    seats.forEach((s, i) => {
      if (used.has(i)) return
      const d = Math.hypot(s.position[0] - hx, s.position[2] - hz)
      if (d < bd) {
        bd = d
        best = i
      }
    })
    if (best >= 0) {
      used.add(best)
      out.push(seats[best])
    }
  }
  return out
}

function freeWanderPoint(area: (typeof WANDER_AREAS)[number], rng: () => number, from: Vector3, out: Vector3) {
  for (let tries = 0; tries < 30; tries++) {
    const x = area.x0 + (area.x1 - area.x0) * rng()
    const z = area.z0 + (area.z1 - area.z0) * rng()
    let ok = true
    for (const [ax, az, r] of area.avoid) {
      if (Math.hypot(x - ax, z - az) < r) ok = false
      // reject paths that cut through the fountain
      const dx = x - from.x
      const dz = z - from.z
      const len2 = dx * dx + dz * dz || 1
      const t = Math.max(0, Math.min(1, ((ax - from.x) * dx + (az - from.z) * dz) / len2))
      if (Math.hypot(from.x + dx * t - ax, from.z + dz * t - az) < r) ok = false
    }
    for (const p of PROJECTS) if (Math.hypot(x - p.position[0], z - p.position[2]) < 3.2) ok = false
    if (ok) return out.set(x, SIDEWALK_Y, z)
  }
  return out.set(19, SIDEWALK_Y, -17)
}

/**
 * Pedestrian population (~35 agents, ~12–20 visible at once). One update loop
 * drives every agent with a tiny state machine on predefined waypoints; far
 * agents update at a reduced rate and very far agents are paused and hidden.
 */
export function NPCManager() {
  const city = useCityData()
  const quality = useUIStore((s) => s.quality)
  const shadowDist = qualitySettings(quality).npcShadowDistance
  const { world, rapier } = useRapier()
  const frame = useRef(0)

  const agents = useMemo(() => {
    const rng = createRng(606)
    const list: Agent[] = []
    let n = 0
    const base = (kind: Kind, x: number, z: number, yaw: number): Agent => {
      const seed = 11 + n++ * 17
      const look = randomLook(seed)
      return {
        id: `npc-${n}`, kind, look, yaw, speed: 1.2,
        anim: createAnim({ walkSpeed: 1.6, runSpeed: 4, walkStride: 0.78 * look.height, runStride: 1.6 }),
        pos: new Vector3(x, SIDEWALK_Y, z), seg: 1, dir: 1, pauseChance: 0.2, wait: 0,
        target: new Vector3(), talkTimer: rng.range(0, 4), groundY: SIDEWALK_Y, groundTimer: rng.range(0, 0.5), handle: null, lod: 0,
      }
    }
    for (const w of WALKERS) {
      const route = ROUTES.find((r) => r.id === w.route)
      if (!route) continue
      const p = pointAlong(route, w.start)
      const a = base('walker', p.x, p.z, 0)
      a.route = route
      a.seg = p.seg
      a.speed = w.speed
      a.pauseChance = w.pauseChance
      a.anim.walkSpeed = w.speed * 1.2
      list.push(a)
    }
    for (const area of WANDER_AREAS) {
      for (let i = 0; i < area.count; i++) {
        const a = base('wander', 0, 0, 0)
        a.area = area
        freeWanderPoint(area, rng.next, new Vector3(19, 0, -14), a.pos)
        freeWanderPoint(area, rng.next, a.pos, a.target)
        a.speed = rng.range(0.9, 1.2)
        list.push(a)
      }
    }
    for (const seat of pickSeats(city.seats)) {
      const a = base('sit', seat.position[0], seat.position[2], seat.yaw)
      a.pos.y = seat.position[1]
      a.anim.pose = 'sit'
      list.push(a)
    }
    const standStart = list.length
    STANDERS.forEach((s) => {
      const a = base(s.pose, s.pos[0], s.pos[1], s.yaw)
      a.anim.pose = s.pose === 'talk' ? 'talk' : s.pose
      if (s.pair !== undefined) a.partner = standStart + s.pair
      list.push(a)
    })
    return list
  }, [city.seats])

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 1 / 20)
    frame.current++
    const pp = playerRuntime.position
    for (let i = 0; i < agents.length; i++) {
      const a = agents[i]
      const d = Math.hypot(a.pos.x - pp.x, a.pos.z - pp.z)
      const lod: 0 | 1 | 2 = d > FAR ? 2 : d > MID ? 1 : 0
      if (lod !== a.lod) {
        a.lod = lod
        a.handle?.setVisible(lod < 2)
        a.handle?.setShadow(d < shadowDist)
      }
      a.anim.active = lod < 2
      if (lod === 2) {
        // paused agents must not block traffic from far away
        agentPositions.delete(a.id)
        continue
      }
      if (lod === 1 && (frame.current + i) % 3 !== 0) continue
      const step = lod === 1 ? dt * 3 : dt
      update(a, step, agents)
      if (a.kind === 'walker' || a.kind === 'wander') {
        a.groundTimer -= step
        if (a.groundTimer <= 0) {
          a.groundTimer = 0.25
          const ray = new rapier.Ray({ x: a.pos.x, y: a.pos.y + 1.5, z: a.pos.z }, { x: 0, y: -1, z: 0 })
          const hit = world.castRay(ray, 4, true, rapier.QueryFilterFlags.EXCLUDE_KINEMATIC | rapier.QueryFilterFlags.EXCLUDE_SENSORS)
          if (hit) a.groundY = a.pos.y + 1.5 - hit.timeOfImpact
        }
        a.pos.y += (a.groundY - a.pos.y) * Math.min(1, step * 12)
        agentPositions.set(a.id, a.pos)
      }
      a.handle?.sync(a.pos, a.yaw)
    }
  }, -1)

  return (
    <group name="npcs">
      {agents.map((a) => (
        <NPC key={a.id} agent={a} />
      ))}
    </group>
  )
}

const _to = new Vector3()

function update(a: Agent, dt: number, all: Agent[]) {
  const anim = a.anim
  if (a.kind === 'sit' || a.kind === 'look' || a.kind === 'phone') {
    anim.speed = 0
    anim.state = 'idle'
    return
  }
  if (a.kind === 'talk') {
    anim.speed = 0
    anim.state = 'idle'
    a.talkTimer -= dt
    if (a.talkTimer <= 0) {
      // turn-taking: when one speaks, the partner listens
      a.talkTimer = 2.5 + Math.random() * 3
      const speaking = anim.pose !== 'talk'
      anim.pose = speaking ? 'talk' : 'none'
      if (a.partner !== undefined) {
        const p = all[a.partner]
        p.anim.pose = speaking ? 'none' : 'talk'
        p.talkTimer = a.talkTimer + 0.3
      }
    }
    return
  }

  // walkers & wanderers
  if (a.wait > 0) {
    a.wait -= dt
    anim.speed = Math.max(0, anim.speed - dt * 6)
    anim.state = anim.speed > 0.1 ? 'walk' : 'idle'
    return
  }
  let tx: number
  let tz: number
  if (a.kind === 'wander') {
    tx = a.target.x
    tz = a.target.z
  } else {
    const pt = a.route!.points[a.seg]
    tx = pt[0]
    tz = pt[1]
  }
  _to.set(tx - a.pos.x, 0, tz - a.pos.z)
  const dist = _to.length()
  if (dist < 0.2) {
    if (a.kind === 'wander') {
      a.wait = 1.5 + Math.random() * 4
      freeWanderPoint(a.area!, Math.random, a.pos, a.target)
    } else {
      advance(a)
      if (Math.random() < a.pauseChance) a.wait = 1 + Math.random() * 3.5
    }
    return
  }
  _to.divideScalar(dist)

  // yield to the player and to agents directly ahead
  let speedScale = 1
  const pp = playerRuntime.position
  const px = pp.x - a.pos.x
  const pz = pp.z - a.pos.z
  const pd = Math.hypot(px, pz)
  if (pd < 1.6 && (px * _to.x + pz * _to.z) / (pd || 1) > 0.35) speedScale = 0
  let sideStep = 0
  for (const o of all) {
    if (o === a || o.lod === 2) continue
    const ox = o.pos.x - a.pos.x
    const oz = o.pos.z - a.pos.z
    const od = Math.hypot(ox, oz)
    if (od < 1.1 && od > 0.001) {
      const ahead = (ox * _to.x + oz * _to.z) / od
      if (ahead > 0.5) {
        speedScale = Math.min(speedScale, 0.35)
        sideStep = ox * -_to.z + oz * _to.x > 0 ? -1 : 1
      }
    }
  }

  const target = a.speed * speedScale
  anim.speed += (target - anim.speed) * Math.min(1, dt * 5)
  const vx = _to.x * anim.speed + -_to.z * sideStep * 0.4 * speedScale
  const vz = _to.z * anim.speed + _to.x * sideStep * 0.4 * speedScale
  a.pos.x += vx * dt
  a.pos.z += vz * dt
  if (anim.speed > 0.05) a.yaw = dampAngle(a.yaw, Math.atan2(_to.x, _to.z), 7, dt, 5)
  anim.phase += ((Math.hypot(vx, vz) * dt) / anim.walkStride) * Math.PI * 2
  anim.state = anim.speed > 0.1 ? 'walk' : 'idle'
  anim.grounded = true
}

function advance(a: Agent) {
  const r = a.route!
  const n = r.points.length
  if (r.mode === 'loop') a.seg = (a.seg + 1) % n
  else {
    if (a.seg + a.dir >= n || a.seg + a.dir < 0) a.dir = (a.dir * -1) as 1 | -1
    a.seg += a.dir
  }
}
