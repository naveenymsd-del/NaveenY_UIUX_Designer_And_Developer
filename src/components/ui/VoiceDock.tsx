import { useEffect, useRef, useState } from 'react'
import { disableGuide, enableText, enableVoice, interruptGuide, resumeAudio, submit, toggleListening } from '@/ai/guide'
import { useVoiceStore } from '@/ai/voiceStore'
import { currentLocation } from '@/ai/worldState'
import { soundManager } from '@/core/sound/SoundManager'
import { useGameStore } from '@/stores/gameStore'
import { useUIStore } from '@/stores/uiStore'
import { CompanionGlyph } from './CompanionGlyph'
import { useGallery } from './GalleryViewer'

/** what to try first, and later one contextual idea at a time */
const FIRST_TRY = ['Take me to projects', 'Tell me about Naveen', 'Guide me']
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
/** the phone orb's tiny state label (only for states worth a glance) */
const FAB_LABEL: Partial<Record<string, string>> = {
  listening: 'Listening…', user_speaking: 'Listening…', speaking: 'Speaking…', thinking: 'Thinking…', navigating: 'On our way…', connecting: 'Connecting…',
}

/** a content panel is open: the AI steps back to just its orb */
function useModalOpen() {
  const game = useGameStore((s) => !!s.activeProjectId || !!s.activeLocationId)
  const ui = useUIStore((s) => s.menuOpen || s.guideOpen)
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

// ── desktop: the bar bottom-left ──────────────────────────────────────────
function DesktopDock({ modal }: { modal: boolean }) {
  const v = useVoiceStore()
  const [typing, setTyping] = useState(false)
  const hint = useRotation()
  const input = useRef<HTMLInputElement>(null)
  const log = useRef<HTMLOListElement>(null)

  useEffect(() => { if (log.current) log.current.scrollTop = log.current.scrollHeight }, [v.messages.length, v.historyOpen])
  useEffect(() => { if (v.mode === 'text') setTyping(true) }, [v.mode])
  useEffect(() => { if (typing) setTimeout(() => input.current?.focus({ preventScroll: true }), 40) }, [typing])
  // once a guided walk starts, hand the keyboard back to the world so WASD / arrows can take over
  useEffect(() => { if (v.state === 'navigating') input.current?.blur() }, [v.state])
  // a content panel opened: close the consent card and the history (the bar stays, out of the panel's way)
  useEffect(() => { if (modal) useVoiceStore.getState().set({ consentOpen: false, historyOpen: false }) }, [modal])

  const on = v.mode !== 'off'
  const label = v.status ?? LABEL[v.state] ?? 'Talk to me'
  const showFirst = on && v.turns === 0
  const starters = startersHere()

  const orb = () => {
    soundManager.unlock()
    soundManager.play('click')
    if (!on) return useVoiceStore.getState().set({ consentOpen: !v.consentOpen })
    if (v.state === 'speaking' || v.state === 'navigating' || v.state === 'thinking') return interruptGuide()
    if (v.mode === 'voice') return toggleListening()
    if (v.canListen) return useVoiceStore.getState().set({ consentOpen: true })
    setTyping(true)
  }

  return (
    <section className={`ui-voice is-${v.state} ${on ? 'is-on' : ''} ${v.historyOpen ? 'is-history' : ''} ${modal ? 'is-collapsed' : ''}`} aria-label="Talk to the AI guide">
      {!modal && <Log refEl={log} />}
      {/* a panel is open: the lines step aside visually but stay readable for screen readers */}
      {modal && <div className="sr-only"><Log /></div>}
      {!modal && <Extras />}
      {!modal && v.consentOpen && <Consent onType={() => setTyping(true)} />}
      {!modal && on && !v.consentOpen && v.turns < 6 && (
        <div className="ui-voice__hints">
          {(showFirst ? FIRST_TRY : [starters[hint % starters.length]]).map((h) => (
            <button key={h} onClick={() => void submit(h)}>
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
          <TextForm inputRef={input} onEscape={() => setTyping(false)} />
        ) : (
          <button className="ui-voice__status" onClick={orb} aria-hidden="true" tabIndex={-1}>{label}</button>
        )}
        <span className="sr-only" aria-live="polite">{on ? label : ''}</span>
        {on && !typing && (
          <button className="ui-voice__icon" onClick={() => setTyping(true)} aria-label="Type a message instead" title="Type instead">
            <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="6" width="18" height="12" rx="2.5" /><path d="M7 10h1M11 10h1M15 10h1M8 14h8" /></svg>
          </button>
        )}
        {on && v.messages.length > 2 && !modal && (
          <button className={`ui-voice__icon ${v.historyOpen ? 'is-active' : ''}`} onClick={() => useVoiceStore.getState().set({ historyOpen: !v.historyOpen })} aria-label={v.historyOpen ? 'Hide conversation' : 'Show the whole conversation'} aria-pressed={v.historyOpen} title="Conversation">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5h16v10H9l-5 4z" /></svg>
          </button>
        )}
        {on && (
          <button
            className="ui-voice__power"
            onClick={() => { setTyping(false); void disableGuide() }}
            aria-label={v.mode === 'voice' ? 'Turn voice off' : 'Close the guide'}
            title={v.mode === 'voice' ? (v.tier === 'realtime' ? 'Live speech-to-speech is on — tap to turn voice off' : 'Browser voice (turn by turn) is on — tap to turn voice off') : undefined}
          >
            <span aria-hidden="true" className="ui-voice__dot" />{v.mode === 'voice' ? (v.tier === 'realtime' ? 'Live voice' : 'Browser voice') : 'Close'}
          </button>
        )}
      </div>
    </section>
  )
}

// ── phones: an orb bottom-right, a compact sheet on demand ────────────────
function TouchDock({ modal }: { modal: boolean }) {
  const v = useVoiceStore()
  const hintStep = useUIStore((s) => s.hint)
  const rot = useRotation(6500)
  const input = useRef<HTMLInputElement>(null)
  const log = useRef<HTMLOListElement>(null)
  const restore = useRef(false)
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
  useEffect(() => { if (log.current) log.current.scrollTop = log.current.scrollHeight }, [v.messages.length, open])
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

  const fabLabel = on ? FAB_LABEL[v.state] : undefined

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
    if (!on && !s.sheet) {
      s.set({ sheet: true, consentOpen: true })
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
      className={`ui-voice ui-voice--touch is-${v.state} ${on ? 'is-on' : ''} ${open ? 'is-open' : ''} ${modal ? 'is-modal' : ''} ${hintStep === 'ai' ? 'is-hinted' : ''}`}
      aria-label="Talk to the AI guide"
    >
      {open && (
        <div className="ui-voice__sheet" role="dialog" aria-label="AI guide">
          <header className="ui-voice__sheet-head">
            <span className="ui-voice__avatar" aria-hidden="true"><CompanionGlyph size={22} /></span>
            <p><b>AI guide</b><span aria-live="polite">{on ? FAB_LABEL[v.state] ?? (v.mode === 'voice' ? 'Tap the mic to talk' : 'Ready') : 'Ready'}</span></p>
            {on && v.mode === 'voice' && (
              <button className="ui-voice__power" onClick={() => void disableGuide()} aria-label="Turn voice off" title={v.tier === 'realtime' ? 'Live speech-to-speech is on' : 'Browser voice (turn by turn) is on'}>
                <span aria-hidden="true" className="ui-voice__dot" />{v.tier === 'realtime' ? 'Live voice' : 'Browser voice'}
              </button>
            )}
            <button className="ui-voice__x" onClick={() => useVoiceStore.getState().set({ sheet: false, consentOpen: false })} aria-label="Collapse the AI guide">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6" /></svg>
            </button>
          </header>
          <div className="ui-voice__sheet-body">
            {v.consentOpen ? <Consent onType={() => setTimeout(() => input.current?.focus({ preventScroll: true }), 60)} /> : <Log all refEl={log} />}
            {!v.consentOpen && v.messages.length === 0 && <p className="ui-voice__empty">What would you like to explore?</p>}
            <Extras />
          </div>
          {!v.consentOpen && (
            <div className="ui-voice__quick" aria-label="Quick destinations">
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
          aria-label={v.state === 'speaking' ? 'Stop the guide' : open ? 'Collapse the AI guide' : 'Talk to the AI guide'}
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
