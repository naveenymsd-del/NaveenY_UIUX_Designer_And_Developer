import { useEffect, useState } from 'react'
import { soundManager } from '@/core/sound/SoundManager'
import { useGameStore } from '@/stores/gameStore'
import { useUIStore } from '@/stores/uiStore'

type Step = { id: 'city' | 'move' | 'ai' | 'menu'; title: string; touch: string; desktop: string }
const STEPS: Step[] = [
  { id: 'city', title: 'Explore the city', touch: 'Every place here is part of Naveen’s story.', desktop: 'Every place here is part of Naveen’s story.' },
  { id: 'move', title: 'Move with the joystick', touch: 'Drag it to walk · drag anywhere to look around.', desktop: 'Walk with WASD or the arrow keys · drag to look around.' },
  { id: 'ai', title: 'Talk to your AI guide', touch: 'Tap the orange orb — try “take me to projects”.', desktop: 'Use the guide, bottom-left — talk or type.' },
  { id: 'menu', title: 'Open the menu to see the full journey', touch: 'Home, Education, NFC, Projects, Design Journey, Contact.', desktop: 'Home, Education, NFC, Projects, Design Journey, Contact.' },
]
const STEP_MS = 3600

/**
 * First-run onboarding: four light hints, one at a time, each pointing at the
 * thing it describes (the joystick, the AI orb, the menu). No tutorial wall —
 * it steps aside on its own, on the close button, Esc, or as soon as you move.
 */
export function TipsOverlay() {
  const open = useGameStore((s) => s.tipsOpen)
  const setOpen = useGameStore((s) => s.setTipsOpen)
  const mode = useGameStore((s) => s.mode)
  const panel = useGameStore((s) => !!s.activeLocationId || !!s.activeProjectId)
  const isTouch = useUIStore((s) => s.isTouch)
  const setHint = useUIStore((s) => s.setHint)
  const [i, setI] = useState(0)
  const visible = open && mode === 'street' && !panel

  useEffect(() => {
    if (!visible) return
    const t = setTimeout(() => (i < STEPS.length - 1 ? setI(i + 1) : setOpen(false)), STEP_MS)
    return () => clearTimeout(t)
  }, [visible, i, setOpen])
  useEffect(() => {
    setHint(visible ? STEPS[i].id : null)
  }, [visible, i, setHint])
  useEffect(() => { if (!open) setI(0) }, [open])

  const step = STEPS[i]
  const title = !isTouch && step.id === 'move' ? 'Move with your keyboard' : step.title
  return (
    <div className={`ui-tips ui-tips--hint is-${step.id} ${visible ? 'is-visible' : ''}`} role="status" aria-label="Getting started" aria-hidden={!visible}>
      <div className="ui-tips__card" key={step.id}>
        <p className="ui-tips__title">{title}</p>
        <p className="ui-tips__sub">{isTouch ? step.touch : step.desktop}</p>
        <ol className="ui-tips__dots" aria-hidden="true">
          {STEPS.map((s, n) => <li key={s.id} className={n === i ? 'is-on' : n < i ? 'is-done' : ''} />)}
        </ol>
      </div>
      <button className="ui-tips__close" aria-label="Close tips" onClick={() => { soundManager.play('close', { volume: 0.5 }); setOpen(false) }} tabIndex={visible ? 0 : -1}>
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" /></svg>
      </button>
    </div>
  )
}
