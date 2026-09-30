import { useEffect, useRef, useState } from 'react'
import { say } from '@/core/companion'
import { soundManager } from '@/core/sound/SoundManager'
import { PROFILE } from '@/data/portfolioContent'
import { submitFeedback, type FeedbackRating } from '@/services/feedback'
import { useGameStore } from '@/stores/gameStore'
import { ContactLinks } from './ContactLinks'

const CHOICES: FeedbackRating[] = ['Loved it', 'Interesting', 'Could be better', 'I have a suggestion']

/**
 * The end of the journey, across the café table:
 * 1. a short chat → "How was the journey?" (four choices + an optional note)
 * 2. Let's talk — the contact details
 * 3. Thank you for visiting
 */
export function CafeConversation() {
  const open = useGameStore((s) => s.activeLocationId === 'cafe-conversation')
  const close = useGameStore((s) => s.closePanels)
  const [step, setStep] = useState<'chat' | 'connect' | 'thanks'>('chat')
  const [visible, setVisible] = useState(false)
  const [lines, setLines] = useState(0)
  const [rating, setRating] = useState<FeedbackRating | null>(null)
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
    setRating(null)
    setText('')
    setSent(null)
    const ts = [
      window.setTimeout(() => setVisible(true), 700),
      window.setTimeout(() => setLines(1), 1100),
      window.setTimeout(() => setLines(2), 2500),
      window.setTimeout(() => setLines(3), 4300),
    ]
    return () => ts.forEach(clearTimeout)
  }, [open])

  if (!open) return null
  const toConnect = () => {
    setStep('connect')
    say('If you’d like to talk about design, products, or ideas… <b>let’s connect</b>.', { ms: 3800, emote: 'explain', interrupt: true })
  }
  const send = async () => {
    if (!rating && !text.trim()) return toConnect()
    try {
      const r = await submitFeedback(rating ?? 'Café review', text)
      setSent(r === 'sent' ? 'sent' : 'saved')
      soundManager.play('discover')
    } catch {
      setSent('saved')
    }
    toConnect()
  }
  const finish = () => {
    setStep('thanks')
    soundManager.play('discover')
    say('Thanks for exploring <b>my world</b>.', { ms: 3000, emote: 'celebrate', interrupt: true })
    say('I hope you enjoyed the journey.', { ms: 3000, emote: 'greet' })
  }

  return (
    <aside className={`ui-cafe ${visible ? 'is-visible' : ''}`} role="dialog" aria-labelledby="cafe-title">
      <p className="ui-kicker">Chapter 09 · Contact Café</p>
      {step === 'chat' && (
        <>
          <h2 id="cafe-title" className="sr-only">A conversation with {PROFILE.name}</h2>
          <ol className="ui-cafe__chat" aria-live="polite">
            {lines >= 1 && <li>Thanks for taking the time to explore my portfolio.</li>}
            {lines >= 2 && <li>I hope the journey gave you a better idea of who I am, what I design and how I use technology and AI to expand my design process.</li>}
            {lines >= 3 && <li><b>How was the journey?</b></li>}
          </ol>
          <div className={`ui-cafe__reply ${lines >= 3 ? 'is-ready' : ''}`}>
            <div className="ui-cafe__choices" role="radiogroup" aria-label="How was the journey?">
              {CHOICES.map((c) => (
                <button key={c} role="radio" aria-checked={rating === c} className={rating === c ? 'is-picked' : ''} onClick={() => { setRating(c); soundManager.play('hover'); if (c === 'I have a suggestion') area.current?.focus() }}>
                  {c}
                </button>
              ))}
            </div>
            <textarea
              ref={area}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => e.stopPropagation()}
              rows={2}
              maxLength={2000}
              placeholder="Tell me what you think… (optional)"
              aria-label="Your review or suggestion"
            />
            <div className="ui-cafe__actions">
              <button className="ui-btn ui-btn--primary" onClick={() => void send()} disabled={!rating && !text.trim()}>Send feedback</button>
              <button className="ui-btn ui-btn--quiet" onClick={() => { soundManager.play('click'); toConnect() }}>Skip</button>
            </div>
          </div>
        </>
      )}
      {step === 'connect' && (
        <>
          <h2 id="cafe-title">Let’s talk.</h2>
          {sent && <p className="ui-cafe__thanks">{sent === 'sent' ? 'Thank you — your note is on its way.' : 'Thank you — your note was saved (delivery isn’t connected yet).'}</p>}
          <p className="ui-cafe__asks">Have an idea? Want to discuss a product? Want to talk about UI/UX? Just want to say hello?</p>
          <p className="ui-cafe__lead">Let’s connect.</p>
          <ContactLinks />
          <button className="ui-btn ui-btn--primary ui-cafe__next" onClick={finish}>Finish the journey</button>
        </>
      )}
      {step === 'thanks' && (
        <>
          <h2 id="cafe-title">Thank you for visiting.</h2>
          <p className="ui-cafe__story">You didn’t just visit my portfolio. <b>You explored it.</b> You walked through my story, my work, my process and the way I think about design.</p>
          <div className="ui-cafe__signature">
            <b>{PROFILE.name.toUpperCase()}</b>
            <span>UI/UX Designer</span>
            <small>Designing human experiences with technology &amp; AI</small>
          </div>
          <p className="ui-cafe__lead">Let’s build what’s next.</p>
          <button className="ui-cafe__done" onClick={() => { soundManager.play('close'); close() }}>Stand up and keep exploring</button>
        </>
      )}
    </aside>
  )
}
