import { Vector3 } from 'three'
import { INTERIORS, interiorEntry, type InteriorId } from '@/data/interiors'
import { useGameStore } from '@/stores/gameStore'
import { requestTeleport } from './runtime'
import { soundManager } from './sound/SoundManager'

/**
 * Building transitions. Entering: the camera eases toward the building's
 * approach shot, the screen fades, the player is placed just inside the door,
 * an establishing shot introduces the room, then control returns. Exiting
 * reverses it and puts the player back outside the entrance.
 */
let busy = false
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))

export async function enterInterior(id: InteriorId, fromLocationId?: string) {
  if (busy) return
  busy = true
  const g = useGameStore.getState()
  soundManager.play('open', { volume: 0.7 })
  g.setState({ cameraShot: fromLocationId ?? null })
  await wait(700)
  useGameStore.getState().setState({ fade: true })
  await wait(520)
  const entry = interiorEntry(id)
  requestTeleport(new Vector3(...entry.pos), entry.yaw)
  useGameStore.getState().setState({ interior: id, interiorSince: performance.now(), establishing: id, cameraShot: null, nearbyId: null })
  await wait(160)
  useGameStore.getState().setState({ fade: false })
  const room = INTERIORS[id]
  await wait(350)
  useGameStore.getState().showZone(`room:${id}`, room.name, room.subtitle)
  await wait(2300)
  useGameStore.getState().setState({ establishing: null })
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
