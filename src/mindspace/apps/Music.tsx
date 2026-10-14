import { type ReactNode, useEffect, useMemo, useState } from 'react'
import { Artwork } from '../music/Artwork'
import { next, play, prev, seek, setVolume, toggle, toggleMute, usePlayer, usePosition } from '../music/engine'
import { ALBUMS, albumById, albumOf, fmt, ORIGINALS_NOTE, PLAYLISTS, type Rec, spotifySearch, TRACKS, trackById, tracksOf, ytMusicSearch } from '../music/library'

/**
 * The Music Lounge. A spatial music app: a floating tab rail, a library
 * sidebar, artwork tiles, and a glass player bar — plus a monochrome
 * "Now Playing" turntable. All playback goes through the one shared engine.
 */
type View = { k: 'now' } | { k: 'albums' } | { k: 'songs' } | { k: 'album'; id: string } | { k: 'playlist'; id: string } | { k: 'search' }

const I = {
  play: <path d="M8 5.5v13l10.5-6.5z" fill="currentColor" stroke="none" />,
  pause: <path d="M7.5 5.5h3v13h-3zM13.5 5.5h3v13h-3z" fill="currentColor" stroke="none" />,
  next: <path d="M5 6v12l7.5-6zM12.5 6v12l7.5-6z" fill="currentColor" stroke="none" />,
  prev: <path d="M19 6v12l-7.5-6zM11.5 6v12L4 12z" fill="currentColor" stroke="none" />,
  grid: <path d="M4.5 4.5h6v6h-6zM13.5 4.5h6v6h-6zM4.5 13.5h6v6h-6zM13.5 13.5h6v6h-6z" />,
  now: <><circle cx="12" cy="12" r="8" /><path d="M10 8.8v6.4l5-3.2z" fill="currentColor" /></>,
  songs: <path d="M9 18.5a2.5 2.5 0 1 1-2.5-2.5H9V5.5l10-2v12a2.5 2.5 0 1 1-2.5-2.5H19" />,
  search: <><circle cx="11" cy="11" r="6" /><path d="M20 20l-4.6-4.6" /></>,
  list: <path d="M8 6.5h12M8 12h12M8 17.5h12M4 6.5h.01M4 12h.01M4 17.5h.01" />,
  vol: <path d="M4 9.5h3.5L12 6v12l-4.5-3.5H4zM15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11" />,
  mute: <path d="M4 9.5h3.5L12 6v12l-4.5-3.5H4zM16 9.5l5 5M21 9.5l-5 5" />,
  out: <path d="M8 16l8-8M10 8h6v6" />,
  chev: <path d="M6 9l6 6 6-6" />,
  back: <path d="M15 6l-6 6 6 6" />,
  shuffle: <path d="M4 7h3.5c4.5 0 6.5 10 11 10H20M4 17h3.5c1.6 0 2.8-1.2 3.8-2.8M14 9.3c1-1.3 2.3-2.3 4.5-2.3H20M18 4.5 20.5 7 18 9.5M18 14.5l2.5 2.5-2.5 2.5" />,
}
const Icon = ({ d, label }: { d: ReactNode; label?: string }) => <svg viewBox="0 0 24 24" aria-hidden={label ? undefined : true} aria-label={label}>{d}</svg>

export function Music() {
  const [view, setView] = useState<View>(() => (usePlayer.getState().started ? { k: 'now' } : { k: 'albums' }))
  const [q, setQ] = useState('')
  const [lists, setLists] = useState(true)
  const go = (v: View) => { setView(v); if (v.k !== 'search') setQ('') }
  const tab = view.k === 'album' ? 'albums' : view.k === 'playlist' ? 'playlist' : view.k

  return (
    <div className={`mu mu--${view.k}`} data-keys-own>
      <nav className="mu-rail" aria-label="Music">
        {([['now', 'Now Playing', I.now], ['albums', 'Albums', I.grid], ['songs', 'Songs', I.songs], ['search', 'Search', I.search]] as const).map(([k, label, ic]) => (
          <button key={k} className={tab === k ? 'is-on' : ''} aria-current={tab === k ? 'page' : undefined} onClick={() => go({ k } as View)} aria-label={label} title={label}>
            <Icon d={ic} />
          </button>
        ))}
      </nav>

      <aside className="mu-side">
        <header className="mu-side__head">
          <h2>Library</h2>
          <p>Original music</p>
        </header>
        <ul className="mu-nav">
          <li><button className={tab === 'now' ? 'is-on' : ''} onClick={() => go({ k: 'now' })}><Icon d={I.now} />Now Playing</button></li>
          <li><button className={tab === 'albums' ? 'is-on' : ''} onClick={() => go({ k: 'albums' })}><Icon d={I.grid} />Albums</button></li>
          <li><button className={tab === 'songs' ? 'is-on' : ''} onClick={() => go({ k: 'songs' })}><Icon d={I.songs} />Songs</button></li>
        </ul>
        <button className="mu-side__h3" onClick={() => setLists((v) => !v)} aria-expanded={lists}>
          Playlists <Icon d={I.chev} />
        </button>
        {lists && (
          <ul className="mu-nav mu-nav--lists">
            {PLAYLISTS.map((p) => {
              const first = trackById(p.trackIds[0])
              return (
                <li key={p.id}>
                  <button className={view.k === 'playlist' && view.id === p.id ? 'is-on' : ''} onClick={() => go({ k: 'playlist', id: p.id })}>
                    {first ? <Artwork album={albumOf(first)} className="mu-thumb" /> : <span className="mu-thumb mu-thumb--out" aria-hidden="true"><Icon d={I.out} /></span>}
                    {p.title}
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </aside>

      {/* phones: the same destinations as a row of chips */}
      <nav className="mu-chips" aria-label="Music sections">
        <button className={tab === 'now' ? 'is-on' : ''} onClick={() => go({ k: 'now' })}>Now Playing</button>
        <button className={tab === 'albums' ? 'is-on' : ''} onClick={() => go({ k: 'albums' })}>Albums</button>
        <button className={tab === 'songs' ? 'is-on' : ''} onClick={() => go({ k: 'songs' })}>Songs</button>
        {PLAYLISTS.map((p) => <button key={p.id} className={view.k === 'playlist' && view.id === p.id ? 'is-on' : ''} onClick={() => go({ k: 'playlist', id: p.id })}>{p.title}</button>)}
        <button className={tab === 'search' ? 'is-on' : ''} onClick={() => go({ k: 'search' })}>Search</button>
      </nav>

      <main className="mu-main" key={JSON.stringify(view)}>
        {view.k === 'now' && <NowPlaying onBrowse={() => go({ k: 'albums' })} />}
        {view.k === 'albums' && <Albums q={q} setQ={setQ} open={(id) => go({ k: 'album', id })} />}
        {view.k === 'songs' && <Songs />}
        {view.k === 'album' && <AlbumView id={view.id} back={() => go({ k: 'albums' })} />}
        {view.k === 'playlist' && <PlaylistView id={view.id} />}
        {view.k === 'search' && <Search q={q} setQ={setQ} open={(id) => go({ k: 'album', id })} />}
      </main>

      <PlayerBar onNow={() => go({ k: 'now' })} />
    </div>
  )
}

function Head({ title, sub, children }: { title: string; sub: string; children?: ReactNode }) {
  return (
    <header className="mu-head">
      <div>
        <h2>{title}</h2>
        <p>{sub}</p>
      </div>
      {children}
    </header>
  )
}
function SearchField({ q, setQ, auto = false, label }: { q: string; setQ: (v: string) => void; auto?: boolean; label: string }) {
  return (
    <label className="mu-search">
      <Icon d={I.search} />
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={label} aria-label={label} autoFocus={auto} />
    </label>
  )
}

function Albums({ q, setQ, open }: { q: string; setQ: (v: string) => void; open: (id: string) => void }) {
  const list = ALBUMS.filter((a) => !q || `${a.title} ${tracksOf(a.id).map((t) => t.title).join(' ')}`.toLowerCase().includes(q.toLowerCase()))
  return (
    <>
      <Head title="Albums" sub={`${ALBUMS.length} albums · ${TRACKS.length} original tracks`} />
      <SearchField q={q} setQ={setQ} label="Search in Albums" />
      {list.length ? (
        <ul className="mu-grid">
          {list.map((a) => (
            <li key={a.id}>
              <button className="mu-tile" onClick={() => open(a.id)}>
                <Artwork album={a} />
                <b>{a.title}</b>
                <span>{a.artist}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mu-empty">No albums match “{q}”.</p>
      )}
      <p className="mu-note">{ORIGINALS_NOTE}</p>
    </>
  )
}

function Rows({ ids, numbered = true }: { ids: string[]; numbered?: boolean }) {
  const cur = usePlayer((s) => s.trackId)
  const status = usePlayer((s) => s.status)
  if (!ids.length) return null
  return (
    <ol className="mu-rows">
      {ids.map((id, i) => {
        const t = trackById(id)!
        const on = cur === id
        const playing = on && status === 'playing'
        return (
          <li key={id}>
            <button className={`mu-row ${on ? 'is-current' : ''}`} onClick={() => (on ? toggle() : void play(id, ids))} aria-label={`${playing ? 'Pause' : 'Play'} ${t.title}`} aria-current={on ? 'true' : undefined}>
              <span className="mu-row__n">{playing ? <i className="mu-eq" aria-hidden="true"><b /><b /><b /></i> : numbered ? i + 1 : ''}</span>
              <Artwork album={albumOf(t)} className="mu-row__art" />
              <span className="mu-row__t"><b>{t.title}</b><small>{albumOf(t).artist} · {albumOf(t).title}</small></span>
              <span className="mu-row__d">{fmt(t.duration)}</span>
            </button>
          </li>
        )
      })}
    </ol>
  )
}

function Songs() {
  const ids = TRACKS.map((t) => t.id)
  return (
    <>
      <Head title="Songs" sub={`${ids.length} original tracks`}>
        <button className="mu-btn mu-btn--primary" onClick={() => void play(ids[0], ids)}><Icon d={I.play} />Play all</button>
      </Head>
      <Rows ids={ids} />
    </>
  )
}

function AlbumView({ id, back }: { id: string; back: () => void }) {
  const a = albumById(id)
  const ids = tracksOf(id).map((t) => t.id)
  const total = tracksOf(id).reduce((n, t) => n + t.duration, 0)
  return (
    <>
      <button className="mu-back" onClick={back}><Icon d={I.back} />Albums</button>
      <div className="mu-album">
        <Artwork album={a} className="mu-album__art" />
        <div>
          <p className="mu-eyebrow">Album</p>
          <h2>{a.title}</h2>
          <p className="mu-album__by">{a.artist} · {ids.length} songs · {Math.round(total / 60)} min</p>
          <p className="mu-album__blurb">{a.blurb}</p>
          <div className="mu-actions">
            <button className="mu-btn mu-btn--primary" onClick={() => void play(ids[0], ids)}><Icon d={I.play} />Play</button>
            <button className="mu-btn" onClick={() => { const sh = [...ids].sort(() => Math.random() - 0.5); void play(sh[0], sh) }}><Icon d={I.shuffle} />Shuffle</button>
          </div>
        </div>
      </div>
      <Rows ids={ids} />
    </>
  )
}

function Elsewhere({ recs }: { recs: Rec[] }) {
  if (!recs.length) return null
  return (
    <section className="mu-else">
      <h3>Listen elsewhere</h3>
      <p className="mu-note">Famous songs we recommend. They aren’t played here — each link opens a search on Spotify or YouTube Music in a new tab.</p>
      <ul>
        {recs.map((r) => (
          <li key={r.title}>
            <span className="mu-else__t"><b>{r.title}</b><small>{r.artist}</small></span>
            <a href={spotifySearch(r)} target="_blank" rel="noopener noreferrer" aria-label={`Find ${r.title} by ${r.artist} on Spotify (opens in a new tab)`}>Spotify <Icon d={I.out} /></a>
            <a href={ytMusicSearch(r)} target="_blank" rel="noopener noreferrer" aria-label={`Find ${r.title} by ${r.artist} on YouTube Music (opens in a new tab)`}>YouTube Music <Icon d={I.out} /></a>
          </li>
        ))}
      </ul>
    </section>
  )
}

function PlaylistView({ id }: { id: string }) {
  const p = PLAYLISTS.find((x) => x.id === id)!
  return (
    <>
      <Head title={p.title} sub={p.trackIds.length ? `${p.trackIds.length} playable here · ${p.elsewhere.length} to open elsewhere` : `${p.elsewhere.length} songs to open elsewhere`}>
        {p.trackIds.length > 0 && <button className="mu-btn mu-btn--primary" onClick={() => void play(p.trackIds[0], p.trackIds)}><Icon d={I.play} />Play</button>}
      </Head>
      <p className="mu-blurb">{p.blurb}</p>
      <Rows ids={p.trackIds} />
      <Elsewhere recs={p.elsewhere} />
    </>
  )
}

function Search({ q, setQ, open }: { q: string; setQ: (v: string) => void; open: (id: string) => void }) {
  const s = q.trim().toLowerCase()
  const tracks = s ? TRACKS.filter((t) => `${t.title} ${albumOf(t).title}`.toLowerCase().includes(s)).map((t) => t.id) : []
  const albums = s ? ALBUMS.filter((a) => a.title.toLowerCase().includes(s)) : []
  const recs = s ? PLAYLISTS.flatMap((p) => p.elsewhere).filter((r) => `${r.title} ${r.artist}`.toLowerCase().includes(s)) : []
  return (
    <>
      <Head title="Search" sub="Originals you can play here, and songs to open elsewhere" />
      <SearchField q={q} setQ={setQ} auto label="Songs, albums, artists" />
      {!s && <p className="mu-empty">Try “sun”, “focus” or “Queen”.</p>}
      {s && !tracks.length && !albums.length && !recs.length && <p className="mu-empty">Nothing found for “{q}”.</p>}
      {albums.length > 0 && (
        <ul className="mu-grid mu-grid--small">
          {albums.map((a) => <li key={a.id}><button className="mu-tile" onClick={() => open(a.id)}><Artwork album={a} /><b>{a.title}</b><span>Album</span></button></li>)}
        </ul>
      )}
      <Rows ids={tracks} numbered={false} />
      <Elsewhere recs={recs} />
    </>
  )
}

function useClock() {
  const [d, setD] = useState(() => new Date())
  useEffect(() => {
    const id = window.setInterval(() => setD(new Date()), 15000)
    return () => clearInterval(id)
  }, [])
  return d
}

/** monochrome turntable: the record spins and the tonearm swings in while playing */
function NowPlaying({ onBrowse }: { onBrowse: () => void }) {
  const s = usePlayer()
  const pos = usePosition()
  const t = trackById(s.trackId) ?? TRACKS[0]
  const a = albumOf(t)
  const playing = s.status === 'playing'
  const now = useClock()
  const upNext = useMemo(() => {
    const i = s.queue.indexOf(t.id)
    return [1, 2, 3].map((k) => trackById(s.queue[(i + k) % s.queue.length])!).filter(Boolean)
  }, [s.queue, t.id])
  return (
    <div className="mu-now">
      <div className="mu-widgets">
        <p className="mu-now__date">{now.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })} · {now.toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short' })}</p>
        <div className="mu-widget mu-widget--track">
          <Artwork album={a} mono />
          <b>{t.title}</b>
          <small>{a.artist}</small>
          <button className="mu-mini-play" onClick={toggle} aria-label={playing ? 'Pause' : 'Play'}><Icon d={playing ? I.pause : I.play} /></button>
        </div>
        <div className="mu-widget mu-widget--clock" aria-hidden="true">{now.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: false })}</div>
        <div className="mu-widget mu-widget--next">
          <small>Up next</small>
          {upNext.map((n) => <button key={n.id} onClick={() => void play(n.id)}>{n.title}</button>)}
        </div>
        <p className="mu-journal"><small>Journal</small>What made you smile today?</p>
      </div>
      <div className="mu-deck">
        <div className={`mu-table ${playing ? 'is-playing' : ''}`}>
          <span className="mu-table__pitch" aria-hidden="true"><i /></span>
          <span className="mu-table__knob" aria-hidden="true" />
          <span className="mu-table__lcd" aria-hidden="true">33 · 45</span>
          <div className="mu-platter" aria-hidden="true">
            <div className="mu-record">
              <div className="mu-record__label">
                <b>{a.title.toUpperCase()}</b>
                <small>{a.artist}</small>
              </div>
            </div>
            <span className="mu-record__sheen" />
          </div>
          <span className="mu-arm" aria-hidden="true"><i /></span>
          <button className="mu-table__start" onClick={toggle} aria-label={playing ? 'Stop the record' : 'Start the record'}>{playing ? 'STOP' : 'START'}</button>
        </div>
        <div className="mu-card">
          <b>{t.title}</b>
          <span>{a.artist} · {a.title}</span>
          <Progress pos={pos} dur={t.duration} />
          <div className="mu-card__ctl">
            <button onClick={() => void prev()} aria-label="Previous track"><Icon d={I.prev} /></button>
            <button className="mu-card__play" onClick={toggle} aria-label={playing ? 'Pause' : 'Play'}><Icon d={playing ? I.pause : I.play} /></button>
            <button onClick={() => void next()} aria-label="Next track"><Icon d={I.next} /></button>
          </div>
          {!s.started && <button className="mu-link" onClick={onBrowse}>Browse the albums</button>}
        </div>
      </div>
    </div>
  )
}

function Progress({ pos, dur }: { pos: number; dur: number }) {
  return (
    <div className="mu-progress">
      <span>{fmt(pos)}</span>
      <input type="range" min={0} max={Math.floor(dur)} step={1} value={Math.floor(pos)} onChange={(e) => seek(Number(e.target.value))} aria-label="Seek" style={{ ['--p' as string]: `${(pos / dur) * 100}%` }} />
      <span>-{fmt(dur - pos)}</span>
    </div>
  )
}

/** the floating glass player along the bottom of the lounge */
export function PlayerBar({ onNow }: { onNow: () => void }) {
  const s = usePlayer()
  const pos = usePosition()
  const t = trackById(s.trackId) ?? TRACKS[0]
  const a = albumOf(t)
  const playing = s.status === 'playing' || s.status === 'loading'
  return (
    <div className="mu-bar" role="region" aria-label="Player">
      <div className="mu-bar__ctl">
        <button onClick={() => void prev()} aria-label="Previous track"><Icon d={I.prev} /></button>
        <button className="mu-bar__play" onClick={toggle} aria-label={playing ? 'Pause' : 'Play'}><Icon d={playing ? I.pause : I.play} /></button>
        <button onClick={() => void next()} aria-label="Next track"><Icon d={I.next} /></button>
      </div>
      <button className="mu-bar__track" onClick={onNow} aria-label={`Now playing: ${t.title}. Open Now Playing`}>
        <Artwork album={a} />
        <span><b>{t.title}</b><small>{a.artist} · {a.title}</small></span>
        <i className="mu-bar__line" style={{ ['--p' as string]: `${(pos / t.duration) * 100}%` }} aria-hidden="true" />
      </button>
      <div className="mu-bar__vol">
        <button onClick={toggleMute} aria-label={s.muted ? 'Unmute' : 'Mute'} aria-pressed={s.muted}><Icon d={s.muted || s.volume === 0 ? I.mute : I.vol} /></button>
        <input type="range" min={0} max={1} step={0.01} value={s.muted ? 0 : s.volume} onChange={(e) => setVolume(Number(e.target.value))} aria-label="Volume" style={{ ['--p' as string]: `${(s.muted ? 0 : s.volume) * 100}%` }} />
        <button onClick={onNow} aria-label="Queue and Now Playing" title="Now Playing"><Icon d={I.list} /></button>
      </div>
      {s.status === 'error' && <p className="mu-bar__err" role="alert">{s.error}</p>}
    </div>
  )
}
