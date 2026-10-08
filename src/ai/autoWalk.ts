import { enterInterior, exitInterior } from '@/core/interiors'
import { type AutoWalkResult, playerRuntime } from '@/core/runtime'
import { INTERIORS, inStudio, roomToWorld, studioBay, type InteriorId } from '@/data/interiors'
import { PROJECTS } from '@/data/projects'
import { useGameStore } from '@/stores/gameStore'
import type { DestinationId } from './knowledge'

/**
 * Guided walking for the AI guide. No teleporting: the visitor's character
 * walks a route through the existing world, using the normal controller
 * (collision, animation, turning). Rooms are entered and left through their
 * doors with the existing door transitions.
 *
 * Routes follow the same sidewalk network the pedestrians use
 * (data/npcPaths.ts): sidewalk centre-lines 2 m from the curb, crossing roads
 * at crosswalks. A tiny graph + Dijkstra is all the world needs.
 */
type Pt = [number, number]

/** sidewalk polylines (world x, z); lines that meet share an exact point */
const LINES: Pt[][] = [
  // the avenue's two sidewalks, crossing the cross-streets at the corners
  [[-7, -44.6], [-7, -44], [-7, -25], [-7, -6], [-7, 6], [-7, 25], [-7, 44], [-7, 56]],
  [[7, -44.6], [7, -44], [7, -25], [7, -6], [7, 6], [7, 12], [7, 19], [7, 25], [7, 44], [7, 56]],
  // mid-block crossings of the avenue
  [[-7, -25], [7, -25]],
  [[-7, 25], [7, 25]],
  // campus forecourt (Education)
  [[-7, -44.6], [-6.9, -46.4], [-6.9, -54.4], [-3.2, -56.4]],
  [[7, -44.6], [6.9, -46.4], [6.9, -54.4], [3.4, -56.6]],
  // NFC Solutions forecourt
  [[7, 19], [9.4, 17], [11.4, 17]],
  // Home's front door
  [[-7, -25], [-9.6, -25]],
  // into the park (the Gallery)
  [[-7, 25], [-12, 25], [-20.4, 25]],
  [[-7, 6], [-25.5, 6], [-44, 6]],
  [[-25.5, 6], [-25.5, 19.9]],
  // block loops, so a wandering visitor is always near the network
  [[-7, -6], [-44, -6]],
  [[-7, -44], [-44, -44]],
  [[7, 6], [44, 6], [44, 44], [7, 44]],
  [[7, -6], [44, -6], [44, -44], [7, -44]],
  [[7, -25], [11, -25]],
  // the south promenade, the start and the Contact Café
  [[-7, 56], [-3.4, 57], [-3.4, 70], [0, 70.5], [3.4, 70], [3.4, 57], [7, 56]],
  [[-7, 56], [-9.5, 56], [-12.4, 56]],
]

/** street end points for each destination, and the door used (if it has a room) */
const STREET_GOAL: Record<Exclude<DestinationId, 'projects'>, { at: Pt; room?: { id: InteriorId; location: string } }> = {
  start: { at: [0, 70.5] },
  home: { at: [-9.6, -25], room: { id: 'home', location: 'home' } },
  education: { at: [-3.2, -56.4], room: { id: 'education', location: 'education' } },
  office: { at: [11.4, 17], room: { id: 'office', location: 'nfc' } },
  gallery: { at: [-20.4, 25] },
  contact: { at: [-12.4, 56], room: { id: 'cafe', location: 'cafe' } },
}

/** inside each room: the aisle to the door (room-local), walked before leaving */
const ROOM_EXIT: Record<InteriorId, Pt[]> = {
  home: [[0, 2.2], [0, 5.8]],
  education: [[0, 4.6], [0, 7.9]],
  cafe: [[1.5, 3.0], [0, 4.4]],
  office: [[1.6, 4.6], [0, 8.9]],
}
/** the office corridor from the entrance to the Project Studio (room-local; the colleagues' route) */
const OFFICE_TO_STUDIO: Pt[] = [[1.6, 4.6], [9.5, 4.6], [12.8, 5.8], [15.6, 6.4], [19.8, 6.4]]
const STUDIO_AISLE_X = 19.8

// ── graph ────────────────────────────────────────────────────────────────
interface Node { x: number; z: number; edges: Map<number, number> }
const nodes: Node[] = []
const keyOf = (p: Pt) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`
const index = new Map<string, number>()
function nodeFor(p: Pt) {
  const k = keyOf(p)
  let i = index.get(k)
  if (i === undefined) {
    i = nodes.length
    nodes.push({ x: p[0], z: p[1], edges: new Map() })
    index.set(k, i)
  }
  return i
}
for (const line of LINES) {
  for (let k = 0; k < line.length - 1; k++) {
    const a = nodeFor(line[k])
    const b = nodeFor(line[k + 1])
    const d = Math.hypot(nodes[a].x - nodes[b].x, nodes[a].z - nodes[b].z)
    nodes[a].edges.set(b, d)
    nodes[b].edges.set(a, d)
  }
}

function nearest(x: number, z: number) {
  let best = 0
  let bd = Infinity
  nodes.forEach((n, i) => {
    const d = Math.hypot(n.x - x, n.z - z)
    if (d < bd) { bd = d; best = i }
  })
  return best
}

function shortest(from: number, to: number): number[] | null {
  const dist = nodes.map(() => Infinity)
  const prev = nodes.map(() => -1)
  const open = new Set(nodes.map((_, i) => i))
  dist[from] = 0
  while (open.size) {
    let u = -1
    for (const i of open) if (u < 0 || dist[i] < dist[u]) u = i
    if (u < 0 || dist[u] === Infinity) break
    open.delete(u)
    if (u === to) break
    for (const [v, w] of nodes[u].edges) if (dist[u] + w < dist[v]) { dist[v] = dist[u] + w; prev[v] = u }
  }
  if (dist[to] === Infinity) return null
  const path: number[] = []
  for (let u = to; u >= 0; u = prev[u]) path.unshift(u)
  return path
}

/** street route from (x, z) to a goal point, skipping a first node that lies behind us */
export function streetRoute(x: number, z: number, goal: Pt): Pt[] | null {
  const path = shortest(nearest(x, z), nearest(goal[0], goal[1]))
  if (!path) return null
  const pts: Pt[] = path.map((i) => [nodes[i].x, nodes[i].z])
  if (pts.length > 1 && Math.hypot(pts[1][0] - x, pts[1][1] - z) < Math.hypot(pts[1][0] - pts[0][0], pts[1][1] - pts[0][1])) pts.shift()
  return pts
}

export const routeLength = (pts: Pt[], x: number, z: number) =>
  pts.reduce((sum, p, i) => sum + Math.hypot(p[0] - (i ? pts[i - 1][0] : x), p[1] - (i ? pts[i - 1][1] : z)), 0)

// ── walking ──────────────────────────────────────────────────────────────
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))

export const walker = {
  active: false,
  destination: null as string | null,
  /** increments on every new journey or cancel; stale journeys stop at their next step */
  token: 0,
  cancelResolve: null as null | ((r: AutoWalkResult) => void),
}

function walkPoints(points: Pt[], opts: { run?: boolean; face?: number; onAdvance?: (i: number, of: number) => void } = {}) {
  return new Promise<AutoWalkResult>((resolve) => {
    if (!points.length) return resolve('arrived')
    const finish = (r: AutoWalkResult) => {
      walker.cancelResolve = null
      resolve(r)
    }
    walker.cancelResolve = finish
    playerRuntime.walkTo = null
    playerRuntime.autoWalk = {
      points, i: 0, run: !!opts.run, face: opts.face,
      onAdvance: (i) => opts.onAdvance?.(i, points.length),
      done: finish,
      checkAt: 0, checkX: playerRuntime.position.x, checkZ: playerRuntime.position.z, stuck: 0, sideUntil: 0, side: 1, escX: 0, escZ: 0, holdUntil: 0, backUntil: 0, backX: 0, backZ: 0, yields: 0,
    }
  })
}

/** wait until control is back after a door transition */
async function settled(token: number) {
  for (let t = 0; t < 15000; t += 100) {
    if (token !== walker.token) return false
    const g = useGameStore.getState()
    if (!g.fade && !g.establishing && !g.travel) return true
    await wait(100)
  }
  return false
}

export function cancelWalk() {
  walker.token++
  walker.active = false
  walker.destination = null
  if (playerRuntime.autoWalk) {
    playerRuntime.autoWalk = null
    walker.cancelResolve?.('cancelled')
  }
}

const roomOf = (dest: DestinationId): InteriorId | null =>
  dest === 'home' ? 'home' : dest === 'education' ? 'education' : dest === 'office' || dest === 'projects' ? 'office' : dest === 'contact' ? 'cafe' : null

export interface JourneyHooks {
  /** called once, roughly halfway along the street route */
  onMidway?: () => void
  /** about to go through a door */
  onDoor?: (room: InteriorId) => void
}

/**
 * Walk to a destination (and optionally to one project's screen in the
 * Project Studio). Resolves 'arrived', or how it ended — the visitor took
 * over ('manual'), it was replaced or stopped ('cancelled'), or the way was
 * blocked ('stuck').
 */
export async function journey(dest: DestinationId, projectId: string | null, hooks: JourneyHooks = {}): Promise<AutoWalkResult> {
  // a new journey replaces the current one
  if (playerRuntime.autoWalk) {
    playerRuntime.autoWalk = null
    walker.cancelResolve?.('cancelled')
  }
  const token = ++walker.token
  walker.active = true
  walker.destination = projectId ?? dest
  const live = () => token === walker.token
  const end = (r: AutoWalkResult) => {
    if (live()) {
      walker.active = false
      walker.destination = null
    }
    return r
  }
  const g0 = useGameStore.getState()
  g0.closePanels()
  if (!(await settled(token))) return end('cancelled')

  const target = roomOf(dest)
  let room = useGameStore.getState().interior

  // 1. leave the current room through its door (if we're going elsewhere)
  if (room && room !== target) {
    const p = playerRuntime.position
    const o = INTERIORS[room].origin
    let aisle = ROOM_EXIT[room]
    if (room === 'office' && inStudio(p.x, p.z)) aisle = [[STUDIO_AISLE_X, p.z - o[2]], ...[...OFFICE_TO_STUDIO].reverse(), ...ROOM_EXIT.office.slice(1)]
    const r = await walkPoints(aisle.map(([x, z]) => roomXZ(room!, x, z)))
    if (r !== 'arrived' || !live()) return end(r === 'arrived' ? 'cancelled' : r)
    await exitInterior(room)
    if (!(await settled(token))) return end('cancelled')
    room = null
  }

  // 2. along the street to the destination (and through its door)
  if (!room) {
    const goal = dest === 'projects' ? STREET_GOAL.office : STREET_GOAL[dest]
    const p = playerRuntime.position
    const route = streetRoute(p.x, p.z, goal.at)
    if (!route) return end('stuck')
    // narrate once, about halfway along by distance (silence on short hops)
    const total = routeLength(route, p.x, p.z)
    const covered = route.map((_, i) => routeLength(route.slice(0, i + 1), p.x, p.z))
    let mid = false
    const r = await walkPoints(route, {
      run: total > 22,
      onAdvance: (i) => { if (!mid && total > 30 && covered[i - 1] >= total / 2) { mid = true; hooks.onMidway?.() } },
    })
    if (r !== 'arrived' || !live()) return end(r === 'arrived' ? 'cancelled' : r)
    if (goal.room) {
      hooks.onDoor?.(goal.room.id)
      await enterInterior(goal.room.id, goal.room.location)
      if (!(await settled(token))) return end('cancelled')
      room = goal.room.id
    }
  }

  // 3. inside the office: on to the Project Studio, and to one project's screen
  if (room === 'office' && (dest === 'projects' || projectId)) {
    const p = playerRuntime.position
    const o = INTERIORS.office.origin
    if (!inStudio(p.x, p.z)) {
      const r = await walkPoints(OFFICE_TO_STUDIO.map(([x, z]) => roomXZ('office', x, z)))
      if (r !== 'arrived' || !live()) return end(r === 'arrived' ? 'cancelled' : r)
    }
    if (projectId) {
      const i = PROJECTS.findIndex((q) => q.id === projectId)
      if (i < 0) return end('stuck')
      const bay = studioBay(i)
      const here = playerRuntime.position
      const pts: Pt[] = bay.yaw !== 0
        ? [[STUDIO_AISLE_X, here.z - o[2]], [STUDIO_AISLE_X, bay.stand[1]], bay.stand]
        : [[STUDIO_AISLE_X, here.z - o[2]], [bay.stand[0], bay.stand[1] + 0.6], bay.stand]
      const [sx, , sz] = roomToWorld('office', bay.screen[0], bay.screen[1])
      const [ex, , ez] = roomToWorld('office', bay.stand[0], bay.stand[1])
      const r = await walkPoints(pts.map(([x, z]) => roomXZ('office', x, z)), { face: Math.atan2(sx - ex, sz - ez) })
      if (r !== 'arrived' || !live()) return end(r === 'arrived' ? 'cancelled' : r)
    }
  }
  return end('arrived')
}

function roomXZ(id: InteriorId, x: number, z: number): Pt {
  const [wx, , wz] = roomToWorld(id, x, z)
  return [wx, wz]
}
