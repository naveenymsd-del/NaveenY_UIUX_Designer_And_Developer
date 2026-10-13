import { useEffect, useState } from 'react'
import { BASE } from '@/utils/basePath'
import { useMindspace } from '../store'

/**
 * The few persistent controls. Top-left: back to the 3D city. Top-right, as in
 * a spatial OS: reset view and close. A one-time hint explains look / zoom.
 */
export function Controls() {
  const app = useMindspace((s) => s.app)
  const phase = useMindspace((s) => s.phase)
  const fallback = useMindspace((s) => s.fallback)
  const close = useMindspace((s) => s.close)
  const reset = useMindspace((s) => s.resetView)
  const [hint, setHint] = useState(false)

  useEffect(() => {
    if (phase !== 'room' || fallback) return
    const touch = matchMedia('(pointer: coarse)').matches
    setHint(true)
    const t = setTimeout(() => setHint(false), touch ? 6500 : 7500)
    return () => clearTimeout(t)
  }, [phase, fallback])
  if (phase !== 'room') return null
  const touch = matchMedia('(pointer: coarse)').matches

  return (
    <>
      <a className="ms-pill ms-back" href={`${BASE}street`} aria-label="Leave Mindspace and return to the 3D city">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 6l-6 6 6 6" /></svg>
        <span>3D city</span>
      </a>
      <div className="ms-controls" role="toolbar" aria-label="View controls">
        {!fallback && (
          <button className="ms-round" onClick={reset} aria-label="Reset view" title="Reset view">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4.5 12a7.5 7.5 0 1 0 2.2-5.3" /><path d="M4.5 4.5v3.8h3.8" /></svg>
          </button>
        )}
        <button className="ms-round" onClick={close} disabled={!app} aria-label={app ? 'Close the application' : 'No application open'} title="Close">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6.5 6.5l11 11M17.5 6.5l-11 11" /></svg>
        </button>
      </div>
      {!fallback && (
        <p className={`ms-hint ${hint && !app ? 'is-visible' : ''}`} aria-hidden={!hint}>
          {touch ? 'Drag to look around · pinch to zoom · tap an app' : 'Drag to look around · scroll to zoom · W A S D to step · click an app'}
        </p>
      )}
    </>
  )
}
