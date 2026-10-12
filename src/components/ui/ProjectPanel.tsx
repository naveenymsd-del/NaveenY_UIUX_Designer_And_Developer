import { type ReactNode, useEffect, useRef, useState } from 'react'
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

/** which part of the story a section belongs to — the AI guide still speaks of "overview" and "challenges" */
type Part = 'overview' | 'challenges'

/**
 * Case-study presentation, editorial style: a wide panel on the right half of
 * the screen (the studio stays visible on the left). A header that stays put —
 * category, title, one-line descriptor, the Figma links and Close — over one
 * scrolling story: overview, project information, challenge, objective, design
 * approach and the final screens. Only what the project data verifies is shown.
 */
export function ProjectPanel() {
  const id = useGameStore((s) => s.activeProjectId)
  const mode = useGameStore((s) => s.mode)
  const interior = useGameStore((s) => s.interior)
  const open = useGameStore((s) => s.openProject)
  const close = useGameStore((s) => s.closePanels)
  const [shown, setShown] = useState<ProjectDef | null>(null)
  const [visible, setVisible] = useState(false)
  const [condensed, setCondensed] = useState(false)
  const closeRef = useRef<HTMLButtonElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  // the AI guide can jump to a part of the story ("show me the challenge")
  useEffect(() => onGuideEvent('showSection', (section) => {
    const el = scrollRef.current
    if (!el) return
    caseView.section = section
    const target = section === 'challenges' ? el.querySelector<HTMLElement>('#case-s-challenge') : null
    el.scrollTo({ top: target ? target.offsetTop - 8 : 0, behavior: 'smooth' })
  }), [])

  useEffect(() => {
    if (id) {
      setVisible(false)
      const t0 = setTimeout(() => {
        setShown(getProject(id))
        setCondensed(false)
        caseView.section = 'overview'
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
  const zoom = (image: string) => {
    const i = GALLERY.findIndex((g) => g.image === image)
    if (i >= 0) {
      soundManager.play('open')
      useGallery.getState().open(i)
    }
  }
  // the header tightens once the story scrolls; the guide follows which part is on screen
  const onScroll = () => {
    const el = scrollRef.current
    if (!el) return
    setCondensed(el.scrollTop > 24)
    let part: Part = 'overview'
    for (const s of el.querySelectorAll<HTMLElement>('[data-part]')) if (s.offsetTop - el.scrollTop < 140) part = s.dataset.part as Part
    caseView.section = part
  }
  const inStudio = interior === 'office'
  const [hero, ...more] = shown.screens

  return (
    <>
      <div className={`ui-case-scrim ui-case-scrim--editorial ${visible ? 'is-visible' : ''}`} aria-hidden="true" />
      <aside
        className={`ui-case ui-case--editorial ${visible ? 'is-visible' : ''} ${condensed ? 'is-condensed' : ''}`}
        role="dialog"
        aria-labelledby="case-title"
        aria-describedby="case-desc"
        style={{ ['--accent' as string]: shown.accent }}
      >
        <header className="ui-case__head">
          <div className="ui-case__headtext">
            <p className="ui-case__kicker">
              <span className="ui-case__num">{shown.number}</span>
              <span>{shown.category}</span>
            </p>
            <div className="ui-case__titlerow">
              <h2 id="case-title" className="ui-case__title">{shown.title}</h2>
              <div className="ui-case__actions">
                {shown.prototypeUrl && (
                  <a className="ui-case__proto ui-pc-btn ui-pc-btn--primary" href={shown.prototypeUrl} target="_blank" rel="noopener noreferrer" aria-label={`View the ${shown.title} UI prototype in Figma (opens in a new tab)`}>
                    View prototype <Arrow />
                  </a>
                )}
                {shown.caseStudyUrl && (
                  <a className="ui-case__proto ui-case__proto--case ui-pc-btn" href={shown.caseStudyUrl} target="_blank" rel="noopener noreferrer" aria-label={`View the full ${shown.title} case study in Figma (opens in a new tab)`}>
                    Case study <Arrow />
                  </a>
                )}
              </div>
            </div>
            <p id="case-desc" className="ui-case__desc">{shown.summary}</p>
          </div>
          <button ref={closeRef} className="ui-case__close ui-pc-btn" onClick={onClose} aria-label="Close project">
            Close
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" /></svg>
          </button>
        </header>

        <div className="ui-case__scroll" ref={scrollRef} key={shown.id} onScroll={onScroll} tabIndex={0} aria-label={`${shown.title} case study`}>
          {hero && <Shot s={hero} onZoom={zoom} hero />}

          <Row id="case-s-overview" label="Project overview" part="overview">
            {shown.overview.map((para, i) => <p key={i}>{para}</p>)}
          </Row>

          <Row id="case-s-info" label="Project information" part="overview">
            <dl className="ui-pc-info">
              <div><dt>Project</dt><dd>{shown.fullTitle}</dd></div>
              <div><dt>Role</dt><dd>{shown.role}</dd></div>
              <div><dt>Platform</dt><dd>{shown.platform}</dd></div>
              <div><dt>Domain</dt><dd>{shown.category}</dd></div>
              <div><dt>Scope</dt><dd>{shown.scope}</dd></div>
            </dl>
          </Row>

          <Row id="case-s-challenge" label="Challenge" part="challenges">
            <p className="ui-pc-lead">{shown.challenge.headline}</p>
            <ol className="ui-pc-list">
              {shown.challenge.items.map((c) => <li key={c.title}><b>{c.title}</b><p>{c.text}</p></li>)}
            </ol>
          </Row>

          <Row id="case-s-objective" label="Objective" part="challenges">
            <p className="ui-pc-lead">{shown.challenge.question}</p>
            <div className="ui-pc-users">
              {shown.users.map((u) => (
                <div key={u.name}>
                  <b>{u.name}</b>
                  <small>{u.who}</small>
                  <ul>{u.needs.map((x) => <li key={x}>{x}</li>)}</ul>
                </div>
              ))}
            </div>
          </Row>

          <Row id="case-s-approach" label="Design approach" part="overview">
            <ul className="ui-pc-ticks">
              {shown.approach.map((a) => <li key={a}>{a}</li>)}
            </ul>

            <h4>Key user flows</h4>
            {shown.flows.map((f) => (
              <div key={f.title} className="ui-pc-flow">
                <b>{f.title}</b>
                <ol aria-label={`${f.title} flow`}>{f.steps.map((s) => <li key={s}>{s}</li>)}</ol>
              </div>
            ))}

            <h4>Information architecture</h4>
            <dl className="ui-pc-ia">
              {shown.ia.map((it) => <div key={it.title}><dt>{it.title}</dt><dd>{it.text}</dd></div>)}
            </dl>

            <h4>Design decisions</h4>
            <ol className="ui-pc-list">
              {shown.decisions.map((c) => <li key={c.title}><b>{c.title}</b><p>{c.text}</p></li>)}
            </ol>

            <h4>UI &amp; design system</h4>
            <p>{shown.design.text}</p>
            <ul className="ui-pc-swatches" aria-label="Colour palette">
              {shown.design.colors.map((c) => (
                <li key={c.hex}><span style={{ background: c.hex }} aria-hidden="true" /><b>{c.name}</b><small>{c.hex}</small></li>
              ))}
            </ul>
            <p className="ui-pc-note"><span>Type</span>{shown.design.type}</p>
            <ul className="ui-pc-chips" aria-label="Components">
              {shown.design.components.map((c) => <li key={c}>{c}</li>)}
            </ul>
          </Row>

          {more.length > 0 && (
            <Row id="case-s-final" label="Final design" part="overview" wide>
              <div className="ui-pc-shots">{more.map((s) => <Shot key={s.image} s={s} onZoom={zoom} />)}</div>
            </Row>
          )}

          {(shown.prototypeUrl || shown.caseStudyUrl) && (
            <div className="ui-pc-end">
              <p>Explore the full story</p>
              <div className="ui-case__ctas">
                {shown.prototypeUrl && (
                  <a className="ui-case__cta ui-pc-btn ui-pc-btn--primary" href={shown.prototypeUrl} target="_blank" rel="noopener noreferrer" aria-label={`View the ${shown.title} UI prototype in Figma (opens in a new tab)`}>
                    View prototype <Arrow />
                  </a>
                )}
                {shown.caseStudyUrl && (
                  <a className="ui-case__cta ui-case__cta--case ui-pc-btn" href={shown.caseStudyUrl} target="_blank" rel="noopener noreferrer" aria-label={`View the full ${shown.title} case study in Figma (opens in a new tab)`}>
                    Case study <Arrow />
                  </a>
                )}
              </div>
            </div>
          )}
        </div>

        <footer className="ui-case__foot">
          {many && (
            <button className="ui-case__step" onClick={() => step(prev)} aria-label={`Previous project: ${prev.title}`}>
              <span aria-hidden="true">←</span> {prev.title}
            </button>
          )}
          <span className="ui-case__count">
            {inStudio && <button className="ui-case__walk" onClick={onClose}>Back to Project Studio</button>}
            {mode === 'projects' && <button className="ui-case__walk" onClick={walk}>Walk to this pavilion</button>}
            {!inStudio && mode !== 'projects' && <>{shown.number} / {String(PROJECTS.length).padStart(2, '0')}</>}
          </span>
          {many && (
            <button className="ui-case__step" onClick={() => step(next)} aria-label={`Next project: ${next.title}`}>
              {next.title} <span aria-hidden="true">→</span>
            </button>
          )}
        </footer>
      </aside>
    </>
  )
}

function Arrow() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 17 17 7M9 7h8v8" /></svg>
}

/** one editorial row: the label on the left, the story on the right (stacked on narrow panels) */
function Row({ id, label, part, wide, children }: { id: string; label: string; part: Part; wide?: boolean; children: ReactNode }) {
  return (
    <section className={`ui-pc-row ${wide ? 'is-wide' : ''}`} id={id} data-part={part} aria-labelledby={`${id}-h`}>
      <h3 id={`${id}-h`}>{label}</h3>
      <div className="ui-pc-body">{children}</div>
    </section>
  )
}

/** a real project screen, at its own aspect ratio; opens large in the gallery */
function Shot({ s, onZoom, hero }: { s: ProjectDef['screens'][number]; onZoom: (image: string) => void; hero?: boolean }) {
  return (
    <figure className={`ui-pc-shot ${hero ? 'is-hero' : ''}`}>
      <button onClick={() => onZoom(s.image)} aria-label={`Enlarge: ${s.caption}`}>
        <img src={asset(s.image)} alt={s.alt} loading={hero ? 'eager' : 'lazy'} />
      </button>
      <figcaption>{s.caption}</figcaption>
    </figure>
  )
}
