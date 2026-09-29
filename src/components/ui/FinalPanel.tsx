import { useEffect, useRef, useState } from 'react'
import { say } from '@/core/companion'
import { soundManager } from '@/core/sound/SoundManager'
import { useGameStore } from '@/stores/gameStore'
import { CompanionGlyph } from './CompanionGlyph'
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
    say('Thanks for exploring <b>Naveen’s world</b>.', { ms: 3600, emote: 'celebrate', interrupt: true })
    say('Have any thoughts or suggestions?', { ms: 3800, emote: 'explain' })
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
      <p className="ui-kicker">The Lookout</p>
      <h2 id="final-title">Thanks for taking the time.</h2>
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
