import { useEffect, useRef } from 'react'
import { promptElement, triggerNearby } from '@/components/interactions/InteractionManager'
import { getLocation } from '@/data/locations'
import { controlsEnabled, useGameStore } from '@/stores/gameStore'
import { useUIStore } from '@/stores/uiStore'
import { KeyCap } from './KeyCap'

/**
 * Contextual prompt that floats above the player's head. Its screen position
 * is written directly by the canvas each frame (no React re-render).
 */
export function InteractionPrompt() {
  const ref = useRef<HTMLDivElement>(null)
  const nearbyId = useGameStore((s) => s.nearbyId)
  const enabled = useGameStore((s) => controlsEnabled(s))
  const isTouch = useUIStore((s) => s.isTouch)
  useEffect(() => {
    promptElement.current = ref.current
    return () => {
      promptElement.current = null
    }
  }, [])
  const loc = getLocation(nearbyId)
  const visible = !!loc && enabled
  return (
    <div ref={ref} className="ui-prompt-anchor">
      <div className={`ui-prompt ${visible ? 'is-visible' : ''}`} key={loc?.id ?? 'none'} style={{ ['--accent' as string]: loc?.accent ?? '#2f3fb8' }}>
        {loc && (
          <>
            <span className="ui-prompt__name">{loc.name}</span>
            {isTouch ? (
              <button className="ui-prompt__action ui-prompt__action--touch" onClick={() => triggerNearby()} onPointerDown={(e) => e.stopPropagation()}>
                {loc.mobileLabel}
              </button>
            ) : (
              <button className="ui-prompt__action" onClick={() => triggerNearby()} tabIndex={-1} aria-label={loc.label}>
                {/* "Press E to explore" → PRESS [E] TO EXPLORE */}
                {loc.label.split(/\b(E)\b/).map((part, i) => (part === 'E' ? <KeyCap key={i} k="E" /> : <span key={i}>{part.trim()}</span>))}
              </button>
            )}
          </>
        )}
      </div>
    </div>
  )
}
