import { PerformanceMonitor } from '@react-three/drei'
import { Canvas } from '@react-three/fiber'
import { Physics } from '@react-three/rapier'
import { Suspense, useState } from 'react'
import { NeutralToneMapping, SRGBColorSpace } from 'three'
import { PostProcessing } from '@/components/effects/PostProcessing'
import { useCameraControls } from '@/hooks/useCameraControls'
import { useAssetStore } from '@/stores/assetStore'
import { useGameStore } from '@/stores/gameStore'
import { useUIStore } from '@/stores/uiStore'
import { qualitySettings } from '@/utils/performance'
import { DebugProbe } from './DebugProbe'
import { FOG_COLOR, GameWorld } from './GameWorld'

/**
 * WebGL layer. The world mounts once assets are probed and fonts are loaded
 * (sign textures are painted with them); until then the loading screen covers it.
 */
export function GameCanvas() {
  const quality = useUIStore((s) => s.quality)
  const setQuality = useUIStore((s) => s.setQuality)
  const debug = useUIStore((s) => s.debug)
  const q = qualitySettings(quality)
  const probed = useAssetStore((s) => s.probed)
  const fontsReady = useGameStore((s) => s.loading.fontsReady)
  const playing = useGameStore((s) => s.phase === 'playing')
  const [el, setEl] = useState<HTMLDivElement | null>(null)
  const [dpr, setDpr] = useState(q.dpr[1])
  useCameraControls(el, playing)
  const physicsDebug = typeof location !== 'undefined' && new URLSearchParams(location.search).has('physics')

  return (
    <div ref={setEl} className="game-canvas" role="application" aria-label="Explorable 3D neighbourhood. Use W A S D to move, Space to jump, drag to look around, E to interact.">
      <Canvas
        shadows={q.softShadows ? 'soft' : 'percentage'}
        dpr={dpr}
        gl={{ antialias: q.antialias, powerPreference: 'high-performance', stencil: false, alpha: false }}
        camera={{ position: [90, 70, 130], fov: 48, near: 0.2, far: 1100 }}
        onCreated={({ gl }) => {
          gl.toneMapping = NeutralToneMapping
          gl.outputColorSpace = SRGBColorSpace
          gl.setClearColor(FOG_COLOR)
        }}
      >
        <PerformanceMonitor
          flipflops={3}
          bounds={() => [34, 58]}
          onDecline={() => setDpr((d) => Math.max(q.dpr[0], +(d - 0.25).toFixed(2)))}
          onIncline={() => setDpr((d) => Math.min(q.dpr[1], +(d + 0.25).toFixed(2)))}
          onFallback={() => quality !== 'low' && setQuality(quality === 'high' ? 'medium' : 'low')}
        />
        <Suspense fallback={null}>
          {probed && fontsReady && (
            <Physics timeStep="vary" gravity={[0, -20, 0]} debug={physicsDebug}>
              <GameWorld />
            </Physics>
          )}
        </Suspense>
        {q.postprocessing && probed && fontsReady && <PostProcessing multisampling={q.multisampling} fxaa={q.fxaa} />}
        {debug && <DebugProbe />}
      </Canvas>
    </div>
  )
}
