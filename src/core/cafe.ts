import { Vector3 } from 'three'
import { CAFE_TABLE, roomToWorld } from '@/data/interiors'
import { useGameStore } from '@/stores/gameStore'
import { playerRuntime, requestTeleport } from './runtime'
import { soundManager } from './sound/SoundManager'

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))

/**
 * The last stop: sit down at the window table. A soft fade, then the camera
 * takes the visitor's chair and Naveen (the avatar) sits across the table,
 * facing you. Closing the conversation stands him up again.
 */
export async function sitAtCafe(locationId: string) {
  const g = useGameStore.getState()
  soundManager.play('open', { volume: 0.5 })
  g.setState({ fade: true })
  await wait(380)
  const [x, , z] = roomToWorld('cafe', CAFE_TABLE.x, CAFE_TABLE.z + CAFE_TABLE.Naveen)
  requestTeleport(new Vector3(x, 0.4, z), 0)
  playerRuntime.seated = true
  useGameStore.getState().openLocation(locationId)
  await wait(220)
  useGameStore.getState().setState({ fade: false })
}
