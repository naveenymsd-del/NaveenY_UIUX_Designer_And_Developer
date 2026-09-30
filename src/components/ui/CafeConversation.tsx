import { useEffect, useRef, useState } from 'react'
import { say } from '@/core/companion'
import { soundManager } from '@/core/sound/SoundManager'
import { PROFILE } from '@/data/portfolioContent'
import { submitFeedback } from '@/services/feedback'
import { useGameStore } from '@/stores/gameStore'
import { ContactLinks } from './ContactLinks'

/**
 * The end of the journey: a conversation across the café table. Naveen asks
 * how it went, the visitor can leave a review or skip, then the contact
 * details appear. Small and warm — a chat, not a form.
 */
export function CafeConversation() {
  const open = useGameStore((s) => s.activeLocationId === 'cafe-conversation')
  const close = useGameStore((s) => s.closePanels)
  const [step, setStep] = useState<'chat' | 'connect'>('chat')
  const [visible, setVisible] = useState(false)
  const [lines, setLines] = useState(0)
  const [text, setText] = useState('')
  const [sent, setSent] = useState<null | 'sent' | 'saved'>(null)
  const area = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (!open) {
      setVisible(false)
      return
    }
    setStep('chat')
    setLines(0)
    setText('')
    setSent(null)
    const ts = [
      window.setTimeout(() => setVisible(true), 700),
      window.setTimeout(() => setLines(1), 1100),
      window.setTimeout(() => setLines(2), 2300),
      window.setTimeout(() => {
        setLines(3)
        area.current?.focus({ preventScroll: true })
      }, 3500),
    ]
    return () => ts.forEach(clearTimeout)
  }, [open])

  if (!open) return null
  const toConnect = () => {
    setStep('connect')
    say('Thanks for exploring <b>my world</b>.', { ms: 3000, emote: 'celebrate', interrupt: true })
    say('I hope you enjoyed the journey.', { ms: 3000, emote: 'greet' })
    say('If you’d like to talk about design, products, or ideas…', { ms: 3400, emote: 'explain' })
    say('<b>Let’s connect.</b>', { ms: 2600, emote: 'wave' })
  }
  const send = async () => {
    if (!text.trim()) return toConnect()
    try {
      const r = await submitFeedback('Café review', text)
      setSent(r === 'sent' ? 'sent' : 'saved')
      soundManager.play('discover')
    } catch {
      setSent('saved')
    }
    toConnect()
  }

  return (
    <aside className={`ui-cafe ${visible ? 'is-visible' : ''}`} role="dialog" aria-labelledby="cafe-title">
      <p className="ui-kicker">Chapter 06 · Contact Café</p>
      {step === 'chat' ? (
        <>
          <h2 id="cafe-title" className="sr-only">A conversation with {PROFILE.name}</h2>
          <ol className="ui-cafe__chat" aria-live="polite">
            {lines >= 1 && <li>Thanks for taking the journey.</li>}
            {lines >= 2 && <li>So… how was the experience?</li>}
            {lines >= 3 && <li>What did you think?</li>}
          </ol>
          <div className={`ui-cafe__reply ${lines >= 3 ? 'is-ready' : ''}`}>
            <textarea
              ref={area}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => e.stopPropagation()}
              rows={3}
              maxLength={2000}
              placeholder="Tell me what you thought…"
              aria-label="Your review or suggestion"
            />
            <div className="ui-cafe__actions">
              <button className="ui-btn ui-btn--primary" onClick={() => void send()} disabled={!text.trim()}>Send feedback</button>
              <button className="ui-btn ui-btn--quiet" onClick={() => { soundManager.play('click'); toConnect() }}>Skip</button>
            </div>
          </div>
        </>
      ) : (
        <>
          <h2 id="cafe-title">Let’s connect.</h2>
          {sent && <p className="ui-cafe__thanks">{sent === 'sent' ? 'Thank you — your note is on its way.' : 'Thank you — your note was saved (delivery isn’t connected yet).'}</p>}
          <p className="ui-cafe__sign"><b>{PROFILE.name}</b> · {PROFILE.role} · Designing human experiences with AI</p>
          <ContactLinks />
          <button className="ui-cafe__done" onClick={() => { soundManager.play('close'); close() }}>Stand up and keep exploring</button>
        </>
      )}
    </aside>
  )
}
