import { PROJECTS } from './projects'

export type InteractionAction = 'OPEN_LOCATION' | 'OPEN_PROJECT'

export interface CameraShot {
  position: [number, number, number]
  target: [number, number, number]
}

/**
 * Every interactive point in the world is described here. Adding a new
 * location only requires a new entry: the interaction manager, beacons,
 * prompt, minimap and panels all read from this list.
 */
export interface InteractiveDef {
  id: string
  name: string
  kicker: string
  description: string
  /** anchor on the ground where the beacon sits */
  position: [number, number, number]
  interactionRadius: number
  label: string
  mobileLabel: string
  action: InteractionAction
  /** project id for OPEN_PROJECT, content key for OPEN_LOCATION */
  destination: string
  cameraTarget: CameraShot
  accent: string
  highlights?: string[]
  hours?: string
  mapLabel?: string
}

export const LOCATIONS: InteractiveDef[] = [
  {
    id: 'info', name: 'Information Center', kicker: 'Start here', mapLabel: 'INFO',
    description:
      'Welcome to Mindscape Avenue — a small neighbourhood you can walk. Visit the café, the gallery, the studio and the plaza of projects. Everything here is explorable.',
    position: [5.2, 0.15, 71.5], interactionRadius: 3.2,
    label: 'Press E to explore', mobileLabel: 'Explore',
    action: 'OPEN_LOCATION', destination: 'info',
    cameraTarget: { position: [0.5, 3.2, 77.5], target: [5.6, 1.6, 70.4] },
    accent: '#2f3fb8',
    highlights: ['Walk with WASD, run with Shift', 'Space to jump', 'Look around by dragging'],
  },
  {
    id: 'cafe', name: 'Lumen Café', kicker: 'Coffee & conversation', mapLabel: 'CAFÉ',
    description:
      'A sunny corner café with a terrace on the avenue. This is where ideas start: slow mornings, sketchbooks and the best cardamom bun in town.',
    position: [10.4, 0.15, 17], interactionRadius: 3.6,
    label: 'Press E to explore', mobileLabel: 'Explore',
    action: 'OPEN_LOCATION', destination: 'cafe',
    cameraTarget: { position: [2.2, 4.4, 26], target: [17, 2.4, 16] },
    accent: '#ef8a78', hours: 'Open 7:00 – 19:00',
    highlights: ['Terrace seating', 'Weekly design breakfast', 'Sketchbook swap shelf'],
  },
  {
    id: 'store', name: 'Daily Goods', kicker: 'Neighbourhood store', mapLabel: 'STORE',
    description:
      'The corner store stocks everything: tools, templates, brushes and the little things that make projects easier. Browse the shelves through the window.',
    position: [-7.8, 0.15, -25], interactionRadius: 3.6,
    label: 'Press E to explore', mobileLabel: 'Explore',
    action: 'OPEN_LOCATION', destination: 'store',
    cameraTarget: { position: [-0.5, 3.4, -18], target: [-14.5, 2.1, -25] },
    accent: '#4fb3a9', hours: 'Open 24 hours',
    highlights: ['Design resources', 'Free starter kits', 'Seasonal specials'],
  },
  {
    id: 'studio', name: 'Project Studio', kicker: 'Where the work happens', mapLabel: 'STUDIO',
    description:
      'A glass-front studio facing the plaza. Process boards, prototypes on the bench and a wall of pinned research. The pavilions outside hold finished projects.',
    position: [28.2, 0.15, -25], interactionRadius: 3.8,
    label: 'Press E to explore', mobileLabel: 'Explore',
    action: 'OPEN_LOCATION', destination: 'studio',
    cameraTarget: { position: [17.5, 5.2, -17], target: [36, 3.6, -25.5] },
    accent: '#a996d4',
    highlights: ['Open studio Fridays', 'Process archive', 'Prototype bench'],
  },
  {
    id: 'gallery', name: 'Reverie Gallery', kicker: 'Exhibitions', mapLabel: 'GALLERY',
    description:
      'A bright white gallery for visual work: illustration, motion studies and generative pieces. The current show explores colour as a way of thinking.',
    position: [-30, 0.15, -56.6], interactionRadius: 4,
    label: 'Press E to explore', mobileLabel: 'Explore',
    action: 'OPEN_LOCATION', destination: 'gallery',
    cameraTarget: { position: [-21.5, 4.6, -45], target: [-30, 4.4, -64] },
    accent: '#e0506a',
    highlights: ['Current show: “Colour as Thought”', 'Generative print wall', 'Artist talks'],
  },
  {
    id: 'experience', name: 'Experience Center', kicker: 'The landmark', mapLabel: 'EXPERIENCE',
    description:
      'At the top of the avenue, the Experience Center hosts immersive work: 3D, sound and interaction. Its tower screen is always showing something new.',
    position: [0, 0.15, -56.2], interactionRadius: 4.5,
    label: 'Press E to explore', mobileLabel: 'Explore',
    action: 'OPEN_LOCATION', destination: 'experience',
    cameraTarget: { position: [9, 5.5, -41], target: [0, 6.5, -66] },
    accent: '#2f3fb8',
    highlights: ['Immersive room', 'Spatial audio lab', 'Rooftop screen'],
  },
  ...PROJECTS.map<InteractiveDef>((p) => ({
    id: `project-${p.id}`,
    name: `Project ${p.number}`,
    kicker: p.category,
    description: p.description,
    position: [
      p.position[0] + Math.sin(p.yaw) * 2.4,
      0.15,
      p.position[2] + Math.cos(p.yaw) * 2.4,
    ],
    interactionRadius: 2.2,
    label: 'Press E to view project',
    mobileLabel: 'View project',
    action: 'OPEN_PROJECT',
    destination: p.id,
    cameraTarget: p.camera,
    accent: p.accent,
  })),
]

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
  { id: 'plaza', name: 'Project Plaza', subtitle: 'Five pavilions, five stories', center: [19, -25], radius: 11, reveal: [19, 3, -25] },
  { id: 'park', name: 'Juniper Park', subtitle: 'Take a breath', center: [-25, 25], radius: 13, reveal: [-25, 2, 25] },
  { id: 'north', name: 'Experience Row', subtitle: 'The top of the avenue', center: [0, -46], radius: 8, reveal: [0, 9, -66] },
  { id: 'cafe-corner', name: 'Café Corner', subtitle: 'Terrace is open', center: [8, 17], radius: 7, reveal: [18, 2, 17] },
]
