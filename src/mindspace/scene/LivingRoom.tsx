import { Environment, Lightformer } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import { type DirectionalLight, type HemisphereLight, MeshBasicMaterial, MeshPhysicalMaterial, MeshStandardMaterial, type PointLight } from 'three'
import { reducedMotion, useMindspace } from '../store'
import { currentHour, LiveLook, lookAt } from './timeOfDay'
import { Armchair, Art, ArcLamp, CoffeeTable, Curtain, Plant, Shelving, SlatWall, Sofa, useMaterials } from './furniture'
import { artwork, cityNight, cityView, oakFloor, plaster, rug } from './textures'

/**
 * A contemporary living room, modelled so it holds up in every direction:
 *   ahead (−z)   floor-to-ceiling glazing onto the city, sheer curtains, a walnut slat wall
 *   left  (−x)   a large artwork, an arc lamp, a tree in the corner
 *   right (+x)   built-in walnut shelving, a leather lounge chair, a plant
 *   behind (+z)  a doorway, a console with a round mirror and art
 *   up / down    a plaster ceiling with a lit cove and downlights; oak floor and a wool rug
 * The visitor stands at about (0, 1.55, 2.7), facing the sofa and the window.
 */
export const ROOM = { x: 4.6, zBack: -3.8, zFront: 4.6, h: 3.1 }

/** the painted textures, made once per quality and shared (the shader warm-up and the real room use the same) */
const textureCache = new Map<string, ReturnType<typeof paintTextures>>()
function paintTextures(quality: 'high' | 'low') {
  return {
    floor: oakFloor(quality === 'high' ? 1024 : 512),
    wall: plaster([226, 218, 206], 3),
    ceiling: plaster([240, 236, 230], 8),
    rug: rug(quality === 'high' ? 1024 : 512),
    city: cityView(quality === 'high' ? 2048 : 1024, quality === 'high' ? 1024 : 512),
    cityNight: cityNight(quality === 'high' ? 2048 : 1024, quality === 'high' ? 1024 : 512),
    artA: artwork(4),
    artB: artwork(19, 640, 420),
    artC: artwork(27, 420, 560),
  }
}
export function roomTextures(quality: 'high' | 'low') {
  if (!textureCache.has(quality)) textureCache.set(quality, paintTextures(quality))
  return textureCache.get(quality)!
}

/**
 * `preview`: a silent copy used only to compile the room's shaders during the intro
 * (see RoomWarmup) — it doesn't drive the time of day or touch the renderer.
 */
export function LivingRoom({ quality, preview = false }: { quality: 'high' | 'low'; preview?: boolean }) {
  const m = useMaterials()
  const t = useMemo(() => roomTextures(quality), [quality])
  const mat = useMemo(() => ({
    floor: new MeshPhysicalMaterial({ map: t.floor, roughness: 0.42, clearcoat: 0.35, clearcoatRoughness: 0.35 }),
    wall: new MeshStandardMaterial({ map: t.wall, roughness: 0.95 }),
    // the ceiling only sees bounce light: a touch of self-light keeps it reading as warm white plaster
    ceiling: new MeshStandardMaterial({ map: t.ceiling, roughness: 1, emissive: '#f3ece2', emissiveIntensity: 0.32 }),
    glass: new MeshPhysicalMaterial({ color: '#dfe8ee', roughness: 0.05, metalness: 0, transparent: true, opacity: 0.12, envMapIntensity: 1.2 }),
    frame: new MeshStandardMaterial({ color: '#1b1b1c', roughness: 0.4, metalness: 0.6 }),
    cove: new MeshStandardMaterial({ color: '#fff6e6', emissive: '#ffe2b4', emissiveIntensity: 1.6 }),
    downlight: new MeshStandardMaterial({ color: '#fffaf0', emissive: '#fff1d6', emissiveIntensity: 3 }),
    // satin-silvered glass: it catches the room's light without mirroring an empty environment
    mirror: new MeshStandardMaterial({ color: '#c8c6c2', roughness: 0.22, metalness: 0.35, envMapIntensity: 1.4 }),
    hall: new MeshStandardMaterial({ color: '#5a4c41', roughness: 1 }),
    city: new MeshBasicMaterial({ map: t.city, toneMapped: false }),
    cityNight: new MeshBasicMaterial({ map: t.cityNight, toneMapped: false, transparent: true, opacity: 0, depthWrite: false }),
  }), [t])

  // ── time of day: the existing lights and materials, eased toward the look for the local hour ──
  const hemi = useRef<HemisphereLight>(null)
  const sun = useRef<DirectionalLight>(null)
  const ceilA = useRef<PointLight>(null)
  const ceilB = useRef<PointLight>(null)
  const lamp = useRef<PointLight>(null)
  const lampGlow = useRef<MeshStandardMaterial>(null)
  const { gl, scene } = useThree()
  const live = useMemo(() => new LiveLook(), [])
  const target = useMemo(() => new LiveLook(), [])
  const first = useRef(true)
  useEffect(() => {
    if (preview) return
    // the target changes slowly: recompute it once a minute, and whenever the tab comes back
    const update = () => {
      const { look, period } = lookAt(currentHour())
      target.set(look)
      useMindspace.getState().setTod(period)
    }
    update()
    const id = window.setInterval(update, 60_000)
    const onVis = () => { if (document.visibilityState === 'visible') update() }
    document.addEventListener('visibilitychange', onVis)
    return () => {
      clearInterval(id)
      document.removeEventListener('visibilitychange', onVis)
    }
  }, [target, preview])
  useFrame((_, dt) => {
    if (preview) return
    // first frame: start exactly on the look; afterwards ease (~3 s), or snap with reduced motion
    live.approach(target, first.current || reducedMotion() ? 1 : 1 - Math.exp(-1.2 * Math.min(dt, 0.1)))
    first.current = false
    const L = live
    if (hemi.current) {
      hemi.current.color.copy(L.sky)
      hemi.current.groundColor.copy(L.ground)
      hemi.current.intensity = L.hemi
    }
    if (sun.current) {
      sun.current.color.copy(L.sun)
      sun.current.intensity = L.sunI
      sun.current.position.copy(L.sunDir)
    }
    const k = L.interior
    if (ceilA.current) ceilA.current.intensity = 0.25 + 3.2 * k
    if (ceilB.current) ceilB.current.intensity = 0.15 + 2.2 * k
    if (lamp.current) lamp.current.intensity = 6 * k
    if (lampGlow.current) lampGlow.current.emissiveIntensity = 0.15 + 2.6 * k
    mat.cove.emissiveIntensity = 0.35 + 2.2 * k
    mat.downlight.emissiveIntensity = 0.5 + 3.5 * k
    mat.ceiling.emissiveIntensity = L.ceiling
    mat.city.color.copy(L.cityTint)
    mat.cityNight.opacity = L.night
    mat.glass.opacity = 0.12 + 0.1 * L.night
    scene.environmentIntensity = L.env
    gl.toneMappingExposure = L.exposure * 1.03
  })
  const { x: X, zBack: ZB, zFront: ZF, h: H } = ROOM
  const W = X * 2, D = ZF - ZB, zMid = (ZF + ZB) / 2
  // the window opening in the back wall
  const win = { x0: -3.9, x1: 1.6, y0: 0.18, y1: 2.84 }

  return (
    <group>
      {/* reflections and soft fill come from a small local environment — no HDR download */}
      <Environment resolution={quality === 'high' ? 256 : 128} frames={1}>
        <Lightformer form="rect" intensity={2.6} color="#eef3f7" position={[-1.2, 1.5, ZB]} scale={[5.5, 2.6, 1]} />
        <Lightformer form="rect" intensity={0.8} color="#ffe6c4" position={[0, H, 0.5]} rotation-x={Math.PI / 2} scale={[6, 4, 1]} />
        <Lightformer form="ring" intensity={1.2} color="#ffd9a6" position={[-2.2, 1.8, -1.6]} scale={0.6} />
        <Lightformer form="rect" intensity={0.35} color="#f1e2d0" position={[X, 1.4, 0]} rotation-y={-Math.PI / 2} scale={[8, 3, 1]} />
      </Environment>

      {/* daylight: a low warm sun through the glazing, plus sky fill */}
      <hemisphereLight ref={hemi} args={['#e6edf3', '#b08a68', 0.75]} />
      <directionalLight
        ref={sun}
        position={[-6, 6.5, -11]}
        color="#ffe0b8"
        intensity={2.6}
        castShadow
        shadow-mapSize={quality === 'high' ? [2048, 2048] : [1024, 1024]}
        shadow-bias={-0.0004}
        shadow-normalBias={0.03}
        shadow-camera-left={-7}
        shadow-camera-right={7}
        shadow-camera-top={7}
        shadow-camera-bottom={-7}
        shadow-camera-near={1}
        shadow-camera-far={30}
      />
      <pointLight ref={ceilA} position={[0.2, 2.75, 0.6]} color="#ffe7c6" intensity={2.2} distance={7} decay={2} />
      <pointLight ref={ceilB} position={[2.6, 2.75, 2.8]} color="#ffe7c6" intensity={1.4} distance={6} decay={2} />

      {/* floor, ceiling, walls */}
      <mesh rotation-x={-Math.PI / 2} position={[0, 0, zMid]} material={mat.floor} receiveShadow>
        <planeGeometry args={[W, D]} />
      </mesh>
      <mesh rotation-x={Math.PI / 2} position={[0, H, zMid]} material={mat.ceiling} receiveShadow>
        <planeGeometry args={[W, D]} />
      </mesh>
      <mesh position={[-X, H / 2, zMid]} rotation-y={Math.PI / 2} material={mat.wall} receiveShadow>
        <planeGeometry args={[D, H]} />
      </mesh>
      <mesh position={[X, H / 2, zMid]} rotation-y={-Math.PI / 2} material={mat.wall} receiveShadow>
        <planeGeometry args={[D, H]} />
      </mesh>
      {/* back wall, around the window (boxes so the sun casts a real window-shaped patch) */}
      <mesh position={[(-X + win.x0) / 2, H / 2, ZB - 0.1]} material={mat.wall} castShadow receiveShadow>
        <boxGeometry args={[win.x0 + X, H, 0.2]} />
      </mesh>
      <mesh position={[(win.x1 + X) / 2, H / 2, ZB - 0.1]} material={mat.wall} castShadow receiveShadow>
        <boxGeometry args={[X - win.x1, H, 0.2]} />
      </mesh>
      <mesh position={[(win.x0 + win.x1) / 2, (win.y1 + H) / 2, ZB - 0.1]} material={mat.wall} castShadow>
        <boxGeometry args={[win.x1 - win.x0, H - win.y1, 0.2]} />
      </mesh>
      <mesh position={[(win.x0 + win.x1) / 2, win.y0 / 2, ZB - 0.1]} material={mat.wall} castShadow>
        <boxGeometry args={[win.x1 - win.x0, win.y0, 0.2]} />
      </mesh>
      {/* front wall with a doorway into a dim hall */}
      <mesh position={[(-X - 0.55) / 2, H / 2, ZF + 0.1]} material={mat.wall} castShadow receiveShadow>
        <boxGeometry args={[X - 0.55, H, 0.2]} />
      </mesh>
      <mesh position={[(X + 0.55) / 2, H / 2, ZF + 0.1]} material={mat.wall} castShadow receiveShadow>
        <boxGeometry args={[X - 0.55, H, 0.2]} />
      </mesh>
      <mesh position={[0, (2.3 + H) / 2, ZF + 0.1]} material={mat.wall}>
        <boxGeometry args={[1.1, H - 2.3, 0.2]} />
      </mesh>
      <mesh position={[0, 1.15, ZF + 0.6]} material={mat.hall}>
        <boxGeometry args={[1.1, 2.3, 0.6]} />
      </mesh>
      {/* door frame, and a warm light down the hall */}
      {[-0.57, 0.57].map((x) => (
        <mesh key={x} position={[x, 1.15, ZF - 0.01]} material={m.walnut}>
          <boxGeometry args={[0.05, 2.32, 0.05]} />
        </mesh>
      ))}
      <mesh position={[0, 2.31, ZF - 0.01]} material={m.walnut}>
        <boxGeometry args={[1.19, 0.05, 0.05]} />
      </mesh>
      <pointLight position={[0, 2.0, ZF + 0.55]} color="#ffd7a8" intensity={1.2} distance={2.4} decay={2} />
      {/* skirting */}
      {[[-X + 0.01, Math.PI / 2], [X - 0.01, -Math.PI / 2]].map(([x, ry]) => (
        <mesh key={x} position={[x, 0.05, zMid]} rotation-y={ry}>
          <boxGeometry args={[D, 0.1, 0.02]} />
          <meshStandardMaterial color="#e9e3d9" roughness={0.6} />
        </mesh>
      ))}

      {/* the glazing: black mullions, near-invisible glass, the city beyond */}
      {[win.x0, -2.06, -0.23, win.x1].map((x) => (
        <mesh key={x} position={[x, (win.y0 + win.y1) / 2, ZB]} material={mat.frame} castShadow>
          <boxGeometry args={[0.06, win.y1 - win.y0, 0.08]} />
        </mesh>
      ))}
      {[win.y0, 2.2, win.y1].map((y) => (
        <mesh key={y} position={[(win.x0 + win.x1) / 2, y, ZB]} material={mat.frame} castShadow>
          <boxGeometry args={[win.x1 - win.x0, 0.05, 0.08]} />
        </mesh>
      ))}
      <mesh position={[(win.x0 + win.x1) / 2, (win.y0 + win.y1) / 2, ZB + 0.01]} material={mat.glass}>
        <planeGeometry args={[win.x1 - win.x0, win.y1 - win.y0]} />
      </mesh>
      {/* the view: the day picture, with the night picture fading in over it */}
      <mesh position={[-1.2, 2.2, -14]} material={mat.city}>
        <planeGeometry args={[30, 15]} />
      </mesh>
      <mesh position={[-1.2, 2.2, -13.98]} material={mat.cityNight}>
        <planeGeometry args={[30, 15]} />
      </mesh>
      <Curtain position={[win.x0 + 0.45, 1.5, ZB + 0.18]} width={0.9} height={2.95} />
      <Curtain position={[win.x1 - 0.35, 1.5, ZB + 0.18]} width={0.7} height={2.95} />

      {/* ceiling: a lit cove around the edge and a few downlights */}
      {[[0, ZB + 0.25, W - 0.5, 0.04], [0, ZF - 0.25, W - 0.5, 0.04]].map(([x, z, w, d], i) => (
        <mesh key={`cz${i}`} position={[x, H - 0.12, z]} material={mat.cove}>
          <boxGeometry args={[w, 0.02, d]} />
        </mesh>
      ))}
      {[[-X + 0.25, zMid], [X - 0.25, zMid]].map(([x, z], i) => (
        <mesh key={`cx${i}`} position={[x, H - 0.12, z]} material={mat.cove}>
          <boxGeometry args={[0.04, 0.02, D - 0.5]} />
        </mesh>
      ))}
      <mesh position={[0, H - 0.14, zMid]} rotation-x={Math.PI / 2} material={mat.ceiling}>
        <planeGeometry args={[W - 0.6, D - 0.6]} />
      </mesh>
      {[[-2.4, -1.6], [0.2, -1.6], [2.6, -1.6], [-2.4, 1.6], [0.2, 1.6], [2.6, 1.6], [-2.4, 3.6], [2.6, 3.6]].map(([x, z], i) => (
        <mesh key={`dl${i}`} position={[x, H - 0.145, z]} rotation-x={Math.PI / 2} material={mat.downlight}>
          <circleGeometry args={[0.06, 24]} />
        </mesh>
      ))}

      {/* the rug, the sofa facing the visitor, the coffee table */}
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.006, -0.9]} receiveShadow>
        <planeGeometry args={[4.2, 2.94]} />
        <meshStandardMaterial map={t.rug} roughness={1} />
      </mesh>
      <Sofa position={[0, 0, -1.75]} m={m} />
      <CoffeeTable position={[-0.2, 0, -0.45]} m={m} />

      {/* back right: a walnut slat wall with art, a plant at the window */}
      <SlatWall position={[(win.x1 + X) / 2 + 0.05, 0, ZB + 0.03]} width={X - win.x1 - 0.2} height={H - 0.2} m={m} />
      <Art position={[3.1, 1.6, ZB + 0.1]} w={0.75} h={1.0} map={t.artC} frame="#d9cdb9" />
      <Plant position={[-3.55, 0, -3.15]} height={2.0} leaves={420} seed={3} m={m} />
      <Plant position={[1.25, 0, -3.2]} height={1.25} leaves={220} seed={8} pot="terracotta" m={m} />

      {/* left wall: a large artwork over a low walnut bench, the arc lamp by the sofa */}
      <Art position={[-X + 0.04, 1.62, -0.3]} rotation={Math.PI / 2} w={1.7} h={1.15} map={t.artB} />
      <mesh position={[-X + 0.3, 0.22, -0.3]} material={m.walnut} castShadow receiveShadow>
        <boxGeometry args={[0.5, 0.44, 2.2]} />
      </mesh>
      <mesh position={[-X + 0.3, 0.5, 0.35]} material={m.ceramic} castShadow>
        <sphereGeometry args={[0.11, 32, 20]} />
      </mesh>
      <ArcLamp position={[-2.25, 0, -1.6]} rotation={-0.35} m={m} lightRef={lamp} glowRef={lampGlow} />
      <Plant position={[-3.9, 0, 3.6]} height={1.5} leaves={280} seed={14} m={m} />

      {/* right wall: shelving, the lounge chair, a plant */}
      <Shelving position={[X - 0.2, 0, -0.4]} rotation={-Math.PI / 2} m={m} />
      <Armchair position={[2.55, 0, 0.5]} rotation={-2.2} m={m} />
      <mesh position={[3.2, 0.26, 1.25]} material={m.travertine} castShadow receiveShadow>
        <cylinderGeometry args={[0.22, 0.22, 0.52, 36]} />
      </mesh>
      <Plant position={[3.95, 0, 2.6]} height={1.35} leaves={240} seed={21} pot="terracotta" m={m} />

      {/* behind: a console with a round mirror and a piece of art */}
      <mesh position={[2.5, 0.42, ZF - 0.22]} material={m.walnut} castShadow receiveShadow>
        <boxGeometry args={[1.6, 0.06, 0.4]} />
      </mesh>
      {[-0.74, 0.74].map((dx) => (
        <mesh key={dx} position={[2.5 + dx, 0.2, ZF - 0.22]} material={m.blackMetal} castShadow>
          <boxGeometry args={[0.03, 0.4, 0.34]} />
        </mesh>
      ))}
      <mesh position={[2.5, 1.5, ZF - 0.02]} rotation-y={Math.PI} material={mat.mirror}>
        <circleGeometry args={[0.55, 64]} />
      </mesh>
      <mesh position={[2.5, 1.5, ZF - 0.01]} rotation-y={Math.PI} material={m.brass}>
        <ringGeometry args={[0.55, 0.58, 64]} />
      </mesh>
      <mesh position={[2.2, 0.56, ZF - 0.22]} material={m.ceramicDark} castShadow>
        <cylinderGeometry args={[0.06, 0.08, 0.22, 24]} />
      </mesh>
      <Art position={[-2.5, 1.6, ZF - 0.02]} rotation={Math.PI} w={1.2} h={1.5} map={t.artA} />
    </group>
  )
}
