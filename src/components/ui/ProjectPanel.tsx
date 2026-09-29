import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { Vector3 } from 'three'
import { navigate } from '@/app/routes'
import { requestTeleport } from '@/core/runtime'
import { soundManager } from '@/core/sound/SoundManager'
import { getProject, isPlaceholder, PROJECTS, type ProjectDef } from '@/data/projects'
import { useGameStore } from '@/stores/gameStore'
import { Rich } from './Rich'

const TABS = ['Overview', 'Challenge', 'Process', 'UI', 'Prototype', 'Outcome'] as const
type Tab = (typeof TABS)[number]

/**
 * Case-study presentation. It slides in beside the project's studio screen
 * (the camera frames the screen on the left), reads like an editorial spread
 * and only shows what the project data actually contains — unknown facts are
 * highlighted placeholders.
 */
export function ProjectPanel() {
  const id = useGameStore((s) => s.activeProjectId)
  const mode = useGameStore((s) => s.mode)
  const interior = useGameStore((s) => s.interior)
  const open = useGameStore((s) => s.openProject)
  const close = useGameStore((s) => s.closePanels)
  const [shown, setShown] = useState<ProjectDef | null>(null)
  const [visible, setVisible] = useState(false)
  const [tab, setTab] = useState<Tab>('Overview')
  const closeRef = useRef<HTMLButtonElement>(null)
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([])

  useEffect(() => {
    if (id) {
      setVisible(false)
      const t0 = setTimeout(() => {
        setShown(getProject(id))
        setTab('Overview')
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

  if (!shown) return null
  const idx = PROJECTS.findIndex((p) => p.id === shown.id)
  const prev = PROJECTS[(idx - 1 + PROJECTS.length) % PROJECTS.length]
  const next = PROJECTS[(idx + 1) % PROJECTS.length]
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
  const pick = (t: Tab) => {
    if (t === tab) return
    soundManager.play('hover')
    setTab(t)
  }
  const onTabKey = (e: KeyboardEvent) => {
    const i = TABS.indexOf(tab)
    let n = i
    if (e.key === 'ArrowRight') n = (i + 1) % TABS.length
    else if (e.key === 'ArrowLeft') n = (i - 1 + TABS.length) % TABS.length
    else if (e.key === 'Home') n = 0
    else if (e.key === 'End') n = TABS.length - 1
    else return
    e.preventDefault()
    pick(TABS[n])
    tabRefs.current[n]?.focus()
  }
  const cs = shown.caseStudy
  const where = interior === 'office' ? 'Project Studio · NFC Solutions' : 'Project pavilion'

  return (
    <aside className={`ui-case ${visible ? 'is-visible' : ''}`} role="dialog" aria-labelledby="case-title" style={{ ['--accent' as string]: shown.accent }}>
      <header className="ui-case__head">
        <p className="ui-case__kicker">
          <span className="ui-case__num">{shown.number}</span>
          {where}
        </p>
        <button ref={closeRef} className="ui-case__close" onClick={onClose}>
          Close project
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" /></svg>
        </button>
      </header>
      <h2 id="case-title" className="ui-case__title">{shown.title}</h2>
      <p className="ui-case__cat">
        <Rich text={shown.category} />
        <span aria-hidden="true"> · </span>
        <Rich text={shown.role} />
        {shown.year && <><span aria-hidden="true"> · </span>{shown.year}</>}
      </p>

      <div className="ui-case__tabs" role="tablist" aria-label={`${shown.title} case study`} onKeyDown={onTabKey}>
        {TABS.map((t, i) => (
          <button
            key={t}
            ref={(el) => { tabRefs.current[i] = el }}
            role="tab"
            id={`case-tab-${t}`}
            aria-selected={tab === t}
            aria-controls="case-body"
            tabIndex={tab === t ? 0 : -1}
            className={tab === t ? 'is-active' : ''}
            onClick={() => pick(t)}
          >
            {t}
          </button>
        ))}
      </div>

      <div id="case-body" className="ui-case__body" role="tabpanel" aria-labelledby={`case-tab-${tab}`} key={`${shown.id}-${tab}`}>
        {tab === 'Overview' && (
          <>
            <p className="ui-case__lead"><Rich text={shown.description} /></p>
            <p><Rich text={cs.overview} /></p>
            <dl className="ui-case__meta">
              <div><dt>My role</dt><dd><Rich text={shown.role} /></dd></div>
              <div><dt>Project type</dt><dd><Rich text={shown.category} /></dd></div>
              <div><dt>Tools</dt><dd>{shown.tools.length ? shown.tools.join(' · ') : <mark className="ui-placeholder">[ADD TOOLS]</mark>}</dd></div>
            </dl>
            <Screens p={shown} />
          </>
        )}
        {tab === 'Challenge' && <p className="ui-case__lead"><Rich text={cs.challenge} /></p>}
        {tab === 'Process' && (
          <ol className="ui-case__steps">
            {cs.process.map((s, i) => <li key={i}><Rich text={s} /></li>)}
          </ol>
        )}
        {tab === 'UI' && (
          <>
            <h3>UI design</h3>
            <p><Rich text={cs.ui} /></p>
            <h3>Design system</h3>
            <p><Rich text={cs.designSystem} /></p>
            <Screens p={shown} />
          </>
        )}
        {tab === 'Prototype' && (
          <>
            <p className="ui-case__lead"><Rich text={cs.prototype} /></p>
            <Links p={shown} />
          </>
        )}
        {tab === 'Outcome' && (
          <>
            <p className="ui-case__lead"><Rich text={cs.outcome} /></p>
            <Links p={shown} />
          </>
        )}
      </div>

      <footer className="ui-case__foot">
        <button className="ui-case__step" onClick={() => step(prev)} aria-label={`Previous project: ${prev.title}`}>
          <span aria-hidden="true">←</span> {prev.title}
        </button>
        <span className="ui-case__count">{idx + 1} / {PROJECTS.length}</span>
        <button className="ui-case__step" onClick={() => step(next)} aria-label={`Next project: ${next.title}`}>
          {next.title} <span aria-hidden="true">→</span>
        </button>
      </footer>
      {mode === 'projects' && <button className="ui-btn ui-btn--quiet ui-case__walk" onClick={walk}>Walk to this pavilion</button>}
    </aside>
  )
}

function Screens({ p }: { p: ProjectDef }) {
  if (!p.screens.length)
    return (
      <div className="ui-case__screens is-empty" aria-label="Screenshots not added yet">
        {[0, 1, 2].map((i) => <div key={i} className="ui-case__shot"><mark className="ui-placeholder">[ADD SCREENSHOT]</mark></div>)}
      </div>
    )
  return (
    <div className="ui-case__screens">
      {p.screens.map((src, i) => <img key={src} className="ui-case__shot" src={src} alt={`${p.title} screen ${i + 1}`} loading="lazy" />)}
    </div>
  )
}

function Links({ p }: { p: ProjectDef }) {
  const links = p.links.filter((l) => !isPlaceholder(l.url))
  if (!links.length) return <p className="ui-case__note"><mark className="ui-placeholder">[ADD CASE STUDY / PROTOTYPE LINKS]</mark></p>
  return (
    <div className="ui-case__links">
      {links.map((l) => (
        <a key={l.url} className="ui-btn ui-btn--primary" href={l.url} target="_blank" rel="noreferrer">
          {l.label}
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 17 17 7M9 7h8v8" /></svg>
        </a>
      ))}
    </div>
  )
}
