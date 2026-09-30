import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import {
  BoxGeometry, BufferGeometry, CanvasTexture, Color, CylinderGeometry, DoubleSide, type Group, LatheGeometry,
  Line, LineBasicMaterial, type Mesh, MeshBasicMaterial, MeshStandardMaterial, PlaneGeometry, SphereGeometry,
  SRGBColorSpace, Vector2, Vector3,
} from 'three'
import { sky } from '@/core/dayNight'
import { INTRO, PLANE, introRuntime, planeX } from '@/core/intro'
import { useGameStore } from '@/stores/gameStore'
import { UI_FONT } from '@/utils/textures'

const BANNER = { length: 19, height: 2.5, rope: 9 }

/** "WELCOME TO MY PORTFOLIO" on cream cloth, hemmed, set in the display face */
function bannerTexture() {
  const c = document.createElement('canvas')
  c.width = 2048
  c.height = 270
  const g = c.getContext('2d')!
  g.fillStyle = '#f5efe3'
  g.fillRect(0, 0, c.width, c.height)
  // hems
  g.fillStyle = '#25365a'
  g.fillRect(0, 0, c.width, 14)
  g.fillRect(0, c.height - 14, c.width, 14)
  g.fillStyle = '#ec7a2c'
  g.fillRect(0, 14, c.width, 4)
  g.fillRect(0, c.height - 18, c.width, 4)
  g.fillStyle = '#1b1f27'
  g.font = `640 124px ${UI_FONT}`
  g.textBaseline = 'middle'
  g.textAlign = 'center'
  const text = 'WELCOME TO MY PORTFOLIO'
  // generous tracking, drawn letter by letter
  const track = 12
  const widths = [...text].map((ch) => g.measureText(ch).width)
  const total = widths.reduce((a, b) => a + b, 0) + track * (text.length - 1)
  let x = (c.width - total) / 2
  ;[...text].forEach((ch, i) => {
    g.fillText(ch, x + widths[i] / 2, c.height / 2 + 6)
    x += widths[i] + track
  })
  const t = new CanvasTexture(c)
  t.colorSpace = SRGBColorSpace
  t.anisotropy = 8
  return t
}

/**
 * The opening flyover: a light, high-wing aircraft (Cessna-like proportions:
 * 8.3 m long, 11 m span) crossing the sky right → left, towing a cloth banner.
 * The cloth ripples in the vertex shader — a travelling wave whose amplitude
 * grows toward the free end, plus a little sag and flutter — so it bends and
 * waves like fabric at no physics cost. Nav lights and a lit banner keep it
 * readable in the night version of the same intro.
 */
export function IntroPlane() {
  const root = useRef<Group>(null!)
  const prop = useRef<Mesh>(null!)
  const strobe = useRef<Mesh>(null!)
  const res = useMemo(() => {
    const body = new MeshStandardMaterial({ color: '#f3f0e9', roughness: 0.38, metalness: 0.1, fog: false })
    const navy = new MeshStandardMaterial({ color: '#25365a', roughness: 0.45, metalness: 0.1, fog: false })
    const accent = new MeshStandardMaterial({ color: '#ec7a2c', roughness: 0.45, fog: false })
    const glass = new MeshStandardMaterial({ color: '#1d2633', roughness: 0.08, metalness: 0.6, fog: false })
    const dark = new MeshStandardMaterial({ color: '#2a2d33', roughness: 0.6, fog: false })
    // fuselage: a lathe profile (nose → tail) turned about the length axis
    const prof = [
      [0.0, 0], [0.28, 0.06], [0.46, 0.3], [0.6, 0.9], [0.66, 1.8], [0.64, 2.8], [0.56, 3.9], [0.42, 5.1], [0.28, 6.3], [0.16, 7.5], [0.06, 8.3],
    ].map(([r, y]) => new Vector2(r, y))
    const fuselage = new LatheGeometry(prof, 28)
    fuselage.rotateX(Math.PI / 2) // length along +z (nose at z=0 → tail at z=8.3)
    fuselage.scale(0.9, 1.05, 1)
    const cloth = new PlaneGeometry(BANNER.length, BANNER.height, 96, 6)
    cloth.translate(BANNER.length / 2, 0, 0) // leading edge at x = 0
    const tex = bannerTexture()
    const clothMat = new MeshStandardMaterial({ map: tex, emissiveMap: tex, emissive: new Color(0, 0, 0), side: DoubleSide, roughness: 0.85, fog: false })
    const uTime = { value: 0 }
    clothMat.onBeforeCompile = (shader) => {
      shader.uniforms.uTime = uTime
      shader.vertexShader = 'uniform float uTime;\n' + shader.vertexShader
        .replace(
          '#include <beginnormal_vertex>',
          `#include <beginnormal_vertex>
          float u = position.x / ${BANNER.length.toFixed(1)};
          float amp = 0.12 + u * 0.55;
          float ph = u * 13.0 - uTime * 8.5;
          float dz = cos(ph) * amp * 13.0 / ${BANNER.length.toFixed(1)} + sin(u * 31.0 - uTime * 14.0) * 0.06 * u;
          objectNormal = normalize(vec3(-dz, 0.0, 1.0));`,
        )
        .replace(
          '#include <begin_vertex>',
          `#include <begin_vertex>
          float vv = position.y / ${BANNER.height.toFixed(1)};
          transformed.z += sin(ph) * amp + sin(u * 31.0 - uTime * 14.0 + vv * 2.0) * 0.05 * u;
          // the free end droops a touch and the cloth shortens slightly as it billows
          transformed.y += -u * u * 0.7 + sin(ph * 0.5) * 0.08 * u;
          transformed.x -= abs(sin(ph)) * amp * 0.18;`,
        )
    }
    const ropePts = [new Vector3(0, 0, 0), new Vector3(BANNER.rope, -0.9, 0)]
    const rope = new Line(new BufferGeometry().setFromPoints(ropePts), new LineBasicMaterial({ color: '#3a3d44', fog: false }))
    return {
      body, navy, accent, glass, dark, fuselage, cloth, clothMat, uTime, rope,
      box: new BoxGeometry(1, 1, 1),
      cyl: new CylinderGeometry(0.5, 0.5, 1, 12),
      sphere: new SphereGeometry(0.5, 12, 10),
      red: new MeshBasicMaterial({ color: new Color(2.2, 0.2, 0.2), fog: false }),
      green: new MeshBasicMaterial({ color: new Color(0.2, 2.0, 0.5), fog: false }),
      white: new MeshBasicMaterial({ color: new Color(2.4, 2.4, 2.4), fog: false }),
      blur: new MeshBasicMaterial({ color: '#c9ccd2', transparent: true, opacity: 0.22, depthWrite: false, fog: false }),
    }
  }, [])

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 1 / 20)
    const g = useGameStore.getState()
    const t = introRuntime.t
    const on = (g.phase === 'intro' || g.phase === 'loading') && t < INTRO.planeEnd + 1.5 && !introRuntime.skipped
    root.current.visible = on
    if (!on) return
    res.uTime.value += dt
    const x = planeX(t)
    root.current.position.set(x, PLANE.y + Math.sin(t * 0.7) * 0.5, PLANE.z)
    // a gentle bank and pitch, like a real pass in light air
    root.current.rotation.set(Math.sin(t * 0.5) * 0.03, 0, Math.sin(t * 0.6) * 0.05)
    prop.current.rotation.z += dt * 60
    // after dark the banner is lit from the plane's belly light so it stays readable
    const night = sky.lights
    res.clothMat.emissive.setRGB(0.55 * night, 0.52 * night, 0.46 * night)
    strobe.current.visible = night > 0.2 && Math.sin(t * 9) > 0.85
  })

  // the inner group is authored nose at z=0, tail toward +z; +π/2 yaw puts the tail at +x so it flies nose-first toward -x
  return (
    <group ref={root} visible={false}>
      <group rotation-y={Math.PI / 2}>
        <mesh geometry={res.fuselage} material={res.body} />
        {/* cabin glazing */}
        <mesh geometry={res.box} material={res.glass} position={[0, 0.42, 1.55]} rotation-x={-0.55} scale={[0.95, 0.04, 0.9]} />
        <mesh geometry={res.box} material={res.glass} position={[0.56, 0.3, 2.35]} scale={[0.04, 0.42, 1.1]} />
        <mesh geometry={res.box} material={res.glass} position={[-0.56, 0.3, 2.35]} scale={[0.04, 0.42, 1.1]} />
        {/* cheat line stripe */}
        <mesh geometry={res.box} material={res.navy} position={[0.6, -0.05, 3.2]} scale={[0.03, 0.12, 4.6]} />
        <mesh geometry={res.box} material={res.navy} position={[-0.6, -0.05, 3.2]} scale={[0.03, 0.12, 4.6]} />
        {/* high wing with slight taper and struts */}
        <mesh geometry={res.box} material={res.body} position={[0, 0.72, 2.3]} scale={[7.2, 0.13, 1.6]} />
        <mesh geometry={res.box} material={res.body} position={[4.6, 0.74, 2.35]} scale={[2.2, 0.11, 1.35]} rotation-z={0.03} />
        <mesh geometry={res.box} material={res.body} position={[-4.6, 0.74, 2.35]} scale={[2.2, 0.11, 1.35]} rotation-z={-0.03} />
        <mesh geometry={res.box} material={res.navy} position={[0, 0.8, 2.3]} scale={[11.1, 0.02, 0.2]} />
        {[1, -1].map((sx) => (
          <mesh key={sx} geometry={res.cyl} material={res.dark} position={[sx * 1.55, 0.1, 2.35]} rotation-z={sx * 1.05} scale={[0.05, 1.9, 0.05]} />
        ))}
        {/* tail: fin, rudder stripe, stabiliser */}
        <mesh geometry={res.box} material={res.body} position={[0, 0.95, 7.55]} rotation-x={0.42} scale={[0.08, 1.35, 1.15]} />
        <mesh geometry={res.box} material={res.accent} position={[0, 1.05, 7.95]} rotation-x={0.42} scale={[0.09, 0.9, 0.18]} />
        <mesh geometry={res.box} material={res.body} position={[0, 0.2, 7.7]} scale={[3.4, 0.07, 0.95]} />
        {/* landing gear */}
        {[0.85, -0.85].map((sx) => (
          <group key={sx}>
            <mesh geometry={res.cyl} material={res.dark} position={[sx * 0.75, -0.72, 2.7]} rotation-z={sx * 0.6} scale={[0.05, 0.75, 0.05]} />
            <mesh geometry={res.cyl} material={res.dark} position={[sx * 1.05, -1.02, 2.7]} rotation-z={Math.PI / 2} scale={[0.34, 0.14, 0.34]} />
          </group>
        ))}
        <mesh geometry={res.cyl} material={res.dark} position={[0, -0.72, 0.55]} scale={[0.05, 0.6, 0.05]} />
        <mesh geometry={res.cyl} material={res.dark} position={[0, -1.0, 0.55]} rotation-z={Math.PI / 2} scale={[0.28, 0.12, 0.28]} />
        {/* spinner + propeller (blades + motion disc) */}
        <mesh geometry={res.sphere} material={res.navy} position={[0, 0, -0.02]} scale={[0.26, 0.26, 0.4]} />
        <group ref={prop} position={[0, 0, -0.14]}>
          <mesh geometry={res.box} material={res.dark} scale={[0.12, 1.9, 0.03]} />
          <mesh geometry={res.cyl} material={res.blur} rotation-x={Math.PI / 2} scale={[1.9, 0.01, 1.9]} />
        </group>
        {/* nav lights: red left, green right, white tail strobe */}
        <mesh geometry={res.sphere} material={res.red} position={[-5.7, 0.74, 2.3]} scale={0.12} />
        <mesh geometry={res.sphere} material={res.green} position={[5.7, 0.74, 2.3]} scale={0.12} />
        <mesh ref={strobe} geometry={res.sphere} material={res.white} position={[0, 1.55, 8.1]} scale={0.14} />
      </group>
      {/* tow rope and banner trail behind (toward +x) */}
      <primitive object={res.rope} position={[8.3, -0.1, 0]} />
      <mesh geometry={res.cloth} material={res.clothMat} position={[8.3 + BANNER.rope, -1.0, 0]} />
    </group>
  )
}
