import { navigate } from '@/app/routes'
import { soundManager } from '@/core/sound/SoundManager'
import { useGameStore } from '@/stores/gameStore'
import { useUIStore } from '@/stores/uiStore'
import { KeyCap } from './KeyCap'

/**
 * The establishing moment: the city slowly orbits below while the title and
 * controls are introduced. Starting flies the camera down behind the player.
 */
export function IntroOverlay() {
  const phase = useGameStore((s) => s.phase)
  const setPhase = useGameStore((s) => s.setPhase)
  const isTouch = useUIStore((s) => s.isTouch)
  if (phase !== 'intro' && phase !== 'transition') return null
  const start = (mode: 'street' | 'projects') => {
    soundManager.unlock()
    soundManager.play('open')
    navigate(mode === 'projects' ? '/projects' : '/street', true)
    setPhase('transition')
  }
  return (
    <div className={`ui-intro ${phase === 'transition' ? 'is-leaving' : ''}`}>
      <div className="ui-intro__center">
        <p className="ui-intro__eyebrow">Naveen · UI/UX Designer · Interactive portfolio</p>
        <h1 className="ui-intro__title">
          <span>Mindscape</span>
          <span className="ui-intro__title-street">AVENUE</span>
        </h1>
        <p className="ui-intro__subtitle">Where ideas take a walk…</p>
        <div className="ui-intro__actions">
          <button className="ui-btn ui-btn--primary ui-btn--lg" onClick={() => start('street')} autoFocus>
            Start exploring
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h13m-5-6 6 6-6 6" /></svg>
          </button>
          <button className="ui-btn ui-btn--glass ui-btn--lg" onClick={() => start('projects')}>
            View projects
          </button>
        </div>
      </div>
      <div className="ui-intro__hints" aria-label="Controls">
        {isTouch ? (
          <>
            <div className="ui-intro__hint"><span className="ui-stick-icon" aria-hidden="true" /> Drag the joystick to walk</div>
            <div className="ui-intro__hint"><span className="ui-jump-icon" aria-hidden="true">↑</span> Tap to jump · drag the view to look</div>
          </>
        ) : (
          <>
            <div className="ui-intro__hint">
              <span className="ui-wasd" aria-hidden="true">
                <KeyCap k="W" /><span><KeyCap k="A" /><KeyCap k="S" /><KeyCap k="D" /></span>
              </span>
              Control the character with the WASD keys
            </div>
            <div className="ui-intro__hint"><KeyCap k="SPACE" wide /> Press the space bar to jump</div>
          </>
        )}
      </div>
    </div>
  )
}
