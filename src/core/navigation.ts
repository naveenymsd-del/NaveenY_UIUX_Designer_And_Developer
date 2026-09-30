import { Vector3 } from 'three'
import { navigate } from '@/app/routes'
import { INTERIORS, type InteriorId } from '@/data/interiors'
import { FINAL_SPOT, getLocation } from '@/data/locations'
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
export type Destination = 'home' | 'education' | 'office' | 'projects' | 'design' | 'ai' | 'career' | 'contact'

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

export const DESTINATIONS: Record<Destination, DestDef> = {
  home: { at: [-8.2, -25], yaw: -Math.PI / 2, room: { id: 'home', location: 'home' }, line: 'Let’s go <b>home</b> — meet Naveen.' },
  education: { at: [0, -51.5], yaw: Math.PI, room: { id: 'education', location: 'education' }, line: 'Let’s go back to where the journey <b>started</b>.' },
  office: { at: [10.8, 17], yaw: Math.PI / 2, room: { id: 'office', location: 'nfc' }, line: 'Let’s head to <b>NFC Solutions</b>.' },
  projects: { at: [10.8, 17], yaw: Math.PI / 2, room: { id: 'office', location: 'nfc', spot: 'studio' }, line: 'Sure. Let’s head to the <b>projects</b>.' },
  design: { at: [-21.6, 25.6], yaw: Math.PI, line: 'This is how I think <b>before I design</b>.' },
  ai: { at: [-25.5, 30.2], yaw: Math.PI, line: 'Here’s how <b>AI and I</b> work together.' },
  career: { at: [7.4, -47], yaw: 0, line: 'Walk this path — it’s how I <b>grew</b>.' },
  contact: { at: [FINAL_SPOT[0] - 0.6, FINAL_SPOT[2] + 1.4], yaw: Math.PI * 0.8, open: 'final', line: 'Let’s <b>connect</b>.' },
}

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

// ── local command matching for the AI navigator (no external API) ──────────
const COMMANDS: [Destination, RegExp][] = [
  ['projects', /\b(projects?|work|case ?stud(y|ies)|portfolio|intellistaff|calmscient|ebounti|task|wastebeminerals|show)\b/],
  ['education', /\b(education|college|study|studies|school|universit(y|ies)|learn(ing)?|degree|class(room)?)\b/],
  ['ai', /\b(ai|a\.i\.|workflow|claude|chatgpt|gpt)\b/],
  ['design', /\b(design|process|park|ux|ui|research|prototyp\w*|method)\b/],
  ['career', /\b(career|journey|growth|grow|timeline|story)\b/],
  ['office', /\b(office|nfc|company|colleagues?|team|job)\b/],
  ['home', /\b(home|about|me|profile|who|naveen|skills?|tools?)\b/],
  ['contact', /\b(contact|email|mail|resume|cv|linkedin|hire|reach|feedback|connect|thanks?)\b/],
]

export function matchCommand(text: string): Destination | null {
  const t = text.toLowerCase().trim()
  if (!t) return null
  for (const [dest, re] of COMMANDS) if (re.test(t)) return dest
  return null
}
