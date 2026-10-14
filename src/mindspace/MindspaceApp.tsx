import { Component, type ReactNode, Suspense, lazy, useEffect, useMemo, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { PerformanceMonitor } from '@react-three/drei'
import { ACESFilmicToneMapping, PCFSoftShadowMap, SRGBColorSpace } from 'three'
import { BASE } from '@/utils/basePath'
import { HOME, homeFov } from './scene/CameraRig'
import { useMindspace } from './store'
import { Launcher } from './ui/Launcher'
import { Controls } from './ui/Controls'
import { AppWindow } from './ui/AppWindow'
import { IntroOverlay } from './ui/IntroOverlay'
import { MiniPlayer } from './ui/MiniPlayer'
import { setDuck } from './music/engine'
import './music.css'
import './mindspace.css'

const Scene = lazy(() => import('./scene/Scene'))

/**
 * Mindspace — the spatial portfolio at /mindspace. Its own page: the 3D city is
 * never mounted here. Layers, back to front:
 *   the room (WebGL)  ·  the launcher pinned in the room  ·  the app window  ·  controls  ·  the intro
 */
export default function MindspaceApp() {
  const fallback = useMindspace((s) => s.fallback)
  const app = useMindspace((s) => s.app)
  const phase = useMindspace((s) => s.phase)
  const tod = useMindspace((s) => s.tod)
  const setFallback = useMindspace((s) => s.setFallback)
  const [ready, setReady] = useState(false)
  const quality = useMemo(() => (matchMedia('(pointer: coarse)').matches || (navigator.hardwareConcurrency ?? 8) <= 4 ? 'low' : 'high') as 'high' | 'low', [])
  const [dpr, setDpr] = useState(quality === 'high' ? 1.5 : 1.25)

  useEffect(() => {
    document.title = 'Mindspace — Naveen Y · Spatial portfolio'
    if (!hasWebGL()) setFallback()
  }, [setFallback])
  // the games' sounds come through: music steps back while Joy Lab is open
  useEffect(() => { setDuck(app === 'games' ? 0.35 : 1) }, [app])
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') useMindspace.getState().close() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <div data-tod={tod} className={`ms ${app ? 'has-app' : ''} ${phase === 'intro' ? 'is-intro' : ''} ${fallback ? 'is-fallback' : ''} ${ready || fallback ? 'is-ready' : ''}`}>
      <div className="ms-stage" aria-hidden="true">
        {!fallback && (
          <SceneBoundary onError={setFallback}>
            <Canvas
              className="ms-canvas"
              shadows={{ type: PCFSoftShadowMap }}
              dpr={[1, dpr]}
              // behind an open app the room is still (and blurred): draw it only when something changes,
              // so the app — and the Joy Lab games — get the whole GPU
              frameloop={app ? 'demand' : 'always'}
              gl={{ antialias: true, powerPreference: 'high-performance', alpha: false }}
              camera={{ position: HOME.pos.toArray(), fov: homeFov(innerWidth / innerHeight), near: 0.05, far: 80 }}
              onCreated={({ gl }) => {
                gl.toneMapping = ACESFilmicToneMapping
                gl.toneMappingExposure = 1.05
                gl.outputColorSpace = SRGBColorSpace
              }}
            >
              <PerformanceMonitor onDecline={() => setDpr((d) => Math.max(1, d - 0.25))} />
              <Suspense fallback={null}>
                <Scene quality={quality} onReady={() => setReady(true)} />
              </Suspense>
            </Canvas>
          </SceneBoundary>
        )}
      </div>
      <div className="ms-anchor-layer">
        <Launcher pinned={!fallback} />
      </div>
      <AppWindow />
      <Controls />
      <MiniPlayer />
      <IntroOverlay ready={ready || fallback} />
      {!ready && !fallback && <div className="ms-loading" role="status" aria-label="Preparing the room"><span /></div>}
      <a className="ms-skiplink" href={`${BASE}street`}>Back to the 3D city</a>
    </div>
  )
}

function hasWebGL() {
  try {
    const c = document.createElement('canvas')
    return !!(c.getContext('webgl2') || c.getContext('webgl'))
  } catch {
    return false
  }
}

/** if the 3D scene throws, the launcher and apps carry on without the room */
class SceneBoundary extends Component<{ onError: () => void; children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  componentDidCatch() {
    this.props.onError()
  }
  render() {
    return this.state.failed ? null : this.props.children
  }
}
