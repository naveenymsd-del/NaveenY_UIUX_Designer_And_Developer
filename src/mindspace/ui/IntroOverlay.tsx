import { useEffect, useState } from 'react'
import { useMindspace } from '../store'

/**
 * Over the opening shot: the title (it rests on screen while the headset turns),
 * "Skip intro" from the first moment, and the veil the camera passes through
 * as it dives into the lens — which then lifts to reveal the room.
 */
export function IntroOverlay({ ready }: { ready: boolean }) {
  const phase = useMindspace((s) => s.phase)
  const beat = useMindspace((s) => s.introBeat)
  const enterRoom = useMindspace((s) => s.enterRoom)
  const [lifting, setLifting] = useState(false)
  const [played, setPlayed] = useState(phase === 'intro')

  // the cut into the room: the veil stays up a moment, then lifts
  useEffect(() => {
    if (phase !== 'room' || !played) return
    setLifting(true)
    const t = setTimeout(() => { setLifting(false); setPlayed(false) }, 1300)
    return () => clearTimeout(t)
  }, [phase, played])

  if (phase === 'room' && !lifting) return null
  const title = phase === 'intro' && beat >= 2.2 && beat < 4.9
  const veil = phase === 'intro' ? Math.min(1, Math.max(0, (beat - 5.0) / 0.6)) : 1
  return (
    <div className={`ms-intro ${phase === 'room' ? 'is-lifting' : ''}`}>
      <div className="ms-intro__veil" style={{ opacity: veil }} aria-hidden="true" />
      {phase === 'intro' && (
        <>
          <div className={`ms-intro__title ${title ? 'is-visible' : ''}`} aria-hidden={!title}>
            <h1>Step Into My Mindspace</h1>
            <p>An immersive journey through my design, projects, and ideas.</p>
          </div>
          {ready && (
            <button className="ms-intro__skip" onClick={enterRoom}>
              Skip intro
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l7 6-7 6M16 6v12" /></svg>
            </button>
          )}
        </>
      )}
    </div>
  )
}
