import {
  Bone, BufferAttribute, type BufferGeometry, Color, Euler, Float32BufferAttribute, Matrix4, MeshStandardMaterial,
  Quaternion, Skeleton, SkinnedMesh, Sphere, Vector3,
} from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { createRng } from '@/utils/rng'
import { charGeometries, type CharacterDetail, type CharacterLook } from './characterLook'

/**
 * Stylised-realistic human, built as ONE skinned mesh (one draw call per
 * person). Proportions follow a ≈7.3-head canon for a 1.74 m adult: hip
 * joint at 0.93 m, knee 0.50 m, ankle 0.08 m, shoulders 1.42 m, crown 1.75 m.
 * Primitive parts (ellipsoids, capsules, rounded boxes) are merged with vertex
 * colours and bound rigidly to 23 procedural bones, including toes (heel-to-
 * toe roll), hands, neck and a two-segment spine for natural upper-body motion.
 */
export type BoneName =
  | 'root' | 'body' | 'hips'
  | 'legL' | 'kneeL' | 'footL' | 'toeL' | 'legR' | 'kneeR' | 'footR' | 'toeR'
  | 'spine' | 'chest' | 'neck' | 'head' | 'eyeL' | 'eyeR'
  | 'armL' | 'elbowL' | 'handL' | 'armR' | 'elbowR' | 'handR'

/** Height of the hips bone above the feet at rest. */
export const HIP_Y = 0.97
/** Hip joint → ankle distance (used to match stride to leg swing). */
export const LEG_LENGTH = 0.85

type V3 = [number, number, number]
interface PartSpec {
  bone: BoneName
  geo: keyof ReturnType<typeof charGeometries>
  color: number
  pos?: V3
  rot?: V3
  scale: V3
  /** per-vertex colour jitter (fabric / skin variation) */
  noise?: number
}

let sharedMaterial: MeshStandardMaterial | null = null
export function characterMaterial() {
  if (!sharedMaterial) sharedMaterial = new MeshStandardMaterial({ vertexColors: true, roughness: 0.74, metalness: 0 })
  return sharedMaterial
}

function shade(c: number, amt: number) {
  const f = (v: number) => Math.max(0, Math.min(255, v + amt))
  return (f((c >> 16) & 255) << 16) | (f((c >> 8) & 255) << 8) | f(c & 255)
}

function boneLayout(look: CharacterLook): { name: BoneName; parent: BoneName | null; pos: V3 }[] {
  const b = look.build
  return [
    { name: 'root', parent: null, pos: [0, 0, 0] },
    { name: 'body', parent: 'root', pos: [0, 0, 0] },
    { name: 'hips', parent: 'body', pos: [0, HIP_Y, 0] },
    { name: 'legL', parent: 'hips', pos: [0.092 * b, -0.04, 0] },
    { name: 'kneeL', parent: 'legL', pos: [0, -0.43, 0] },
    { name: 'footL', parent: 'kneeL', pos: [0, -0.42, 0] },
    { name: 'toeL', parent: 'footL', pos: [0, -0.058, 0.12] },
    { name: 'legR', parent: 'hips', pos: [-0.092 * b, -0.04, 0] },
    { name: 'kneeR', parent: 'legR', pos: [0, -0.43, 0] },
    { name: 'footR', parent: 'kneeR', pos: [0, -0.42, 0] },
    { name: 'toeR', parent: 'footR', pos: [0, -0.058, 0.12] },
    { name: 'spine', parent: 'hips', pos: [0, 0.06, 0] },
    { name: 'chest', parent: 'spine', pos: [0, 0.2, 0] },
    { name: 'neck', parent: 'chest', pos: [0, 0.23, 0.005] },
    { name: 'head', parent: 'neck', pos: [0, 0.075, 0.005] },
    { name: 'eyeL', parent: 'head', pos: [0.036, 0.113, 0.093] },
    { name: 'eyeR', parent: 'head', pos: [-0.036, 0.113, 0.093] },
    { name: 'armL', parent: 'chest', pos: [0.19 * b, 0.175, -0.005] },
    { name: 'elbowL', parent: 'armL', pos: [0, -0.29, 0] },
    { name: 'handL', parent: 'elbowL', pos: [0, -0.255, 0] },
    { name: 'armR', parent: 'chest', pos: [-0.19 * b, 0.175, -0.005] },
    { name: 'elbowR', parent: 'armR', pos: [0, -0.29, 0] },
    { name: 'handR', parent: 'elbowR', pos: [0, -0.255, 0] },
  ]
}

/** capsule template is 1.6 units tall and 1 unit wide */
const cap = (d: number, len: number): V3 => [d, len / 1.6, d]

function partList(look: CharacterLook): PartSpec[] {
  const b = look.build
  const P: PartSpec[] = []
  const add = (bone: BoneName, geo: PartSpec['geo'], color: number, scale: V3, pos?: V3, rot?: V3, noise = 0.03) =>
    P.push({ bone, geo, color, scale, pos, rot, noise })

  const skin = look.skin
  const lip = shade(skin, -28)
  const top = look.top
  const bottom = look.bottom
  const skirt = look.bottomStyle === 'skirt'
  const shorts = look.bottomStyle === 'shorts'
  const legColor = skirt ? skin : bottom
  const shinColor = skirt || shorts ? skin : bottom

  // ── pelvis & legs ───────────────────────────────────────────────────
  add('hips', 'ellipsoid', skirt ? top : bottom, [0.33 * b, 0.21, 0.22], [0, -0.01, 0])
  if (!skirt) add('hips', 'boxSharp', shade(bottom, -18), [0.325 * b, 0.04, 0.215], [0, 0.075, 0])
  if (skirt) add('hips', 'cone', bottom, [0.44 * b, 0.46, 0.34], [0, -0.17, 0.005])
  for (const [leg, knee, foot, toe] of [['legL', 'kneeL', 'footL', 'toeL'], ['legR', 'kneeR', 'footR', 'toeR']] as const) {
    add(leg, 'ellipsoid', legColor, [0.155, 0.24, 0.165], [0, -0.08, 0.005])
    add(leg, 'capsule', legColor, cap(0.135, 0.45), [0, -0.215, 0])
    if (shorts) add(leg, 'capsule', bottom, cap(0.16, 0.26), [0, -0.1, 0])
    add(knee, 'ellipsoid', shinColor, [0.118, 0.22, 0.13], [0, -0.12, -0.012])
    add(knee, 'capsule', shinColor, cap(0.108, 0.44), [0, -0.205, 0])
    if (!skirt && !shorts) add(knee, 'capsule', shade(bottom, -10), cap(0.118, 0.1), [0, -0.37, 0])
    // shoe: heel block + sole on the foot bone, toe cap + toe sole on the toe bone
    add(foot, 'box', look.shoes, [0.098, 0.085, 0.17], [0, -0.035, -0.002])
    add(foot, 'boxSharp', look.sole, [0.104, 0.024, 0.18], [0, -0.075, 0.005])
    add(toe, 'box', look.shoes, [0.096, 0.068, 0.115], [0, 0.012, 0.03])
    add(toe, 'boxSharp', look.sole, [0.1, 0.024, 0.115], [0, -0.017, 0.032])
  }

  // ── torso ───────────────────────────────────────────────────────────
  add('spine', 'ellipsoid', top, [0.3 * b, 0.28, 0.195], [0, 0.1, 0])
  add('chest', 'ellipsoid', top, [0.34 * b, 0.3, 0.205], [0, 0.08, 0.005])
  add('chest', 'ellipsoid', top, [0.385 * b, 0.11, 0.175], [0, 0.18, -0.008])
  switch (look.topStyle) {
    case 'jacket':
      add('chest', 'boxSharp', look.topAccent, [0.1, 0.3, 0.02], [0, 0.07, 0.105])
      add('chest', 'boxSharp', shade(top, -14), [0.035, 0.2, 0.02], [0.06, 0.15, 0.1], [0, 0, 0.35])
      add('chest', 'boxSharp', shade(top, -14), [0.035, 0.2, 0.02], [-0.06, 0.15, 0.1], [0, 0, -0.35])
      add('spine', 'ellipsoid', top, [0.305 * b, 0.1, 0.2], [0, -0.03, 0])
      break
    case 'hoodie':
      add('chest', 'ellipsoid', shade(top, -8), [0.2, 0.1, 0.13], [0, 0.23, -0.08])
      add('chest', 'boxSharp', look.topAccent, [0.008, 0.1, 0.008], [0.03, 0.11, 0.11])
      add('chest', 'boxSharp', look.topAccent, [0.008, 0.1, 0.008], [-0.03, 0.11, 0.11])
      add('spine', 'boxSharp', shade(top, -10), [0.3 * b, 0.05, 0.2], [0, -0.03, 0])
      break
    case 'shirt':
      add('chest', 'boxSharp', shade(top, -10), [0.075, 0.035, 0.02], [0.035, 0.225, 0.07], [0.4, 0, 0.5])
      add('chest', 'boxSharp', shade(top, -10), [0.075, 0.035, 0.02], [-0.035, 0.225, 0.07], [0.4, 0, -0.5])
      for (let i = 0; i < 3; i++) add('chest', 'ellipsoidLo', shade(top, -30), [0.01, 0.01, 0.006], [0, 0.16 - i * 0.07, 0.108], undefined, 0)
      break
    case 'sweater':
      add('spine', 'boxSharp', shade(top, -12), [0.3 * b, 0.05, 0.2], [0, -0.02, 0])
      add('chest', 'ellipsoid', shade(top, -12), [0.13, 0.04, 0.12], [0, 0.235, 0.01])
      break
    case 'blouse':
      add('chest', 'ellipsoid', skin, [0.1, 0.05, 0.05], [0, 0.215, 0.075])
      break
    default: // tee
      add('chest', 'ellipsoid', shade(top, -10), [0.12, 0.035, 0.11], [0, 0.235, 0.01])
  }

  // ── neck & head ─────────────────────────────────────────────────────
  add('neck', 'capsule', skin, cap(0.095, 0.14), [0, 0.03, 0])
  add('head', 'head', skin, [0.19, 0.235, 0.212], [0, 0.105, 0.004], undefined, 0.02)
  add('head', 'ellipsoid', skin, [0.148, 0.13, 0.15], [0, 0.04, 0.03], undefined, 0.02)
  add('head', 'ellipsoidLo', shade(skin, -10), [0.028, 0.058, 0.04], [0.094, 0.1, -0.005])
  add('head', 'ellipsoidLo', shade(skin, -10), [0.028, 0.058, 0.04], [-0.094, 0.1, -0.005])
  add('head', 'ellipsoidLo', shade(skin, -6), [0.03, 0.05, 0.042], [0, 0.083, 0.103], [-0.2, 0, 0])
  add('head', 'boxSharp', lip, [0.042, 0.009, 0.012], [0, 0.043, 0.098])
  add('head', 'boxSharp', shade(look.hair, 10), [0.042, 0.009, 0.012], [0.037, 0.137, 0.099], [0, 0, -0.1])
  add('head', 'boxSharp', shade(look.hair, 10), [0.042, 0.009, 0.012], [-0.037, 0.137, 0.099], [0, 0, 0.1])
  for (const eye of ['eyeL', 'eyeR'] as const) {
    add(eye, 'ellipsoidLo', 0xf2eee8, [0.027, 0.014, 0.01], [0, 0, 0], undefined, 0)
    add(eye, 'ellipsoidLo', 0x2a1f1a, [0.013, 0.013, 0.008], [0, 0, 0.0045], undefined, 0)
  }
  if (look.accessory === 'glasses') {
    add('head', 'torus', 0x2a2626, [0.034, 0.028, 0.02], [0.036, 0.113, 0.103], undefined, 0)
    add('head', 'torus', 0x2a2626, [0.034, 0.028, 0.02], [-0.036, 0.113, 0.103], undefined, 0)
    add('head', 'boxSharp', 0x2a2626, [0.02, 0.005, 0.005], [0, 0.117, 0.104], undefined, 0)
  }
  hair(look, add)

  // ── arms & hands ────────────────────────────────────────────────────
  for (const [arm, elbow, hand, side] of [['armL', 'elbowL', 'handL', 1], ['armR', 'elbowR', 'handR', -1]] as const) {
    add(arm, 'ellipsoid', top, [0.094, 0.1, 0.098], [0, -0.035, 0])
    if (look.longSleeves) add(arm, 'capsule', top, cap(0.086, 0.31), [0, -0.145, 0])
    else {
      add(arm, 'capsule', skin, cap(0.084, 0.3), [0, -0.15, 0])
      add(arm, 'capsule', top, cap(0.106, 0.15), [0, -0.055, 0])
    }
    add(elbow, 'capsule', look.longSleeves ? top : skin, cap(look.longSleeves ? 0.076 : 0.068, 0.27), [0, -0.12, 0])
    if (look.longSleeves) add(elbow, 'capsule', shade(top, -12), cap(0.078, 0.05), [0, -0.235, 0])
    add(hand, 'box', skin, [0.072, 0.092, 0.032], [0, -0.05, 0.004], undefined, 0.02)
    add(hand, 'box', skin, [0.066, 0.055, 0.026], [0, -0.108, 0.012], [0.25, 0, 0], 0.02)
    add(hand, 'capsule', skin, cap(0.024, 0.06), [side * 0.034, -0.045, 0.022], [0.3, 0, side * 0.5], 0.02)
  }

  // ── accessories & props ─────────────────────────────────────────────
  const ac = look.accessoryColor
  switch (look.accessory) {
    case 'backpack':
      add('chest', 'box', ac, [0.28, 0.38, 0.13], [0, 0.04, -0.17])
      add('chest', 'box', shade(ac, -15), [0.2, 0.13, 0.05], [0, -0.06, -0.24])
      for (const sx of [-1, 1]) add('chest', 'boxSharp', shade(ac, -25), [0.04, 0.36, 0.02], [sx * 0.09, 0.07, 0.108])
      break
    case 'crossbody':
      add('chest', 'boxSharp', shade(ac, -20), [0.03, 0.56, 0.018], [0, 0.03, 0.113], [0, 0, 0.62])
      add('hips', 'box', ac, [0.19, 0.14, 0.055], [-0.15 * b, 0.03, 0.08], [0, 0.35, 0])
      break
    case 'totebag':
      add('chest', 'box', ac, [0.05, 0.32, 0.29], [-0.24 * b, -0.23, 0.02])
      add('chest', 'boxSharp', ac, [0.02, 0.36, 0.03], [-0.2 * b, 0.02, 0.02], [0, 0, 0.2])
      break
    case 'scarf':
      add('chest', 'torus', ac, [0.2, 0.2, 0.55], [0, 0.23, 0.005], [Math.PI / 2, 0, 0])
      add('chest', 'boxSharp', ac, [0.06, 0.24, 0.025], [0.045, 0.1, 0.11], [0.05, 0, 0.1])
      break
    case 'lanyard':
      add('chest', 'boxSharp', 0x2f3f66, [0.01, 0.2, 0.008], [0.03, 0.14, 0.11], [0, 0, -0.25])
      add('chest', 'boxSharp', 0x2f3f66, [0.01, 0.2, 0.008], [-0.03, 0.14, 0.11], [0, 0, 0.25])
      add('chest', 'boxSharp', 0xf5f3ee, [0.055, 0.075, 0.008], [0, 0.02, 0.113], undefined, 0)
      break
  }
  switch (look.prop) {
    case 'cup':
      add('handR', 'cyl', 0xf5f1ea, [0.07, 0.1, 0.07], [0, -0.1, 0.045], undefined, 0)
      add('handR', 'cyl', 0xb8906a, [0.073, 0.04, 0.073], [0, -0.1, 0.045], undefined, 0)
      break
    case 'phone':
      add('handR', 'boxSharp', 0x22222a, [0.07, 0.145, 0.011], [0, -0.1, 0.028], undefined, 0)
      break
    case 'book':
      add('handR', 'boxSharp', 0x7a3f3a, [0.16, 0.22, 0.03], [-0.05, -0.1, 0.05], [0, 0, 0.1])
      break
    case 'tablet':
      add('handR', 'boxSharp', 0x2a2a30, [0.19, 0.25, 0.012], [-0.05, -0.12, 0.04], undefined, 0)
      break
  }
  return P
}

function hair(look: CharacterLook, add: (bone: BoneName, geo: PartSpec['geo'], color: number, scale: V3, pos?: V3, rot?: V3, noise?: number) => void) {
  const h = look.hair
  const s = look.hairStyle
  const capScale: V3 = s === 'buzz' ? [0.196, 0.236, 0.216] : s === 'curly' ? [0.22, 0.27, 0.235] : [0.203, 0.25, 0.225]
  add('head', 'hairCap', h, capScale, [0, 0.107, -0.004], [-0.22, 0, 0], 0.06)
  if (s === 'buzz') return
  add('head', 'ellipsoid', h, [0.19, 0.15, 0.13], [0, 0.085, -0.065], undefined, 0.06)
  switch (s) {
    case 'side':
      add('head', 'ellipsoid', h, [0.17, 0.055, 0.1], [0.025, 0.2, 0.06], [0.2, 0, -0.28], 0.06)
      break
    case 'short':
      add('head', 'ellipsoid', h, [0.17, 0.05, 0.09], [0, 0.205, 0.06], [0.3, 0, 0], 0.06)
      break
    case 'long':
      add('head', 'ellipsoid', h, [0.2, 0.34, 0.1], [0, -0.02, -0.075], undefined, 0.06)
      for (const sx of [-1, 1]) add('head', 'ellipsoid', h, [0.05, 0.24, 0.1], [sx * 0.088, 0.03, -0.01], undefined, 0.06)
      break
    case 'bun':
      add('head', 'ellipsoid', h, [0.095, 0.09, 0.095], [0, 0.215, -0.085], undefined, 0.06)
      break
    case 'ponytail':
      add('head', 'capsule', h, cap(0.07, 0.26), [0, 0.02, -0.13], [0.35, 0, 0], 0.06)
      break
    case 'curly':
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2
        add('head', 'ellipsoidLo', h, [0.08, 0.075, 0.08], [Math.cos(a) * 0.085, 0.18 + Math.sin(a * 3) * 0.015, Math.sin(a) * 0.08 - 0.02], undefined, 0.06)
      }
      break
  }
}

export interface CharacterRig {
  mesh: SkinnedMesh
  bones: Record<BoneName, Bone>
  dispose: () => void
}

const _m = new Matrix4()
const _q = new Quaternion()
const _e = new Euler()
const _v = new Vector3()
const _s = new Vector3()
const _c = new Color()

export function buildCharacterRig(look: CharacterLook, detail: CharacterDetail = 'high'): CharacterRig {
  const layout = boneLayout(look)
  const bones = {} as Record<BoneName, Bone>
  const order: BoneName[] = []
  for (const l of layout) {
    const bone = new Bone()
    bone.name = l.name
    bone.position.set(...l.pos)
    bones[l.name] = bone
    order.push(l.name)
    if (l.parent) bones[l.parent].add(bone)
  }
  bones.root.updateMatrixWorld(true)
  const index = new Map(order.map((n, i) => [n, i]))
  const rng = createRng(look.seed * 31 + 7)

  const templates = charGeometries(detail)
  const pieces: BufferGeometry[] = []
  for (const p of partList(look)) {
    const tpl = templates[p.geo]
    if (!tpl) continue
    // normalise indexed / non-indexed templates so they can be merged
    const g = tpl.index ? tpl.toNonIndexed() : tpl.clone()
    g.deleteAttribute('uv')
    _e.set(...(p.rot ?? [0, 0, 0]))
    _q.setFromEuler(_e)
    _m.compose(_v.set(...(p.pos ?? [0, 0, 0])), _q, _s.set(...p.scale))
    g.applyMatrix4(_m.premultiply(bones[p.bone].matrixWorld))
    const n = g.attributes.position.count
    const col = new Float32Array(n * 3)
    _c.setHex(p.color)
    const noise = p.noise ?? 0
    for (let i = 0; i < n; i += 3) {
      // jitter per triangle: subtle fabric / skin variation instead of flat plastic
      const k = 1 + (rng.next() - 0.5) * noise * 2
      for (let t = 0; t < 3 && i + t < n; t++) col.set([_c.r * k, _c.g * k, _c.b * k], (i + t) * 3)
    }
    g.setAttribute('color', new Float32BufferAttribute(col, 3))
    const si = new Uint16Array(n * 4)
    const sw = new Float32Array(n * 4)
    const bi = index.get(p.bone)!
    for (let i = 0; i < n; i++) {
      si[i * 4] = bi
      sw[i * 4] = 1
    }
    g.setAttribute('skinIndex', new BufferAttribute(si, 4))
    g.setAttribute('skinWeight', new BufferAttribute(sw, 4))
    pieces.push(g)
  }
  const geometry = mergeGeometries(pieces, false)!
  pieces.forEach((p) => p.dispose())
  const mesh = new SkinnedMesh(geometry, characterMaterial())
  mesh.add(bones.root)
  const skeleton = new Skeleton(order.map((n) => bones[n]))
  mesh.bind(skeleton)
  geometry.boundingSphere = new Sphere(new Vector3(0, 0.9, 0), 1.3)
  mesh.boundingSphere = geometry.boundingSphere.clone()
  return {
    mesh,
    bones,
    dispose: () => {
      geometry.dispose()
      skeleton.dispose()
    },
  }
}
