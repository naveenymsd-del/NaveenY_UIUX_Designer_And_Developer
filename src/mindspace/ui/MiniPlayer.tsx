import { useEffect, useState } from 'react'
import { Artwork } from '../music/Artwork'
import { next, play, toggle, toggleMute, usePlayer, usePosition } from '../music/engine'
import { albumOf, TRACKS, trackById } from '../music/library'
import { useMindspace } from '../store'

const DISMISS = 'mindspace:music-invite-dismissed'
const dismissed = () => { try { return localStorage.getItem(DISMISS) === '1' } catch { return false } }

/**
 * Music outside the Music Lounge. Before anything plays: a quiet "Set the
 * mood" invitation (never autoplay). Once the visitor has pressed play: a
 * compact glass mini-player that stays put while other apps open and close.
 * Hidden while the lounge itself is open (it has the full player).
 */
export function MiniPlayer() {
  const s = usePlayer()
  const app = useMindspace((m) => m.app)
  const phase = useMindspace((m) => m.phase)
  const open = useMindspace((m) => m.open)
  const swap = useMindspace((m) => m.swap)
  const [invite, setInvite] = useState(false)
  const pos = usePosition()

  // the invitation arrives once the room has settled (after the first hint)
  useEffect(() => {
    if (phase !== 'room' || s.started || dismissed()) return
    const id = window.setTimeout(() => setInvite(true), 8500)
    return () => clearTimeout(id)
  }, [phase, s.started])
  // the invitation only shows in the room itself; once music is playing the mini-player stays everywhere (except the lounge)
  const visible = phase === 'room' && app !== 'music' && (s.started || (invite && !app))
  useEffect(() => {
    document.querySelector('.ms')?.classList.toggle('has-mini', visible)
  }, [visible])
  if (!visible) return null
  const openLounge = () => (app ? swap('music') : open('music'))

  if (!s.started) {
    return (
      <div className="ms-mini ms-mini--invite" role="region" aria-label="Music">
        <span className="ms-mini__note" aria-hidden="true">♪</span>
        <span className="ms-mini__text"><b>Set the mood</b><small>Original music, made for this room</small></span>
        <button className="ms-mini__cta" onClick={() => void play(usePlayer.getState().trackId ?? TRACKS[0].id)}>
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5v13l10.5-6.5z" /></svg>Play
        </button>
        <button className="ms-mini__link" onClick={openLounge}>Music Lounge</button>
        <button className="ms-mini__x" onClick={() => { setInvite(false); try { localStorage.setItem(DISMISS, '1') } catch { /* fine */ } }} aria-label="Dismiss">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 7l10 10M17 7 7 17" /></svg>
        </button>
      </div>
    )
  }
  const t = trackById(s.trackId) ?? TRACKS[0]
  const a = albumOf(t)
  const playing = s.status === 'playing' || s.status === 'loading'
  return (
    <div className="ms-mini" role="region" aria-label="Music player">
      <button className="ms-mini__track" onClick={openLounge} aria-label={`${t.title} — open the Music Lounge`}>
        <Artwork album={a} />
        <span><b>{t.title}</b><small>{s.status === 'error' ? s.error : a.title}</small></span>
      </button>
      <button className="ms-mini__btn" onClick={toggle} aria-label={playing ? 'Pause music' : 'Play music'}>
        <svg viewBox="0 0 24 24" aria-hidden="true">{playing ? <path d="M7.5 5.5h3v13h-3zM13.5 5.5h3v13h-3z" /> : <path d="M8 5.5v13l10.5-6.5z" />}</svg>
      </button>
      <button className="ms-mini__btn" onClick={() => void next()} aria-label="Next track">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 6v12l7.5-6zM12.5 6v12l7.5-6z" /></svg>
      </button>
      <button className="ms-mini__btn" onClick={toggleMute} aria-label={s.muted ? 'Unmute all sound' : 'Mute all sound'} aria-pressed={s.muted}>
        <svg viewBox="0 0 24 24" aria-hidden="true" className="is-line">{s.muted ? <path d="M4 9.5h3.5L12 6v12l-4.5-3.5H4zM16 9.5l5 5M21 9.5l-5 5" /> : <path d="M4 9.5h3.5L12 6v12l-4.5-3.5H4zM15.5 9a4 4 0 0 1 0 6" />}</svg>
      </button>
      <i className="ms-mini__line" style={{ ['--p' as string]: `${(pos / t.duration) * 100}%` }} aria-hidden="true" />
    </div>
  )
}
