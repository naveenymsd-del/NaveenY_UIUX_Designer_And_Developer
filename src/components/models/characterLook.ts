import { CapsuleGeometry, ConeGeometry, CylinderGeometry, MeshStandardMaterial, SphereGeometry, TorusGeometry } from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import { createRng } from '@/utils/rng'

/**
 * Appearance of a stylised-realistic human (≈7.3 heads tall). Every
 * character — player and NPCs — is described by one of these; the rig
 * builder turns it into a single skinned mesh.
 */
export type HairStyle = 'short' | 'side' | 'long' | 'bun' | 'curly' | 'buzz' | 'ponytail'
export type TopStyle = 'tee' | 'shirt' | 'jacket' | 'hoodie' | 'blouse' | 'sweater'
export type BottomStyle = 'trousers' | 'jeans' | 'skirt' | 'shorts'
export type Accessory = 'none' | 'backpack' | 'totebag' | 'glasses' | 'scarf' | 'crossbody' | 'lanyard'
export type HandProp = 'none' | 'cup' | 'phone' | 'book' | 'tablet'

export interface CharacterLook {
  skin: number
  hair: number
  top: number
  topAccent: number
  topStyle: TopStyle
  longSleeves: boolean
  bottom: number
  bottomStyle: BottomStyle
  shoes: number
  sole: number
  hairStyle: HairStyle
  accessory: Accessory
  accessoryColor: number
  prop: HandProp
  /** overall height multiplier around 1.74 m */
  height: number
  /** shoulder / hip width multiplier */
  build: number
  headScale: number
  seed: number
}

/** The player: navy overshirt over a white tee, dark jeans, white sneakers, crossbody bag. */
export const PLAYER_LOOK: CharacterLook = {
  skin: 0xc68d68,
  hair: 0x1f1a1c,
  top: 0x2f3f66,
  topAccent: 0xf3f0ea,
  topStyle: 'jacket',
  longSleeves: true,
  bottom: 0x2e3445,
  bottomStyle: 'jeans',
  shoes: 0xf3f1ec,
  sole: 0xd9d4cc,
  hairStyle: 'side',
  accessory: 'crossbody',
  accessoryColor: 0x5a4636,
  prop: 'none',
  height: 1.0,
  build: 1.0,
  headScale: 1,
  seed: 1,
}

// Muted, believable clothing & skin palettes (no neon)
export const SKIN_TONES = [0xf1d0b5, 0xe6b894, 0xd29e78, 0xc08a64, 0xa06e4c, 0x7d5238, 0x5f3e2c, 0xf6dcc8]
export const HAIR_COLORS = [0x1f1a1c, 0x2e2320, 0x4a3326, 0x6b4a33, 0x8c6a48, 0xb89468, 0x9a9590, 0x3a2a24]
const TOPS = [0xf3f0ea, 0x2f3f66, 0x6f7f68, 0xb8664e, 0xd9c7a6, 0x4f5d73, 0x8c3f45, 0xe8e2d6, 0x3c3c40, 0x7d8fa6, 0xc9a45c, 0x5e6b52, 0xa8b7c8]
const BOTTOMS = [0x2e3445, 0x3b3a3c, 0x5d5b55, 0x8a7a64, 0x2f4358, 0xcfc4b0, 0x4b4038, 0x1f2126]
const SHOES = [0xf3f1ec, 0x2a2626, 0x6b4a33, 0x8c8a86, 0xd8cdb8, 0x3d3530]

export function randomLook(seed: number, overrides: Partial<CharacterLook> = {}): CharacterLook {
  const rng = createRng(seed * 7919 + 13)
  const feminine = rng.chance(0.5)
  const hair: HairStyle = feminine
    ? rng.pick(['long', 'bun', 'ponytail', 'curly', 'side'] as const)
    : rng.pick(['short', 'side', 'buzz', 'curly', 'short'] as const)
  const topStyle: TopStyle = rng.pick(feminine ? ['blouse', 'tee', 'sweater', 'jacket', 'shirt'] as const : ['tee', 'shirt', 'jacket', 'hoodie', 'sweater'] as const)
  const bottomStyle: BottomStyle = feminine && rng.chance(0.3) ? 'skirt' : rng.chance(0.12) ? 'shorts' : rng.chance(0.5) ? 'jeans' : 'trousers'
  return {
    skin: rng.pick(SKIN_TONES),
    hair: rng.pick(HAIR_COLORS),
    top: rng.pick(TOPS),
    topAccent: rng.pick([0xf3f0ea, 0xe8e2d6, 0x3c3c40, 0xd9c7a6]),
    topStyle,
    longSleeves: topStyle === 'tee' || topStyle === 'blouse' ? rng.chance(0.25) : true,
    bottom: rng.pick(BOTTOMS),
    bottomStyle,
    shoes: rng.pick(SHOES),
    sole: rng.pick([0xf3f1ec, 0xd9d4cc, 0x3d3530]),
    hairStyle: hair,
    accessory: rng.pick(['none', 'none', 'backpack', 'totebag', 'glasses', 'crossbody', 'scarf'] as const),
    accessoryColor: rng.pick([0x5a4636, 0x3c3c40, 0x6f7f68, 0xb8664e, 0x2f3f66, 0xd9c7a6]),
    prop: 'none',
    height: feminine ? rng.range(0.92, 1.0) : rng.range(0.97, 1.07),
    build: feminine ? rng.range(0.88, 1.0) : rng.range(0.96, 1.14),
    headScale: rng.range(0.97, 1.03),
    seed,
    ...overrides,
  }
}

// ── shared template geometry (unit-ish sizes, scaled per part) ──────────────
export type CharacterDetail = 'high' | 'low'
const geoCache: Partial<Record<CharacterDetail, ReturnType<typeof makeGeometries>>> = {}
/** 'low' roughly halves the triangle count — used for street pedestrians seen from a distance. */
export function charGeometries(detail: CharacterDetail = 'high') {
  return (geoCache[detail] ??= makeGeometries(detail === 'low' ? 0.62 : 1))
}

function makeGeometries(k: number) {
  const n = (v: number, min: number) => Math.max(min, Math.round(v * k))
  return {
    capsule: new CapsuleGeometry(0.5, 0.6, n(4, 2), n(12, 8)), // height 1.6, diameter 1
    ellipsoid: new SphereGeometry(0.5, n(14, 8), n(10, 6)),
    ellipsoidLo: new SphereGeometry(0.5, n(8, 6), n(6, 4)),
    head: new SphereGeometry(0.5, n(18, 12), n(14, 9)),
    hairCap: new SphereGeometry(0.5, n(16, 10), n(10, 6), 0, Math.PI * 2, 0, Math.PI * 0.58),
    box: new RoundedBoxGeometry(1, 1, 1, n(2, 1), 0.18),
    boxSharp: new RoundedBoxGeometry(1, 1, 1, 1, 0.06),
    cone: new ConeGeometry(0.5, 1, n(14, 8), 1, true),
    cyl: new CylinderGeometry(0.5, 0.5, 1, n(12, 8)),
    torus: new TorusGeometry(0.5, 0.1, n(6, 4), n(16, 10)),
  }
}

const matCache = new Map<string, MeshStandardMaterial>()
export function charMaterial(color: number, roughness = 0.72) {
  const key = `${color}-${roughness}`
  let m = matCache.get(key)
  if (!m) {
    m = new MeshStandardMaterial({ color, roughness, metalness: 0 })
    matCache.set(key, m)
  }
  return m
}
