import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import {
  BoxGeometry, BufferAttribute, BufferGeometry, CanvasTexture, Color, CylinderGeometry, DoubleSide, type Group, LatheGeometry,
  Line, LineBasicMaterial, type Mesh, MeshBasicMaterial, MeshStandardMaterial, PlaneGeometry, SphereGeometry,
  SRGBColorSpace, Vector2, Vector3,
} from 'three'
import { sky } from '@/core/dayNight'
import { INTRO, PLANE, introRuntime, planeX } from '@/core/intro'
import { useGameStore } from '@/stores/gameStore'
import { UI_FONT } from '@/utils/textures'

const BANNER = { length: 13.5, height: 1.9, rope: 5.5 }

/** NACA-like airfoil outline (chord along +z from 0 → 1, thickness in y) */
function airfoil(chord: number, t: number, n = 14) {
  const pts: Vector2[] = []
  for (let i = 0; i <= n; i++) {
    const x = 1 - Math.cos((i / n) * Math.PI * 0.5) // cluster points at the rounded leading edge
    const y = 5 * t * (0.2969 * Math.sqrt(x) - 0.126 * x - 0.3516 * x * x + 0.2843 * x ** 3 - 0.1036 * x ** 4)
    pts.push(new Vector2(x * chord, y * chord))
  }
  for (let i = n - 1; i > 0; i--) pts.push(new Vector2(pts[i].x, -pts[i].y * 0.55))
  return pts
}

/**
 * A lifting surface swept along an axis: airfoil sections from root to tip,
 * linearly tapered, with sweep (tip moved aft) and dihedral. axis 'x' = wing /
 * tailplane (symmetric both sides), 'y' = fin (one side, going up).
 */
function surface(opts: { span: number; root: number; tip: number; t: number; sweep: number; dihedral?: number; axis: 'x' | 'y'; stations?: number; bands?: [number, number] }) {
  const { span, root, tip, t, sweep, dihedral = 0, axis } = opts
  const stations = opts.stations ?? 8
  const sec = airfoil(1, t)
  const m = sec.length
  const pos: number[] = []
  const idx: number[] = []
  const sides = axis === 'x' ? [-1, 1] : [1]
  sides.forEach((side) => {
    const base = pos.length / 3
    for (let k = 0; k <= stations; k++) {
      const f = k / stations
      const chord = root + (tip - root) * f
      const along = f * span * (axis === 'x' ? 0.5 : 1)
      const aft = sweep * f
      for (const q of sec) {
        const z = aft + q.x * chord - chord * 0.25 // quarter-chord on the axis
        const th = q.y
        if (axis === 'x') pos.push(side * along, th + along * dihedral, z)
        else pos.push(th, along, z)
      }
    }
    for (let k = 0; k < stations; k++)
      for (let i = 0; i < m; i++) {
        const a = base + k * m + i
        const b = base + k * m + ((i + 1) % m)
        const c = a + m
        const d = b + m
        if (side > 0) idx.push(a, b, c, b, d, c)
        else idx.push(a, c, b, b, c, d)
      }
    // tip cap
    const tipBase = base + stations * m
    for (let i = 1; i < m - 1; i++) side > 0 ? idx.push(tipBase, tipBase + i, tipBase + i + 1) : idx.push(tipBase, tipBase + i + 1, tipBase + i)
  })
  const g = new BufferGeometry()
  g.setAttribute('position', new BufferAttribute(new Float32Array(pos), 3))
  g.setIndex(idx)
  g.computeVertexNormals()
  return g
}

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
  const props = useRef<(Group | null)[]>([])
  const strobe = useRef<Mesh>(null!)
  const res = useMemo(() => {
    const body = new MeshStandardMaterial({ color: '#f3f0e9', roughness: 0.3, metalness: 0.15, fog: false, envMapIntensity: 1.2 })
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
    const nprof = [[0, 0], [0.16, 0.05], [0.26, 0.3], [0.29, 0.8], [0.27, 1.4], [0.18, 1.9], [0.06, 2.1]].map(([r, y]) => new Vector2(r, y))
    const nacelle = new LatheGeometry(nprof, 20)
    nacelle.rotateX(Math.PI / 2)
    nacelle.translate(0, 0, -0.55)
    const wing = surface({ span: 11, root: 1.62, tip: 1.2, t: 0.13, sweep: 0.05, dihedral: 0.028, axis: 'x' })
    const fin = surface({ span: 1.55, root: 1.35, tip: 0.72, t: 0.1, sweep: 0.72, axis: 'y' })
    const rudder = surface({ span: 1.3, root: 0.34, tip: 0.3, t: 0.06, sweep: 0.62, axis: 'y', stations: 4 })
    rudder.translate(0, 0.05, 0.78)
    const tailplane = surface({ span: 3.4, root: 0.95, tip: 0.6, t: 0.1, sweep: 0.18, axis: 'x' })
    return {
      wing, fin, rudder, tailplane, nacelle,
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
    props.current.forEach((g, i) => { if (g) g.rotation.z += dt * (i ? -58 : 60) })
    // after dark the banner is lit from the plane's belly light so it stays readable
    const night = sky.lights
    res.clothMat.emissive.setRGB(0.55 * night, 0.52 * night, 0.46 * night)
    // the white airframe catches city glow and its own lights, so it never reads as a grey cut-out
    res.body.emissive.setRGB(0.32 * night, 0.31 * night, 0.3 * night)
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
        {/* high wing: airfoil section, tapered outer panels, slight dihedral */}
        <mesh geometry={res.wing} material={res.body} position={[0, 0.74, 1.6]} />
        {[1, -1].map((sx) => (
          <mesh key={sx} geometry={res.cyl} material={res.body} position={[sx * 1.55, 0.12, 2.3]} rotation-z={sx * 1.02} scale={[0.025, 1.95, 0.05]} />
        ))}
        {/* tail: swept fin with an orange rudder, tapered tailplane */}
        <mesh geometry={res.fin} material={res.body} position={[0, 0.35, 6.95]} />
        <mesh geometry={res.rudder} material={res.accent} position={[0, 0.35, 6.95]} />
        <mesh geometry={res.tailplane} material={res.body} position={[0, 0.2, 7.2]} />
        {/* fixed tricycle gear with streamlined wheel fairings */}
        {[1, -1].map((sx) => (
          <group key={sx}>
            <mesh geometry={res.cyl} material={res.dark} position={[sx * 0.72, -0.62, 2.75]} rotation-z={sx * 0.72} scale={[0.04, 0.95, 0.12]} />
            <mesh geometry={res.sphere} material={res.body} position={[sx * 1.1, -1.0, 2.72]} scale={[0.22, 0.34, 0.62]} />
            <mesh geometry={res.cyl} material={res.dark} position={[sx * 1.1, -1.1, 2.72]} rotation-z={Math.PI / 2} scale={[0.3, 0.1, 0.3]} />
          </group>
        ))}
        <mesh geometry={res.cyl} material={res.dark} position={[0, -0.66, 0.6]} scale={[0.045, 0.62, 0.045]} />
        <mesh geometry={res.sphere} material={res.body} position={[0, -0.98, 0.6]} scale={[0.18, 0.3, 0.52]} />
        {/* rounded nose cone */}
        <mesh geometry={res.sphere} material={res.body} position={[0, 0.02, 0.18]} scale={[0.56, 0.58, 0.7]} />
        {/* cabin windows: a row along each side */}
        {[1, -1].map((sx) =>
          [2.85, 3.45, 4.05, 4.65, 5.25].map((z, i) => (
            <mesh key={sx + '-' + i} geometry={res.sphere} material={res.glass} position={[sx * (0.55 - i * 0.04), 0.14, z]} scale={[0.03, 0.2, 0.26]} />
          )),
        )}
        {/* twin engines under the wing: cowling, spinner, three-blade prop + motion disc */}
        {[1, -1].map((sx, k) => (
          <group key={sx} position={[sx * 2.15, 0.52, 1.25]}>
            <mesh geometry={res.nacelle} material={res.body} />
            <mesh geometry={res.box} material={res.navy} position={[0, 0, 0.9]} scale={[0.5, 0.06, 0.9]} />
            <mesh geometry={res.sphere} material={res.navy} position={[0, 0, -0.62]} scale={[0.2, 0.2, 0.3]} />
            <group ref={(g) => { props.current[k] = g }} position={[0, 0, -0.74]}>
              {[0, 1, 2].map((b) => (
                <mesh key={b} geometry={res.box} material={res.dark} rotation-z={(b * Math.PI * 2) / 3} position={[0, 0, 0]} scale={[0.09, 1.55, 0.025]} />
              ))}
              <mesh geometry={res.cyl} material={res.blur} rotation-x={Math.PI / 2} scale={[1.55, 0.01, 1.55]} />
            </group>
            <mesh geometry={res.cyl} material={res.dark} position={[0, 0.2, 0.2]} scale={[0.06, 0.25, 0.9]} />
          </group>
        ))}
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
