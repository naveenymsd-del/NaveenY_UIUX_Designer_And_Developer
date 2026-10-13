import { type ReactNode, useCallback, useEffect, useRef, useState } from 'react'

/**
 * Games: three small, self-contained browser games. They live here, apart from
 * the portfolio content. Keys pressed inside a game stay in the game
 * (data-keys-own), so they never move the room camera.
 */
type GameId = 'memory' | 'maze' | 'reaction'
const GAMES: { id: GameId; name: string; line: string; face: string; glyph: ReactNode }[] = [
  { id: 'memory', name: 'Memory Match', line: 'Turn two cards at a time and find all six pairs.', face: 'linear-gradient(135deg, #ffb46b, #f0656d)', glyph: <path d="M5 4.5h7v9H5zM12 10.5h7v9h-7z" /> },
  { id: 'maze', name: 'Maze', line: 'Guide the dot from the top-left to the glowing exit.', face: 'linear-gradient(135deg, #7be0c3, #3a8ef0)', glyph: <path d="M4 4h16v16H4zM8 4v8h4M16 20v-8h-4M4 16h4" /> },
  { id: 'reaction', name: 'Reaction', line: 'Wait for green, then tap as fast as you can. Five rounds.', face: 'linear-gradient(135deg, #c39bff, #6d5df5)', glyph: <path d="M13 3 5 13.5h6L10 21l8-10.5h-6z" /> },
]

export function Games() {
  const [game, setGame] = useState<GameId | null>(null)
  if (game) {
    const g = GAMES.find((x) => x.id === game)!
    return (
      <div className="ms-app ms-game" data-keys-own>
        <button className="ms-back-link" onClick={() => setGame(null)}>
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 6l-6 6 6 6" /></svg> All games
        </button>
        <h2 className="ms-title">{g.name}</h2>
        <p className="ms-muted">{g.line}</p>
        {game === 'memory' && <Memory />}
        {game === 'maze' && <Maze />}
        {game === 'reaction' && <Reaction />}
      </div>
    )
  }
  return (
    <div className="ms-app">
      <p className="ms-intro-line">A short break. Pick a game.</p>
      <ul className="ms-games">
        {GAMES.map((g) => (
          <li key={g.id}>
            <button className="ms-game-card" onClick={() => setGame(g.id)}>
              <span className="ms-game-card__face" style={{ background: g.face }} aria-hidden="true">
                <svg viewBox="0 0 24 24">{g.glyph}</svg>
              </span>
              <b>{g.name}</b>
              <small>{g.line}</small>
              <span className="ms-btn ms-btn--primary ms-btn--sm">Play</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}

/* ── Memory Match ─────────────────────────────────────────────────────── */
const SHAPES: { key: string; color: string; svg: ReactNode }[] = [
  { key: 'circle', color: '#f08a4b', svg: <circle cx="12" cy="12" r="7" /> },
  { key: 'square', color: '#5b7cf0', svg: <rect x="5.5" y="5.5" width="13" height="13" rx="2.5" /> },
  { key: 'triangle', color: '#3fbf9d', svg: <path d="M12 4.5 20 19H4z" /> },
  { key: 'star', color: '#f6c12f', svg: <path d="m12 3.8 2.5 5.3 5.7.7-4.2 3.9 1.1 5.7L12 16.6l-5.1 2.8 1.1-5.7-4.2-3.9 5.7-.7z" /> },
  { key: 'hex', color: '#ef4f78', svg: <path d="M12 3.5 19.5 7.8v8.4L12 20.5l-7.5-4.3V7.8z" /> },
  { key: 'ring', color: '#9668e8', svg: <path d="M12 4.5a7.5 7.5 0 1 1 0 15 7.5 7.5 0 0 1 0-15zm0 4a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7z" fillRule="evenodd" /> },
]
const shuffle = <T,>(a: T[]) => {
  const b = [...a]
  for (let i = b.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[b[i], b[j]] = [b[j], b[i]]
  }
  return b
}
function Memory() {
  const deal = () => shuffle([...SHAPES, ...SHAPES].map((s, i) => ({ id: i, ...s })))
  const [cards, setCards] = useState(deal)
  const [up, setUp] = useState<number[]>([])
  const [found, setFound] = useState<string[]>([])
  const [moves, setMoves] = useState(0)
  const [start, setStart] = useState<number | null>(null)
  const [time, setTime] = useState(0)
  const done = found.length === SHAPES.length

  useEffect(() => {
    if (!start || done) return
    const t = setInterval(() => setTime(Math.floor((Date.now() - start) / 1000)), 250)
    return () => clearInterval(t)
  }, [start, done])
  const flip = (i: number) => {
    if (up.length === 2 || up.includes(i) || found.includes(cards[i].key)) return
    if (!start) setStart(Date.now())
    const next = [...up, i]
    setUp(next)
    if (next.length === 2) {
      setMoves((m) => m + 1)
      const [a, b] = next
      if (cards[a].key === cards[b].key) {
        setFound((f) => [...f, cards[a].key])
        setUp([])
      } else setTimeout(() => setUp([]), 750)
    }
  }
  const restart = () => {
    setCards(deal())
    setUp([])
    setFound([])
    setMoves(0)
    setStart(null)
    setTime(0)
  }
  return (
    <div className="ms-play">
      <div className="ms-play__stats"><span>Moves <b>{moves}</b></span><span>Time <b>{time}s</b></span><span>Pairs <b>{found.length}/6</b></span><button className="ms-btn ms-btn--sm" onClick={restart}>Restart</button></div>
      <ul className="ms-memory">
        {cards.map((c, i) => {
          const open = up.includes(i) || found.includes(c.key)
          return (
            <li key={c.id}>
              <button className={`ms-memory__card ${open ? 'is-open' : ''} ${found.includes(c.key) ? 'is-found' : ''}`} onClick={() => flip(i)} aria-label={open ? c.key : `Card ${i + 1}, face down`} aria-pressed={open}>
                <span className="ms-memory__back" aria-hidden="true" />
                <span className="ms-memory__front" aria-hidden="true"><svg viewBox="0 0 24 24" style={{ fill: c.color }}>{c.svg}</svg></span>
              </button>
            </li>
          )
        })}
      </ul>
      {done && <Done title="All pairs found" line={`${moves} moves · ${time} seconds`} onAgain={restart} />}
    </div>
  )
}

/* ── Maze ─────────────────────────────────────────────────────────────── */
const N = 11
/** a perfect maze (recursive backtracker): walls[cell] = [top, right, bottom, left] */
function makeMaze() {
  const walls = Array.from({ length: N * N }, () => [true, true, true, true])
  const seen = new Set<number>([0])
  const stack = [0]
  while (stack.length) {
    const c = stack[stack.length - 1]
    const x = c % N, y = Math.floor(c / N)
    const opts = ([[0, -1, 0, 2], [1, 0, 1, 3], [0, 1, 2, 0], [-1, 0, 3, 1]] as const)
      .map(([dx, dy, w, ow]) => ({ n: (y + dy) * N + (x + dx), ok: x + dx >= 0 && x + dx < N && y + dy >= 0 && y + dy < N, w, ow }))
      .filter((o) => o.ok && !seen.has(o.n))
    if (!opts.length) { stack.pop(); continue }
    const o = opts[Math.floor(Math.random() * opts.length)]
    walls[c][o.w] = false
    walls[o.n][o.ow] = false
    seen.add(o.n)
    stack.push(o.n)
  }
  return walls
}
function Maze() {
  const [walls, setWalls] = useState(makeMaze)
  const [pos, setPos] = useState(0)
  const [moves, setMoves] = useState(0)
  const board = useRef<HTMLDivElement>(null)
  const done = pos === N * N - 1
  const move = useCallback((d: 0 | 1 | 2 | 3) => {
    setPos((p) => {
      if (p === N * N - 1 || walls[p][d]) return p
      setMoves((m) => m + 1)
      return p + [-N, 1, N, -1][d]
    })
  }, [walls])
  useEffect(() => { board.current?.focus({ preventScroll: true }) }, [walls])
  const onKey = (e: React.KeyboardEvent) => {
    const k = e.key.toLowerCase()
    const d = ({ arrowup: 0, w: 0, arrowright: 1, d: 1, arrowdown: 2, s: 2, arrowleft: 3, a: 3 } as Record<string, 0 | 1 | 2 | 3>)[k]
    if (d !== undefined) { e.preventDefault(); move(d) }
  }
  // swipe on the board
  const touch = useRef<{ x: number; y: number } | null>(null)
  const again = () => { setWalls(makeMaze()); setPos(0); setMoves(0) }
  return (
    <div className="ms-play">
      <div className="ms-play__stats"><span>Moves <b>{moves}</b></span><button className="ms-btn ms-btn--sm" onClick={again}>New maze</button></div>
      <div
        ref={board}
        className="ms-maze"
        tabIndex={0}
        role="application"
        aria-label="Maze. Use the arrow keys, W A S D, the buttons below, or swipe."
        onKeyDown={onKey}
        onPointerDown={(e) => { touch.current = { x: e.clientX, y: e.clientY } }}
        onPointerUp={(e) => {
          const t = touch.current
          touch.current = null
          if (!t) return
          const dx = e.clientX - t.x, dy = e.clientY - t.y
          if (Math.max(Math.abs(dx), Math.abs(dy)) < 24) return
          move(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 1 : 3) : dy > 0 ? 2 : 0)
        }}
        style={{ ['--n' as string]: N }}
      >
        {walls.map((w, i) => (
          <span key={i} className={`ms-maze__cell ${i === N * N - 1 ? 'is-exit' : ''}`} style={{ borderTopWidth: w[0] ? 2 : 0, borderRightWidth: w[1] ? 2 : 0, borderBottomWidth: w[2] ? 2 : 0, borderLeftWidth: w[3] ? 2 : 0 }}>
            {i === pos && <i className="ms-maze__dot" />}
          </span>
        ))}
      </div>
      <div className="ms-dpad" aria-label="Move">
        <button onClick={() => move(0)} aria-label="Up">↑</button>
        <button onClick={() => move(3)} aria-label="Left">←</button>
        <button onClick={() => move(2)} aria-label="Down">↓</button>
        <button onClick={() => move(1)} aria-label="Right">→</button>
      </div>
      {done && <Done title="You found the way out" line={`${moves} moves`} onAgain={again} againLabel="New maze" />}
    </div>
  )
}

/* ── Reaction ─────────────────────────────────────────────────────────── */
type RState = 'idle' | 'wait' | 'go' | 'result' | 'early'
function Reaction() {
  const [state, setState] = useState<RState>('idle')
  const [times, setTimes] = useState<number[]>([])
  const [best, setBest] = useState<number | null>(() => {
    try { const v = localStorage.getItem('mindspace:reaction-best'); return v ? Number(v) : null } catch { return null }
  })
  const timer = useRef(0)
  const shown = useRef(0)
  useEffect(() => () => clearTimeout(timer.current), [])
  const done = times.length >= 5
  const avg = times.length ? Math.round(times.reduce((a, b) => a + b, 0) / times.length) : 0

  const arm = () => {
    setState('wait')
    timer.current = window.setTimeout(() => { shown.current = performance.now(); setState('go') }, 1200 + Math.random() * 2300)
  }
  const press = () => {
    if (state === 'idle' || state === 'result' || state === 'early') return done ? undefined : arm()
    if (state === 'wait') {
      clearTimeout(timer.current)
      setState('early')
      return
    }
    const ms = Math.round(performance.now() - shown.current)
    const next = [...times, ms]
    setTimes(next)
    setState('result')
    if (next.length === 5) {
      const a = Math.round(next.reduce((x, y) => x + y, 0) / 5)
      if (best === null || a < best) {
        setBest(a)
        try { localStorage.setItem('mindspace:reaction-best', String(a)) } catch { /* storage blocked */ }
      }
    }
  }
  const again = () => { setTimes([]); setState('idle') }
  const label = { idle: 'Tap to start', wait: 'Wait for green…', go: 'Tap!', result: `${times[times.length - 1]} ms — tap for the next round`, early: 'Too soon — tap to try that round again' }[state]
  return (
    <div className="ms-play">
      <div className="ms-play__stats"><span>Round <b>{Math.min(times.length + (done ? 0 : 1), 5)}/5</b></span><span>Average <b>{avg ? `${avg} ms` : '—'}</b></span><span>Best <b>{best ? `${best} ms` : '—'}</b></span></div>
      {!done && (
        <button className={`ms-reaction is-${state}`} onPointerDown={press} onKeyDown={(e) => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); press() } }}>
          {label}
        </button>
      )}
      {done && <Done title={`${avg} ms average`} line={`Rounds: ${times.join(' · ')} ms${best === avg ? ' — a new best' : ''}`} onAgain={again} />}
    </div>
  )
}

function Done({ title, line, onAgain, againLabel = 'Play again' }: { title: string; line: string; onAgain: () => void; againLabel?: string }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => { ref.current?.focus({ preventScroll: true }) }, [])
  return (
    <div className="ms-done" ref={ref} tabIndex={-1} role="status">
      <b>{title}</b>
      <span>{line}</span>
      <button className="ms-btn ms-btn--primary" onClick={onAgain}>{againLabel}</button>
    </div>
  )
}
