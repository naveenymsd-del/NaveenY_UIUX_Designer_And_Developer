import { EDU_DESKS, INTERIORS, OFFICE_DESKS, STUDIO, interiorBounds, studioBay, type InteriorDef } from '@/data/interiors'
import { PROJECTS } from '@/data/projects'
import { PALETTE } from '@/data/palette'
import { addSign, lightPoolAt, type GenContext } from './buildingGen'
import type { PartBuilder } from './partBuilder'
import { createRng, type Rng } from './rng'
import { artPainter, screenPainter, windowViewPainter } from './textures'

/**
 * Walk-in rooms: shell (floor, walls, wainscot, ceiling lights, door, painted
 * windows) plus furniture, all batched into the same instanced part system as
 * the street. Animated story objects are rendered separately (StoryProps).
 */

function shell(ctx: GenContext, r: InteriorDef) {
  const { b } = ctx
  const { depth: d, height: h, palette: p } = r
  // the shell spans the whole footprint including any wing
  const bb = interiorBounds(r)
  const w = bb.x1 - bb.x0
  const cx = (bb.x0 + bb.x1) / 2
  const t = 0.3
  b.box(p.floor, [cx, -0.1, 0], [w + 0.6, 0.2, d + 0.6], { cast: false })
  b.collider([cx, -0.1, 0], [w + 0.6, 0.2, d + 0.6])
  if (r.id !== 'office') for (let z = -d / 2 + 0.25; z < d / 2; z += 0.5) b.box(shadeColor(p.floor, -10), [cx, 0.001, z], [w, 0.003, 0.02], { mat: 'paint', cast: false })
  // walls (north / south / west / east) with colliders
  const walls: [number, number, number, number][] = [
    [cx, -d / 2 - t / 2, w + 2 * t, t], [cx, d / 2 + t / 2, w + 2 * t, t], [bb.x0 - t / 2, 0, t, d], [bb.x1 + t / 2, 0, t, d],
  ]
  for (const [x, z, sx, sz] of walls) {
    b.box(p.wall, [x, h / 2, z], [sx, h, sz])
    b.collider([x, h / 2, z], [sx, h, sz])
  }
  // wainscot, rail and baseboard on the inner faces
  const inner: [number, number, number, number, number][] = [
    [cx, -d / 2 + 0.03, w, 0.04, 0], [cx, d / 2 - 0.03, w, 0.04, 0], [bb.x0 + 0.03, 0, 0.04, d, 1], [bb.x1 - 0.03, 0, 0.04, d, 1],
  ]
  for (const [x, z, sx, sz] of inner) {
    b.box(p.wainscot, [x, 0.5, z], [sx, 1.0, sz], { cast: false })
    b.box(p.trim, [x, 1.02, z], [sx + (sx > 1 ? 0 : 0.02), 0.05, sz + (sz > 1 ? 0 : 0.03)], { cast: false })
    b.box(shadeColor(p.wainscot, -30), [x, 0.06, z], [sx, 0.12, sz + 0.01], { cast: false })
  }
  // ceiling + light panels
  b.box(p.ceiling, [cx, h + 0.1, 0], [w + 0.6, 0.2, d + 0.6], { cast: false })
  b.collider([cx, h + 0.1, 0], [w + 0.6, 0.2, d + 0.6])
  for (let x = bb.x0 + 3; x < bb.x1 - 1; x += 4)
    for (let z = -d / 2 + 2.5; z < d / 2 - 1; z += 4) b.box(0xfffcf2, [x, h - 0.01, z], [1.6, 0.03, 0.6], { mat: 'emissive', cast: false })
  // door on the south wall
  b.box(p.trim, [0, 1.3, d / 2 - 0.04], [2.1, 2.7, 0.08], { cast: false })
  b.box(r.id === 'office' ? 0x9fb3c8 : 0x7a5a44, [-0.48, 1.18, d / 2 - 0.08], [0.92, 2.36, 0.05], { mat: r.id === 'office' ? 'glass' : 'matte', cast: false })
  b.box(r.id === 'office' ? 0x9fb3c8 : 0x7a5a44, [0.48, 1.18, d / 2 - 0.08], [0.92, 2.36, 0.05], { mat: r.id === 'office' ? 'glass' : 'matte', cast: false })
  b.push(0, 2.85, d / 2 - 0.06, Math.PI)
  addSign(ctx, 'EXIT', { bg: '#3f6b58', fg: '#ffffff', shape: 'rect', weight: 700 }, [0, 0, 0], 0.6, 0.22)
  b.pop()
}

function painting(ctx: GenContext, rect: [number, number, number, number], x: number, y: number, z: number, yaw: number, w: number, h: number, frame: number = PALETTE.walnut) {
  const { b } = ctx
  b.push(x, y, z, yaw)
  b.box(frame, [0, 0, -0.02], [w + 0.12, h + 0.12, 0.05], { cast: false })
  b.add('plane', 0xffffff, [0, 0, 0.01], [w, h, 1], { mat: 'decorAtlas', uv: rect, cast: false })
  b.pop()
}

function windowView(ctx: GenContext, x: number, y: number, z: number, yaw: number, w: number, h: number, seed: number, frame: number) {
  const rect = ctx.decor.add(256, 192, windowViewPainter(seed), `winview-${seed}`)
  const { b } = ctx
  b.push(x, y, z, yaw)
  b.add('plane', 0xffffff, [0, 0, 0.005], [w, h, 1], { mat: 'viewAtlas', uv: rect, cast: false })
  b.box(frame, [0, h / 2, 0.03], [w + 0.14, 0.08, 0.1], { cast: false })
  b.box(frame, [0, -h / 2, 0.05], [w + 0.2, 0.08, 0.16], { cast: false })
  b.box(frame, [-w / 2, 0, 0.03], [0.08, h, 0.1], { cast: false })
  b.box(frame, [w / 2, 0, 0.03], [0.08, h, 0.1], { cast: false })
  b.box(frame, [0, 0, 0.03], [0.05, h, 0.06], { cast: false })
  b.pop()
}

function chair(b: PartBuilder, x: number, z: number, yaw: number, color: number, office = false) {
  b.push(x, 0, z, yaw)
  b.box(color, [0, 0.45, 0], [0.46, 0.06, 0.44])
  b.box(color, [0, 0.78, -0.2], [0.44, office ? 0.55 : 0.42, 0.05])
  if (office) {
    b.add('cyl8', PALETTE.charcoal, [0, 0.22, 0], [0.06, 0.42, 0.06], { cast: false })
    b.add('cyl8', PALETTE.charcoal, [0, 0.03, 0], [0.5, 0.05, 0.5], { cast: false })
  } else for (const [lx, lz] of [[-0.19, -0.18], [0.19, -0.18], [-0.19, 0.18], [0.19, 0.18]]) b.box(PALETTE.charcoal, [lx, 0.22, lz], [0.04, 0.44, 0.04], { cast: false })
  b.pop()
}

function plant(b: PartBuilder, rng: Rng, x: number, z: number, size = 1) {
  b.add('cyl8', rng.pick([0xe7e1d6, 0x6e5140, 0x3b3e44]), [x, 0.25 * size, z], [0.5 * size, 0.5 * size, 0.5 * size])
  for (let i = 0; i < 3; i++) b.add('ico', rng.pick([PALETTE.leafA, PALETTE.leafB]), [x + rng.range(-0.12, 0.12) * size, (0.7 + i * 0.28) * size, z + rng.range(-0.12, 0.12) * size], [0.62 * size, 0.55 * size, 0.62 * size], { mat: 'foliage' })
  b.cylCollider([x, 0, z], 0.28 * size, 1.2 * size)
}

function books(b: PartBuilder, rng: Rng, x0: number, x1: number, y: number, z: number, depth = 0.24) {
  let x = x0
  while (x < x1 - 0.05) {
    const bw = rng.range(0.04, 0.09)
    const bh = rng.range(0.22, 0.32)
    b.box(rng.pick([0x7a3f3a, 0x2f4a8a, 0x3f5e4c, 0xc49a4e, 0x5c4535, 0xb8a58a, 0x6a6c70, 0x9b5442]), [x + bw / 2, y + bh / 2, z], [bw, bh, depth], { cast: false })
    x += bw + 0.008
  }
}

function shelfUnit(b: PartBuilder, rng: Rng, x: number, z: number, yaw: number, w: number, h: number) {
  b.push(x, 0, z, yaw)
  const wood = 0x8a6a4c
  b.box(wood, [0, h / 2, -0.18], [w, h, 0.04])
  b.box(wood, [-w / 2, h / 2, 0], [0.05, h, 0.4])
  b.box(wood, [w / 2, h / 2, 0], [0.05, h, 0.4])
  const n = Math.round(h / 0.45)
  for (let i = 0; i <= n; i++) {
    const y = 0.05 + (i * (h - 0.1)) / n
    b.box(wood, [0, y, 0], [w, 0.04, 0.4], { cast: false })
    if (i < n) books(b, rng, -w / 2 + 0.06, w / 2 - 0.06, y + 0.02, 0)
  }
  b.collider([0, h / 2, 0], [w, h, 0.42])
  b.pop()
}

// ────────────────────────────────────────────────────────────────────────────
function education(ctx: GenContext, r: InteriorDef) {
  const { b } = ctx
  const rng = createRng(301)
  const wood = 0x8a6a4c
  const hw = r.width / 2
  const hd = r.depth / 2
  // timeline band on the west wall (plaques are animated StoryProps)
  b.box(wood, [-hw + 0.05, 1.75, 0], [0.06, 1.15, 14], { cast: false })
  b.push(-hw + 0.09, 2.75, 0, Math.PI / 2)
  addSign(ctx, 'MY LEARNING JOURNEY', { bg: '#f1e9dc', fg: '#3f5e4c', shape: 'rect', weight: 800 }, [0, 0, 0], 5, 0.42)
  b.pop()
  // chalkboard + teacher desk
  b.box(wood, [6, 1.85, -hd + 0.06], [6.5, 2.2, 0.08], { cast: false })
  b.box(0x2f3f38, [6, 1.85, -hd + 0.11], [6.2, 1.95, 0.02], { cast: false })
  b.box(wood, [6, 0.82, -hd + 0.2], [6.2, 0.06, 0.18], { cast: false })
  b.box(wood, [8.8, 0.4, -6.9], [1.8, 0.8, 0.8])
  b.box(0xe9e0cf, [8.8, 0.82, -6.9], [1.9, 0.05, 0.9], { cast: false })
  b.add('sphere', 0x5d8fb3, [8.3, 1.08, -6.9], [0.36, 0.36, 0.36])
  b.collider([8.8, 0.42, -6.9], [1.9, 0.85, 0.9])
  // student desks
  for (const [x, z] of EDU_DESKS) {
    b.box(0xd9c3a0, [x, 0.74, z], [1.1, 0.05, 0.6])
    for (const [lx, lz] of [[-0.5, -0.25], [0.5, -0.25], [-0.5, 0.25], [0.5, 0.25]]) b.box(PALETTE.charcoal, [x + lx, 0.36, z + lz], [0.04, 0.72, 0.04], { cast: false })
    b.box(0xf6f1e8, [x + rng.range(-0.2, 0.2), 0.775, z], [0.3, 0.01, 0.22], { cast: false, rot: [0, rng.range(-0.3, 0.3), 0] })
    chair(b, x, z + 0.62, Math.PI, 0x4f6b58)
    b.collider([x, 0.4, z], [1.1, 0.8, 0.6])
  }
  // library corner
  for (let i = 0; i < 3; i++) shelfUnit(b, rng, -10 + i * 2.8, -hd + 0.24, 0, 2.7, 2.3)
  b.box(wood, [-6, 0.74, -4.8], [1.6, 0.05, 0.8])
  b.box(wood, [-6, 0.37, -4.8], [1.5, 0.72, 0.7])
  b.collider([-6, 0.4, -4.8], [1.6, 0.8, 0.8])
  b.box(PALETTE.charcoal, [-6.6, 0.95, -5.0], [0.05, 0.4, 0.05], { cast: false })
  b.box(PALETTE.lamp, [-6.45, 1.15, -5.0], [0.3, 0.12, 0.2], { mat: 'emissive', cast: false })
  chair(b, -6, -4.1, Math.PI, 0x4f6b58)
  // certificates wall label + lockers + plants + clock
  b.push(hw - 0.09, 2.85, 1.4, -Math.PI / 2)
  addSign(ctx, 'CERTIFICATES', { bg: '#f1e9dc', fg: '#3f5e4c', shape: 'rect', weight: 800 }, [0, 0, 0], 2.6, 0.32)
  b.pop()
  for (let i = 0; i < 6; i++) {
    const x = -11 + i * 0.8
    b.box(0x6f8a6a, [x, 0.95, hd - 0.3], [0.76, 1.9, 0.5])
    b.box(0x5c7658, [x + 0.25, 1.2, hd - 0.56], [0.04, 0.12, 0.02], { cast: false })
  }
  b.collider([-9, 0.95, hd - 0.3], [4.8, 1.9, 0.5])
  // notice board (story: growth)
  b.box(0x9c7a58, [7.8, 1.65, hd - 0.06], [2.2, 1.2, 0.06], { cast: false })
  for (let i = 0; i < 6; i++) b.box(rng.pick([0xf6f1e8, 0xe3d2a2, 0xbcd0d8, 0xe8c9bd]), [7.1 + (i % 3) * 0.7, 1.9 - Math.floor(i / 3) * 0.5, hd - 0.1], [0.46, 0.36, 0.01], { rot: [0, 0, rng.range(-0.1, 0.1)], cast: false })
  plant(b, rng, -hw + 0.8, hd - 1.2)
  plant(b, rng, hw - 0.8, -hd + 0.8)
  plant(b, rng, hw - 0.8, hd - 0.8, 0.9)
  b.add('cyl', 0xfaf7f0, [0, 3.0, -hd + 0.05], [0.6, 0.05, 0.6], { rot: [Math.PI / 2, 0, 0], cast: false })
  b.add('torus', PALETTE.charcoal, [0, 3.0, -hd + 0.07], [0.62, 0.62, 0.6], { cast: false })
  // painted windows on the south wall and east wall
  for (const x of [-7.5, 4.5]) windowView(ctx, x, 2.0, hd - 0.02, Math.PI, 2.2, 1.6, 11 + x, r.palette.trim)
  windowView(ctx, hw - 0.02, 2.0, -5.6, -Math.PI / 2, 2.4, 1.6, 17, r.palette.trim)
}

function office(ctx: GenContext, r: InteriorDef) {
  const { b } = ctx
  const rng = createRng(402)
  const hw = r.width / 2
  const hd = r.depth / 2
  const oak = 0xb48a62
  const walnut = 0x6e5140
  const white = 0xf4f3f0
  const graphite = 0x2b2e34
  // big windows on the north wall of the open office (the studio wing has its own wall)
  for (let x = -2; x < hw - 1; x += 3.2) windowView(ctx, x, 2.05, -hd + 0.02, 0, 2.9, 2.3, 40 + Math.round(x), 0x2e3035)
  // ── reception + brand wall ──────────────────────────────────────────
  b.box(oak, [-6, 0.52, 6], [3.2, 1.04, 0.8])
  b.box(white, [-6, 1.07, 6], [3.3, 0.06, 0.9], { cast: false })
  b.box(0xd9d3c8, [-6, 0.35, 6.41], [3.1, 0.5, 0.02], { cast: false })
  b.collider([-6, 0.55, 6], [3.3, 1.1, 0.9])
  b.box(graphite, [-6.6, 1.25, 5.8], [0.5, 0.32, 0.03], { cast: false })
  b.add('cyl8', PALETTE.terracotta, [-5.0, 1.18, 6.1], [0.16, 0.18, 0.16], { cast: false })
  b.add('ico', PALETTE.leafA, [-5.0, 1.38, 6.1], [0.3, 0.3, 0.3], { mat: 'foliage', cast: false })
  chair(b, -6.2, 5.2, 0, graphite, true)
  b.push(-hw + 0.08, 0, 5.5, Math.PI / 2)
  for (let i = 0; i < 24; i++) b.box(oak, [-3 + i * 0.26, 1.7, 0.02], [0.18, 3.4, 0.05], { cast: false })
  addSign(ctx, 'NFC SOLUTIONS', { bg: '#2e3035', fg: '#ffffff', shape: 'rect', weight: 700 }, [0, 2.2, 0.08], 4.2, 0.62)
  b.pop()
  plant(b, rng, -hw + 0.8, 8.8, 1.3)
  plant(b, rng, -hw + 0.8, 2.2, 1.1)
  // artwork by the entrance
  const prints = [['#efe9df', '#2f4a8a', '#c27a60'], ['#e9e4da', '#3f7f78', '#c49a4e']]
  prints.forEach((pal, i) => {
    const rect = ctx.decor.add(128, 160, artPainter(840 + i, ['#ffffff', ...pal]), `office-print-${i}`)
    painting(ctx, rect, -2.6 - i * 1.4, 1.75, hd - 0.05, Math.PI, 1.0, 1.25, 0x2a2626)
  })
  // ── open workspace: every desk a little different ─────────────────────
  const chairColors = [0x3b3e44, 0x4f5d73, 0x5d6b5c]
  OFFICE_DESKS.forEach((dk, i) => {
    const top = i % 3 === 0 ? oak : white
    b.box(top, [dk.x, 0.74, dk.z], [1.4, 0.04, 0.66])
    b.box(graphite, [dk.x - 0.62, 0.37, dk.z], [0.05, 0.72, 0.6], { cast: false })
    b.box(graphite, [dk.x + 0.62, 0.37, dk.z], [0.05, 0.72, 0.6], { cast: false })
    const mz = dk.z - dk.facing * 0.18
    const face = dk.facing > 0 ? 0 : Math.PI
    const kind = i % 4
    const monitor = (mx: number, w: number, key: number) => {
      b.box(graphite, [mx, 0.86, mz], [0.06, 0.22, 0.06], { cast: false })
      b.box(0x22252c, [mx, 1.07, mz], [w, 0.36, 0.03])
      const scr = ctx.decor.add(160, 96, screenPainter(500 + key), `screen-${key % 6}`)
      b.push(mx, 1.07, mz + dk.facing * 0.017, face)
      b.add('plane', 0xffffff, [0, 0, 0], [w - 0.05, 0.31, 1], { mat: 'decorAtlas', uv: scr, cast: false })
      b.pop()
    }
    if (kind === 1) {
      // dual screens
      monitor(dk.x - 0.3, 0.52, i)
      monitor(dk.x + 0.3, 0.52, i + 3)
    } else if (kind === 3) {
      // laptop on a stand
      b.box(0xbfc3c9, [dk.x - 0.1, 0.8, mz], [0.34, 0.08, 0.24], { cast: false, rot: [0.25, 0, 0] })
      b.box(0x22252c, [dk.x - 0.1, 0.96, mz - dk.facing * 0.1], [0.34, 0.22, 0.015], { rot: [dk.facing * 0.2, 0, 0], cast: false })
    } else monitor(dk.x, 0.62, i)
    b.box(0xd9d6d0, [dk.x, 0.765, dk.z + dk.facing * 0.1], [0.42, 0.015, 0.14], { cast: false })
    // small, personal variations
    if (rng.chance(0.6)) b.add('cyl', 0xf5f1ea, [dk.x + 0.48, 0.8, dk.z + dk.facing * 0.14], [0.08, 0.1, 0.08], { cast: false })
    if (i % 3 === 1) {
      b.add('cyl8', graphite, [dk.x - 0.56, 0.95, mz], [0.02, 0.4, 0.02], { cast: false })
      b.add('cone', 0xe8e4dc, [dk.x - 0.5, 1.13, mz + dk.facing * 0.06], [0.16, 0.1, 0.16], { cast: false })
    }
    if (i % 4 === 2) for (let k = 0; k < 3; k++) b.box(rng.pick([0xf6f1e8, 0xe7e0d2, 0xd8dde3]), [dk.x + 0.42, 0.77 + k * 0.012, dk.z - dk.facing * 0.05], [0.24, 0.01, 0.32], { rot: [0, k * 0.15, 0], cast: false })
    if (i % 5 === 0) {
      b.add('cyl8', PALETTE.terracotta, [dk.x - 0.5, 0.83, dk.z + dk.facing * 0.16], [0.12, 0.14, 0.12], { cast: false })
      b.add('ico', PALETTE.leafB, [dk.x - 0.5, 0.97, dk.z + dk.facing * 0.16], [0.2, 0.2, 0.2], { mat: 'foliage', cast: false })
    }
    chair(b, dk.x, dk.z + dk.facing * 0.72, dk.facing > 0 ? Math.PI : 0, chairColors[i % 3], true)
    b.collider([dk.x, 0.4, dk.z], [1.4, 0.8, 0.66])
  })
  // acoustic dividers (felt)
  for (const [x, z] of [[4.2, 2.25], [7.6, 2.25], [4.2, -1.75], [7.6, -1.75], [11, 2.25]] as const) b.box(0x9aa39a, [x, 1.02, z], [1.4, 0.52, 0.05], { mat: 'fabric', cast: false })
  // my desk: a little personal touch
  b.add('cyl8', PALETTE.terracotta, [10.6, 0.84, 3.0], [0.14, 0.16, 0.14], { cast: false })
  b.add('ico', PALETTE.leafA, [10.6, 1.0, 3.0], [0.24, 0.24, 0.24], { mat: 'foliage', cast: false })
  // storage credenzas under the windows
  for (const x of [0.5, 4.5, 8.5]) {
    b.box(walnut, [x, 0.36, -hd + 0.3], [3.2, 0.72, 0.5])
    b.box(0xefe9df, [x, 0.73, -hd + 0.3], [3.24, 0.03, 0.52], { cast: false })
    for (let k = 0; k < 4; k++) b.box(0x5b4436, [x - 1.2 + k * 0.8, 0.36, -hd + 0.56], [0.72, 0.62, 0.02], { cast: false })
    b.collider([x, 0.36, -hd + 0.3], [3.2, 0.72, 0.5])
    books(b, rng, x - 1.3, x - 0.5, 0.75, -hd + 0.32, 0.22)
  }
  plant(b, rng, 2.6, -hd + 0.4, 0.8)
  // ── meeting room: glass walls with a door gap ───────────────────────
  const glassWall = (x: number, z: number, sx: number, sz: number) => {
    b.box(0x2e3035, [x, 2.4, z], [sx + 0.02, 0.06, sz + 0.02], { cast: false })
    b.box(0x2e3035, [x, 0.03, z], [sx + 0.02, 0.06, sz + 0.02], { cast: false })
    ctx.glassPanes.push({ position: b.toWorld(x, 1.2, z), size: [Math.max(sx, sz), 2.4], yaw: b.yaw + (sx > sz ? 0 : Math.PI / 2) })
    b.collider([x, 1.2, z], [sx, 2.4, sz])
  }
  glassWall(-5, -6.5, 0.06, 7)
  glassWall(-11.0, -3, 6, 0.06)
  glassWall(-5.4, -3, 0.8, 0.06)
  b.box(0x2e3035, [-7.3, 2.4, -3], [1.6, 0.06, 0.06], { cast: false })
  b.box(oak, [-9.5, 0.74, -6.5], [3.6, 0.06, 1.4])
  b.box(graphite, [-9.5, 0.37, -6.5], [0.3, 0.72, 0.9], { cast: false })
  b.collider([-9.5, 0.4, -6.5], [3.6, 0.8, 1.4])
  for (const [x, z, yaw] of [[-10.6, -7.4, Math.PI / 2], [-8.4, -7.4, -Math.PI / 2], [-9.5, -5.2, Math.PI], [-10.6, -5.6, Math.PI / 2], [-8.4, -5.6, -Math.PI / 2]] as const) chair(b, x, z, yaw, 0x4f5d73, true)
  b.box(0x22252c, [-9.5, 1.8, -hd + 0.06], [2.6, 1.4, 0.06])
  const meet = ctx.decor.add(256, 144, screenPainter(777), 'screen-meeting')
  b.add('plane', 0xffffff, [-9.5, 1.8, -hd + 0.1], [2.45, 1.28, 1], { mat: 'decorAtlas', uv: meet, cast: false })
  plant(b, rng, -6.0, -hd + 0.7, 1.1)
  // ── design wall with sketches + standing table ──────────────────────
  b.box(0xb8906a, [7.5, 1.8, -hd + 0.06], [8.4, 2.2, 0.05], { cast: false })
  for (let i = 0; i < 12; i++) {
    const rect = ctx.decor.add(96, 96, artPainter(620 + i, ['#f6f1e8', '#2f4a8a', '#c27a60', '#3f7f78', '#c49a4e']), `sketch-${i % 8}`)
    painting(ctx, rect, 4.0 + (i % 6) * 1.35, 2.3 - Math.floor(i / 6) * 0.95, -hd + 0.12, 0, 0.9, 0.7, 0xf6f1e8)
  }
  b.add('cyl', white, [10.2, 1.05, -6.9], [0.8, 0.04, 0.8], { cast: false })
  b.add('cyl8', graphite, [10.2, 0.52, -6.9], [0.08, 1.04, 0.08], { cast: false })
  b.cylCollider([10.2, 0, -6.9], 0.4, 1.1)
  // greeter's standing table near the entrance
  b.add('cyl', white, [6.0, 1.05, 5.8], [0.7, 0.04, 0.7], { cast: false })
  b.add('cyl8', graphite, [6.0, 0.52, 5.8], [0.08, 1.04, 0.08], { cast: false })
  b.cylCollider([6.0, 0, 5.8], 0.36, 1.1)
  // ── lounge + coffee point ──────────────────────────────────────────
  b.box(0xc9b8a0, [-9.9, 0.006, 2.2], [3.6, 0.012, 2.8], { mat: 'fabric', cast: false })
  b.push(-10.6, 0, 2.2, Math.PI / 2)
  b.box(0x55606e, [0, 0.25, 0], [2.4, 0.5, 0.9], { mat: 'fabric' })
  b.box(0x55606e, [0, 0.62, -0.38], [2.4, 0.6, 0.18], { mat: 'fabric' })
  b.box(0x55606e, [-1.1, 0.5, 0], [0.2, 0.5, 0.9], { mat: 'fabric' })
  b.box(0x55606e, [1.1, 0.5, 0], [0.2, 0.5, 0.9], { mat: 'fabric' })
  for (const x of [-0.6, 0.6]) b.box(0xd8c7a0, [x, 0.62, -0.22], [0.42, 0.34, 0.12], { rot: [-0.2, 0, 0], mat: 'fabric' })
  b.collider([0, 0.4, 0], [2.4, 0.8, 0.9])
  b.pop()
  b.box(oak, [-8.8, 0.22, 2.2], [0.9, 0.44, 1.4])
  b.collider([-8.8, 0.22, 2.2], [0.9, 0.44, 1.4])
  books(b, rng, -9.1, -8.6, 0.44, 2.4, 0.2)
  b.box(white, [-hw + 0.45, 0.48, -1.0], [0.8, 0.96, 2.2])
  b.collider([-hw + 0.45, 0.48, -1.0], [0.8, 0.96, 2.2])
  b.box(graphite, [-hw + 0.45, 1.2, -1.4], [0.45, 0.5, 0.4])
  for (let k = 0; k < 3; k++) b.add('cyl', rng.pick([0xf5f1ea, 0xe7d6c0, 0x3b3e44]), [-hw + 0.45, 1.02, -0.5 + k * 0.18], [0.09, 0.1, 0.09], { cast: false })
  plant(b, rng, 12.9, hd - 0.9, 1.2)
  plant(b, rng, 2.4, 6.6, 1.0)

  studio(ctx, r, rng)
}

/**
 * Project Studio: the office's east wing, behind a glass partition. One bay
 * per project — a large wall screen (rendered live by StoryProps so it can
 * switch on as you approach), an oak console and a light pool.
 */
function studio(ctx: GenContext, r: InteriorDef, rng: Rng) {
  const { b } = ctx
  const hd = r.depth / 2
  const x0 = STUDIO.x0
  const x1 = STUDIO.x0 + STUDIO.width
  const oak = 0xb48a62
  const graphite = 0x2b2e34
  // warmer floor inset so the wing reads as its own place
  b.box(0xa77f5c, [(x0 + x1) / 2, 0.004, 0], [STUDIO.width, 0.008, r.depth], { mat: 'paint', cast: false })
  for (let z = -hd + 0.2; z < hd; z += 0.4) b.box(0x98714f, [(x0 + x1) / 2, 0.009, z], [STUDIO.width, 0.002, 0.015], { mat: 'paint', cast: false })
  // glass partition with a wide opening near the entrance
  const [d0, d1] = STUDIO.door
  const segs: [number, number][] = [[-hd, d0], [d1, hd]]
  for (const [a, c] of segs) {
    const len = c - a
    const z = (a + c) / 2
    b.box(0x2e3035, [x0, 2.6, z], [0.07, 0.07, len], { cast: false })
    b.box(0x2e3035, [x0, 0.03, z], [0.07, 0.06, len], { cast: false })
    for (let m = a + 2; m < c - 0.4; m += 2) b.box(0x2e3035, [x0, 1.3, m], [0.05, 2.6, 0.05], { cast: false })
    ctx.glassPanes.push({ position: b.toWorld(x0, 1.3, z), size: [len, 2.6], yaw: b.yaw + Math.PI / 2 })
    b.collider([x0, 1.3, z], [0.08, 2.6, len])
  }
  // header above the opening, with the studio sign on both faces
  b.box(0x2e3035, [x0, 3.15, (d0 + d1) / 2], [0.12, 1.3, d1 - d0 + 0.1])
  b.collider([x0, 3.2, (d0 + d1) / 2], [0.12, 1.2, d1 - d0])
  b.push(x0 - 0.07, 3.02, (d0 + d1) / 2, -Math.PI / 2)
  addSign(ctx, 'PROJECT STUDIO', { bg: '#2e3035', fg: '#f7f4ef', shape: 'rect', weight: 700 }, [0, 0, 0], 2.9, 0.34)
  b.pop()
  b.push(x0 + 0.07, 3.02, (d0 + d1) / 2, Math.PI / 2)
  addSign(ctx, 'PROJECT STUDIO', { bg: '#2e3035', fg: '#f7f4ef', shape: 'rect', weight: 700 }, [0, 0, 0], 2.9, 0.34)
  b.pop()
  // the bays
  PROJECTS.forEach((p, i) => {
    const bay = studioBay(i)
    const [sx, sz] = bay.screen
    b.push(sx, 0, sz, bay.yaw)
    // bezel frame (the live screen surface is a StoryProp)
    b.box(0x17191d, [0, 1.62, -0.02], [2.72, 1.62, 0.06])
    b.box(0x3a3d44, [0, 0.79, 0.0], [2.8, 0.03, 0.08], { cast: false })
    // accent line + console
    b.box(p.color, [0, 2.52, 0.0], [2.2, 0.03, 0.03], { mat: 'emissive', cast: false })
    b.box(oak, [0, 0.42, 0.55], [2.1, 0.06, 0.52])
    b.box(0x3b3e44, [-0.95, 0.2, 0.55], [0.05, 0.4, 0.46], { cast: false })
    b.box(0x3b3e44, [0.95, 0.2, 0.55], [0.05, 0.4, 0.46], { cast: false })
    // a device on the console: laptop or phone, alternating
    if (i % 2 === 0) {
      b.box(0xbfc3c9, [0.45, 0.46, 0.55], [0.36, 0.02, 0.24], { cast: false })
      b.box(0x22252c, [0.45, 0.58, 0.44], [0.36, 0.23, 0.012], { rot: [-0.25, 0, 0], cast: false })
    } else {
      b.box(0x22252c, [0.45, 0.46, 0.6], [0.09, 0.012, 0.18], { rot: [0, 0.3, 0], cast: false })
    }
    b.box(0xefe9df, [-0.5, 0.455, 0.6], [0.3, 0.01, 0.22], { rot: [0, -0.2, 0], cast: false })
    b.collider([0, 0.4, 0.55], [2.1, 0.8, 0.52])
    b.pop()
    const [lx, , lz] = b.toWorld(bay.stand[0], 0, bay.stand[1])
    lightPoolAt(ctx, lx, lz, 1.8, shadeColor(p.color, 60))
  })
  // collaboration table in the middle of the wing
  const tx = 17.6
  const tz = -1.2
  b.box(oak, [tx, 0.74, tz], [1.3, 0.05, 3.4])
  b.box(graphite, [tx, 0.37, tz - 1.2], [0.08, 0.72, 0.9], { cast: false })
  b.box(graphite, [tx, 0.37, tz + 1.2], [0.08, 0.72, 0.9], { cast: false })
  b.collider([tx, 0.4, tz], [1.3, 0.8, 3.4])
  for (const [dx, dz, yaw] of [[-0.95, -0.8, Math.PI / 2], [-0.95, 0.8, Math.PI / 2], [0.95, -0.2, -Math.PI / 2]] as const) chair(b, tx + dx, tz + dz, yaw, 0x5d6b5c, true)
  for (let k = 0; k < 4; k++) b.box(rng.pick([0xf6f1e8, 0xe7e0d2, 0xf3d9a8]), [tx - 0.2 + (k % 2) * 0.35, 0.775, tz - 0.9 + k * 0.5], [0.28, 0.01, 0.2], { rot: [0, k * 0.4, 0], cast: false })
  b.box(0xbfc3c9, [tx + 0.25, 0.78, tz + 0.6], [0.34, 0.02, 0.24], { cast: false })
  // pendant lights over the table
  for (const dz of [-1.0, 0.6]) {
    b.add('cyl8', graphite, [tx, 3.3, tz + dz], [0.01, 1.0, 0.01], { cast: false })
    b.add('cone', 0x2b2e34, [tx, 2.72, tz + dz], [0.42, 0.26, 0.42], { cast: false })
    b.add('disk', 0xfff1d6, [tx, 2.6, tz + dz], [0.36, 1, 0.36], { rot: [Math.PI, 0, 0], mat: 'emissive', cast: false })
  }
  const [px, , pz] = b.toWorld(tx, 0, tz)
  lightPoolAt(ctx, px, pz, 2.4, 0xffe2b8)
  // back wall: a pin-up board of process sketches
  b.box(0xefe9df, [(x0 + x1) / 2 - 0.4, 1.7, -hd + 0.05], [5.6, 1.9, 0.04], { cast: false })
  for (let i = 0; i < 10; i++) {
    const rect = ctx.decor.add(96, 96, artPainter(900 + i, ['#ffffff', '#1f2328', '#ec7a2c', '#5b6b82', '#d8c9a8']), `studio-sketch-${i % 6}`)
    painting(ctx, rect, x0 + 1.9 + (i % 5) * 1.05, 2.2 - Math.floor(i / 5) * 0.85, -hd + 0.1, 0, 0.78, 0.6, 0xffffff)
  }
  plant(b, rng, x1 - 0.8, -hd + 0.8, 1.3)
  plant(b, rng, x0 + 0.9, hd - 0.9, 1.1)
  plant(b, rng, x1 - 0.8, hd - 0.8, 1.0)
}


function home(ctx: GenContext, r: InteriorDef) {
  const { b } = ctx
  const rng = createRng(503)
  const hw = r.width / 2
  const hd = r.depth / 2
  const wood = 0x8a6a4c
  // rug + living area
  b.box(0xc9a58a, [-3, 0.005, 1.0], [4.2, 0.01, 3.0], { mat: 'paint', cast: false })
  b.push(-3, 0, 2.4, Math.PI)
  b.box(0x6f7f68, [0, 0.25, 0], [2.4, 0.5, 0.9])
  b.box(0x6f7f68, [0, 0.62, -0.38], [2.4, 0.6, 0.18])
  b.box(0x6f7f68, [-1.1, 0.5, 0], [0.2, 0.5, 0.9])
  b.box(0x6f7f68, [1.1, 0.5, 0], [0.2, 0.5, 0.9])
  for (const x of [-0.6, 0.6]) b.box(0xe3d2a2, [x, 0.62, -0.2], [0.42, 0.34, 0.12], { rot: [-0.2, 0, 0] })
  b.collider([0, 0.4, 0], [2.4, 0.8, 0.9])
  b.pop()
  b.box(wood, [-3, 0.22, 0.6], [1.2, 0.44, 0.7])
  b.collider([-3, 0.22, 0.6], [1.2, 0.44, 0.7])
  b.add('cyl', 0xf5f1ea, [-2.8, 0.49, 0.6], [0.09, 0.1, 0.09], { cast: false })
  b.add('cyl8', PALETTE.charcoal, [-5.4, 0.8, 2.8], [0.05, 1.6, 0.05], { cast: false })
  b.add('cone', 0xf1e3c8, [-5.4, 1.65, 2.8], [0.5, 0.35, 0.5], { mat: 'emissive', cast: false })
  // workspace desk under the window
  b.box(wood, [0, 0.76, -hd + 0.55], [2.6, 0.05, 0.8])
  for (const x of [-1.2, 1.2]) b.box(wood, [x, 0.38, -hd + 0.55], [0.06, 0.76, 0.7], { cast: false })
  b.collider([0, 0.4, -hd + 0.55], [2.6, 0.8, 0.8])
  b.box(0x22252c, [-0.3, 1.12, -hd + 0.3], [0.8, 0.46, 0.03])
  const scr = ctx.decor.add(160, 96, screenPainter(909), 'screen-home')
  b.add('plane', 0xffffff, [-0.3, 1.12, -hd + 0.32], [0.74, 0.42, 1], { mat: 'decorAtlas', uv: scr, cast: false })
  b.box(PALETTE.charcoal, [-0.3, 0.88, -hd + 0.3], [0.06, 0.2, 0.06], { cast: false })
  b.add('torus', 0x2a2626, [-1.0, 0.84, -hd + 0.6], [0.2, 0.2, 0.9], { rot: [Math.PI / 2, 0, 0], cast: false })
  b.add('cyl8', PALETTE.terracotta, [-1.05, 0.86, -hd + 0.35], [0.14, 0.18, 0.14], { cast: false })
  b.add('ico', PALETTE.leafA, [-1.05, 1.04, -hd + 0.35], [0.24, 0.26, 0.24], { mat: 'foliage', cast: false })
  chair(b, 0, -hd + 1.35, Math.PI, 0x3b3e44, true)
  // window with a view (curtains are a StoryProp)
  windowView(ctx, -4.8, 1.9, -hd + 0.02, 0, 2.0, 1.6, 81, r.palette.trim)
  windowView(ctx, 3.6, 1.9, -hd + 0.02, 0, 1.6, 1.4, 83, r.palette.trim)
  // bookshelf on the west wall
  shelfUnit(b, rng, -hw + 0.24, -0.4, Math.PI / 2, 3.2, 2.4)
  // journey + portfolio walls (east): frames
  const palettes = [['#f6f1e8', '#2f4a8a', '#c27a60'], ['#1f2430', '#c49a4e', '#8fa2bd'], ['#e8e2d6', '#3f7f78', '#b06a4c']]
  for (let i = 0; i < 4; i++) {
    const rect = ctx.decor.add(128, 128, artPainter(710 + i, ['#ffffff', ...palettes[i % 3]]), `homeart-${i}`)
    painting(ctx, rect, hw - 0.04, 1.75 + (i % 2) * 0.1, 1.9 + i * 0.75 - 0.4, -Math.PI / 2, 0.6, 0.6, 0x2a2626)
  }
  b.push(hw - 0.09, 2.65, 2.8, -Math.PI / 2)
  addSign(ctx, 'SELECTED WORK', { bg: '#f3ece1', fg: '#5c4535', shape: 'rect', weight: 800 }, [0, 0, 0], 2.2, 0.3)
  b.pop()
  b.push(hw - 0.09, 2.65, -2.2, -Math.PI / 2)
  addSign(ctx, 'MY JOURNEY', { bg: '#f3ece1', fg: '#5c4535', shape: 'rect', weight: 800 }, [0, 0, 0], 2.0, 0.3)
  b.pop()
  // skills board on the west wall, by the entrance
  // (the tool tiles themselves are live StoryProps so they can respond to the visitor)
  b.box(0x2e3035, [-hw + 0.06, 1.55, 3.9], [0.05, 1.7, 3.0], { cast: false })
  b.box(0xb48a62, [-hw + 0.09, 0.66, 3.9], [0.14, 0.04, 3.1], { cast: false })
  b.push(-hw + 0.1, 2.62, 3.9, Math.PI / 2)
  addSign(ctx, 'SKILLS', { bg: '#2e3035', fg: '#f7f4ef', shape: 'rect', weight: 700 }, [0, 0, 0.01], 0.9, 0.18)
  b.pop()
  // design-approach sketch board on the north wall
  b.box(0xefe9df, [6.8, 1.75, -hd + 0.05], [2.2, 1.4, 0.04], { cast: false })
  for (let i = 0; i < 6; i++) {
    const rect = ctx.decor.add(96, 96, artPainter(760 + i, ['#ffffff', '#1f2328', '#b06a4c', '#5b6b82', '#d8c9a8']), `home-sketch-${i % 4}`)
    painting(ctx, rect, 6.1 + (i % 3) * 0.7, 2.05 - Math.floor(i / 3) * 0.62, -hd + 0.09, 0, 0.56, 0.44, 0xffffff)
  }
  b.push(6.8, 2.62, -hd + 0.08)
  addSign(ctx, 'HOW I DESIGN', { bg: '#efe9df', fg: '#5c4535', shape: 'rect', weight: 800 }, [0, 0, 0], 1.6, 0.22)
  b.pop()
  // contact pinboard by the door
  b.box(0x9c7a58, [-4.6, 1.6, hd - 0.06], [1.4, 1.0, 0.05], { cast: false })
  for (let i = 0; i < 4; i++) b.box(rng.pick([0xf6f1e8, 0xe3d2a2, 0xbcd0d8]), [-5.0 + (i % 2) * 0.8, 1.75 - Math.floor(i / 2) * 0.42, hd - 0.1], [0.5, 0.32, 0.01], { cast: false })
  // coat hooks, plants, side table with the hello card
  plant(b, rng, hw - 0.7, -hd + 0.7, 1.2)
  plant(b, rng, -hw + 0.7, hd - 0.7, 1.0)
  b.box(wood, [1.4, 0.4, 3.9], [1.0, 0.8, 0.4])
  b.collider([1.4, 0.4, 3.9], [1.0, 0.8, 0.4])
}

function shadeColor(c: number, amt: number) {
  const f = (v: number) => Math.max(0, Math.min(255, v + amt))
  return (f((c >> 16) & 255) << 16) | (f((c >> 8) & 255) << 8) | f(c & 255)
}

export function genInteriors(ctx: GenContext) {
  for (const r of Object.values(INTERIORS)) {
    ctx.b.push(r.origin[0], r.origin[1], r.origin[2])
    shell(ctx, r)
    if (r.id === 'education') education(ctx, r)
    else if (r.id === 'office') office(ctx, r)
    else home(ctx, r)
    ctx.b.pop()
  }
}
