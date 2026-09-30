import { Vector3 } from 'three'
import { INTERIORS, interiorEntry, type InteriorId } from '@/data/interiors'
import { useGameStore } from '@/stores/gameStore'
import { requestTeleport } from './runtime'
import { soundManager } from './sound/SoundManager'

/**
 * Building transitions. Entering: the camera eases toward the building's
 * approach shot, the screen fades, the player is placed just inside the door
 * (or at a named spot such as the Project Studio), an establishing shot
 * introduces the room, then control returns. Exiting reverses it and puts the
 * player back outside the entrance.
 */
let busy = false
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))

export interface EnterOptions {
  /** named arrival spot (INTERIORS[id].spots) */
  spot?: string
  /** how long the approach shot plays before the fade */
  approachMs?: number
  /** already inside this room: just move to the spot */
  within?: boolean
  /** leaving another room on the way */
  from?: InteriorId
}

export async function enterInterior(id: InteriorId, fromLocationId?: string, opts: EnterOptions = {}) {
  if (busy) return
  busy = true
  const g = useGameStore.getState()
  soundManager.play('open', { volume: 0.7 })
  if (fromLocationId && !opts.within) g.setState({ cameraShot: fromLocationId })
  await wait(opts.approachMs ?? 700)
  useGameStore.getState().setState({ fade: true })
  await wait(520)
  const entry = interiorEntry(id, opts.spot)
  requestTeleport(new Vector3(...entry.pos), entry.yaw)
  const same = opts.within && g.interior === id
  useGameStore.getState().setState({
    interior: id,
    interiorSince: same ? g.interiorSince : performance.now(),
    establishing: id,
    establishSpot: opts.spot ?? null,
    cameraShot: null,
    nearbyId: null,
  })
  await wait(160)
  useGameStore.getState().setState({ fade: false })
  const room = INTERIORS[id]
  await wait(350)
  if (opts.spot === 'studio') useGameStore.getState().showZone('room:studio', 'Project Studio', 'Chapter 04 · What I’ve designed')
  else if (!same) useGameStore.getState().showZone(`room:${id}`, room.name, room.subtitle)
  await wait(opts.spot ? 2600 : 2300)
  useGameStore.getState().setState({ establishing: null, establishSpot: null })
  busy = false
}

export async function exitInterior(id: InteriorId) {
  if (busy) return
  busy = true
  soundManager.play('close', { volume: 0.7 })
  useGameStore.getState().setState({ fade: true })
  await wait(520)
  const out = INTERIORS[id].outside
  requestTeleport(new Vector3(out.pos[0], 0.8, out.pos[1]), out.yaw)
  useGameStore.getState().setState({ interior: null, nearbyId: null })
  await wait(180)
  useGameStore.getState().setState({ fade: false })
  busy = false
}

/** Quick travel to a street position from anywhere (menu), with a soft fade. */
export async function travelTo(pos: Vector3, yaw: number) {
  if (busy) return
  busy = true
  const g = useGameStore.getState()
  g.closePanels()
  useGameStore.getState().setState({ fade: true })
  await wait(480)
  requestTeleport(pos, yaw)
  useGameStore.getState().setState({ interior: null, nearbyId: null, cameraShot: null })
  await wait(200)
  useGameStore.getState().setState({ fade: false })
  busy = false
}
