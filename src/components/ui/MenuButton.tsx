import { soundManager } from '@/core/sound/SoundManager'
import { useUIStore } from '@/stores/uiStore'

export function MenuButton() {
  const open = useUIStore((s) => s.menuOpen)
  const toggle = useUIStore((s) => s.toggleMenu)
  return (
    <button
      className={`ui-menu-btn ${open ? 'is-open' : ''}`}
      aria-label={open ? 'Close menu' : 'Open menu'}
      aria-expanded={open}
      aria-controls="site-menu"
      onClick={() => {
        soundManager.unlock()
        soundManager.play(open ? 'close' : 'open', { volume: 0.6 })
        toggle()
      }}
    >
      <span />
      <span />
      <span />
    </button>
  )
}
