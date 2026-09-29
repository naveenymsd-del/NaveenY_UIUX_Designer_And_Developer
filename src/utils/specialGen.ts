import { PALETTE } from '@/data/palette'
import { ARCH_Z, FOUNTAIN_POS, KIOSK_POS, PARK_CENTER, SIDEWALK_Y, facingYaw, type BuildingDef } from '@/data/cityLayout'
import type { ProjectDef } from '@/data/projects'
import {
  addSign, awning, buildSpec, darken, facadeWindows, lighten, lightPoolAt, windowUnit, type GenContext,
} from './buildingGen'
import { bench, cafeTable, flowerBed, hedge, planter, streetLamp, stringLights, tree, vendingMachine, crateStack, bicycle } from './propGen'
import { createRng } from './rng'
import { artPainter, interiorPainter, mapBoardPainter, GREEK_FONT } from './textures'

const LIT = [PALETTE.windowLit, PALETTE.windowLit2, PALETTE.windowLit3]

function seat(ctx: GenContext, lx: number, ly: number, lz: number, localYaw: number, kind: 'bench' | 'chair' | 'ledge') {
  const p = ctx.b.toWorld(lx, ly, lz)
  ctx.seats.push({ position: p, yaw: ctx.b.yaw + localYaw, kind })
}

// ────────────────────────────────────────────────────────────────────────────
// Daily Goods — convenience store with a real 3D interior behind glass
// ────────────────────────────────────────────────────────────────────────────
export function genStore(ctx: GenContext, def: BuildingDef) {
  const { b } = ctx
  const rng = createRng(def.seed)
  const wall = 0xeef7f3
  const teal = PALETTE.teal
  const w = def.w
  const d = def.d
  const H = 5.8
  const front = d / 2
  const roomDepth = 5.4
  const backZ = front - roomDepth
  const roomZ = (backZ + front) / 2
  b.push(def.x, SIDEWALK_Y, def.z, facingYaw(def.facing))
  // shell
  b.box(wall, [0, H / 2, (-d / 2 + backZ) / 2], [w, H, backZ + d / 2])
  b.box(wall, [-w / 2 + 0.25, H / 2, roomZ], [0.5, H, roomDepth])
  b.box(wall, [w / 2 - 0.25, H / 2, roomZ], [0.5, H, roomDepth])
  b.box(wall, [0, 4.2 + (H - 4.2) / 2, roomZ], [w, H - 4.2, roomDepth])
  b.box(darken(wall, 40), [0, 0.18, 0], [w + 0.12, 0.36, d + 0.12], { cast: false })
  // interior (unlit/glow materials so it reads as a bright shop at dusk)
  b.box(0xf4f1ea, [0, 0.07, roomZ], [w - 1, 0.14, roomDepth], { mat: 'glow', cast: false })
  b.box(0xf9fcff, [0, 2.1, backZ + 0.03], [w - 1, 4.1, 0.05], { mat: 'glow', cast: false })
  b.box(0xe9f6f2, [0, 4.15, roomZ], [w - 1, 0.08, roomDepth], { mat: 'glow', cast: false })
  for (let i = 0; i < 3; i++) b.box(0xffffff, [-4 + i * 4, 4.08, roomZ], [2.6, 0.05, 0.28], { mat: 'emissive', cast: false })
  // fridge wall
  for (let i = 0; i < 5; i++) {
    const fx = -5 + i * 1.55
    b.box(0x3b3650, [fx, 1.35, backZ + 0.25], [1.5, 2.6, 0.4], { mat: 'glow', cast: false })
    b.box(0xdff4ff, [fx, 1.4, backZ + 0.47], [1.35, 2.35, 0.03], { mat: 'glow', cast: false })
    for (let r = 0; r < 4; r++)
      for (let c = 0; c < 5; c++)
        b.add('cyl8', rng.pick([0xef8a78, 0x4fb3a9, 0xf5dd92, 0x9fb2e6, 0x7cbf6a, 0xe0506a]), [fx - 0.5 + c * 0.25, 0.55 + r * 0.55, backZ + 0.45], [0.12, 0.34, 0.12], { mat: 'glow', cast: false })
  }
  // shelf gondolas running toward the window
  const gondolaXs = [-4.4, -1.2, 2.0]
  const gz0 = backZ + 1.3
  const gz1 = front - 1.1
  const L = gz1 - gz0
  for (const gx of gondolaXs) {
    b.box(0xffffff, [gx, 0.2, (gz0 + gz1) / 2], [0.95, 0.3, L], { mat: 'glow', cast: false })
    b.box(0xdfe6ee, [gx, 1.0, (gz0 + gz1) / 2], [0.08, 1.6, L], { mat: 'glow', cast: false })
    b.box(teal, [gx, 1.86, (gz0 + gz1) / 2], [0.95, 0.12, L], { mat: 'glow', cast: false })
    for (const side of [-1, 1]) {
      for (let sh = 0; sh < 3; sh++) {
        const y = 0.42 + sh * 0.45
        b.box(0xffffff, [gx + side * 0.26, y, (gz0 + gz1) / 2], [0.42, 0.035, L], { mat: 'glow', cast: false })
        let z = gz0 + 0.1
        while (z < gz1 - 0.15) {
          const pw = rng.range(0.14, 0.3)
          const ph = rng.range(0.14, 0.34)
          b.box(rng.pick([0xef8a78, 0x4fb3a9, 0xf5dd92, 0x9fb2e6, 0xe0506a, 0x7cbf6a, 0xa996d4, 0xf39a4a, 0xffffff]), [gx + side * 0.27, y + ph / 2 + 0.02, z + pw / 2], [0.28, ph, pw * 0.9], { mat: 'glow', cast: false })
          z += pw + 0.03
        }
      }
    }
  }
  // counter + register near the door
  b.box(0xffffff, [5.1, 0.55, front - 2.4], [1.3, 1.1, 2.4], { mat: 'glow', cast: false })
  b.box(teal, [5.1, 1.12, front - 2.4], [1.4, 0.06, 2.5], { mat: 'glow', cast: false })
  b.box(0x3b3650, [5.0, 1.35, front - 2.9], [0.4, 0.4, 0.35], { mat: 'glow', cast: false })
  // storefront frame + glass
  const frameC = PALETTE.charcoal
  b.box(frameC, [0, 0.16, front + 0.02], [w - 0.9, 0.16, 0.12], { cast: false })
  b.box(frameC, [0, 4.2, front + 0.02], [w - 0.9, 0.16, 0.12], { cast: false })
  for (const mx of [-6.2, -3.1, 0, 3.1, 4.1, 6.2]) b.box(frameC, [mx, 2.2, front + 0.02], [0.1, 4.0, 0.12], { cast: false })
  addSign(ctx, 'OPEN', { bg: '#2b2350', fg: '#ff8fc8', shape: 'pill', border: '#ff8fc8' }, [-5.2, 3.3, front - 0.12], 1.1, 0.45)
  ctx.glassPanes.push({ position: b.toWorld(0, 2.2, front + 0.04), size: [w - 1, 4.0], yaw: b.yaw })
  // fascia + signs
  b.box(teal, [0, 5.0, front + 0.12], [w + 0.1, 1.55, 0.26])
  b.box(PALETTE.ivory, [0, 4.25, front + 0.26], [w + 0.1, 0.07, 0.04], { cast: false })
  addSign(ctx, 'DAILY GOODS', { bg: '#4fb3a9', fg: '#ffffff', icon: 'star', shape: 'rect' }, [-1.4, 5.0, front + 0.26], 7.2, 1.05)
  addSign(ctx, '24H', { bg: '#ffffff', fg: '#e0506a', shape: 'round' }, [5.0, 5.0, front + 0.26], 1.5, 1.05)
  // roof
  b.box(PALETTE.ivory, [0, H + 0.1, 0], [w + 0.3, 0.2, d + 0.3])
  b.box(0xb9b1c9, [0, H + 0.22, 0], [w - 0.4, 0.05, d - 0.4], { cast: false })
  b.box(0xe8e4ee, [-3, H + 0.65, -2], [1.4, 0.8, 1.0])
  b.box(0xe8e4ee, [1, H + 0.65, -3], [1.4, 0.8, 1.0])
  // outside dressing
  b.push(-5.8, 0, front + 0.55)
  vendingMachine(b, PALETTE.cherry)
  b.pop()
  b.push(-4.6, 0, front + 0.55)
  vendingMachine(b, PALETTE.cobalt)
  b.pop()
  b.box(0xffffff, [-3.3, 0.45, front + 0.5], [1.1, 0.9, 0.7])
  b.box(PALETTE.sky, [-3.3, 0.7, front + 0.86], [0.9, 0.3, 0.02], { mat: 'glow', cast: false })
  b.collider([-3.3, 0.45, front + 0.5], [1.1, 0.9, 0.7])
  b.push(6.2, 0, front + 0.9, 0.3)
  bicycle(b, rng)
  b.pop()
  const [wx, , wz] = b.toWorld(0, 0, front + 1.8)
  lightPoolAt(ctx, wx, wz, 4.2, 0xcff5ff)
  b.collider([0, H / 2, 0], [w, H, d])
  b.pop()
}

// ────────────────────────────────────────────────────────────────────────────
// Lumen Café — brick corner café with a terrace
// ────────────────────────────────────────────────────────────────────────────
export function genCafe(ctx: GenContext, def: BuildingDef) {
  const { b } = ctx
  const s = buildSpec({ ...def, style: 'shop' })
  s.pal = { wall: PALETTE.cream, trim: PALETTE.ivory, accent: PALETTE.coral, roof: PALETTE.terracotta }
  s.litChance = 0.6
  const rng = createRng(def.seed)
  const w = def.w
  const d = def.d
  const gH = 4.4
  const fH = 3.3
  const H = gH + fH
  s.gH = gH
  s.fH = fH
  s.floors = 2
  s.H = H
  const brick = 0xc47b66
  b.push(def.x, SIDEWALK_Y, def.z, facingYaw(def.facing))
  b.box(PALETTE.cream, [0, H / 2, 0], [w, H, d])
  b.box(brick, [0, gH / 2, 0], [w + 0.08, gH, d + 0.08])
  b.box(darken(brick, 40), [0, 0.2, 0], [w + 0.16, 0.4, d + 0.16], { cast: false })
  // brick coursing on the visible faces
  for (let y = 0.6; y < gH - 0.2; y += 0.34) {
    b.box(darken(brick, 22), [0, y, d / 2 + 0.045], [w + 0.09, 0.035, 0.02], { cast: false })
    b.box(darken(brick, 22), [w / 2 + 0.045, y, 0], [0.02, 0.035, d + 0.09], { cast: false })
  }
  b.box(PALETTE.ivory, [0, gH, 0], [w + 0.2, 0.22, d + 0.2], { cast: false })
  // front ground floor: two arched windows + arched door
  b.push(0, 0, d / 2 + 0.04)
  const intRect = ctx.decor.add(512, 256, interiorPainter('cafe', 3), 'int-cafe-lumen')
  for (const x of [-3.6, 3.6]) {
    b.box(PALETTE.ivory, [x, 1.9, 0.02], [3.0, 2.5, 0.08], { cast: false })
    b.add('plane', 0xffffff, [x, 1.85, 0.08], [2.7, 2.2, 1], { mat: 'decorAtlas', uv: intRect, cast: false })
    b.add('hcyl', PALETTE.ivory, [x, 3.15, 0.02], [3.0, 0.08, 3.0], { rot: [-Math.PI / 2, 0, 0], cast: false })
    b.add('hcyl', PALETTE.windowLit, [x, 3.15, 0.06], [2.7, 0.04, 2.7], { rot: [-Math.PI / 2, 0, 0], mat: 'glow', cast: false })
    b.box(PALETTE.walnut, [x, 3.15, 0.09], [2.7, 0.06, 0.03], { cast: false })
    b.box(PALETTE.ivory, [x, 0.62, 0.14], [3.2, 0.12, 0.26], { cast: false })
    // flower box under each window
    b.box(PALETTE.walnut, [x, 0.4, 0.3], [2.6, 0.3, 0.34])
    for (let i = 0; i < 6; i++) b.add('sphere', rng.pick([0xff8fb1, 0xfff1a8, 0xffffff, 0xef8a78]), [x - 1.1 + i * 0.44, 0.62, 0.32], [0.24, 0.2, 0.24], { cast: false })
  }
  // door
  b.box(PALETTE.ivory, [0, 1.45, 0.02], [2.0, 2.9, 0.08], { cast: false })
  b.box(PALETTE.walnut, [0, 1.35, 0.07], [1.6, 2.6, 0.05], { cast: false })
  b.box(PALETTE.windowLit, [0, 1.6, 0.1], [1.1, 1.6, 0.02], { mat: 'glow', cast: false })
  b.add('hcyl', PALETTE.windowLit2, [0, 2.9, 0.06], [1.6, 0.04, 1.6], { rot: [-Math.PI / 2, 0, 0], mat: 'glow', cast: false })
  // awnings over the openings
  awning(ctx, s, -3.6, 4.05, 3.3, PALETTE.coral, PALETTE.ivory, 'stripe')
  awning(ctx, s, 3.6, 4.05, 3.3, PALETTE.coral, PALETTE.ivory, 'stripe')
  awning(ctx, s, 0, 4.05, 2.2, PALETTE.teal, PALETTE.ivory, 'barrel')
  // sign on the upper facade + hanging round sign
  addSign(ctx, 'Lumen Café', { bg: '#fbf5ea', fg: '#c24f3c', icon: 'cup', shape: 'round', italic: true, border: '#ef8a78', sub: 'coffee · bakes · brunch' }, [0, gH + 1.45, 0.12], 5.0, 1.15, PALETTE.walnut)
  b.pop()
  // upper floor: windows either side of the sign, small balcony under the right one
  b.push(0, 0, d / 2)
  for (const x of [-3.9, 3.9]) windowUnit(ctx, s, x, gH + 1.6, 1.3, 1.7, 'arched', rng.chance(0.6))
  const bx = 3.9
  b.box(PALETTE.ivory, [bx, gH + 0.25, 0.5], [2.4, 0.14, 1.0])
  b.box(PALETTE.charcoal, [bx, gH + 1.2, 0.98], [2.4, 0.06, 0.06], { cast: false })
  for (let i = 0; i <= 8; i++) b.box(PALETTE.charcoal, [bx - 1.2 + i * 0.3, gH + 0.72, 0.98], [0.04, 0.95, 0.04], { cast: false })
  b.add('cyl8', PALETTE.terracotta, [bx - 0.75, gH + 0.55, 0.5], [0.4, 0.45, 0.4])
  b.add('ico', PALETTE.leafA, [bx - 0.75, gH + 1.0, 0.5], [0.7, 0.75, 0.7], { mat: 'foliage' })
  b.pop()
  // side facade (toward the street corner)
  b.push(w / 2, 0, 0, Math.PI / 2)
  for (const x of [-2.5, 2.5]) {
    windowUnit(ctx, s, x, 1.9, 2.0, 1.9, 'pair', true)
    windowUnit(ctx, s, x, gH + 1.6, 1.3, 1.6, 'grid', rng.chance(0.5))
  }
  b.pop()
  b.push(-w / 2, 0, 0, -Math.PI / 2)
  for (const x of [-2.5, 2.5]) windowUnit(ctx, s, x, gH + 1.6, 1.3, 1.6, 'grid', rng.chance(0.5))
  b.pop()
  // rooftop terrace
  b.box(PALETTE.ivory, [0, H + 0.12, 0], [w + 0.3, 0.24, d + 0.3])
  b.box(0xb9b1c9, [0, H + 0.26, 0], [w - 0.4, 0.05, d - 0.4], { cast: false })
  for (const [px, pz] of [[-w / 2 + 0.2, 0], [w / 2 - 0.2, 0]] as const) b.box(PALETTE.charcoal, [px, H + 0.75, pz], [0.06, 0.06, d], { cast: false })
  b.box(PALETTE.charcoal, [0, H + 0.75, d / 2 - 0.2], [w, 0.06, 0.06], { cast: false })
  b.push(-2.5, H + 0.24, 1)
  cafeTable(b, rng, true, PALETTE.teal)
  b.pop()
  b.push(2.5, H + 0.24, 1)
  cafeTable(b, rng, true, PALETTE.mustard)
  b.pop()
  // terrace on the lot in front of the café
  const deckZ0 = d / 2
  const deckZ1 = d / 2 + 6.8
  b.box(0xb88a66, [0, 0.05, (deckZ0 + deckZ1) / 2], [w - 0.4, 0.1, deckZ1 - deckZ0], { cast: false })
  for (let x = -w / 2 + 0.6; x < w / 2 - 0.3; x += 0.55) b.box(darken(0xb88a66, 18), [x, 0.101, (deckZ0 + deckZ1) / 2], [0.03, 0.005, deckZ1 - deckZ0], { cast: false })
  b.collider([0, 0.05, (deckZ0 + deckZ1) / 2], [w - 0.4, 0.1, deckZ1 - deckZ0])
  const tables: [number, number, number][] = [[-3.6, d / 2 + 2.0, PALETTE.coral], [3.6, d / 2 + 2.0, PALETTE.teal], [-3.6, d / 2 + 4.9, PALETTE.mustard], [3.6, d / 2 + 4.9, PALETTE.coral]]
  for (const [tx, tz, uc] of tables) {
    b.push(tx, 0.1, tz, 0)
    cafeTable(b, rng, true, uc)
    b.pop()
    seat(ctx, tx, 0.56, tz + 0.75, Math.PI, 'chair')
    seat(ctx, tx, 0.56, tz - 0.75, 0, 'chair')
  }
  // terrace edge planters with an opening in the middle
  b.push(-3.5, 0.1, deckZ1 - 0.4)
  planter(b, rng, 4.0, 0.7)
  b.pop()
  b.push(3.5, 0.1, deckZ1 - 0.4)
  planter(b, rng, 4.0, 0.7)
  b.pop()
  // string light poles
  for (const px of [-5.7, 5.7]) {
    b.add('cyl8', PALETTE.charcoal, [px, 1.6, deckZ1 - 0.4], [0.1, 3.2, 0.1])
    b.cylCollider([px, 0, deckZ1 - 0.4], 0.12, 3.2)
  }
  stringLights(b, [-5.7, 3.1, deckZ1 - 0.4], [5.7, 3.1, deckZ1 - 0.4], 16, 0.35)
  stringLights(b, [-5.7, 3.1, deckZ1 - 0.4], [-2.0, 4.3, d / 2 + 0.2], 10, 0.35)
  stringLights(b, [5.7, 3.1, deckZ1 - 0.4], [2.0, 4.3, d / 2 + 0.2], 10, 0.35)
  // chalkboard at the terrace entrance
  b.box(PALETTE.charcoal, [1.4, 0.5, deckZ1 + 0.4], [0.62, 0.95, 0.05], { rot: [0.18, 0, 0] })
  b.box(PALETTE.charcoal, [1.4, 0.5, deckZ1 + 0.2], [0.62, 0.95, 0.05], { rot: [-0.18, 0, 0] })
  b.box(0xfff6e0, [1.4, 0.56, deckZ1 + 0.44], [0.44, 0.34, 0.01], { mat: 'glow', rot: [0.18, 0, 0], cast: false })
  const [lx, , lz] = b.toWorld(0, 0, d / 2 + 3.5)
  lightPoolAt(ctx, lx, lz, 5, 0xffc590)
  b.collider([0, H / 2, 0], [w, H, d])
  b.pop()
}

// ────────────────────────────────────────────────────────────────────────────
// Reverie Gallery — minimal white volume with a cantilevered exhibition box
// ────────────────────────────────────────────────────────────────────────────
export function genGallery(ctx: GenContext, def: BuildingDef) {
  const { b } = ctx
  const w = def.w
  const d = def.d
  const white = 0xfbf8f4
  const upper = 0xece7f2
  const H = 9.8
  b.push(def.x, SIDEWALK_Y, def.z, facingYaw(def.facing))
  // ground body (recessed lobby)
  b.box(white, [0, 2.1, -1.2], [w, 4.2, d - 2.4])
  b.box(0xd9d2e3, [0, 0.12, 0], [w + 0.1, 0.24, d], { cast: false })
  // pillars supporting the cantilever
  for (const sx of [-1, 1]) b.box(white, [sx * (w / 2 - 1.3), 2.1, d / 2 - 1.2], [2.6, 4.2, 2.4])
  const gal = ctx.decor.add(512, 256, interiorPainter('gallery', 1), 'int-gallery')
  b.add('plane', 0xffffff, [0, 2.0, d / 2 - 2.38], [w - 5.4, 3.5, 1], { mat: 'decorAtlas', uv: gal, cast: false })
  ctx.glassPanes.push({ position: b.toWorld(0, 2.0, d / 2 - 2.2), size: [w - 5.4, 3.7], yaw: b.yaw })
  for (let i = 0; i <= 4; i++) b.box(PALETTE.charcoal, [-(w - 5.4) / 2 + ((w - 5.4) / 4) * i, 2.0, d / 2 - 2.18], [0.08, 3.7, 0.08], { cast: false })
  // upper exhibition volume
  b.box(upper, [0, 4.2 + (H - 4.2) / 2, 0.2], [w + 0.4, H - 4.2, d + 0.4])
  b.box(PALETTE.charcoal, [0, 4.22, 0.2], [w + 0.5, 0.16, d + 0.5], { cast: false })
  const palettes = [
    ['#f6ecdc', '#ef8a78', '#2f3fb8', '#f5dd92'],
    ['#2b2350', '#ff8fb1', '#9fb2e6', '#f5dd92'],
    ['#bfe3cf', '#2f3fb8', '#e0506a', '#fbf5ea'],
  ]
  for (let i = 0; i < 3; i++) {
    const x = -5.8 + i * 5.8
    const rect = ctx.decor.add(320, 360, artPainter(900 + i * 7, palettes[i]), `art-gal-${i}`)
    b.box(PALETTE.charcoal, [x, 6.8, d / 2 + 0.45], [3.4, 3.8, 0.1])
    b.add('plane', 0xffffff, [x, 6.8, d / 2 + 0.51], [3.1, 3.5, 1], { mat: 'decorAtlas', uv: rect, cast: false })
    b.box(PALETTE.charcoal, [x, 8.95, d / 2 + 0.8], [0.3, 0.12, 0.6], { cast: false })
    b.box(PALETTE.lamp, [x, 8.88, d / 2 + 1.05], [0.26, 0.06, 0.16], { mat: 'emissive', cast: false })
  }
  addSign(ctx, 'REVERIE GALLERY', { bg: '#ece7f2', fg: '#2b2350', shape: 'rect', weight: 600 }, [0, 9.25, d / 2 + 0.42], 7.5, 0.7)
  // banners on the pillars
  for (const sx of [-1, 1]) {
    const rect = ctx.decor.add(160, 400, artPainter(970 + sx, ['#e0506a', '#fbf5ea', '#2f3fb8', '#f5dd92']), `banner-${sx}`)
    b.box(PALETTE.charcoal, [sx * (w / 2 - 1.3), 3.95, d / 2 + 0.08], [1.7, 0.06, 0.06], { cast: false })
    b.add('plane', 0xffffff, [sx * (w / 2 - 1.3), 2.35, d / 2 + 0.06], [1.5, 3.2, 1], { mat: 'decorAtlas', uv: rect, cast: false })
  }
  // side slit windows
  for (const sx of [-1, 1]) {
    b.push(sx * (w / 2 + 0.2), 0, 0, sx * Math.PI / 2)
    for (let i = 0; i < 4; i++) b.box(0x8aa2d2, [-d / 2 + 2 + i * 3.8, 6.9, 0.03], [0.5, 4.2, 0.06], { mat: 'glass', cast: false })
    b.pop()
  }
  // roof + skylights
  b.box(PALETTE.ivory, [0, H + 0.1, 0.2], [w + 0.6, 0.2, d + 0.6])
  for (let i = 0; i < 3; i++) b.add('prism', 0x9fb2e6, [-5 + i * 5, H + 0.6, 0], [3, 0.8, 5], { mat: 'glass' })
  // sculpture in the forecourt
  b.push(6.5, 0, d / 2 + 1.7)
  b.box(PALETTE.ivory, [0, 0.4, 0], [1.3, 0.8, 1.3])
  b.add('torus', PALETTE.cobalt, [0, 1.75, 0], [1.9, 1.9, 2.5], { rot: [0, 0.6, 0], mat: 'gloss' })
  b.add('sphere', PALETTE.coral, [0.1, 1.2, 0], [0.8, 0.8, 0.8], { mat: 'gloss' })
  b.add('box', PALETTE.mustard, [-0.1, 2.85, 0], [0.55, 0.55, 0.55], { rot: [0.6, 0.4, 0.6], mat: 'gloss' })
  b.collider([0, 1.2, 0], [1.4, 2.4, 1.4])
  b.pop()
  const [lx, , lz] = b.toWorld(0, 0, d / 2 + 1.8)
  lightPoolAt(ctx, lx, lz, 4.5, 0xffe0c0)
  b.collider([0, H / 2, 0], [w, H, d])
  b.pop()
}

// ────────────────────────────────────────────────────────────────────────────
// Project Studio — glass curtain wall with coloured fins
// ────────────────────────────────────────────────────────────────────────────
export function genStudio(ctx: GenContext, def: BuildingDef) {
  const { b } = ctx
  const rng = createRng(def.seed)
  const w = def.w
  const d = def.d
  const gH = 4.4
  const fH = 3.4
  const floors = 3
  const H = gH + fH * (floors - 1)
  const frame = PALETTE.charcoal
  b.push(def.x, SIDEWALK_Y, def.z, facingYaw(def.facing))
  b.box(0xd9d2ea, [0, H / 2, -0.3], [w - 0.4, H, d - 0.6])
  b.box(0x5e5878, [0, 0.15, 0], [w + 0.1, 0.3, d], { cast: false })
  const studioInt = ctx.decor.add(512, 256, interiorPainter('studio', 2), 'int-studio')
  const cols = 6
  const pw = w / cols
  for (let f = 0; f < floors; f++) {
    const base = f === 0 ? 0 : gH + (f - 1) * fH
    const fh = f === 0 ? gH : fH
    for (let c = 0; c < cols; c++) {
      const x = -w / 2 + pw * (c + 0.5)
      if (f === 0) {
        if (c === 2 || c === 3) continue
        b.add('plane', 0xffffff, [x, base + fh / 2, d / 2 - 0.3], [pw - 0.15, fh - 0.5, 1], { mat: 'decorAtlas', uv: studioInt, cast: false })
      } else {
        const lit = rng.chance(0.5)
        b.box(lit ? rng.pick(LIT) : 0x9fa9dd, [x, base + fh / 2, d / 2 - 0.28], [pw - 0.15, fh - 0.4, 0.06], { mat: lit ? 'glow' : 'glass', cast: false })
      }
    }
    b.box(frame, [0, base + 0.02, d / 2 - 0.12], [w + 0.1, 0.3, 0.4])
  }
  b.box(frame, [0, H, d / 2 - 0.12], [w + 0.1, 0.35, 0.45])
  // coloured fins
  const finColors = [PALETTE.lilac, PALETTE.periwinkle, PALETTE.coral, PALETTE.butter, PALETTE.teal, PALETTE.lilac, PALETTE.periwinkle]
  for (let c = 0; c <= cols; c++) {
    const x = -w / 2 + pw * c
    b.box(finColors[c % finColors.length], [x, H / 2 + 0.2, d / 2 + 0.2], [0.2, H - 0.2, 0.9], { mat: 'gloss' })
  }
  // entrance
  b.box(0x9fa9dd, [0, 1.35, d / 2 - 0.25], [pw * 2 - 0.3, 2.7, 0.06], { mat: 'glass', cast: false })
  b.box(rng.pick(LIT), [0, 1.3, d / 2 - 0.3], [pw * 2 - 0.5, 2.5, 0.02], { mat: 'glow', cast: false })
  b.box(frame, [0, 1.35, d / 2 - 0.2], [0.08, 2.7, 0.08], { cast: false })
  b.box(PALETTE.lilac, [0, 3.2, d / 2 + 0.7], [pw * 2 + 0.6, 0.16, 1.6])
  b.box(PALETTE.lilac, [0, gH - 0.15, d / 2 + 0.32], [w + 0.1, 0.8, 0.22])
  addSign(ctx, 'PROJECT STUDIO', { bg: '#a996d4', fg: '#ffffff', shape: 'rect', weight: 800 }, [0, gH - 0.15, d / 2 + 0.44], 6.4, 0.66)
  // side ribbon windows
  for (const sx of [-1, 1]) {
    b.push(sx * (w / 2 - 0.2), 0, -0.3, sx * Math.PI / 2)
    for (let f = 0; f < floors; f++) {
      const y = (f === 0 ? 0 : gH + (f - 1) * fH) + 1.8
      b.box(0x3b3650, [0, y, 0.02], [d - 1.2, 1.6, 0.04], { cast: false })
      b.box(rng.chance(0.5) ? rng.pick(LIT) : 0x9fa9dd, [0, y, 0.05], [d - 1.4, 1.4, 0.04], { mat: rng.chance(0.5) ? 'glow' : 'glass', cast: false })
    }
    b.pop()
  }
  // rooftop terrace
  b.box(PALETTE.ivory, [0, H + 0.1, -0.3], [w, 0.2, d - 0.4])
  for (const sx of [-1, 1]) b.box(0xb8d4ef, [sx * (w / 2 - 0.2), H + 0.7, -0.3], [0.05, 1.0, d - 0.6], { mat: 'glass', cast: false })
  b.box(0xb8d4ef, [0, H + 0.7, d / 2 - 0.55], [w - 0.4, 1.0, 0.05], { mat: 'glass', cast: false })
  b.push(-4, H + 0.2, -1)
  tree(ctx, rng, 'round', 0.7, false)
  b.pop()
  b.push(3.5, H + 0.2, -2)
  planter(b, rng, 3, 0.8)
  b.pop()
  const [lx, , lz] = b.toWorld(0, 0, d / 2 + 2)
  lightPoolAt(ctx, lx, lz, 4, 0xe8d8ff)
  b.collider([0, H / 2, 0], [w, H, d])
  b.pop()
}

// ────────────────────────────────────────────────────────────────────────────
// Experience Center — the landmark at the top of the avenue
// ────────────────────────────────────────────────────────────────────────────
export function genExperience(ctx: GenContext, def: BuildingDef) {
  const { b } = ctx
  const s = buildSpec({ ...def, style: 'apartment', floors: 2 })
  s.pal = { wall: PALETTE.ivory, trim: PALETTE.cobalt, accent: PALETTE.cobalt, roof: PALETTE.periwinkle }
  s.gH = 4.8
  s.fH = 4.8
  s.floors = 2
  s.H = 9.6
  s.litChance = 0.55
  const w = def.w
  const d = def.d
  const H = 9.6
  b.push(def.x, SIDEWALK_Y, def.z, facingYaw(def.facing))
  b.box(PALETTE.ivory, [0, H / 2, 0], [w, H, d])
  b.box(0xcfc6e6, [0, 0.2, 0], [w + 0.14, 0.4, d + 0.14], { cast: false })
  b.box(PALETTE.cobalt, [0, H + 0.3, 0], [w + 0.3, 0.6, d + 0.3])
  b.box(PALETTE.cobalt, [0, 4.8, 0], [w + 0.2, 0.2, d + 0.2], { cast: false })
  addSign(ctx, 'EXPERIENCE CENTER', { bg: '#2f3fb8', fg: '#ffffff', shape: 'rect', weight: 800 }, [0, H + 0.3, d / 2 + 0.16], 9, 0.52)
  // atrium
  const atrium = ctx.decor.add(512, 256, interiorPainter('studio', 4), 'int-experience')
  b.add('plane', 0xffffff, [0, 3.0, d / 2 + 0.02], [11.6, 5.6, 1], { mat: 'decorAtlas', uv: atrium, cast: false })
  ctx.glassPanes.push({ position: b.toWorld(0, 3.0, d / 2 + 0.1), size: [11.8, 5.8], yaw: b.yaw })
  for (let i = 0; i <= 6; i++) b.box(PALETTE.cobalt, [-5.9 + i * (11.8 / 6), 3.0, d / 2 + 0.12], [0.1, 5.8, 0.1], { cast: false })
  b.box(PALETTE.cobalt, [0, 5.95, d / 2 + 0.12], [12, 0.16, 0.14], { cast: false })
  // side wings
  for (const sx of [-1, 1]) {
    b.push(sx * 9.5, 0, d / 2)
    facadeWindows(ctx, s, 6.5, { groundFloor: true, primary: false, style: 'tall', balconies: false })
    b.pop()
  }
  for (const side of [-1, 1]) {
    b.push(side * (w / 2), 0, 0, side * Math.PI / 2)
    facadeWindows(ctx, s, d, { groundFloor: true, primary: false, style: 'grid', balconies: false })
    b.pop()
  }
  // screen above the atrium
  b.box(PALETTE.charcoal, [0, 7.7, d / 2 + 0.1], [12.4, 3.2, 0.2])
  ctx.screens.push({ position: b.toWorld(0, 7.7, d / 2 + 0.22), yaw: b.yaw, width: 12, height: 2.8, variant: 0 })
  // steps
  b.box(0xe9e2f0, [0, 0.06, d / 2 + 0.75], [14, 0.12, 0.5])
  b.box(0xe9e2f0, [0, 0.12, d / 2 + 0.25], [14, 0.24, 0.5])
  b.collider([0, 0.06, d / 2 + 0.75], [14, 0.12, 0.5])
  b.collider([0, 0.12, d / 2 + 0.25], [14, 0.24, 0.5])
  // tower
  const tz = -2
  const tr = 10.4
  b.add('cyl', PALETTE.ivory, [0, H + 0.9, tz], [tr + 1, 0.6, tr + 1])
  for (let i = 0; i < 6; i++) {
    const y = H + 1.2 + i * 3
    b.add('cyl', 0x7f96d6, [0, y + 1.3, tz], [tr, 2.6, tr], { mat: 'glass' })
    b.add('cyl', PALETTE.ivory, [0, y + 2.75, tz], [tr + 0.35, 0.34, tr + 0.35])
  }
  const top = H + 1.2 + 18
  b.add('sphere', PALETTE.cobalt, [0, top, tz], [tr + 0.2, 7, tr + 0.2], { mat: 'gloss' })
  b.add('torus', PALETTE.butter, [0, top + 0.3, tz], [tr + 0.8, tr + 0.8, 2], { rot: [Math.PI / 2, 0, 0], mat: 'gloss' })
  b.add('cyl8', PALETTE.slate, [0, top + 5, tz], [0.2, 4, 0.2], { cast: false })
  b.add('sphere', 0xff6f7d, [0, top + 7.1, tz], [0.45, 0.45, 0.45], { mat: 'emissive', cast: false })
  b.box(PALETTE.lamp, [0, H + 10, tz + tr / 2 + 0.05], [0.35, 17, 0.1], { mat: 'emissive', cast: false })
  ctx.lamps.push(b.toWorld(0, top + 7.1, tz))
  // flags along the forecourt
  const flagColors = [PALETTE.coral, PALETTE.butter, PALETTE.teal, PALETTE.lilac]
  const fxs = [-11.2, -8.2, 8.2, 11.2]
  fxs.forEach((fx, i) => {
    b.add('cyl8', PALETTE.slate, [fx, 3.5, d / 2 + 1.4], [0.12, 7, 0.12])
    b.box(flagColors[i], [fx + 0.8, 6.3, d / 2 + 1.4], [1.5, 1.0, 0.04], { mat: 'fabric', rot: [0, 0.12, 0] })
    b.cylCollider([fx, 0, d / 2 + 1.4], 0.15, 7)
  })
  const [lx, , lz] = b.toWorld(0, 0, d / 2 + 2.5)
  lightPoolAt(ctx, lx, lz, 6, 0xd8e0ff)
  b.collider([0, H / 2, 0], [w, H, d])
  b.pop()
}

// ────────────────────────────────────────────────────────────────────────────
// Entry promenade: information kiosk, welcome arch, bollards
// ────────────────────────────────────────────────────────────────────────────
export function genEntry(ctx: GenContext) {
  const { b } = ctx
  const rng = createRng(77)
  // kiosk
  b.push(KIOSK_POS[0], SIDEWALK_Y, KIOSK_POS[1])
  b.add('cyl', PALETTE.cobalt, [0, 0.55, 0], [2.4, 1.1, 2.4])
  b.add('cyl', 0x9fb2e6, [0, 1.6, 0], [2.3, 1.0, 2.3], { mat: 'glass' })
  b.add('cyl', PALETTE.windowLit, [0, 1.6, 0], [2.0, 0.9, 2.0], { mat: 'glow', cast: false })
  b.add('cyl', PALETTE.ivory, [0, 2.2, 0], [3.2, 0.22, 3.2])
  b.add('sphere', PALETTE.cobalt, [0, 2.35, 0], [2.6, 1.0, 2.6], { mat: 'gloss' })
  b.add('cyl8', PALETTE.ivory, [0, 3.0, 0], [0.12, 1.2, 0.12], { cast: false })
  b.push(0, 3.8, 0, -Math.PI / 2)
  addSign(ctx, 'INFO', { bg: '#ffffff', fg: '#2f3fb8', shape: 'pill', icon: 'star' }, [0, 0, 0.02], 1.4, 0.5, PALETTE.cobalt)
  b.pop()
  b.push(0, 3.8, 0, Math.PI / 2)
  addSign(ctx, 'INFO', { bg: '#ffffff', fg: '#2f3fb8', shape: 'pill', icon: 'star' }, [0, 0, 0.02], 1.4, 0.5, null)
  b.pop()
  b.cylCollider([0, 0, 0], 1.25, 2.4)
  // map board facing the promenade
  b.push(-1.7, 0, 1.4, -Math.PI / 2 + 0.5)
  b.box(PALETTE.charcoal, [-0.7, 1.0, 0], [0.1, 2.0, 0.1])
  b.box(PALETTE.charcoal, [0.7, 1.0, 0], [0.1, 2.0, 0.1])
  const map = ctx.decor.add(256, 256, mapBoardPainter(), 'mapboard')
  b.box(PALETTE.ivory, [0, 1.5, 0], [1.6, 1.3, 0.08])
  b.add('plane', 0xffffff, [0, 1.5, 0.05], [1.45, 1.15, 1], { mat: 'decorAtlas', uv: map, cast: false })
  b.collider([0, 1.0, 0], [1.6, 2.0, 0.2])
  b.pop()
  b.pop()
  // welcome arch
  b.push(0, SIDEWALK_Y, ARCH_Z)
  for (const sx of [-7.4, 7.4]) {
    b.add('rbox', PALETTE.cream, [sx, 3.1, 0], [1.1, 6.2, 1.1])
    for (let i = 0; i < 3; i++) b.box(PALETTE.cobalt, [sx, 1 + i * 1.8, 0], [1.16, 0.16, 1.16], { cast: false })
    b.add('sphere', PALETTE.coral, [sx, 6.65, 0], [0.9, 0.9, 0.9], { mat: 'gloss' })
    b.collider([sx, 3.1, 0], [1.1, 6.2, 1.1])
    b.push(sx, 0, 0)
    planter(b, rng, 1.2, 1.2)
    b.pop()
  }
  b.box(PALETTE.cobalt, [0, 5.6, 0], [15.4, 1.3, 0.6])
  b.collider([0, 5.6, 0], [15.4, 1.3, 0.6])
  b.box(PALETTE.ivory, [0, 6.32, 0], [15.6, 0.14, 0.7], { cast: false })
  const sign = { bg: '#2f3fb8', fg: '#ffffff', shape: 'rect' as const, font: GREEK_FONT, weight: 800 }
  addSign(ctx, 'MINDSCAPE AVENUE', sign, [0, 5.6, 0.31], 9.5, 1.05)
  b.push(0, 5.6, -0.31, Math.PI)
  addSign(ctx, 'SEE YOU SOON', { ...sign, font: undefined }, [0, 0, 0], 7, 0.9)
  b.pop()
  stringLights(b, [-7.4, 4.9, 0.4], [7.4, 4.9, 0.4], 22, 0.9)
  b.pop()
  // pedestrian bollards where the promenade meets the street
  for (let x = -6; x <= 6; x += 3) {
    b.push(x, SIDEWALK_Y, 55.2)
    b.add('cyl8', PALETTE.charcoal, [0, 0.4, 0], [0.22, 0.8, 0.22])
    b.add('cyl8', PALETTE.butter, [0, 0.72, 0], [0.24, 0.08, 0.24], { mat: 'emissive', cast: false })
    b.cylCollider([0, 0, 0], 0.14, 0.9)
    b.pop()
  }
  // promenade dressing: planters with trees and benches
  const promenade: [number, number][] = [[-6.2, 61], [6.2, 61], [-6.2, 68], [-6.2, 84], [6.2, 84]]
  for (const [x, z] of promenade) {
    b.push(x, SIDEWALK_Y, z)
    b.add('cyl', 0xe8e0ee, [0, 0.3, 0], [1.8, 0.6, 1.8])
    b.box(PALETTE.soil, [0, 0.58, 0], [1.4, 0.04, 1.4], { cast: false })
    b.push(0, 0.6, 0)
    tree(ctx, rng, rng.pick(['blossom', 'round', 'gold'] as const), 0.9, false)
    b.pop()
    b.cylCollider([0, 0, 0], 0.9, 0.7)
    b.pop()
  }
  for (const [x, z, yaw] of [[-6.4, 72.5, Math.PI / 2], [6.4, 79, -Math.PI / 2], [-6.4, 79.5, Math.PI / 2]] as const) {
    b.push(x, SIDEWALK_Y, z, yaw)
    bench(b, PALETTE.walnut)
    seat(ctx, 0, 0.5, 0.02, 0, 'bench')
    b.pop()
  }
  for (const [x, z] of [[-6.6, 65], [6.6, 65], [-6.6, 88], [6.6, 88]] as const) {
    b.push(x, SIDEWALK_Y, z)
    streetLamp(ctx, rng, 'classic')
    b.pop()
  }
}

// ────────────────────────────────────────────────────────────────────────────
// Project Plaza: fountain, benches, trees and five project pavilions
// ────────────────────────────────────────────────────────────────────────────
export function genPlaza(ctx: GenContext, projects: ProjectDef[]) {
  const { b } = ctx
  const rng = createRng(31)
  const [fx, fz] = FOUNTAIN_POS
  ctx.tiles.push({ x0: 9, x1: 30, z0: -42, z1: -8, y: SIDEWALK_Y })
  // fountain
  b.push(fx, SIDEWALK_Y, fz)
  const segs = 22
  for (let i = 0; i < segs; i++) {
    const a = (i / segs) * Math.PI * 2
    b.add('rbox', 0xe9e2f0, [Math.cos(a) * 4, 0.3, Math.sin(a) * 4], [1.25, 0.6, 0.55], { rot: [0, -a + Math.PI / 2, 0] })
  }
  b.add('cyl', 0x6f98d6, [0, 0.1, 0], [7.8, 0.12, 7.8], { cast: false })
  b.add('cyl', 0xe9e2f0, [0, 0.9, 0], [0.9, 1.6, 0.9])
  b.add('sphere', 0xe9e2f0, [0, 1.75, 0], [3.2, 0.7, 3.2])
  b.add('cyl', 0x6f98d6, [0, 1.95, 0], [2.6, 0.05, 2.6], { cast: false })
  b.add('cyl', 0xe9e2f0, [0, 2.4, 0], [0.36, 1.0, 0.36])
  b.add('sphere', PALETTE.coral, [0, 3.0, 0], [0.7, 0.7, 0.7], { mat: 'gloss' })
  b.cylCollider([0, 0, 0], 4.3, 0.6)
  b.cylCollider([0, 0, 0], 1.6, 3)
  b.pop()
  ctx.waters.push({ x: fx, z: fz, r: 3.75, y: SIDEWALK_Y + 0.46, kind: 'fountain' })
  ctx.waters.push({ x: fx, z: fz, r: 1.3, y: SIDEWALK_Y + 1.98, kind: 'fountain' })
  // benches around the fountain
  for (const deg of [30, 90, 150, 210, 270, 330]) {
    const a = (deg * Math.PI) / 180
    const x = fx + Math.cos(a) * 6.8
    const z = fz + Math.sin(a) * 6.8
    const yaw = Math.atan2(fx - x, fz - z)
    b.push(x, SIDEWALK_Y, z, yaw)
    bench(b, deg % 60 === 30 ? PALETTE.walnut : PALETTE.cocoa)
    seat(ctx, 0, 0.5, 0.02, 0, 'bench')
    b.pop()
  }
  // trees in round planters
  for (const [x, z, k] of [[10.5, -31, 'round'], [10.5, -19, 'blossom'], [28.6, -33.5, 'gold'], [28.6, -16.5, 'round']] as const) {
    b.push(x, SIDEWALK_Y, z)
    b.add('cyl', 0xe8e0ee, [0, 0.35, 0], [2.2, 0.7, 2.2])
    b.box(PALETTE.soil, [0, 0.68, 0], [1.7, 0.04, 1.7], { cast: false })
    b.push(0, 0.7, 0)
    tree(ctx, rng, k, 1.05, false)
    b.pop()
    b.cylCollider([0, 0, 0], 1.1, 0.8)
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2
      b.add('sphere', rng.pick([0xff8fb1, 0xfff1a8, 0xffffff]), [Math.cos(a) * 0.75, 0.8, Math.sin(a) * 0.75], [0.2, 0.18, 0.2], { cast: false })
    }
    b.pop()
  }
  for (const [x, z] of [[11, -42], [27, -42], [11, -8.4], [27, -8.4]] as const) {
    b.push(x, SIDEWALK_Y, z, x < 20 ? 0 : Math.PI)
    streetLamp(ctx, rng, 'modern')
    b.pop()
  }
  // pavilions
  projects.forEach((p, i) => {
    b.push(p.position[0], SIDEWALK_Y, p.position[2], p.yaw)
    const accent = p.color
    b.add('cyl', PALETTE.ivory, [0, 0.11, 0], [3.9, 0.22, 3.9])
    b.add('cyl', accent, [0, 0.235, 0], [3.5, 0.03, 3.5], { cast: false })
    b.cylCollider([0, 0, 0], 1.95, 0.22)
    for (let k = 0; k < 4; k++) {
      const a = Math.PI / 4 + (k * Math.PI) / 2
      b.add('cyl8', PALETTE.ivory, [Math.sin(a) * 1.55, 1.75, Math.cos(a) * 1.55], [0.16, 3.1, 0.16])
      b.cylCollider([Math.sin(a) * 1.55, 0, Math.cos(a) * 1.55], 0.12, 3.2)
    }
    b.add('cyl', accent, [0, 3.35, 0], [4.3, 0.26, 4.3], { mat: 'gloss' })
    b.add('cyl', PALETTE.ivory, [0, 3.52, 0], [3.7, 0.1, 3.7])
    b.add('cone', accent, [0, 3.9, 0], [2.2, 0.7, 2.2], { mat: 'gloss' })
    b.add('sphere', PALETTE.ivory, [0, 4.3, 0], [0.3, 0.3, 0.3])
    b.add('disk', lighten(accent, 30), [0, 3.21, 0], [3.6, 1, 3.6], { rot: [Math.PI, 0, 0], mat: 'glow', cast: false })
    // display totem
    b.box(PALETTE.ivory, [0, 1.4, -0.35], [1.6, 2.4, 0.36])
    b.box(accent, [0, 2.66, -0.35], [1.66, 0.12, 0.4], { cast: false })
    const pal = ['#' + accent.toString(16).padStart(6, '0'), '#fbf5ea', '#2b2350', '#f5dd92', '#2f3fb8']
    const art = ctx.decor.add(256, 256, artPainter(300 + i * 13, [pal[1], pal[0], pal[2], pal[3], pal[4]]), `proj-art-${p.id}`)
    b.add('plane', 0xffffff, [0, 1.75, -0.16], [1.3, 1.3, 1], { mat: 'decorAtlas', uv: art, cast: false })
    addSign(ctx, p.number, { bg: '#2b2350', fg: pal[0], shape: 'round', weight: 800 }, [0, 0.72, -0.16], 0.8, 0.5)
    b.collider([0, 1.3, -0.35], [1.7, 2.6, 0.5])
    b.push(0, 3.35, 2.16)
    addSign(ctx, `PROJECT ${p.number}`, { bg: pal[0], fg: '#ffffff', shape: 'pill', weight: 800 }, [0, 0, 0], 2.2, 0.26, null)
    b.pop()
    const [lx, , lz] = b.toWorld(0, 0, 0.8)
    lightPoolAt(ctx, lx, lz, 2.6, lighten(accent, 40))
    b.pop()
  })
}

// ────────────────────────────────────────────────────────────────────────────
// Juniper Park: lawns, paths, gazebo, pond, lookout deck with stairs & ramp
// ────────────────────────────────────────────────────────────────────────────
export function genPark(ctx: GenContext) {
  const { b } = ctx
  const rng = createRng(2024)
  const [cx, cz] = PARK_CENTER
  const lawnY = SIDEWALK_Y + 0.1
  const lawns = [
    { x0: -42, x1: -27.2, z0: 8, z1: 23.3 },
    { x0: -23.8, x1: -9, z0: 8, z1: 23.3 },
    { x0: -42, x1: -27.2, z0: 26.7, z1: 42 },
    { x0: -23.8, x1: -9, z0: 26.7, z1: 42 },
  ]
  for (const l of lawns) {
    ctx.lawns.push({ ...l, y: lawnY })
    b.inWorld(() => b.collider([(l.x0 + l.x1) / 2, SIDEWALK_Y + 0.05, (l.z0 + l.z1) / 2], [l.x1 - l.x0, 0.1, l.z1 - l.z0]))
  }
  // round plaza with gazebo
  b.push(cx, SIDEWALK_Y, cz)
  b.add('cyl', 0xeadbe6, [0, 0.07, 0], [11.4, 0.14, 11.4], { cast: false })
  b.add('torus', 0xd6c3d8, [0, 0.14, 0], [11.4, 11.4, 1.2], { rot: [Math.PI / 2, 0, 0], cast: false })
  b.cylCollider([0, 0, 0], 5.7, 0.14)
  b.add('cyl', PALETTE.ivory, [0, 0.25, 0], [6.4, 0.24, 6.4])
  b.cylCollider([0, 0, 0], 3.2, 0.37)
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2 + Math.PI / 8
    b.add('cyl8', PALETTE.ivory, [Math.cos(a) * 2.8, 1.9, Math.sin(a) * 2.8], [0.2, 3.1, 0.2])
    b.cylCollider([Math.cos(a) * 2.8, 0, Math.sin(a) * 2.8], 0.14, 3.4)
    if (k % 2 === 0) b.box(PALETTE.walnut, [Math.cos(a + Math.PI / 8) * 2.6, 0.75, Math.sin(a + Math.PI / 8) * 2.6], [1.6, 0.08, 0.45], { rot: [0, -a - Math.PI / 8 + Math.PI / 2, 0] })
  }
  b.add('cyl', PALETTE.ivory, [0, 3.5, 0], [6.8, 0.2, 6.8])
  b.add('cone6', PALETTE.lilac, [0, 4.5, 0], [7.6, 1.9, 7.6], { rot: [0, Math.PI / 6, 0] })
  b.add('sphere', PALETTE.butter, [0, 5.6, 0], [0.4, 0.4, 0.4], { mat: 'gloss' })
  stringLights(b, [-2.8, 3.3, 0], [2.8, 3.3, 0], 12, 0.2)
  b.pop()
  // pond (north-west quadrant)
  const pond = { x: -34.6, z: 34.4, r: 3.6 }
  b.push(pond.x, lawnY, pond.z)
  for (let i = 0; i < 18; i++) {
    const a = (i / 18) * Math.PI * 2
    b.add('dodeca', rng.pick([0xd6cfd9, 0xc9c1d3, 0xe3dde8]), [Math.cos(a) * pond.r, 0.1, Math.sin(a) * pond.r], [rng.range(0.6, 0.9), rng.range(0.35, 0.55), rng.range(0.6, 0.9)], { rot: [rng.range(0, 1), a, 0] })
  }
  b.add('cyl', 0x5f8fd0, [0, -0.02, 0], [pond.r * 2, 0.06, pond.r * 2], { cast: false })
  for (let i = 0; i < 5; i++) b.add('disk', 0x6fbf6a, [rng.range(-2, 2), 0.1, rng.range(-2, 2)], [0.6, 1, 0.6], { cast: false })
  b.cylCollider([0, 0, 0], pond.r + 0.2, 0.7)
  b.pop()
  ctx.waters.push({ x: pond.x, z: pond.z, r: pond.r - 0.2, y: lawnY + 0.06, kind: 'pond' })
  // lookout deck with stairs and ramp (south-east quadrant)
  const deck = { x: -15.5, z: 36, w: 6, d: 5, h: 1.25 }
  b.push(deck.x, lawnY, deck.z)
  b.box(0xc49a6c, [0, deck.h / 2, 0], [deck.w, deck.h, deck.d])
  b.box(0xd8b088, [0, deck.h + 0.03, 0], [deck.w + 0.1, 0.06, deck.d + 0.1], { cast: false })
  b.collider([0, deck.h / 2, 0], [deck.w, deck.h, deck.d])
  // railings on the south and east sides
  for (let i = 0; i <= 12; i++) b.box(PALETTE.walnut, [-deck.w / 2 + (deck.w / 12) * i, deck.h + 0.5, deck.d / 2 - 0.05], [0.07, 1.0, 0.07], { cast: false })
  b.box(PALETTE.walnut, [0, deck.h + 1.0, deck.d / 2 - 0.05], [deck.w, 0.08, 0.1])
  b.collider([0, deck.h + 0.5, deck.d / 2 - 0.05], [deck.w, 1.0, 0.15])
  for (let i = 0; i <= 10; i++) b.box(PALETTE.walnut, [deck.w / 2 - 0.05, deck.h + 0.5, -deck.d / 2 + (deck.d / 10) * i], [0.07, 1.0, 0.07], { cast: false })
  b.box(PALETTE.walnut, [deck.w / 2 - 0.05, deck.h + 1.0, 0], [0.1, 0.08, deck.d])
  b.collider([deck.w / 2 - 0.05, deck.h + 0.5, 0], [0.15, 1.0, deck.d])
  // stairs on the west side
  const steps = 6
  const rise = deck.h / steps
  for (let i = 0; i < steps; i++) {
    const x = -deck.w / 2 - 0.2 - (steps - 1 - i) * 0.42
    const h = rise * (i + 1)
    b.box(0xd8b088, [x, h / 2, 0.8], [0.42, h, 2.2])
    b.collider([x, h / 2, 0.8], [0.42, h, 2.2])
  }
  // ramp on the north side, rising toward the deck
  const rampLen = 5.2
  const angle = -Math.atan2(deck.h, rampLen)
  const hyp = Math.hypot(deck.h, rampLen)
  const rz = -deck.d / 2 - rampLen / 2
  b.box(0xd8b088, [1.2, deck.h / 2 - 0.08, rz], [2.2, 0.16, hyp], { rot: [angle, 0, 0] })
  b.collider([1.2, deck.h / 2 - 0.08, rz], [2.2, 0.16, hyp], 0, angle)
  for (const sx of [0.05, 2.35]) b.box(PALETTE.walnut, [sx, deck.h / 2 + 0.45, rz], [0.07, 0.07, hyp], { rot: [angle, 0, 0], cast: false })
  // telescope + bench on the deck
  b.add('cyl8', PALETTE.charcoal, [2.2, deck.h + 0.55, 1.6], [0.1, 1.1, 0.1], { cast: false })
  b.add('cyl', PALETTE.cobalt, [2.2, deck.h + 1.15, 1.7], [0.22, 0.8, 0.22], { rot: [1.2, 0, 0], mat: 'gloss' })
  b.push(-1.3, deck.h, 1.5, Math.PI)
  bench(b, PALETTE.cocoa)
  seat(ctx, 0, 0.5, 0.02, 0, 'bench')
  b.pop()
  b.pop()
  // trees scattered on lawns (avoiding pond & deck)
  const treeSpots: [number, number][] = [
    [-39, 11], [-33, 12.5], [-38.5, 19.5], [-30, 20], [-35.5, 16],
    [-20.5, 11], [-13, 12], [-17, 19], [-11.5, 20.5], [-21.5, 16.5],
    [-39.5, 29.5], [-28.5, 30], [-29.5, 39.5], [-39.5, 40],
    [-21.5, 29.5], [-11, 29], [-21.5, 40],
  ]
  const kinds = ['round', 'blossom', 'gold', 'tall', 'bushy', 'cypress'] as const
  treeSpots.forEach(([x, z], i) => {
    b.push(x + rng.range(-0.6, 0.6), lawnY, z + rng.range(-0.6, 0.6), rng.range(0, 6))
    tree(ctx, rng, kinds[(i * 7 + 3) % kinds.length], rng.range(1.0, 1.3), false)
    b.pop()
  })
  // flower beds along the cross paths
  for (const [x, z, w, d] of [[-38.5, 22.6, 4, 0.8], [-12.5, 22.6, 4, 0.8], [-38.5, 27.4, 4, 0.8], [-12.5, 27.4, 4, 0.8]] as const) {
    b.push(x, lawnY, z)
    flowerBed(b, rng, w, d)
    b.pop()
  }
  // benches along paths
  const pathBenches: [number, number, number][] = [
    [-35, 22.4, 0], [-16, 22.4, 0], [-35, 27.6, Math.PI], [-16, 27.6, Math.PI],
    [-27.8, 14, Math.PI / 2], [-23.2, 18, -Math.PI / 2], [-27.8, 36, Math.PI / 2],
  ]
  for (const [x, z, yaw] of pathBenches) {
    b.push(x, lawnY, z, yaw)
    bench(b, PALETTE.walnut)
    seat(ctx, 0, 0.5, 0.02, 0, 'bench')
    b.pop()
  }
  // lamps along the paths
  for (const [x, z] of [[-27.4, 12], [-23.6, 18], [-27.4, 32], [-23.6, 40], [-35, 23.0], [-16, 27.0]] as const) {
    b.push(x, lawnY, z, rng.range(0, 6))
    streetLamp(ctx, rng, 'classic')
    b.pop()
  }
  // perimeter hedges with gaps at path entrances
  const hedgeRuns: [number, number, number, number][] = [
    // x-center, z-center, length, yaw
    [-35, 7.6, 14, 0], [-16.4, 7.6, 14.5, 0],
    [-35, 42.4, 14, 0], [-16.4, 42.4, 14.5, 0],
    [-42.4, 15.4, 14.5, Math.PI / 2], [-42.4, 34.4, 14.5, Math.PI / 2],
    [-8.6, 15.4, 14.5, Math.PI / 2], [-8.6, 34.4, 14.5, Math.PI / 2],
  ]
  for (const [x, z, len, yaw] of hedgeRuns) {
    b.push(x, SIDEWALK_Y, z, yaw)
    hedge(b, rng, len)
    b.pop()
  }
  // picnic blanket
  b.push(-20, lawnY, 13.5, 0.4)
  b.box(PALETTE.coral, [0, 0.02, 0], [1.8, 0.03, 1.4], { cast: false })
  for (let i = 0; i < 4; i++) b.box(PALETTE.ivory, [-0.675 + i * 0.45, 0.04, 0], [0.18, 0.02, 1.4], { cast: false })
  b.box(PALETTE.walnut, [0.5, 0.18, 0.3], [0.5, 0.3, 0.35])
  b.pop()
  // crates in the café courtyard (adds life to the alley)
  b.push(27.5, SIDEWALK_Y, 27.5, 0.3)
  crateStack(b, rng)
  b.pop()
}
