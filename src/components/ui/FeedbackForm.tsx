import { useId, useState } from 'react'
import { soundManager } from '@/core/sound/SoundManager'
import { feedbackConnected, submitFeedback, type FeedbackRating } from '@/services/feedback'

const OPTIONS: FeedbackRating[] = ['Loved it', 'Interesting', 'Could be better', 'I have a suggestion']

/** One question, four answers, an optional note. No account needed. */
export function FeedbackForm({ tabbable = true, onDone }: { tabbable?: boolean; onDone?: () => void }) {
  const [rating, setRating] = useState<FeedbackRating | null>(null)
  const [msg, setMsg] = useState('')
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'saved' | 'error'>('idle')
  const id = useId()
  const tab = tabbable ? 0 : -1

  if (state === 'sent' || state === 'saved')
    return (
      <div className="ui-feedback is-done" role="status">
        <p className="ui-feedback__thanks">Thank you — that really helps.</p>
        {state === 'saved' && <p className="ui-feedback__note">Feedback delivery isn’t connected yet, so this was kept in this browser.</p>}
        {onDone && <button className="ui-btn ui-btn--quiet" onClick={onDone} tabIndex={tab}>Keep exploring</button>}
      </div>
    )

  const send = async () => {
    if (!rating) return
    setState('sending')
    try {
      const r = await submitFeedback(rating, msg)
      soundManager.play('discover')
      setState(r === 'sent' ? 'sent' : 'saved')
    } catch {
      setState('error')
    }
  }
  return (
    <form className="ui-feedback" onSubmit={(e) => { e.preventDefault(); void send() }}>
      <fieldset>
        <legend>How was the journey?</legend>
        <div className="ui-feedback__options">
          {OPTIONS.map((o) => (
            <label key={o} className={rating === o ? 'is-picked' : ''}>
              <input type="radio" name={`fb-${id}`} value={o} checked={rating === o} onChange={() => { setRating(o); soundManager.play('hover') }} tabIndex={tab} />
              {o}
            </label>
          ))}
        </div>
      </fieldset>
      {rating && (
        <label className="ui-feedback__more">
          <span>Tell me what you think <small>(optional)</small></span>
          <textarea value={msg} onChange={(e) => setMsg(e.target.value)} rows={3} maxLength={2000} tabIndex={tab} placeholder="Anything you noticed, liked or would change…" />
        </label>
      )}
      <div className="ui-feedback__row">
        <button type="submit" className="ui-btn ui-btn--primary" disabled={!rating || state === 'sending'} tabIndex={tab}>
          {state === 'sending' ? 'Sending…' : 'Send feedback'}
        </button>
        {!feedbackConnected && <small className="ui-feedback__note">No account needed.</small>}
        {state === 'error' && <small className="ui-feedback__note" role="alert">Couldn’t send just now — please try again.</small>}
      </div>
    </form>
  )
}
