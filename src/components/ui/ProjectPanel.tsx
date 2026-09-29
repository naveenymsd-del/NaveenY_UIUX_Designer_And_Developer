import { useEffect, useRef, useState } from 'react'
import { Vector3 } from 'three'
import { navigate } from '@/app/routes'
import { requestTeleport } from '@/core/runtime'
import { soundManager } from '@/core/sound/SoundManager'
import { getProject, PROJECTS, type ProjectDef } from '@/data/projects'
import { useGameStore } from '@/stores/gameStore'

/** Project presentation card over the 3D pavilion. */
export function ProjectPanel() {
  const id = useGameStore((s) => s.activeProjectId)
  const mode = useGameStore((s) => s.mode)
  const open = useGameStore((s) => s.openProject)
  const close = useGameStore((s) => s.closePanels)
  const [shown, setShown] = useState<ProjectDef | null>(null)
  const [visible, setVisible] = useState(false)
  const closeRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (id) {
      setVisible(false)
      const t0 = setTimeout(() => setShown(getProject(id)), shown ? 180 : 0)
      const t = setTimeout(() => {
        setVisible(true)
        closeRef.current?.focus({ preventScroll: true })
      }, 620)
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
  const step = (d: number) => {
    soundManager.play('click')
    open(PROJECTS[(idx + d + PROJECTS.length) % PROJECTS.length].id)
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
  return (
    <aside className={`ui-panel ui-panel--project ${visible ? 'is-visible' : ''}`} role="dialog" aria-labelledby="proj-title" style={{ ['--accent' as string]: shown.accent }}>
      <div className="ui-panel__head">
        <p className="ui-kicker">Project {shown.number} · {shown.year}</p>
        <button ref={closeRef} className="ui-panel__close" onClick={onClose} aria-label="Close project">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" /></svg>
        </button>
      </div>
      <div className="ui-project__cover" aria-hidden="true">
        <span>{shown.number}</span>
      </div>
      <h2 id="proj-title" className="ui-panel__title">{shown.title}</h2>
      <p className="ui-project__cat">{shown.category}</p>
      <p className="ui-panel__desc">{shown.description}</p>
      <dl className="ui-project__meta">
        <div><dt>Role</dt><dd>{shown.role}</dd></div>
        <div><dt>Year</dt><dd>{shown.year}</dd></div>
      </dl>
      <ul className="ui-chips">
        {shown.tools.map((t) => <li key={t}>{t}</li>)}
      </ul>
      <div className="ui-panel__actions">
        <a className="ui-btn ui-btn--primary" href={shown.caseStudyUrl} onClick={() => soundManager.play('click')}>
          View case study
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 17 17 7M9 7h8v8" /></svg>
        </a>
        {mode === 'projects' && <button className="ui-btn ui-btn--glass" onClick={walk}>Walk here</button>}
      </div>
      <div className="ui-project__nav">
        <button className="ui-btn ui-btn--ghost" onClick={() => step(-1)} aria-label="Previous project">← Prev</button>
        <span>{idx + 1} / {PROJECTS.length}</span>
        <button className="ui-btn ui-btn--ghost" onClick={() => step(1)} aria-label="Next project">Next →</button>
      </div>
    </aside>
  )
}
