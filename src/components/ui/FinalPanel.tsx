import { useEffect, useRef, useState } from 'react'
import { say } from '@/core/companion'
import { soundManager } from '@/core/sound/SoundManager'
import { useGameStore } from '@/stores/gameStore'
import { CompanionGlyph } from './CompanionGlyph'
import { PROFILE } from '@/data/portfolioContent'
import { ContactLinks } from './ContactLinks'
import { FeedbackForm } from './FeedbackForm'

/** The Lookout: a quiet ending with thanks, contact and feedback. */
export function FinalPanel() {
  const id = useGameStore((s) => s.activeLocationId)
  const close = useGameStore((s) => s.closePanels)
  const open = id === 'final'
  const [visible, setVisible] = useState(false)
  const [mode, setMode] = useState<'thanks' | 'feedback'>('thanks')
  const ref = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) {
      setVisible(false)
      return
    }
    setMode('thanks')
    say('Thanks for taking the time to explore <b>my world</b>.', { ms: 3600, emote: 'celebrate', interrupt: true })
    say('I hope you enjoyed the journey.', { ms: 3000, emote: 'greet' })
    say('Have a suggestion?', { ms: 3000, emote: 'explain' })
    const t = setTimeout(() => {
      setVisible(true)
      ref.current?.focus({ preventScroll: true })
    }, 1100)
    return () => clearTimeout(t)
  }, [open])

  if (!open) return null
  const done = () => {
    soundManager.play('close')
    close()
  }
  return (
    <aside className={`ui-final ${visible ? 'is-visible' : ''}`} role="dialog" aria-labelledby="final-title">
      <CompanionGlyph size={52} />
      <p className="ui-kicker">Chapter 10 · Let’s connect</p>
      <h2 id="final-title">Thank you for exploring.</h2>
      <p className="ui-final__sign"><b>{PROFILE.name}</b> · {PROFILE.role} · Designing human experiences with AI</p>
      {mode === 'thanks' ? (
        <>
          <p>I hope you enjoyed walking around. If something sparked a thought, I’d love to hear it.</p>
          <div className="ui-final__actions">
            <button ref={ref} className="ui-btn ui-btn--primary" onClick={() => { soundManager.play('click'); setMode('feedback') }}>Leave feedback</button>
          </div>
          <p className="ui-final__label">Contact me</p>
          <ContactLinks compact />
        </>
      ) : (
        <FeedbackForm onDone={done} />
      )}
      <button className="ui-final__close" onClick={done}>Keep exploring</button>
    </aside>
  )
}
