import { useEffect, useRef } from 'react'

/** DOM hooks the NPC loop writes into (no React re-renders per frame). */
export const nameTag: { anchor: HTMLElement | null; card: HTMLElement | null; name: HTMLElement | null; role: HTMLElement | null } = {
  anchor: null, card: null, name: null, role: null,
}

/**
 * Proximity name card for colleagues: fades in above the person you walk up
 * to and fades out as you move away. Never shown permanently.
 */
export function NameTag() {
  const anchor = useRef<HTMLDivElement>(null)
  const card = useRef<HTMLDivElement>(null)
  const name = useRef<HTMLElement>(null)
  const role = useRef<HTMLElement>(null)
  useEffect(() => {
    nameTag.anchor = anchor.current
    nameTag.card = card.current
    nameTag.name = name.current
    nameTag.role = role.current
    return () => {
      nameTag.anchor = nameTag.card = nameTag.name = nameTag.role = null
    }
  }, [])
  return (
    <div ref={anchor} className="ui-nametag-anchor" aria-live="polite">
      <div ref={card} className="ui-nametag">
        <i aria-hidden="true" />
        <b ref={name} />
        <small ref={role} />
      </div>
    </div>
  )
}
