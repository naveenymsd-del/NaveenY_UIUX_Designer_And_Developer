import { INTERIORS, inStudio, type InteriorId } from '@/data/interiors'
import { ZONES } from '@/data/locations'
import { useGameStore } from '@/stores/gameStore'
import { usePlayerStore } from '@/stores/playerStore'

function placeKey(interior: InteriorId | null, mode: string, x: number, z: number) {
  if (mode === 'projects') return 'Project overview|All projects'
  if (interior === 'office' && inStudio(x, z)) return 'Project Studio|Chapter 04 · What I’ve designed'
  if (interior) return `${INTERIORS[interior].name}|${INTERIORS[interior].subtitle}`
  for (const zn of ZONES) if (Math.hypot(x - zn.center[0], z - zn.center[1]) < zn.radius * 1.5) return `${zn.name}|${zn.subtitle}`
  return 'Mindscape Avenue|The neighbourhood'
}

/**
 * "Where am I?" — a short, human label for the player's surroundings. The
 * selector returns a string, so components re-render only when the place
 * changes (not on every position update).
 */
export function useCurrentPlace(): { name: string; sub: string } {
  const interior = useGameStore((s) => s.interior)
  const mode = useGameStore((s) => s.mode)
  const key = usePlayerStore((s) => placeKey(interior, mode, s.x, s.z))
  const [name, sub] = key.split('|')
  return { name, sub }
}
