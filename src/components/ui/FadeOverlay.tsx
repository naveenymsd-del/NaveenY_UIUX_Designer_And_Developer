import { useGameStore } from '@/stores/gameStore'

/** Soft warm fade used when stepping into or out of a building. */
export function FadeOverlay() {
  const fade = useGameStore((s) => s.fade)
  return <div className={`ui-fade ${fade ? 'is-on' : ''}`} aria-hidden="true" />
}
