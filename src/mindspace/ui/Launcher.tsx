import { useEffect, useRef, useState } from 'react'
import { Vector3 } from 'three'
import { anchors } from '../scene/CameraRig'
import { type AppId, useMindspace } from '../store'
import { APPS } from './apps'

/** where the launcher floats in the room: over the coffee table, about 2.4 m in front of the visitor */
export const LAUNCHER_POS = new Vector3(0, 1.45, 0.55)

/**
 * The spatial launcher: a grid of round app icons. In the room it is pinned to
 * a point in space (see AnchorProjector) — real HTML, so it stays crisp,
 * focusable and clickable. Without the 3D scene it simply sits centred.
 */
export function Launcher({ pinned }: { pinned: boolean }) {
  const ref = useRef<HTMLDivElement>(null)
  const open = useMindspace((s) => s.open)
  const app = useMindspace((s) => s.app)
  const phase = useMindspace((s) => s.phase)
  const [cols, setCols] = useState(() => columns())
  const [pressed, setPressed] = useState<AppId | null>(null)

  useEffect(() => {
    const onResize = () => setCols(columns())
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])
  // register with the projector: a 5-column grid spans ~2.3 m in the room, a 3-column one ~1.3 m
  useEffect(() => {
    const el = ref.current
    if (!pinned || !el) return
    const px = cols === 5 ? 820 : 470
    anchors.set('launcher', { el, pos: LAUNCHER_POS, width: cols === 5 ? 2.3 : 1.3, px })
    return () => { anchors.delete('launcher') }
  }, [pinned, cols])
  useEffect(() => { if (!app) setPressed(null) }, [app])

  const choose = (id: AppId, el: HTMLElement) => {
    const r = el.getBoundingClientRect()
    setPressed(id)
    // the icon answers first, then the window grows out of it
    window.setTimeout(() => open(id, { x: r.left + r.width / 2, y: r.top + r.height / 2 }), 140)
  }

  return (
    <div className={`ms-launcher-plane ${pinned ? 'is-pinned' : ''}`} ref={ref} style={{ width: cols === 5 ? 820 : 470 }}>
      <nav
        className={`ms-launcher ${phase === 'room' ? 'is-in' : ''} ${app ? 'is-receded' : ''}`}
        style={{ ['--cols' as string]: cols }}
        aria-label="Applications"
        aria-hidden={!!app}
      >
        {APPS.map((a, i) => (
          <button
            key={a.id}
            className={`ms-icon ${pressed === a.id ? 'is-pressed' : ''}`}
            style={{ ['--i' as string]: i, ['--row' as string]: Math.floor(i / cols) }}
            onClick={(e) => choose(a.id, e.currentTarget.querySelector('.ms-icon__face') as HTMLElement)}
            tabIndex={app ? -1 : 0}
            aria-label={`Open ${a.title}`}
          >
            <span className={`ms-icon__face ms-icon__face--${a.id}`} style={{ background: a.face }} aria-hidden="true">
              <span className="ms-icon__rim" />
              {a.glyph}
            </span>
            <span className="ms-icon__label">{a.label}</span>
          </button>
        ))}
      </nav>
    </div>
  )
}

/** five per row on wide screens, three on phones / narrow windows */
function columns() {
  return window.innerWidth / window.innerHeight < 1 || window.innerWidth < 720 ? 3 : 5
}
