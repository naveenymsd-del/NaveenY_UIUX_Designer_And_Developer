import { useEffect, useState } from 'react'
import { INTRO, introRuntime, markIntroSeen, skipIntro } from '@/core/intro'
import { beginJourney } from '@/core/journey'
import { openGuide } from '@/ai/openGuide'
import { CompanionGlyph } from './CompanionGlyph'
import { partOfDay } from '@/ai/guidePrompt'
import { useGameStore } from '@/stores/gameStore'
import { useUIStore } from '@/stores/uiStore'
import { SoundButton } from './SoundButton'
import { DayNightToggle } from './DayNightToggle'
import { WorldStatus } from './WorldStatus'
import { PROFILE } from '@/data/portfolioContent'
import { BASE } from '@/utils/basePath'

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

  // the AI Guide: the same panel every other entry point opens (chat ready; voice on request)
  const askGuide = () => {
    beginJourney('street')
    whenPlaying(() => openGuide())
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
        <p className="ui-intro__welcome">Good {partOfDay(new Date().getHours())}. Welcome to <span className="ui-grad-text">Naveen’s world</span> — how would you like to explore?</p>
        {/* one primary action, two equal secondary ones; then a quiet link and the classic portfolio */}
        <div className="ui-intro__actions ui-intro__ways">
          <button className="ui-btn ui-btn--primary ui-btn--lg ui-btn--hero" onClick={() => beginJourney('street')} tabIndex={tab} autoFocus={hero}>
            Start exploring
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h13m-5-6 6 6-6 6" /></svg>
          </button>
          <button className="ui-btn ui-btn--glass ui-btn--lg ui-intro__way" onClick={map} tabIndex={tab} aria-label="Explore the map — see every place and walk there">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5 3.5 7v12L9 17l6 2 5.5-2V5L15 7 9 5zM9 5v12M15 7v12" /></svg>
            Explore the map
          </button>
          <button className="ui-btn ui-btn--glass ui-btn--lg ui-intro__way ui-intro__ask" onClick={askGuide} tabIndex={tab} aria-label="Ask AI Guide — chat or talk with Naveen’s AI guide">
            <span className="ui-intro__ask-avatar" aria-hidden="true"><CompanionGlyph size={22} /></span>
            Ask AI Guide
          </button>
        </div>
        <div className="ui-intro__links">
          <button className="ui-intro__work" onClick={() => beginJourney('work')} tabIndex={tab}>
            View my work
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h13m-5-6 6 6-6 6" /></svg>
          </button>
          {/* the spatial portfolio (/mindspace) — a full page load, so the city is never kept running behind it */}
          <a className="ui-intro__work ui-intro__classic" href={`${BASE}mindspace`} tabIndex={tab}>
            Explore the Classic Portfolio
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h13m-5-6 6 6-6 6" /></svg>
          </a>
        </div>      </section>

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
