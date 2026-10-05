import { PROJECTS } from './projects'
import {
  CAREER_STAGES,
  ACTIVITY_STORIES, AI_STORY, DESIGN_PROCESS, EDUCATION_STORIES, HOME_STORIES, OFFICE_STORIES, type StoryContent,
} from './portfolioContent'
import { INTERIORS, INTERIOR_STORIES, roomToWorld, studioBay, type InteriorId } from './interiors'

export type InteractionAction =
  | 'OPEN_LOCATION' | 'OPEN_PROJECT' | 'ENTER_INTERIOR' | 'EXIT_INTERIOR' | 'OPEN_PROJECTS' | 'GO_PROJECTS' | 'RING_BELL' | 'CAFE_SIT'

export type LocationType = 'education' | 'office' | 'home' | 'park' | 'projects' | 'info' | 'story' | 'project' | 'exit' | 'final'

export interface CameraShot {
  position: [number, number, number]
  target: [number, number, number]
}

/**
 * Every interactive point in the world. Adding a location only requires a new
 * entry: beacons, prompts, E-interaction, camera shots, panels, the minimap and
 * the accessible overview all read from this list.
 */
export interface InteractiveDef {
  id: string
  name: string
  kicker: string
  description: string
  type: LocationType
  position: [number, number, number]
  interactionRadius: number
  label: string
  mobileLabel: string
  action: InteractionAction
  /** project id, interior id or content key depending on the action */
  destination: string
  cameraTarget: CameraShot
  accent: string
  content?: StoryContent
  /** minimap marker (major destinations only) */
  marker?: { label: string; icon: 'education' | 'office' | 'home' | 'park' | 'projects' | 'info'; sub?: string; mapAt?: [number, number] }
  /** hide the floating beacon (story objects animate themselves instead) */
  quiet?: boolean
  highlights?: string[]
  hours?: string
  mapLabel?: string
}

// ── Design Park: the design-process trail (serpentine through the NE lawn) ──
export const PROCESS_STATIONS: [number, number][] = [
  [-21.6, 21.2], [-21.6, 15.8], [-21.6, 10.4], [-16.4, 10.2], [-16.4, 15.8], [-16.4, 21.2], [-11.2, 21.2], [-11.2, 15.8], [-11.2, 10.4],
]
export const AI_AREA: [number, number] = [-25.5, 25]
export const ACTIVITY_SPOTS: Record<'learning' | 'visual' | 'uiux' | 'interactive', { pos: [number, number, number]; yaw: number }> = {
  learning: { pos: [-35, 0.25, 23.1], yaw: Math.PI },
  visual: { pos: [-29.6, 0.25, 31.4], yaw: -2.4 },
  uiux: { pos: [-20.6, 0.25, 30.6], yaw: 0 },
  interactive: { pos: [-17.2, 1.5, 34.7], yaw: Math.PI },
}
/**
 * The Growth Walk: eight stations on the avenue's east sidewalk, from the
 * Education campus toward Naveen Solutions (skipping the mid-block crossing).
 * Boards face walkers coming from the campus.
 */
export const GROWTH_WALK: [number, number][] = [
  [5.95, -43], [5.95, -38.6], [5.95, -34.2], [5.95, -29.8], [5.95, -20.4], [5.95, -16], [5.95, -11.6], [5.95, -7.2],
]
export const GROWTH_YAW = Math.atan2(0.35, -0.94)


const street: InteractiveDef[] = [
  {
    id: 'info', name: 'Information', kicker: 'Start here', type: 'info',
    description: 'Welcome to Mindscape Avenue — Naveen’s world. The story goes: Home → Education → Naveen Solutions (projects inside) → Design Journey → Contact Café. Go in any order.',
    position: [5.2, 0.15, 71.5], interactionRadius: 3.2,
    label: 'Press E to read the map', mobileLabel: 'Map', action: 'OPEN_LOCATION', destination: 'info',
    cameraTarget: { position: [0.5, 3.2, 77.5], target: [5.6, 1.6, 70.4] }, accent: '#2f4a8a',
    highlights: ['WASD to walk · Shift to run', 'Space to jump', 'E to enter & explore'],
  },
  {
    id: 'education', name: 'Education', kicker: 'Campus', type: 'education',
    description: 'Where my design foundations were built.',
    position: [0, 0.15, -56.2], interactionRadius: 3.8,
    label: 'Press E to enter Education', mobileLabel: 'Enter', action: 'ENTER_INTERIOR', destination: 'education',
    cameraTarget: { position: [7, 4.2, -45], target: [0, 5.2, -66] }, accent: '#4f6b58',
  },
  {
    id: 'Naveen', name: 'Naveen Solutions', kicker: 'Explore my workplace', type: 'office',
    description: 'The office where I design every day.',
    position: [14.2, 0.15, 17], interactionRadius: 3.4,
    label: 'Press E to enter Naveen Solutions', mobileLabel: 'Enter', action: 'ENTER_INTERIOR', destination: 'office',
    cameraTarget: { position: [3.5, 3.6, 24], target: [22, 5.5, 17] }, accent: '#2f4a8a',
  },
  {
    id: 'home', name: 'My Home', kicker: 'Visit my profile', type: 'home',
    description: 'A warm little house — about me, my story and how I work.',
    position: [-12.3, 0.15, -25], interactionRadius: 2.8,
    label: 'Press E to enter my Home', mobileLabel: 'Visit', action: 'ENTER_INTERIOR', destination: 'home',
    cameraTarget: { position: [-4.5, 3.2, -19.5], target: [-16.5, 2.8, -25] }, accent: '#b06a4c',
  },
  {
    id: 'cafe', name: 'Contact Café', kicker: 'Let’s talk', type: 'final',
    description: 'A warm little café at the end of the journey.',
    position: [-14, 0.15, 56.4], interactionRadius: 3.0,
    label: 'Press E to enter the Contact Café', mobileLabel: 'Enter', action: 'ENTER_INTERIOR', destination: 'cafe',
    cameraTarget: { position: [-6.5, 3.0, 48.5], target: [-14, 2.4, 60] }, accent: '#8a6448',
  },
  {
    id: 'park-ai', name: 'Human thinking + AI', kicker: 'Design Journey', type: 'park',
    description: AI_STORY.body, content: AI_STORY,
    position: [AI_AREA[0], 0.4, AI_AREA[1]], interactionRadius: 4.3,
    label: 'Press E to explore how I use AI', mobileLabel: 'Explore', action: 'OPEN_LOCATION', destination: 'ai',
    cameraTarget: { position: [-18.5, 4.2, 31.5], target: [-25.5, 1.8, 25] }, accent: '#e8792e',
  },
  ...PROCESS_STATIONS.map<InteractiveDef>(([x, z], i) => {
    const s = DESIGN_PROCESS[i]
    return {
      id: `process-${s.n}`, name: `${s.n} · ${s.title}`, kicker: 'Design process', type: 'story',
      description: s.text, content: { kicker: `Design process · step ${s.n} of 09`, heading: s.title, body: s.text },
      position: [x, 0.25, z], interactionRadius: 1.5,
      label: `Press E · ${s.title}`, mobileLabel: s.title, action: 'OPEN_LOCATION', destination: `process-${s.n}`,
      cameraTarget: { position: [x + 2.8, 2.4, z + 3.2], target: [x, 1.2, z] }, accent: '#6f9a4c', quiet: true,
    }
  }),
  ...(Object.keys(ACTIVITY_SPOTS) as (keyof typeof ACTIVITY_SPOTS)[]).map<InteractiveDef>((k) => {
    const spot = ACTIVITY_SPOTS[k]
    const c = ACTIVITY_STORIES[k]
    return {
      id: `activity-${k}`, name: c.heading, kicker: c.kicker, type: 'story', description: c.body, content: c,
      position: spot.pos, interactionRadius: 1.8,
      label: 'Press E to take a look', mobileLabel: 'Look', action: 'OPEN_LOCATION', destination: `activity-${k}`,
      cameraTarget: { position: [spot.pos[0] + 2.6, spot.pos[1] + 2, spot.pos[2] + 2.6], target: [spot.pos[0], spot.pos[1] + 0.8, spot.pos[2]] },
      accent: '#c98a45', quiet: true,
    }
  }),
  ...GROWTH_WALK.map<InteractiveDef>(([x, z], i) => {
    const st = CAREER_STAGES[i]
    return {
      id: `career-${st.n}`, name: `${st.n} · ${st.title}`, kicker: 'How I grew', type: 'story',
      description: st.line,
      content: { kicker: `Chapter 03 · How I grew · ${st.n} of 0${CAREER_STAGES.length}`, heading: st.title, body: st.line, items: [{ label: 'Details', text: st.detail }] },
      position: [x + 1.4, 0.15, z - 0.4], interactionRadius: 1.7,
      label: `Press E · ${st.title}`, mobileLabel: st.title, action: 'OPEN_LOCATION', destination: `career-${st.n}`,
      cameraTarget: { position: [x + 3.4, 1.9, z - 3.2], target: [x, 1.35, z] }, accent: '#ec7a2c', quiet: true,
    }
  }),
]

/** one screen bay per project in the Project Studio (Naveen Solutions office) */
const studio: InteractiveDef[] = PROJECTS.map((p, i) => {
  const bay = studioBay(i)
  const [sx, sz] = bay.screen
  const [px, pz] = bay.stand
  // close-up: step back from the screen and offset so it frames left of the presentation
  const east = bay.yaw !== 0
  const cam = east
    ? { position: [sx - 3.6, 1.72, sz + 1.25] as [number, number, number], target: [sx, 1.5, sz + 1.35] as [number, number, number] }
    : { position: [sx + 1.25, 1.72, sz + 3.6] as [number, number, number], target: [sx + 1.35, 1.5, sz] as [number, number, number] }
  return {
    id: `studio-${p.id}`, name: p.title, kicker: 'Project Studio', type: 'project' as const,
    description: p.description,
    position: roomToWorld('office', px, pz, 0.02), interactionRadius: 1.9,
    label: `Explore ${p.title}`, mobileLabel: 'Explore', action: 'OPEN_PROJECT' as const, destination: p.id,
    cameraTarget: {
      position: roomToWorld('office', cam.position[0], cam.position[2], cam.position[1]),
      target: roomToWorld('office', cam.target[0], cam.target[2], cam.target[1]),
    },
    accent: p.accent, quiet: true,
  }
})

const STORY_CONTENT: Record<string, StoryContent> = {
  ...Object.fromEntries(Object.entries(EDUCATION_STORIES).map(([k, v]) => [`education:${k}`, v])),
  ...Object.fromEntries(Object.entries(OFFICE_STORIES).map(([k, v]) => [`office:${k}`, v])),
  ...Object.fromEntries(Object.entries(HOME_STORIES).map(([k, v]) => [`home:${k}`, v])),
}

const interior: InteractiveDef[] = [
  ...INTERIOR_STORIES.map<InteractiveDef>((s) => {
    const content = s.kind === 'bell'
      ? { kicker: 'Education', heading: 'Ding!', body: 'Ready for the next chapter? Naveen Solutions is where the learning became real work.' }
      : STORY_CONTENT[`${s.room}:${s.kind}`] ?? { kicker: s.name, heading: s.name, body: '' }
    return {
      id: `${s.room}-${s.kind}`, name: s.name, kicker: content.kicker, type: 'story' as const,
      description: content.body, content,
      position: roomToWorld(s.room, s.x, s.z, 0.02), interactionRadius: s.radius,
      label: s.label, mobileLabel: s.name, action: s.kind === 'bell' ? ('RING_BELL' as const) : s.kind === 'conversation' ? ('CAFE_SIT' as const) : ('OPEN_LOCATION' as const),
      destination: `${s.room}:${s.kind}`,
      cameraTarget: {
        position: roomToWorld(s.room, s.cam.position[0], s.cam.position[2], s.cam.position[1]),
        target: roomToWorld(s.room, s.cam.target[0], s.cam.target[2], s.cam.target[1]),
      },
      accent: s.room === 'office' ? '#2f4a8a' : s.room === 'home' ? '#b06a4c' : '#4f6b58',
      quiet: true,
    }
  }),
  ...(Object.keys(INTERIORS) as InteriorId[]).map<InteractiveDef>((id) => {
    const r = INTERIORS[id]
    return {
      id: `exit-${id}`, name: 'Back outside', kicker: r.name, type: 'exit', description: '',
      position: roomToWorld(id, 0, r.depth / 2 - 0.8, 0.02), interactionRadius: 1.6,
      label: 'Press E to go back outside', mobileLabel: 'Exit', action: 'EXIT_INTERIOR', destination: id,
      cameraTarget: { position: roomToWorld(id, 0, r.depth / 2 - 4, 2.2), target: roomToWorld(id, 0, r.depth / 2, 1.4) },
      accent: '#3b3e44',
    }
  }),
]

export const LOCATIONS: InteractiveDef[] = [...street, ...interior, ...studio]

export function getLocation(id: string | null) {
  return LOCATIONS.find((l) => l.id === id) ?? null
}

/** Areas that trigger a brief, subtle reveal the first time the player enters them. */
export interface ZoneDef {
  id: string
  name: string
  subtitle: string
  center: [number, number]
  radius: number
  /** point of interest the camera briefly biases toward */
  reveal: [number, number, number]
}

export const ZONES: ZoneDef[] = [
  { id: 'start', name: 'Start', subtitle: 'Welcome to my world', center: [0, 68], radius: 7, reveal: [0, 3, 60] },
  { id: 'campus', name: 'Education Campus', subtitle: 'Chapter 02 · Where I started', center: [0, -49], radius: 8, reveal: [0, 7, -66] },
  { id: 'Naveen', name: 'Naveen Solutions', subtitle: 'Chapter 04 · Where I work', center: [8, 17], radius: 6.5, reveal: [23, 7, 17] },
  { id: 'home', name: 'My Home', subtitle: 'Chapter 01 · Who I am', center: [-7, -25], radius: 5, reveal: [-16, 3.5, -25] },
  { id: 'park', name: 'Design Journey', subtitle: 'Chapter 06 · How I think', center: [-16, 16], radius: 8, reveal: [-16, 1.5, 15.5] },
  { id: 'growth', name: 'The Growth Walk', subtitle: 'Chapter 03 · How I grew', center: [6.6, -41], radius: 3.6, reveal: [6, 1.8, -30] },
  { id: 'cafe', name: 'Contact Café', subtitle: 'Chapter 09 · Let’s talk', center: [-14, 53], radius: 4.5, reveal: [-14, 3, 60] },
  { id: 'plaza', name: 'Fountain Plaza', subtitle: 'A place to pause', center: [19, -25], radius: 11, reveal: [19, 3, -25] },
]
