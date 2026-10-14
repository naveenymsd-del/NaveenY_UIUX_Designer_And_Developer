import { useEffect, useState } from 'react'
import { EmojiPanic } from './EmojiPanic'
import { PopChaos } from './PopChaos'
import { type GameId, readBest } from './shared'
import { WobbleTower } from './WobbleTower'
import '../../joylab.css'

/**
 * JOY LAB — three small games made from scratch for this portfolio.
 * The library, then one game at a time; "Joy Lab" in each game comes back here.
 */
const GAMES: { id: GameId; title: string; line: string; how: string[]; tone: string }[] = [
  { id: 'emoji', title: 'Emoji Panic', line: 'Catch the joy. Dodge the grumps. Do not catch the bomb.', how: ['Mouse', 'Touch', '← →'], tone: 'peach' },
  { id: 'tower', title: 'Wobble Tower', line: 'Stack rubber ducks, donuts and one very brave plant.', how: ['Tap', 'Click', 'Space'], tone: 'mint' },
  { id: 'pop', title: 'Pop the Chaos', line: 'Pop bubbles, start chain reactions, avoid the pufferfish.', how: ['Tap', 'Click', 'Arrows + Space'], tone: 'grape' },
]

export function JoyLab() {
  const [game, setGame] = useState<GameId | null>(null)
  const [launching, setLaunching] = useState<GameId | null>(null)
  const [bests, setBests] = useState(() => Object.fromEntries(GAMES.map((g) => [g.id, readBest(g.id)])) as Record<GameId, number>)
  useEffect(() => {
    if (!game) setBests(Object.fromEntries(GAMES.map((g) => [g.id, readBest(g.id)])) as Record<GameId, number>)
  }, [game])
  const launch = (id: GameId) => {
    setLaunching(id)
    const quick = matchMedia('(prefers-reduced-motion: reduce)').matches
    window.setTimeout(() => { setGame(id); setLaunching(null) }, quick ? 0 : 260)
  }
  const back = () => setGame(null)

  if (game === 'emoji') return <div className="ms-app jl"><EmojiPanic onBack={back} /></div>
  if (game === 'tower') return <div className="ms-app jl"><WobbleTower onBack={back} /></div>
  if (game === 'pop') return <div className="ms-app jl"><PopChaos onBack={back} /></div>

  return (
    <div className="ms-app jl jl--home">
      <header className="jl-title">
        <h2 aria-label="Joy Lab">{'JOY LAB'.split('').map((ch, i) => <span key={i} style={{ ['--i' as string]: i }} aria-hidden="true">{ch === ' ' ? ' ' : ch}</span>)}</h2>
        <p>Three tiny games, made from scratch for this portfolio. Zero productivity, maximum giggles. Best scores stay on this device.</p>
      </header>
      <ul className="jl-cards">
        {GAMES.map((g) => (
          <li key={g.id}>
            <article className={`jl-card jl-card--${g.tone} ${launching === g.id ? 'is-launching' : ''}`}>
              <div className="jl-card__art" aria-hidden="true">{g.id === 'emoji' ? <ArtEmoji /> : g.id === 'tower' ? <ArtTower /> : <ArtPop />}</div>
              <div className="jl-card__body">
                <h3>{g.title}</h3>
                <p>{g.line}</p>
                <ul className="jl-card__how" aria-label="Controls">{g.how.map((h) => <li key={h}>{h}</li>)}</ul>
                <div className="jl-card__foot">
                  <span className="jl-card__best">{bests[g.id] ? <>Best <b>{bests[g.id]}</b></> : 'No score yet'}</span>
                  <button className="jl-play" onClick={() => launch(g.id)} aria-label={`Play ${g.title}`}>
                    Play
                    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5v13l10.5-6.5z" /></svg>
                  </button>
                </div>
              </div>
            </article>
          </li>
        ))}
      </ul>
      <p className="jl-foot">Sound effects follow the room’s mute. Music steps back while you play.</p>
    </div>
  )
}

/* ── card illustrations (CSS-animated, no images) ── */
function ArtEmoji() {
  return (
    <div className="art-emoji">
      {['😂', '🥳', '😠', '🤩', '🌈'].map((e, i) => <span key={i} style={{ ['--i' as string]: i }}>{e}</span>)}
      <i className="art-emoji__bowl"><b /><b /><em /></i>
    </div>
  )
}
function ArtTower() {
  return (
    <div className="art-tower">
      <div className="art-tower__stack">
        <span className="t-duck" />
        <span className="t-donut" />
        <span className="t-cube"><b /><b /><em /></span>
        <span className="t-book" />
      </div>
      <i className="art-tower__base" />
    </div>
  )
}
function ArtPop() {
  return (
    <div className="art-pop">
      {[0, 1, 2, 3, 4, 5, 6].map((i) => <span key={i} style={{ ['--i' as string]: i }}>{i === 2 ? '⭐' : i === 5 ? '🐡' : ''}</span>)}
    </div>
  )
}
