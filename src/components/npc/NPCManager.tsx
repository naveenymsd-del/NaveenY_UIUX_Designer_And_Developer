import { useFrame, useThree } from '@react-three/fiber'
import { useRapier } from '@react-three/rapier'
import { useMemo, useRef } from 'react'
import { Vector3 } from 'three'
import { agentPositions, createAnim, playerRuntime, type CharacterAnim } from '@/core/runtime'
import { ROUTES, SIT_HINTS, STANDERS, WALKERS, WANDER_AREAS, type RouteDef } from '@/data/npcPaths'
import { PROJECTS } from '@/data/projects'
import { SIDEWALK_Y } from '@/data/cityLayout'
import { INTERIOR_PEOPLE, INTERIOR_ROUTES, roomToWorld } from '@/data/interiors'
import { useGameStore } from '@/stores/gameStore'
import { randomLook, type CharacterLook, type HandProp } from '@/components/models/characterLook'
import { useCityData } from '@/components/environment/City'
import { useUIStore } from '@/stores/uiStore'
import { qualitySettings } from '@/utils/performance'
import { createRng } from '@/utils/rng'
import { dampAngle } from '@/utils/movement'
import type { SeatDef } from '@/utils/buildingGen'
import { NPC, type NPCHandle } from './NPC'
import { COLLEAGUES } from '@/data/colleagues'
import { nameTag } from '@/components/ui/NameTag'
import { greetBubble } from '@/components/ui/GreetBubble'
import { getTime } from '@/core/dayNight'
import type { SpecialPose } from '@/core/runtime'

type Kind = 'walker' | 'wander' | 'sit' | 'talk' | 'still' | 'greeter'

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
  /** seated in a chair / on a bench (no capsule, no blob shadow) */
  seated: boolean
  baseYaw: number
  basePose: CharacterAnim['pose']
  greeted: boolean
  greetT: number
  /** colleague shown on approach (never permanently) */
  name?: string
  role?: string
  fidget?: SpecialPose[]
  fidgetT: number
  fidgetOn: boolean
  /** last time this person said hello (ms) */
  greetedAt: number
  waveT: number
}

// believable workplace wardrobe: shirts, blouses, knits and jackets in muted tones
const OFFICE_TOPS = [0xf3f0ea, 0xdfe6ee, 0x2f3f66, 0x4f5d73, 0x6f7f68, 0xd9c7a6, 0x7a3f45, 0x3c3c40, 0xe8e2d6, 0x9fb1c4]
const OFFICE_BOTTOMS = [0x2b2d33, 0x2e3445, 0x5d5b55, 0x8a7a64, 0x1f2126, 0x4b4038]
const OFFICE_SHOES = [0x2a2626, 0x5b3f2c, 0x2a2626, 0xf3f1ec, 0x3d3530]

const FAR = 58
const MID = 32

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
  const camera = useThree((s) => s.camera)
  const size = useThree((s) => s.size)
  const tagState = useRef({ id: '', shown: false })
  const greetState = useRef({ agent: null as Agent | null, until: 0, nextCheck: 0, quietUntil: 0, last: '' })

  const agents = useMemo(() => {
    const rng = createRng(606)
    const list: Agent[] = []
    let n = 0
    const base = (kind: Kind, x: number, z: number, yaw: number, outfit?: 'office' | 'student' | 'teacher', prop?: HandProp, name?: string): Agent => {
      const colleague = name ? COLLEAGUES.find((c) => c.name === name) : undefined
      const lookFor = colleague?.look ?? (n % 3 === 1 ? 'b' : 'a')
      const seed = 11 + n++ * 17
      const r = createRng(seed)
      const over: Partial<CharacterLook> = { prop: prop ?? 'none' }
      if (outfit === 'office') {
        const b = lookFor === 'b'
        Object.assign(over, {
          topStyle: b ? r.pick(['blouse', 'shirt', 'sweater', 'jacket'] as const) : r.pick(['shirt', 'shirt', 'sweater', 'jacket'] as const),
          hairStyle: b ? r.pick(['long', 'bun', 'ponytail', 'side'] as const) : r.pick(['short', 'side', 'short', 'buzz', 'curly'] as const),
          bottomStyle: b && r.chance(0.35) ? 'skirt' : 'trousers',
          top: r.pick(OFFICE_TOPS), topAccent: r.pick([0xf3f0ea, 0xe8e2d6, 0x3c3c40]), bottom: r.pick(OFFICE_BOTTOMS), shoes: r.pick(OFFICE_SHOES),
          accessory: r.chance(0.4) ? 'lanyard' : r.chance(0.25) ? 'glasses' : 'none',
          longSleeves: r.chance(0.75),
          height: b ? r.range(0.93, 0.99) : r.range(0.98, 1.05),
          build: b ? r.range(0.9, 0.98) : r.range(0.98, 1.08),
        })
      }
      if (outfit === 'student') Object.assign(over, { accessory: r.chance(0.6) ? 'backpack' : 'totebag', topStyle: r.pick(['hoodie', 'tee', 'sweater'] as const) })
      if (outfit === 'teacher') Object.assign(over, { topStyle: 'jacket', accessory: 'glasses', bottomStyle: 'trousers' })
      const look = randomLook(seed, over)
      return {
        id: `npc-${n}`, kind, look, yaw, speed: 1.2,
        anim: createAnim({ walkSpeed: 1.6, runSpeed: 4, walkStride: 1.3 * look.height, runStride: 2.2 }),
        pos: new Vector3(x, SIDEWALK_Y, z), seg: 1, dir: 1, pauseChance: 0.2, wait: 0,
        target: new Vector3(), talkTimer: rng.range(0, 4), groundY: SIDEWALK_Y, groundTimer: rng.range(0, 0.5), handle: null, lod: 0,
        seated: false, baseYaw: yaw, basePose: 'none', greeted: false, greetT: 0,
        name: colleague?.name, role: colleague?.role, fidgetT: 6 + rng.range(0, 12), fidgetOn: false, greetedAt: -1e9, waveT: 0,
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
      a.seated = true
      list.push(a)
    }
    const standStart = list.length
    STANDERS.forEach((s) => {
      const a = base(s.pose === 'talk' ? 'talk' : 'still', s.pos[0], s.pos[1], s.yaw, undefined, s.prop)
      a.anim.pose = s.pose
      if (s.pair !== undefined) a.partner = standStart + s.pair
      list.push(a)
    })
    // people inside the rooms
    for (const p of INTERIOR_PEOPLE) {
      const [x, y, z] = roomToWorld(p.room, p.x, p.z, p.seatY ?? 0)
      const a = base(p.greeter ? 'greeter' : 'still', x, z, p.yaw, p.outfit, p.prop, p.name)
      a.fidget = p.fidget
      a.pos.y = y
      a.anim.pose = p.pose
      a.basePose = p.pose
      a.seated = p.seatY !== undefined
      list.push(a)
    }
    INTERIOR_ROUTES.forEach((r, i) => {
      const points = r.points.map(([px, pz]) => {
        const w = roomToWorld(r.room, px, pz)
        return [w[0], w[2]] as [number, number]
      })
      const route: RouteDef = { id: `room-${r.room}-${i}`, mode: 'loop', points }
      const a = base('walker', route.points[0][0], route.points[0][1], 0, r.room === 'office' ? 'office' : 'student', r.prop ?? 'none', r.name)
      a.pos.y = 0
      a.route = route
      a.seg = 1
      a.speed = r.speed
      a.pauseChance = 0.35
      a.anim.walkSpeed = r.speed * 1.2
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
      a.anim.every = lod === 1 ? 3 : d > 22 ? 2 : 1
      if (lod === 2) {
        // paused agents must not block traffic from far away
        agentPositions.delete(a.id)
        continue
      }
      if (lod === 1 && (frame.current + i) % 3 !== 0) continue
      const step = lod === 1 ? dt * 3 : dt
      update(a, step, agents)
      updateGaze(a)
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
    updateNameTag(agents, tagState.current, camera, size)
    updateGreeting(agents, greetState.current, tagState.current, camera, size, dt)
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
const _tag = new Vector3()

/** proximity name card: the nearest named colleague within reach */
function updateNameTag(agents: Agent[], st: { id: string; shown: boolean }, camera: import('three').Camera, size: { width: number; height: number }) {
  const card = nameTag.card
  const anchor = nameTag.anchor
  if (!card || !anchor) return
  const g = useGameStore.getState()
  const p = playerRuntime.position
  let best: Agent | null = null
  let bd = 2.9
  if (g.phase === 'playing' && !g.activeLocationId && !g.activeProjectId && !g.establishing) {
    for (const a of agents) {
      if (!a.name || a.lod > 0) continue
      const d = Math.hypot(a.pos.x - p.x, a.pos.z - p.z)
      if (d < bd && Math.abs(a.pos.y - p.y) < 1.5) {
        bd = d
        best = a
      }
    }
  }
  if (best) {
    if (st.id !== best.id) {
      st.id = best.id
      if (nameTag.name) nameTag.name.textContent = best.name!
      if (nameTag.role) nameTag.role.textContent = best.role ?? ''
    }
    _tag.set(best.pos.x, best.pos.y + (best.seated ? 1.55 : 2.08) * best.look.height, best.pos.z).project(camera)
    if (_tag.z < 1) {
      const x = (_tag.x * 0.5 + 0.5) * size.width
      const y = (-_tag.y * 0.5 + 0.5) * size.height
      anchor.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`
      if (!st.shown) {
        st.shown = true
        card.classList.add('is-visible')
      }
      return
    }
  }
  if (st.shown) {
    st.shown = false
    card.classList.remove('is-visible')
  }
}

// ── passing greetings ──────────────────────────────────────────────────
const LINES = {
  morning: ['Good morning!', 'Morning!'],
  afternoon: ['Good afternoon!', 'Hey!'],
  evening: ['Good evening!', 'Evening!'],
  night: ['Hi there!', 'Hey!'],
  street: ['Hey!', 'Hi!', 'What’s up?', 'Hi there!', 'Hey Naveen!'],
  park: ['Hi!', 'Hi there!', 'Hey!'],
  office: ['Hey Naveen!', 'Good to see you!', 'Hi Naveen!', 'Hey!'],
}

function pickLine(a: Agent, last: string) {
  const g = useGameStore.getState()
  const h = getTime()
  const time = h >= 5 && h < 12 ? LINES.morning : h >= 12 && h < 17 ? LINES.afternoon : h >= 17 && h < 22 ? LINES.evening : LINES.night
  const p = playerRuntime.position
  const inPark = !g.interior && p.x > -43 && p.x < -8 && p.z > 7 && p.z < 43
  const place = g.interior === 'office' || a.name ? LINES.office : inPark ? LINES.park : LINES.street
  // mostly place-flavoured, sometimes time-of-day; never the same line twice in a row
  const pool = [...place, ...place, ...time].filter((l) => l !== last)
  return pool[Math.floor(Math.random() * pool.length)]
}

/**
 * Now and then, someone you pass says hello. A probability roll, a per-person
 * cooldown and a global quiet period keep it natural — never a chorus.
 */
function updateGreeting(
  agents: Agent[], st: { agent: Agent | null; until: number; nextCheck: number; quietUntil: number; last: string },
  tag: { id: string; shown: boolean }, camera: import('three').Camera, size: { width: number; height: number }, dt: number,
) {
  const card = greetBubble.card
  const anchor = greetBubble.anchor
  if (!card || !anchor) return
  const now = performance.now()
  const g = useGameStore.getState()
  const p = playerRuntime.position
  const calm = g.phase === 'playing' && !g.activeLocationId && !g.activeProjectId && !g.establishing && !g.travel && !g.fade
  if (st.agent && (now > st.until || !calm)) {
    card.classList.remove('is-visible')
    st.agent = null
  }
  if (!st.agent && calm && now > st.nextCheck && now > st.quietUntil) {
    st.nextCheck = now + 400
    let best: Agent | null = null
    let bd = 3.6
    for (const a of agents) {
      if (a.lod > 0 || now - a.greetedAt < 50000) continue
      const d = Math.hypot(a.pos.x - p.x, a.pos.z - p.z)
      if (d < bd && d > 0.9 && Math.abs(a.pos.y - p.y) < 1.5) {
        bd = d
        best = a
      }
    }
    if (best && Math.random() < 0.42) {
      const line = pickLine(best, st.last)
      st.last = line
      st.agent = best
      st.until = now + 2300
      st.quietUntil = now + 2300 + 5000
      best.greetedAt = now
      card.textContent = line
      card.classList.add('is-visible')
      // a small wave from people standing around (not from walkers mid-stride or seated workers)
      const pose = best.anim.pose
      if (!best.seated && best.kind !== 'walker' && best.kind !== 'wander' && (pose === 'none' || pose === 'look' || pose === 'read' || pose === 'phone')) best.waveT = 1.6
    } else if (best) best.greetedAt = now - 46000 // skipped the roll: this person may try again in ~4 s
  }
  // waving
  for (const a of agents) {
    if (a.waveT > 0) {
      a.waveT -= dt
      a.anim.pose = a.waveT > 0 ? 'wave' : a.basePose
    }
  }
  if (st.agent) {
    const a = st.agent
    const lift = tag.shown && tag.id === a.id ? 0.42 : 0
    _tag.set(a.pos.x, a.pos.y + (a.seated ? 1.55 : 2.05) * a.look.height + lift, a.pos.z).project(camera)
    if (_tag.z < 1) {
      const x = (_tag.x * 0.5 + 0.5) * size.width
      const y = (-_tag.y * 0.5 + 0.5) * size.height
      anchor.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`
    }
  }
}

/** occasional alternate poses (a phone check, a stretch, a glance) on a random clock */
function fidget(a: Agent, dt: number) {
  if (!a.fidget?.length) return
  a.fidgetT -= dt
  if (a.fidgetT > 0) return
  if (a.fidgetOn) {
    a.fidgetOn = false
    a.anim.pose = a.basePose
    a.fidgetT = 7 + Math.random() * 14
  } else {
    a.fidgetOn = true
    a.anim.pose = a.fidget[Math.floor(Math.random() * a.fidget.length)]
    a.fidgetT = 2.5 + Math.random() * 3.5
  }
}

/**
 * Scripted but natural office greeting: shortly after the player walks in,
 * the colleague by the entrance looks up, turns toward them, gives a small
 * wave, then goes back to their tablet. Everyone else keeps working.
 */
function greeter(a: Agent, dt: number) {
  const g = useGameStore.getState()
  const anim = a.anim
  anim.speed = 0
  anim.state = 'idle'
  if (g.interior !== 'office') {
    a.greeted = false
    a.greetT = 0
    a.yaw = a.baseYaw
    anim.pose = a.basePose
    return
  }
  const since = performance.now() - g.interiorSince
  if (!a.greeted && since > 2600) {
    a.greeted = true
    a.greetT = 3.4
  }
  if (a.greetT > 0) {
    a.greetT -= dt
    const p = playerRuntime.position
    const toPlayer = Math.atan2(p.x - a.pos.x, p.z - a.pos.z)
    a.yaw = dampAngle(a.yaw, toPlayer, 4, dt, 3)
    anim.pose = a.greetT < 3.0 && a.greetT > 0.6 ? 'wave' : 'none'
    anim.gaze = 0
    if (a.greetT <= 0) anim.pose = a.basePose
  } else {
    a.yaw = dampAngle(a.yaw, a.baseYaw, 2.5, dt, 2)
  }
}

/** People glance at the player walking past (head turn only, no staring). */
function updateGaze(a: Agent) {
  const anim = a.anim
  if (a.lod > 0 || anim.pose === 'work' || a.kind === 'greeter') {
    anim.gazeWeight = 0
    return
  }
  const p = playerRuntime.position
  const dx = p.x - a.pos.x
  const dz = p.z - a.pos.z
  const d = Math.hypot(dx, dz)
  let rel = Math.atan2(dx, dz) - a.yaw
  while (rel > Math.PI) rel -= Math.PI * 2
  while (rel < -Math.PI) rel += Math.PI * 2
  if (d < 4.2 && Math.abs(rel) < 1.9) {
    anim.gaze = Math.max(-1.1, Math.min(1.1, rel))
    anim.gazeWeight = 1 - d / 5
  } else anim.gazeWeight = 0
}

function update(a: Agent, dt: number, all: Agent[]) {
  const anim = a.anim
  if (a.kind === 'greeter') {
    greeter(a, dt)
    return
  }
  if (a.kind === 'sit' || a.kind === 'still') {
    anim.speed = 0
    anim.state = 'idle'
    fidget(a, dt)
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
