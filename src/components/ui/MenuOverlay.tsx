import { useEffect, useRef } from 'react'
import { STORY_STOPS, type StopId } from '@/data/world'
import { soundManager } from '@/core/sound/SoundManager'
import { AI_WORKFLOW, PROFILE } from '@/data/portfolioContent'
import { submit, walkTo } from '@/ai/guide'
import { useVoiceStore } from '@/ai/voiceStore'
import { currentLocation } from '@/ai/worldState'
import { useGameStore } from '@/stores/gameStore'
import { type MenuSection, useUIStore } from '@/stores/uiStore'
import { ContactLinks } from './ContactLinks'
import { FeedbackForm } from './FeedbackForm'
import { STOP_ICONS } from './stopIcons'

/** what each place is for, in a few words */
const ABOUT: Record<string, string> = {
  home: 'About me, skills & background',
  education: 'Where the journey began',
  nfcSolutions: 'Professional experience & workplace',
  projects: 'Selected UI/UX projects',
  gallery: 'How I approach design',
  contactCafe: 'Let’s talk',
}
const NAME: Partial<Record<StopId, string>> = { projects: 'Project Studio' }
/** where the visitor is → the stop it belongs to */
const STOP_AT: Record<string, StopId> = { home: 'home', education: 'education', office: 'nfcSolutions', projects: 'projects', gallery: 'gallery', contact: 'contactCafe' }

const SECTIONS: { id: MenuSection; label: string }[] = [
  { id: 'about', label: 'About' },
  { id: 'workflow', label: 'AI Workflow' },
  { id: 'contact', label: 'Contact' },
  { id: 'feedback', label: 'Feedback' },
]

/**
 * Explore Naveen's world: every place at a glance — what it is, where you
 * are, what you've seen — and "Take me there", which walks you there through
 * the world (never a teleport). The guide narrates the arrival.
 */
export function MenuOverlay() {
  const open = useUIStore((s) => s.menuOpen)
  const section = useUIStore((s) => s.menuSection)
  const setSection = useUIStore((s) => s.setMenuSection)
  const setOpen = useUIStore((s) => s.setMenuOpen)
  const discovered = useGameStore((s) => s.discovered)
  const panelRef = useRef<HTMLDivElement>(null)
  const lastFocus = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (open) {
      lastFocus.current = document.activeElement as HTMLElement
      setTimeout(() => panelRef.current?.querySelector<HTMLElement>('button, a')?.focus(), 60)
    } else lastFocus.current?.focus?.()
  }, [open])

  const close = () => {
    soundManager.play('close', { volume: 0.6 })
    setOpen(false)
  }
  const go = (stop: StopId) => {
    soundManager.play('click')
    useGameStore.getState().firePulse('select')
    setOpen(false)
    walkTo(stop)
  }
  const guideMe = () => {
    soundManager.play('click')
    setOpen(false)
    if (useVoiceStore.getState().mode === 'off') useVoiceStore.getState().set({ mode: 'text', tier: 'text', state: 'idle' })
    void submit('Guide me')
  }

  const tab = open ? 0 : -1
  const here = open ? STOP_AT[currentLocation().startsWith('project:') ? 'projects' : currentLocation()] : undefined
  const seen = STORY_STOPS.filter((s) => discovered.includes(s.place!)).length

  return (
    <div id="site-menu" className={`ui-menu ui-menu--explore ${open ? 'is-open' : ''}`} aria-hidden={!open} role="dialog" aria-modal="true" aria-label="Explore Naveen’s world">
      <div className="ui-menu__backdrop" onClick={close} />
      <div className="ui-menu__panel" ref={panelRef}>
        <nav className="ui-menu__nav" aria-label="Places">
          <p className="ui-explore__kicker">Explore Naveen’s world</p>
          <ol className="ui-explore">
            {STORY_STOPS.map((st, i) => {
              const isHere = here === st.id
              const done = discovered.includes(st.place!)
              return (
                <li key={st.id} style={{ transitionDelay: open ? `${60 + i * 40}ms` : '0ms' }}>
                  <button
                    className={`ui-explore__item ${isHere ? 'is-here' : ''} ${done ? 'is-done' : ''}`}
                    onClick={() => go(st.id)}
                    tabIndex={tab}
                    onMouseEnter={() => soundManager.play('hover')}
                    aria-label={`${NAME[st.id] ?? st.name}: ${ABOUT[st.id]}.${isHere ? ' You are here.' : ' Take me there.'}`}
                  >
                    <span className="ui-explore__icon" aria-hidden="true">
                      <svg viewBox="0 0 24 24"><path d={STOP_ICONS[st.icon]} /></svg>
                    </span>
                    <span className="ui-explore__text">
                      <span className="ui-explore__name"><i>{String(i + 1).padStart(2, '0')}</i>{NAME[st.id] ?? st.name}</span>
                      <span className="ui-explore__about">{ABOUT[st.id]}</span>
                    </span>
                    <span className="ui-explore__go" aria-hidden="true">{isHere ? 'You’re here' : 'Take me there →'}</span>
                  </button>
                </li>
              )
            })}
          </ol>
          <div className="ui-explore__more">
            {SECTIONS.map((s) => (
              <button key={s.id} className={section === s.id ? 'is-active' : ''} onClick={() => { soundManager.play('click'); setSection(s.id) }} tabIndex={tab}>{s.label}</button>
            ))}
          </div>
        </nav>
        <section className="ui-menu__content" aria-live="polite">
          {section === 'places' && (
            <div className="ui-menu__section">
              <p className="ui-kicker">Three ways to explore</p>
              <h2>{seen === 0 ? 'Where would you like to go?' : `${seen} of ${STORY_STOPS.length} places discovered`}</h2>
              <p>Pick a place and I’ll walk you there. Or walk yourself with the joystick or the keys — or ask the AI guide anything.</p>
              <button className="ui-btn ui-btn--primary" onClick={guideMe} tabIndex={tab}>Guide me through everything</button>
            </div>
          )}
          {section === 'about' && (
            <div className="ui-menu__section">
              <p className="ui-kicker">About</p>
              <h2>{PROFILE.fullName}</h2>
              <p className="ui-menu__lead">{PROFILE.role}</p>
              <p>{PROFILE.tagline}</p>
              <p>{PROFILE.summary} Based in {PROFILE.location}, at {PROFILE.companyFull} since May 2022.</p>
              <p>This neighbourhood is my portfolio as a place: my profile at home, my education on the campus, my projects in the Project Studio at NFC Solutions, my design journey in the park — and a coffee at the Contact Café.</p>
              <button className="ui-btn ui-btn--quiet" onClick={() => go('home')} tabIndex={tab}>Visit my home ↗</button>
            </div>
          )}
          {section === 'workflow' && (
            <div className="ui-menu__section">
              <p className="ui-kicker">AI Workflow</p>
              <h2>AI helps me explore. I make the design decisions.</h2>
              <ol className="ui-flow">
                {AI_WORKFLOW.map((s) => <li key={s.n} className={s.human ? 'is-human' : ''}>{s.title}</li>)}
              </ol>
              <p className="ui-menu__note">AI accelerates exploration. Human judgment drives the final experience.</p>
              <button className="ui-btn ui-btn--quiet" onClick={() => go('gallery')} tabIndex={tab}>Visit the Design Journey ↗</button>
            </div>
          )}
          {section === 'contact' && (
            <div className="ui-menu__section">
              <p className="ui-kicker">Contact</p>
              <h2>Let’s talk.</h2>
              <p>{PROFILE.fullName} · {PROFILE.role} · {PROFILE.location}</p>
              <ContactLinks tabbable={open} />
            </div>
          )}
          {section === 'feedback' && (
            <div className="ui-menu__section">
              <p className="ui-kicker">Feedback</p>
              <h2>How was your visit?</h2>
              <FeedbackForm tabbable={open} />
            </div>
          )}
        </section>
      </div>
    </div>
  )
}

