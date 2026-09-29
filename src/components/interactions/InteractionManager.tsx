import { useFrame, useThree } from '@react-three/fiber'
import { useRef } from 'react'
import { Vector3 } from 'three'
import { cinematicRuntime, playerRuntime, screenAnchors } from '@/core/runtime'
import { LOCATIONS, ZONES, getLocation } from '@/data/locations'
import { soundManager } from '@/core/sound/SoundManager'
import { controlsEnabled, useGameStore } from '@/stores/gameStore'

const _v = new Vector3()

/** DOM element the prompt anchor writes its transform into (registered by InteractionPrompt). */
export const promptElement: { current: HTMLElement | null } = { current: null }

/**
 * Proximity-based interaction: finds the nearest interactive location within
 * its radius, publishes it to the store (on change only), plays enter
 * feedback, triggers first-visit zone reveals, and projects the prompt anchor
 * above the player's head into screen space every frame.
 */
export function InteractionManager() {
  const camera = useThree((s) => s.camera)
  const size = useThree((s) => s.size)
  const clock = useThree((s) => s.clock)
  const last = useRef<string | null>(null)
  const frame = useRef(0)

  useFrame(() => {
    const game = useGameStore.getState()
    const p = playerRuntime.position
    frame.current++

    // ── nearest interactive (every 3rd frame is plenty) ─────────────────
    if (frame.current % 3 === 0) {
      let best: string | null = null
      let bestD = Infinity
      if (controlsEnabled(game)) {
        for (const l of LOCATIONS) {
          const d = Math.hypot(p.x - l.position[0], p.z - l.position[2])
          if (d < l.interactionRadius && d < bestD) {
            best = l.id
            bestD = d
          }
        }
      }
      if (best !== last.current) {
        last.current = best
        game.setNearby(best)
        if (best) {
          soundManager.play('interact', { volume: 0.35 })
          game.firePulse('enter')
        }
      }
      // ── first-visit zone reveals ─────────────────────────────────────
      if (game.phase === 'playing' && game.mode === 'street' && !game.activeLocationId && !game.activeProjectId) {
        for (const z of ZONES) {
          if (game.visitedZones.includes(z.id)) continue
          if (Math.hypot(p.x - z.center[0], p.z - z.center[1]) < z.radius) {
            game.showZone(z.id, z.name, z.subtitle)
            cinematicRuntime.active = true
            cinematicRuntime.start = clock.elapsedTime
            cinematicRuntime.reveal.set(...z.reveal)
            soundManager.play('open', { volume: 0.25 })
            break
          }
        }
      }
    }

    // ── screen-space prompt anchor above the player's head ──────────────
    const el = promptElement.current
    const near = game.nearbyId ? getLocation(game.nearbyId) : null
    if (el) {
      if (near && controlsEnabled(game)) {
        _v.set(p.x, p.y + 2.35, p.z).project(camera)
        const x = (_v.x * 0.5 + 0.5) * size.width
        const y = (-_v.y * 0.5 + 0.5) * size.height
        screenAnchors.prompt.x = x
        screenAnchors.prompt.y = y
        screenAnchors.prompt.visible = _v.z < 1
        el.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0) translate(-50%, -100%)`
      }
    }
  }, -2)

  return null
}

/** Trigger the action of the location currently in range (E key / Explore button). */
export function triggerNearby() {
  const game = useGameStore.getState()
  if (!controlsEnabled(game) || !game.nearbyId) return false
  const loc = getLocation(game.nearbyId)
  if (!loc) return false
  soundManager.play('open')
  if (loc.action === 'OPEN_PROJECT') game.openProject(loc.destination)
  else game.openLocation(loc.id)
  return true
}
