import { useThree } from '@react-three/fiber'
import { useEffect } from 'react'
import { City } from '@/components/environment/City'
import { Sky } from '@/components/environment/Sky'
import { Lighting } from '@/components/effects/Lighting'
import { AmbientParticles, Birds, DustPuffs, FeedbackPulse, FountainSpray, WorldClock } from '@/components/effects/EnvironmentEffects'
import { AICompanion } from '@/components/effects/AICompanion'
import { DayNightSystem } from '@/components/effects/DayNightSystem'
import { NightLights } from '@/components/effects/NightLights'
import { StoryProps } from '@/components/interactions/StoryProps'
import { InteractionManager } from '@/components/interactions/InteractionManager'
import { InteractiveObjects } from '@/components/interactions/InteractiveObject'
import { NPCManager } from '@/components/npc/NPCManager'
import { Player } from '@/components/player/Player'
import { TrafficManager } from '@/components/vehicles/TrafficManager'
import { LOCATIONS } from '@/data/locations'
import { useGameStore } from '@/stores/gameStore'
import { useUIStore } from '@/stores/uiStore'
import { offFlags, qualitySettings } from '@/utils/performance'
import { GameCamera } from './GameCamera'

export const FOG_COLOR = '#dcdad4'

/** Everything that lives in the 3D world. */
export function GameWorld() {
  const quality = useUIStore((s) => s.quality)
  const q = qualitySettings(quality)
  const off = offFlags()
  return (
    <>
      <fog attach="fog" args={[FOG_COLOR, 110, 460]} />
      <color attach="background" args={[FOG_COLOR]} />
      <WorldClock />
      <DayNightSystem />
      <NightLights />
      <Sky />
      <Lighting shadowMapSize={q.shadowMapSize} shadows={q.shadows && !off.has('shadows')} env={!off.has('env')} shadowInterval={quality === 'high' ? 1 : 2} />
      <City shadows={q.shadows && !off.has('shadows')} parts={!off.has('parts')} />
      <Player />
      {!off.has('npc') && <NPCManager />}
      {!off.has('traffic') && <TrafficManager />}
      <InteractiveObjects defs={LOCATIONS} />
      <InteractionManager />
      <GameCamera />
      {!off.has('particles') && <AmbientParticles count={q.particleCount} />}
      <FountainSpray />
      <DustPuffs />
      <FeedbackPulse />
      <StoryProps />
      <AICompanion />
      <Birds />
      <ReadySignal />
    </>
  )
}

/** Pre-compiles shaders once the world has mounted, then reports readiness. */
function ReadySignal() {
  const gl = useThree((s) => s.gl)
  const scene = useThree((s) => s.scene)
  const camera = useThree((s) => s.camera)
  const setLoading = useGameStore((s) => s.setLoading)
  useEffect(() => {
    setLoading({ physicsReady: true, stage: 'Preparing experience…' })
    let cancelled = false
    const id = requestAnimationFrame(() => {
      requestAnimationFrame(async () => {
        try {
          await gl.compileAsync(scene, camera)
        } catch {
          gl.compile(scene, camera)
        }
        if (!cancelled) setLoading({ compiled: true })
      })
    })
    return () => {
      cancelled = true
      cancelAnimationFrame(id)
    }
  }, [gl, scene, camera, setLoading])
  return null
}
