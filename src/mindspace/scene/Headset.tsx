import { Environment, Lightformer, RoundedBox } from '@react-three/drei'
import { forwardRef, useMemo } from 'react'
import { TessellateModifier } from 'three/examples/jsm/modifiers/TessellateModifier.js'
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { type BufferGeometry, CatmullRomCurve3, ExtrudeGeometry, type Group, MeshPhysicalMaterial, MeshStandardMaterial, Shape, TubeGeometry, Vector2, Vector3 } from 'three'

/**
 * A mixed-reality headset, modelled for the opening shot: a curved
 * squircle visor of deep black glass in a brushed-aluminium frame, a soft
 * light seal, a knit band, side pods with a crown and a button, and the
 * downward cameras. ~1 unit wide. Faces +z.
 */
function outline(w: number, h: number, n = 4.2, nose = 0.11) {
  const pts: Vector2[] = []
  const N = 160
  for (let i = 0; i < N; i++) {
    const t = (i / N) * Math.PI * 2
    const c = Math.cos(t), s = Math.sin(t)
    const x = (w / 2) * Math.sign(c) * Math.pow(Math.abs(c), 2 / n)
    let y = (h / 2) * Math.sign(s) * Math.pow(Math.abs(s), 2 / n)
    // the bridge of the nose lifts the lower edge in the middle
    if (y < 0) y += nose * Math.exp(-Math.pow(x / 0.13, 2))
    pts.push(new Vector2(x, y))
  }
  return new Shape(pts)
}

/**
 * bend a flat extrusion around the face: edges sweep back, top and bottom curve slightly.
 * The caps are first subdivided (an extruded cap is only triangulated round its outline,
 * which would bend into large flat facets and break up the reflections).
 */
function bend(src: ExtrudeGeometry, k = 0.42, ky = 0.35) {
  const t = new TessellateModifier(0.035, 8).modify(src)
  src.dispose()
  // weld the triangle soup so the normals (and so the reflections) come out smooth
  t.deleteAttribute('normal')
  t.deleteAttribute('uv')
  const g: BufferGeometry = mergeVertices(t, 1e-4)
  t.dispose()
  const p = g.attributes.position
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i)
    p.setZ(i, p.getZ(i) - k * x * x - ky * y * y)
  }
  g.computeVertexNormals()
  return g
}

export const Headset = forwardRef<Group, { glass: MeshPhysicalMaterial; frame: MeshStandardMaterial }>(function Headset({ glass, frame }, ref) {
  const geo = useMemo(() => {
    const bevel = { bevelEnabled: true, bevelThickness: 0.035, bevelSize: 0.03, bevelSegments: 10, curveSegments: 96 }
    const visor = bend(new ExtrudeGeometry(outline(0.96, 0.44), { depth: 0.04, ...bevel }))
    // the aluminium frame wraps the glass with a visible band all round
    const rim = bend(new ExtrudeGeometry(outline(1.035, 0.5, 4.2, 0.125), { depth: 0.1, ...bevel, bevelThickness: 0.025, bevelSize: 0.02 }))
    const seal = bend(new ExtrudeGeometry(outline(0.93, 0.42, 3.6, 0.12), { depth: 0.16, bevelEnabled: true, bevelThickness: 0.05, bevelSize: 0.04, bevelSegments: 6, curveSegments: 64 }), 0.5, 0.3)
    const band = new TubeGeometry(new CatmullRomCurve3([new Vector3(-0.5, 0, -0.18), new Vector3(-0.56, 0, -0.5), new Vector3(-0.36, 0.02, -0.86), new Vector3(0, 0.03, -0.98), new Vector3(0.36, 0.02, -0.86), new Vector3(0.56, 0, -0.5), new Vector3(0.5, 0, -0.18)]), 80, 0.055, 16)
    return { visor, rim, seal, band }
  }, [])
  const mats = useMemo(() => ({
    seal: new MeshStandardMaterial({ color: '#2e2f33', roughness: 0.95 }),
    knit: new MeshStandardMaterial({ color: '#5d5f64', roughness: 0.9 }),
    lens: new MeshPhysicalMaterial({ color: '#050506', roughness: 0.08, clearcoat: 1, clearcoatRoughness: 0.05, envMapIntensity: 1.2 }),
  }), [])
  return (
    <group ref={ref}>
      <mesh geometry={geo.seal} material={mats.seal} position={[0, 0, -0.22]} scale={[0.98, 0.98, 1]} />
      <mesh geometry={geo.rim} material={frame} position={[0, 0, -0.075]} castShadow />
      <mesh geometry={geo.visor} material={glass} position={[0, 0, 0.0]} />
      <mesh geometry={geo.band} material={mats.knit} />
      {/* side pods: the crown (right) and the top button (left) */}
      {[-1, 1].map((s) => (
        <RoundedBox key={s} args={[0.09, 0.16, 0.24]} radius={0.04} smoothness={4} position={[s * 0.5, 0, -0.2]} material={frame} />
      ))}
      <mesh position={[0.43, 0.2, -0.12]} rotation={[0, 0, 0]} material={frame}>
        <cylinderGeometry args={[0.032, 0.032, 0.045, 32]} />
      </mesh>
      <RoundedBox args={[0.11, 0.025, 0.035]} radius={0.01} position={[-0.38, 0.215, -0.12]} material={frame} />
      {/* the downward cameras behind the glass */}
      {[-0.3, -0.21, 0.21, 0.3].map((x) => (
        <mesh key={x} position={[x, -0.15, 0.025 - 0.42 * x * x - 0.35 * 0.0225]} rotation={[0.35, x * 0.9, 0]} material={mats.lens}>
          <cylinderGeometry args={[0.022, 0.022, 0.012, 24]} />
        </mesh>
      ))}
    </group>
  )
})

/** the studio the headset is shot in: long soft strips for the glass to catch, no background */
export function HeadsetStudio() {
  return (
    <Environment resolution={256} frames={1}>
      <Lightformer form="rect" intensity={4} color="#ffffff" position={[0, 2.2, 1.5]} rotation-x={Math.PI / 2.6} scale={[6, 0.35, 1]} />
      {/* a broad, soft panel above the camera: the long gentle sheen across the glass */}
      <Lightformer form="rect" intensity={0.9} color="#cfd6e6" position={[0, 1.1, 2.6]} rotation-x={Math.PI / 7} scale={[5, 1.4, 1]} />
      <Lightformer form="rect" intensity={1.6} color="#dfe6ff" position={[-3, 0.3, 1]} rotation-y={Math.PI / 2.8} scale={[0.4, 3, 1]} />
      <Lightformer form="rect" intensity={1.2} color="#ffe2c4" position={[3, -0.2, 1]} rotation-y={-Math.PI / 2.8} scale={[0.3, 3, 1]} />
      <Lightformer form="rect" intensity={0.6} color="#ffffff" position={[0, -2, 1.5]} rotation-x={-Math.PI / 2.4} scale={[4, 0.2, 1]} />
    </Environment>
  )
}
