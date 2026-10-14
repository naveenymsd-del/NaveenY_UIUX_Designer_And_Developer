import { useEffect, useRef, useState } from 'react'
import { WORLD_STOPS } from '@/data/world'
import { skipIntro } from '@/core/intro'
import { beginJourney } from '@/core/journey'
import { soundManager } from '@/core/sound/SoundManager'
import { useGameStore } from '@/stores/gameStore'
import { onboardingDisabled, rememberOnboarding, useUIStore } from '@/stores/uiStore'
import { CompanionGlyph } from './CompanionGlyph'
import { KeyCap } from './KeyCap'
import { STOP_ICONS } from './stopIcons'

/** what each stop on the route is for */
const ROUTE_ABOUT: Record<string, string> = {
  start: 'Where every visit begins',
  home: 'Who Naveen is, skills and background',
  education: 'Where the design journey started',
  nfcSolutions: 'Professional experience and the workplace',
  projects: 'Selected UI/UX case studies',
  gallery: 'How Naveen approaches design',
  contactCafe: 'Say hello and get in touch',
}

const ASK = ['“Take me to Projects”', '“Tell me about the INTA project”', '“What tools does Naveen use?”']

/**
 * "How this world works" — a short, skimmable guide shown once before the
 * opening flight (and from the menu at any time): the route, the map, the AI
 * Guide and the controls. Shown over the loading cover, so it doubles as
 * something to read while the city finishes building.
 */
export function Onboarding() {
  const open = useUIStore((s) => s.onboarding)
  const isTouch = useUIStore((s) => s.isTouch)
  const phase = useGameStore((s) => s.phase)
  const loading = useGameStore((s) => s.loading)
  const [never, setNever] = useState(onboardingDisabled)
  const panel = useRef<HTMLDivElement>(null)
  const first = phase === 'loading'
  const ready = !first || (loading.fontsReady && loading.worldReady && loading.physicsReady && loading.compiled)

  useEffect(() => {
    if (!open) return
    const last = document.activeElement as HTMLElement | null
    return () => {
      if (!first) last?.focus?.()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])
  // the city finished building while they read: the way in becomes the focus
  useEffect(() => {
    if (!open) return
    const el = ready ? panel.current?.querySelector<HTMLElement>('.ob-enter') : panel.current
    setTimeout(() => el?.focus({ preventScroll: true }), 90)
  }, [open, ready])

  // Esc enters the city (or closes the reopened guide), wherever focus happens to be
  useEffect(() => {
    if (!open) return
    const onEsc = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      e.stopImmediatePropagation()
      e.preventDefault()
      closeRef.current(false)
    }
    window.addEventListener('keydown', onEsc, true)
    return () => window.removeEventListener('keydown', onEsc, true)
  }, [open])
  const closeRef = useRef<(free: boolean) => void>(() => {})

  if (!open) return null

  const close = (free: boolean) => {
    soundManager.unlock()
    soundManager.play('click')
    rememberOnboarding(never)
    useUIStore.getState().setOnboarding(false)
    if (!free || !first) return
    // "Explore without the guide": skip the opening flight and the hero, straight to walking
    const unsub = useGameStore.subscribe((s) => {
      if (s.phase !== 'intro') return
      unsub()
      skipIntro()
      setTimeout(() => beginJourney('street'), 60)
    })
  }
  closeRef.current = close
  // keep keyboard focus inside the dialog
  const onKey = (e: React.KeyboardEvent) => {
    e.stopPropagation()
    if (e.key !== 'Tab' || !panel.current) return
    const f = [...panel.current.querySelectorAll<HTMLElement>('button:not([disabled]), input, a[href]')]
    if (!f.length) return
    const a = f[0], z = f[f.length - 1]
    if (e.shiftKey && document.activeElement === a) { e.preventDefault(); z.focus() }
    else if (!e.shiftKey && document.activeElement === z) { e.preventDefault(); a.focus() }
  }

  return (
    <div className={`ob ${first ? 'is-first' : ''}`} role="dialog" aria-modal="true" aria-labelledby="ob-title" aria-describedby="ob-lead" onKeyDown={onKey}>
      <div className="ob-scrim" aria-hidden="true" />
      <div className="ob-panel" ref={panel} tabIndex={-1}>
        <header className="ob-head">
          <p className="ob-kicker">How this world works</p>
          <h1 id="ob-title">Welcome to <span className="ui-grad-text">Naveen’s World</span></h1>
          <p id="ob-lead">An interactive 3D city that tells Naveen’s story as a UI/UX designer. Walk it yourself, or let the AI Guide take you around.</p>
          {!first && (
            <button className="ag-icon ob-close" onClick={() => close(false)} aria-label="Close this guide">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6.5 6.5l11 11M17.5 6.5l-11 11" /></svg>
            </button>
          )}
        </header>

        <div className="ob-grid">
          <section className="ob-card ob-card--route" aria-labelledby="ob-route">
            <h2 id="ob-route"><span className="ob-num">1</span>Explore the city</h2>
            <p>Follow the story from place to place — in order, or wherever you like.</p>
            <ol className="ob-route">
              {WORLD_STOPS.map((s) => (
                <li key={s.id}>
                  <span className="ob-route__icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d={STOP_ICONS[s.icon]} /></svg></span>
                  <span><b>{s.name}</b><small>{ROUTE_ABOUT[s.id]}</small></span>
                </li>
              ))}
            </ol>
          </section>

          <section className="ob-card" aria-labelledby="ob-map">
            <h2 id="ob-map"><span className="ob-num">2</span>Understand the map</h2>
            <ul className="ob-list">
              <li><span className="ob-dot ob-dot--you" aria-hidden="true" />The mini-map in the corner shows where you are.</li>
              <li><span className="ob-dot ob-dot--next" aria-hidden="true" />The next-stop card shows where the story goes next — choose <b>Take me there</b>.</li>
              <li><span className="ob-dot ob-dot--menu" aria-hidden="true" />Open <b>Explore</b> in the top-right menu to see every place and walk to any of them.</li>
            </ul>
          </section>

          <section className="ob-card" aria-labelledby="ob-ai">
            <h2 id="ob-ai"><span className="ob-num">3</span>Meet the AI Guide</h2>
            <div className="ob-ai">
              <span className="ag-avatar" aria-hidden="true"><CompanionGlyph size={28} /></span>
              <p>Chat or talk with Naveen’s AI Guide — it answers questions and walks you to places. {isTouch ? 'Tap the guide button at the bottom right.' : 'Open it from the AI Guide button at the bottom left.'}</p>
            </div>
            <p className="ob-try">Try asking:</p>
            <ul className="ob-asks">{ASK.map((a) => <li key={a}>{a}</li>)}</ul>
          </section>

          <section className="ob-card" aria-labelledby="ob-keys">
            <h2 id="ob-keys"><span className="ob-num">4</span>Learn the controls</h2>
            {isTouch ? (
              <ul className="ob-keys">
                <li><span className="ob-key-art" aria-hidden="true">◎</span><span>Joystick (bottom left) to walk</span></li>
                <li><span className="ob-key-art" aria-hidden="true">↔</span><span>Drag the view to look around</span></li>
                <li><span className="ob-key-art" aria-hidden="true">⤢</span><span>Pinch to zoom</span></li>
                <li><span className="ob-key-art" aria-hidden="true">✦</span><span>Tap a glowing sign or door to open it</span></li>
              </ul>
            ) : (
              <ul className="ob-keys">
                <li><span className="ob-caps"><KeyCap k="W" /><KeyCap k="A" /><KeyCap k="S" /><KeyCap k="D" /></span><span>or arrow keys to walk</span></li>
                <li><span className="ob-caps"><KeyCap k="Shift" wide /></span><span>Run</span></li>
                <li><span className="ob-caps"><KeyCap k="Space" wide /></span><span>Jump</span></li>
                <li><span className="ob-caps"><KeyCap k="E" /><KeyCap k="Enter" wide /></span><span>Open a place or sign</span></li>
                <li><span className="ob-caps"><KeyCap k="Drag" wide /></span><span>Look around · scroll to zoom</span></li>
                <li><span className="ob-caps"><KeyCap k="Esc" wide /></span><span>Close panels and menus</span></li>
              </ul>
            )}
          </section>
        </div>

        <footer className="ob-foot">
          <label className="ob-never">
            <input type="checkbox" checked={never} onChange={(e) => setNever(e.target.checked)} />
            <span>Don’t show this guide again</span>
          </label>
          <div className="ob-actions">
            {first && (
              <button className="ui-btn ui-btn--glass ui-btn--lg" onClick={() => close(true)} disabled={!ready}>
                Explore Without the Guide
              </button>
            )}
            <button className="ui-btn ui-btn--primary ui-btn--lg ob-enter" onClick={() => close(false)} disabled={!ready} aria-label={ready ? undefined : 'Preparing the city…'}>
              {ready ? (first ? 'Enter the City' : 'Back to the City') : 'Preparing the city…'}
              {ready && <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h13m-5-6 6 6-6 6" /></svg>}
            </button>
          </div>
        </footer>
      </div>
    </div>
  )
}
