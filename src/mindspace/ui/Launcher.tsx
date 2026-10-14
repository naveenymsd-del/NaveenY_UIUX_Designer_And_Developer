import { type ReactNode, useEffect, useMemo, useRef, useState } from 'react'
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

  const choose = (id: AppId) => {
    const el = document.querySelector<HTMLElement>(`.ms-icon[data-app="${id}"] .ms-icon__face`)
    if (!el) return
    const r = el.getBoundingClientRect()
    setPressed(id)
    // the icon answers first, then the window grows out of it
    window.setTimeout(() => open(id, { x: r.left + r.width / 2, y: r.top + r.height / 2 }), 140)
  }
  const chooseRef = useRef(choose)
  chooseRef.current = choose

  // In the room the icons are CSS3D objects (matrix3d transforms). Safari's hit-testing of such
  // elements can be offset from where they are drawn, so a tap on one icon was delivered to the
  // button of the icon below it (About Me → Projects). A tap is therefore resolved from geometry:
  // the icon whose drawn face (or label) contains the point — never from the event's target.
  useEffect(() => {
    if (!pinned) return
    let down: { x: number; y: number; id: number } | null = null
    const onDown = (e: PointerEvent) => { down = { x: e.clientX, y: e.clientY, id: e.pointerId } }
    const onUp = (e: PointerEvent) => {
      const d = down
      down = null
      if (!d || d.id !== e.pointerId) return
      const s = useMindspace.getState()
      if (s.app || s.phase !== 'room') return
      // the end of a look-around drag is not a tap
      if (gesture.dragged || Math.hypot(e.clientX - d.x, e.clientY - d.y) > 10) return
      // taps on the controls, the player or anything else interactive keep their own meaning
      const t = e.target as Element | null
      if (t?.closest('button:not(.ms-icon), a, input, [role="region"], .ms-controls')) return
      const id = iconAt(e.clientX, e.clientY)
      if (id) chooseRef.current(id)
    }
    // capture: runs before the camera rig resets its drag flag on the same pointerup
    window.addEventListener('pointerdown', onDown, true)
    window.addEventListener('pointerup', onUp, true)
    return () => {
      window.removeEventListener('pointerdown', onDown, true)
      window.removeEventListener('pointerup', onUp, true)
    }
  }, [pinned])
  const icon = (i: number): ReactNode => {
    const a = APPS[i]
    return (
      <button
        key={a.id}
        className={`ms-icon ${pressed === a.id ? 'is-pressed' : ''}`}
        style={{ ['--i' as string]: i, ['--row' as string]: Math.floor(i / cols) }}
        data-app={a.id}
        // in the room, pointer taps are resolved by geometry (above); a click here is keyboard
        // activation (detail 0). In the flat fallback grid there is no 3D: plain clicks are reliable.
        onClick={(e) => { if (pinned && e.detail > 0) return; if (gesture.dragged) return; choose(a.id) }}
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

/**
 * The app whose icon is drawn under (x, y): its face or label rectangle as rendered (a few px of
 * slack for fingers); if two qualify, the nearest face centre wins. Receded icons (window open) don't count.
 */
function iconAt(x: number, y: number): AppId | null {
  let best: { id: AppId; d: number } | null = null
  for (const btn of document.querySelectorAll<HTMLElement>('.ms-launcher--spatial.is-in:not(.is-receded) .ms-icon[data-app]')) {
    const face = btn.querySelector('.ms-icon__face')!.getBoundingClientRect()
    const label = btn.querySelector('.ms-icon__label')!.getBoundingClientRect()
    const inside = (r: DOMRect, pad: number) => x >= r.left - pad && x <= r.right + pad && y >= r.top - pad && y <= r.bottom + pad
    if (!inside(face, 8) && !inside(label, 4)) continue
    const d = Math.hypot(x - (face.left + face.width / 2), y - (face.top + face.height / 2))
    if (!best || d < best.d) best = { id: btn.dataset.app as AppId, d }
  }
  return best?.id ?? null
}

/** five per row on wide screens, three on phones / narrow windows */
function columns() {
  return window.innerWidth / window.innerHeight < 1 || window.innerWidth < 720 ? 3 : 5
}
