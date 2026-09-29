import { controlsEnabled, useGameStore } from '@/stores/gameStore'
import { useUIStore } from '@/stores/uiStore'
import { KeyCap } from './KeyCap'

/** Compact desktop controls reference (bottom-left). */
export function ControlsHint() {
  const isTouch = useUIStore((s) => s.isTouch)
  const enabled = useGameStore((s) => controlsEnabled(s))
  if (isTouch) return null
  return (
    <div className={`ui-hint ${enabled ? 'is-visible' : ''}`} aria-hidden={!enabled}>
      <span className="ui-hint__group"><KeyCap k="W" /><KeyCap k="A" /><KeyCap k="S" /><KeyCap k="D" /> Move</span>
      <span className="ui-hint__group"><KeyCap k="Shift" wide /> Run</span>
      <span className="ui-hint__group"><KeyCap k="Space" wide /> Jump</span>
      <span className="ui-hint__group"><span className="ui-mouse" aria-hidden="true" /> Drag to look</span>
      <span className="ui-hint__group"><KeyCap k="E" accent /> Interact</span>
    </div>
  )
}
