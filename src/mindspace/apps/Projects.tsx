import { useEffect, useRef, useState } from 'react'
import { PROJECTS, type ProjectDef } from '@/data/projects'
import { asset } from '@/utils/basePath'

/**
 * Projects: the real case studies from data/projects.ts (same order, same
 * Figma links). A grid of cards opens into one project's detail view.
 */
const Arrow = () => <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 17 17 7M9 7h8v8" /></svg>

export function Projects() {
  const [openId, setOpenId] = useState<string | null>(null)
  const top = useRef<HTMLDivElement>(null)
  const project = PROJECTS.find((p) => p.id === openId) ?? null
  useEffect(() => { top.current?.closest('.ms-window__body')?.scrollTo({ top: 0 }) }, [openId])

  return (
    <div className="ms-app" ref={top}>
      {project ? (
        <ProjectDetail p={project} onBack={() => setOpenId(null)} onStep={(id) => setOpenId(id)} />
      ) : (
        <>
          <p className="ms-intro-line">Selected UI/UX case studies — open one for the full story, its screens and the Figma links.</p>
          <ul className="ms-project-grid">
            {PROJECTS.map((p) => (
              <li key={p.id}>
                <button className="ms-project-card" onClick={() => setOpenId(p.id)} style={{ ['--accent' as string]: p.accent }}>
                  <span className="ms-project-card__img">
                    <img src={asset(p.screens[0].image)} alt="" loading="lazy" />
                  </span>
                  <span className="ms-project-card__text">
                    <small>{p.number} · {p.category}</small>
                    <b>{p.title}</b>
                    <span>{p.summary}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  )
}

function ProjectDetail({ p, onBack, onStep }: { p: ProjectDef; onBack: () => void; onStep: (id: string) => void }) {
  const i = PROJECTS.findIndex((x) => x.id === p.id)
  const prev = PROJECTS[(i - 1 + PROJECTS.length) % PROJECTS.length]
  const next = PROJECTS[(i + 1) % PROJECTS.length]
  const back = useRef<HTMLButtonElement>(null)
  useEffect(() => { back.current?.focus({ preventScroll: true }) }, [p.id])
  return (
    <article className="ms-project" style={{ ['--accent' as string]: p.accent }}>
      <button ref={back} className="ms-back-link" onClick={onBack}>
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 6l-6 6 6 6" /></svg> All projects
      </button>
      <header className="ms-project__head">
        <div>
          <p className="ms-eyebrow">{p.number} · {p.category}</p>
          <h2 className="ms-display ms-display--sm">{p.title}</h2>
          <p className="ms-lead">{p.summary}</p>
        </div>
        <div className="ms-actions">
          {p.prototypeUrl && <a className="ms-btn ms-btn--primary" href={p.prototypeUrl} target="_blank" rel="noopener noreferrer">View prototype <Arrow /></a>}
          {p.caseStudyUrl && <a className="ms-btn" href={p.caseStudyUrl} target="_blank" rel="noopener noreferrer">Case study <Arrow /></a>}
        </div>
      </header>
      <figure className="ms-shot ms-shot--hero">
        <img src={asset(p.screens[0].image)} alt={p.screens[0].alt} />
        <figcaption>{p.screens[0].caption}</figcaption>
      </figure>
      <div className="ms-project__cols">
        <section className="ms-block">
          <h3>Overview</h3>
          {p.overview.map((t, k) => <p key={k}>{t}</p>)}
        </section>
        <dl className="ms-info">
          <div><dt>Project</dt><dd>{p.fullTitle}</dd></div>
          <div><dt>Role</dt><dd>{p.role}</dd></div>
          <div><dt>Platform</dt><dd>{p.platform}</dd></div>
          <div><dt>Domain</dt><dd>{p.category}</dd></div>
          <div><dt>Scope</dt><dd>{p.scope}</dd></div>
        </dl>
      </div>
      <section className="ms-block">
        <h3>The challenge</h3>
        <p className="ms-lead">{p.challenge.headline}</p>
        <ol className="ms-numbered">
          {p.challenge.items.map((c) => <li key={c.title}><b>{c.title}</b><span>{c.text}</span></li>)}
        </ol>
        <blockquote className="ms-quote">{p.challenge.question}</blockquote>
      </section>
      <section className="ms-block">
        <h3>Approach</h3>
        <ul className="ms-ticks">{p.approach.map((a) => <li key={a}>{a}</li>)}</ul>
      </section>
      <section className="ms-block">
        <h3>Design decisions</h3>
        <ol className="ms-numbered">
          {p.decisions.map((c) => <li key={c.title}><b>{c.title}</b><span>{c.text}</span></li>)}
        </ol>
      </section>
      {p.screens.length > 1 && (
        <section className="ms-block">
          <h3>Key screens</h3>
          {p.screens.slice(1).map((s) => (
            <figure key={s.image} className="ms-shot">
              <img src={asset(s.image)} alt={s.alt} loading="lazy" />
              <figcaption>{s.caption}</figcaption>
            </figure>
          ))}
        </section>
      )}
      <nav className="ms-stepper" aria-label="Other projects">
        <button className="ms-btn" onClick={() => onStep(prev.id)}>← {prev.title}</button>
        <button className="ms-btn" onClick={() => onStep(next.id)}>{next.title} →</button>
      </nav>
    </article>
  )
}
