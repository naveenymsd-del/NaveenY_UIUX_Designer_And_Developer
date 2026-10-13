import { createPortal, useFrame, useThree } from '@react-three/fiber'
import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react'
import { Scene as ThreeScene } from 'three'
import { useMindspace } from '../store'
import { AnchorProjector, CameraRig } from './CameraRig'
import { IntroDirector } from './IntroDirector'
import { LivingRoom, roomTextures } from './LivingRoom'

/**
 * The 3D side of Mindspace. The room only exists once the intro hands over
 * (until then the headset owns the frame), and the camera rig only listens
 * while no application window is open.
 */
export default function Scene({ quality, onReady }: { quality: 'high' | 'low'; onReady: () => void }) {
  const phase = useMindspace((s) => s.phase)
  const app = useMindspace((s) => s.app)
  const roomPhase = useDeferredValue(phase)
  const told = useRef(false)
  // ready = the first frame has actually been drawn
  useFrame(() => {
    if (!told.current) {
      told.current = true
      requestAnimationFrame(onReady)
    }
  })
  useEffect(() => () => { told.current = false }, [])

  return (
    <>
      <color attach="background" args={['#0b0b0c']} />
      {phase === 'intro' && <IntroDirector speed={quality === 'low' ? 1.4 : 1} />}
      {phase === 'intro' && <RoomWarmup quality={quality} />}
      {/* the room is built in a deferred (interruptible) render, so the veil starts lifting at once */}
      {phase === 'room' && roomPhase === 'room' && (
        <>
          <LivingRoom quality={quality} />
          <CameraRig enabled={!app} />
          <AnchorProjector />
        </>
      )}
    </>
  )
}

/**
 * While the dark opening plays, the room's shaders are compiled in the
 * background: a silent copy of the room is mounted in an offscreen scene (never
 * drawn), the renderer compiles it asynchronously, and the copy is dropped. The
 * real room then reuses the compiled programs, textures and materials, so
 * arriving — or pressing Skip intro — doesn't freeze while shaders build.
 */
function RoomWarmup({ quality }: { quality: 'high' | 'low' }) {
  const gl = useThree((s) => s.gl)
  const camera = useThree((s) => s.camera)
  const offscreen = useMemo(() => new ThreeScene(), [])
  const [stage, setStage] = useState<'wait' | 'mount' | 'done'>('wait')
  useEffect(() => {
    const t = setTimeout(() => setStage('mount'), 250)
    return () => clearTimeout(t)
  }, [])
  useEffect(() => {
    if (stage !== 'mount') return
    let alive = true
    let raf = 0
    // two frames: the copy is in place and its environment lighting is set, so the compiled
    // programs match the ones the real room will ask for
    raf = requestAnimationFrame(() => {
      raf = requestAnimationFrame(() => {
        gl.compileAsync(offscreen, camera)
          .catch(() => undefined)
          .then(() => {
            // and upload the big painted textures now, not on the room's first frame
            for (const t of Object.values(roomTextures(quality))) gl.initTexture(t)
            if (alive) setStage('done')
          })
      })
    })
    return () => {
      alive = false
      cancelAnimationFrame(raf)
    }
  }, [stage, gl, camera, offscreen, quality])
  if (stage !== 'mount') return null
  return createPortal(<LivingRoom quality={quality} preview />, offscreen)
}
