import { soundManager } from '@/core/sound/SoundManager'
import { PROJECTS } from '@/data/projects'
import { useGameStore } from '@/stores/gameStore'

/** Projects mode: a rail of the five pavilions. Hover previews, click opens. */
export function ProjectRail() {
  const mode = useGameStore((s) => s.mode)
  const phase = useGameStore((s) => s.phase)
  const focused = useGameStore((s) => s.focusedProjectId)
  const active = useGameStore((s) => s.activeProjectId)
  const focus = useGameStore((s) => s.focusProject)
  const open = useGameStore((s) => s.openProject)
  const visible = mode === 'projects' && phase === 'playing'
  return (
    <div className={`ui-rail ${visible ? 'is-visible' : ''} ${active ? 'is-compact' : ''}`} aria-hidden={!visible}>
      {!active && (
        <div className="ui-rail__intro">
          <p className="ui-kicker">Project Plaza</p>
          <h2>Five pavilions, five stories.</h2>
        </div>
      )}
      <ul className="ui-rail__list">
        {PROJECTS.map((p) => (
          <li key={p.id}>
            <button
              className={`ui-rail__card ${focused === p.id ? 'is-focused' : ''} ${active === p.id ? 'is-active' : ''}`}
              style={{ ['--accent' as string]: p.accent }}
              onMouseEnter={() => { if (!active) { focus(p.id); soundManager.play('hover') } }}
              onMouseLeave={() => { if (!active) focus(null) }}
              onFocus={() => !active && focus(p.id)}
              onClick={() => { soundManager.play('open'); open(p.id) }}
              tabIndex={visible ? 0 : -1}
            >
              <span className="ui-rail__num">{p.number}</span>
              <span className="ui-rail__text">
                <b>{p.title}</b>
                <small>{p.category}</small>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
