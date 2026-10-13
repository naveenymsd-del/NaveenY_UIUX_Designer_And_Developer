import { useFrame, useThree } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import { AdditiveBlending, BufferAttribute, BufferGeometry, CanvasTexture, type Group, MathUtils, MeshPhysicalMaterial, MeshStandardMaterial, Object3D, type PerspectiveCamera, type Points, PointsMaterial, type SpotLight, Vector3 } from 'three'
import { useMindspace } from '../store'
import { Headset, HeadsetStudio } from './Headset'

/**
 * The opening, as one clock (seconds; phones run it ~40% faster):
 *   0.0–0.7   darkness
 *   0.7–2.6   the glass catches the studio strips — the silhouette appears
 *   2.4–4.7   a slow turn to face the visitor; the title rests on screen
 *   4.4–5.7   a few motes of light gather; the camera dives into the lens
 *   5.7       the room takes over (the overlay's veil carries the cut)
 * Shot far above the room (y = 60) so nothing of the room is ever in frame.
 */
export const INTRO_END = 5.7
const C = new Vector3(0, 60, 0)

const ease = (t: number) => t * t * (3 - 2 * t)
const span = (t: number, a: number, b: number) => ease(MathUtils.clamp((t - a) / (b - a), 0, 1))

export function IntroDirector({ speed }: { speed: number }) {
  const { camera } = useThree()
  const cam = camera as PerspectiveCamera
  const head = useRef<Group>(null)
  const key = useRef<SpotLight>(null)
  const motes = useRef<Points>(null)
  const clock = useRef(-1)
  const lastBeat = useRef(-1)
  const target = useMemo(() => new Vector3(), [])
  // a spotlight's target must live in the scene for its aim to update
  const keyTarget = useMemo(() => { const o = new Object3D(); o.position.copy(C); return o }, [])
  const mats = useMemo(() => ({
    glass: new MeshPhysicalMaterial({ color: '#0d0f14', roughness: 0.06, metalness: 0.45, clearcoat: 1, clearcoatRoughness: 0.03, envMapIntensity: 0 }),
    frame: new MeshStandardMaterial({ color: '#d4d7dc', roughness: 0.24, metalness: 1, envMapIntensity: 0 }),
  }), [])
  const moteGeo = useMemo(() => {
    const g = new BufferGeometry()
    const n = 70
    const a = new Float32Array(n * 3)
    for (let i = 0; i < n; i++) {
      const r = 0.7 + Math.random() * 0.9, t = Math.random() * Math.PI * 2, y = (Math.random() - 0.5) * 0.9
      a.set([Math.cos(t) * r, y, Math.sin(t) * r * 0.6 + 0.2], i * 3)
    }
    g.setAttribute('position', new BufferAttribute(a, 3))
    return g
  }, [])
  // soft round motes (a tiny radial sprite, not square points)
  const moteMat = useMemo(() => {
    const c = document.createElement('canvas')
    c.width = c.height = 32
    const g = c.getContext('2d')!
    const grd = g.createRadialGradient(16, 16, 0, 16, 16, 16)
    grd.addColorStop(0, 'rgba(255,255,255,1)')
    grd.addColorStop(0.4, 'rgba(255,240,220,0.5)')
    grd.addColorStop(1, 'rgba(255,240,220,0)')
    g.fillStyle = grd
    g.fillRect(0, 0, 32, 32)
    return new PointsMaterial({ color: '#ffe8cc', size: 0.03, map: new CanvasTexture(c), transparent: true, opacity: 0, blending: AdditiveBlending, depthWrite: false })
  }, [])

  useFrame((_, dt) => {
    if (clock.current < 0) clock.current = 0
    clock.current += Math.min(dt, 0.05) * speed
    const t = clock.current
    const reveal = span(t, 0.7, 2.6)
    mats.glass.envMapIntensity = 2.6 * reveal
    mats.frame.envMapIntensity = 2.2 * reveal
    if (key.current) key.current.intensity = 22 * span(t, 1.0, 3.0)
    // the headset turns to face the visitor, with a little float
    if (head.current) {
      head.current.rotation.y = MathUtils.lerp(0.95, 0, span(t, 0.3, 4.6))
      head.current.rotation.x = MathUtils.lerp(-0.18, 0.02, span(t, 0.3, 4.6))
      head.current.position.y = Math.sin(t * 0.9) * 0.01
    }
    // camera: a slow approach, then the dive into the lens
    const approach = span(t, 0, 4.5)
    const dive = span(t, 4.5, INTRO_END)
    const dist = MathUtils.lerp(MathUtils.lerp(2.7, 1.95, approach), 0.18, dive)
    cam.position.set(C.x + MathUtils.lerp(0.55, 0, approach) * (1 - dive), C.y + MathUtils.lerp(-0.22, 0.02, approach), C.z + dist)
    target.set(C.x, C.y + 0.0, C.z)
    cam.lookAt(target)
    const fov = MathUtils.lerp(34, 26, dive)
    if (Math.abs(cam.fov - fov) > 0.01) {
      cam.fov = fov
      cam.updateProjectionMatrix()
    }
    moteMat.opacity = 0.85 * span(t, 4.0, 4.8) * (1 - span(t, 5.3, 5.7))
    if (motes.current) motes.current.rotation.y = t * 0.12
    // publish the beat for the overlay copy (about 10 times a second)
    const beat = Math.floor(t * 10) / 10
    if (beat !== lastBeat.current) {
      lastBeat.current = beat
      useMindspace.getState().setBeat(beat)
    }
    if (t >= INTRO_END) useMindspace.getState().enterRoom()
  })

  return (
    <group>
      <HeadsetStudio />
      <group position={C.toArray()}>
        <Headset ref={head} glass={mats.glass} frame={mats.frame} />
        <points ref={motes} geometry={moteGeo} material={moteMat} />
      </group>
      <primitive object={keyTarget} />
      <spotLight ref={key} position={[C.x - 1.6, C.y + 2.2, C.z + 2.2]} target={keyTarget} angle={0.5} penumbra={1} intensity={0} color="#fff4e8" />
      <pointLight position={[C.x + 1.4, C.y + 0.4, C.z - 1.2]} color="#9fb6ff" intensity={6} distance={4} />
    </group>
  )
}
