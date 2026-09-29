import { useEffect, useRef } from 'react'
import { input, pressJump } from '@/core/input'
import { soundManager } from '@/core/sound/SoundManager'
import { controlsEnabled, useGameStore } from '@/stores/gameStore'
import { useUIStore } from '@/stores/uiStore'

const DEAD_ZONE = 0.14

/**
 * Virtual joystick (bottom-left) + jump button (bottom-right) for touch
 * devices. Pointer Events with pointer capture track one finger each; the
 * output is a normalised vector with a dead zone and a smooth spring return.
 * touch-action: none prevents scrolling and browser gestures.
 */
export function MobileControls() {
  const isTouch = useUIStore((s) => s.isTouch)
  const enabled = useGameStore((s) => controlsEnabled(s))
  if (!isTouch) return null
  return (
    <div className={`ui-mobile ${enabled ? 'is-visible' : ''}`} aria-hidden={!enabled}>
      <Joystick enabled={enabled} />
      <JumpButton />
    </div>
  )
}

function Joystick({ enabled }: { enabled: boolean }) {
  const base = useRef<HTMLDivElement>(null)
  const thumb = useRef<HTMLDivElement>(null)
  const st = useRef({ id: -1, cx: 0, cy: 0, r: 56, tx: 0, ty: 0, x: 0, y: 0, raf: 0 })

  useEffect(() => {
    const s = st.current
    // spring the visual thumb toward its target every frame
    const loop = () => {
      s.x += (s.tx - s.x) * 0.35
      s.y += (s.ty - s.y) * 0.35
      if (thumb.current) thumb.current.style.transform = `translate(${s.x * s.r}px, ${s.y * s.r}px)`
      s.raf = requestAnimationFrame(loop)
    }
    s.raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(s.raf)
  }, [])

  useEffect(() => {
    if (!enabled) release()
  }, [enabled])

  function release() {
    const s = st.current
    s.id = -1
    s.tx = s.ty = 0
    input.stick.x = input.stick.y = 0
    base.current?.classList.remove('is-active')
  }

  function update(clientX: number, clientY: number) {
    const s = st.current
    let dx = (clientX - s.cx) / s.r
    let dy = (clientY - s.cy) / s.r
    const len = Math.hypot(dx, dy)
    if (len > 1) {
      dx /= len
      dy /= len
    }
    s.tx = dx
    s.ty = dy
    const m = Math.min(1, len)
    if (m < DEAD_ZONE) {
      input.stick.x = input.stick.y = 0
      return
    }
    // rescale so output starts at 0 just outside the dead zone
    const k = (m - DEAD_ZONE) / (1 - DEAD_ZONE) / (m || 1)
    input.stick.x = dx * k
    input.stick.y = -dy * k
  }

  return (
    <div
      ref={base}
      className="ui-joystick"
      role="slider"
      aria-label="Movement joystick"
      aria-valuetext="drag to move"
      onPointerDown={(e) => {
        e.stopPropagation()
        e.preventDefault()
        soundManager.unlock()
        const s = st.current
        if (s.id !== -1) return
        const rect = base.current!.getBoundingClientRect()
        s.cx = rect.left + rect.width / 2
        s.cy = rect.top + rect.height / 2
        s.r = rect.width * 0.36
        s.id = e.pointerId
        try {
          base.current!.setPointerCapture(e.pointerId)
        } catch {
          /* pointer already gone (e.g. cancelled touch) — tracking still works via bubbling */
        }
        base.current!.classList.add('is-active')
        update(e.clientX, e.clientY)
        const g = useGameStore.getState()
        if (g.tipsOpen) g.setTipsOpen(false)
      }}
      onPointerMove={(e) => {
        if (e.pointerId !== st.current.id) return
        e.stopPropagation()
        update(e.clientX, e.clientY)
      }}
      onPointerUp={(e) => e.pointerId === st.current.id && release()}
      onPointerCancel={(e) => e.pointerId === st.current.id && release()}
      onLostPointerCapture={(e) => e.pointerId === st.current.id && release()}
      onContextMenu={(e) => e.preventDefault()}
    >
      <div className="ui-joystick__ring" />
      <div className="ui-joystick__arrows" aria-hidden="true"><i /><i /><i /><i /></div>
      <div ref={thumb} className="ui-joystick__thumb" />
    </div>
  )
}

function JumpButton() {
  const ref = useRef<HTMLButtonElement>(null)
  return (
    <button
      ref={ref}
      className="ui-jump"
      aria-label="Jump"
      onPointerDown={(e) => {
        e.stopPropagation()
        e.preventDefault()
        soundManager.unlock()
        pressJump()
        ref.current?.classList.add('is-pressed')
      }}
      onPointerUp={() => ref.current?.classList.remove('is-pressed')}
      onPointerCancel={() => ref.current?.classList.remove('is-pressed')}
      onPointerLeave={() => ref.current?.classList.remove('is-pressed')}
      onContextMenu={(e) => e.preventDefault()}
    >
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 19V6m-6 6 6-6 6 6" /></svg>
      <span>JUMP</span>
    </button>
  )
}
