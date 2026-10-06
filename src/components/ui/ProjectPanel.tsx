import { useEffect, useRef, useState } from 'react'
import { Vector3 } from 'three'
import { navigate } from '@/app/routes'
import { requestTeleport } from '@/core/runtime'
import { soundManager } from '@/core/sound/SoundManager'
import { getProject, PROJECTS, type ProjectDef } from '@/data/projects'
import { useGameStore } from '@/stores/gameStore'

/**
 * Case-study presentation. It slides in beside the project's studio screen
 * (the camera frames the screen on the left, the rest of the room dims) and
 * reads as one editorial page: the title with its prototype link, then
 * 01 Overview and 02 Challenges.
 */
export function ProjectPanel() {
  const id = useGameStore((s) => s.activeProjectId)
  const mode = useGameStore((s) => s.mode)
  const interior = useGameStore((s) => s.interior)
  const open = useGameStore((s) => s.openProject)
  const close = useGameStore((s) => s.closePanels)
  const [shown, setShown] = useState<ProjectDef | null>(null)
  const [visible, setVisible] = useState(false)
  const closeRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (id) {
      setVisible(false)
      const t0 = setTimeout(() => setShown(getProject(id)), shown ? 200 : 0)
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
  const inStudio = interior === 'office'
  const where = inStudio ? 'Project Studio · Naveen Solutions' : 'Project pavilion'
  const meta = [shown.role, shown.year, shown.tools?.join(' · ')].filter(Boolean)

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

        <div className="ui-case__scroll" key={shown.id} tabIndex={0} aria-label={`${shown.title} case study`}>
          <div className="ui-case__titlerow">
            <h2 id="case-title" className="ui-case__title">{shown.title}</h2>
            <a className="ui-case__proto" href={shown.prototypeUrl} target="_blank" rel="noopener noreferrer" aria-label={`Open ${shown.title} prototype in Figma (opens in a new tab)`}>
              Open prototype
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 17 17 7M9 7h8v8" /></svg>
            </a>
          </div>
          <p className="ui-case__cat">{shown.category}</p>
          <p id="case-desc" className="ui-case__lead">{shown.description}</p>
          {meta.length > 0 && <p className="ui-case__meta-line">{meta.join(' · ')}</p>}

          <section className="ui-case__section" aria-labelledby="case-overview">
            <h3 id="case-overview"><span>01</span> Overview</h3>
            {shown.overview.map((para, i) => <p key={i}>{para}</p>)}
          </section>

          <section className="ui-case__section" aria-labelledby="case-challenges">
            <h3 id="case-challenges"><span>02</span> Challenges</h3>
            <ol className="ui-case__challenges">
              {shown.challenges.map((c, i) => (
                <li key={c.title} style={{ ['--i' as string]: i }}>
                  <span className="ui-case__cnum" aria-hidden="true">{String(i + 1).padStart(2, '0')}</span>
                  <div>
                    <b>{c.title}</b>
                    <p>{c.description}</p>
                  </div>
                </li>
              ))}
            </ol>
          </section>
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
