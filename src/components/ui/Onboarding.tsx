import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { WORLD_STOPS, type StopId } from '@/data/world'
import { PROJECTS } from '@/data/projects'
import { skipIntro } from '@/core/intro'
import { beginJourney } from '@/core/journey'
import { previewRuntime } from '@/core/preview'
import { soundManager } from '@/core/sound/SoundManager'
import { clearAfterEntry, enableText, enableVoice, goAfterEntry, submit, walkTo } from '@/ai/guide'
import { useVoiceStore } from '@/ai/voiceStore'
import { useGameStore } from '@/stores/gameStore'
import { onboardingDisabled, rememberOnboarding, useUIStore } from '@/stores/uiStore'
import { CompanionGlyph } from './CompanionGlyph'
import { KeyCap } from './KeyCap'
import { STOP_ICONS } from './stopIcons'

/** what each destination is, and what a visitor finds there — from the portfolio's own content */
const DEST: Record<StopId, { about: string; finds: string[] }> = {
  start: { about: 'Where every visit begins — an introduction to Naveen’s world.', finds: ['The welcome square', 'Your AI Guide', 'The route to every place'] },
  home: { about: 'A personal introduction: Naveen’s background and skills.', finds: ['About Naveen', 'Skills & tools', 'Interests'] },
  education: { about: 'Academic history and qualifications.', finds: ['Degrees', 'Certificates'] },
  nfcSolutions: { about: 'Professional experience and the workplace behind it.', finds: ['Role & experience', 'The workspace', 'The Project Studio'] },
  projects: { about: 'Selected UI/UX and product-design case studies.', finds: PROJECTS.map((p) => p.title) },
  gallery: { about: 'How Naveen approaches design.', finds: ['Design process', 'Real UI work', 'Life outside the screen'] },
  contactCafe: { about: 'Contact details and ways to connect.', finds: ['Email & phone', 'LinkedIn', 'Résumé'] },
}
const PROMPTS = ['Take me to Projects', 'Explain the INTA project', 'Show me Naveen’s education', 'What design tools does he use?', 'How can I contact Naveen?']
const FEATURES: [string, string][] = [
  ['M3 20h18M5 20V9l7-5 7 5v11M9 20v-6h6v6', 'Explore the 3D city'],
  ['M4 6h16v12H4zM8 10h8M8 14h5', 'Projects & experience'],
  ['M4 5.5h16v10H9.5L5 19v-3.5H4z', 'AI Guide for questions & directions'],
  ['M6 9h12v8H6zM9 12h.01M12 12h.01M15 12h.01', 'Keyboard, mouse or touch'],
  ['M12 3l2.5 6H21l-5 4 2 7-6-4-6 4 2-7-5-4h6.5z', 'Explore on your own — no AI needed'],
]

/**
 * "Welcome to Naveen’s World": the first-visit introduction. The city behind
 * it is the real one — the camera takes an overview shot while this is open
 * (core/preview.ts), and the destination markers sit on the real buildings.
 * Choosing a marker only shows what is there; nothing moves until the
 * visitor enters. The AI Guide here is the real guide (one conversation):
 * questions are answered now, trips are carried out on entry.
 */
export function Onboarding() {
  const open = useUIStore((s) => s.onboarding)
  if (!open) return null
  return <Welcome />
}

function Welcome() {
  const isTouch = useUIStore((s) => s.isTouch)
  const loading = useGameStore((s) => s.loading)
  const [first] = useState(() => useGameStore.getState().phase === 'loading')
  const ready = !first || (loading.fontsReady && loading.worldReady && loading.physicsReady && loading.compiled)
  const [sel, setSel] = useState<StopId>('start')
  const [never, setNever] = useState(onboardingDisabled)
  const [help, setHelp] = useState(false)
  const root = useRef<HTMLDivElement>(null)
  const stage = useRef<HTMLDivElement>(null)
  const route = useRef<SVGPolylineElement>(null)
  const lastFocus = useRef<HTMLElement | null>(null)

  // the camera frames the city into the stage; the markers follow the real buildings
  useLayoutEffect(() => {
    lastFocus.current = document.activeElement as HTMLElement | null
    previewRuntime.active = true
    previewRuntime.route = route.current
    const measure = () => {
      const r = stage.current?.getBoundingClientRect()
      if (r) previewRuntime.stage = { x: r.left, y: r.top, w: r.width, h: r.height }
    }
    measure()
    const ro = new ResizeObserver(measure)
    if (stage.current) ro.observe(stage.current)
    window.addEventListener('resize', measure)
    return () => {
      ro.disconnect()
      window.removeEventListener('resize', measure)
      previewRuntime.active = false
      previewRuntime.route = null
      previewRuntime.markers.clear()
    }
  }, [])

  // focus: the way in once the city is ready (the dialog itself until then)
  useEffect(() => {
    const el = ready ? root.current?.querySelector<HTMLElement>('.wl-enter') : root.current
    const t = setTimeout(() => el?.focus({ preventScroll: true }), 90)
    return () => clearTimeout(t)
  }, [ready])
  useEffect(() => () => { if (!first) lastFocus.current?.focus?.() }, [first])

  /** leave the welcome screen: 'city' (the opening flight), 'free' (straight in, on your own), or a destination */
  const leave = (how: 'city' | 'free' | StopId) => {
    soundManager.unlock()
    soundManager.play('click')
    rememberOnboarding(never)
    useUIStore.getState().setOnboarding(false)
    if (how === 'city') return
    if (how === 'free') clearAfterEntry()
    else if (!first) {
      // already in the city: just go there
      if (how !== 'start') setTimeout(() => walkTo(how), 300)
      return
    } else goAfterEntry(how)
    if (!first) return
    // a destination, or "on my own": skip the opening flight and the hero, straight into the city
    const unsub = useGameStore.subscribe((s) => {
      if (s.phase !== 'intro') return
      unsub()
      skipIntro()
      setTimeout(() => beginJourney('street'), 60)
    })
  }
  const leaveRef = useRef(leave)
  leaveRef.current = leave

  // Esc enters the city (or closes the reopened introduction), wherever focus is
  useEffect(() => {
    const onEsc = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      e.stopImmediatePropagation()
      e.preventDefault()
      if (help) setHelp(false)
      else if (ready) leaveRef.current('city')
    }
    window.addEventListener('keydown', onEsc, true)
    return () => window.removeEventListener('keydown', onEsc, true)
  }, [help, ready])
  // keyboard stays inside the dialog (and never reaches the world's controls)
  const onKey = (e: React.KeyboardEvent) => {
    e.stopPropagation()
    if (e.key !== 'Tab' || !root.current) return
    const f = [...root.current.querySelectorAll<HTMLElement>('button:not([disabled]):not([tabindex="-1"]), input, a[href]')].filter((x) => x.offsetParent !== null)
    if (!f.length) return
    const a = f[0], z = f[f.length - 1]
    if (e.shiftKey && document.activeElement === a) { e.preventDefault(); z.focus() }
    else if (!e.shiftKey && document.activeElement === z) { e.preventDefault(); a.focus() }
  }

  const stop = WORLD_STOPS.find((s) => s.id === sel)!
  const index = WORLD_STOPS.indexOf(stop)
  const choose = (id: StopId) => {
    soundManager.play('hover')
    setSel(id)
  }

  return (
    <div ref={root} tabIndex={-1} className={`wl ${first ? 'is-first' : 'is-again'} ${ready ? 'is-ready' : ''}`} role="dialog" aria-modal="true" aria-labelledby="wl-title" aria-describedby="wl-lead" onKeyDown={onKey}>
      <div className="wl-shade" aria-hidden="true" />

      {/* the city itself is the backdrop; these sit on its real buildings */}
      <svg className="wl-route" aria-hidden="true"><polyline ref={route} /></svg>
      <div className="wl-markers" aria-hidden="true">
        {WORLD_STOPS.map((s, i) => (
          <button
            key={s.id}
            ref={(el) => { if (el) previewRuntime.markers.set(s.id, el); else previewRuntime.markers.delete(s.id) }}
            className={`wl-marker wl-marker--${s.id} ${sel === s.id ? 'is-selected' : ''}`}
            onClick={() => choose(s.id)}
            style={{ ['--i' as string]: i }}
            tabIndex={-1}
          >
            <span className="wl-marker__pin"><svg viewBox="0 0 24 24"><path d={STOP_ICONS[s.icon]} /></svg></span>
            <span className="wl-marker__label">{s.name}</span>
          </button>
        ))}
      </div>

      <header className="wl-head">
        <p className="wl-kicker">Interactive portfolio</p>
        <h1 id="wl-title">Welcome to <span className="ui-grad-text">Naveen’s World</span></h1>
        <p id="wl-lead">Explore the city behind my design journey. Discover my work, meet your AI Guide, and choose where to begin.</p>
        {!first && (
          <button className="ag-icon wl-close" onClick={() => leave('city')} aria-label="Close the introduction">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6.5 6.5l11 11M17.5 6.5l-11 11" /></svg>
          </button>
        )}
      </header>

      <div className="wl-stage" ref={stage}>
        {!ready && <p className="wl-building" role="status"><span aria-hidden="true" />Building the city…</p>}
      </div>

      {/* desktop: these join the page grid (display: contents); phones: one scrolling sheet under the city */}
      <div className="wl-sheet">
      {/* the same destinations as the markers, as a keyboard- and thumb-friendly list (the route, in story order) */}
      <nav className="wl-dests" aria-label="Destinations">
        <p className="wl-dests__lead">Follow the story from place to place, or jump directly to what interests you.</p>
        <ol>
          {WORLD_STOPS.map((s, i) => (
            <li key={s.id}>
              <button className={sel === s.id ? 'is-selected' : ''} aria-pressed={sel === s.id} onClick={() => choose(s.id)}>
                <span className="wl-dests__icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d={STOP_ICONS[s.icon]} /></svg></span>
                <span className="wl-dests__name"><i>{String(i + 1).padStart(2, '0')}</i>{s.name}</span>
              </button>
            </li>
          ))}
        </ol>
      </nav>

      <aside className="wl-side">
        <section className="wl-dest" aria-live="polite" aria-labelledby="wl-dest-name" key={sel}>
          <p className="wl-dest__step">Destination {String(index + 1).padStart(2, '0')} of {WORLD_STOPS.length}</p>
          <div className="wl-dest__title">
            <span className="wl-dest__icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d={STOP_ICONS[stop.icon]} /></svg></span>
            <h2 id="wl-dest-name">{stop.name}</h2>
          </div>
          <p className="wl-dest__about">{DEST[sel].about}</p>
          <p className="wl-dest__label">What you’ll find</p>
          <ul className="wl-dest__finds">{DEST[sel].finds.map((f) => <li key={f}>{f}</li>)}</ul>
          <button className="wl-dest__go" onClick={() => leave(sel)} disabled={!ready}>
            {sel === 'start' ? 'Start here' : 'Explore this destination'}
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h13m-5-6 6 6-6 6" /></svg>
          </button>
        </section>
        <GuidePreview />
      </aside>

      <div className="wl-help">
        <ul className="wl-features" aria-label="What you can do">
          {FEATURES.map(([d, label]) => (
            <li key={label}><svg viewBox="0 0 24 24" aria-hidden="true"><path d={d} /></svg>{label}</li>
          ))}
        </ul>
        <div className="wl-controls">
          {isTouch ? (
            <ul aria-label="Controls">
              <li><span className="wl-gesture" aria-hidden="true">◎</span>Joystick to walk</li>
              <li><span className="wl-gesture" aria-hidden="true">↔</span>Drag to look</li>
              <li><span className="wl-gesture" aria-hidden="true">✦</span>Tap signs &amp; doors</li>
            </ul>
          ) : (
            <ul aria-label="Controls">
              <li><span className="wl-caps"><KeyCap k="W" /><KeyCap k="A" /><KeyCap k="S" /><KeyCap k="D" /></span>Move</li>
              <li><span className="wl-caps"><KeyCap k="Shift" wide /></span>Run</li>
              <li><span className="wl-caps"><KeyCap k="Space" wide /></span>Jump</li>
              <li><span className="wl-caps"><KeyCap k="Drag" wide /></span>Look</li>
              <li><span className="wl-caps"><KeyCap k="E" /></span>Interact</li>
              <li><span className="wl-caps"><KeyCap k="Esc" wide /></span>Close</li>
            </ul>
          )}
          <button className="wl-more" onClick={() => setHelp((h) => !h)} aria-expanded={help} aria-controls="wl-howto">How to explore</button>
        </div>
        {help && (
          <div id="wl-howto" className="wl-howto" role="region" aria-label="How to explore">
            {isTouch ? (
              <ul>
                <li><b>Walk</b> — drag the joystick at the bottom left.</li>
                <li><b>Look around</b> — drag anywhere on the city; pinch to zoom.</li>
                <li><b>Open a place</b> — tap a glowing sign or door.</li>
                <li><b>AI Guide</b> — tap the guide button at the bottom right to chat, or use its mic to talk.</li>
                <li><b>Every place</b> — the menu (top right) → Explore, then “Take me there”.</li>
              </ul>
            ) : (
              <ul>
                <li><b>Move</b> — W A S D or the arrow keys; hold Shift to run, Space to jump.</li>
                <li><b>Look around</b> — drag with the mouse; scroll to zoom.</li>
                <li><b>Open a place or sign</b> — E or Enter when you’re next to it.</li>
                <li><b>Close</b> — Esc closes panels and menus; H shows or hides the tips.</li>
                <li><b>AI Guide</b> — the button at the bottom left: chat, or talk with the microphone.</li>
                <li><b>Every place</b> — the menu (top right) → Explore, then “Take me there”.</li>
              </ul>
            )}
          </div>
        )}
      </div>

      <footer className="wl-foot">
        <div className="wl-actions">
          <button className="ui-btn ui-btn--primary ui-btn--lg wl-enter" onClick={() => leave('city')} disabled={!ready}>
            {ready ? (first ? 'Enter the City' : 'Back to the City') : 'Preparing the city…'}
            {ready && <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h13m-5-6 6 6-6 6" /></svg>}
          </button>
          {first && (
            <button className="ui-btn ui-btn--glass wl-free" onClick={() => leave('free')} disabled={!ready}>
              Explore Without the Guide
            </button>
          )}
        </div>
      </footer>
      <label className="wl-never">
        <input type="checkbox" checked={never} onChange={(e) => setNever(e.target.checked)} />
        <span>Don’t show this introduction again</span>
      </label>
      </div>
    </div>
  )
}

/**
 * The real AI Guide, before entering: the same conversation the city's panel
 * shows afterwards. Questions are answered here; trips are carried out on entry.
 */
function GuidePreview() {
  const v = useVoiceStore()
  const [text, setText] = useState('')
  const log = useRef<HTMLOListElement>(null)
  const shown = v.messages.slice(-4)
  const voice = v.mode === 'voice'
  const listening = voice && (v.state === 'listening' || v.state === 'user_speaking')
  useEffect(() => { if (log.current) log.current.scrollTop = log.current.scrollHeight }, [v.messages.length, v.messages[v.messages.length - 1]?.text])

  const ask = (q: string) => {
    const t = q.trim()
    if (!t) return
    soundManager.unlock()
    if (useVoiceStore.getState().mode === 'off') enableText()
    void submit(t)
    setText('')
  }
  return (
    <section className="wl-ai" aria-labelledby="wl-ai-title">
      <div className="wl-ai__head">
        <span className="wl-ai__avatar" aria-hidden="true"><CompanionGlyph size={34} /></span>
        <div>
          <h2 id="wl-ai-title">Meet your AI Guide</h2>
          <p>Ask about Naveen, explore projects, or find your way around.</p>
        </div>
      </div>
      {shown.length > 0 && (
        <ol className="wl-ai__log" ref={log} role="log" aria-live="polite" aria-label="Conversation">
          {shown.map((m) => (
            <li key={m.id} className={`is-${m.role}`}><span className="sr-only">{m.role === 'user' ? 'You said: ' : 'Guide: '}</span>{m.text}</li>
          ))}
        </ol>
      )}
      {v.consentOpen && !voice ? (
        <div className="wl-ai__consent" role="group" aria-label="Voice">
          <p>Voice mode uses your microphone so I can hear you. Your portfolio session doesn’t store your voice recordings. {v.canRealtime ? 'Live voice: your voice is processed live by the voice service.' : 'Browser voice: your browser turns each sentence into text and reads my answers aloud — turn by turn, not live speech-to-speech.'}</p>
          <div>
            <button className="ui-btn ui-btn--primary" onClick={() => void enableVoice()}>Turn on voice</button>
            <button className="ui-btn ui-btn--glass" onClick={() => useVoiceStore.getState().set({ consentOpen: false })}>Not now</button>
          </div>
        </div>
      ) : (
        <ul className="wl-ai__prompts" aria-label="Try asking">
          {/* once the conversation has started, a couple of next questions are enough */}
          {PROMPTS.slice(0, shown.length ? 2 : PROMPTS.length).map((q) => <li key={q}><button onClick={() => ask(q)}>{q}</button></li>)}
        </ul>
      )}
      <form className="wl-ai__compose" onSubmit={(e) => { e.preventDefault(); ask(text) }}>
        {v.canListen && (
          <button
            type="button"
            className={`wl-ai__mic ${listening ? 'is-live' : ''}`}
            onClick={() => { soundManager.unlock(); if (!voice) useVoiceStore.getState().set({ consentOpen: true }) }}
            aria-label={voice ? (listening ? 'Listening' : 'Voice is on') : 'Use voice (asks for the microphone)'}
            aria-pressed={voice}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3" /></svg>
          </button>
        )}
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={listening ? 'Listening… or type here' : 'Ask the AI Guide…'}
          aria-label="Message the AI guide"
          maxLength={400}
          enterKeyHint="send"
        />
        <button type="submit" className="wl-ai__send" aria-label="Send" disabled={!text.trim()}>
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h13m-5-6 6 6-6 6" /></svg>
        </button>
      </form>
    </section>
  )
}
