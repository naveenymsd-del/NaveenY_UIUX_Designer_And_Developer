import { useEffect, useRef, useState } from 'react'
import { disableGuide, enableText, enableVoice, interruptGuide, resumeAudio, submit, toggleListening } from '@/ai/guide'
import { useVoiceStore } from '@/ai/voiceStore'
import { currentLocation } from '@/ai/worldState'
import { soundManager } from '@/core/sound/SoundManager'
import { useGameStore } from '@/stores/gameStore'
import { useUIStore } from '@/stores/uiStore'
import { CompanionGlyph } from './CompanionGlyph'
import { useGallery } from './GalleryViewer'
import { closeGuide, openGuide, toggleGuide } from '@/ai/openGuide'

const SUGGESTIONS = ['Take me to projects', 'Tell me about Naveen', 'Take me to NFC Solutions', 'How does Naveen work?', 'Show me education', 'Take me to contact', 'Guide me']
/** a few things worth saying in each place (one shown at a time) */
const STARTERS: Record<string, string[]> = {
  start: ['Tell me about Naveen', 'Take me to projects', 'Guide me'],
  street: ['Where should I go first?', 'Take me to projects', 'Guide me'],
  home: ['What tools does he use?', 'Explain this', 'How does he use AI?'],
  education: ['Tell me about his education', 'Take me to NFC'],
  office: ['Explain the company', 'What does Naveen do there?', 'Show me the projects'],
  projects: ['Show me the projects', 'Which project should I see first?'],
  project: ['Explain this project', 'What was the challenge?', 'Show me the prototype'],
  gallery: ['How does Naveen work?', 'Explain this'],
  contact: ['What can I do here?', 'Take me somewhere else'],
  plaza: ['Take me to projects', 'Where should I go first?'],
}
/** quick destinations in the phone sheet */
const QUICK: [string, string][] = [['Projects', 'Take me to projects'], ['NFC', 'Take me to NFC Solutions'], ['About', 'Tell me about Naveen'], ['Education', 'Take me to education'], ['Contact', 'Take me to contact']]

/** the phone orb's tiny state label (only for states worth a glance) */
const FAB_LABEL: Partial<Record<string, string>> = {
  listening: 'Listening…', user_speaking: 'Listening…', speaking: 'Speaking…', thinking: 'Thinking…', navigating: 'On our way…', connecting: 'Connecting…',
}

/** a content panel is open: the AI steps back to just its orb */
function useModalOpen() {
  const game = useGameStore((s) => !!s.activeProjectId || !!s.activeLocationId)
  const ui = useUIStore((s) => s.menuOpen || s.onboarding)
  const gallery = useGallery((s) => s.index !== null)
  return game || ui || gallery
}

/**
 * The AI guide's controls. Desktop: a compact bar bottom-left with the latest
 * exchange. Phones: an orb where the jump button used to be, opening a
 * small sheet (at most ~30% of the screen). Voice never turns on by itself —
 * the visitor opts in after a one-line explanation. Whenever a content panel
 * is open the AI collapses to its orb (and comes back afterwards).
 */
export function VoiceDock() {
  const isTouch = useUIStore((s) => s.isTouch)
  const phase = useGameStore((s) => s.phase)
  const worldMode = useGameStore((s) => s.mode)
  const modal = useModalOpen()
  const visible = phase === 'playing' && worldMode === 'street'
  if (!visible) return null
  return isTouch ? <TouchDock modal={modal} /> : <DesktopDock modal={modal} />
}

// ── shared pieces ─────────────────────────────────────────────────────────
function Consent({ onType }: { onType: () => void }) {
  const v = useVoiceStore()
  return (
    <div className="ui-voice__consent" role="dialog" aria-labelledby="voice-consent-title">
      <p id="voice-consent-title"><b>Talk with the AI Guide</b></p>
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
        <button className="ui-btn ui-btn--glass" onClick={() => { enableText(); onType() }}>Type instead</button>
        <button className="ui-voice__x" onClick={() => useVoiceStore.getState().set({ consentOpen: false, sheet: false })} aria-label="Close">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" /></svg>
        </button>
      </div>
    </div>
  )
}

function Log({ all, refEl }: { all?: boolean; refEl?: React.RefObject<HTMLOListElement | null> }) {
  const v = useVoiceStore()
  const shown = all || v.historyOpen ? v.messages.slice(-30) : v.messages.slice(-2)
  if (!shown.length && !v.interim) return null
  return (
    <ol className="ui-voice__log" ref={refEl} role="log" aria-live="polite" aria-label="Conversation">
      {shown.map((m, i) => (
        <li
          key={m.id}
          className={`is-${m.role} ${!all && !v.historyOpen && i < shown.length - 1 ? 'is-old' : ''}`}
          onClick={() => { if (!all && !v.historyOpen && m.role === 'guide') useVoiceStore.getState().set({ historyOpen: true }) }}
        >
          <span className="sr-only">{m.role === 'user' ? 'You said: ' : 'Guide: '}</span>
          {m.text}
        </li>
      ))}
      {v.interim && <li className="is-user is-interim" aria-hidden="true">{v.interim}…</li>}
    </ol>
  )
}

function Extras() {
  const v = useVoiceStore()
  return (
    <>
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
    </>
  )
}

function useRotation(ms = 7000) {
  const [n, setN] = useState(0)
  useEffect(() => {
    const t = window.setInterval(() => setN((h) => h + 1), ms)
    return () => window.clearInterval(t)
  }, [ms])
  return n
}
const startersHere = () => {
  const loc = currentLocation()
  return STARTERS[loc.startsWith('project:') ? 'project' : loc] ?? STARTERS.street
}

function TextForm({ inputRef, onEscape }: { inputRef: React.RefObject<HTMLInputElement | null>; onEscape: () => void }) {
  const v = useVoiceStore()
  const [text, setText] = useState('')
  const send = () => {
    if (!text.trim()) return
    void submit(text)
    setText('')
  }
  return (
    <form className="ui-voice__form" onSubmit={(e) => { e.preventDefault(); send() }}>
      <input
        ref={inputRef}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Escape') { onEscape(); (e.target as HTMLInputElement).blur() } e.stopPropagation() }}
        placeholder={v.mode === 'voice' ? 'Speak, or type here…' : 'Type a message…'}
        aria-label="Message the AI guide"
        maxLength={400}
        enterKeyHint="send"
      />
      <button type="submit" aria-label="Send" disabled={!text.trim()}>
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h13m-5-6 6 6-6 6" /></svg>
      </button>
    </form>
  )
}

// ── desktop: one launcher bottom-left, one panel on the right ─────────────
/** what the guide is doing, in words (the panel's status strip and the launcher's subtitle) */
const STATE_LINE: Partial<Record<string, string>> = {
  connecting: 'Connecting…', listening: 'Listening…', user_speaking: 'Listening…', thinking: 'Thinking…', speaking: 'Speaking…', navigating: 'On our way…', error: 'I didn’t catch that',
}
/** a compact, useful set of first questions (the current place's ideas come first) */
const QUICK_ACTIONS = ['Take me to Projects', 'Tell me about the INTA project', 'Show me Education', 'What tools does Naveen use?', 'How can I contact Naveen?', 'Explain this location']

function DesktopDock({ modal }: { modal: boolean }) {
  const v = useVoiceStore()
  const open = v.sheet && !modal
  const input = useRef<HTMLInputElement>(null)
  const log = useRef<HTMLOListElement>(null)
  const panel = useRef<HTMLElement>(null)
  const [caption, setCaption] = useState<{ id: number; text: string } | null>(null)
  const on = v.mode !== 'off'
  const voice = v.mode === 'voice'
  const listening = voice && (v.state === 'listening' || v.state === 'user_speaking')
  const busy = v.state === 'speaking' || v.state === 'thinking' || v.state === 'navigating' || v.state === 'connecting'
  const stateLine = v.status ?? STATE_LINE[v.state]

  useEffect(() => { if (log.current) log.current.scrollTop = log.current.scrollHeight }, [v.messages.length, v.messages[v.messages.length - 1]?.text, open])
  // opening the panel puts the cursor in the composer (chat is ready at once) — but not when the
  // panel merely comes back after a content panel closes: then the keyboard stays with the world (W A S D, E)
  const quietReturn = useRef(false)
  useEffect(() => {
    if (!open) return
    if (quietReturn.current) { quietReturn.current = false; return }
    if (!voice) setTimeout(() => input.current?.focus({ preventScroll: true }), 60)
  }, [open, voice])
  // a guided walk starts: hand the keyboard back to the world so W A S D / arrows take over
  useEffect(() => { if (v.state === 'navigating') input.current?.blur() }, [v.state])
  // a content panel opens: the AI panel steps aside, and comes back afterwards
  const restore = useRef(false)
  useEffect(() => {
    const s = useVoiceStore.getState()
    if (modal) {
      restore.current = s.sheet
      if (s.sheet || s.consentOpen) s.set({ sheet: false, consentOpen: false })
    } else if (restore.current) {
      restore.current = false
      quietReturn.current = true
      s.set({ sheet: true })
    }
  }, [modal])
  // panel closed: the guide's latest line shows briefly beside the launcher (click to open the conversation)
  const last = v.messages[v.messages.length - 1]
  useEffect(() => {
    if (!last || last.role !== 'guide' || open) return
    setCaption({ id: last.id, text: last.text })
    const t = window.setTimeout(() => setCaption(null), Math.min(14000, 4500 + last.text.length * 35))
    return () => window.clearTimeout(t)
  }, [last?.id, last?.text, last?.role, open])
  useEffect(() => { if (open) setCaption(null) }, [open])
  // Escape closes the panel (when focus is inside it)
  const onKey = (e: React.KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); closeGuide() } }

  const chooseChat = () => {
    if (voice) void disableGuide().then(() => enableText())
    else if (!on) enableText()
    useVoiceStore.getState().set({ consentOpen: false })
  }
  const chooseVoice = () => {
    soundManager.unlock()
    if (voice) return
    useVoiceStore.getState().set({ consentOpen: true })
  }
  const mic = () => {
    soundManager.unlock()
    if (!voice) return chooseVoice()
    if (busy) return interruptGuide()
    toggleListening()
  }
  const quick = [...new Set([...startersHere().slice(0, 2), ...QUICK_ACTIONS])].slice(0, 7)

  return (
    <>
      <section className={`ag-launch is-${v.state} ${open ? 'is-open' : ''} ${modal ? 'is-hidden' : ''}`} aria-label="AI Guide">
        {caption && !open && !modal && (
          <button className="ag-caption" onClick={openGuide} aria-label="Open the AI Guide conversation">
            <span>{caption.text}</span>
          </button>
        )}
        <button className="ag-launcher" onClick={() => { soundManager.unlock(); soundManager.play('click'); toggleGuide() }} aria-expanded={open} aria-controls="ag-panel" aria-label={open ? 'Close the AI Guide' : 'Open the AI Guide — voice and chat'}>
          <span className="ag-avatar" aria-hidden="true"><CompanionGlyph size={30} /></span>
          <span className="ag-launcher__text">
            <b>AI Guide</b>
            <small>{on && stateLine ? stateLine : 'Voice + Chat'}</small>
          </span>
          <span className={`ag-launcher__mic ${listening ? 'is-live' : ''}`} aria-hidden="true">
            <svg viewBox="0 0 24 24"><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3" /></svg>
          </span>
        </button>
      </section>

      {open && (
        <section id="ag-panel" ref={panel} className={`ag-panel is-${v.state}`} role="dialog" aria-label="Naveen’s AI Guide" onKeyDown={onKey}>
          <header className="ag-head">
            <span className="ag-avatar ag-avatar--lg" aria-hidden="true"><CompanionGlyph size={34} /></span>
            <div className="ag-head__text">
              <h2><span className="ag-grad">Naveen’s</span> AI Guide</h2>
              <p>Explore the city, discover projects, or ask about Naveen.</p>
            </div>
            <button className="ag-icon ag-close" onClick={closeGuide} aria-label="Close the AI Guide" title="Close (Esc)">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6.5 6.5l11 11M17.5 6.5l-11 11" /></svg>
            </button>
          </header>

          <div className="ag-mode" role="radiogroup" aria-label="How to talk to the guide">
            <button role="radio" aria-checked={!voice} className={!voice ? 'is-on' : ''} onClick={chooseChat}>
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5.5h16v10H9.5L5 19v-3.5H4z" /></svg>Chat
            </button>
            <button role="radio" aria-checked={voice} className={voice ? 'is-on' : ''} onClick={chooseVoice}>
              <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3" /></svg>Voice
            </button>
          </div>

          {v.consentOpen && !voice && (
            <div className="ag-consent" role="group" aria-labelledby="ag-consent-title">
              <p id="ag-consent-title"><b>Talk instead of typing</b></p>
              {v.canListen ? (
                <>
                  {/* the same words as on the phone: what the microphone is for, that nothing is stored, and which kind of voice this is */}
                  <p>
                    Voice mode uses your microphone so I can hear you. Your portfolio session doesn’t store your voice recordings.{' '}
                    {v.canRealtime
                      ? 'Live voice: your voice is processed live by the voice service so I can understand and answer you.'
                      : 'Browser voice: your browser turns each sentence into text (Chrome and Edge use their online speech service) and reads my answers aloud. It’s turn by turn, not live speech-to-speech.'}
                  </p>
                  <div className="ag-consent__actions">
                    <button className="ui-btn ui-btn--primary" onClick={() => void enableVoice()}>Turn on voice</button>
                    <button className="ui-btn ui-btn--glass" onClick={() => useVoiceStore.getState().set({ consentOpen: false })}>Not now</button>
                  </div>
                </>
              ) : (
                <>
                  <p>This browser can’t listen to speech, but you can type to me{v.canSpeak ? ' — I’ll still read my answers aloud' : ''}.</p>
                  <div className="ag-consent__actions"><button className="ui-btn ui-btn--glass" onClick={() => useVoiceStore.getState().set({ consentOpen: false })}>Type instead</button></div>
                </>
              )}
            </div>
          )}

          {voice && (
            <div className={`ag-status ${listening ? 'is-live' : ''}`} role="status">
              <span className="ag-status__dot" aria-hidden="true" />
              <span className="ag-status__tier" title={v.tier === 'realtime' ? 'Live speech-to-speech is on' : 'Browser voice (turn by turn) is on'}>{v.tier === 'realtime' ? 'Live voice' : 'Browser voice'}</span>
              <span>{stateLine ?? 'Voice is on — tap the mic and speak'}</span>
              {(listening || busy) && (
                <button onClick={() => (busy ? interruptGuide() : toggleListening())}>{busy ? 'Stop' : 'Stop listening'}</button>
              )}
              <button onClick={chooseChat} className="ag-status__off" aria-label="Turn voice off">Voice off</button>
            </div>
          )}

          <div className="ag-body">
            <Log all refEl={log} />
            {v.messages.length === 0 && <p className="ag-empty">Hi! Ask about Naveen or a project, or tell me where you’d like to go.</p>}
            <Extras />
          </div>

          <div className="ag-quick" role="group" aria-label="Suggestions">
            {quick.map((q) => <button key={q} onClick={() => void submit(q)}>{q}</button>)}
          </div>

          <div className="ag-compose">
            <button className={`ag-mic ${listening ? 'is-live' : ''}`} onClick={mic} aria-label={!voice ? 'Voice — start talking (asks for the microphone)' : busy ? 'Stop the guide' : listening ? 'Stop listening' : 'Start listening'} aria-pressed={listening} title="Voice">
              <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3" /></svg>
            </button>
            <AgForm inputRef={input} placeholder={listening ? 'Listening… or type here' : 'Ask about a project or choose a destination…'} />
          </div>
        </section>
      )}
    </>
  )
}

function AgForm({ inputRef, placeholder }: { inputRef: React.RefObject<HTMLInputElement | null>; placeholder: string }) {
  const [text, setText] = useState('')
  const send = () => {
    if (!text.trim()) return
    void submit(text)
    setText('')
  }
  return (
    <form className="ag-form" onSubmit={(e) => { e.preventDefault(); send() }}>
      <input
        ref={inputRef}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Escape') { closeGuide(); (e.target as HTMLInputElement).blur() } e.stopPropagation() }}
        placeholder={placeholder}
        aria-label="Message the AI guide"
        maxLength={400}
        enterKeyHint="send"
      />
      <button type="submit" className="ag-send" aria-label="Send" disabled={!text.trim()}>
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h13m-5-6 6 6-6 6" /></svg>
      </button>
    </form>
  )
}

// ── phones: an orb bottom-right, a compact sheet on demand ────────────────
function TouchDock({ modal }: { modal: boolean }) {
  const v = useVoiceStore()
  const hintStep = useUIStore((s) => s.hint)
  const rot = useRotation(6500)
  const input = useRef<HTMLInputElement>(null)
  const log = useRef<HTMLOListElement>(null)
  const root = useRef<HTMLElement>(null)
  const body = useRef<HTMLDivElement>(null)
  /** the reader is at the latest line (new lines follow); scrolled up to read, they stay put */
  const atEnd = useRef(true)
  const restore = useRef(false)
  const [tall, setTall] = useState(false)
  const [caption, setCaption] = useState<{ id: number; text: string } | null>(null)
  const on = v.mode !== 'off'
  // the sheet never opens over a panel by itself — only when the visitor taps the orb
  const open = v.sheet

  // a content panel opens: collapse to the orb, and come back afterwards
  useEffect(() => {
    const s = useVoiceStore.getState()
    if (modal) {
      restore.current = s.sheet
      if (s.sheet) s.set({ sheet: false })
    } else if (restore.current) {
      restore.current = false
      s.set({ sheet: true })
    }
  }, [modal])
  // the sheet's own scroller follows the conversation — unless the visitor scrolled up to read
  useEffect(() => { atEnd.current = true }, [open])
  useEffect(() => {
    const el = body.current
    if (el && atEnd.current) el.scrollTop = el.scrollHeight
  }, [v.messages.length, v.messages[v.messages.length - 1]?.text, open, tall])
  // the visible viewport (browser bars, on-screen keyboard): the sheet sizes to it and sits above the keyboard
  useEffect(() => {
    const vv = window.visualViewport
    const el = root.current
    if (!open || !vv || !el) return
    const fit = () => {
      const kb = Math.max(0, window.innerHeight - vv.height - vv.offsetTop)
      el.style.setProperty('--vv-h', `${Math.round(vv.height)}px`)
      el.style.setProperty('--kb', `${Math.round(kb)}px`)
      el.classList.toggle('has-keyboard', kb > 80)
    }
    fit()
    vv.addEventListener('resize', fit)
    vv.addEventListener('scroll', fit)
    return () => {
      vv.removeEventListener('resize', fit)
      vv.removeEventListener('scroll', fit)
      el.style.removeProperty('--vv-h')
      el.style.removeProperty('--kb')
      el.classList.remove('has-keyboard')
    }
  }, [open])
  // a guided walk starts: the sheet steps aside so the world (and the joystick) are free
  useEffect(() => {
    if (v.state === 'navigating') {
      input.current?.blur()
      useVoiceStore.getState().set({ sheet: false })
    }
  }, [v.state])
  // collapsed: the latest line shows briefly above the orb, then fades
  const last = v.messages[v.messages.length - 1]
  const lastId = last?.id
  const lastText = last?.text
  const lastGuide = last?.role === 'guide'
  useEffect(() => {
    if (!lastGuide || !lastText || open) return
    setCaption({ id: lastId!, text: lastText })
    const t = window.setTimeout(() => setCaption(null), Math.min(14000, 4500 + lastText.length * 35))
    return () => window.clearTimeout(t)
  }, [lastId, lastText, lastGuide, open])

  // the orb always says what it is (or what it's doing)
  const fabLabel = (on ? FAB_LABEL[v.state] : undefined) ?? 'AI Guide'

  const fab = () => {
    soundManager.unlock()
    soundManager.play('click')
    const s = useVoiceStore.getState()
    // talking: a tap stops it, and opens the conversation
    if (s.state === 'speaking' || s.state === 'thinking') {
      interruptGuide()
      s.set({ sheet: true, consentOpen: false })
      return
    }
    // the same as the desktop launcher: the chat opens ready to type; voice is one tap away (the mic, with its explanation)
    if (!on && !s.sheet) {
      openGuide()
      return
    }
    s.set({ sheet: !s.sheet, consentOpen: false })
  }
  const micButton = () => {
    soundManager.unlock()
    if (v.mode === 'voice') return toggleListening()
    if (v.canListen) useVoiceStore.getState().set({ consentOpen: true })
  }
  // suggestions near the orb: while the visitor is new to the guide, and only when it's quiet
  const suggestion = v.turns < 4 ? SUGGESTIONS[rot % SUGGESTIONS.length] : null
  const showChip = !open && !modal && !caption && rot > 0 && rot % 2 === 1 && !!suggestion && (v.state === 'idle' || v.state === 'disabled' || v.state === 'listening')
  const listening = v.mode === 'voice' && (v.state === 'listening' || v.state === 'user_speaking')

  return (
    <section
      ref={root}
      className={`ui-voice ui-voice--touch is-${v.state} ${on ? 'is-on' : ''} ${open ? 'is-open' : ''} ${tall ? 'is-tall' : ''} ${modal ? 'is-modal' : ''} ${hintStep === 'ai' ? 'is-hinted' : ''}`}
      aria-label="AI Guide"
    >
      {open && (
        <div className="ui-voice__sheet" role="dialog" aria-label="AI guide">
          <header className="ui-voice__sheet-head">
            <span className="ui-voice__avatar" aria-hidden="true"><CompanionGlyph size={22} /></span>
            <p><b>Naveen’s AI Guide</b><span aria-live="polite">{on ? FAB_LABEL[v.state] ?? (v.mode === 'voice' ? 'Tap the mic to talk' : 'Ready') : 'Ready'}</span></p>
            {on && v.mode === 'voice' && (
              <button className="ui-voice__power" onClick={() => void disableGuide()} aria-label="Turn voice off" title={v.tier === 'realtime' ? 'Live speech-to-speech is on' : 'Browser voice (turn by turn) is on'}>
                <span aria-hidden="true" className="ui-voice__dot" />{v.tier === 'realtime' ? 'Live voice' : 'Browser voice'}
              </button>
            )}
            <button className="ui-voice__x ui-voice__grow" onClick={() => setTall((t) => !t)} aria-label={tall ? 'Make the conversation smaller' : 'Make the conversation taller'} aria-pressed={tall}>
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d={tall ? 'M8 4l4 4 4-4M8 20l4-4 4 4' : 'M8 8l4-4 4 4M8 16l4 4 4-4'} /></svg>
            </button>
            <button className="ui-voice__x" onClick={() => useVoiceStore.getState().set({ sheet: false, consentOpen: false })} aria-label="Collapse the AI guide">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6" /></svg>
            </button>
          </header>
          <div className="ui-voice__sheet-body" ref={body} onScroll={(e) => { const el = e.currentTarget; atEnd.current = el.scrollHeight - el.scrollTop - el.clientHeight < 40 }}>
            {v.consentOpen ? <Consent onType={() => setTimeout(() => input.current?.focus({ preventScroll: true }), 60)} /> : <Log all refEl={log} />}
            {!v.consentOpen && v.messages.length === 0 && <p className="ui-voice__empty">What would you like to explore?</p>}
            <Extras />
          </div>
          {!v.consentOpen && (
            <div className="ui-voice__quick" role="group" aria-label="Quick destinations">
              {QUICK.map(([name, say]) => (
                <button key={name} onClick={() => { if (!on) enableText(); void submit(say) }}>{name}</button>
              ))}
            </div>
          )}
          <div className="ui-voice__sheet-bar">
            {v.canListen && (
              <button className={`ui-voice__mic ${listening ? 'is-live' : ''}`} onClick={micButton} aria-label={v.mode !== 'voice' ? 'Use voice' : listening ? 'Pause listening' : 'Start listening'} aria-pressed={listening}>
                <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3" /></svg>
              </button>
            )}
            <TextForm inputRef={input} onEscape={() => useVoiceStore.getState().set({ sheet: false })} />
          </div>
        </div>
      )}
      {/* the conversation stays in the page for screen readers while collapsed */}
      {!open && <div className="sr-only"><Log /></div>}

      {!open && v.link && (
        <a className="ui-voice__link ui-voice__floatlink" href={v.link.url} target="_blank" rel="noopener noreferrer" onClick={() => useVoiceStore.getState().set({ link: null })}>
          {v.link.label} <span aria-hidden="true">↗</span>
          <span className="sr-only"> (opens Figma in a new tab)</span>
        </a>
      )}
      {!open && caption && !modal && !v.link && (
        <button className="ui-voice__caption" onClick={() => useVoiceStore.getState().set({ sheet: true })} aria-label="Open the conversation">
          <span>{caption.text}</span>
        </button>
      )}
      {showChip && (
        <button className="ui-voice__chip" onClick={() => { if (!on) enableText(); void submit(suggestion!) }}>
          “{suggestion}”
        </button>
      )}

      <div className="ui-voice__fabwrap">
        {fabLabel && !open && <span className="ui-voice__fablabel" aria-hidden="true">{fabLabel}</span>}
        <button
          className="ui-voice__orb ui-voice__fab"
          onClick={fab}
          aria-label={v.state === 'speaking' ? 'Stop the guide' : open ? 'Collapse the AI guide' : 'Open the AI Guide'}
          aria-expanded={open}
        >
          <span className="ui-voice__ring" aria-hidden="true" />
          <CompanionGlyph size={34} />
          <span className="ui-voice__wave" aria-hidden="true"><i /><i /><i /></span>
          <span className="ui-voice__micbadge" aria-hidden="true">
            <svg viewBox="0 0 24 24"><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3" /></svg>
          </span>
        </button>
      </div>
    </section>
  )
}
