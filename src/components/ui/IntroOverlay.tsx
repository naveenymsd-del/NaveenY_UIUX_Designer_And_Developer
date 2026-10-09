import { useEffect, useState } from 'react'
import { INTRO, introRuntime, markIntroSeen, skipIntro } from '@/core/intro'
import { beginJourney } from '@/core/journey'
import { enableText, submit } from '@/ai/guide'
import { partOfDay } from '@/ai/guidePrompt'
import { useGameStore } from '@/stores/gameStore'
import { useUIStore } from '@/stores/uiStore'
import { SoundButton } from './SoundButton'
import { DayNightToggle } from './DayNightToggle'
import { WorldStatus } from './WorldStatus'
import { PROFILE } from '@/data/portfolioContent'

/** once the camera has settled behind the avatar, do this */
function whenPlaying(fn: () => void) {
  const unsub = useGameStore.subscribe((s) => {
    if (s.phase === 'playing') {
      unsub()
      setTimeout(fn, 700)
    }
  })
}

/**
 * Landing, layered over the opening flight. While the camera travels only a
 * quiet credit and "Skip intro" are on screen, so the world is the first thing
 * you see. When the flight lands on the avatar: a time-aware welcome and the
 * three ways to explore — on your own, with the AI guide, or from the map.
 */
export function IntroOverlay() {
  const phase = useGameStore((s) => s.phase)
  const [t, setT] = useState(0)

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
  const tab = hero ? 0 : -1

  const guideMe = () => {
    beginJourney('street')
    whenPlaying(() => {
      enableText()
      void submit('Guide me')
    })
  }
  const map = () => {
    beginJourney('street')
    whenPlaying(() => useUIStore.getState().setMenuOpen(true))
  }

  return (
    <div className={`ui-intro ${leaving ? 'is-leaving' : ''} ${hero ? 'is-hero' : ''}`}>
      <div className={`ui-intro__credit ${credit ? 'is-visible' : ''}`} aria-hidden={!credit}>
        <span className="ui-intro__credit-name">{PROFILE.name}</span>
        <span className="ui-intro__credit-role">{PROFILE.role}</span>
      </div>

      <section className="ui-intro__hero" aria-hidden={!hero} aria-labelledby="intro-title">
        <p className="ui-intro__eyebrow">{PROFILE.role}</p>
        <h1 id="intro-title" className="ui-intro__title">{PROFILE.name}</h1>
        <p className="ui-intro__subtitle">{PROFILE.tagline}</p>
        <p className="ui-intro__welcome">Good {partOfDay(new Date().getHours())}. Welcome to Naveen’s world — how would you like to explore?</p>
        <div className="ui-intro__actions ui-intro__ways">
          <button className="ui-btn ui-btn--primary ui-btn--lg" onClick={() => beginJourney('street')} tabIndex={tab} autoFocus={hero}>
            Start exploring
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h13m-5-6 6 6-6 6" /></svg>
          </button>
          <button className="ui-btn ui-btn--glass ui-btn--lg ui-intro__way" onClick={guideMe} tabIndex={tab} aria-label="Guide me — the AI guide walks you through Naveen’s world">
            <span aria-hidden="true" className="ui-intro__dot" />
            Guide me
          </button>
          <button className="ui-btn ui-btn--glass ui-btn--lg ui-intro__way" onClick={map} tabIndex={tab} aria-label="Explore the map — see every place">
            Explore the map
          </button>
        </div>
        <button className="ui-intro__work" onClick={() => beginJourney('work')} tabIndex={tab}>
          View my work
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h13m-5-6 6 6-6 6" /></svg>
        </button>
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
