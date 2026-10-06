import { useEffect, useRef, useState } from 'react'
import { say } from '@/core/companion'
import { type Destination, matchCommand, navigateToLocation, navigateToProject } from '@/core/navigation'
import { matchProject, PROJECTS } from '@/data/projects'
import { soundManager } from '@/core/sound/SoundManager'
import { useUIStore } from '@/stores/uiStore'
import { CompanionGlyph } from './CompanionGlyph'
import { STORY_STOPS } from '@/data/world'
import { STOP_ICONS } from './stopIcons'

const QUICK = STORY_STOPS
const HINTS = ['take me home', 'show my education', 'show projects', 'show TASK', 'how do you design', 'let’s connect']

/**
 * The companion's navigator (not a chatbot): quick destinations plus a text
 * box understood locally — "projects", "college", "design", "resume"… —
 * so travel is instant and needs no network.
 */
export function GuidePanel() {
  const open = useUIStore((s) => s.guideOpen)
  const setOpen = useUIStore((s) => s.setGuideOpen)
  const [text, setText] = useState('')
  const [miss, setMiss] = useState(false)
  const input = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) {
      setText('')
      setMiss(false)
      setTimeout(() => input.current?.focus({ preventScroll: true }), 80)
    }
  }, [open])

  const go = (dest: Destination) => {
    soundManager.play('click')
    setOpen(false)
    navigateToLocation(dest)
  }
  const goProject = (id: string) => {
    soundManager.play('click')
    setOpen(false)
    void navigateToProject(id)
  }
  const submit = () => {
    // a project name wins over the general "projects" stop ("show TASK")
    const project = matchProject(text)
    if (project) return goProject(project.id)
    const dest = matchCommand(text)
    if (dest) return go(dest)
    setMiss(true)
    say('I can take you <b>home</b>, to <b>education</b>, <b>Naveen Solutions</b>, the <b>projects</b> (or one by name), the <b>Design Journey</b> or the <b>Contact Café</b>.', { ms: 4200, emote: 'think', interrupt: true })
  }

  return (
    <div className={`ui-guide ${open ? 'is-open' : ''}`} role="dialog" aria-modal="false" aria-labelledby="guide-title" aria-hidden={!open}>
      <header className="ui-guide__head">
        <CompanionGlyph size={40} />
        <div>
          <p className="ui-kicker">Your guide</p>
          <h2 id="guide-title">Where would you like to go?</h2>
        </div>
        <button className="ui-guide__close" onClick={() => setOpen(false)} aria-label="Close guide" tabIndex={open ? 0 : -1}>
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" /></svg>
        </button>
      </header>
      <div className="ui-guide__quick">
        {QUICK.map((q) => (
          <button key={q.id} onClick={() => go(q.id)} tabIndex={open ? 0 : -1}>
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d={STOP_ICONS[q.icon]} /></svg>
            {q.name}
          </button>
        ))}
      </div>
      <p className="ui-guide__label">Jump to a project</p>
      <div className="ui-guide__projects">
        {PROJECTS.map((p) => (
          <button key={p.id} onClick={() => goProject(p.id)} tabIndex={open ? 0 : -1} style={{ ['--accent' as string]: p.accent }}>
            <span aria-hidden="true">{p.number}</span>
            {p.title}
          </button>
        ))}
      </div>
      <form className="ui-guide__ask" onSubmit={(e) => { e.preventDefault(); submit() }}>
        <input
          ref={input}
          value={text}
          onChange={(e) => { setText(e.target.value); setMiss(false) }}
          placeholder="Ask me where you want to go…"
          aria-label="Ask the guide where you want to go"
          tabIndex={open ? 0 : -1}
          onKeyDown={(e) => { if (e.key === 'Escape') setOpen(false); e.stopPropagation() }}
        />
        <button type="submit" aria-label="Go" tabIndex={open ? 0 : -1}>
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h13m-5-6 6 6-6 6" /></svg>
        </button>
      </form>
      <p className={`ui-guide__hint ${miss ? 'is-miss' : ''}`}>
        {miss ? 'Try: ' : 'e.g. '}
        {HINTS.map((h, i) => (
          <button key={h} className="ui-guide__chip" onClick={() => { setText(h); const d = matchCommand(h); if (d) go(d) }} tabIndex={open ? 0 : -1}>{h}{i < HINTS.length - 1 ? '' : ''}</button>
        ))}
      </p>
    </div>
  )
}

/** header button that opens the guide (also reachable by clicking the companion in the world) */
export function GuideButton() {
  const open = useUIStore((s) => s.guideOpen)
  const setOpen = useUIStore((s) => s.setGuideOpen)
  return (
    <button className={`ui-icon-btn ui-guide-btn ${open ? 'is-open' : ''}`} onClick={() => { soundManager.unlock(); soundManager.play('companion'); setOpen(!open) }} aria-label="Open your guide — where would you like to go?" aria-expanded={open} title="Ask your guide">
      <CompanionGlyph size={30} />
    </button>
  )
}
