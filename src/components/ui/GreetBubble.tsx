import { useEffect, useRef } from 'react'

/** DOM hooks for the passing-greeting bubble (positioned by the NPC loop, no React re-renders). */
export const greetBubble: { anchor: HTMLElement | null; card: HTMLElement | null } = { anchor: null, card: null }

export function GreetBubble() {
  const anchor = useRef<HTMLDivElement>(null)
  const card = useRef<HTMLDivElement>(null)
  useEffect(() => {
    greetBubble.anchor = anchor.current
    greetBubble.card = card.current
    return () => {
      greetBubble.anchor = greetBubble.card = null
    }
  }, [])
  return (
    <div ref={anchor} className="ui-greet-anchor" aria-live="polite">
      <div ref={card} className="ui-greet" />
    </div>
  )
}
