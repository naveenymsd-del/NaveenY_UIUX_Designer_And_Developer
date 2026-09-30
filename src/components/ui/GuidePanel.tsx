import { useEffect, useRef, useState } from 'react'
import { say } from '@/core/companion'
import { type Destination, matchCommand, navigateToLocation } from '@/core/navigation'
import { soundManager } from '@/core/sound/SoundManager'
import { useUIStore } from '@/stores/uiStore'
import { CompanionGlyph } from './CompanionGlyph'

const QUICK: { dest: Destination; label: string; icon: string }[] = [
  { dest: 'home', label: 'Home', icon: 'M4 11 12 4l8 7M6 10v10h12V10M10 20v-5h4v5' },
  { dest: 'education', label: 'Education', icon: 'M2 9l10-5 10 5-10 5z M6 11v5c3 2 9 2 12 0v-5' },
  { dest: 'design', label: 'Design', icon: 'M12 20a8 8 0 1 1 8-8c0 2-2 3-4 3h-2a2 2 0 0 0-1 4 M7.5 11h.01M10 7.5h.01M14.5 7.5h.01' },
  { dest: 'projects', label: 'Projects', icon: 'M3 7h18v12H3z M8 7V5h8v2' },
  { dest: 'contact', label: 'Contact', icon: 'M3 6h18v12H3z M3 7l9 6 9-6' },
]

const HINTS = ['projects', 'education', 'design process', 'AI workflow', 'career', 'contact']

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
  const submit = () => {
    const dest = matchCommand(text)
    if (dest) return go(dest)
    setMiss(true)
    say('I can take you <b>home</b>, to <b>education</b>, <b>design</b>, <b>projects</b> or <b>contact</b>.', { ms: 3600, emote: 'think', interrupt: true })
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
          <button key={q.dest} onClick={() => go(q.dest)} tabIndex={open ? 0 : -1}>
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d={q.icon} /></svg>
            {q.label}
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
