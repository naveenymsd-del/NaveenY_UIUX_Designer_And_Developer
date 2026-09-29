import type { SpecialPose } from '@/core/runtime'

/**
 * Walk-in interiors. Each room is a real, walkable space placed away from the
 * street (the camera fades between them). Everything the room needs — shell,
 * furniture layout, people and story points — is declared here in room-local
 * coordinates (x right, z toward the door; the door is on the +z wall).
 */
export type InteriorId = 'education' | 'office' | 'home'

export interface InteriorDef {
  id: InteriorId
  name: string
  subtitle: string
  origin: [number, number, number]
  width: number
  depth: number
  height: number
  /** where you stand after entering, and where you appear back on the street */
  outside: { pos: [number, number]; yaw: number }
  establish: { position: [number, number, number]; target: [number, number, number] }
  palette: { floor: number; wall: number; wainscot: number; trim: number; ceiling: number }
}

export const INTERIORS: Record<InteriorId, InteriorDef> = {
  education: {
    id: 'education', name: 'My Education', subtitle: 'Learning journey',
    origin: [320, 0, -120], width: 24, depth: 18, height: 3.8,
    outside: { pos: [0, -55.6], yaw: 0 },
    establish: { position: [9.5, 3.2, 7.4], target: [-4, 1.3, -3] },
    palette: { floor: 0xb58a62, wall: 0xf1e9dc, wainscot: 0x4f6b58, trim: 0xf7f2ea, ceiling: 0xf4efe6 },
  },
  office: {
    id: 'office', name: 'NFC Solutions', subtitle: 'My workplace',
    origin: [320, 0, 0], width: 28, depth: 20, height: 3.8,
    outside: { pos: [13.6, 17], yaw: -Math.PI / 2 },
    establish: { position: [11.5, 3.3, 8.6], target: [-2, 1.2, -3.5] },
    palette: { floor: 0xc9c4bb, wall: 0xf2f1ee, wainscot: 0xe3e1dc, trim: 0x3b3e44, ceiling: 0xf6f6f4 },
  },
  home: {
    id: 'home', name: 'My Home', subtitle: 'Profile & story',
    origin: [320, 0, 120], width: 18, depth: 14, height: 3.4,
    outside: { pos: [-7.4, -25], yaw: Math.PI / 2 },
    establish: { position: [6.2, 2.8, 5.2], target: [-1.5, 1.1, -2.5] },
    palette: { floor: 0xa87b56, wall: 0xf3ece1, wainscot: 0xe7dccb, trim: 0xfaf6ef, ceiling: 0xf7f2ea },
  },
}

export function roomToWorld(id: InteriorId, x: number, z: number, y = 0): [number, number, number] {
  const o = INTERIORS[id].origin
  return [o[0] + x, o[1] + y, o[2] + z]
}

/** entry spot just inside the door, facing into the room */
export function interiorEntry(id: InteriorId): { pos: [number, number, number]; yaw: number } {
  const r = INTERIORS[id]
  return { pos: roomToWorld(id, 0, r.depth / 2 - 2.2, 0.6), yaw: Math.PI }
}

export function insideInterior(x: number, z: number): InteriorId | null {
  for (const r of Object.values(INTERIORS)) {
    if (Math.abs(x - r.origin[0]) < r.width / 2 + 1 && Math.abs(z - r.origin[2]) < r.depth / 2 + 1) return r.id
  }
  return null
}

// ── furniture layouts (room-local) ─────────────────────────────────────────
export const EDU_DESKS: [number, number][] = [
  [2.5, -4.6], [5.5, -4.6], [8.5, -4.6], [2.5, -2.0], [5.5, -2.0], [8.5, -2.0],
]
export const OFFICE_DESKS: { x: number; z: number; facing: 1 | -1 }[] = [
  // clusters of two desks facing each other across a shared divider
  { x: 4.2, z: 1.6, facing: -1 }, { x: 4.2, z: 2.9, facing: 1 },
  { x: 7.6, z: 1.6, facing: -1 }, { x: 7.6, z: 2.9, facing: 1 },
  { x: 4.2, z: -2.4, facing: -1 }, { x: 4.2, z: -1.1, facing: 1 },
  { x: 7.6, z: -2.4, facing: -1 }, { x: 7.6, z: -1.1, facing: 1 },
  { x: 11, z: 1.6, facing: -1 }, { x: 11, z: 2.9, facing: 1 },
]

// ── people inside (room-local) ─────────────────────────────────────────────
export interface InteriorPerson {
  room: InteriorId
  x: number
  z: number
  yaw: number
  pose: SpecialPose
  /** seat height above the floor for seated poses */
  seatY?: number
  greeter?: boolean
  outfit?: 'office' | 'student' | 'teacher'
  prop?: 'cup' | 'phone' | 'book' | 'tablet'
}

const chairY = 0.47
// desk chair sits 0.62 behind the desk edge, facing the monitor
const deskSeat = (d: { x: number; z: number; facing: 1 | -1 }) => ({ x: d.x, z: d.z + d.facing * 0.72, yaw: d.facing > 0 ? Math.PI : 0 })

export const INTERIOR_PEOPLE: InteriorPerson[] = [
  // ── NFC Solutions office
  ...[0, 2, 3, 4, 7, 8].map((i) => {
    const s = deskSeat(OFFICE_DESKS[i])
    return { room: 'office' as const, ...s, pose: 'work' as const, seatY: chairY, outfit: 'office' as const }
  }),
  { room: 'office', x: 5.4, z: 6.4, yaw: Math.PI * 0.85, pose: 'read', greeter: true, outfit: 'office', prop: 'tablet' },
  { room: 'office', x: -6.2, z: 5.2, yaw: 0, pose: 'work', seatY: chairY, outfit: 'office' },
  // meeting room: three people in discussion
  { room: 'office', x: -10.6, z: -7.4, yaw: Math.PI / 2, pose: 'sitTalk', seatY: chairY, outfit: 'office' },
  { room: 'office', x: -8.4, z: -7.4, yaw: -Math.PI / 2, pose: 'sit', seatY: chairY, outfit: 'office' },
  { room: 'office', x: -9.5, z: -5.2, yaw: Math.PI, pose: 'sitTalk', seatY: chairY, outfit: 'office' },
  // design wall: two colleagues collaborating
  { room: 'office', x: 10.6, z: -6.6, yaw: -2.3, pose: 'talk', outfit: 'office' },
  { room: 'office', x: 9.6, z: -7.4, yaw: 0.8, pose: 'talk', outfit: 'office', prop: 'tablet' },
  // coffee point
  { room: 'office', x: -11.6, z: -0.6, yaw: 1.2, pose: 'coffee', outfit: 'office', prop: 'cup' },
  // ── Education
  ...[0, 2, 4].map((i) => ({ room: 'education' as const, x: EDU_DESKS[i][0], z: EDU_DESKS[i][1] + 0.62, yaw: Math.PI, pose: 'work' as const, seatY: chairY, outfit: 'student' as const })),
  { room: 'education', x: 9.2, z: -7.6, yaw: -0.3, pose: 'talk', outfit: 'teacher' },
  { room: 'education', x: -9.2, z: -6.4, yaw: Math.PI * 0.9, pose: 'read', outfit: 'student', prop: 'book' },
  { room: 'education', x: 10.4, z: 3.8, yaw: -Math.PI / 2, pose: 'look', outfit: 'student' },
]

/** Walkers inside rooms (room-local waypoint loops). */
export const INTERIOR_ROUTES: { room: InteriorId; points: [number, number][]; speed: number }[] = [
  { room: 'office', points: [[-2.6, 5.2], [1.6, 5.2], [1.6, -3.8], [-2.6, -3.8]], speed: 1.15 },
  { room: 'education', points: [[-3, 4.6], [5.5, 4.6], [5.5, 1.2], [-3, 1.2]], speed: 1.05 },
]

// ── story points inside rooms (room-local anchors) ─────────────────────────
export type StoryKind =
  | 'timeline' | 'classroom' | 'book' | 'certificates' | 'growth' | 'bell'
  | 'reception' | 'workspace' | 'meeting' | 'designWall'
  | 'hello' | 'desk' | 'laptop' | 'bookshelf' | 'journey' | 'portfolio' | 'window' | 'contact'

export interface InteriorStory {
  room: InteriorId
  kind: StoryKind
  name: string
  x: number
  z: number
  radius: number
  label: string
  /** close-up camera (room-local) */
  cam: { position: [number, number, number]; target: [number, number, number] }
}

export const INTERIOR_STORIES: InteriorStory[] = [
  // Education
  { room: 'education', kind: 'timeline', name: 'Learning Journey', x: -10.2, z: 0, radius: 3.2, label: 'Press E to read the timeline', cam: { position: [-5.5, 2.4, 1.5], target: [-12, 1.6, -0.5] } },
  { room: 'education', kind: 'classroom', name: 'Classroom', x: 5.5, z: -6.2, radius: 2.8, label: 'Press E to look at the board', cam: { position: [5.5, 2.3, -1.2], target: [6, 1.9, -9] } },
  { room: 'education', kind: 'book', name: 'Reading Desk', x: -5.8, z: -3.6, radius: 2.2, label: 'Press E to open the book', cam: { position: [-4.2, 2.1, -1.8], target: [-6, 0.9, -4.8] } },
  { room: 'education', kind: 'certificates', name: 'Certificates', x: 10.2, z: 1.4, radius: 2.6, label: 'Press E to view certificates', cam: { position: [5.6, 2.1, 2.2], target: [12, 1.8, 1.4] } },
  { room: 'education', kind: 'growth', name: 'Notice Board', x: 7.6, z: 6.8, radius: 2.2, label: 'Press E to read the notices', cam: { position: [6.5, 2.1, 2.8], target: [7.8, 1.7, 9] } },
  { room: 'education', kind: 'bell', name: 'School Bell', x: -3.2, z: 7.0, radius: 1.8, label: 'Press E to ring the bell', cam: { position: [-1.2, 2.2, 4.4], target: [-3.4, 1.8, 7.6] } },
  // NFC Solutions
  { room: 'office', kind: 'reception', name: 'Reception', x: -3.6, z: 6.4, radius: 2.6, label: 'Press E to explore my workplace', cam: { position: [0.5, 2.3, 8.4], target: [-8, 1.8, 4.5] } },
  { room: 'office', kind: 'workspace', name: 'My Desk', x: 11, z: 5.0, radius: 2.2, label: 'Press E to see my role', cam: { position: [8.8, 2.4, 7.4], target: [11, 1.0, 3.2] } },
  { room: 'office', kind: 'meeting', name: 'Meeting Room', x: -7.2, z: -3.8, radius: 2.4, label: 'Press E to join the meeting', cam: { position: [-4.2, 2.6, -2.0], target: [-9.8, 1.0, -7] } },
  { room: 'office', kind: 'designWall', name: 'Design Wall', x: 7.2, z: -7.6, radius: 2.4, label: 'Press E to explore the design wall', cam: { position: [6.2, 2.4, -3.8], target: [7.4, 1.7, -10] } },
  // Home
  { room: 'home', kind: 'hello', name: 'About Me', x: 0, z: 3.4, radius: 1.8, label: 'Press E to say hello', cam: { position: [2.6, 2.0, 5.8], target: [0, 1.4, 0] } },
  { room: 'home', kind: 'desk', name: 'My Workspace', x: -1.2, z: -4.5, radius: 1.8, label: 'Press E to see my workspace', cam: { position: [0.4, 2.1, -1.6], target: [-0.4, 1.0, -6.5] } },
  { room: 'home', kind: 'laptop', name: 'Design Tools', x: 1.4, z: -4.5, radius: 1.6, label: 'Press E to open the laptop', cam: { position: [1.9, 1.8, -3.2], target: [1.0, 0.95, -6.2] } },
  { room: 'home', kind: 'bookshelf', name: 'Bookshelf', x: -7.2, z: -0.4, radius: 2.0, label: 'Press E to browse the books', cam: { position: [-4.2, 2.0, 0.8], target: [-9, 1.5, -0.4] } },
  { room: 'home', kind: 'journey', name: 'Career Journey', x: 7.2, z: -2.2, radius: 2.0, label: 'Press E to see my journey', cam: { position: [4.2, 2.0, -1.0], target: [9, 1.6, -2.2] } },
  { room: 'home', kind: 'portfolio', name: 'Selected Work', x: 7.2, z: 2.8, radius: 2.0, label: 'Press E to see selected work', cam: { position: [4.2, 2.0, 3.8], target: [9, 1.6, 2.8] } },
  { room: 'home', kind: 'window', name: 'Looking Ahead', x: -4.8, z: -5.1, radius: 1.7, label: 'Press E to look outside', cam: { position: [-3.4, 1.9, -2.6], target: [-5, 1.8, -7] } },
  { room: 'home', kind: 'contact', name: 'Contact', x: -4.6, z: 5.6, radius: 1.6, label: 'Press E to get in touch', cam: { position: [-2.4, 2.0, 3.4], target: [-4.6, 1.5, 7] } },
]
