import { useFrame } from '@react-three/fiber'
import { useEffect, useRef } from 'react'
import { useMindspace } from '../store'
import { AnchorProjector, CameraRig } from './CameraRig'
import { IntroDirector } from './IntroDirector'
import { LivingRoom } from './LivingRoom'

/**
 * The 3D side of Mindspace. The room only exists once the intro hands over
 * (until then the headset owns the frame), and the camera rig only listens
 * while no application window is open.
 */
export default function Scene({ quality, onReady }: { quality: 'high' | 'low'; onReady: () => void }) {
  const phase = useMindspace((s) => s.phase)
  const app = useMindspace((s) => s.app)
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
      {phase === 'room' && (
        <>
          <LivingRoom quality={quality} />
          <CameraRig enabled={!app} />
          <AnchorProjector />
        </>
      )}
    </>
  )
}
