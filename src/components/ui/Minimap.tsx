import { memo, useMemo } from 'react'
import { BLOCKS, BUILDINGS, ROADS, footprint } from '@/data/cityLayout'
import { WORLD_STOPS, type StopId } from '@/data/world'
import { inStudio } from '@/data/interiors'
import { controlsEnabled, useGameStore } from '@/stores/gameStore'
import { usePlayerStore } from '@/stores/playerStore'
import { STOP_ICONS } from './stopIcons'

const VIEW = { x0: -60, x1: 60, z0: -80, z1: 94 }
const ROUTE = WORLD_STOPS.map((st) => st.mapAt)

/** which stop the player is at right now (null = between places) */
function currentStop(interior: string | null, x: number, z: number): StopId | null {
  if (interior === 'home') return 'home'
  if (interior === 'education') return 'education'
  if (interior === 'office') return inStudio(x, z) ? 'projects' : 'nfcSolutions'
  if (interior === 'cafe') return 'contactCafe'
  if (x > -43 && x < -8 && z > 7 && z < 43) return 'designJourney'
  for (const st of WORLD_STOPS) if (Math.hypot(x - st.arrive[0], z - st.arrive[1]) < 7) return st.id
  return null
}

/**
 * North-up map of the journey, drawn from the one location config: numbered
 * stops in story order, a quiet route line joining them, the place you're at
 * highlighted and the next stop gently pulsing.
 */
export function Minimap() {
  const phase = useGameStore((s) => s.phase)
  const enabled = useGameStore((s) => controlsEnabled(s))
  const mode = useGameStore((s) => s.mode)
  const interior = useGameStore((s) => s.interior)
  const discovered = useGameStore((s) => s.discovered)
  const here = usePlayerStore((s) => currentStop(interior, s.x, s.z))
  const next = WORLD_STOPS.find((st) => st.place && !discovered.includes(st.place))?.id
  const visible = phase === 'playing' && mode === 'street' && !interior
  return (
    <div className={`ui-minimap ${visible ? 'is-visible' : ''} ${enabled ? '' : 'is-dim'}`} aria-hidden="true">
      <svg viewBox={`${VIEW.x0} ${VIEW.z0} ${VIEW.x1 - VIEW.x0} ${VIEW.z1 - VIEW.z0}`} preserveAspectRatio="xMidYMid slice">
        <StaticMap />
        <polyline points={ROUTE.map(([x, z]) => `${x},${z}`).join(' ')} className="ui-minimap__route" />
        {WORLD_STOPS.map((st, i) => {
          const w = st.label.length * 3.15 + 17
          const done = !!st.place && discovered.includes(st.place)
          return (
            <g
              key={st.id}
              transform={`translate(${st.mapAt[0]} ${st.mapAt[1]})`}
              className={`ui-minimap__marker is-${st.icon} ${here === st.id ? 'is-here' : ''} ${next === st.id ? 'is-next' : ''} ${done ? 'is-done' : ''}`}
            >
              <rect x={-w / 2} y={-5.5} width={w} height={11} rx={5.5} className="ui-minimap__label-bg" />
              <g transform={`translate(${-w / 2 + 6.2} 0)`}>
                <circle r={4.4} className="ui-minimap__icon-bg" />
                <g transform="scale(0.26) translate(-12 -12)"><path d={STOP_ICONS[st.icon]} className="ui-minimap__icon" /></g>
              </g>
              <text x={3.4} textAnchor="middle" y={1.7} className="ui-minimap__label">
                {i > 0 && <tspan className="ui-minimap__num">{String(i).padStart(2, '0')} </tspan>}
                {st.label}
              </text>
            </g>
          )
        })}
        <PlayerMarker />
      </svg>
    </div>
  )
}

const StaticMap = memo(function StaticMap() {
  const shapes = useMemo(() => BUILDINGS.filter((b) => !b.backdrop).map((b) => ({ id: b.id, special: !!b.special, ...footprint(b) })), [])
  return (
    <g>
      <rect x={VIEW.x0} y={VIEW.z0} width={VIEW.x1 - VIEW.x0} height={VIEW.z1 - VIEW.z0} className="ui-minimap__road" />
      {BLOCKS.map((b) => <rect key={b.id} x={b.x0} y={b.z0} width={b.x1 - b.x0} height={b.z1 - b.z0} className={`ui-minimap__block ${b.kind === 'park' ? 'is-park' : ''}`} />)}
      {ROADS.map((r) =>
        r.axis === 'x'
          ? <rect key={r.id} x={r.from} y={r.c - r.half} width={r.to - r.from} height={r.half * 2} className="ui-minimap__road" />
          : <rect key={r.id} x={r.c - r.half} y={r.from} width={r.half * 2} height={r.to - r.from} className="ui-minimap__road" />,
      )}
      {shapes.map((s) => <rect key={s.id} x={s.x0} y={s.z0} width={s.x1 - s.x0} height={s.z1 - s.z0} rx={1} className={`ui-minimap__bldg ${s.special ? 'is-special' : ''}`} />)}
    </g>
  )
})

function PlayerMarker() {
  const x = usePlayerStore((s) => s.x)
  const z = usePlayerStore((s) => s.z)
  const heading = usePlayerStore((s) => s.heading)
  const deg = (-heading * 180) / Math.PI + 180
  return (
    <g transform={`translate(${x.toFixed(1)} ${z.toFixed(1)}) rotate(${deg.toFixed(0)})`}>
      <circle r={7} className="ui-minimap__pulse" />
      <path d="M0 -5 L3.6 3.5 L0 1.8 L-3.6 3.5 Z" className="ui-minimap__player" />
    </g>
  )
}
