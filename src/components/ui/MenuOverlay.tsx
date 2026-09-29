import { useEffect, useRef } from 'react'
import { Vector3 } from 'three'
import { navigate } from '@/app/routes'
import { requestTeleport } from '@/core/runtime'
import { soundManager } from '@/core/sound/SoundManager'
import { LOCATIONS } from '@/data/locations'
import { useGameStore } from '@/stores/gameStore'
import { type MenuSection, useUIStore } from '@/stores/uiStore'

const ITEMS: { id: MenuSection; label: string; hint: string }[] = [
  { id: 'home', label: 'Home', hint: 'Back to the street' },
  { id: 'about', label: 'About', hint: 'The mind behind the avenue' },
  { id: 'projects', label: 'Projects', hint: 'Five pavilions of work' },
  { id: 'workflow', label: 'AI Workflow', hint: 'How the work gets made' },
  { id: 'contact', label: 'Contact', hint: 'Say hello' },
]

const PLACES = LOCATIONS.filter((l) => l.action === 'OPEN_LOCATION')

/** Elegant full-screen menu: large navigation on the left, content on the right. */
export function MenuOverlay() {
  const open = useUIStore((s) => s.menuOpen)
  const section = useUIStore((s) => s.menuSection)
  const setSection = useUIStore((s) => s.setMenuSection)
  const setOpen = useUIStore((s) => s.setMenuOpen)
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

  const choose = (id: MenuSection) => {
    soundManager.play('click')
    useGameStore.getState().firePulse('select')
    if (id === 'home') {
      setOpen(false)
      useGameStore.getState().closePanels()
      navigate('/street')
      return
    }
    if (id === 'projects') {
      setOpen(false)
      navigate('/projects')
      return
    }
    setSection(id)
  }

  const travel = (id: string) => {
    const l = LOCATIONS.find((x) => x.id === id)
    if (!l) return
    soundManager.play('open')
    setOpen(false)
    navigate('/street')
    // place the player a few metres in front of the location, facing it
    const [x, , z] = l.position
    const [cx, , cz] = l.cameraTarget.position
    const dx = cx - x
    const dz = cz - z
    const len = Math.hypot(dx, dz) || 1
    const px = x + (dx / len) * 1.6
    const pz = z + (dz / len) * 1.6
    requestTeleport(new Vector3(px, 0.6, pz), Math.atan2(-dx, -dz))
  }

  return (
    <div id="site-menu" className={`ui-menu ${open ? 'is-open' : ''}`} aria-hidden={!open} role="dialog" aria-modal="true" aria-label="Site menu">
      <div className="ui-menu__backdrop" onClick={close} />
      <div className="ui-menu__panel" ref={panelRef}>
        <nav className="ui-menu__nav" aria-label="Main">
          <ol>
            {ITEMS.map((it, i) => (
              <li key={it.id} style={{ transitionDelay: open ? `${80 + i * 55}ms` : '0ms' }}>
                <button className={`ui-menu__item ${section === it.id ? 'is-active' : ''}`} onClick={() => choose(it.id)} tabIndex={open ? 0 : -1} onMouseEnter={() => soundManager.play('hover')}>
                  <span className="ui-menu__index">0{i + 1}</span>
                  <span className="ui-menu__label">{it.label}</span>
                  <span className="ui-menu__hint">{it.hint}</span>
                </button>
              </li>
            ))}
          </ol>
        </nav>
        <section className="ui-menu__content" aria-live="polite">
          {section === 'about' && (
            <div className="ui-menu__section">
              <p className="ui-kicker">About</p>
              <h2>Thinking, made walkable.</h2>
              <p>Mindscape Avenue is what a portfolio looks like from the inside of a designer’s head: a street where ideas take a walk. It is a portfolio you can walk: every building holds a piece of the practice, from research at the café to finished work in the plaza.</p>
              <p>Design, art direction and creative development, with an obsession for small details and calm interfaces.</p>
            </div>
          )}
          {section === 'workflow' && (
            <div className="ui-menu__section">
              <p className="ui-kicker">AI Workflow</p>
              <h2>Human taste, machine speed.</h2>
              <ol className="ui-steps">
                <li><b>Research</b><span>Interviews and references, summarised and clustered with AI assistants.</span></li>
                <li><b>Explore</b><span>Rapid concept boards and prompt-driven variations, curated by hand.</span></li>
                <li><b>Build</b><span>Production code and 3D pipelines, pair-programmed and reviewed.</span></li>
                <li><b>Refine</b><span>Every pixel checked by a person before it ships.</span></li>
              </ol>
            </div>
          )}
          {section === 'contact' && (
            <div className="ui-menu__section">
              <p className="ui-kicker">Contact</p>
              <h2>Let’s build something.</h2>
              <p>Open for collaborations, commissions and interesting problems.</p>
              <div className="ui-contact">
                <a className="ui-btn ui-btn--primary" href="mailto:hello@example.com" tabIndex={open ? 0 : -1}>hello@example.com</a>
                <a className="ui-btn ui-btn--glass" href="#linkedin" tabIndex={open ? 0 : -1}>LinkedIn</a>
                <a className="ui-btn ui-btn--glass" href="#dribbble" tabIndex={open ? 0 : -1}>Dribbble</a>
              </div>
            </div>
          )}
          {(section === 'home' || section === 'places' || section === 'projects') && (
            <div className="ui-menu__section">
              <p className="ui-kicker">Quick travel</p>
              <h2>Where to?</h2>
              <p>Jump straight to a place on the street.</p>
            </div>
          )}
          <div className="ui-menu__places">
            {PLACES.map((p) => (
              <button key={p.id} className="ui-place" onClick={() => travel(p.id)} tabIndex={open ? 0 : -1} style={{ ['--accent' as string]: p.accent }}>
                <span className="ui-place__dot" />
                <span>
                  <b>{p.name}</b>
                  <small>{p.kicker}</small>
                </span>
              </button>
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}
