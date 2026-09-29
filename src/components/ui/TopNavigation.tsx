import { navigate } from '@/app/routes'
import { BASE } from '@/utils/basePath'
import { exitInterior } from '@/core/interiors'
import { soundManager } from '@/core/sound/SoundManager'
import { useCurrentPlace } from '@/hooks/useCurrentPlace'
import { useGameStore } from '@/stores/gameStore'
import { MenuButton } from './MenuButton'
import { SoundButton } from './SoundButton'
import { WorldStatus } from './WorldStatus'

/**
 * Floating HUD header. Left: name + where you are. Right: local time, visitor
 * info, sound and menu. A single contextual Back button makes sure you can
 * always get out of whatever you're in (a panel, a room, the overview).
 */
export function TopNavigation() {
  const phase = useGameStore((s) => s.phase)
  const mode = useGameStore((s) => s.mode)
  const interior = useGameStore((s) => s.interior)
  const busy = useGameStore((s) => s.fade || !!s.establishing)
  const panelOpen = useGameStore((s) => !!s.activeLocationId || !!s.activeProjectId)
  const closePanels = useGameStore((s) => s.closePanels)
  const place = useCurrentPlace()
  const visible = phase === 'playing' || phase === 'transition'

  const back = () => {
    soundManager.play('close')
    if (panelOpen) closePanels()
    else if (mode === 'projects') navigate('/street')
    else if (interior) void exitInterior(interior)
  }
  const showBack = phase === 'playing' && !busy && (panelOpen || mode === 'projects' || !!interior)
  const backLabel = panelOpen ? 'Back' : mode === 'projects' ? 'Back to street' : 'Back outside'

  return (
    <header className={`ui-top ${visible ? 'is-visible' : ''}`}>
      <div className="ui-top__left">
        <a className="ui-brand" href={`${BASE}street`} onClick={(e) => { e.preventDefault(); closePanels(); navigate('/street') }} aria-label="Naveen — interactive portfolio">
          <span className="ui-brand__word">Naveen</span>
        </a>
        <p className="ui-where" aria-live="polite">
          <b key={place.name}>{place.name}</b>
          <span>{place.sub}</span>
        </p>
        <button className={`ui-btn ui-btn--glass ui-back ${showBack ? 'is-visible' : ''}`} onClick={back} tabIndex={showBack ? 0 : -1} aria-hidden={!showBack}>
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7" /></svg>
          {backLabel}
        </button>
      </div>
      <div className="ui-top__right">
        <WorldStatus />
        <SoundButton />
        <MenuButton />
      </div>
    </header>
  )
}
