import { navigate } from '@/app/routes'
import { soundManager } from '@/core/sound/SoundManager'
import { useGameStore } from '@/stores/gameStore'
import { MenuButton } from './MenuButton'
import { SoundButton } from './SoundButton'

/** Floating HUD header: brand (left), mode switch (centre), sound + menu (right). */
export function TopNavigation() {
  const phase = useGameStore((s) => s.phase)
  const mode = useGameStore((s) => s.mode)
  const panelOpen = useGameStore((s) => !!s.activeLocationId || !!s.activeProjectId)
  const closePanels = useGameStore((s) => s.closePanels)
  const visible = phase === 'playing' || phase === 'transition'

  const go = (m: 'street' | 'projects') => {
    if (m === mode) return
    soundManager.play('click')
    navigate(m === 'projects' ? '/projects' : '/street')
  }
  const back = () => {
    soundManager.play('close')
    if (panelOpen) closePanels()
    else navigate('/street')
  }
  const showBack = phase === 'playing' && (panelOpen || mode === 'projects')

  return (
    <header className={`ui-top ${visible ? 'is-visible' : ''}`}>
      <div className="ui-top__left">
        <a className="ui-brand" href="/street" onClick={(e) => { e.preventDefault(); navigate('/street'); closePanels() }} aria-label="Mindscape Avenue — home">
          <span className="ui-brand__word">Mindscape</span>
          <span className="ui-brand__tag">AVENUE</span>
        </a>
        <button className={`ui-btn ui-btn--glass ui-back ${showBack ? 'is-visible' : ''}`} onClick={back} tabIndex={showBack ? 0 : -1} aria-hidden={!showBack}>
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7" /></svg>
          Back
        </button>
      </div>
      <nav className="ui-mode" aria-label="Experience mode">
        <span className={`ui-mode__thumb ${mode === 'projects' ? 'is-right' : ''}`} aria-hidden="true" />
        <button className={mode === 'street' ? 'is-active' : ''} aria-pressed={mode === 'street'} onClick={() => go('street')}>
          Street
        </button>
        <button className={mode === 'projects' ? 'is-active' : ''} aria-pressed={mode === 'projects'} onClick={() => go('projects')}>
          View Projects
        </button>
      </nav>
      <div className="ui-top__right">
        <SoundButton />
        <MenuButton />
      </div>
    </header>
  )
}
