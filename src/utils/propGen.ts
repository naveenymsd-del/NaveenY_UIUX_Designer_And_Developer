import { PALETTE } from '@/data/palette'
import type { PartBuilder } from './partBuilder'
import type { Rng } from './rng'
import { addSign, lightPoolAt, type GenContext } from './buildingGen'

/**
 * Street furniture library. Every prop is authored at the origin of the
 * current frame (use b.push(x, y, z, yaw) first) and registers simple colliders.
 */

export type TreeKind = 'round' | 'tall' | 'blossom' | 'gold' | 'cypress' | 'bushy'

// ── GLB replacement registry ────────────────────────────────────────────────
// When /models/tree.glb (etc.) exists, props of that kind emit only their
// collider plus a placement record; PropModels renders the GLB at each record.
export type PropKind = 'tree' | 'bench' | 'lamp'
export interface PropPlacement {
  kind: PropKind
  position: [number, number, number]
  yaw: number
  scale: number
}
export const propRegistry = {
  replaced: new Set<PropKind>(),
  placements: [] as PropPlacement[],
}

function replacedPlacement(b: PartBuilder, kind: PropKind, scale = 1) {
  if (!propRegistry.replaced.has(kind)) return false
  propRegistry.placements.push({ kind, position: b.toWorld(0, 0, 0), yaw: b.yaw, scale })
  return true
}

export function tree(ctx: GenContext, rng: Rng, kind: TreeKind, scale = 1, grate = true) {
  const b = ctx.b
  const s = scale * rng.range(0.9, 1.12)
  if (replacedPlacement(b, 'tree', s)) {
    b.cylCollider([0, 0, 0], 0.32 * s, 3)
    return
  }
  const trunkH = (kind === 'tall' ? 2.6 : kind === 'cypress' ? 1.0 : 1.9) * s
  const trunkColor = rng.chance(0.5) ? PALETTE.trunk : PALETTE.walnut
  if (grate) {
    b.box(0x8a8781, [0, 0.01, 0], [1.3, 0.03, 1.3], { cast: false }) // granite kerb
    b.box(PALETTE.soil, [0, 0.02, 0], [1.05, 0.03, 1.05], { cast: false })
  }
  b.add('cyl8', trunkColor, [0, trunkH / 2, 0], [0.26 * s, trunkH, 0.26 * s])
  // a couple of branches
  b.add('cyl8', trunkColor, [0.22 * s, trunkH * 0.8, 0], [0.1 * s, 0.9 * s, 0.1 * s], { rot: [0, 0, -0.7] })
  const leafSets: Record<TreeKind, number[]> = {
    round: [PALETTE.leafA, PALETTE.leafB, PALETTE.leafC],
    tall: [PALETTE.leafB, PALETTE.leafA],
    bushy: [PALETTE.leafC, PALETTE.leafA],
    blossom: [PALETTE.leafD, 0xdcbcbc, 0xc9a2a4], // muted cherry, not candy pink
    gold: [PALETTE.leafE, 0xc4a05a, 0xb89247],
    cypress: [0x4f9a5c, PALETTE.leafB],
  }
  const leaves = leafSets[kind]
  if (kind === 'cypress') {
    for (let i = 0; i < 3; i++) {
      b.add('cone6', leaves[i % leaves.length], [0, trunkH + 0.9 * s + i * 1.05 * s, 0], [1.5 * s * (1 - i * 0.22), 2.0 * s, 1.5 * s * (1 - i * 0.22)], { mat: 'foliage', rot: [0, i * 0.5, 0] })
    }
  } else {
    const blobs = kind === 'tall' ? 4 : 3
    const base = kind === 'bushy' ? 2.8 : 2.3
    for (let i = 0; i < blobs; i++) {
      const a = rng.range(0, Math.PI * 2)
      const r = i === 0 ? 0 : rng.range(0.45, 0.8) * s
      const sz = (i === 0 ? base : rng.range(1.4, 1.9)) * s
      const y = trunkH + (i === 0 ? 0.9 : rng.range(0.3, 1.5)) * s + (kind === 'tall' ? i * 0.5 * s : 0)
      b.add('ico', leaves[i % leaves.length], [Math.cos(a) * r, y, Math.sin(a) * r], [sz, sz * rng.range(0.82, 1.0), sz], { mat: 'foliage', rot: [rng.range(0, 1), rng.range(0, 3), 0] })
    }
  }
  b.cylCollider([0, 0, 0], 0.32 * s, 3)
}

export function streetLamp(ctx: GenContext, rng: Rng, style: 'classic' | 'modern' = 'classic') {
  const b = ctx.b
  const pole = PALETTE.charcoal
  if (replacedPlacement(b, 'lamp')) {
    const [wx, , wz] = b.toWorld(0.9, 0, 0)
    ctx.lamps.push([wx, 4.1, wz])
    lightPoolAt(ctx, wx, wz, 2.6)
    b.cylCollider([0, 0, 0], 0.2, 4)
    return
  }
  b.add('cyl8', pole, [0, 0.25, 0], [0.36, 0.5, 0.36])
  if (style === 'classic') {
    b.add('cyl8', pole, [0, 2.3, 0], [0.13, 4.2, 0.13])
    b.box(pole, [0.45, 4.35, 0], [0.95, 0.07, 0.07], { cast: false })
    b.add('cyl8', pole, [0.9, 4.3, 0], [0.34, 0.14, 0.34])
    b.add('sphere', 0xffcf8a, [0.9, 4.12, 0], [0.26, 0.22, 0.26], { mat: 'emissive', cast: false })
    b.add('cone', pole, [0.9, 4.45, 0], [0.5, 0.26, 0.5])
    if (rng.chance(0.5)) {
      // hanging flower basket / banner
      b.box(rng.pick([PALETTE.coral, PALETTE.teal, PALETTE.lilac, PALETTE.mustard]), [-0.22, 3.1, 0], [0.04, 1.0, 0.5], { mat: 'fabric', cast: false })
    }
    const [wx, , wz] = b.toWorld(0.9, 0, 0)
    ctx.lamps.push([wx, 4.1, wz])
    lightPoolAt(ctx, wx, wz, 2.6)
  } else {
    b.box(pole, [0, 2.4, 0], [0.12, 4.6, 0.12])
    b.box(pole, [0.6, 4.62, 0], [1.3, 0.12, 0.28])
    b.box(0xffd9a0, [0.75, 4.54, 0], [0.9, 0.04, 0.18], { mat: 'emissive', cast: false })
    const [wx, , wz] = b.toWorld(0.75, 0, 0)
    ctx.lamps.push([wx, 4.5, wz])
    lightPoolAt(ctx, wx, wz, 2.4)
  }
  b.cylCollider([0, 0, 0], 0.2, 4)
}

export function bench(b: PartBuilder, color: number = PALETTE.walnut) {
  const metal = PALETTE.charcoal
  if (replacedPlacement(b, 'bench')) {
    b.collider([0, 0.45, -0.05], [1.9, 0.9, 0.62])
    return
  }
  for (let i = 0; i < 3; i++) b.box(color, [0, 0.48, -0.18 + i * 0.17], [1.8, 0.06, 0.14])
  for (let i = 0; i < 2; i++) b.box(color, [0, 0.72 + i * 0.2, -0.3], [1.8, 0.13, 0.05], { rot: [-0.18, 0, 0] })
  for (const sx of [-0.78, 0.78]) {
    b.box(metal, [sx, 0.24, 0], [0.07, 0.48, 0.5], { cast: false })
    b.box(metal, [sx, 0.62, 0.02], [0.07, 0.06, 0.5], { cast: false })
    b.box(metal, [sx, 0.75, -0.3], [0.07, 0.55, 0.06], { rot: [-0.18, 0, 0], cast: false })
  }
  b.collider([0, 0.45, -0.05], [1.9, 0.9, 0.62])
}

export function bin(b: PartBuilder, color: number = PALETTE.teal) {
  b.add('cyl', color, [0, 0.45, 0], [0.55, 0.9, 0.55])
  b.add('cyl', PALETTE.charcoal, [0, 0.93, 0], [0.6, 0.08, 0.6], { cast: false })
  b.box(PALETTE.ivory, [0, 0.55, 0.28], [0.22, 0.22, 0.01], { mat: 'glow', cast: false })
  b.cylCollider([0, 0, 0], 0.3, 1)
}

export function planter(b: PartBuilder, rng: Rng, w = 1.4, d = 0.8) {
  b.add('rbox', rng.pick([0xe8e0ee, 0xf6ecdc, PALETTE.terracotta, 0xcfc6db]), [0, 0.3, 0], [w, 0.6, d])
  b.box(PALETTE.soil, [0, 0.58, 0], [w - 0.15, 0.04, d - 0.15], { cast: false })
  const n = Math.max(2, Math.round(w / 0.5))
  for (let i = 0; i < n; i++) {
    const x = -w / 2 + (w / n) * (i + 0.5)
    b.add('ico', rng.pick([PALETTE.leafA, PALETTE.leafB, PALETTE.leafC]), [x, 0.85, rng.range(-0.1, 0.1)], [0.55, 0.5, 0.55], { mat: 'foliage', cast: false })
    if (rng.chance(0.6)) b.add('sphere', rng.pick([0xff8fb1, 0xfff1a8, 0xffffff, 0xef8a78, 0xbfaee0]), [x + 0.12, 1.02, 0.12], [0.16, 0.16, 0.16], { cast: false })
  }
  b.collider([0, 0.35, 0], [w, 0.7, d])
}

export function hydrant(b: PartBuilder) {
  b.add('cyl8', PALETTE.cherry, [0, 0.35, 0], [0.28, 0.7, 0.28])
  b.add('sphere', PALETTE.cherry, [0, 0.72, 0], [0.3, 0.26, 0.3])
  b.add('cyl8', PALETTE.ivory, [0, 0.5, 0], [0.5, 0.1, 0.12], { rot: [0, 0, Math.PI / 2], cast: false })
  b.cylCollider([0, 0, 0], 0.2, 0.9)
}

export function bollard(b: PartBuilder) {
  b.add('cyl8', PALETTE.charcoal, [0, 0.4, 0], [0.22, 0.8, 0.22])
  b.add('cyl8', PALETTE.butter, [0, 0.72, 0], [0.24, 0.08, 0.24], { mat: 'emissive', cast: false })
  b.cylCollider([0, 0, 0], 0.14, 0.9)
}

export function bikeRack(b: PartBuilder, rng: Rng) {
  for (let i = 0; i < 3; i++) {
    b.add('torus', PALETTE.slate, [i * 0.7 - 0.7, 0.45, 0], [0.8, 0.9, 1.2], { rot: [0, Math.PI / 2, 0], cast: false })
  }
  if (rng.chance(0.7)) bicycle(b, rng, -0.35, 0.0)
  b.collider([0, 0.4, 0], [2.0, 0.8, 0.6])
}

export function bicycle(b: PartBuilder, rng: Rng, x = 0, z = 0) {
  const c = rng.pick([PALETTE.coral, PALETTE.teal, PALETTE.mustard, PALETTE.cobalt])
  for (const dz of [-0.5, 0.5]) b.add('torus', PALETTE.charcoal, [x, 0.36, z + dz], [0.72, 0.72, 0.5], { rot: [0, Math.PI / 2, 0], cast: false })
  b.box(c, [x, 0.55, z], [0.05, 0.05, 0.9], { rot: [0.3, 0, 0], cast: false })
  b.box(c, [x, 0.72, z - 0.1], [0.05, 0.45, 0.05], { cast: false })
  b.box(PALETTE.charcoal, [x, 0.95, z - 0.15], [0.12, 0.05, 0.25], { cast: false })
  b.box(PALETTE.charcoal, [x, 0.9, z + 0.45], [0.5, 0.04, 0.04], { cast: false })
}

export function busStop(ctx: GenContext, name: string) {
  const b = ctx.b
  const frame = PALETTE.charcoal
  b.box(frame, [-1.8, 1.25, -0.5], [0.1, 2.5, 0.1])
  b.box(frame, [1.8, 1.25, -0.5], [0.1, 2.5, 0.1])
  b.box(frame, [-1.8, 1.25, 0.5], [0.1, 2.5, 0.1])
  b.box(frame, [1.8, 1.25, 0.5], [0.1, 2.5, 0.1])
  b.box(PALETTE.periwinkle, [0, 2.55, 0], [3.9, 0.12, 1.4])
  b.box(0xb8d4ef, [0, 1.35, -0.5], [3.6, 2.0, 0.04], { mat: 'glass', cast: false })
  b.box(PALETTE.walnut, [0, 0.5, -0.25], [3.0, 0.08, 0.4])
  // ad panel
  b.box(PALETTE.ivory, [1.85, 1.3, 0], [0.12, 1.8, 0.95], { mat: 'glow', cast: false })
  b.box(PALETTE.coral, [1.92, 1.3, 0], [0.02, 1.4, 0.7], { mat: 'glow', cast: false })
  addSign(ctx, name, { bg: '#2f3fb8', fg: '#ffffff', shape: 'pill', icon: 'star' }, [0, 2.8, 0.2], 2.4, 0.42, PALETTE.charcoal)
  b.add('cyl8', frame, [-2.4, 1.4, 0.4], [0.08, 2.8, 0.08])
  b.box(PALETTE.cobalt, [-2.4, 2.6, 0.4], [0.6, 0.6, 0.05])
  b.collider([0, 1.25, -0.5], [3.8, 2.5, 0.25])
  b.collider([0, 0.3, -0.25], [3.0, 0.6, 0.4])
}

export function trafficLight(ctx: GenContext, t = 0) {
  const b = ctx.b
  b.add('cyl8', PALETTE.charcoal, [0, 1.8, 0], [0.16, 3.6, 0.16])
  b.box(PALETTE.charcoal, [0, 3.6, 0], [0.45, 1.15, 0.35])
  b.box(PALETTE.charcoal, [0, 3.6, 0.2], [0.55, 1.25, 0.05], { cast: false })
  const on = t % 3
  const cols = [0xff5d6c, 0xffc857, 0x6be38f]
  for (let i = 0; i < 3; i++) {
    b.add('cyl', cols[i], [0, 3.95 - i * 0.35, 0.2], [0.24, 0.05, 0.24], { rot: [Math.PI / 2, 0, 0], mat: i === on ? 'emissive' : 'matte', cast: false })
  }
  b.cylCollider([0, 0, 0], 0.15, 3.6)
}

export function signPost(ctx: GenContext, color: number) {
  const b = ctx.b
  b.add('cyl8', PALETTE.slate, [0, 1.3, 0], [0.08, 2.6, 0.08])
  b.box(color, [0, 2.5, 0], [0.6, 0.6, 0.04])
  b.box(PALETTE.ivory, [0, 2.5, 0.025], [0.4, 0.4, 0.01], { mat: 'glow', cast: false })
  b.cylCollider([0, 0, 0], 0.1, 2.6)
}

export function vendingMachine(b: PartBuilder, color: number) {
  b.box(color, [0, 0.95, 0], [1.0, 1.9, 0.8])
  b.box(0xfff6e0, [-0.1, 1.15, 0.41], [0.65, 1.1, 0.02], { mat: 'glow', cast: false })
  for (let r = 0; r < 3; r++)
    for (let c = 0; c < 4; c++) b.box([0xef8a78, 0x4fb3a9, 0xf5dd92, 0x9fb2e6][(r + c) % 4], [-0.35 + c * 0.16, 0.8 + r * 0.33, 0.43], [0.1, 0.18, 0.02], { mat: 'glow', cast: false })
  b.box(PALETTE.charcoal, [0.35, 0.95, 0.41], [0.16, 0.4, 0.02], { cast: false })
  b.box(PALETTE.charcoal, [0, 0.25, 0.41], [0.7, 0.18, 0.02], { cast: false })
  b.collider([0, 0.95, 0], [1.0, 1.9, 0.8])
}

export function crateStack(b: PartBuilder, rng: Rng) {
  const n = rng.int(2, 4)
  for (let i = 0; i < n; i++) {
    const c = rng.pick([PALETTE.walnut, PALETTE.cocoa, 0xc49a6c])
    b.add('box', c, [(i % 2) * 0.62 - 0.3, 0.28 + Math.floor(i / 2) * 0.56, 0], [0.58, 0.54, 0.58], { rot: [0, rng.range(-0.2, 0.2), 0] })
  }
  b.collider([0, 0.5, 0], [1.25, 1.0, 0.65])
}

export function mailbox(b: PartBuilder) {
  b.box(PALETTE.cobalt, [0, 0.75, 0], [0.55, 0.9, 0.5])
  b.add('hcyl', PALETTE.cobalt, [0, 1.2, 0], [0.55, 0.5, 0.55], { rot: [0, 0, Math.PI / 2] })
  b.box(PALETTE.charcoal, [0, 0.95, 0.26], [0.35, 0.06, 0.02], { cast: false })
  b.box(PALETTE.charcoal, [0, 0.15, 0], [0.4, 0.3, 0.35])
  b.collider([0, 0.7, 0], [0.55, 1.4, 0.5])
}

export function parkedCar(ctx: GenContext, rng: Rng) {
  const b = ctx.b
  const body = rng.pick([0xef8a78, 0x9fb2e6, 0xf5dd92, 0xbfe3cf, 0xf6ecdc, 0x4fb3a9, 0xa996d4, 0x5d7fb3])
  const kind = rng.next()
  if (kind < 0.18) {
    // small van
    b.add('rbox', body, [0, 1.15, 0], [1.9, 1.7, 4.4], { mat: 'gloss' })
    b.add('rbox', 0x4a5a8a, [0, 1.5, 1.55], [1.78, 0.75, 1.1], { mat: 'glass', cast: false })
    b.box(0x4a5a8a, [0.96, 1.5, -0.3], [0.02, 0.6, 2.2], { mat: 'glass', cast: false })
    b.box(0x4a5a8a, [-0.96, 1.5, -0.3], [0.02, 0.6, 2.2], { mat: 'glass', cast: false })
  } else {
    b.add('rbox', body, [0, 0.72, 0], [1.8, 0.75, 4.0], { mat: 'gloss' })
    b.add('rbox', body, [0, 1.25, -0.2], [1.62, 0.7, 2.2], { mat: 'gloss' })
    b.add('rbox', 0x4a5a8a, [0, 1.27, -0.2], [1.66, 0.52, 2.0], { mat: 'glass', cast: false })
    b.box(0x4a5a8a, [0, 1.27, 0.92], [1.45, 0.48, 0.05], { mat: 'glass', cast: false, rot: [-0.5, 0, 0] })
  }
  for (const [x, z] of [[-0.85, 1.3], [0.85, 1.3], [-0.85, -1.3], [0.85, -1.3]]) {
    b.add('cyl', 0x2b2350, [x, 0.36, z], [0.72, 0.28, 0.72], { rot: [0, 0, Math.PI / 2] })
    b.add('cyl', 0xd6cfd9, [x * 1.02, 0.36, z], [0.36, 0.3, 0.36], { rot: [0, 0, Math.PI / 2], mat: 'metal', cast: false })
  }
  b.box(0xfff4d6, [-0.6, 0.75, 2.0], [0.34, 0.16, 0.05], { mat: 'glow', cast: false })
  b.box(0xfff4d6, [0.6, 0.75, 2.0], [0.34, 0.16, 0.05], { mat: 'glow', cast: false })
  b.box(0xe0506a, [-0.65, 0.78, -2.0], [0.3, 0.12, 0.05], { mat: 'glow', cast: false })
  b.box(0xe0506a, [0.65, 0.78, -2.0], [0.3, 0.12, 0.05], { mat: 'glow', cast: false })
  b.box(PALETTE.charcoal, [0, 0.45, 2.02], [1.7, 0.2, 0.1], { cast: false })
  b.box(PALETTE.charcoal, [0, 0.45, -2.02], [1.7, 0.2, 0.1], { cast: false })
  b.box(0xffffff, [0, 0.45, 2.08], [0.5, 0.14, 0.02], { cast: false })
  b.collider([0, 0.9, 0], [1.9, 1.8, 4.3])
}

export function flowerBed(b: PartBuilder, rng: Rng, w: number, d: number) {
  b.add('rbox', 0xcfc6db, [0, 0.12, 0], [w + 0.2, 0.24, d + 0.2])
  b.box(PALETTE.soil, [0, 0.2, 0], [w, 0.1, d], { cast: false })
  const n = Math.round(w * d * 3)
  for (let i = 0; i < n; i++) {
    const x = rng.range(-w / 2 + 0.15, w / 2 - 0.15)
    const z = rng.range(-d / 2 + 0.15, d / 2 - 0.15)
    if (rng.chance(0.55)) b.add('sphere', rng.pick([0xff8fb1, 0xfff1a8, 0xffffff, 0xef8a78, 0xbfaee0, 0xf39a4a]), [x, 0.36, z], [0.2, 0.18, 0.2], { cast: false })
    else b.add('ico', rng.pick([PALETTE.leafA, PALETTE.leafC]), [x, 0.33, z], [0.3, 0.26, 0.3], { mat: 'foliage', cast: false })
  }
  b.collider([0, 0.2, 0], [w + 0.2, 0.4, d + 0.2])
}

export function hedge(b: PartBuilder, rng: Rng, length: number) {
  const n = Math.max(1, Math.round(length / 1.1))
  for (let i = 0; i < n; i++) {
    const x = -length / 2 + (length / n) * (i + 0.5)
    b.add('rbox', rng.pick([PALETTE.leafB, 0x6aa862, 0x72b067]), [x, 0.5, 0], [length / n + 0.12, 1.0 + rng.range(-0.08, 0.08), 0.9], { mat: 'foliage' })
  }
  b.collider([0, 0.5, 0], [length, 1.0, 0.9])
}

export function cafeTable(b: PartBuilder, rng: Rng, umbrella: boolean, umbrellaColor: number) {
  b.add('cyl', PALETTE.ivory, [0, 0.74, 0], [0.9, 0.05, 0.9])
  b.add('cyl8', PALETTE.charcoal, [0, 0.37, 0], [0.07, 0.74, 0.07], { cast: false })
  b.add('cyl8', PALETTE.charcoal, [0, 0.02, 0], [0.5, 0.04, 0.5], { cast: false })
  // cups & plates
  for (let i = 0; i < rng.int(1, 3); i++) {
    const a = rng.range(0, Math.PI * 2)
    b.add('cyl', PALETTE.ivory, [Math.cos(a) * 0.22, 0.8, Math.sin(a) * 0.22], [0.1, 0.1, 0.1], { cast: false })
    b.add('cyl', 0xe9e2f0, [Math.cos(a) * 0.22, 0.765, Math.sin(a) * 0.22], [0.2, 0.01, 0.2], { cast: false })
  }
  // chairs
  for (const a of [0, Math.PI]) {
    const cx = Math.sin(a) * 0.75
    const cz = Math.cos(a) * 0.75
    b.push(cx, 0, cz, a + Math.PI)
    const cc = rng.pick([PALETTE.coral, PALETTE.teal, PALETTE.mustard, PALETTE.ivory])
    b.box(cc, [0, 0.46, 0], [0.46, 0.05, 0.44])
    b.box(cc, [0, 0.75, -0.21], [0.46, 0.5, 0.05])
    for (const [lx, lz] of [[-0.2, -0.19], [0.2, -0.19], [-0.2, 0.19], [0.2, 0.19]]) b.box(PALETTE.charcoal, [lx, 0.23, lz], [0.04, 0.46, 0.04], { cast: false })
    b.pop()
  }
  if (umbrella) {
    b.add('cyl8', PALETTE.ivory, [0, 1.3, 0], [0.06, 2.0, 0.06], { cast: false })
    b.add('cone', umbrellaColor, [0, 2.35, 0], [2.6, 0.55, 2.6], { mat: 'fabric' })
    b.add('cone', PALETTE.ivory, [0, 2.38, 0], [2.64, 0.5, 2.64], { mat: 'fabric', rot: [0, Math.PI / 16, 0], cast: false })
    b.add('sphere', PALETTE.ivory, [0, 2.66, 0], [0.12, 0.12, 0.12], { cast: false })
  }
  b.cylCollider([0, 0, 0], 0.5, 1.0)
}

/** String of small glowing bulbs between two points (local frame), sagging in the middle. */
export function stringLights(b: PartBuilder, a: [number, number, number], c: [number, number, number], n = 12, sag = 0.5) {
  for (let i = 0; i <= n; i++) {
    const t = i / n
    const x = a[0] + (c[0] - a[0]) * t
    const z = a[2] + (c[2] - a[2]) * t
    const y = a[1] + (c[1] - a[1]) * t - Math.sin(t * Math.PI) * sag
    b.add('sphere', i % 3 === 0 ? 0xffc2d0 : 0xfff0c0, [x, y, z], [0.12, 0.14, 0.12], { mat: 'emissive', cast: false })
  }
}

export function manhole(b: PartBuilder) {
  b.add('cyl', 0x4a4462, [0, 0.008, 0], [0.9, 0.016, 0.9], { mat: 'metal', cast: false })
  b.add('torus', 0x3b3650, [0, 0.016, 0], [0.8, 0.8, 0.25], { rot: [Math.PI / 2, 0, 0], cast: false })
}
