import { INTERIORS, inStudio } from '@/data/interiors'
import { ZONES } from '@/data/locations'
import { useGameStore } from '@/stores/gameStore'
import { usePlayerStore } from '@/stores/playerStore'

/** "Where am I?" — a short, human label for the player's current surroundings. */
export function useCurrentPlace(): { name: string; sub: string } {
  const interior = useGameStore((s) => s.interior)
  const mode = useGameStore((s) => s.mode)
  const x = usePlayerStore((s) => s.x)
  const z = usePlayerStore((s) => s.z)
  if (mode === 'projects') return { name: 'Project overview', sub: 'All projects' }
  if (interior === 'office' && inStudio(x, z)) return { name: 'Project Studio', sub: 'NFC Solutions' }
  if (interior) return { name: INTERIORS[interior].name, sub: INTERIORS[interior].subtitle }
  for (const zn of ZONES) if (Math.hypot(x - zn.center[0], z - zn.center[1]) < zn.radius * 1.5) return { name: zn.name, sub: zn.subtitle }
  return { name: 'Mindscape Avenue', sub: 'The neighbourhood' }
}
