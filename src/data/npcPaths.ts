/**
 * Lightweight waypoint network for pedestrians — no navmesh or per-agent
 * pathfinding. Routes follow sidewalk centre-lines (2 m from the curb) and
 * cross roads only at crosswalks.
 */
export type RouteMode = 'loop' | 'pingpong'

export interface RouteDef {
  id: string
  mode: RouteMode
  points: [number, number][]
}

// park path ring around the gazebo (radius 4.6 around the park centre)
function ring(cx: number, cz: number, r: number, from: number, to: number, steps: number): [number, number][] {
  const out: [number, number][] = []
  for (let i = 0; i <= steps; i++) {
    const a = from + ((to - from) * i) / steps
    out.push([cx + Math.cos(a) * r, cz + Math.sin(a) * r])
  }
  return out
}

export const ROUTES: RouteDef[] = [
  { id: 'store-loop', mode: 'loop', points: [[-7, -6], [-7, -44], [-44, -44], [-44, -6]] },
  { id: 'cafe-loop', mode: 'loop', points: [[7, 6], [7, 44], [44, 44], [44, 6]] },
  { id: 'park-loop', mode: 'loop', points: [[-7, 6], [-44, 6], [-44, 44], [-7, 44]] },
  { id: 'plaza-loop', mode: 'loop', points: [[7, -6], [44, -6], [44, -44], [7, -44]] },
  { id: 'plaza-crossing', mode: 'pingpong', points: [[-7, -14], [-7, -25], [7, -25], [11, -25], [12.5, -30]] },
  { id: 'cafe-crossing', mode: 'pingpong', points: [[-7, 33], [-7, 25], [7, 25], [7, 19], [9.4, 17], [13.4, 17]] },
  { id: 'campus-in', mode: 'pingpong', points: [[-7, -40], [-7, -44.6], [-6.9, -46.4], [-6.9, -54.4], [-3.2, -56.4]] },
  { id: 'campus-in-east', mode: 'pingpong', points: [[7, -38], [7, -44.6], [6.9, -46.4], [6.9, -54.4], [3.4, -56.6]] },
  { id: 'office-in', mode: 'pingpong', points: [[7, 8], [7, 12], [9.6, 13.6], [13.4, 16.2]] },
  { id: 'promenade', mode: 'loop', points: [[3.4, 57], [3.4, 88], [-3.4, 88], [-3.4, 57]] },
  { id: 'south-west', mode: 'pingpong', points: [[-9.5, 56], [-52, 56]] },
  { id: 'south-east', mode: 'pingpong', points: [[9.5, 56], [52, 56]] },
  { id: 'north-row', mode: 'pingpong', points: [[-50, -56], [-15, -56], [15, -56], [50, -56]] },
  { id: 'avenue-west', mode: 'pingpong', points: [[-7, -44], [-7, -6], [-7, 6], [-7, 44]] },
  { id: 'avenue-east', mode: 'pingpong', points: [[7, 44], [7, 6], [7, -6], [7, -44]] },
  { id: 'west-edge', mode: 'pingpong', points: [[-56, -50], [-56, 50]] },
  { id: 'east-edge', mode: 'pingpong', points: [[56, 50], [56, -50]] },
  {
    id: 'park-ns', mode: 'pingpong',
    points: [[-25.5, 5.5], [-25.5, 19.9], ...ring(-25.5, 25, 5.1, -Math.PI / 2, -Math.PI * 1.5, 8), [-25.5, 30.1], [-25.5, 44.5]],
  },
  {
    id: 'park-ew', mode: 'pingpong',
    points: [[-44.5, 25], [-30.6, 25], ...ring(-25.5, 25, 5.1, Math.PI, 0, 8).slice(1, -1), [-20.4, 25], [-6.5, 25]],
  },
]

export interface WalkerDef {
  route: string
  /** starting fraction along the route (0..1) */
  start: number
  speed: number
  pauseChance: number
}

export const WALKERS: WalkerDef[] = [
  { route: 'store-loop', start: 0.1, speed: 1.35, pauseChance: 0.35 },
  { route: 'store-loop', start: 0.62, speed: 1.2, pauseChance: 0.2 },
  { route: 'cafe-loop', start: 0.3, speed: 1.3, pauseChance: 0.3 },
  { route: 'cafe-loop', start: 0.8, speed: 1.45, pauseChance: 0.2 },
  { route: 'park-loop', start: 0.45, speed: 1.1, pauseChance: 0.3 },
  { route: 'plaza-loop', start: 0.2, speed: 1.25, pauseChance: 0.3 },
  { route: 'plaza-crossing', start: 0.2, speed: 1.3, pauseChance: 0.5 },
  { route: 'cafe-crossing', start: 0.6, speed: 1.2, pauseChance: 0.5 },
  { route: 'campus-in', start: 0.2, speed: 1.3, pauseChance: 0.45 },
  { route: 'campus-in-east', start: 0.7, speed: 1.25, pauseChance: 0.45 },
  { route: 'office-in', start: 0.4, speed: 1.3, pauseChance: 0.5 },
  { route: 'promenade', start: 0.05, speed: 1.2, pauseChance: 0.35 },
  { route: 'promenade', start: 0.55, speed: 1.4, pauseChance: 0.2 },
  { route: 'south-west', start: 0.3, speed: 1.3, pauseChance: 0.2 },
  { route: 'south-east', start: 0.7, speed: 1.2, pauseChance: 0.2 },
  { route: 'north-row', start: 0.4, speed: 1.3, pauseChance: 0.3 },
  { route: 'avenue-west', start: 0.35, speed: 1.4, pauseChance: 0.15 },
  { route: 'avenue-east', start: 0.6, speed: 1.3, pauseChance: 0.15 },
  { route: 'west-edge', start: 0.5, speed: 1.2, pauseChance: 0.1 },
  { route: 'east-edge', start: 0.3, speed: 1.25, pauseChance: 0.1 },
  { route: 'park-ns', start: 0.3, speed: 1.0, pauseChance: 0.4 },
  { route: 'park-ew', start: 0.7, speed: 1.1, pauseChance: 0.4 },
]

/** Plaza wanderers pick random free points in this area. */
export const WANDER_AREAS = [
  { id: 'plaza', x0: 10.5, x1: 28, z0: -41, z1: -9.5, count: 2, avoid: [[19, -25, 5.4]] as [number, number, number][] },
]

/** Seats NPCs occupy, matched to the nearest generated seat. */
export const SIT_HINTS: [number, number][] = [
  [19 + 6.8 * Math.cos(Math.PI / 6), -25 + 6.8 * Math.sin(Math.PI / 6)],
  [19 + 6.8 * Math.cos((7 * Math.PI) / 6), -25 + 6.8 * Math.sin((7 * Math.PI) / 6)],
  [10.6, 13], [10.6, 21], // NFC Solutions forecourt benches
  [-11.6, -56.3], [11.6, -56.3], // campus benches
  [-35, 27.6], [-6.4, 72.5],
]

export interface StandDef {
  pos: [number, number]
  yaw: number
  pose: 'talk' | 'look' | 'phone' | 'coffee' | 'read'
  prop?: 'cup' | 'phone' | 'book' | 'tablet'
  /** partner index for conversations (faces each other, alternates speaking) */
  pair?: number
}

export const STANDERS: StandDef[] = [
  // conversation outside the café corner
  { pos: [7.6, 28.2], yaw: 0, pose: 'talk', pair: 1 },
  { pos: [7.6, 29.5], yaw: Math.PI, pose: 'talk', pair: 0 },
  // conversation in the park circle
  { pos: [-21.6, 21.3], yaw: -2.4, pose: 'talk', pair: 3 },
  { pos: [-22.4, 20.4], yaw: 0.75, pose: 'talk', pair: 2 },
  // plaza, near the studio
  { pos: [26.4, -20.2], yaw: 1.2, pose: 'talk', pair: 5 },
  { pos: [27.6, -19.7], yaw: -1.95, pose: 'talk', pair: 4 },
  // students chatting outside the campus
  { pos: [-3.4, -54.9], yaw: 1.9, pose: 'talk', pair: 7 },
  { pos: [-2.3, -55.4], yaw: -1.2, pose: 'talk', pair: 6 },
  // colleagues on the NFC Solutions forecourt
  { pos: [12.4, 15.0], yaw: 2.2, pose: 'coffee', prop: 'cup' },
  { pos: [12.2, 19.6], yaw: -1.9, pose: 'phone', prop: 'phone' },
  // reading in the Design Park
  { pos: [-30.6, 24.0], yaw: 2.6, pose: 'read', prop: 'book' },
  // window shoppers
  { pos: [-7.7, -29.5], yaw: -Math.PI / 2, pose: 'look' },
  { pos: [-7.8, -12], yaw: -Math.PI / 2, pose: 'look' },
  // waiting at the bus stop, on the phone
  { pos: [-6.2, 36.6], yaw: Math.PI / 2, pose: 'phone' },
  // reading the map board at the information kiosk
  { pos: [3.7, 71.5], yaw: 2.07, pose: 'look' },
]
