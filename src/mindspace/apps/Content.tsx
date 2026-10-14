import { AI_STORY, AI_TOOLS, AI_WORKFLOW, CERTIFICATION, CONTACT, EDUCATION, EXPERIENCE, INTERESTS, PROFILE, SKILL_GROUPS } from '@/data/portfolioContent'
import { asset } from '@/utils/basePath'
import { useMindspace } from '../store'

/**
 * The text-led applications. Every fact comes from data/portfolioContent.ts
 * (Naveen's résumé) — nothing here is invented or embellished.
 */

const Arrow = () => <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 17 17 7M9 7h8v8" /></svg>

export function About() {
  const swap = useMindspace((s) => s.swap)
  return (
    <div className="ms-app ms-about">
      <header className="ms-hero">
        <div className="ms-monogram" aria-hidden="true">{PROFILE.name[0]}</div>
        <div>
          <p className="ms-eyebrow">{PROFILE.role}</p>
          <h2 className="ms-display">{PROFILE.fullName}</h2>
          <p className="ms-lead">{PROFILE.tagline}</p>
          <div className="ms-actions">
            <button className="ms-btn ms-btn--primary" onClick={() => swap('projects')}>Explore projects</button>
            <button className="ms-btn" onClick={() => swap('contact')}>Contact me</button>
            {CONTACT.resume && <a className="ms-btn" href={asset(CONTACT.resume)} target="_blank" rel="noopener noreferrer">Résumé <Arrow /></a>}
          </div>
        </div>
      </header>
      <div className="ms-facts">
        <div><span>Experience</span><b>{PROFILE.experience}</b></div>
        <div><span>Specialisation</span><b>{PROFILE.specialization}</b></div>
        <div><span>Based in</span><b>{PROFILE.location}</b></div>
        <div><span>Currently</span><b>{EXPERIENCE.title}, {PROFILE.company}</b></div>
      </div>
      <section className="ms-block">
        <h3>Introduction</h3>
        <p>{PROFILE.about}</p>
        <p>{PROFILE.craft}</p>
      </section>
      <section className="ms-block">
        <h3>Design philosophy</h3>
        <blockquote className="ms-quote">{PROFILE.ai}</blockquote>
        <p>{AI_STORY.body}</p>
      </section>
      <section className="ms-block">
        <h3>Background</h3>
        <p>{PROFILE.summary}</p>
      </section>
      <section className="ms-block">
        <h3>Outside product design</h3>
        <ul className="ms-chips">{INTERESTS.map((i) => <li key={i}>{i}</li>)}</ul>
      </section>
    </div>
  )
}

export function Education() {
  return (
    <div className="ms-app">
      <p className="ms-intro-line">Master’s and bachelor’s degrees in Computer Science, and a UI/UX certification.</p>
      <ol className="ms-timeline">
        {EDUCATION.map((e) => (
          <li key={e.degree}>
            <span className="ms-timeline__when">{e.years}</span>
            <div className="ms-card">
              <p className="ms-eyebrow">{e.field}</p>
              <h3>{e.degree}</h3>
              <p className="ms-muted">{e.institution}, {e.place}</p>
              <p className="ms-tag">CGPA {e.cgpa}</p>
            </div>
          </li>
        ))}
        <li>
          <span className="ms-timeline__when">{CERTIFICATION.year}</span>
          <div className="ms-card">
            <p className="ms-eyebrow">Certification</p>
            <h3>{CERTIFICATION.title}</h3>
            <p className="ms-muted">{CERTIFICATION.issuer}</p>
          </div>
        </li>
      </ol>
    </div>
  )
}

export function Experience() {
  const swap = useMindspace((s) => s.swap)
  return (
    <div className="ms-app">
      <article className="ms-card ms-card--feature">
        <div className="ms-card__top">
          <div>
            <p className="ms-eyebrow">{EXPERIENCE.dates}</p>
            <h2 className="ms-title">{EXPERIENCE.title}</h2>
            <p className="ms-muted">{EXPERIENCE.company} · {EXPERIENCE.location}</p>
          </div>
          <span className="ms-badge">Current</span>
        </div>
        <p className="ms-lead">{EXPERIENCE.summary}</p>
      </article>
      <section className="ms-block">
        <h3>Focus areas</h3>
        <ul className="ms-chips">{EXPERIENCE.focus.map((f) => <li key={f}>{f}</li>)}</ul>
      </section>
      <section className="ms-block">
        <h3>What the work covers</h3>
        <p>{PROFILE.craft}</p>
      </section>
      <div className="ms-actions">
        <button className="ms-btn ms-btn--primary" onClick={() => swap('projects')}>See the projects</button>
        <button className="ms-btn" onClick={() => swap('process')}>How I work</button>
      </div>
    </div>
  )
}

export function Contact() {
  const items = [
    CONTACT.email && { label: 'Email', value: CONTACT.email, href: `mailto:${CONTACT.email}`, icon: <path d="M3.5 6.5h17v11h-17zM4 7l8 6 8-6" /> },
    CONTACT.phone && { label: 'Phone', value: CONTACT.phone, href: `tel:${CONTACT.phone.replace(/\s/g, '')}`, icon: <path d="M6.6 3.5h3l1.5 4-2 1.3a10 10 0 0 0 5.1 5.1l1.3-2 4 1.5v3a2 2 0 0 1-2.2 2A15.6 15.6 0 0 1 4.6 5.7a2 2 0 0 1 2-2.2z" /> },
    CONTACT.linkedin && { label: 'LinkedIn', value: 'Naveen Yarramallugalla', href: CONTACT.linkedin, external: true, icon: <path d="M5 9.5v9M5 5.5v.01M9.5 18.5v-9M9.5 13.5c0-2.5 1.6-4 3.6-4s3.4 1.4 3.4 4v5" /> },
    CONTACT.resume && { label: 'Résumé', value: 'View the PDF', href: asset(CONTACT.resume), external: true, icon: <path d="M7 3.5h7l4 4v13H7zM14 3.5v4h4M9.5 12.5h6M9.5 16h6" /> },
  ].filter(Boolean) as { label: string; value: string; href: string; external?: boolean; icon: React.ReactNode }[]
  return (
    <div className="ms-app">
      <h2 className="ms-display ms-display--sm">Let’s talk.</h2>
      <p className="ms-lead">{PROFILE.fullName} · {PROFILE.role} · {PROFILE.location}</p>
      <div className="ms-contact">
        {items.map((it) => (
          <a key={it.label} className="ms-contact__item" href={it.href} {...(it.external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}>
            <span className="ms-contact__icon" aria-hidden="true"><svg viewBox="0 0 24 24">{it.icon}</svg></span>
            <span><small>{it.label}</small><b>{it.label === 'Email' ? <>{it.value.split('@')[0]}@<wbr />{it.value.split('@')[1]}</> : it.value}</b></span>
            <Arrow />
          </a>
        ))}
        <div className="ms-contact__item is-static">
          <span className="ms-contact__icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M12 21s-6.5-5.4-6.5-11a6.5 6.5 0 0 1 13 0c0 5.6-6.5 11-6.5 11z" /><circle cx="12" cy="10" r="2.3" /></svg></span>
          <span><small>Location</small><b>{PROFILE.location}</b></span>
        </div>
      </div>
      {CONTACT.resume && (
        <p className="ms-muted ms-small">
          The résumé opens in a new tab. <a href={asset(CONTACT.resume)} download>Download it instead</a>.
        </p>
      )}
    </div>
  )
}

/** the design process: the four phases, each made only of practices listed on the résumé */
const pick = (group: string, names: string[]) => SKILL_GROUPS.find((g) => g.group === group)!.items.filter((i) => names.includes(i))
const PHASES = [
  { n: '01', name: 'Discover', line: 'Start from the requirements and the people who will use the product.', items: pick('UX Design', ['User Research', 'Stakeholder Interviews', 'Personas', 'Journey Mapping']) },
  { n: '02', name: 'Define', line: 'Shape the structure before the screens.', items: pick('UX Design', ['Information Architecture', 'User Flows', 'Task Flows']) },
  { n: '03', name: 'Design', line: 'From wireframes to prototypes and high-fidelity UI on a shared system.', items: [...pick('UX Design', ['Wireframing']), ...pick('Systems & Delivery', ['Interactive Prototyping', 'Design Systems']), ...pick('UI Design', ['High-Fidelity UI', 'Responsive Design'])] },
  { n: '04', name: 'Deliver', line: 'Test, hand off and keep working alongside engineering.', items: [...pick('UX Design', ['Usability Testing']), ...pick('Systems & Delivery', ['Accessibility (WCAG 2.1)', 'Developer Handoff', 'Cross-Functional Collaboration'])] },
]
export function Process() {
  return (
    <div className="ms-app">
      <p className="ms-intro-line">{EXPERIENCE.summary}</p>
      <ol className="ms-phases">
        {PHASES.map((p) => (
          <li key={p.n} className="ms-card">
            <span className="ms-phase__n">{p.n}</span>
            <h3>{p.name}</h3>
            <p className="ms-muted">{p.line}</p>
            <ul className="ms-chips ms-chips--sm">{p.items.map((i) => <li key={i}>{i}</li>)}</ul>
          </li>
        ))}
      </ol>
      <section className="ms-block">
        <h3>Where AI fits</h3>
        <p>{PROFILE.ai} {AI_STORY.body}</p>
        <ol className="ms-steps">
          {AI_WORKFLOW.map((s) => (
            <li key={s.n} className={s.human ? 'is-human' : ''}>
              <span>{s.n}</span>
              <b>{s.title}</b>
              <small>{s.text}</small>
            </li>
          ))}
        </ol>
      </section>
    </div>
  )
}

export function Skills() {
  return (
    <div className="ms-app">
      <div className="ms-skills">
        {SKILL_GROUPS.map((g) => (
          <section key={g.group} className="ms-card">
            <p className="ms-eyebrow">{g.short}</p>
            <h3>{g.group}</h3>
            <ul className="ms-chips ms-chips--sm">{g.items.map((i) => <li key={i} className={AI_TOOLS.includes(i) ? 'is-ai' : ''}>{i}</li>)}</ul>
          </section>
        ))}
        <section className="ms-card">
          <p className="ms-eyebrow">AI-assisted design</p>
          <h3>AI tools</h3>
          <ul className="ms-chips ms-chips--sm">{AI_TOOLS.map((i) => <li key={i} className="is-ai">{i}</li>)}</ul>
          <p className="ms-muted ms-small">{PROFILE.ai}</p>
        </section>
      </div>
    </div>
  )
}
