import { soundManager } from '@/core/sound/SoundManager'
import { type DayNightMode, useDayNight } from '@/core/dayNight'

const LABEL: Record<DayNightMode, string> = {
  auto: 'Auto — follows your local time',
  day: 'Day',
  sunset: 'Sunset',
  night: 'Night',
}

/** Small icon button: Auto → Day → Sunset → Night. */
export function DayNightToggle() {
  const mode = useDayNight((s) => s.mode)
  const cycle = useDayNight((s) => s.cycleMode)
  const next: DayNightMode = mode === 'auto' ? 'day' : mode === 'day' ? 'sunset' : mode === 'sunset' ? 'night' : 'auto'
  return (
    <button
      className={`ui-icon-btn ui-daynight is-${mode}`}
      onClick={() => {
        soundManager.unlock()
        soundManager.play('click')
        cycle()
      }}
      aria-label={`Time of day: ${LABEL[mode]}. Switch to ${LABEL[next]}`}
      title={`Time of day: ${LABEL[mode]}`}
    >
      <svg viewBox="0 0 24 24" aria-hidden="true">
        {mode === 'day' && (
          <>
            <circle cx="12" cy="12" r="4" />
            <path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M5.6 18.4 7 17M17 7l1.4-1.4" />
          </>
        )}
        {mode === 'sunset' && (
          <>
            <path d="M7 16a5 5 0 0 1 10 0" />
            <path d="M3 16h18M5 20h14M12 5v3M5.5 8.5l1.6 1.6M18.5 8.5l-1.6 1.6" />
          </>
        )}
        {mode === 'night' && <path d="M19.5 14.5A7.5 7.5 0 0 1 9.5 4.5a7.5 7.5 0 1 0 10 10Z" />}
        {mode === 'auto' && (
          <>
            <circle cx="12" cy="12" r="7.5" />
            <path d="M12 4.5a7.5 7.5 0 0 1 0 15Z" className="ui-daynight__fill" />
          </>
        )}
      </svg>
    </button>
  )
}
