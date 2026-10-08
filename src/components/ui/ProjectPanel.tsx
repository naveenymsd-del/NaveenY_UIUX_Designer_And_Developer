import { type KeyboardEvent, useEffect, useRef, useState } from 'react'
import { Vector3 } from 'three'
import { navigate } from '@/app/routes'
import { requestTeleport } from '@/core/runtime'
import { soundManager } from '@/core/sound/SoundManager'
import { GALLERY } from '@/data/portfolioContent'
import { getProject, PROJECTS, type ProjectDef } from '@/data/projects'
import { useGameStore } from '@/stores/gameStore'
import { asset } from '@/utils/basePath'
import { useGallery } from './GalleryViewer'
import { caseView, onGuideEvent } from '@/ai/events'

type Tab = 'overview' | 'challenges'
const TABS: { id: Tab; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'challenges', label: 'Challenges' },
]

/**
 * Case-study presentation. It slides in beside the project's studio screen
 * (the camera frames the screen on the left, the rest of the room dims):
 * the title with its prototype link beside it, role · platform · domain,
 * then two tabs — Overview (approach, flows, IA, design system, screens)
 * and Challenges (the challenge, who it serves, design decisions).
 */
export function ProjectPanel() {
  const id = useGameStore((s) => s.activeProjectId)
  const mode = useGameStore((s) => s.mode)
  const interior = useGameStore((s) => s.interior)
  const open = useGameStore((s) => s.openProject)
  const close = useGameStore((s) => s.closePanels)
  const [shown, setShown] = useState<ProjectDef | null>(null)
  const [visible, setVisible] = useState(false)
  const [tab, setTab] = useState<Tab>('overview')
  const closeRef = useRef<HTMLButtonElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([])

  // the guide knows which tab is on screen ("explain" means this tab)
  useEffect(() => { caseView.section = tab }, [tab])
  // the AI guide can switch tabs ("show me the challenge")
  useEffect(() => onGuideEvent('showSection', (section) => {
    setTab(section)
    scrollRef.current?.scrollTo({ top: 0 })
  }), [])

  useEffect(() => {
    if (id) {
      setVisible(false)
      const t0 = setTimeout(() => {
        setShown(getProject(id))
        setTab('overview')
      }, shown ? 200 : 0)
      const t = setTimeout(() => {
        setVisible(true)
        closeRef.current?.focus({ preventScroll: true })
      }, 700)
      return () => {
        clearTimeout(t0)
        clearTimeout(t)
      }
    }
    setVisible(false)
    const t = setTimeout(() => setShown(null), 500)
    return () => clearTimeout(t)
  }, [id])

  if (!shown) return <div className="ui-case-scrim" aria-hidden="true" />
  const idx = PROJECTS.findIndex((p) => p.id === shown.id)
  const prev = PROJECTS[(idx - 1 + PROJECTS.length) % PROJECTS.length]
  const next = PROJECTS[(idx + 1) % PROJECTS.length]
  const many = PROJECTS.length > 1
  const step = (p: ProjectDef) => {
    soundManager.play('click')
    open(p.id)
  }
  const onClose = () => {
    soundManager.play('close')
    close()
  }
  const walk = () => {
    soundManager.play('open')
    close()
    navigate('/street')
    const [x, , z] = shown.position
    requestTeleport(new Vector3(x + Math.sin(shown.yaw) * 3.4, 0.6, z + Math.cos(shown.yaw) * 3.4), shown.yaw + Math.PI)
  }
  const choose = (t: Tab) => {
    if (t === tab) return
    soundManager.play('click')
    setTab(t)
    scrollRef.current?.scrollTo({ top: 0 })
  }
  // arrow keys move between tabs (WAI-ARIA tabs pattern)
  const onTabKey = (e: KeyboardEvent) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return
    e.preventDefault()
    e.stopPropagation()
    const i = (TABS.findIndex((t) => t.id === tab) + (e.key === 'ArrowRight' ? 1 : -1) + TABS.length) % TABS.length
    choose(TABS[i].id)
    tabRefs.current[i]?.focus()
  }
  const zoom = (image: string) => {
    const i = GALLERY.findIndex((g) => g.image === image)
    if (i >= 0) {
      soundManager.play('open')
      useGallery.getState().open(i)
    }
  }
  const inStudio = interior === 'office'
  const where = inStudio ? 'Project Studio · NFC Solutions' : 'Project pavilion'
  const n = (i: number) => String(i + 1).padStart(2, '0')

  return (
    <>
      <div className={`ui-case-scrim ${visible ? 'is-visible' : ''}`} aria-hidden="true" />
      <aside
        className={`ui-case ui-case--story ${visible ? 'is-visible' : ''}`}
        role="dialog"
        aria-labelledby="case-title"
        aria-describedby="case-desc"
        style={{ ['--accent' as string]: shown.accent }}
      >
        <header className="ui-case__head">
          <p className="ui-case__kicker">
            <span className="ui-case__num">{shown.number}</span>
            {where}
          </p>
          <button ref={closeRef} className="ui-case__close" onClick={onClose} aria-label="Close project">
            Close
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" /></svg>
          </button>
        </header>

        <div className="ui-case__top">
          <div className="ui-case__titlerow">
            <h2 id="case-title" className="ui-case__title">{shown.title}</h2>
            <div className="ui-case__actions">
              {shown.prototypeUrl && (
                <a className="ui-case__proto" href={shown.prototypeUrl} target="_blank" rel="noopener noreferrer" aria-label={`View the ${shown.title} UI prototype in Figma (opens in a new tab)`}>
                  View prototype
                  <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 17 17 7M9 7h8v8" /></svg>
                </a>
              )}
              <a className="ui-case__proto ui-case__proto--case" href={shown.caseStudyUrl} target="_blank" rel="noopener noreferrer" aria-label={`View the full ${shown.title} case study in Figma (opens in a new tab)`}>
                Case study
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 17 17 7M9 7h8v8" /></svg>
              </a>
            </div>
          </div>
          <p className="ui-case__cat">{shown.role} · {shown.platform} · {shown.category}</p>

          <div className="ui-case__tabs ui-case__tabs--two" role="tablist" aria-label={`${shown.title} case study sections`} onKeyDown={onTabKey}>
            {TABS.map((t, i) => (
              <button
                key={t.id}
                ref={(b) => { tabRefs.current[i] = b }}
                id={`case-tab-${t.id}`}
                role="tab"
                aria-selected={tab === t.id}
                aria-controls={`case-panel-${t.id}`}
                tabIndex={tab === t.id ? 0 : -1}
                className={tab === t.id ? 'is-active' : ''}
                onClick={() => choose(t.id)}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <div className="ui-case__scroll" ref={scrollRef} key={`${shown.id}-${tab}`} tabIndex={0} aria-label={`${shown.title} case study`}>
          <p id="case-desc" className="ui-case__lead">{shown.summary}</p>

          {tab === 'overview' && (
            <div className="ui-case__panel" role="tabpanel" id="case-panel-overview" aria-labelledby="case-tab-overview">
              <dl className="ui-case__meta">
                <div><dt>Project</dt><dd>{shown.fullTitle}</dd></div>
                <div><dt>My role</dt><dd>{shown.role}</dd></div>
                <div><dt>Platform</dt><dd>{shown.platform}</dd></div>
                <div><dt>Domain</dt><dd>{shown.category}</dd></div>
                <div><dt>Scope</dt><dd>{shown.scope}</dd></div>
              </dl>

              <section className="ui-case__section" aria-labelledby="case-s-overview">
                <h3 id="case-s-overview"><span>01</span> Project overview</h3>
                {shown.overview.map((para, i) => <p key={i}>{para}</p>)}
              </section>

              <section className="ui-case__section" aria-labelledby="case-s-approach">
                <h3 id="case-s-approach"><span>02</span> My approach</h3>
                <ul className="ui-case__ticks">
                  {shown.approach.map((a) => <li key={a}>{a}</li>)}
                </ul>
              </section>

              <section className="ui-case__section" aria-labelledby="case-s-flows">
                <h3 id="case-s-flows"><span>03</span> Key user flows</h3>
                {shown.flows.map((f) => (
                  <div key={f.title} className="ui-case__flow">
                    <b>{f.title}</b>
                    <ol aria-label={`${f.title} flow`}>
                      {f.steps.map((s) => <li key={s}>{s}</li>)}
                    </ol>
                  </div>
                ))}
              </section>

              <section className="ui-case__section" aria-labelledby="case-s-ia">
                <h3 id="case-s-ia"><span>04</span> Information architecture</h3>
                <dl className="ui-case__ia">
                  {shown.ia.map((it) => <div key={it.title}><dt>{it.title}</dt><dd>{it.text}</dd></div>)}
                </dl>
              </section>

              <section className="ui-case__section" aria-labelledby="case-s-ui">
                <h3 id="case-s-ui"><span>05</span> UI &amp; design system</h3>
                <p>{shown.design.text}</p>
                <ul className="ui-case__swatches" aria-label="Colour palette">
                  {shown.design.colors.map((c) => (
                    <li key={c.hex}>
                      <span style={{ background: c.hex }} aria-hidden="true" />
                      <b>{c.name}</b>
                      <small>{c.hex}</small>
                    </li>
                  ))}
                </ul>
                <p className="ui-case__type"><b>Type</b> {shown.design.type}</p>
                <ul className="ui-case__chips" aria-label="Components">
                  {shown.design.components.map((c) => <li key={c}>{c}</li>)}
                </ul>
              </section>

              <section className="ui-case__section" aria-labelledby="case-s-screens">
                <h3 id="case-s-screens"><span>06</span> Key screens</h3>
                <div className="ui-case__shots">
                  {shown.screens.map((s) => (
                    <figure key={s.image}>
                      <button onClick={() => zoom(s.image)} aria-label={`Enlarge: ${s.caption}`}>
                        <img src={asset(s.image)} alt={s.alt} loading="lazy" />
                      </button>
                      <figcaption>{s.caption}</figcaption>
                    </figure>
                  ))}
                </div>
              </section>
              <PrototypeCta p={shown} />
            </div>
          )}

          {tab === 'challenges' && (
            <div className="ui-case__panel" role="tabpanel" id="case-panel-challenges" aria-labelledby="case-tab-challenges">
              <section className="ui-case__section ui-case__section--first" aria-labelledby="case-s-challenge">
                <h3 id="case-s-challenge"><span>01</span> The challenge</h3>
                <p className="ui-case__headline">{shown.challenge.headline}</p>
                <ol className="ui-case__challenges">
                  {shown.challenge.items.map((c, i) => (
                    <li key={c.title} style={{ ['--i' as string]: i }}>
                      <span className="ui-case__cnum" aria-hidden="true">{n(i)}</span>
                      <div><b>{c.title}</b><p>{c.text}</p></div>
                    </li>
                  ))}
                </ol>
                <blockquote className="ui-case__hmw">{shown.challenge.question}</blockquote>
              </section>

              <section className="ui-case__section" aria-labelledby="case-s-users">
                <h3 id="case-s-users"><span>02</span> UX &amp; product thinking</h3>
                <div className="ui-case__users">
                  {shown.users.map((u) => (
                    <div key={u.name}>
                      <b>{u.name}</b>
                      <small>{u.who}</small>
                      <ul>{u.needs.map((x) => <li key={x}>{x}</li>)}</ul>
                    </div>
                  ))}
                </div>
              </section>

              <section className="ui-case__section" aria-labelledby="case-s-decisions">
                <h3 id="case-s-decisions"><span>03</span> Design decisions</h3>
                <ol className="ui-case__challenges">
                  {shown.decisions.map((c, i) => (
                    <li key={c.title} style={{ ['--i' as string]: i }}>
                      <span className="ui-case__cnum" aria-hidden="true">{n(i)}</span>
                      <div><b>{c.title}</b><p>{c.text}</p></div>
                    </li>
                  ))}
                </ol>
              </section>
              <PrototypeCta p={shown} />
            </div>
          )}
        </div>

        {many && (
          <footer className="ui-case__foot">
            <button className="ui-case__step" onClick={() => step(prev)} aria-label={`Previous project: ${prev.title}`}>
              <span aria-hidden="true">←</span> {prev.title}
            </button>
            <span className="ui-case__count">Project {shown.number} / {String(PROJECTS.length).padStart(2, '0')}</span>
            <button className="ui-case__step" onClick={() => step(next)} aria-label={`Next project: ${next.title}`}>
              {next.title} <span aria-hidden="true">→</span>
            </button>
          </footer>
        )}
        {inStudio && <button className="ui-btn ui-btn--quiet ui-case__walk" onClick={onClose}>← Back to Project Studio</button>}
        {mode === 'projects' && <button className="ui-btn ui-btn--quiet ui-case__walk" onClick={walk}>Walk to this pavilion</button>}
      </aside>
    </>
  )
}

/** closing cards: the clickable UI prototype and the full case study, both in Figma */
function PrototypeCta({ p }: { p: ProjectDef }) {
  const arrow = <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 17 17 7M9 7h8v8" /></svg>
  return (
    <div className="ui-case__ctas">
      {p.prototypeUrl && (
        <a className="ui-case__cta" href={p.prototypeUrl} target="_blank" rel="noopener noreferrer" aria-label={`View the ${p.title} UI prototype in Figma (opens in a new tab)`}>
          <span>
            <small>UI prototype</small>
            <b>Click through {p.title}</b>
          </span>
          {arrow}
        </a>
      )}
      <a className="ui-case__cta ui-case__cta--case" href={p.caseStudyUrl} target="_blank" rel="noopener noreferrer" aria-label={`View the full ${p.title} case study in Figma (opens in a new tab)`}>
        <span>
          <small>Case study</small>
          <b>The full story in Figma</b>
        </span>
        {arrow}
      </a>
    </div>
  )
}
