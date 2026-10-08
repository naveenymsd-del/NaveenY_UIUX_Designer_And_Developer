import { useEffect, useRef } from 'react'
import { navigateToLocation } from '@/core/navigation'
import { STORY_STOPS, type StopId } from '@/data/world'
import { soundManager } from '@/core/sound/SoundManager'
import { AI_WORKFLOW, PROFILE } from '@/data/portfolioContent'
import { type Place, useGameStore } from '@/stores/gameStore'
import { type MenuSection, useUIStore } from '@/stores/uiStore'
import { ContactLinks } from './ContactLinks'
import { FeedbackForm } from './FeedbackForm'

type Item =
  | { kind: 'section'; id: MenuSection; label: string; hint: string }
  | { kind: 'stop'; stop: StopId; label: string; hint: string; place: Place }

// the journey stops come straight from the one location config
const ITEMS: Item[] = [
  { kind: 'section', id: 'about', label: 'About', hint: 'Who Naveen is' },
  ...STORY_STOPS.map<Item>((st) => ({ kind: 'stop', stop: st.id, label: st.name, hint: st.line, place: st.place! })),
  { kind: 'section', id: 'workflow', label: 'AI Workflow', hint: 'AI helps me explore' },
  { kind: 'section', id: 'contact', label: 'Contact', hint: 'Say hello' },
  { kind: 'section', id: 'feedback', label: 'Feedback', hint: 'Tell me what you think' },
]

const JOURNEY = STORY_STOPS.map((st) => ({ place: st.place!, label: st.name }))

/** Full-screen menu: large navigation on the left, the selected section on the right. */
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

  const choose = (it: Item) => {
    soundManager.play('click')
    useGameStore.getState().firePulse('select')
    if (it.kind === 'section') return setSection(it.id)
    setOpen(false)
    navigateToLocation(it.stop)
  }

  const tab = open ? 0 : -1
  const seen = JOURNEY.filter((j) => discovered.includes(j.place)).length

  return (
    <div id="site-menu" className={`ui-menu ${open ? 'is-open' : ''}`} aria-hidden={!open} role="dialog" aria-modal="true" aria-label="Site menu">
      <div className="ui-menu__backdrop" onClick={close} />
      <div className="ui-menu__panel" ref={panelRef}>
        <nav className="ui-menu__nav" aria-label="Main">
          <ol>
            {ITEMS.map((it, i) => {
              const active = it.kind === 'section' && section === it.id
              const done = it.kind === 'stop' && discovered.includes(it.place)
              return (
                <li key={it.label} style={{ transitionDelay: open ? `${70 + i * 40}ms` : '0ms' }}>
                  <button className={`ui-menu__item ${active ? 'is-active' : ''} ${done ? 'is-done' : ''}`} onClick={() => choose(it)} tabIndex={tab} onMouseEnter={() => soundManager.play('hover')}>
                    <span className="ui-menu__index">{String(i + 1).padStart(2, '0')}</span>
                    <span className="ui-menu__label">{it.label}</span>
                    <span className="ui-menu__hint">{it.kind === 'section' ? it.hint : `${it.hint} ↗`}</span>
                  </button>
                </li>
              )
            })}
          </ol>
        </nav>
        <section className="ui-menu__content" aria-live="polite">
          {section === 'places' && (
            <div className="ui-menu__section">
              <p className="ui-kicker">Your journey</p>
              <h2>{seen === 0 ? 'Where would you like to go?' : `${seen} of ${JOURNEY.length} discovered`}</h2>
              <p>Pick a place to travel there, or close the menu and keep walking — you can go in any order.</p>
              <ul className="ui-journey">
                {JOURNEY.map((j) => (
                  <li key={j.place} className={discovered.includes(j.place) ? 'is-done' : ''}>
                    <span aria-hidden="true" />
                    {j.label}
                    <span className="sr-only">{discovered.includes(j.place) ? ' — discovered' : ' — not yet visited'}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {section === 'about' && (
            <div className="ui-menu__section">
              <p className="ui-kicker">About</p>
              <h2>{PROFILE.fullName}</h2>
              <p className="ui-menu__lead">{PROFILE.role}</p>
              <p>{PROFILE.tagline}</p>
              <p>{PROFILE.summary} Based in {PROFILE.location}, at {PROFILE.companyFull} since May 2022.</p>
              <p>This neighbourhood is my portfolio as a place: my profile at home, my education on the campus, my projects in the Project Studio at NFC Solutions, a gallery in the park — and a coffee at the Contact Café.</p>
              <button className="ui-btn ui-btn--quiet" onClick={() => { setOpen(false); navigateToLocation('home') }} tabIndex={tab}>Visit my home ↗</button>
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
              <button className="ui-btn ui-btn--quiet" onClick={() => { setOpen(false); navigateToLocation('gallery') }} tabIndex={tab}>Visit the Gallery ↗</button>
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
