import { RoundedBox } from '@react-three/drei'
import { type RefObject, useLayoutEffect, useMemo, useRef } from 'react'
import { CatmullRomCurve3, Color, DoubleSide, type InstancedMesh, MeshStandardMaterial, Object3D, type PointLight, PlaneGeometry, Shape, ShapeGeometry, TubeGeometry, Vector3 } from 'three'
import { bookSpines, fabric } from './textures'

type V3 = [number, number, number]

/* ── shared materials (one instance each, reused by every piece) ────────── */
/** made once and shared: the shader warm-up and the real room use the very same materials */
let sharedMaterials: ReturnType<typeof makeMaterials> | null = null
export function useMaterials() {
  return useMemo(() => (sharedMaterials ??= makeMaterials()), [])
}
function makeMaterials() {
  return (() => {
    const boucle = new MeshStandardMaterial({ color: '#efe8dc', map: fabric([236, 229, 216], 5), roughness: 0.95 })
    return {
      boucle,
      cushionA: new MeshStandardMaterial({ color: '#b86a4c', map: fabric([184, 106, 76], 9), roughness: 0.9 }),
      cushionB: new MeshStandardMaterial({ color: '#8c9a84', map: fabric([140, 154, 132], 13), roughness: 0.9 }),
      walnut: new MeshStandardMaterial({ color: '#6a4a34', roughness: 0.48 }),
      oakLight: new MeshStandardMaterial({ color: '#b48a62', roughness: 0.55 }),
      travertine: new MeshStandardMaterial({ color: '#d9cdb9', roughness: 0.78 }),
      blackMetal: new MeshStandardMaterial({ color: '#1d1d1f', roughness: 0.38, metalness: 0.7 }),
      brass: new MeshStandardMaterial({ color: '#b8925a', roughness: 0.3, metalness: 1 }),
      leather: new MeshStandardMaterial({ color: '#8a4f2d', roughness: 0.55 }),
      ceramic: new MeshStandardMaterial({ color: '#ece6dc', roughness: 0.35 }),
      ceramicDark: new MeshStandardMaterial({ color: '#3a3532', roughness: 0.45 }),
      terracotta: new MeshStandardMaterial({ color: '#a8694a', roughness: 0.85 }),
      stonePot: new MeshStandardMaterial({ color: '#c9c1b4', roughness: 0.9 }),
      soil: new MeshStandardMaterial({ color: '#3b2b20', roughness: 1 }),
      trunk: new MeshStandardMaterial({ color: '#6b5440', roughness: 0.9 }),
    }
  })()
}
export type Mats = ReturnType<typeof useMaterials>

/** a low modular sofa in cream bouclé, facing +z, centred on its seat front */
export function Sofa({ position, m, width = 2.8 }: { position: V3; m: Mats; width?: number }) {
  const half = width / 2
  return (
    <group position={position}>
      <RoundedBox args={[width, 0.22, 1.0]} radius={0.06} smoothness={4} position={[0, 0.16, 0]} material={m.boucle} castShadow receiveShadow />
      {[-1, 1].map((s) => (
        <RoundedBox key={`seat${s}`} args={[half - 0.22, 0.2, 0.82]} radius={0.08} smoothness={5} position={[s * (half / 2 - 0.02), 0.36, 0.06]} material={m.boucle} castShadow receiveShadow />
      ))}
      <RoundedBox args={[width, 0.5, 0.26]} radius={0.1} smoothness={5} position={[0, 0.5, -0.38]} material={m.boucle} castShadow receiveShadow />
      {[-1, 1].map((s) => (
        <RoundedBox key={`back${s}`} args={[half - 0.25, 0.42, 0.2]} radius={0.1} smoothness={5} position={[s * (half / 2 - 0.05), 0.68, -0.2]} rotation={[-0.12, 0, 0]} material={m.boucle} castShadow />
      ))}
      {[-1, 1].map((s) => (
        <RoundedBox key={`arm${s}`} args={[0.26, 0.48, 1.0]} radius={0.1} smoothness={5} position={[s * (half - 0.13), 0.38, 0]} material={m.boucle} castShadow receiveShadow />
      ))}
      <RoundedBox args={[0.46, 0.4, 0.14]} radius={0.07} smoothness={4} position={[-half + 0.55, 0.62, -0.08]} rotation={[-0.2, 0.25, 0.06]} material={m.cushionA} castShadow />
      <RoundedBox args={[0.42, 0.38, 0.13]} radius={0.07} smoothness={4} position={[half - 0.58, 0.61, -0.08]} rotation={[-0.2, -0.3, -0.05]} material={m.cushionB} castShadow />
      <RoundedBox args={[0.4, 0.36, 0.12]} radius={0.07} smoothness={4} position={[-half + 0.92, 0.6, -0.1]} rotation={[-0.25, 0.08, -0.04]} material={m.boucle} castShadow />
    </group>
  )
}

/** a round travertine drum table with a smaller nesting table, plus a few objects */
export function CoffeeTable({ position, m }: { position: V3; m: Mats }) {
  return (
    <group position={position}>
      <mesh position={[0, 0.2, 0]} material={m.travertine} castShadow receiveShadow>
        <cylinderGeometry args={[0.38, 0.42, 0.4, 48]} />
      </mesh>
      <mesh position={[0, 0.42, 0]} material={m.travertine} castShadow receiveShadow>
        <cylinderGeometry args={[0.58, 0.58, 0.05, 64]} />
      </mesh>
      <group position={[0.72, 0, 0.18]}>
        <mesh position={[0, 0.15, 0]} material={m.walnut} castShadow receiveShadow>
          <cylinderGeometry args={[0.28, 0.3, 0.3, 40]} />
        </mesh>
      </group>
      {/* a stack of books, a bowl, a vase of dry branches */}
      <mesh position={[-0.2, 0.47, 0.1]} rotation={[0, 0.3, 0]} material={m.oakLight} castShadow>
        <boxGeometry args={[0.3, 0.035, 0.22]} />
      </mesh>
      <mesh position={[-0.2, 0.5, 0.1]} rotation={[0, 0.5, 0]} material={m.ceramicDark} castShadow>
        <boxGeometry args={[0.26, 0.03, 0.2]} />
      </mesh>
      <mesh position={[0.18, 0.5, -0.12]} material={m.ceramic} castShadow>
        <sphereGeometry args={[0.12, 32, 16, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2]} />
      </mesh>
      <mesh position={[0.05, 0.56, 0.22]} material={m.ceramicDark} castShadow>
        <cylinderGeometry args={[0.05, 0.07, 0.24, 24]} />
      </mesh>
      {[[-0.1, 0.3], [0.15, -0.2], [0.04, 0.1]].map(([rx, rz], i) => (
        <mesh key={i} position={[0.05 + rx * 0.2, 0.86, 0.22 + rz * 0.2]} rotation={[rx, 0, rz]} material={m.trunk}>
          <cylinderGeometry args={[0.004, 0.007, 0.55, 5]} />
        </mesh>
      ))}
    </group>
  )
}

/** a mid-century lounge chair: walnut frame, cognac leather */
export function Armchair({ position, rotation = 0, m }: { position: V3; rotation?: number; m: Mats }) {
  return (
    <group position={position} rotation={[0, rotation, 0]}>
      {[[-0.34, 0.3], [0.34, 0.3], [-0.34, -0.3], [0.34, -0.3]].map(([x, z], i) => (
        <mesh key={i} position={[x, 0.17, z]} rotation={[z * 0.25, 0, 0]} material={m.walnut} castShadow>
          <cylinderGeometry args={[0.022, 0.018, 0.36, 10]} />
        </mesh>
      ))}
      <RoundedBox args={[0.78, 0.12, 0.74]} radius={0.05} smoothness={4} position={[0, 0.38, 0]} material={m.leather} castShadow receiveShadow />
      <RoundedBox args={[0.78, 0.62, 0.12]} radius={0.05} smoothness={4} position={[0, 0.7, -0.34]} rotation={[-0.22, 0, 0]} material={m.leather} castShadow />
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * 0.41, 0.56, 0]} material={m.walnut} castShadow>
          <boxGeometry args={[0.05, 0.04, 0.7]} />
        </mesh>
      ))}
    </group>
  )
}

/** a single leaf: a soft pointed ellipse */
const leafGeometry = (() => {
  const s = new Shape()
  s.moveTo(0, 0)
  s.bezierCurveTo(0.05, 0.04, 0.06, 0.13, 0, 0.2)
  s.bezierCurveTo(-0.06, 0.13, -0.05, 0.04, 0, 0)
  const g = new ShapeGeometry(s, 6)
  return g
})()

/** an indoor tree (olive / fiddle-leaf feel): pot, soil, trunk, an instanced crown of leaves */
export function Plant({ position, height = 1.7, leaves = 260, seed = 1, scale = 1, pot = 'stone', m }: { position: V3; height?: number; leaves?: number; seed?: number; scale?: number; pot?: 'stone' | 'terracotta'; m: Mats }) {
  const ref = useRef<InstancedMesh>(null)
  const leafMat = useMemo(() => new MeshStandardMaterial({ color: '#4f6b3d', roughness: 0.6, side: DoubleSide }), [])
  useLayoutEffect(() => {
    const mesh = ref.current
    if (!mesh) return
    let s = seed * 9301
    const r = () => ((s = (s * 16807) % 2147483647) / 2147483647)
    const o = new Object3D()
    const c = new Color()
    for (let i = 0; i < leaves; i++) {
      // leaves cluster in a loose, slightly flattened crown
      const a = r() * Math.PI * 2, u = Math.pow(r(), 0.6)
      const y = height * (0.45 + r() * 0.55)
      const rad = 0.45 * u * (1 - Math.abs(y / height - 0.75) * 0.9)
      o.position.set(Math.cos(a) * rad, y, Math.sin(a) * rad)
      o.rotation.set(-0.6 + r() * 1.6, a + Math.PI / 2 + (r() - 0.5), (r() - 0.5) * 1.2)
      const sc = 0.7 + r() * 0.8
      o.scale.set(sc, sc, sc)
      o.updateMatrix()
      mesh.setMatrixAt(i, o.matrix)
      c.setHSL(0.24 + r() * 0.06, 0.32 + r() * 0.18, 0.22 + r() * 0.14)
      mesh.setColorAt(i, c)
    }
    mesh.instanceMatrix.needsUpdate = true
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
  }, [height, leaves, seed])
  const potMat = pot === 'terracotta' ? m.terracotta : m.stonePot
  return (
    <group position={position} scale={scale}>
      <mesh position={[0, 0.22, 0]} material={potMat} castShadow receiveShadow>
        <cylinderGeometry args={[0.24, 0.18, 0.44, 40]} />
      </mesh>
      <mesh position={[0, 0.43, 0]} material={m.soil}>
        <cylinderGeometry args={[0.22, 0.22, 0.02, 32]} />
      </mesh>
      <mesh position={[0, height * 0.42, 0]} material={m.trunk} castShadow>
        <cylinderGeometry args={[0.018, 0.03, height * 0.75, 8]} />
      </mesh>
      <instancedMesh ref={ref} args={[leafGeometry, leafMat, leaves]} castShadow />
    </group>
  )
}

/** an arc floor lamp: marble base, brushed arc, a dome shade that glows warm */
export function ArcLamp({ position, rotation = 0, m, on = true, lightRef, glowRef }: { position: V3; rotation?: number; m: Mats; on?: boolean; lightRef?: RefObject<PointLight | null>; glowRef?: RefObject<MeshStandardMaterial | null> }) {
  const tube = useMemo(() => new TubeGeometry(new CatmullRomCurve3([new Vector3(0, 0.05, 0), new Vector3(0, 1.4, 0), new Vector3(0.25, 2.05, 0), new Vector3(0.9, 2.15, 0), new Vector3(1.3, 1.95, 0)]), 40, 0.014, 8), [])
  const glow = useMemo(() => new MeshStandardMaterial({ color: '#fff3dc', emissive: '#ffd9a0', emissiveIntensity: on ? 2.4 : 0, side: DoubleSide }), [on])
  // the time of day dims the lamp through these handles
  useLayoutEffect(() => { if (glowRef) glowRef.current = glow }, [glow, glowRef])
  return (
    <group position={position} rotation={[0, rotation, 0]}>
      <mesh position={[0, 0.03, 0]} material={m.travertine} castShadow receiveShadow>
        <cylinderGeometry args={[0.2, 0.22, 0.06, 40]} />
      </mesh>
      <mesh geometry={tube} material={m.brass} castShadow />
      <mesh position={[1.3, 1.92, 0]} material={m.brass} castShadow>
        <sphereGeometry args={[0.2, 40, 20, 0, Math.PI * 2, 0, Math.PI / 2]} />
      </mesh>
      <mesh position={[1.3, 1.9, 0]} rotation={[Math.PI / 2, 0, 0]} material={glow}>
        <circleGeometry args={[0.17, 32]} />
      </mesh>
      {on && <pointLight ref={lightRef} position={[1.3, 1.7, 0]} color="#ffcf94" intensity={4} distance={4.5} decay={2} />}
    </group>
  )
}

/** built-in shelving: walnut frame, shelves of books and ceramics */
export function Shelving({ position, rotation = 0, m }: { position: V3; rotation?: number; m: Mats }) {
  const spines = useMemo(() => [bookSpines(31), bookSpines(37), bookSpines(41)], [])
  const w = 2.6, h = 2.5, d = 0.36
  const shelves = [0.35, 0.95, 1.55, 2.15]
  return (
    <group position={position} rotation={[0, rotation, 0]}>
      {[-w / 2, w / 2].map((x) => (
        <mesh key={x} position={[x, h / 2, 0]} material={m.walnut} castShadow receiveShadow>
          <boxGeometry args={[0.04, h, d]} />
        </mesh>
      ))}
      <mesh position={[0, h / 2, -d / 2 + 0.01]} material={m.walnut} receiveShadow>
        <boxGeometry args={[w, h, 0.02]} />
      </mesh>
      {shelves.map((y) => (
        <mesh key={y} position={[0, y, 0]} material={m.walnut} castShadow receiveShadow>
          <boxGeometry args={[w, 0.035, d]} />
        </mesh>
      ))}
      {/* books: one block per shelf, its front painted with spines */}
      {[0, 1, 2].map((i) => (
        <mesh key={i} position={[-0.45 + (i % 2) * 0.7, shelves[i] + 0.15, 0.02]} castShadow>
          <boxGeometry args={[0.95, 0.27, 0.24]} />
          <meshStandardMaterial attach="material-0" color="#6a5a4a" roughness={0.8} />
          <meshStandardMaterial attach="material-1" color="#6a5a4a" roughness={0.8} />
          <meshStandardMaterial attach="material-2" color="#e8e0d2" roughness={0.9} />
          <meshStandardMaterial attach="material-3" color="#6a5a4a" roughness={0.8} />
          <meshStandardMaterial attach="material-4" map={spines[i]} roughness={0.75} />
          <meshStandardMaterial attach="material-5" color="#6a5a4a" roughness={0.8} />
        </mesh>
      ))}
      {/* ceramics */}
      <mesh position={[0.75, shelves[0] + 0.14, 0]} material={m.ceramic} castShadow>
        <sphereGeometry args={[0.13, 32, 20]} />
      </mesh>
      <mesh position={[-0.9, shelves[1] + 0.16, 0]} material={m.ceramicDark} castShadow>
        <cylinderGeometry args={[0.06, 0.09, 0.3, 28]} />
      </mesh>
      <mesh position={[0.95, shelves[2] + 0.1, 0]} material={m.terracotta} castShadow>
        <cylinderGeometry args={[0.1, 0.08, 0.18, 28]} />
      </mesh>
      <mesh position={[0.2, shelves[3] + 0.12, 0]} material={m.ceramic} castShadow>
        <cylinderGeometry args={[0.05, 0.11, 0.22, 28]} />
      </mesh>
      <mesh position={[-0.6, shelves[3] + 0.04, 0]} material={m.brass} castShadow>
        <torusGeometry args={[0.07, 0.012, 12, 40]} />
      </mesh>
    </group>
  )
}

/** a wall of vertical walnut slats (acoustic panel) */
export function SlatWall({ position, width, height, rotation = 0, m }: { position: V3; width: number; height: number; rotation?: number; m: Mats }) {
  const ref = useRef<InstancedMesh>(null)
  const n = Math.floor(width / 0.07)
  useLayoutEffect(() => {
    const o = new Object3D()
    for (let i = 0; i < n; i++) {
      o.position.set(-width / 2 + 0.035 + i * 0.07, height / 2, 0)
      o.updateMatrix()
      ref.current!.setMatrixAt(i, o.matrix)
    }
    ref.current!.instanceMatrix.needsUpdate = true
  }, [n, width, height])
  return (
    <group position={position} rotation={[0, rotation, 0]}>
      <mesh position={[0, height / 2, -0.02]} receiveShadow>
        <boxGeometry args={[width, height, 0.02]} />
        <meshStandardMaterial color="#2b2420" roughness={0.9} />
      </mesh>
      <instancedMesh ref={ref} args={[undefined, m.walnut, n]} castShadow receiveShadow>
        <boxGeometry args={[0.04, height, 0.04]} />
      </instancedMesh>
    </group>
  )
}

/** sheer linen curtain: a gently folded, translucent panel */
export function Curtain({ position, width, height }: { position: V3; width: number; height: number }) {
  const geo = useMemo(() => {
    const g = new PlaneGeometry(width, height, 64, 1)
    const p = g.attributes.position
    for (let i = 0; i < p.count; i++) p.setZ(i, Math.sin((p.getX(i) / width) * Math.PI * 14) * 0.035)
    g.computeVertexNormals()
    return g
  }, [width, height])
  return (
    <mesh geometry={geo} position={position}>
      <meshStandardMaterial color="#f4efe6" roughness={1} transparent opacity={0.72} side={DoubleSide} />
    </mesh>
  )
}

/** a framed artwork */
export function Art({ position, rotation = 0, w, h, map, frame = '#2a2522' }: { position: V3; rotation?: number; w: number; h: number; map: THREE_Texture; frame?: string }) {
  return (
    <group position={position} rotation={[0, rotation, 0]}>
      <mesh castShadow>
        <boxGeometry args={[w + 0.06, h + 0.06, 0.04]} />
        <meshStandardMaterial color={frame} roughness={0.5} />
      </mesh>
      <mesh position={[0, 0, 0.021]}>
        <planeGeometry args={[w, h]} />
        <meshStandardMaterial map={map} roughness={0.85} />
      </mesh>
    </group>
  )
}
type THREE_Texture = import('three').Texture
