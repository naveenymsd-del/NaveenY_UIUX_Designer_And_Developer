import {
  Bone, BufferAttribute, type BufferGeometry, Euler, Float32BufferAttribute, Matrix4, MeshStandardMaterial, Quaternion,
  Skeleton, SkinnedMesh, Sphere, Vector3, Color,
} from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { charGeometries, type CharacterLook } from './characterLook'

/**
 * Builds a character as ONE skinned mesh: every primitive part is merged into
 * a single geometry with vertex colours and rigidly bound to a procedural
 * bone. Each character therefore costs a single draw call, yet the rig still
 * animates limb-by-limb.
 */
export type BoneName =
  | 'root' | 'body' | 'hips' | 'legL' | 'kneeL' | 'footL' | 'legR' | 'kneeR' | 'footR'
  | 'spine' | 'armL' | 'elbowL' | 'armR' | 'elbowR' | 'head' | 'eyeL' | 'eyeR'

export const HIP_Y = 0.59

interface PartSpec {
  bone: BoneName
  geo: keyof ReturnType<typeof charGeometries>
  color: number
  pos?: [number, number, number]
  rot?: [number, number, number]
  scale?: number | [number, number, number]
}

let sharedMaterial: MeshStandardMaterial | null = null
export function characterMaterial() {
  if (!sharedMaterial) sharedMaterial = new MeshStandardMaterial({ vertexColors: true, roughness: 0.68, metalness: 0 })
  return sharedMaterial
}

function darken(c: number, amt: number) {
  const r = Math.max(0, ((c >> 16) & 255) - amt)
  const g = Math.max(0, ((c >> 8) & 255) - amt)
  const b = Math.max(0, (c & 255) - amt)
  return (r << 16) | (g << 8) | b
}

function boneLayout(look: CharacterLook): { name: BoneName; parent: BoneName | null; pos: [number, number, number] }[] {
  const b = look.build
  const hs = look.headScale
  const hc: [number, number, number] = [0, 0.3 * hs, 0.01]
  return [
    { name: 'root', parent: null, pos: [0, 0, 0] },
    { name: 'body', parent: 'root', pos: [0, 0, 0] },
    { name: 'hips', parent: 'body', pos: [0, HIP_Y, 0] },
    { name: 'legL', parent: 'hips', pos: [0.1 * b, -0.02, 0] },
    { name: 'kneeL', parent: 'legL', pos: [0, -0.27, 0] },
    { name: 'footL', parent: 'kneeL', pos: [0, -0.235, 0] },
    { name: 'legR', parent: 'hips', pos: [-0.1 * b, -0.02, 0] },
    { name: 'kneeR', parent: 'legR', pos: [0, -0.27, 0] },
    { name: 'footR', parent: 'kneeR', pos: [0, -0.235, 0] },
    { name: 'spine', parent: 'hips', pos: [0, 0.06, 0] },
    { name: 'armL', parent: 'spine', pos: [0.27 * b, 0.36, 0] },
    { name: 'elbowL', parent: 'armL', pos: [0, -0.2, 0] },
    { name: 'armR', parent: 'spine', pos: [-0.27 * b, 0.36, 0] },
    { name: 'elbowR', parent: 'armR', pos: [0, -0.2, 0] },
    { name: 'head', parent: 'spine', pos: [0, 0.44, 0] },
    { name: 'eyeL', parent: 'head', pos: [hc[0] + 0.105 * hs, hc[1] - 0.01 * hs, hc[2] + 0.27 * hs] },
    { name: 'eyeR', parent: 'head', pos: [hc[0] - 0.105 * hs, hc[1] - 0.01 * hs, hc[2] + 0.27 * hs] },
  ]
}

function partList(look: CharacterLook): PartSpec[] {
  const b = look.build
  const hs = look.headScale
  const P: PartSpec[] = []
  const skinShade = darken(look.skin, 18)
  // head-relative helper: positions around the head centre, scaled by headScale
  const H = (geo: PartSpec['geo'], color: number, pos: [number, number, number], scale: number | [number, number, number] = 1, rot?: [number, number, number]) => {
    const s: [number, number, number] = typeof scale === 'number' ? [scale * hs, scale * hs, scale * hs] : [scale[0] * hs, scale[1] * hs, scale[2] * hs]
    P.push({ bone: 'head', geo, color, pos: [pos[0] * hs, 0.3 * hs + pos[1] * hs, 0.01 + pos[2] * hs], rot, scale: s })
  }

  P.push({ bone: 'hips', geo: 'pelvis', color: look.bottom, pos: [0, 0.02, 0], scale: [b, 1, 1] })
  for (const [leg, knee, foot] of [['legL', 'kneeL', 'footL'], ['legR', 'kneeR', 'footR']] as const) {
    P.push({ bone: leg, geo: 'limb', color: look.bottom, pos: [0, -0.13, 0] })
    P.push({ bone: knee, geo: 'limb', color: look.bottom, pos: [0, -0.11, 0], scale: [0.92, 0.9, 0.92] })
    P.push({ bone: foot, geo: 'foot', color: look.shoes, pos: [0, -0.02, 0.045] })
    P.push({ bone: foot, geo: 'foot', color: look.sole, pos: [0, -0.065, 0.045], scale: [1.04, 0.3, 1.04] })
  }
  // torso
  P.push({ bone: 'spine', geo: 'torso', color: look.top, pos: [0, 0.2, 0], scale: [b, 1, 1] })
  P.push({ bone: 'spine', geo: 'box', color: look.topAccent, pos: [0, 0.02, 0], scale: [0.47 * b, 0.07, 0.31] })
  P.push({ bone: 'spine', geo: 'box', color: look.topAccent, pos: [0, 0.2, 0.15], scale: [0.035, 0.36, 0.02] })
  P.push({ bone: 'spine', geo: 'sphere', color: look.topAccent, pos: [0, 0.4, 0.02], scale: [0.3 * b, 0.08, 0.24] })
  if (look.accessory === 'backpack') {
    P.push({ bone: 'spine', geo: 'box', color: look.accessoryColor, pos: [0, 0.24, -0.2], scale: [0.34, 0.38, 0.16] })
    P.push({ bone: 'spine', geo: 'box', color: darken(look.accessoryColor, 25), pos: [0, 0.16, -0.285], scale: [0.24, 0.14, 0.05] })
    for (const sx of [-1, 1]) P.push({ bone: 'spine', geo: 'box', color: darken(look.accessoryColor, 30), pos: [sx * 0.13, 0.28, 0.02], scale: [0.05, 0.44, 0.33] })
  } else if (look.accessory === 'totebag') {
    P.push({ bone: 'spine', geo: 'box', color: look.accessoryColor, pos: [-0.27 * b, 0.02, 0.02], rot: [0, 0, 0.08], scale: [0.07, 0.34, 0.3] })
    P.push({ bone: 'spine', geo: 'box', color: look.accessoryColor, pos: [-0.22 * b, 0.3, 0.02], rot: [0, 0, 0.5], scale: [0.03, 0.42, 0.04] })
  } else if (look.accessory === 'scarf') {
    P.push({ bone: 'spine', geo: 'sphere', color: look.accessoryColor, pos: [0, 0.42, 0], scale: [0.38, 0.13, 0.32] })
    P.push({ bone: 'spine', geo: 'box', color: look.accessoryColor, pos: [0.08, 0.26, 0.16], rot: [0.1, 0, 0.1], scale: [0.08, 0.26, 0.03] })
  }
  // arms
  for (const [arm, elbow] of [['armL', 'elbowL'], ['armR', 'elbowR']] as const) {
    P.push({ bone: arm, geo: 'sphere', color: look.top, scale: 0.15 })
    P.push({ bone: arm, geo: 'arm', color: look.top, pos: [0, -0.1, 0] })
    P.push({ bone: elbow, geo: 'arm', color: look.top, pos: [0, -0.08, 0], scale: [0.95, 0.85, 0.95] })
    P.push({ bone: elbow, geo: 'sphere', color: look.topAccent, pos: [0, -0.15, 0], scale: [0.13, 0.05, 0.13] })
    P.push({ bone: elbow, geo: 'sphere', color: look.skin, pos: [0, -0.21, 0.005], scale: 0.105 })
  }
  // neck + head
  P.push({ bone: 'head', geo: 'sphere', color: look.skin, pos: [0, 0.03, 0], scale: [0.12, 0.1, 0.12] })
  H('head', look.skin, [0, 0, 0], [1.04, 0.97, 0.98])
  H('sphere', skinShade, [0.3, -0.02, 0], [0.07, 0.11, 0.08])
  H('sphere', skinShade, [-0.3, -0.02, 0], [0.07, 0.11, 0.08])
  H('sphere', 0xff9fb0, [0.175, -0.085, 0.235], [0.075, 0.038, 0.02])
  H('sphere', 0xff9fb0, [-0.175, -0.085, 0.235], [0.075, 0.038, 0.02])
  H('sphere', 0xa24a5a, [0, -0.115, 0.275], [0.05, 0.018, 0.02])
  H('sphere', skinShade, [0, -0.045, 0.3], [0.04, 0.03, 0.03])
  H('box', look.hair, [0.105, 0.105, 0.265], [0.08, 0.018, 0.02], [0.2, 0, -0.12])
  H('box', look.hair, [-0.105, 0.105, 0.265], [0.08, 0.018, 0.02], [0.2, 0, 0.12])
  // eyes (own bones so they can blink)
  for (const eye of ['eyeL', 'eyeR'] as const) {
    P.push({ bone: eye, geo: 'sphere', color: 0x2b2350, scale: [0.058 * hs, 0.085 * hs, 0.04 * hs] })
    P.push({ bone: eye, geo: 'sphere', color: 0xffffff, pos: [0.013 * hs, 0.022 * hs, 0.02 * hs], scale: 0.02 * hs })
  }
  if (look.accessory === 'glasses') {
    H('torus', 0x2b2350, [0.11, -0.01, 0.285], [0.1, 0.09, 0.05])
    H('torus', 0x2b2350, [-0.11, -0.01, 0.285], [0.1, 0.09, 0.05])
    H('box', 0x2b2350, [0, 0.0, 0.29], [0.07, 0.015, 0.01])
  }
  // hair
  const style = look.hairStyle
  if (style !== 'buzz' || look.hat === 'none') H('hairCap', look.hair, [0, 0, 0], style === 'buzz' ? 0.97 : 1.02, [-0.35, 0, 0])
  if (style !== 'buzz') {
    H('sphere', look.hair, [0.1, 0.17, 0.22], [0.26, 0.14, 0.14], [0.4, 0, -0.3])
    H('sphere', look.hair, [-0.1, 0.18, 0.22], [0.24, 0.13, 0.14], [0.4, 0, 0.35])
    H('sphere', look.hair, [0, -0.02, -0.12], [0.6, 0.5, 0.42])
  }
  if (style === 'bun') H('sphere', look.hair, [0, 0.3, -0.16], 0.22)
  if (style === 'long') H('box', look.hair, [0, -0.2, -0.16], [0.5, 0.42, 0.18])
  if (style === 'curly') {
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2
      H('sphere', look.hair, [Math.cos(a) * 0.24, 0.16 + Math.sin(a * 2) * 0.03, Math.sin(a) * 0.2 - 0.04], 0.2)
    }
  }
  if (look.hat === 'cap') {
    H('hairCap', look.hatColor, [0, 0.02, 0], [1.06, 1.0, 1.06], [-0.2, 0, 0])
    H('box', look.hatColor, [0, 0.11, 0.3], [0.36, 0.035, 0.24], [0.15, 0, 0])
    H('sphere', look.hatColor, [0, 0.33, -0.02], 0.05)
  } else if (look.hat === 'beanie') {
    H('hairCap', look.hatColor, [0, 0.03, 0], [1.08, 1.12, 1.08], [-0.25, 0, 0])
    H('sphere', darken(look.hatColor, 20), [0, 0.12, 0.02], [0.66, 0.14, 0.64], [-0.25, 0, 0])
    H('sphere', look.topAccent, [0, 0.38, -0.08], 0.1)
  } else if (look.hat === 'bucket') {
    H('hairCap', look.hatColor, [0, 0.04, 0], [1.05, 0.95, 1.05])
    H('brim', look.hatColor, [0, 0.07, 0], [0.82, 0.12, 0.82], [Math.PI, 0, 0])
  }
  return P
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

export function buildCharacterRig(look: CharacterLook): CharacterRig {
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

  const templates = charGeometries() as Record<string, BufferGeometry>
  const pieces: BufferGeometry[] = []
  for (const p of partList(look)) {
    const maxScale = typeof p.scale === 'number' ? p.scale : p.scale ? Math.max(...p.scale) : 1
    // tiny features (eyes, blush, cuffs) use a low-poly sphere
    const tpl = p.geo === 'sphere' && maxScale < 0.13 ? templates.sphereLo : templates[p.geo]
    if (!tpl) continue
    // normalise: some templates (RoundedBox) are non-indexed; merge needs a consistent layout
    const g = tpl.index ? tpl.toNonIndexed() : tpl.clone()
    g.deleteAttribute('uv')
    const sc = p.scale === undefined ? [1, 1, 1] : typeof p.scale === 'number' ? [p.scale, p.scale, p.scale] : p.scale
    _e.set(...(p.rot ?? [0, 0, 0]))
    _q.setFromEuler(_e)
    _m.compose(_v.set(...(p.pos ?? [0, 0, 0])), _q, _s.set(sc[0], sc[1], sc[2]))
    g.applyMatrix4(_m.premultiply(bones[p.bone].matrixWorld))
    const n = g.attributes.position.count
    const col = new Float32Array(n * 3)
    _c.setHex(p.color)
    for (let i = 0; i < n; i++) col.set([_c.r, _c.g, _c.b], i * 3)
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
  geometry.boundingSphere = new Sphere(new Vector3(0, 0.8, 0), 1.3)
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
