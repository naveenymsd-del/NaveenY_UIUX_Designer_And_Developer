import { useEffect, useState } from 'react'
import { BASE } from '@/utils/basePath'
import { disableMotion, enableMotion, motionSupported } from '../scene/motion'
import { useMindspace } from '../store'

/**
 * The few persistent controls. Top-left: back to the 3D city. Top-right: Reset
 * view (always reachable, wherever the visitor is looking) and — on phones and
 * tablets with orientation sensors — an opt-in for motion controls. App
 * windows have their own close button; Escape closes them too.
 */
export function Controls() {
  const app = useMindspace((s) => s.app)
  const phase = useMindspace((s) => s.phase)
  const fallback = useMindspace((s) => s.fallback)
  const reset = useMindspace((s) => s.resetView)
  const [hint, setHint] = useState(false)
  const [motion, setMotion] = useState<'off' | 'on' | 'busy'>('off')
  const [note, setNote] = useState<string | null>(null)
  const canMotion = !fallback && motionSupported()

  useEffect(() => {
    if (phase !== 'room' || fallback) return
    const touch = matchMedia('(pointer: coarse)').matches
    setHint(true)
    const t = setTimeout(() => setHint(false), touch ? 6500 : 7500)
    return () => clearTimeout(t)
  }, [phase, fallback])
  // leaving Mindspace (or this control going away) stops listening to the sensors
  useEffect(() => () => disableMotion(), [])
  useEffect(() => {
    if (!note) return
    const t = setTimeout(() => setNote(null), 4000)
    return () => clearTimeout(t)
  }, [note])
  if (phase !== 'room') return null
  const touch = matchMedia('(pointer: coarse)').matches

  const toggleMotion = async () => {
    if (motion === 'on') {
      disableMotion()
      setMotion('off')
      return
    }
    setMotion('busy')
    const r = await enableMotion()
    setMotion(r === 'on' ? 'on' : 'off')
    if (r === 'denied') setNote('Motion access wasn’t allowed — drag to look around instead.')
    if (r === 'unsupported') setNote('This device doesn’t report its orientation — drag to look around instead.')
  }

  return (
    <>
      <a className="ms-pill ms-back" href={`${BASE}street`} aria-label="Leave Mindspace and return to the 3D city">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 6l-6 6 6 6" /></svg>
        <span>3D city</span>
      </a>
      {!fallback && (
        <div className="ms-controls" role="toolbar" aria-label="View controls">
          {canMotion && (
            <button
              className={`ms-round ${motion === 'on' ? 'is-on' : ''}`}
              onClick={() => void toggleMotion()}
              disabled={motion === 'busy'}
              aria-pressed={motion === 'on'}
              aria-label={motion === 'on' ? 'Disable motion controls' : 'Enable motion controls'}
              title={motion === 'on' ? 'Disable motion controls' : 'Enable motion controls'}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="7" y="3.5" width="10" height="17" rx="2.2" /><path d="M3.5 9.5c-1 1.5-1 3.5 0 5M20.5 9.5c1 1.5 1 3.5 0 5" /></svg>
            </button>
          )}
          <button className="ms-round" onClick={reset} aria-label="Reset view" title="Reset view">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4.5 12a7.5 7.5 0 1 0 2.2-5.3" /><path d="M4.5 4.5v3.8h3.8" /></svg>
          </button>
        </div>
      )}
      {note && <p className="ms-note" role="status">{note}</p>}
      {!fallback && (
        <p className={`ms-hint ${hint && !app ? 'is-visible' : ''}`} aria-hidden={!hint}>
          {touch ? 'Drag to look around · pinch to zoom · tap an app' : 'Drag to look around · arrows to look · W A S D to step · scroll to zoom'}
        </p>
      )}
    </>
  )
}
