import { playerRuntime } from '@/core/runtime'
import { INTERIOR_PEOPLE, inStudio, roomToWorld } from '@/data/interiors'
import { useGameStore } from '@/stores/gameStore'
import { caseView } from './events'
import type { LocationKey } from './knowledge'
import { currentStopId, tour } from './tour'
import type { WorldContext } from './types'
import { useVoiceStore } from './voiceStore'
import { walker } from './autoWalk'

/** street areas around each place (world x, z, radius) */
const AREAS: { key: LocationKey; x: number; z: number; r: number }[] = [
  { key: 'start', x: 0, z: 70, r: 12 },
  { key: 'home', x: -9, z: -25, r: 6 },
  { key: 'education', x: 0, z: -54, r: 8 },
  { key: 'office', x: 11, z: 17, r: 6 },
  { key: 'contact', x: -14, z: 55, r: 6 },
  { key: 'plaza', x: 19, z: -25, r: 11 },
]

/** where the visitor is, read from the game state and player position (cheap; called per utterance) */
export function currentLocation(): LocationKey {
  const g = useGameStore.getState()
  const p = playerRuntime.position
  if (g.interior === 'home') return 'home'
  if (g.interior === 'education') return 'education'
  if (g.interior === 'cafe') return 'contact'
  if (g.interior === 'office') {
    if (g.activeProjectId) return `project:${g.activeProjectId}`
    return inStudio(p.x, p.z) ? 'projects' : 'office'
  }
  if (p.x > -43 && p.x < -8 && p.z > 7 && p.z < 43) return 'gallery'
  for (const a of AREAS) if (Math.hypot(p.x - a.x, p.z - a.z) < a.r) return a.key
  return 'street'
}

/** the named colleague the visitor is standing next to, if any ("who is this?") */
export function nearbyPerson(): string | null {
  const g = useGameStore.getState()
  if (g.interior !== 'office') return null
  const p = playerRuntime.position
  let best: string | null = null
  let bd = 3.2
  for (const person of INTERIOR_PEOPLE) {
    if (person.room !== 'office' || !person.name) continue
    const [x, , z] = roomToWorld('office', person.x, person.z)
    const d = Math.hypot(p.x - x, p.z - z)
    if (d < bd) {
      bd = d
      best = person.name
    }
  }
  return best
}

export function worldContext(): WorldContext {
  const g = useGameStore.getState()
  return {
    location: currentLocation(),
    openProject: g.activeProjectId,
    navigating: walker.active,
    destination: walker.destination,
    section: g.activeProjectId ? caseView.section : null,
    tour: { status: tour.status, kind: tour.kind, stop: currentStopId(), waiting: tour.waiting },
    nearbyPerson: nearbyPerson(),
    voice: useVoiceStore.getState().tier,
    hour: new Date().getHours(),
  }
}
