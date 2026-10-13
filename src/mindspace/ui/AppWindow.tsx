import { type ReactNode, useEffect, useRef } from 'react'
import { About, Contact, Education, Experience, Process, Skills } from '../apps/Content'
import { Gallery } from '../apps/Gallery'
import { Games } from '../apps/Games'
import { Projects } from '../apps/Projects'
import { type AppId, useMindspace } from '../store'
import { appDef } from './apps'

const CONTENT: Record<AppId, () => ReactNode> = {
  about: () => <About />,
  education: () => <Education />,
  experience: () => <Experience />,
  projects: () => <Projects />,
  gallery: () => <Gallery />,
  process: () => <Process />,
  skills: () => <Skills />,
  games: () => <Games />,
  contact: () => <Contact />,
}

/**
 * The floating application window. It grows out of the launcher icon that was
 * chosen (its centre is the animation origin), settles with a soft spring, and
 * shrinks back on close. One window at a time.
 */
export function AppWindow() {
  const app = useMindspace((s) => s.app)
  const origin = useMindspace((s) => s.origin)
  const closing = useMindspace((s) => s.closing)
  const finishClose = useMindspace((s) => s.finishClose)
  const close = useMindspace((s) => s.close)
  const ref = useRef<HTMLDivElement>(null)
  const lastFocus = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (app && !closing) {
      lastFocus.current = lastFocus.current ?? (document.activeElement as HTMLElement)
      setTimeout(() => ref.current?.querySelector<HTMLElement>('.ms-window__close')?.focus({ preventScroll: true }), 80)
    }
  }, [app, closing])
  useEffect(() => {
    if (!closing) return
    const t = setTimeout(() => {
      finishClose()
      lastFocus.current?.focus?.({ preventScroll: true })
      lastFocus.current = null
    }, 300)
    return () => clearTimeout(t)
  }, [closing, finishClose])

  if (!app) return null
  const def = appDef(app)
  const ox = origin ? origin.x - innerWidth / 2 : 0
  const oy = origin ? origin.y - innerHeight / 2 : 40
  return (
    <div className={`ms-window-layer ${closing ? 'is-closing' : ''}`} onPointerDown={(e) => { if (e.target === e.currentTarget) close() }}>
      <section
        ref={ref}
        className={`ms-window ms-window--${app}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="ms-window-title"
        style={{ ['--ox' as string]: `${ox}px`, ['--oy' as string]: `${oy}px` }}
      >
        <header className="ms-window__head">
          <span className="ms-window__app" style={{ background: def.face }} aria-hidden="true">{def.glyph}</span>
          <h1 id="ms-window-title">{def.title}</h1>
          <button className="ms-window__close" onClick={close} aria-label={`Close ${def.title}`}>
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6.5 6.5l11 11M17.5 6.5l-11 11" /></svg>
          </button>
        </header>
        {/* keyed by app: switching apps from inside a window starts the new one fresh */}
        <div className="ms-window__body" key={app}>{CONTENT[app]()}</div>
      </section>
    </div>
  )
}
