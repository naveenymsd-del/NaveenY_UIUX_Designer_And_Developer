import { soundManager } from '@/core/sound/SoundManager'
import { useUIStore } from '@/stores/uiStore'

/** Sound on/off. The preference persists in localStorage. */
export function SoundButton() {
  const on = useUIStore((s) => s.soundEnabled)
  const set = useUIStore((s) => s.setSoundEnabled)
  return (
    <button
      className={`ui-icon-btn ui-sound ${on ? 'is-on' : ''}`}
      aria-label={on ? 'Mute sound' : 'Turn sound on'}
      aria-pressed={on}
      title={on ? 'Sound on' : 'Sound off'}
      onClick={() => {
        soundManager.unlock()
        set(!on)
        if (!on) setTimeout(() => soundManager.play('click'), 60)
      }}
    >
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path className="ui-sound__cone" d="M4 9.5h3.2L12 5.5v13l-4.8-4H4z" />
        {on ? (
          <>
            <path className="ui-sound__wave ui-sound__wave--1" d="M15.2 9.2a4 4 0 0 1 0 5.6" />
            <path className="ui-sound__wave ui-sound__wave--2" d="M17.8 6.8a7.5 7.5 0 0 1 0 10.4" />
          </>
        ) : (
          <path d="M16 9.5l5 5m0-5-5 5" />
        )}
      </svg>
    </button>
  )
}
