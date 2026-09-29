import { memo, useMemo } from 'react'
import { BLOCKS, BUILDINGS, ROADS, footprint } from '@/data/cityLayout'
import { LOCATIONS } from '@/data/locations'
import { PROJECTS } from '@/data/projects'
import { controlsEnabled, useGameStore } from '@/stores/gameStore'
import { usePlayerStore } from '@/stores/playerStore'

const VIEW = { x0: -60, x1: 60, z0: -80, z1: 94 }

/** North-up neighbourhood map with labelled places and a live player marker. */
export function Minimap() {
  const phase = useGameStore((s) => s.phase)
  const enabled = useGameStore((s) => controlsEnabled(s))
  const nearby = useGameStore((s) => s.nearbyId)
  const mode = useGameStore((s) => s.mode)
  const visible = phase === 'playing' && mode === 'street'
  return (
    <div className={`ui-minimap ${visible ? 'is-visible' : ''} ${enabled ? '' : 'is-dim'}`} aria-hidden="true">
      <svg viewBox={`${VIEW.x0} ${VIEW.z0} ${VIEW.x1 - VIEW.x0} ${VIEW.z1 - VIEW.z0}`} preserveAspectRatio="xMidYMid slice">
        <StaticMap />
        {LOCATIONS.filter((l) => l.mapLabel).map((l) => (
          <g key={l.id} transform={`translate(${l.position[0]} ${l.position[2]})`} className={nearby === l.id ? 'is-near' : ''}>
            <rect x={-l.mapLabel!.length * 2.1 - 2} y={-5.5} width={l.mapLabel!.length * 4.2 + 4} height={9} rx={2.5} className="ui-minimap__label-bg" />
            <text textAnchor="middle" y={1.6} className="ui-minimap__label">{l.mapLabel}</text>
          </g>
        ))}
        {PROJECTS.map((p) => <circle key={p.id} cx={p.position[0]} cy={p.position[2]} r={1.8} fill={p.accent} />)}
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
      <rect x={9} y={-42} width={21} height={34} className="ui-minimap__plaza" rx={2} />
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
