import { createRng } from '@/utils/rng'
import type { InteriorKind, SignStyle } from '@/utils/textures'

/**
 * World layout (north = -z). Metres. The avenue runs north–south along x = 0
 * from the entry promenade (south) to the Experience Center (north).
 *
 *              EXPERIENCE ROW (north block: gallery · experience center)
 *   ─────────────────── road z = -50 ───────────────────
 *     STORE BLOCK   │ avenue │   PROJECT PLAZA · STUDIO
 *   ─────────────────── road z =   0 ───────────────────
 *     JUNIPER PARK  │ avenue │   CAFÉ BLOCK
 *   ─────────────────── road z = +50 ───────────────────
 *              ENTRY PROMENADE · information center · spawn
 */

export const SIDEWALK_Y = 0.15
export const SIDEWALK_W = 4

export interface RoadDef {
  id: string
  /** 'x' = runs along x (east–west), 'z' = runs along z (north–south) */
  axis: 'x' | 'z'
  c: number
  from: number
  to: number
  half: number
}

export const ROADS: RoadDef[] = [
  { id: 'north-st', axis: 'x', c: -50, from: -54, to: 54, half: 4 },
  { id: 'mid-st', axis: 'x', c: 0, from: -54, to: 54, half: 4 },
  { id: 'south-st', axis: 'x', c: 50, from: -54, to: 54, half: 4 },
  { id: 'west-rd', axis: 'z', c: -50, from: -54, to: 54, half: 4 },
  { id: 'avenue', axis: 'z', c: 0, from: -54, to: 54, half: 5 },
  { id: 'east-rd', axis: 'z', c: 50, from: -54, to: 54, half: 4 },
]

export const INTERSECTIONS: [number, number][] = []
for (const x of [-50, 0, 50]) for (const z of [-50, 0, 50]) INTERSECTIONS.push([x, z])

/** Mid-block pedestrian crossings on the avenue: [x, z, axis of the road] */
export const MID_CROSSINGS: { x: number; z: number; axis: 'x' | 'z' }[] = [
  { x: 0, z: -25, axis: 'z' },
  { x: 0, z: 25, axis: 'z' },
]

export type Side = 'N' | 'S' | 'E' | 'W'

export interface BlockDef {
  id: string
  x0: number
  x1: number
  z0: number
  z1: number
  kind: 'urban' | 'park' | 'plaza' | 'edge'
  /** sides that face a street and get a sidewalk + street furniture */
  streetSides: Side[]
}

export const BLOCKS: BlockDef[] = [
  { id: 'store-block', x0: -46, x1: -5, z0: -46, z1: -4, kind: 'urban', streetSides: ['N', 'S', 'E', 'W'] },
  { id: 'plaza-block', x0: 5, x1: 46, z0: -46, z1: -4, kind: 'plaza', streetSides: ['N', 'S', 'E', 'W'] },
  { id: 'park-block', x0: -46, x1: -5, z0: 4, z1: 46, kind: 'park', streetSides: ['N', 'S', 'E', 'W'] },
  { id: 'cafe-block', x0: 5, x1: 46, z0: 4, z1: 46, kind: 'urban', streetSides: ['N', 'S', 'E', 'W'] },
  { id: 'north-block', x0: -110, x1: 110, z0: -130, z1: -54, kind: 'edge', streetSides: ['S'] },
  { id: 'south-block', x0: -110, x1: 110, z0: 54, z1: 130, kind: 'edge', streetSides: ['N'] },
  { id: 'west-block', x0: -110, x1: -54, z0: -54, z1: 54, kind: 'edge', streetSides: ['E'] },
  { id: 'east-block', x0: 54, x1: 110, z0: -54, z1: 54, kind: 'edge', streetSides: ['W'] },
]

/** Walkable bounds for the player (invisible walls sit just outside). */
export const WORLD_BOUNDS = { minX: -57.6, maxX: 57.6, minZ: -60, maxZ: 90 }

export interface ShopInfo {
  name: string
  kind: InteriorKind
  sign: SignStyle
}

export const SHOPS: Record<string, ShopInfo> = {
  moon: { name: 'Moon Bakery', kind: 'bakery', sign: { bg: '#3b3650', fg: '#f5dd92', icon: 'moon', shape: 'round', sub: 'fresh daily' } },
  bloom: { name: 'Bloom', kind: 'florist', sign: { bg: '#fbf5ea', fg: '#e0506a', icon: 'leaf', shape: 'pill', sub: 'florist' } },
  tidal: { name: 'Tidal Records', kind: 'records', sign: { bg: '#2f3fb8', fg: '#ffffff', icon: 'note', shape: 'rect' } },
  sol: { name: 'Sol Noodle', kind: 'noodle', sign: { bg: '#e0506a', fg: '#fff3d6', icon: 'bolt', shape: 'round' } },
  kiln: { name: 'Kiln Ceramics', kind: 'ceramics', sign: { bg: '#c9765e', fg: '#fbf5ea', shape: 'rect', sub: 'studio & shop' } },
  peach: { name: 'Peach Pharmacy', kind: 'pharmacy', sign: { bg: '#4fb3a9', fg: '#ffffff', icon: 'heart', shape: 'pill' } },
  maple: { name: 'Maple Books', kind: 'books', sign: { bg: '#6e4a3b', fg: '#f5dd92', icon: 'star', shape: 'round' } },
  cloud: { name: 'Cloud Laundry', kind: 'laundry', sign: { bg: '#cfe0f2', fg: '#2f3fb8', shape: 'pill', sub: 'wash · fold' } },
  pixel: { name: 'Pixel Arcade', kind: 'arcade', sign: { bg: '#2b2350', fg: '#ff8fc8', icon: 'star', shape: 'rect', border: '#6ff0ff' } },
  fig: { name: 'Fig & Olive', kind: 'grocery', sign: { bg: '#9cc3a0', fg: '#2b2350', icon: 'leaf', shape: 'round' } },
  paper: { name: 'Paper & Ink', kind: 'books', sign: { bg: '#fbf5ea', fg: '#2b2350', shape: 'rect', border: '#2b2350', sub: 'stationery' } },
  nova: { name: 'Nova Optics', kind: 'boutique', sign: { bg: '#a996d4', fg: '#ffffff', icon: 'star', shape: 'pill' } },
  hana: { name: 'Hana Tea', kind: 'cafe', sign: { bg: '#bfe3cf', fg: '#2b2350', icon: 'cup', shape: 'round' } },
  juniper: { name: 'Juniper Deli', kind: 'grocery', sign: { bg: '#f5dd92', fg: '#6e4a3b', shape: 'rect', sub: 'sandwiches' } },
  echo: { name: 'Echo Barber', kind: 'boutique', sign: { bg: '#fbf5ea', fg: '#e0506a', shape: 'pill', border: '#2f3fb8' } },
  orbit: { name: 'Orbit Cycles', kind: 'boutique', sign: { bg: '#f39a4a', fg: '#ffffff', icon: 'bolt', shape: 'rect' } },
  sunny: { name: 'Sunny Side', kind: 'noodle', sign: { bg: '#f5dd92', fg: '#e0506a', icon: 'heart', shape: 'round', sub: 'all-day diner' } },
  plum: { name: 'Plum Boutique', kind: 'boutique', sign: { bg: '#e89aab', fg: '#ffffff', shape: 'pill' } },
  bao: { name: 'Bao Bar', kind: 'noodle', sign: { bg: '#fbf5ea', fg: '#c9765e', icon: 'cup', shape: 'round' } },
  studio9: { name: 'Studio Nine', kind: 'studio', sign: { bg: '#3b3650', fg: '#bfe3cf', shape: 'rect' } },
  corner: { name: 'Corner Mart', kind: 'grocery', sign: { bg: '#4fb3a9', fg: '#ffffff', icon: 'star', shape: 'rect' } },
  vinyl: { name: 'Lilac Vintage', kind: 'boutique', sign: { bg: '#bfaee0', fg: '#2b2350', shape: 'round' } },
  crumb: { name: 'Crumb', kind: 'bakery', sign: { bg: '#f6c4a4', fg: '#6e4a3b', icon: 'heart', shape: 'pill' } },
}

export type BuildingStyle = 'shop' | 'apartment' | 'corner' | 'townhouse' | 'tower' | 'special'
export type SpecialKind = 'home' | 'office' | 'library' | 'district' | 'education'

export interface BuildingDef {
  id: string
  x: number
  z: number
  /** facade width */
  w: number
  /** depth perpendicular to the facade */
  d: number
  facing: Side
  style: BuildingStyle
  floors: number
  seed: number
  palette?: number
  shop?: string
  special?: SpecialKind
  /** optional GLB replacement, loaded from /public/models */
  model?: string
  /** keep out of collision (backdrop beyond the walls) */
  backdrop?: boolean
}

let seedCounter = 100
function B(
  x: number, z: number, w: number, d: number, facing: Side, style: BuildingStyle, floors: number,
  extra: Partial<BuildingDef> = {},
): BuildingDef {
  seedCounter += 17
  return { id: `b${seedCounter}`, x, z, w, d, facing, style, floors, seed: seedCounter, ...extra }
}

const handPlaced: BuildingDef[] = [
  // ── Store block (x -46..-5, z -46..-4)
  B(-15.5, -25, 14, 13, 'E', 'special', 2, { special: 'home', id: 'home' }),
  B(-15, -37, 10, 12, 'E', 'corner', 3, { shop: 'moon', palette: 3 }),
  B(-15, -13, 10, 12, 'E', 'shop', 2, { shop: 'bloom', palette: 0 }),
  B(-27, -37, 12, 10, 'N', 'apartment', 4, { palette: 2 }),
  B(-37.5, -37, 9, 10, 'N', 'townhouse', 3, { palette: 4, shop: 'crumb' }),
  B(-27, -13, 12, 10, 'S', 'shop', 2, { shop: 'tidal', palette: 7 }),
  B(-37.5, -13, 9, 10, 'S', 'apartment', 5, { palette: 5 }),
  B(-37, -25, 14, 10, 'W', 'apartment', 4, { palette: 9, shop: 'vinyl' }),

  // ── Plaza block (x 5..46, z -46..-4)
  B(36, -25, 16, 12, 'W', 'special', 3, { special: 'district', id: 'district' }),
  B(36, -37.5, 12, 9, 'N', 'apartment', 5, { palette: 10, shop: 'studio9' }),
  B(36, -12.5, 12, 9, 'S', 'corner', 3, { palette: 1, shop: 'plum' }),

  // ── Café block (x 5..46, z 4..46)
  B(23, 17, 18, 14, 'W', 'special', 4, { special: 'office', id: 'nfc-office' }),
  B(37, 13, 10, 10, 'N', 'apartment', 4, { palette: 11, shop: 'sol' }),
  B(15, 30, 8, 12, 'W', 'shop', 2, { shop: 'kiln', palette: 1 }),
  B(15, 38, 12, 8, 'S', 'corner', 3, { shop: 'peach', palette: 5 }),
  B(26, 37, 10, 10, 'S', 'townhouse', 3, { shop: 'maple', palette: 6 }),
  B(36.5, 37, 11, 10, 'S', 'apartment', 5, { palette: 3 }),
  B(37, 25, 14, 10, 'E', 'shop', 2, { shop: 'cloud', palette: 7 }),

  // ── North block: Experience Row (front at z ≈ -58)
  B(0, -68, 26, 18, 'S', 'special', 3, { special: 'education', id: 'education' }),
  B(-30, -67, 18, 16, 'S', 'special', 2, { special: 'library', id: 'library' }),
  B(-17, -65, 7, 12, 'S', 'townhouse', 3, { shop: 'fig', palette: 5 }),
  B(-46, -65, 12, 14, 'S', 'apartment', 5, { shop: 'pixel', palette: 2 }),
  B(-62, -65, 14, 14, 'S', 'apartment', 4, { palette: 8 }),
  B(19, -65, 10, 12, 'S', 'shop', 2, { shop: 'paper', palette: 0 }),
  B(31.5, -66, 14, 14, 'S', 'apartment', 6, { palette: 9 }),
  B(46, -65, 12, 14, 'S', 'corner', 3, { shop: 'nova', palette: 10 }),
  B(62, -65, 14, 14, 'S', 'apartment', 4, { palette: 4 }),

  // ── South block: entry promenade (front at z = 58)
  B(-14, 64, 10, 12, 'N', 'shop', 2, { shop: 'hana', palette: 5 }),
  B(-25, 64, 11, 12, 'N', 'apartment', 4, { shop: 'juniper', palette: 0 }),
  B(-37, 64, 12, 12, 'N', 'townhouse', 3, { palette: 3 }),
  B(-50, 64, 13, 12, 'N', 'apartment', 5, { palette: 6 }),
  B(-63, 64, 12, 12, 'N', 'shop', 2, { shop: 'corner', palette: 8 }),
  B(-14, 78, 14, 10, 'E', 'shop', 2, { shop: 'echo', palette: 10 }),
  B(-14, 91, 10, 10, 'E', 'townhouse', 3, { palette: 1 }),
  B(14, 64, 10, 12, 'N', 'shop', 2, { shop: 'orbit', palette: 11 }),
  B(25, 64, 11, 12, 'N', 'apartment', 4, { palette: 7 }),
  B(37, 64, 12, 12, 'N', 'corner', 3, { shop: 'bao', palette: 4 }),
  B(50, 64, 13, 12, 'N', 'apartment', 5, { palette: 2 }),
  B(63, 64, 12, 12, 'N', 'shop', 2, { shop: 'sunny', palette: 0 }),
  B(14, 78, 14, 10, 'W', 'shop', 2, { shop: 'sunny', palette: 3 }),
  B(14, 91, 10, 10, 'W', 'townhouse', 3, { palette: 9 }),
  B(0, 99, 20, 10, 'N', 'townhouse', 3, { palette: 6 }),
]

/** Fill a straight frontage with buildings of varied widths (deterministic). */
function row(
  seed: number, axis: 'x' | 'z', from: number, to: number, front: number, facing: Side, depth: number,
  shops: string[],
): BuildingDef[] {
  const rng = createRng(seed)
  const out: BuildingDef[] = []
  let t = from
  let shopIdx = 0
  const styles: BuildingStyle[] = ['apartment', 'shop', 'townhouse', 'apartment', 'corner', 'shop']
  while (t < to - 5) {
    let w = rng.range(9, 13.5)
    if (to - (t + w) < 6) w = to - t
    const c = t + w / 2
    const dir = facing === 'E' || facing === 'S' ? 1 : -1
    // center is pushed back from the front line by half the depth
    const back = front - dir * (depth / 2)
    const style = rng.pick(styles)
    const floors = style === 'shop' ? rng.int(2, 3) : style === 'townhouse' ? 3 : rng.int(3, 6)
    const def = B(
      axis === 'x' ? c : back, axis === 'x' ? back : c, w - 0.2, depth, facing, style, floors,
      { palette: rng.int(0, 11), shop: style !== 'apartment' || rng.chance(0.5) ? shops[shopIdx++ % shops.length] : undefined },
    )
    out.push(def)
    t += w
  }
  return out
}

// ── Edge frontages that enclose the city on west and east
const westRow = row(501, 'z', -52, 52, -58, 'E', 12, ['sol', 'bloom', 'bao', 'crumb', 'maple', 'fig', 'echo'])
const eastRow = row(733, 'z', -52, 52, 58, 'W', 12, ['kiln', 'tidal', 'hana', 'paper', 'orbit', 'plum', 'pixel'])

// ── Backdrop skyline beyond the walls (visual depth only, no collision)
function backdrop(): BuildingDef[] {
  const rng = createRng(4242)
  const out: BuildingDef[] = []
  const ring: [number, number, Side][] = []
  for (let x = -100; x <= 100; x += 14) ring.push([x, -96 - rng.range(0, 10), 'S'])
  for (let x = -100; x <= 100; x += 14) ring.push([x, 116 + rng.range(0, 8), 'N'])
  for (let z = -80; z <= 100; z += 14) ring.push([-86 - rng.range(0, 10), z, 'E'])
  for (let z = -80; z <= 100; z += 14) ring.push([86 + rng.range(0, 10), z, 'W'])
  for (const [x, z, f] of ring) {
    const tall = rng.chance(0.45)
    out.push(B(x, z, rng.range(10, 13), rng.range(10, 14), f, tall ? 'tower' : 'apartment', tall ? rng.int(7, 13) : rng.int(4, 7), { palette: rng.pick([0, 1, 3, 5, 9, 11]), backdrop: true }))
  }
  // a second layer of towers for the skyline silhouette
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2
    const r = rng.range(125, 150)
    out.push(B(Math.cos(a) * r, 15 + Math.sin(a) * r, rng.range(12, 18), rng.range(12, 18), 'S', 'tower', rng.int(10, 18), { palette: rng.pick([0, 1, 3, 5, 9, 11]), backdrop: true }))
  }
  return out
}

export const BUILDINGS: BuildingDef[] = [...handPlaced, ...westRow, ...eastRow, ...backdrop()]

/** Footprint extents in world space for a building (x-extent, z-extent). */
export function footprint(b: BuildingDef) {
  const sideways = b.facing === 'E' || b.facing === 'W'
  const ex = sideways ? b.d : b.w
  const ez = sideways ? b.w : b.d
  return { x0: b.x - ex / 2, x1: b.x + ex / 2, z0: b.z - ez / 2, z1: b.z + ez / 2 }
}

export function facingYaw(f: Side) {
  switch (f) {
    case 'S': return 0
    case 'N': return Math.PI
    case 'E': return Math.PI / 2
    case 'W': return -Math.PI / 2
  }
}

/** Special furniture anchors shared between generator and NPC system. */
export const KIOSK_POS: [number, number] = [6.6, 69.4]
export const ARCH_Z = 76
export const FOUNTAIN_POS: [number, number] = [19, -25]
export const PARK_CENTER: [number, number] = [-25.5, 25]
