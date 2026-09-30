import type { Texture } from 'three'
import {
  BLOCKS, BUILDINGS, INTERSECTIONS, MID_CROSSINGS, ROADS, SIDEWALK_Y, WORLD_BOUNDS, type BlockDef, type BuildingDef, type RoadDef,
} from '@/data/cityLayout'
import { PALETTE } from '@/data/palette'
import { PROJECTS } from '@/data/projects'
import {
  addSign, buildingHeight, lightAnchors, generateBuilding, type GenContext, type GlassPane, type RectArea, type ScreenDef, type SeatDef, type WaterDef,
} from './buildingGen'
import { PartBuilder, type BoxColliderDef, type CylColliderDef, type Part } from './partBuilder'
import {
  bench, bikeRack, bin, busStop, hydrant, manhole, mailbox, parkedCar, planter, propRegistry, signPost, streetLamp, trafficLight, tree,
  type PropKind, type PropPlacement, type TreeKind,
} from './propGen'
import { createRng } from './rng'
import { genEntry, genGallery, genGrowthWalk, genNightFurniture, genPark, genPlaza, genStudio } from './specialGen'
import { GROWTH_WALK, GROWTH_YAW } from '@/data/locations'
import { genEducation, genHome, genOffice } from './landmarkGen'
import { genInteriors } from './interiorGen'
import { AtlasBuilder } from './textures'

export interface CityData {
  parts: Part[]
  colliders: BoxColliderDef[]
  cylColliders: CylColliderDef[]
  signTexture: Texture
  decorTexture: Texture
  lamps: [number, number, number][]
  screens: ScreenDef[]
  glassPanes: GlassPane[]
  seats: SeatDef[]
  lawns: RectArea[]
  tiles: RectArea[]
  waters: WaterDef[]
  buildings: BuildingDef[]
  /** buildings replaced by a GLB model (rendered by BuildingModel instead) */
  modelBuildings: BuildingDef[]
  /** prop placements whose visuals come from a GLB */
  propPlacements: PropPlacement[]
  /** invisible world boundary walls (separate collision group so the camera ignores them) */
  walls: BoxColliderDef[]
}

const PAINT = 0xe9e6de
const PAINT_Y = 0.006

function roadHalfAt(axis: 'x' | 'z', c: number) {
  return ROADS.find((r) => r.axis === axis && r.c === c)?.half ?? 4
}

function markings(b: PartBuilder) {
  const paint = (x: number, z: number, sx: number, sz: number, color = PAINT) =>
    b.box(color, [x, PAINT_Y, z], [sx, 0.012, sz], { mat: 'paint', cast: false })

  for (const r of ROADS) {
    // intersections and crossings along this road → gaps in the centre line
    const gaps: [number, number][] = []
    for (const [ix, iz] of INTERSECTIONS) {
      if (r.axis === 'z' && ix === r.c) { const h = roadHalfAt('x', iz); gaps.push([iz - h - 4, iz + h + 4]) }
      if (r.axis === 'x' && iz === r.c) { const h = roadHalfAt('z', ix); gaps.push([ix - h - 4, ix + h + 4]) }
    }
    for (const m of MID_CROSSINGS) if (m.axis === r.axis && ((r.axis === 'z' && m.x === r.c) || (r.axis === 'x' && m.z === r.c))) {
      const t = r.axis === 'z' ? m.z : m.x
      gaps.push([t - 2.2, t + 2.2])
    }
    const inGap = (t: number) => gaps.some(([a, bb]) => t > a && t < bb)
    const isAvenue = r.id === 'avenue'
    const step = isAvenue ? 1 : 4
    for (let t = r.from; t < r.to; t += step) {
      const len = isAvenue ? 1 : 2
      const mid = t + len / 2
      if (inGap(mid) || inGap(t) || inGap(t + len)) continue
      if (isAvenue) {
        paint(r.c - 0.14, mid, 0.12, len + 0.01, 0xd9bd62)
        paint(r.c + 0.14, mid, 0.12, len + 0.01, 0xd9bd62)
      } else if (r.axis === 'z') paint(r.c, mid, 0.14, len)
      else paint(mid, r.c, len, 0.14)
    }
  }
  // crosswalks + stop lines at every intersection approach that exists
  for (const [ix, iz] of INTERSECTIONS) {
    const hv = roadHalfAt('z', ix)
    const hh = roadHalfAt('x', iz)
    const vRoad = ROADS.find((r) => r.axis === 'z' && r.c === ix) as RoadDef
    const hRoad = ROADS.find((r) => r.axis === 'x' && r.c === iz) as RoadDef
    for (const dir of [-1, 1]) {
      // along the N–S road
      const cz = iz + dir * (hh + 1.9)
      if (cz > vRoad.from + 1 && cz < vRoad.to - 1) {
        for (let x = ix - hv + 0.6; x <= ix + hv - 0.5; x += 1.05) paint(x, cz, 0.55, 2.6)
        const sz = iz + dir * (hh + 3.7)
        const x0 = dir > 0 ? ix : ix - hv + 0.3
        const x1 = dir > 0 ? ix + hv - 0.3 : ix
        paint((x0 + x1) / 2, sz, x1 - x0, 0.35)
      }
      // along the E–W road
      const cx = ix + dir * (hv + 1.9)
      if (cx > hRoad.from + 1 && cx < hRoad.to - 1) {
        for (let z = iz - hh + 0.6; z <= iz + hh - 0.5; z += 1.05) paint(cx, z, 2.6, 0.55)
        const sx = ix + dir * (hv + 3.7)
        const z0 = dir > 0 ? iz - hh + 0.3 : iz
        const z1 = dir > 0 ? iz : iz + hh - 0.3
        paint(sx, (z0 + z1) / 2, 0.35, z1 - z0)
      }
    }
  }
  for (const m of MID_CROSSINGS) {
    const h = roadHalfAt(m.axis, m.axis === 'z' ? m.x : m.z)
    for (let x = m.x - h + 0.6; x <= m.x + h - 0.5; x += 1.05) paint(x, m.z, 0.55, 2.8)
  }
  // manholes
  const rng = createRng(55)
  for (let i = 0; i < 14; i++) {
    const r = rng.pick(ROADS)
    const t = rng.range(r.from + 8, r.to - 8)
    const off = rng.range(-1.5, 1.5)
    b.push(r.axis === 'z' ? r.c + off : t, 0, r.axis === 'z' ? t : r.c + off)
    manhole(b)
    b.pop()
  }
}

function curbs(b: PartBuilder, block: BlockDef) {
  const clip = (a: number, bb: number) => [Math.max(a, -54), Math.min(bb, 54)] as const
  const color = PALETTE.curb
  const h = 0.19
  for (const side of block.streetSides) {
    if (side === 'N' || side === 'S') {
      const z = side === 'N' ? block.z0 + 0.12 : block.z1 - 0.12
      const [a, bb] = block.kind === 'edge' ? clip(block.x0, block.x1) : [block.x0, block.x1]
      b.box(color, [(a + bb) / 2, h / 2, z], [bb - a, h, 0.36], { cast: false })
    } else {
      const x = side === 'W' ? block.x0 + 0.12 : block.x1 - 0.12
      const [a, bb] = block.kind === 'edge' ? clip(block.z0, block.z1) : [block.z0, block.z1]
      b.box(color, [x, h / 2, (a + bb) / 2], [0.36, h, bb - a], { cast: false })
    }
  }
}

interface FurnitureZone {
  skip: (x: number, z: number) => boolean
}

function streetFurniture(ctx: GenContext, block: BlockDef, zone: FurnitureZone) {
  const { b } = ctx
  const rng = createRng(block.x0 * 13 + block.z0 * 7 + 991)
  const kinds: TreeKind[] = block.kind === 'park' ? ['round', 'bushy', 'gold'] : ['round', 'tall', 'blossom', 'round', 'gold']
  for (const side of block.streetSides) {
    const horizontal = side === 'N' || side === 'S'
    let a = horizontal ? block.x0 : block.z0
    let bb = horizontal ? block.x1 : block.z1
    if (block.kind === 'edge') {
      a = Math.max(a, -52)
      bb = Math.min(bb, 52)
    }
    a += 5.5
    bb -= 5.5
    // outward (toward road) normal and yaw that faces the road
    const off = 0.95
    let k = 0
    for (let t = a; t <= bb; t += 5.6, k++) {
      let x: number, z: number, yaw: number
      if (side === 'N') { x = t; z = block.z0 + off; yaw = Math.PI }
      else if (side === 'S') { x = t; z = block.z1 - off; yaw = 0 }
      else if (side === 'W') { x = block.x0 + off; z = t; yaw = -Math.PI / 2 }
      else { x = block.x1 - off; z = t; yaw = Math.PI / 2 }
      if (zone.skip(x, z)) continue
      b.push(x, SIDEWALK_Y, z, yaw)
      const slot = k % 4
      if (slot === 0) {
        // lamp arm (local +x) must point toward the road (local +z of the slot)
        b.push(0, 0, 0.1, -Math.PI / 2)
        streetLamp(ctx, rng, block.kind === 'plaza' ? 'modern' : 'classic')
        b.pop()
      } else if (slot === 2) {
        tree(ctx, rng, rng.pick(kinds), rng.range(0.9, 1.1), true)
      } else {
        const r = rng.next()
        if (r < 0.3) {
          b.push(0, 0, 0.35, Math.PI)
          bench(b, rng.pick([PALETTE.walnut, PALETTE.cocoa, PALETTE.teal]))
          const p = b.toWorld(0, 0.5, 0.02)
          ctx.seats.push({ position: p, yaw: b.yaw, kind: 'bench' })
          b.pop()
        } else if (r < 0.5) bin(b, rng.pick([PALETTE.teal, PALETTE.charcoal, PALETTE.cobalt]))
        else if (r < 0.65) {
          b.push(0, 0, 0.2)
          planter(b, rng, 1.5, 0.7)
          b.pop()
        } else if (r < 0.73) {
          b.push(0, 0, 0.3)
          bikeRack(b, rng)
          b.pop()
        } else if (r < 0.8) hydrant(b)
        else if (r < 0.85) mailbox(b)
      }
      b.pop()
    }
  }
}

function cityProps(ctx: GenContext) {
  const { b } = ctx
  const rng = createRng(808)
  // parked cars along the avenue curbs
  const parked: [number, number, number][] = [
    [4.0, -38, Math.PI], [4.0, 13, Math.PI], [4.0, 38.5, Math.PI], [-4.0, -40, 0], [-4.0, -12, 0], [-4.0, 12.5, 0],
    [-45.9, -20, 0], [46, 20, Math.PI], [20, 46, Math.PI / 2], [-30, -45.9, -Math.PI / 2],
  ]
  for (const [x, z, yaw] of parked) {
    b.push(x, 0, z, yaw)
    parkedCar(ctx, rng)
    b.pop()
  }
  // traffic lights
  const lights: [number, number, number][] = [
    [5.8, 4.8, 0], [-5.8, -4.8, Math.PI], [5.8, -4.8, Math.PI / 2], [-5.8, 4.8, -Math.PI / 2],
    [5.8, 45.2, 0], [-5.8, 45.2, 0], [5.8, -45.2, Math.PI], [-5.8, -45.2, Math.PI],
  ]
  lights.forEach(([x, z, yaw], i) => {
    b.push(x, SIDEWALK_Y, z, yaw)
    trafficLight(ctx, i)
    b.pop()
  })
  // street name signs
  const names: [number, number, string][] = [
    [-7.4, 44.8, 'Mindscape Ave'], [7.4, -44.8, 'Mindscape Ave'], [-7.4, -5.2, 'Juniper St'], [7.4, 5.2, 'Juniper St'],
  ]
  for (const [x, z, name] of names) {
    b.push(x, SIDEWALK_Y, z)
    signPost(ctx, PALETTE.teal)
    b.push(0, 2.95, 0.03)
    addSign(ctx, name, { bg: '#2f8a82', fg: '#ffffff', shape: 'rect' }, [0, 0, 0], 1.5, 0.32, PALETTE.ivory)
    b.pop()
    b.push(0, 2.95, -0.03, Math.PI)
    addSign(ctx, name, { bg: '#2f8a82', fg: '#ffffff', shape: 'rect' }, [0, 0, 0], 1.5, 0.32, null)
    b.pop()
    b.pop()
  }
  // crossing signs at mid-block crossings
  for (const m of MID_CROSSINGS) {
    for (const sx of [-1, 1]) {
      b.push(m.x + sx * 5.6, SIDEWALK_Y, m.z + sx * 1.8, sx > 0 ? Math.PI / 2 : -Math.PI / 2)
      signPost(ctx, PALETTE.cobalt)
      b.pop()
    }
  }
  // bus stop next to the park
  b.push(-7.4, SIDEWALK_Y, 38, Math.PI / 2)
  busStop(ctx, 'PARK STOP')
  b.pop()
  // rooftop billboards
  const pick = (x: number, z: number) => BUILDINGS.find((bd) => bd.x === x && bd.z === z)
  const targets: [BuildingDef | undefined, number, number][] = [
    [pick(31.5, -66), 0, 1], [pick(-46, -65), 0.35, 2], [pick(14, 78), -Math.PI / 2, 1],
  ]
  for (const [def, yaw, variant] of targets) {
    if (!def) continue
    const H = buildingHeight(def)
    const w = Math.min(8.5, def.w - 1.5)
    const h = w * 0.52
    b.push(def.x, SIDEWALK_Y + H + 0.3, def.z, yaw)
    b.box(PALETTE.charcoal, [0, h / 2 + 1.4, 0], [w + 0.5, h + 0.5, 0.35])
    for (const sx of [-w / 3, w / 3]) {
      b.box(PALETTE.slate, [sx, 0.7, -0.2], [0.18, 1.6, 0.18], { cast: false })
      b.box(PALETTE.slate, [sx, 0.9, -0.9], [0.14, 2.0, 0.14], { rot: [0.6, 0, 0], cast: false })
    }
    ctx.screens.push({ position: b.toWorld(0, h / 2 + 1.4, 0.19), yaw: b.yaw, width: w, height: h, variant })
    b.pop()
  }
}

function boundaries(b: PartBuilder): BoxColliderDef[] {
  const { minX, maxX, minZ, maxZ } = WORLD_BOUNDS
  const wall = (c: [number, number, number], size: [number, number, number]): BoxColliderDef => ({ center: c, half: [size[0] / 2, size[1] / 2, size[2] / 2], rotY: 0 })
  const walls = [
    wall([minX - 0.6, 5, (minZ + maxZ) / 2], [1, 10, maxZ - minZ + 8]),
    wall([maxX + 0.6, 5, (minZ + maxZ) / 2], [1, 10, maxZ - minZ + 8]),
    wall([0, 5, minZ - 0.6], [maxX - minX + 4, 10, 1]),
    wall([0, 5, maxZ + 2.2], [maxX - minX + 4, 10, 1]),
  ]
  // ground + block slabs
  b.collider([0, -0.5, 0], [400, 1, 400])
  for (const bl of BLOCKS) b.collider([(bl.x0 + bl.x1) / 2, SIDEWALK_Y / 2, (bl.z0 + bl.z1) / 2], [bl.x1 - bl.x0, SIDEWALK_Y, bl.z1 - bl.z0])
  return walls
}

export function generateCity(options: { modelBuildingIds?: Set<string>; replaceProps?: Set<PropKind> } = {}): CityData {
  lightAnchors.length = 0
  propRegistry.replaced = options.replaceProps ?? new Set()
  propRegistry.placements = []
  const b = new PartBuilder()
  const signs = new AtlasBuilder(2048, 2048)
  const decor = new AtlasBuilder(2048, 3072)
  const ctx: GenContext = {
    b, signs, decor, screens: [], lamps: [], glassPanes: [], seats: [], lawns: [], tiles: [], waters: [],
  }
  const modelBuildings: BuildingDef[] = []

  markings(b)
  for (const bl of BLOCKS) curbs(b, bl)

  // promenade + forecourt tiles
  ctx.tiles.push({ x0: -8, x1: 8, z0: 54.4, z1: 94, y: SIDEWALK_Y })
  ctx.tiles.push({ x0: -14, x1: 14, z0: -59.2, z1: -54.4, y: SIDEWALK_Y })

  // skip furniture where it would block crossings, the bus stop or special frontages
  const skip = (x: number, z: number) => {
    for (const m of MID_CROSSINGS) if (Math.abs(z - m.z) < 3.2 && Math.abs(x - m.x) < 12) return true
    if (Math.abs(x - -7.4) < 2 && Math.abs(z - 38) < 3.5) return true
    if (z > 53 && Math.abs(x) < 10) return true // promenade mouth
    if (z < -53 && Math.abs(x) < 15) return true // experience forecourt
    if (x > 4 && x < 10 && z > -43 && z < -7) return Math.abs(z + 25) < 7 // plaza entrance on the avenue
    return false
  }
  for (const bl of BLOCKS) streetFurniture(ctx, bl, { skip })

  for (const def of BUILDINGS) {
    if (options.modelBuildingIds?.has(def.id) && def.model) {
      modelBuildings.push(def)
      // keep collision even when a GLB replaces the visuals
      const H = buildingHeight(def)
      const yaw = def.facing === 'E' || def.facing === 'W' ? Math.PI / 2 : 0
      b.inWorld(() => b.push(def.x, SIDEWALK_Y, def.z, yaw).collider([0, H / 2, 0], [def.w, H, def.d]).pop())
      continue
    }
    switch (def.special) {
      case 'home': genHome(ctx, def); break
      case 'office': genOffice(ctx, def); break
      case 'library': genGallery(ctx, def); break
      case 'district': genStudio(ctx, def); break
      case 'education': genEducation(ctx, def); break
      default: generateBuilding(ctx, def)
    }
  }
  genEntry(ctx)
  genPlaza(ctx, PROJECTS)
  genPark(ctx)
  genNightFurniture(ctx)
  genGrowthWalk(ctx, GROWTH_WALK, GROWTH_YAW)
  genInteriors(ctx)
  cityProps(ctx)
  const walls = boundaries(b)

  const signTexture = signs.build()
  const decorTexture = decor.build()
  return {
    parts: b.parts, colliders: b.colliders, cylColliders: b.cylColliders, signTexture, decorTexture,
    lamps: ctx.lamps, screens: ctx.screens, glassPanes: ctx.glassPanes, seats: ctx.seats, lawns: ctx.lawns,
    tiles: ctx.tiles, waters: ctx.waters, buildings: BUILDINGS, modelBuildings,
    propPlacements: [...propRegistry.placements],
    walls,
  }
}
