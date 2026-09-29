import { useEffect, useRef, useState } from 'react'
import { navigate } from '@/app/routes'
import { soundManager } from '@/core/sound/SoundManager'
import { getLocation, type InteractiveDef } from '@/data/locations'
import { useGameStore } from '@/stores/gameStore'

const EXTRA: Record<string, { title: string; items: string[] }> = {
  cafe: { title: 'On the counter today', items: ['Cardamom bun', 'Oat flat white', 'Rose & pistachio cake', 'Iced hibiscus tea'] },
  store: { title: 'Aisle favourites', items: ['UI kit starter pack', 'Brush & texture set', 'Type pairing cards', 'Colour palette swatches'] },
  gallery: { title: 'In the current show', items: ['Chromatic Studies I–III', 'Soft Geometry (motion)', 'Generative Prints wall'] },
  studio: { title: 'On the pin board', items: ['Research walls', 'Paper prototypes', 'Motion tests', 'Design system audits'] },
  experience: { title: 'Now showing', items: ['Echo Street — interactive 3D', 'Spatial audio sketches', 'WebGL shader garden'] },
  info: { title: 'Good to know', items: ['Café, gallery & store are open', 'Five pavilions in Project Plaza', 'The bus stops by Juniper Park'] },
}

/** Glass side panel for a location; appears after the camera has begun its move. */
export function LocationPanel() {
  const id = useGameStore((s) => s.activeLocationId)
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
      }, 520)
      return () => clearTimeout(t)
    }
    setVisible(false)
    const t = setTimeout(() => setShown(null), 500)
    return () => clearTimeout(t)
  }, [id])

  if (!shown) return null
  const extra = EXTRA[shown.id]
  const onClose = () => {
    soundManager.play('close')
    close()
  }
  return (
    <aside className={`ui-panel ${visible ? 'is-visible' : ''}`} role="dialog" aria-modal="false" aria-labelledby="loc-title" style={{ ['--accent' as string]: shown.accent }}>
      <div className="ui-panel__head">
        <p className="ui-kicker">{shown.kicker}</p>
        <button ref={closeRef} className="ui-panel__close" onClick={onClose} aria-label="Close and return to the street">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" /></svg>
        </button>
      </div>
      <h2 id="loc-title" className="ui-panel__title">{shown.name}</h2>
      {shown.hours && <p className="ui-panel__hours"><span className="ui-dot" /> {shown.hours}</p>}
      <p className="ui-panel__desc">{shown.description}</p>
      {shown.highlights && (
        <ul className="ui-chips">
          {shown.highlights.map((h) => <li key={h}>{h}</li>)}
        </ul>
      )}
      {extra && (
        <div className="ui-panel__extra">
          <p className="ui-panel__extra-title">{extra.title}</p>
          <ul>
            {extra.items.map((i, k) => <li key={i}><span>0{k + 1}</span>{i}</li>)}
          </ul>
        </div>
      )}
      <div className="ui-panel__actions">
        {(shown.id === 'studio' || shown.id === 'experience') && (
          <button className="ui-btn ui-btn--primary" onClick={() => { soundManager.play('click'); close(); navigate('/projects') }}>
            View projects
          </button>
        )}
        <button className="ui-btn ui-btn--glass" onClick={onClose}>Close</button>
      </div>
    </aside>
  )
}
