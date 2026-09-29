import { useEffect } from 'react'
import { soundManager } from '@/core/sound/SoundManager'
import { useGameStore } from '@/stores/gameStore'
import { useUIStore } from '@/stores/uiStore'
import { KeyCap } from './KeyCap'

/** First-run tutorial card; dismissed by the close button, Esc, or starting to move. */
export function TipsOverlay() {
  const open = useGameStore((s) => s.tipsOpen)
  const setOpen = useGameStore((s) => s.setTipsOpen)
  const mode = useGameStore((s) => s.mode)
  const isTouch = useUIStore((s) => s.isTouch)
  useEffect(() => {
    if (!open) return
    const t = setTimeout(() => setOpen(false), 14000)
    return () => clearTimeout(t)
  }, [open, setOpen])
  const visible = open && mode === 'street'
  return (
    <div className={`ui-tips ${visible ? 'is-visible' : ''}`} role="dialog" aria-label="How to play" aria-hidden={!visible}>
      <span className="ui-tips__badge" aria-hidden="true">TIP!</span>
      <button className="ui-tips__close" aria-label="Close tips" onClick={() => { soundManager.play('close', { volume: 0.5 }); setOpen(false) }} tabIndex={visible ? 0 : -1}>
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" /></svg>
      </button>
      {isTouch ? (
        <div className="ui-tips__grid">
          <div className="ui-tips__cell">
            <div className="ui-tips__visual"><span className="ui-stick-icon ui-stick-icon--lg" /></div>
            <p>Drag the joystick to walk — push further to run</p>
          </div>
          <div className="ui-tips__divider" />
          <div className="ui-tips__cell">
            <div className="ui-tips__visual"><span className="ui-jump-icon ui-jump-icon--lg">↑</span></div>
            <p>Tap jump · drag anywhere to look around</p>
          </div>
        </div>
      ) : (
        <div className="ui-tips__grid">
          <div className="ui-tips__cell">
            <div className="ui-tips__visual ui-wasd ui-wasd--lg">
              <KeyCap k="W" accent />
              <span><KeyCap k="A" accent /><KeyCap k="S" /><KeyCap k="D" /></span>
            </div>
            <p>Control the character with the WASD keys</p>
          </div>
          <div className="ui-tips__divider" />
          <div className="ui-tips__cell">
            <div className="ui-tips__visual"><KeyCap k="SPACE" wide accent /></div>
            <p>Press the space bar to jump</p>
          </div>
          <div className="ui-tips__divider" />
          <div className="ui-tips__cell">
            <div className="ui-tips__visual"><span className="ui-mouse ui-mouse--lg" /></div>
            <p>Drag to look around · scroll to zoom</p>
          </div>
        </div>
      )}
    </div>
  )
}
