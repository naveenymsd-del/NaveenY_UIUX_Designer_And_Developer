import { SIDEWALK_Y, facingYaw, type BuildingDef } from '@/data/cityLayout'
import { PALETTE } from '@/data/palette'
import { addSign, buildSpec, lightPoolAt, windowUnit, type GenContext } from './buildingGen'
import { bench, bicycle, bikeRack, flowerBed, planter, tree } from './propGen'
import { createRng } from './rng'
import { interiorPainter } from './textures'

/**
 * The three story landmarks on the street: Education campus, NFC Solutions
 * office and Home. Each has its own architectural language so they read
 * as distinct places from a distance.
 */

function seatAt(ctx: GenContext, lx: number, ly: number, lz: number, localYaw: number) {
  ctx.seats.push({ position: ctx.b.toWorld(lx, ly, lz), yaw: ctx.b.yaw + localYaw, kind: 'bench' })
}

// ────────────────────────────────────────────────────────────────────────────
// EDUCATION — classical brick campus with portico, pediment and clock tower
// ────────────────────────────────────────────────────────────────────────────
export function genEducation(ctx: GenContext, def: BuildingDef) {
  const { b } = ctx
  const rng = createRng(def.seed)
  const brick = 0xa4553f
  const stone = 0xe9e0cf
  const slate = 0x55585e
  const wood = 0x5c4535
  const w = def.w
  const d = def.d
  const gH = 4
  const fH = 3.5
  const H = gH + fH * 2
  const s = buildSpec({ ...def, style: 'apartment', floors: 3 })
  s.pal = { wall: brick, trim: stone, accent: 0x3f5e4c, roof: slate }
  s.litChance = 0.1
  const front = d / 2
  b.push(def.x, SIDEWALK_Y, def.z, facingYaw(def.facing))
  // body, plinth, string courses, cornice
  b.box(brick, [0, H / 2, 0], [w, H, d])
  b.box(stone, [0, 0.45, 0], [w + 0.2, 0.9, d + 0.2])
  for (const y of [gH, gH + fH]) b.box(stone, [0, y, 0], [w + 0.16, 0.22, d + 0.16], { cast: false })
  b.box(stone, [0, H + 0.2, 0], [w + 0.45, 0.45, d + 0.45])
  // quoins at the corners
  for (const sx of [-1, 1])
    for (let y = 1.2; y < H; y += 0.9) b.box(stone, [sx * (w / 2 - 0.2), y, front - 0.2], [0.5, 0.42, 0.5], { cast: false })
  // slate roof with ridge along the facade
  b.add('prism', slate, [0, H + 0.42 + 1.5, 0], [d + 0.9, 3.0, w + 0.9], { rot: [0, Math.PI / 2, 0] })
  // windows: tall sash windows on the wings (the centre is the portico)
  b.push(0, 0, front)
  for (let f = 0; f < 3; f++) {
    const y = f === 0 ? 2.2 : gH + (f - 1) * fH + 1.85
    for (const x of [-11.2, -8.6, -6, 6, 8.6, 11.2]) windowUnit(ctx, s, x, y, 1.15, 2.0, 'tall', rng.chance(s.litChance))
    if (f > 0) for (const x of [-1.6, 1.6]) windowUnit(ctx, s, x, y, 1.0, 1.8, 'arched', false)
  }
  b.pop()
  for (const side of [-1, 1]) {
    b.push(side * (w / 2), 0, 0, side * Math.PI / 2)
    for (let f = 0; f < 3; f++) for (const x of [-5.5, -2.8, 0, 2.8, 5.5]) windowUnit(ctx, s, x, f === 0 ? 2.2 : gH + (f - 1) * fH + 1.85, 1.1, 1.9, 'tall', false)
    b.pop()
  }
  // portico: podium, steps, columns, entablature, pediment
  const pz = front + 0.95
  b.box(stone, [0, 0.3, pz], [9.6, 0.6, 1.9])
  b.collider([0, 0.3, pz], [9.6, 0.6, 1.9])
  for (let i = 0; i < 2; i++) {
    const h = 0.2 + i * 0.2
    const z = pz + 1.25 - i * 0.3
    b.box(0xdcd3c2, [0, h / 2, z + (i === 0 ? 0.15 : 0)], [10.4 - i * 0.4, h, 0.6])
    b.collider([0, h / 2, z + (i === 0 ? 0.15 : 0)], [10.4 - i * 0.4, h, 0.6])
  }
  for (const x of [-3.6, -1.2, 1.2, 3.6]) {
    b.box(stone, [x, 0.72, pz + 0.3], [0.9, 0.24, 0.9])
    b.add('cyl', 0xefe7d8, [x, 3.9, pz + 0.3], [0.62, 6.1, 0.62])
    b.box(stone, [x, 7.05, pz + 0.3], [0.9, 0.3, 0.9])
    b.cylCollider([x, 0.6, pz + 0.3], 0.34, 6.5)
  }
  b.box(stone, [0, 7.7, front + 0.7], [9.8, 1.0, 2.0])
  b.add('prism', stone, [0, 9.05, front + 0.7], [10.2, 1.7, 2.0])
  b.add('prism', 0xd8cdb9, [0, 8.95, front + 1.71], [7.6, 1.1, 0.04], { cast: false })
  addSign(ctx, 'MY EDUCATION', { bg: '#e9e0cf', fg: '#3b3e44', shape: 'rect', weight: 700 }, [0, 7.7, front + 1.71], 4.2, 0.5)
  // entrance doors
  b.box(stone, [0, 2.3, front + 0.02], [3.3, 4.4, 0.2])
  b.box(wood, [-0.66, 1.95, front + 0.1], [1.25, 3.7, 0.1])
  b.box(wood, [0.66, 1.95, front + 0.1], [1.25, 3.7, 0.1])
  for (const x of [-0.66, 0.66]) b.box(0x8aa2c2, [x, 2.5, front + 0.16], [0.85, 1.4, 0.02], { mat: 'glass', cast: false })
  b.add('hcyl', PALETTE.windowLit, [0, 3.9, front + 0.12], [2.6, 0.04, 2.6], { rot: [-Math.PI / 2, 0, 0], mat: 'glow', cast: false })
  for (const x of [-4.9, 4.9]) {
    b.box(PALETTE.charcoal, [x, 3.0, front + 0.25], [0.3, 0.5, 0.3], { cast: false })
    b.box(PALETTE.lamp, [x, 2.95, front + 0.42], [0.22, 0.34, 0.04], { mat: 'emissive', cast: false })
  }
  // clock tower
  const tz = -1
  b.box(0xefe7d8, [0, H + 2.7, tz], [4.4, 4.8, 4.4])
  b.box(stone, [0, H + 5.2, tz], [4.9, 0.35, 4.9])
  b.add('cone6', slate, [0, H + 7.0, tz], [5.2, 3.4, 5.2], { rot: [0, Math.PI / 6, 0] })
  b.add('cyl', 0xfaf7f0, [0, H + 3.0, tz + 2.22], [2.3, 0.08, 2.3], { rot: [Math.PI / 2, 0, 0], cast: false })
  b.add('torus', PALETTE.charcoal, [0, H + 3.0, tz + 2.26], [2.35, 2.35, 0.5], { cast: false })
  b.box(PALETTE.charcoal, [0, H + 3.3, tz + 2.28], [0.07, 0.65, 0.03], { cast: false })
  b.box(PALETTE.charcoal, [0.22, H + 3.0, tz + 2.28], [0.45, 0.06, 0.03], { rot: [0, 0, 0.35], cast: false })
  b.add('cyl8', PALETTE.slate, [0, H + 9.5, tz], [0.1, 2.2, 0.1], { cast: false })
  b.box(0x3f5e4c, [0.55, H + 10.1, tz], [1.0, 0.6, 0.03], { mat: 'fabric' })
  // forecourt: notice board, bikes, benches, flags, trees
  b.push(-7.6, 0, front + 2.9)
  b.box(wood, [-0.95, 0.9, 0], [0.1, 1.8, 0.1])
  b.box(wood, [0.95, 0.9, 0], [0.1, 1.8, 0.1])
  b.box(0x9c7a58, [0, 1.35, 0], [2.0, 1.0, 0.08])
  for (let i = 0; i < 7; i++) b.box(rng.pick([0xf6f1e8, 0xe3d2a2, 0xbcd0d8, 0xe8c9bd]), [-0.75 + (i % 4) * 0.5, 1.55 - Math.floor(i / 4) * 0.42, 0.05], [0.34, 0.3, 0.01], { rot: [0, 0, rng.range(-0.08, 0.08)], cast: false })
  b.box(wood, [0, 1.92, 0.05], [2.2, 0.12, 0.2])
  b.collider([0, 0.9, 0], [2.2, 1.8, 0.3])
  b.pop()
  b.push(7.8, 0, front + 3.2)
  bikeRack(b, rng)
  b.pop()
  b.push(9.4, 0, front + 2.8, 0.2)
  bicycle(b, rng)
  b.pop()
  for (const sx of [-1, 1]) {
    b.push(sx * 11.6, 0, front + 2.7, Math.PI)
    bench(b, wood)
    seatAt(ctx, 0, 0.5, 0.02, 0)
    b.pop()
    b.push(sx * 5.9, 0, front + 3.3)
    b.add('cyl8', PALETTE.slate, [0, 3.6, 0], [0.1, 7.2, 0.1])
    b.box(sx < 0 ? 0x3f5e4c : 0x9b5442, [0.75, 6.5, 0], [1.4, 0.85, 0.03], { mat: 'fabric' })
    b.cylCollider([0, 0, 0], 0.12, 7)
    b.pop()
  }
  const [lx, , lz] = b.toWorld(0, 0, front + 2)
  lightPoolAt(ctx, lx, lz, 5, 0xfff0d8)
  b.collider([0, H / 2, 0], [w, H, d])
  b.pop()
}

// ────────────────────────────────────────────────────────────────────────────
// HOME — a warm two-storey house with porch, front garden and picket fence
// ────────────────────────────────────────────────────────────────────────────
export function genHome(ctx: GenContext, def: BuildingDef) {
  const { b } = ctx
  const rng = createRng(def.seed)
  const wall = 0xefe7da
  const base = 0xb9ad9b
  const trim = 0xfaf6ef
  const shutter = 0x6f8a6a
  const doorC = 0x7a3f2e
  const roof = 0x8a4f3c
  const wood = 0x8a6a4c
  const s = buildSpec({ ...def, style: 'townhouse', floors: 2 })
  s.pal = { wall, trim, accent: shutter, roof }
  s.litChance = 0.5
  const hw = 10.4
  const hd = 7.6
  const hz = -2.5 // house centre (local z); front of the house at hz + hd / 2
  const hf = hz + hd / 2
  const gH = 3.1
  const H = gH + 2.8
  const fenceZ = 6.2
  b.push(def.x, SIDEWALK_Y, def.z, facingYaw(def.facing))
  // body
  b.box(wall, [0, H / 2, hz], [hw, H, hd])
  b.box(base, [0, 0.35, hz], [hw + 0.12, 0.7, hd + 0.12])
  b.box(trim, [0, gH, hz], [hw + 0.14, 0.16, hd + 0.14], { cast: false })
  b.box(trim, [0, H + 0.08, hz], [hw + 0.5, 0.18, hd + 0.5])
  // tiled roof + front cross gable + chimney
  b.add('prism', roof, [0, H + 1.6, hz], [hd + 1.2, 3.0, hw + 1.0], { rot: [0, Math.PI / 2, 0] })
  b.add('prism', roof, [2.6, H + 1.0, hf - 0.2], [3.4, 2.0, 2.6])
  b.box(wall, [2.6, H + 0.55, hf + 0.4], [2.9, 1.1, 0.2], { cast: false })
  b.box(PALETTE.brick, [-3.2, H + 2.4, hz - 1.4], [0.8, 2.6, 0.8])
  b.box(PALETTE.charcoal, [-3.2, H + 3.75, hz - 1.4], [0.95, 0.14, 0.95])
  // front facade
  b.push(0, 0, hf)
  windowUnit(ctx, s, -3.3, 1.75, 1.5, 1.6, 'shuttered', true)
  windowUnit(ctx, s, 3.3, 1.75, 1.5, 1.6, 'shuttered', false)
  windowUnit(ctx, s, -3.3, gH + 1.45, 1.1, 1.3, 'shuttered', false)
  windowUnit(ctx, s, 0, gH + 1.45, 0.9, 1.2, 'grid', true)
  windowUnit(ctx, s, 2.6, gH + 1.25, 1.0, 1.1, 'arched', true)
  // door
  b.box(trim, [0, 1.25, 0.04], [1.55, 2.6, 0.08], { cast: false })
  b.box(doorC, [0, 1.18, 0.09], [1.15, 2.3, 0.06], { cast: false })
  b.box(PALETTE.windowLit, [0, 1.85, 0.13], [0.55, 0.5, 0.02], { mat: 'glow', cast: false })
  b.box(0xd4b47a, [0.42, 1.1, 0.14], [0.06, 0.06, 0.06], { mat: 'metal', cast: false })
  addSign(ctx, 'MY HOME', { bg: '#faf6ef', fg: '#5c4535', shape: 'round', weight: 700 }, [-1.25, 2.1, 0.08], 0.7, 0.24)
  for (const x of [-0.95, 0.95]) {
    b.box(PALETTE.charcoal, [x, 2.2, 0.12], [0.16, 0.28, 0.16], { cast: false })
    b.box(PALETTE.lamp, [x, 2.16, 0.22], [0.12, 0.2, 0.04], { mat: 'emissive', cast: false })
  }
  b.pop()
  // porch
  const pz = hf + 1.05
  b.box(wood, [0, 0.14, pz], [4.2, 0.28, 2.1])
  b.collider([0, 0.14, pz], [4.2, 0.28, 2.1])
  b.box(0xa98a6a, [0, 0.07, pz + 1.3], [2.0, 0.14, 0.5])
  b.collider([0, 0.07, pz + 1.3], [2.0, 0.14, 0.5])
  for (const x of [-1.9, 1.9]) {
    b.add('cyl8', trim, [x, 1.55, pz + 0.85], [0.16, 2.6, 0.16])
    b.cylCollider([x, 0.28, pz + 0.85], 0.1, 2.6)
  }
  b.box(trim, [0, 2.9, pz + 0.1], [4.6, 0.16, 2.4])
  b.add('prism', roof, [0, 3.3, pz + 0.1], [4.8, 0.7, 2.5])
  for (let i = 0; i <= 8; i++) b.box(trim, [-1.9 + i * 0.475, 0.62, pz + 0.95], [0.05, 0.62, 0.05], { cast: false })
  b.box(trim, [-1.0, 0.95, pz + 0.95], [1.9, 0.06, 0.08], { cast: false })
  b.box(trim, [1.35, 0.95, pz + 0.95], [1.1, 0.06, 0.08], { cast: false })
  b.push(-1.3, 0.28, pz - 0.2, Math.PI)
  b.box(wood, [0, 0.42, 0], [1.2, 0.08, 0.5])
  b.box(wood, [0, 0.72, -0.22], [1.2, 0.5, 0.06])
  b.pop()
  // garden: lawns, stepping-stone path, flower beds, a tree
  const lawnY = SIDEWALK_Y + 0.08
  const toWorldRect = (x0: number, x1: number, z0: number, z1: number) => {
    const a = b.toWorld(x0, 0, z0)
    const c = b.toWorld(x1, 0, z1)
    return { x0: Math.min(a[0], c[0]), x1: Math.max(a[0], c[0]), z0: Math.min(a[2], c[2]), z1: Math.max(a[2], c[2]) }
  }
  for (const [x0, x1] of [[-6.8, -1.0], [1.0, 6.8]] as const) {
    const r = toWorldRect(x0, x1, hf + 0.2, fenceZ - 0.15)
    ctx.lawns.push({ ...r, y: lawnY })
    b.inWorld(() => b.collider([(r.x0 + r.x1) / 2, SIDEWALK_Y + 0.04, (r.z0 + r.z1) / 2], [r.x1 - r.x0, 0.08, r.z1 - r.z0]))
  }
  for (let i = 0; i < 4; i++) b.add('rbox', 0xcfc7ba, [rng.range(-0.1, 0.1), 0.02, pz + 1.9 + i * 0.75], [0.9, 0.05, 0.55], { cast: false })
  for (const x of [-4.3, 4.3]) {
    b.push(x, 0.08, hf + 0.8)
    flowerBed(b, rng, 3.4, 0.7)
    b.pop()
  }
  b.push(-5.2, 0.08, 4.4)
  tree(ctx, rng, 'blossom', 0.85, false)
  b.pop()
  b.push(4.6, 0.08, 4.6)
  planter(b, rng, 1.0, 1.0)
  b.pop()
  // picket fence + gate
  const picket = (x: number, z: number, yaw = 0) => b.box(0xf6f1e8, [x, 0.5, z], [0.08, 1.0, 0.05], { rot: [0, yaw, 0], cast: false })
  for (const [x0, x1] of [[-6.95, -0.95], [0.95, 6.95]] as const) {
    for (let x = x0; x <= x1 + 0.01; x += 0.2) picket(x, fenceZ)
    b.box(0xf6f1e8, [(x0 + x1) / 2, 0.75, fenceZ - 0.04], [x1 - x0, 0.07, 0.04], { cast: false })
    b.box(0xf6f1e8, [(x0 + x1) / 2, 0.3, fenceZ - 0.04], [x1 - x0, 0.07, 0.04], { cast: false })
    b.collider([(x0 + x1) / 2, 0.5, fenceZ], [x1 - x0, 1.0, 0.12])
  }
  for (const sx of [-1, 1]) {
    for (let z = -6.4; z < fenceZ; z += 0.2) picket(sx * 6.95, z, Math.PI / 2)
    b.collider([sx * 6.95, 0.5, (fenceZ - 6.4) / 2], [0.12, 1.0, fenceZ + 6.4])
    b.box(0xf6f1e8, [sx * 0.95, 0.6, fenceZ], [0.14, 1.2, 0.14])
  }
  // gate left open
  b.push(0.95, 0, fenceZ)
  b.box(0xf6f1e8, [0, 0.55, 0.45], [0.05, 0.8, 0.9], { cast: false })
  b.pop()
  // mailbox by the gate
  b.push(1.6, 0, fenceZ + 0.45)
  b.add('cyl8', PALETTE.walnut, [0, 0.55, 0], [0.08, 1.1, 0.08])
  b.box(0x2f4a8a, [0, 1.15, 0], [0.36, 0.28, 0.5])
  b.add('hcyl', 0x2f4a8a, [0, 1.29, 0], [0.36, 0.5, 0.36], { rot: [Math.PI / 2, 0, 0] })
  b.box(0xa4433d, [0.2, 1.3, 0.12], [0.03, 0.22, 0.05], { cast: false })
  b.cylCollider([0, 0, 0], 0.2, 1.4)
  b.pop()
  const [lx, , lz] = b.toWorld(0, 0, pz + 1.4)
  lightPoolAt(ctx, lx, lz, 2.4, 0xffe2b8)
  b.collider([0, H / 2, hz], [hw, H, hd])
  b.pop()
}

// ────────────────────────────────────────────────────────────────────────────
// NFC SOLUTIONS — modern office: curtain wall, canopy, forecourt
// ────────────────────────────────────────────────────────────────────────────
export function genOffice(ctx: GenContext, def: BuildingDef) {
  const { b } = ctx
  const rng = createRng(def.seed)
  const stone = 0xd9d4ca
  const frame = 0x2e3035
  const glass = 0x6f86a3
  const w = def.w
  const d = def.d
  const gH = 4.6
  const fH = 3.6
  const floors = 4
  const H = gH + fH * (floors - 1)
  const front = d / 2
  b.push(def.x, SIDEWALK_Y, def.z, facingYaw(def.facing))
  b.box(stone, [0, H / 2, -0.3], [w - 0.2, H, d - 0.6])
  b.box(0xb8b2a6, [0, 0.2, 0], [w + 0.1, 0.4, d], { cast: false })
  // curtain wall
  const cols = 9
  const cw = w / cols
  const lobby = ctx.decor.add(384, 192, interiorPainter('office', 3), 'int-nfc-lobby')
  for (let f = 0; f < floors; f++) {
    const y0 = f === 0 ? 0 : gH + (f - 1) * fH
    const fh = f === 0 ? gH : fH
    for (let c = 0; c < cols; c++) {
      const x = -w / 2 + cw * (c + 0.5)
      if (f === 0) {
        b.add('plane', 0xffffff, [x, y0 + fh / 2, front - 0.32], [cw - 0.1, fh - 0.4, 1], { mat: 'decorAtlas', uv: lobby, cast: false })
        ctx.glassPanes.push({ position: b.toWorld(x, y0 + fh / 2, front - 0.22), size: [cw - 0.1, fh - 0.4], yaw: b.yaw })
      } else {
        const lit = rng.chance(0.16)
        b.box(lit ? 0xe6edf3 : rng.pick([glass, 0x7a90ab, 0x687f9c]), [x, y0 + fh / 2, front - 0.26], [cw - 0.1, fh - 0.3, 0.05], { mat: lit ? 'glow' : 'glass', cast: false })
      }
    }
    b.box(stone, [0, y0 + 0.05, front - 0.1], [w + 0.1, 0.36, 0.34])
  }
  for (let c = 0; c <= cols; c++) b.box(frame, [-w / 2 + cw * c, H / 2, front - 0.16], [0.1, H, 0.18], { cast: false })
  b.box(frame, [0, H + 0.1, 0], [w + 0.2, 0.4, d + 0.1])
  // top signage band
  b.box(frame, [0, H - 0.9, front - 0.04], [w + 0.05, 1.3, 0.2])
  addSign(ctx, 'NFC SOLUTIONS', { bg: '#2e3035', fg: '#ffffff', shape: 'rect', weight: 700 }, [0, H - 0.9, front + 0.07], 7.4, 0.95)
  // entrance canopy + lettering over the doors
  b.box(frame, [0, 3.7, front + 1.4], [7.2, 0.22, 3.0])
  for (const x of [-3.3, 3.3]) {
    b.add('cyl8', frame, [x, 1.8, front + 2.6], [0.14, 3.6, 0.14], { cast: false })
    b.cylCollider([x, 0, front + 2.6], 0.1, 3.6)
  }
  for (const x of [-2.2, 0, 2.2]) b.box(0xfff6e6, [x, 3.58, front + 1.6], [0.8, 0.03, 0.8], { mat: 'emissive', cast: false })
  addSign(ctx, 'NFC SOLUTIONS', { bg: '#f2f1ee', fg: '#2e3035', shape: 'rect', weight: 700 }, [0, 4.15, front + 0.02], 3.8, 0.42)
  b.box(frame, [-1.0, 1.4, front - 0.12], [0.06, 2.8, 0.1], { cast: false })
  b.box(frame, [1.0, 1.4, front - 0.12], [0.06, 2.8, 0.1], { cast: false })
  // side facades: stone with ribbon windows
  for (const side of [-1, 1]) {
    b.push(side * (w / 2 - 0.1), 0, -0.3, side * Math.PI / 2)
    for (let f = 0; f < floors; f++) {
      const y = (f === 0 ? 0 : gH + (f - 1) * fH) + 1.9
      b.box(frame, [0, y, 0.02], [d - 1.6, 1.8, 0.05], { cast: false })
      b.box(rng.chance(0.3) ? 0xe6edf3 : glass, [0, y, 0.05], [d - 1.8, 1.6, 0.04], { mat: 'glass', cast: false })
    }
    b.pop()
  }
  // roof: mechanical box and planters
  b.box(0xb8b2a6, [-3, H + 1.0, -2], [4, 1.6, 3])
  b.push(4, H + 0.3, 2)
  planter(b, rng, 3, 0.8)
  b.pop()
  // forecourt plaza
  const f0 = b.toWorld(-w / 2 + 0.4, 0, front + 0.3)
  const f1 = b.toWorld(w / 2 - 0.4, 0, front + 6.8)
  ctx.tiles.push({ x0: Math.min(f0[0], f1[0]), x1: Math.max(f0[0], f1[0]), z0: Math.min(f0[2], f1[2]), z1: Math.max(f0[2], f1[2]), y: SIDEWALK_Y })
  for (const sx of [-1, 1]) {
    b.push(sx * 6.6, 0, front + 3.6)
    b.add('rbox', 0xcfc8bb, [0, 0.35, 0], [2.0, 0.7, 2.0])
    b.box(PALETTE.soil, [0, 0.68, 0], [1.7, 0.04, 1.7], { cast: false })
    b.push(0, 0.7, 0)
    tree(ctx, rng, 'tall', 0.95, false)
    b.pop()
    b.collider([0, 0.35, 0], [2.0, 0.7, 2.0])
    b.pop()
    b.push(sx * 4.0, 0, front + 5.4, Math.PI)
    bench(b, 0x6e5140)
    seatAt(ctx, 0, 0.5, 0.02, 0)
    b.pop()
  }
  // monolith sign
  b.push(-5.4, 0, front + 6.3)
  b.box(0x3b3e44, [0, 0.65, 0], [2.4, 1.3, 0.4])
  addSign(ctx, 'NFC SOLUTIONS', { bg: '#3b3e44', fg: '#ffffff', shape: 'rect', weight: 700 }, [0, 0.72, 0.21], 2.0, 0.34)
  b.push(0, 0.72, -0.21, Math.PI)
  addSign(ctx, 'NFC SOLUTIONS', { bg: '#3b3e44', fg: '#ffffff', shape: 'rect', weight: 700 }, [0, 0, 0], 2.0, 0.34)
  b.pop()
  b.collider([0, 0.65, 0], [2.4, 1.3, 0.4])
  b.pop()
  b.push(6.4, 0, front + 6.2, Math.PI)
  bikeRack(b, rng)
  b.pop()
  const [lx, , lz] = b.toWorld(0, 0, front + 2)
  lightPoolAt(ctx, lx, lz, 4.5, 0xf2f4f8)
  b.collider([0, H / 2, 0], [w, H, d])
  b.pop()
}
