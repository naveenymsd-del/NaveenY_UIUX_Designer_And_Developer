import { navigateToLocation } from '@/core/navigation'
import { walkTo } from '@/ai/guide'
import { useVoiceStore } from '@/ai/voiceStore'
import { soundManager } from '@/core/sound/SoundManager'
import { useGameStore } from '@/stores/gameStore'
import { STORY_STOPS as STORY } from '@/data/world'

/**
 * The recommended story path, always one glance away: which chapter comes
 * next, and a button that takes you there. Exploring freely still works —
 * the chip simply skips whatever you've already discovered.
 */
export function JourneyChip() {
  const phase = useGameStore((s) => s.phase)
  const discovered = useGameStore((s) => s.discovered)
  const busy = useGameStore((s) => !!s.activeLocationId || !!s.activeProjectId || s.fade || !!s.establishing || !!s.travel)
  const next = STORY.find((s) => !discovered.includes(s.place!))
  const done = STORY.filter((s) => discovered.includes(s.place!)).length
  const step = next ? STORY.indexOf(next) + 1 : STORY.length
  const visible = phase === 'playing' && !busy
  return (
    <div className={`ui-journey-chip ${visible ? 'is-visible' : ''}`} aria-hidden={!visible}>
      <ol className="ui-journey-chip__dots" aria-label={`Story progress: ${done} of ${STORY.length}`}>
        {STORY.map((s) => <li key={s.id} className={discovered.includes(s.place!) ? 'is-done' : s === next ? 'is-next' : ''} title={s.name} />)}
      </ol>
      {next ? (
        <>
          <p>
            <span>Next stop · {String(step).padStart(2, '0')}</span>
            <b>{next.name}</b>
            <small>{next.line}</small>
          </p>
          <button
            className="ui-btn ui-btn--primary"
            tabIndex={visible ? 0 : -1}
            onClick={() => {
              soundManager.play('click')
              // with the AI guide on, it walks you there (and narrates); otherwise the quick trip
              if (useVoiceStore.getState().mode !== 'off') walkTo(next.id)
              else navigateToLocation(next.id)
            }}
          >
            Guide me
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h13m-5-6 6 6-6 6" /></svg>
          </button>
        </>
      ) : (
        <p><span>Journey complete</span><b>Thank you</b><small>Explore anything again</small></p>
      )}
    </div>
  )
}
