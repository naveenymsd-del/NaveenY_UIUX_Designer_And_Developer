import { type Destination, navigateToLocation } from '@/core/navigation'
import { soundManager } from '@/core/sound/SoundManager'
import { type Place, useGameStore } from '@/stores/gameStore'

/**
 * The recommended story path, always one glance away: which chapter comes
 * next, and a button that takes you there. Exploring freely still works —
 * the chip simply skips whatever you've already discovered.
 */
export const STORY: { place: Place; dest: Destination; name: string; line: string }[] = [
  { place: 'home', dest: 'home', name: 'Home', line: 'Who I am' },
  { place: 'education', dest: 'education', name: 'Education', line: 'Where I started' },
  { place: 'office', dest: 'office', name: 'NFC Solutions', line: 'Where I became a professional' },
  { place: 'projects', dest: 'projects', name: 'Projects', line: 'What I have built' },
  { place: 'park', dest: 'design', name: 'Design Park', line: 'How I think and design' },
  { place: 'final', dest: 'contact', name: 'Contact', line: 'Let’s connect' },
]

export function JourneyChip() {
  const phase = useGameStore((s) => s.phase)
  const discovered = useGameStore((s) => s.discovered)
  const busy = useGameStore((s) => !!s.activeLocationId || !!s.activeProjectId || s.fade || !!s.establishing || !!s.travel)
  const next = STORY.find((s) => !discovered.includes(s.place))
  const done = STORY.filter((s) => discovered.includes(s.place)).length
  const step = next ? STORY.indexOf(next) + 1 : STORY.length
  const visible = phase === 'playing' && !busy
  return (
    <div className={`ui-journey-chip ${visible ? 'is-visible' : ''}`} aria-hidden={!visible}>
      <ol className="ui-journey-chip__dots" aria-label={`Story progress: ${done} of ${STORY.length}`}>
        {STORY.map((s) => <li key={s.place} className={discovered.includes(s.place) ? 'is-done' : s === next ? 'is-next' : ''} title={s.name} />)}
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
              navigateToLocation(next.dest)
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
