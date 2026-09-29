import { memo, useMemo } from 'react'
import { BLOCKS, BUILDINGS, ROADS, footprint } from '@/data/cityLayout'
import { LOCATIONS, type InteractiveDef } from '@/data/locations'
import { controlsEnabled, useGameStore } from '@/stores/gameStore'
import { usePlayerStore } from '@/stores/playerStore'
import { useCurrentPlace } from '@/hooks/useCurrentPlace'

const VIEW = { x0: -60, x1: 60, z0: -80, z1: 94 }

type Icon = NonNullable<InteractiveDef['marker']>['icon']
/** 10×10 glyphs drawn around the origin */
const ICONS: Record<Icon, string> = {
  education: 'M-5 -1 L0 -4 L5 -1 L0 2 Z M-3 0 V3 Q0 5 3 3 V0',
  office: 'M-3.5 4 V-4 H3.5 V4 Z M-1.8 -2.4 H-0.6 M0.6 -2.4 H1.8 M-1.8 -0.4 H-0.6 M0.6 -0.4 H1.8 M-1.8 1.6 H-0.6 M0.6 1.6 H1.8',
  home: 'M-4 0 L0 -4 L4 0 M-3 -1 V4 H3 V-1 M-1 4 V1.5 H1 V4',
  park: 'M0 4 V0 M0 -4 C3.5 -4 4 1 0 1 C-4 1 -3.5 -4 0 -4 Z',
  projects: 'M-4 -4 H-0.8 V-0.8 H-4 Z M0.8 -4 H4 V-0.8 H0.8 Z M-4 0.8 H-0.8 V4 H-4 Z M0.8 0.8 H4 V4 H0.8 Z',
  info: 'M0 -3 V-2.6 M0 -1 V3.5',
}
const MARKERS = LOCATIONS.filter((l) => l.marker)
/** which marker the "where am I" label corresponds to */
const HERE: Record<string, string> = { 'Education Campus': 'education', 'NFC Solutions': 'nfc', 'My Home': 'home', 'Design Park': 'park-ai' }

/** North-up neighbourhood map with the five story destinations and a live player marker. */
export function Minimap() {
  const phase = useGameStore((s) => s.phase)
  const enabled = useGameStore((s) => controlsEnabled(s))
  const nearby = useGameStore((s) => s.nearbyId)
  const mode = useGameStore((s) => s.mode)
  const interior = useGameStore((s) => s.interior)
  const visible = phase === 'playing' && mode === 'street' && !interior
  const here = HERE[useCurrentPlace().name]
  return (
    <div className={`ui-minimap ${visible ? 'is-visible' : ''} ${enabled ? '' : 'is-dim'}`} aria-hidden="true">
      <svg viewBox={`${VIEW.x0} ${VIEW.z0} ${VIEW.x1 - VIEW.x0} ${VIEW.z1 - VIEW.z0}`} preserveAspectRatio="xMidYMid slice">
        <StaticMap />
        {MARKERS.map((l) => {
          const m = l.marker!
          const near = nearby === l.id
          const w = m.label.length * 3.7 + 14
          return (
            <g key={l.id} transform={`translate(${m.mapAt?.[0] ?? l.position[0]} ${m.mapAt?.[1] ?? l.position[2]})`} className={`ui-minimap__marker ${near ? 'is-near' : ''} ${here === l.id ? 'is-here' : ''}`} style={{ ['--accent' as string]: l.accent }}>
              <rect x={-w / 2} y={-5.5} width={w} height={11} rx={5.5} className="ui-minimap__label-bg" />
              <g transform={`translate(${-w / 2 + 6.5} 0) scale(0.62)`}>
                <circle r={6.2} className="ui-minimap__icon-bg" />
                <path d={ICONS[m.icon]} className="ui-minimap__icon" />
              </g>
              <text x={3.5} textAnchor="middle" y={1.9} className="ui-minimap__label">{m.label}</text>
              {m.sub && (
                // projects live inside this building: a small tethered chip
                <g transform="translate(0 10.5)">
                  <path d="M0 -5 V-2.6" stroke="currentColor" strokeWidth={0.6} className="ui-minimap__tether" />
                  <rect x={-(m.sub.length * 1.25 + 8) / 2} y={-2.6} width={m.sub.length * 1.25 + 8} height={6.2} rx={3.1} className="ui-minimap__sub-bg" />
                  <g transform={`translate(${-(m.sub.length * 1.25 + 8) / 2 + 3.4} 0.5) scale(0.32)`}>
                    <path d={ICONS.projects} className="ui-minimap__icon" style={{ stroke: '#fff' }} />
                  </g>
                  <text x={1.6} y={1.8} textAnchor="middle" className="ui-minimap__sub">{m.sub}</text>
                </g>
              )}
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
