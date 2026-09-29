import { useEffect, useRef } from 'react'
import { companionBubble } from '@/components/effects/AICompanion'

/** Speech bubble for the AI companion; positioned every frame by the canvas. */
export function CompanionBubble() {
  const anchor = useRef<HTMLDivElement>(null)
  const bubble = useRef<HTMLDivElement>(null)
  useEffect(() => {
    companionBubble.anchor = anchor.current
    companionBubble.bubble = bubble.current
    return () => {
      companionBubble.anchor = null
      companionBubble.bubble = null
    }
  }, [])
  return (
    <div ref={anchor} className="ui-bubble-anchor" aria-live="polite">
      <div ref={bubble} className="ui-bubble" />
    </div>
  )
}
