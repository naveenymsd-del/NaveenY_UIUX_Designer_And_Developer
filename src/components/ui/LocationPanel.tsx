import { useEffect, useRef, useState } from 'react'
import { goToProjects } from '@/core/journey'
import { navigateToLocation } from '@/core/navigation'
import { soundManager } from '@/core/sound/SoundManager'
import { getLocation, type InteractiveDef } from '@/data/locations'
import { useGameStore } from '@/stores/gameStore'
import { useUIStore } from '@/stores/uiStore'
import { Rich } from './Rich'

/**
 * Compact glass card for a place or story object. It appears after the camera
 * has begun moving to the object's close-up, so the world stays the hero.
 */
export function LocationPanel() {
  // the café conversation has its own panel (CafeConversation)
  const id = useGameStore((s) => (s.activeLocationId === 'cafe-conversation' ? null : s.activeLocationId))
  const close = useGameStore((s) => s.closePanels)
  const [shown, setShown] = useState<InteractiveDef | null>(null)
  const [visible, setVisible] = useState(false)
  const closeRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (id) {
      setShown(getLocation(id))
      const t = setTimeout(() => {
        setVisible(true)
        closeRef.current?.focus({ preventScroll: true })
      }, 480)
      return () => clearTimeout(t)
    }
    setVisible(false)
    const t = setTimeout(() => setShown(null), 500)
    return () => clearTimeout(t)
  }, [id])

  if (!shown) return null
  const c = shown.content
  const heading = c?.heading ?? shown.name
  const kicker = c?.kicker ?? shown.kicker
  const body = c?.body ?? shown.description
  const onClose = () => {
    soundManager.play('close')
    close()
  }
  const cta = () => {
    if (!c?.cta) return
    soundManager.play('click')
    close()
    if (c.cta.action === 'projects') goToProjects()
    else if (c.cta.action === 'gallery') navigateToLocation('gallery')
    else {
      useUIStore.getState().setMenuSection('contact')
      useUIStore.getState().setMenuOpen(true)
    }
  }
  return (
    <aside className={`ui-panel ui-panel--story ${visible ? 'is-visible' : ''}`} role="dialog" aria-modal="false" aria-labelledby="loc-title" style={{ ['--accent' as string]: shown.accent }}>
      <div className="ui-panel__head">
        <p className="ui-kicker">{kicker}</p>
        <button ref={closeRef} className="ui-panel__close" onClick={onClose} aria-label="Close and keep exploring">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" /></svg>
        </button>
      </div>
      <h2 id="loc-title" className="ui-panel__title">{heading}</h2>
      {body && <p className="ui-panel__desc"><Rich text={body} /></p>}
      {c?.items && c.items.length > 0 && (
        <ul className="ui-story-list">
          {c.items.map((it, i) => (
            <li key={i} style={{ animationDelay: `${120 + i * 70}ms` }}>
              <span className="ui-story-list__label">{it.label}</span>
              <span className="ui-story-list__text"><Rich text={it.text} /></span>
            </li>
          ))}
        </ul>
      )}
      {!c && shown.highlights && (
        <ul className="ui-chips">
          {shown.highlights.map((h) => <li key={h}>{h}</li>)}
        </ul>
      )}
      <div className="ui-panel__actions">
        {c?.cta && <button className="ui-btn ui-btn--primary" onClick={cta}>{c.cta.label}</button>}
        <button className="ui-btn ui-btn--glass" onClick={onClose}>Keep exploring</button>
      </div>
    </aside>
  )
}
