import { CapsuleGeometry, MeshStandardMaterial, SphereGeometry, TorusGeometry, type BufferGeometry } from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import { CLOTHING, HAIR, PANTS, SKIN } from '@/data/palette'
import { createRng } from '@/utils/rng'

export type HairStyle = 'short' | 'bun' | 'long' | 'curly' | 'buzz'
export type HatStyle = 'none' | 'cap' | 'beanie' | 'bucket'
export type Accessory = 'none' | 'backpack' | 'totebag' | 'glasses' | 'scarf'

export interface CharacterLook {
  skin: number
  hair: number
  top: number
  topAccent: number
  bottom: number
  shoes: number
  sole: number
  hairStyle: HairStyle
  hat: HatStyle
  hatColor: number
  accessory: Accessory
  accessoryColor: number
  /** overall height multiplier */
  height: number
  /** body width multiplier */
  build: number
  headScale: number
  seed: number
}

/** The player's signature look: coral bomber, cream trousers, cap and a teal backpack. */
export const PLAYER_LOOK: CharacterLook = {
  skin: 0xffd9c2,
  hair: 0x2b2350,
  top: 0xef8a78,
  topAccent: 0xfbf5ea,
  bottom: 0xf1e4cf,
  shoes: 0xffffff,
  sole: 0xef8a78,
  hairStyle: 'short',
  hat: 'cap',
  hatColor: 0x2f3fb8,
  accessory: 'backpack',
  accessoryColor: 0x4fb3a9,
  height: 1,
  build: 1,
  headScale: 1,
  seed: 1,
}

export function randomLook(seed: number): CharacterLook {
  const rng = createRng(seed * 7919 + 13)
  const hats: HatStyle[] = ['none', 'none', 'none', 'cap', 'beanie', 'bucket']
  const acc: Accessory[] = ['none', 'none', 'backpack', 'totebag', 'glasses', 'scarf']
  return {
    skin: rng.pick(SKIN),
    hair: rng.pick(HAIR),
    top: rng.pick(CLOTHING),
    topAccent: rng.pick([0xffffff, 0xfbf5ea, 0x3b3650, 0xf5dd92]),
    bottom: rng.pick(PANTS),
    shoes: rng.pick([0xffffff, 0x3b3650, 0xef8a78, 0xf6ecdc, 0x6e4a3b]),
    sole: rng.pick([0xffffff, 0xf6ecdc, 0x3b3650]),
    hairStyle: rng.pick(['short', 'bun', 'long', 'curly', 'buzz'] as const),
    hat: rng.pick(hats),
    hatColor: rng.pick(CLOTHING),
    accessory: rng.pick(acc),
    accessoryColor: rng.pick(CLOTHING),
    height: rng.range(0.9, 1.08),
    build: rng.range(0.9, 1.15),
    headScale: rng.range(0.94, 1.04),
    seed,
  }
}

// ── shared geometry & material caches (all characters reuse them) ───────────
let geoCache: Record<string, BufferGeometry> | null = null
export function charGeometries() {
  if (geoCache) return geoCache
  geoCache = {
    limb: new CapsuleGeometry(0.068, 0.17, 3, 8),
    arm: new CapsuleGeometry(0.058, 0.15, 3, 8),
    torso: new RoundedBoxGeometry(0.46, 0.46, 0.3, 2, 0.11),
    pelvis: new RoundedBoxGeometry(0.4, 0.2, 0.27, 2, 0.08),
    head: new SphereGeometry(0.3, 18, 12),
    hairCap: new SphereGeometry(0.315, 18, 10, 0, Math.PI * 2, 0, Math.PI * 0.55),
    sphere: new SphereGeometry(0.5, 10, 7),
    sphereLo: new SphereGeometry(0.5, 8, 6),
    foot: new RoundedBoxGeometry(0.15, 0.1, 0.26, 1, 0.045),
    box: new RoundedBoxGeometry(1, 1, 1, 1, 0.12),
    brim: new SphereGeometry(0.5, 16, 6, 0, Math.PI * 2, 0, Math.PI * 0.5),
    torus: new TorusGeometry(0.5, 0.12, 6, 16),
  }
  return geoCache
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
