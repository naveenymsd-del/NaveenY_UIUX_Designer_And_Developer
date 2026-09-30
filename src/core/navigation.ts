import { Vector3 } from 'three'
import { navigate } from '@/app/routes'
import { INTERIORS, type InteriorId } from '@/data/interiors'
import { getLocation } from '@/data/locations'
import { WORLD_STOPS, matchStop, type StopId } from '@/data/world'
import { useGameStore } from '@/stores/gameStore'
import { say } from './companion'
import { enterInterior } from './interiors'
import { playerRuntime, requestTeleport } from './runtime'
import { soundManager } from './sound/SoundManager'

/**
 * navigateToLocation(): instant, smooth travel inside the one world — no new
 * scene is ever loaded. The camera lifts into a short aerial glide, the player
 * is moved while the camera is high (never a visible pop), the camera settles
 * back behind them, and rooms are entered with the usual fade. A soft marker
 * highlights the arrival point for a few seconds.
 */
export type Destination = StopId

interface DestDef {
  /** street arrival point + facing */
  at: [number, number]
  yaw: number
  /** enter this room on arrival (from the location's approach shot) */
  room?: { id: InteriorId; location: string; spot?: string }
  /** open this location's panel on arrival */
  open?: string
  line: string
}

const GO_LINES: Record<StopId, string> = {
  start: 'Back to the <b>start</b>.',
  home: 'Let’s go <b>home</b>.',
  education: 'Let’s go back to where the journey <b>started</b>.',
  nfcSolutions: 'Let’s head to <b>NFC Solutions</b>.',
  projects: 'Sure. Let’s head to the <b>projects</b>.',
  designJourney: 'Let’s walk the <b>Design Journey</b>.',
  contactCafe: 'Let’s grab a <b>coffee</b> and talk.',
}

/** every destination comes from the one location config (data/world.ts) */
export const DESTINATIONS: Record<Destination, DestDef> = Object.fromEntries(
  WORLD_STOPS.map((st) => [st.id, { at: st.arrive, yaw: st.yaw, room: st.room, line: GO_LINES[st.id] }]),
) as Record<Destination, DestDef>

let busy = false
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))

export function navigateToLocation(dest: Destination, opts: { quiet?: boolean } = {}) {
  if (busy) return
  const d = DESTINATIONS[dest]
  if (!d) {
    // unknown target: stay on the street, gracefully
    say('I’ll keep you on the street for now.', { ms: 2400 })
    return
  }
  void run(d, opts)
}

async function run(d: DestDef, opts: { quiet?: boolean }) {
  busy = true
  try {
    const g = useGameStore.getState()
    g.closePanels()
    navigate('/street')
    if (!opts.quiet) say(d.line, { ms: 2600, emote: 'point', interrupt: true })
    soundManager.play('open', { volume: 0.6 })

    // already in the right room: just move within it
    if (d.room && g.interior === d.room.id) {
      if (d.room.spot) await enterInterior(d.room.id, undefined, { spot: d.room.spot, approachMs: 0, within: true })
      else await enterInterior(d.room.id, undefined, { approachMs: 0, within: true })
      return
    }
    // leave a room first (quick fade to its street entrance)
    if (g.interior) {
      const out = INTERIORS[g.interior].outside
      useGameStore.getState().setState({ fade: true })
      await wait(420)
      requestTeleport(new Vector3(out.pos[0], 0.8, out.pos[1]), out.yaw)
      useGameStore.getState().setState({ interior: null, nearbyId: null })
      await wait(260)
      useGameStore.getState().setState({ fade: false })
      await wait(200)
    }

    // aerial glide: camera lifts, the player is moved while the camera is high, camera settles
    const s = useGameStore.getState()
    const from = s.interior ? null : getPlayerXZ()
    s.setState({ travel: { from: from ?? d.at, to: d.at, start: performance.now() }, navMarker: { x: d.at[0], z: d.at[1], until: performance.now() + 6500 } })
    await wait(TRAVEL.moveAt * 1000)
    requestTeleport(new Vector3(d.at[0], 0.8, d.at[1]), d.yaw)
    await wait((TRAVEL.duration - TRAVEL.moveAt) * 1000)
    useGameStore.getState().setState({ travel: null })
    await wait(900)

    if (d.room) {
      busy = false
      await enterInterior(d.room.id, d.room.location, { spot: d.room.spot, approachMs: 500 })
      return
    }
    if (d.open) {
      const loc = getLocation(d.open)
      if (loc) useGameStore.getState().openLocation(loc.id)
    }
  } finally {
    busy = false
  }
}

/** timing of the aerial glide (seconds) */
export const TRAVEL = { duration: 2.3, moveAt: 1.15, height: 30, back: 24 }

function getPlayerXZ(): [number, number] {
  return [playerRuntime.position.x, playerRuntime.position.z]
}

/** local command matching for the AI navigator (no external API) — words live in data/world.ts */
export const matchCommand = (text: string): Destination | null => matchStop(text)
