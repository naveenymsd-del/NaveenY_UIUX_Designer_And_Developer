import { useEffect, useRef, useState } from 'react'
import { disableGuide, enableText, enableVoice, interruptGuide, resumeAudio, submit, toggleListening } from '@/ai/guide'
import { useVoiceStore } from '@/ai/voiceStore'
import { currentLocation } from '@/ai/worldState'
import { soundManager } from '@/core/sound/SoundManager'
import { useGameStore } from '@/stores/gameStore'
import { useUIStore } from '@/stores/uiStore'
import { CompanionGlyph } from './CompanionGlyph'

const FIRST_TRY = ['Ask me about Naveen', 'Take me to Projects', 'What is TASK?']
/** a few things worth saying in each place (one shown at a time) */
const STARTERS: Record<string, string[]> = {
  start: ['Tell me about Naveen', 'Take me to the projects', 'What does Naveen do?'],
  street: ['Where should I go first?', 'Take me to the projects', 'What does Naveen do?'],
  home: ['What skills does he have?', 'What tools does he use?', 'How does he use AI?'],
  education: ['What did he study?', 'Take me to his office'],
  office: ['What did he work on here?', 'Show me the projects', 'Tell me about NFC Solutions'],
  projects: ['What is TASK?', 'Show me KidPool', 'Which project should I see first?'],
  project: ['What was the challenge?', 'What did he do there?', 'Open the prototype'],
  gallery: ['How does he use AI?', 'What are his interests?'],
  contact: ['How can I contact him?'],
  plaza: ['Take me to the projects', 'Where should I go first?'],
}

const LABEL: Record<string, string> = {
  disabled: 'Talk to me',
  idle: 'Tap to talk',
  connecting: 'Connecting…',
  user_speaking: 'Listening…',
  listening: 'Listening…',
  thinking: 'Thinking…',
  speaking: 'Tap to interrupt',
  navigating: 'On our way…',
  interrupted: 'Yep?',
  error: 'I didn’t catch that',
}

/**
 * The guide's small conversation dock: a status orb, the latest exchange
 * (older lines fade), a rotating hint, and a text box. Voice never turns on
 * by itself — the visitor opts in after a one-line explanation.
 */
export function VoiceDock() {
  const phase = useGameStore((s) => s.phase)
  const worldMode = useGameStore((s) => s.mode)
  // on touch screens the first-run controls card comes first (the companion's bubble waits for it too)
  const tipsOpen = useGameStore((s) => s.tipsOpen)
  const isTouch = useUIStore((s) => s.isTouch)
  const tipsFirst = tipsOpen && isTouch
  const v = useVoiceStore()
  const [text, setText] = useState('')
  const [typing, setTyping] = useState(false)
  const [hint, setHint] = useState(0)
  const input = useRef<HTMLInputElement>(null)
  const log = useRef<HTMLOListElement>(null)
  const visible = phase === 'playing' && worldMode === 'street' && !tipsFirst

  // rotate the contextual hint every few seconds
  useEffect(() => {
    const t = window.setInterval(() => setHint((h) => h + 1), 7000)
    return () => window.clearInterval(t)
  }, [])
  useEffect(() => { if (log.current) log.current.scrollTop = log.current.scrollHeight }, [v.messages.length, v.historyOpen])
  useEffect(() => { if (v.mode === 'text') setTyping(true) }, [v.mode])
  useEffect(() => { if (typing) setTimeout(() => input.current?.focus({ preventScroll: true }), 40) }, [typing])
  // once a guided walk starts, hand the keyboard back to the world so WASD / arrows can take over
  useEffect(() => { if (v.state === 'navigating') input.current?.blur() }, [v.state])

  if (!visible) return null
  const on = v.mode !== 'off'
  const label = v.status ?? LABEL[v.state] ?? 'Talk to me'
  const loc = currentLocation()
  const starters = STARTERS[loc.startsWith('project:') ? 'project' : loc] ?? STARTERS.street
  const showFirst = on && v.turns === 0
  const shown = v.historyOpen ? v.messages : v.messages.slice(-2)

  const orb = () => {
    soundManager.unlock()
    soundManager.play('click')
    if (!on) return useVoiceStore.getState().set({ consentOpen: !v.consentOpen })
    if (v.state === 'speaking' || v.state === 'navigating' || v.state === 'thinking') return interruptGuide()
    if (v.mode === 'voice') return toggleListening()
    if (v.canListen) return useVoiceStore.getState().set({ consentOpen: true })
    setTyping(true)
  }
  const send = (q: string) => {
    if (!q.trim()) return
    void submit(q)
    setText('')
  }

  return (
    <section className={`ui-voice is-${v.state} ${on ? 'is-on' : ''} ${v.historyOpen ? 'is-history' : ''}`} aria-label="Talk to the AI guide">
      {(shown.length > 0 || v.interim) && (
        <ol className="ui-voice__log" ref={log} role="log" aria-live="polite" aria-label="Conversation">
          {shown.map((m, i) => (
            <li
              key={m.id}
              className={`is-${m.role} ${!v.historyOpen && i < shown.length - 1 ? 'is-old' : ''}`}
              onClick={() => { if (!v.historyOpen && m.role === 'guide') useVoiceStore.getState().set({ historyOpen: true }) }}
            >
              <span className="sr-only">{m.role === 'user' ? 'You said: ' : 'Guide: '}</span>
              {m.text}
            </li>
          ))}
          {v.interim && <li className="is-user is-interim" aria-hidden="true">{v.interim}…</li>}
        </ol>
      )}

      {v.link && (
        <a className="ui-voice__link" href={v.link.url} target="_blank" rel="noopener noreferrer" onClick={() => useVoiceStore.getState().set({ link: null })}>
          {v.link.label} <span aria-hidden="true">↗</span>
          <span className="sr-only"> (opens Figma in a new tab)</span>
        </a>
      )}

      {v.audioBlocked && (
        <button className="ui-voice__link" onClick={() => resumeAudio()}>
          Tap to hear me <span aria-hidden="true">🔊</span>
        </button>
      )}

      {v.consentOpen && (
        <div className="ui-voice__consent" role="dialog" aria-labelledby="voice-consent-title">
          <p id="voice-consent-title"><b>Talk to me</b></p>
          {v.canListen ? (
            <p>
              Voice mode uses your microphone so I can hear you. Your portfolio session doesn’t store your voice recordings.{' '}
              {v.canRealtime
                ? 'Live voice: your voice is processed live by the voice service so I can understand and answer you.'
                : 'Browser voice: your browser turns each sentence into text (Chrome and Edge use their online speech service) and reads my answers aloud. It’s turn by turn, not live speech-to-speech.'}
            </p>
          ) : (
            <p>This browser can’t listen to speech, but you can type to me{v.canSpeak ? ' — I’ll still read my answers aloud' : ''}.</p>
          )}
          <div className="ui-voice__consent-actions">
            {v.canListen && <button className="ui-btn ui-btn--primary" onClick={() => void enableVoice()}>Turn on voice</button>}
            <button className="ui-btn ui-btn--glass" onClick={() => { enableText(); setTyping(true) }}>Type instead</button>
            <button className="ui-voice__x" onClick={() => useVoiceStore.getState().set({ consentOpen: false })} aria-label="Close">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" /></svg>
            </button>
          </div>
        </div>
      )}

      {on && !v.consentOpen && (
        <div className="ui-voice__hints">
          {(showFirst ? FIRST_TRY : [starters[hint % starters.length]]).map((h) => (
            <button key={h} onClick={() => send(h)}>
              {!showFirst && <span aria-hidden="true">Try: </span>}“{h}”
            </button>
          ))}
        </div>
      )}

      {typing && on && (v.state === 'navigating' || v.state === 'thinking' || v.state === 'error') && (
        <p className="ui-voice__state" aria-hidden="true">{label}</p>
      )}

      <div className="ui-voice__bar">
        <button
          className="ui-voice__orb"
          onClick={orb}
          aria-label={!on ? 'Talk to the AI guide' : v.state === 'speaking' || v.state === 'navigating' ? 'Stop the guide' : v.mode === 'voice' ? (v.state === 'listening' ? 'Pause listening' : 'Start listening') : 'Talk to the guide'}
          aria-expanded={!on ? v.consentOpen : undefined}
        >
          <span className="ui-voice__ring" aria-hidden="true" />
          <CompanionGlyph size={30} />
        </button>
        {typing && on ? (
          <form className="ui-voice__form" onSubmit={(e) => { e.preventDefault(); send(text) }}>
            <input
              ref={input}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Escape') { setTyping(false); (e.target as HTMLInputElement).blur() } e.stopPropagation() }}
              placeholder={v.mode === 'voice' ? 'Speak, or type here…' : 'Type a message…'}
              aria-label="Message the AI guide"
              maxLength={400}
            />
            <button type="submit" aria-label="Send" disabled={!text.trim()}>
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h13m-5-6 6 6-6 6" /></svg>
            </button>
          </form>
        ) : (
          <button className="ui-voice__status" onClick={orb} aria-hidden="true" tabIndex={-1}>{label}</button>
        )}
        <span className="sr-only" aria-live="polite">{on ? label : ''}</span>
        {on && !typing && (
          <button className="ui-voice__icon" onClick={() => setTyping(true)} aria-label="Type a message instead" title="Type instead">
            <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="6" width="18" height="12" rx="2.5" /><path d="M7 10h1M11 10h1M15 10h1M8 14h8" /></svg>
          </button>
        )}
        {on && v.messages.length > 2 && (
          <button className={`ui-voice__icon ${v.historyOpen ? 'is-active' : ''}`} onClick={() => useVoiceStore.getState().set({ historyOpen: !v.historyOpen })} aria-label={v.historyOpen ? 'Hide conversation' : 'Show the whole conversation'} aria-pressed={v.historyOpen} title="Conversation">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5h16v10H9l-5 4z" /></svg>
          </button>
        )}
        {on && (
          <button className="ui-voice__power" onClick={() => { setTyping(false); disableGuide() }} aria-label={v.mode === 'voice' ? 'Turn voice off' : 'Close the guide'} title={v.mode === 'voice' ? (v.tier === 'realtime' ? 'Live speech-to-speech is on — tap to turn voice off' : 'Browser voice (turn by turn) is on — tap to turn voice off') : undefined}>
            <span aria-hidden="true" className="ui-voice__dot" />{v.mode === 'voice' ? (v.tier === 'realtime' ? 'Live voice' : 'Browser voice') : 'Close'}
          </button>
        )}
      </div>
    </section>
  )
}
