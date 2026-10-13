import { type ReactNode, useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { cssScene, gesture, launcherLayout, makeIconObject } from '../scene/spatial'
import { type AppId, useMindspace } from '../store'
import { APPS } from './apps'

/**
 * The spatial launcher. In the room every icon is its own object in 3D space,
 * on a gentle arc in front of the visitor (see scene/spatial.ts): the room's
 * camera draws them with real perspective, so they stay where they are in the
 * room while the visitor looks around. They remain real HTML buttons —
 * focusable, clickable, crisp. Without the 3D scene they sit in a flat grid.
 */
export function Launcher({ pinned }: { pinned: boolean }) {
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
  useEffect(() => { if (!app) setPressed(null) }, [app])

  // one world-space object per icon; each is a tiny launcher of its own, so the
  // entrance animation and the "step back while an app is open" state apply per icon
  const wrappers = useMemo(() => APPS.map(() => document.createElement('div')), [])
  const objects = useMemo(() => wrappers.map(makeIconObject), [wrappers])
  useEffect(() => {
    if (!pinned) return
    for (const o of objects) cssScene.add(o)
    return () => { for (const o of objects) cssScene.remove(o) }
  }, [pinned, objects])
  useEffect(() => {
    launcherLayout(objects.length, cols).forEach((p, i) => {
      objects[i].position.copy(p.position)
      objects[i].rotation.set(0, p.yaw, 0)
    })
  }, [objects, cols])
  useEffect(() => {
    wrappers.forEach((w) => {
      w.className = `ms-launcher ms-launcher--spatial ${phase === 'room' ? 'is-in' : ''} ${app ? 'is-receded' : ''}`
      w.setAttribute('aria-hidden', app ? 'true' : 'false')
    })
  }, [wrappers, phase, app])

  const choose = (id: AppId, el: HTMLElement) => {
    // the end of a look-around drag that began on an icon is not a click
    if (gesture.dragged) return
    const r = el.getBoundingClientRect()
    setPressed(id)
    // the icon answers first, then the window grows out of it
    window.setTimeout(() => open(id, { x: r.left + r.width / 2, y: r.top + r.height / 2 }), 140)
  }
  const icon = (i: number): ReactNode => {
    const a = APPS[i]
    return (
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
    )
  }

  if (pinned) return <>{wrappers.map((w, i) => createPortal(icon(i), w, APPS[i].id))}</>
  return (
    <div className="ms-launcher-plane" style={{ width: cols === 5 ? 820 : 470 }}>
      <nav className={`ms-launcher ${phase === 'room' ? 'is-in' : ''} ${app ? 'is-receded' : ''}`} style={{ ['--cols' as string]: cols }} aria-label="Applications" aria-hidden={!!app}>
        {APPS.map((_, i) => icon(i))}
      </nav>
    </div>
  )
}

/** five per row on wide screens, three on phones / narrow windows */
function columns() {
  return window.innerWidth / window.innerHeight < 1 || window.innerWidth < 720 ? 3 : 5
}
