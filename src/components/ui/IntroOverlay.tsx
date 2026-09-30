import { useEffect, useState } from 'react'
import { INTRO, introRuntime, markIntroSeen, skipIntro } from '@/core/intro'
import { beginJourney } from '@/core/journey'
import { useGameStore } from '@/stores/gameStore'
import { SoundButton } from './SoundButton'
import { DayNightToggle } from './DayNightToggle'
import { useDayNight } from '@/core/dayNight'
import { WorldStatus } from './WorldStatus'

/**
 * Landing, layered over the opening flight. While the camera travels only a
 * quiet credit and "Skip intro" are on screen, so the world is the first thing
 * you see. When the flight lands on the avatar, the hero copy and the two
 * actions appear; the companion does the talking in its own bubble.
 */
export function IntroOverlay() {
  const phase = useGameStore((s) => s.phase)
  const [t, setT] = useState(0)
  const night = useDayNight((s) => s.night)

  useEffect(() => {
    if (phase !== 'intro') return
    const id = setInterval(() => setT(introRuntime.t), 120)
    return () => clearInterval(id)
  }, [phase])

  // remember the intro for this session so returning visitors land on the hero
  useEffect(() => {
    if (t >= INTRO.heroAt - 0.4) markIntroSeen()
  }, [t])

  if (phase !== 'intro' && phase !== 'transition') return null
  const hero = t >= INTRO.heroAt - 0.4
  const credit = t > INTRO.planeEnd + 0.4 && !hero
  const leaving = phase === 'transition'

  return (
    <div className={`ui-intro ${leaving ? 'is-leaving' : ''} ${hero ? 'is-hero' : ''}`}>
      <div className={`ui-intro__credit ${credit ? 'is-visible' : ''}`} aria-hidden={!credit}>
        <span className="ui-intro__credit-name">Naveen</span>
        <span className="ui-intro__credit-role">UI/UX Designer</span>
      </div>

      <section className="ui-intro__hero" aria-hidden={!hero} aria-labelledby="intro-title">
        <p className="ui-intro__eyebrow">UI/UX Designer · Interactive portfolio</p>
        <h1 id="intro-title" className="ui-intro__title">Naveen</h1>
        <p className="ui-intro__subtitle">Designing human experiences with technology and&nbsp;AI.</p>
        <p className="ui-intro__welcome">{night ? 'Welcome. Ready to explore?' : 'Welcome. Take your time exploring my world.'}</p>
        <div className="ui-intro__actions">
          <button className="ui-btn ui-btn--primary ui-btn--lg" onClick={() => beginJourney('street')} tabIndex={hero ? 0 : -1} autoFocus={hero}>
            Start exploring
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h13m-5-6 6 6-6 6" /></svg>
          </button>
          <button className="ui-btn ui-btn--quiet ui-btn--lg" onClick={() => beginJourney('work')} tabIndex={hero ? 0 : -1}>
            View my work
          </button>
        </div>
      </section>

      <div className={`ui-intro__status ${hero && !leaving ? 'is-visible' : ''}`}>
        <WorldStatus />
        <DayNightToggle />
        <SoundButton />
      </div>

      {!hero && !leaving && (
        <button className="ui-intro__skip" onClick={skipIntro} aria-label="Skip intro">
          Skip intro
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l7 6-7 6M15 6v12" /></svg>
        </button>
      )}
    </div>
  )
}
