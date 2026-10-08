import {
  Bone, BufferAttribute, type BufferGeometry, Color, Euler, Float32BufferAttribute, Matrix4, MeshStandardMaterial,
  Quaternion, Skeleton, SkinnedMesh, Sphere, Vector3,
} from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { createRng } from '@/utils/rng'
import { charGeometries, type CharacterDetail, type CharacterLook } from './characterLook'
import { buildLofts } from './characterLoft'

/**
 * Stylised-realistic human, built as ONE skinned mesh (one draw call per
 * person). Proportions follow a ≈7.3-head canon for a 1.74 m adult: hip
 * joint at 0.93 m, knee 0.50 m, ankle 0.08 m, shoulders 1.42 m, crown 1.75 m.
 * The body (torso, legs, arms, neck) is lofted as continuous surfaces with
 * skin weights blended across joints (characterLoft); details such as shoes,
 * hands, face, hair, collars and props are primitives bound to one bone.
 * 23 procedural bones, including toes (heel-to-toe roll), hands, neck and a
 * two-segment spine for natural upper-body motion.
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
    { name: 'eyeL', parent: 'head', pos: [0.035, 0.113, 0.096] },
    { name: 'eyeR', parent: 'head', pos: [-0.035, 0.113, 0.096] },
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
  const add = (bone: BoneName, geo: PartSpec['geo'], color: number, scale: V3, pos?: V3, rot?: V3, noise = 0.012) =>
    P.push({ bone, geo, color, scale, pos, rot, noise })

  const skin = look.skin
  const lip = shade(skin, -24)
  const top = look.top
  const bottom = look.bottom
  const skirt = look.bottomStyle === 'skirt'

  // ── lower body details (legs themselves are lofted) ──────────────────
  if (skirt) {
    // midi skirt: hem below the knee, with a waistband closing the top
    add('hips', 'cone', bottom, [0.5 * b, 0.74, 0.38], [0, -0.29, 0.004])
    add('hips', 'cyl', shade(bottom, -8), [0.31 * b, 0.04, 0.215], [0, 0.07, 0.0], undefined, 0)
  }
  for (const [foot, toe] of [['footL', 'toeL'], ['footR', 'toeR']] as const) {
    // shoe: heel counter + sole on the foot bone, tapered toe box + toe sole on the toe bone
    add(foot, 'box', look.shoes, [0.09, 0.078, 0.15], [0, -0.034, -0.012])
    add(foot, 'boxSharp', look.sole, [0.094, 0.02, 0.17], [0, -0.074, 0.0])
    // rounded toe box rather than a block
    add(toe, 'ellipsoid', look.shoes, [0.09, 0.066, 0.16], [0, 0.006, 0.03], [0.06, 0, 0])
    add(toe, 'boxSharp', look.sole, [0.09, 0.02, 0.13], [0, -0.017, 0.03])
    add(foot, 'boxSharp', shade(look.shoes, -18), [0.06, 0.01, 0.05], [0, 0.006, 0.044], [-0.35, 0, 0], 0)
  }

  // ── garment details on the lofted torso ──────────────────────────────
  switch (look.topStyle) {
    case 'overshirt':
    case 'jacket': {
      const edge = shade(top, -16)
      // open front edges and a soft collar standing around the neck
      for (const sx of [-1, 1]) add('chest', 'boxSharp', edge, [0.014, 0.3, 0.01], [sx * 0.056, 0.03, 0.136], [0.08, 0, sx * -0.1])
      // soft collar band lying around the base of the neck
      add('chest', 'torus', top, [0.132, 0.118, 0.3], [0, 0.226, 0.0], [Math.PI / 2 - 0.34, 0, 0], 0)
      // chest pockets with flaps
      for (const sx of [-1, 1]) {
        add('chest', 'boxSharp', shade(top, -6), [0.064, 0.066, 0.005], [sx * 0.1, 0.1, 0.128], [0.06, sx * 0.42, 0], 0)
        add('chest', 'boxSharp', edge, [0.068, 0.018, 0.008], [sx * 0.1, 0.136, 0.129], [0.06, sx * 0.42, 0], 0)
      }
      // tee neckline peeking out
      add('chest', 'torus', shade(look.topAccent, -8), [0.105, 0.08, 0.3], [0, 0.232, 0.018], [Math.PI / 2 - 0.25, 0, 0], 0)
      break
    }
    case 'hoodie':
      add('chest', 'ellipsoid', shade(top, -8), [0.2, 0.1, 0.13], [0, 0.23, -0.08])
      add('chest', 'boxSharp', look.topAccent, [0.008, 0.1, 0.008], [0.03, 0.11, 0.113])
      add('chest', 'boxSharp', look.topAccent, [0.008, 0.1, 0.008], [-0.03, 0.11, 0.113])
      break
    case 'shirt':
      for (const sx of [-1, 1]) add('chest', 'boxSharp', shade(top, -6), [0.07, 0.03, 0.05], [sx * 0.042, 0.238, 0.05], [0.55, sx * -0.35, sx * 0.55])
      for (let i = 0; i < 4; i++) add('chest', 'ellipsoidLo', shade(top, -36), [0.009, 0.009, 0.005], [0, 0.2 - i * 0.075, 0.116], undefined, 0)
      break
    case 'sweater':
      add('chest', 'torus', shade(top, -12), [0.11, 0.09, 0.35], [0, 0.232, 0.012], [Math.PI / 2 - 0.25, 0, 0], 0)
      break
    case 'blouse':
      add('chest', 'ellipsoid', skin, [0.09, 0.045, 0.04], [0, 0.222, 0.08])
      add('chest', 'torus', shade(top, -10), [0.1, 0.085, 0.3], [0, 0.228, 0.02], [Math.PI / 2 - 0.3, 0, 0], 0)
      break
    default: // tee
      add('chest', 'torus', shade(top, -12), [0.105, 0.085, 0.32], [0, 0.232, 0.016], [Math.PI / 2 - 0.25, 0, 0], 0)
  }

  // ── head & face ─────────────────────────────────────────────────────
  // one continuous skull-to-jaw shape (see headShape) — no seams, no toy head
  add('head', 'face', skin, [0.18, 0.232, 0.208], [0, 0.102, 0.006], undefined, 0)
  // ears
  for (const sx of [-1, 1]) add('head', 'ellipsoidLo', shade(skin, -8), [0.024, 0.054, 0.036], [sx * 0.086, 0.1, -0.005], [0, sx * 0.3, 0], 0.006)
  // nose: bridge + tip
  add('head', 'ellipsoid', shade(skin, -2), [0.018, 0.052, 0.03], [0, 0.09, 0.103], [-0.25, 0, 0], 0)
  add('head', 'ellipsoid', shade(skin, -4), [0.028, 0.02, 0.024], [0, 0.068, 0.109], undefined, 0)
  // mouth + lower lip
  add('head', 'boxSharp', lip, [0.036, 0.006, 0.01], [0, 0.043, 0.106], undefined, 0)
  add('head', 'ellipsoidLo', shade(skin, -14), [0.03, 0.01, 0.012], [0, 0.034, 0.104], undefined, 0)
  // brows
  for (const sx of [-1, 1]) add('head', 'boxSharp', shade(look.hair, 22), [0.034, 0.006, 0.01], [sx * 0.034, 0.134, 0.099], [0, 0, sx * -0.07], 0)
  // eyes: small, set in (no cartoon whites)
  for (const eye of ['eyeL', 'eyeR'] as const) {
    add(eye, 'ellipsoidLo', 0xe9e3da, [0.022, 0.011, 0.008], [0, 0, -0.002], undefined, 0)
    add(eye, 'ellipsoidLo', 0x241a16, [0.011, 0.011, 0.007], [0, 0, 0.002], undefined, 0)
    add(eye, 'boxSharp', shade(skin, -20), [0.026, 0.004, 0.008], [0, 0.009, 0.001], undefined, 0)
  }
  if (look.accessory === 'glasses') {
    add('head', 'torus', 0x2a2626, [0.034, 0.028, 0.02], [0.036, 0.113, 0.104], undefined, 0)
    add('head', 'torus', 0x2a2626, [0.034, 0.028, 0.02], [-0.036, 0.113, 0.104], undefined, 0)
    add('head', 'boxSharp', 0x2a2626, [0.02, 0.005, 0.005], [0, 0.117, 0.105], undefined, 0)
  }
  hair(look, add)

  // ── shoulders & hands (arms are lofted) ─────────────────────────────
  for (const [arm, elbow, hand, side] of [['armL', 'elbowL', 'handL', 1], ['armR', 'elbowR', 'handR', -1]] as const) {
    // deltoid: rounds the shoulder where the sleeve meets the torso
    add(arm, 'ellipsoid', top, [0.104, 0.11, 0.11], [side * -0.008, -0.03, 0], undefined, 0.01)
    if (look.longSleeves) add(elbow, 'torus', shade(top, -14), [0.064, 0.058, 0.5], [0, -0.228, 0], [Math.PI / 2, 0, 0], 0)
    // hand: palm, fingers (slightly curled) and thumb
    add(hand, 'box', skin, [0.07, 0.085, 0.03], [0, -0.048, 0.004], undefined, 0.006)
    add(hand, 'box', skin, [0.064, 0.07, 0.024], [0, -0.108, 0.012], [0.3, 0, 0], 0.006)
    add(hand, 'capsule', skin, cap(0.022, 0.06), [side * 0.034, -0.045, 0.02], [0.3, 0, side * 0.5], 0.006)
  }

  // ── accessories & props ─────────────────────────────────────────────
  const ac = look.accessoryColor
  switch (look.accessory) {
    case 'watch':
      add('elbowL', 'torus', 0x2a2626, [0.058, 0.05, 0.9], [0, -0.238, 0], [Math.PI / 2, 0, 0], 0)
      add('elbowL', 'boxSharp', ac, [0.012, 0.03, 0.034], [0.03, -0.238, 0.004], undefined, 0)
      break
    case 'backpack':
      add('chest', 'box', ac, [0.28, 0.38, 0.13], [0, 0.04, -0.17])
      add('chest', 'box', shade(ac, -15), [0.2, 0.13, 0.05], [0, -0.06, -0.24])
      for (const sx of [-1, 1]) add('chest', 'boxSharp', shade(ac, -25), [0.04, 0.36, 0.02], [sx * 0.09, 0.07, 0.115])
      break
    case 'crossbody':
      add('chest', 'boxSharp', shade(ac, -20), [0.03, 0.56, 0.018], [0, 0.03, 0.12], [0, 0, 0.62])
      add('hips', 'box', ac, [0.19, 0.14, 0.055], [-0.15 * b, 0.03, 0.085], [0, 0.35, 0])
      break
    case 'totebag':
      add('chest', 'box', ac, [0.05, 0.32, 0.29], [-0.24 * b, -0.23, 0.02])
      add('chest', 'boxSharp', ac, [0.02, 0.36, 0.03], [-0.2 * b, 0.02, 0.02], [0, 0, 0.2])
      break
    case 'scarf':
      add('chest', 'torus', ac, [0.2, 0.2, 0.55], [0, 0.23, 0.005], [Math.PI / 2, 0, 0])
      add('chest', 'boxSharp', ac, [0.06, 0.24, 0.025], [0.045, 0.1, 0.118], [0.05, 0, 0.1])
      break
    case 'lanyard':
      add('chest', 'boxSharp', 0x2f3f66, [0.01, 0.2, 0.008], [0.03, 0.14, 0.118], [0, 0, -0.25])
      add('chest', 'boxSharp', 0x2f3f66, [0.01, 0.2, 0.008], [-0.03, 0.14, 0.118], [0, 0, 0.25])
      add('chest', 'boxSharp', 0xf5f3ee, [0.055, 0.075, 0.008], [0, 0.02, 0.12], undefined, 0)
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
  const hi = shade(h, 14)
  const capScale: V3 = s === 'buzz' ? [0.178, 0.232, 0.21] : s === 'curly' ? [0.2, 0.262, 0.228] : [0.186, 0.246, 0.218]
  add('head', 'hairCap', h, capScale, [0, 0.108, -0.006], [-0.22, 0, 0], 0.02)
  if (s === 'buzz') return
  // back of the head, tapered to the nape
  add('head', 'ellipsoid', h, [0.158, 0.14, 0.12], [0, 0.092, -0.074], undefined, 0.02)
  add('head', 'ellipsoid', h, [0.12, 0.07, 0.07], [0, 0.034, -0.08], undefined, 0.02)
  switch (s) {
    case 'side':
      // neat side part: volume swept from the part line across the top, short sides
      add('head', 'ellipsoid', h, [0.15, 0.042, 0.125], [-0.008, 0.2, 0.026], [0.14, 0, 0.12], 0.01)
      add('head', 'ellipsoid', hi, [0.1, 0.034, 0.066], [-0.022, 0.2, 0.072], [0.36, 0, 0.18], 0.01)
      break
    case 'short':
      add('head', 'ellipsoid', h, [0.155, 0.05, 0.1], [0, 0.208, 0.05], [0.3, 0, 0], 0.02)
      break
    case 'long':
      add('head', 'ellipsoid', h, [0.19, 0.34, 0.1], [0, -0.02, -0.075], undefined, 0.02)
      for (const sx of [-1, 1]) add('head', 'ellipsoid', h, [0.05, 0.24, 0.1], [sx * 0.082, 0.03, -0.01], undefined, 0.02)
      add('head', 'ellipsoid', hi, [0.15, 0.05, 0.09], [0.02, 0.205, 0.055], [0.3, 0, -0.2], 0.02)
      break
    case 'bun':
      add('head', 'ellipsoid', h, [0.09, 0.085, 0.09], [0, 0.212, -0.085], undefined, 0.02)
      add('head', 'ellipsoid', hi, [0.15, 0.045, 0.09], [0, 0.205, 0.05], [0.3, 0, 0], 0.02)
      break
    case 'ponytail':
      add('head', 'capsule', h, cap(0.065, 0.26), [0, 0.02, -0.13], [0.35, 0, 0], 0.02)
      add('head', 'ellipsoid', hi, [0.15, 0.045, 0.09], [0, 0.205, 0.05], [0.3, 0, 0], 0.02)
      break
    case 'curly':
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2
        add('head', 'ellipsoidLo', h, [0.076, 0.07, 0.076], [Math.cos(a) * 0.08, 0.18 + Math.sin(a * 3) * 0.015, Math.sin(a) * 0.075 - 0.02], undefined, 0.03)
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
  // continuous, smoothly skinned body surfaces (torso, legs, arms, neck)
  pieces.push(...buildLofts(look, bones, index, detail))
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
