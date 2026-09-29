import { FACADE_SETS, PALETTE, type FacadeSet } from '@/data/palette'
import { SHOPS, SIDEWALK_Y, facingYaw, type BuildingDef, type ShopInfo } from '@/data/cityLayout'
import type { PartBuilder } from './partBuilder'
import { createRng, type Rng } from './rng'
import { interiorPainter, signPainter, type AtlasBuilder, type SignStyle } from './textures'

export interface ScreenDef {
  position: [number, number, number]
  yaw: number
  width: number
  height: number
  variant: number
}

export interface GlassPane {
  position: [number, number, number]
  size: [number, number]
  yaw: number
}

export interface SeatDef {
  position: [number, number, number]
  yaw: number
  kind: 'bench' | 'chair' | 'ledge'
}

export interface RectArea {
  x0: number
  x1: number
  z0: number
  z1: number
  y: number
}

export interface WaterDef {
  x: number
  z: number
  r: number
  y: number
  kind: 'fountain' | 'pond'
}

export interface GenContext {
  b: PartBuilder
  signs: AtlasBuilder
  decor: AtlasBuilder
  screens: ScreenDef[]
  lamps: [number, number, number][]
  glassPanes: GlassPane[]
  seats: SeatDef[]
  lawns: RectArea[]
  tiles: RectArea[]
  waters: WaterDef[]
}

const LIT = [PALETTE.windowLit, PALETTE.windowLit2, PALETTE.windowLit3, 0xffc6c0, 0xffe2b0]
const GLASS = [0x7d8fc4, 0x8aa2d2, 0x7686b9, 0x93a9d8, 0x6f94b8]
const ROOF_FLAT = 0x8f8b86 // membrane roof: warm grey

export function lighten(c: number, amt: number) {
  const r = Math.min(255, ((c >> 16) & 255) + amt)
  const g = Math.min(255, ((c >> 8) & 255) + amt)
  const bl = Math.min(255, (c & 255) + amt)
  return (r << 16) | (g << 8) | bl
}
export function darken(c: number, amt: number) {
  const r = Math.max(0, ((c >> 16) & 255) - amt)
  const g = Math.max(0, ((c >> 8) & 255) - amt)
  const bl = Math.max(0, (c & 255) - amt)
  return (r << 16) | (g << 8) | bl
}

export type WindowStyle = 'grid' | 'pair' | 'tall' | 'wide' | 'arched' | 'shuttered'

export interface Spec {
  def: BuildingDef
  w: number
  d: number
  floors: number
  gH: number
  fH: number
  H: number
  pal: FacadeSet
  rng: Rng
  windowStyle: WindowStyle
  litChance: number
  far: boolean
  shop?: ShopInfo
}

// ────────────────────────────────────────────────────────────────────────────
// Small reusable facade elements (all in the current facade frame: facade on
// z = 0, outward normal +z, x along the facade, y up from the ground)
// ────────────────────────────────────────────────────────────────────────────

export function addSign(
  ctx: GenContext, text: string, style: SignStyle, pos: [number, number, number], width: number, height: number,
  board: number | null = null,
) {
  const pxW = 384
  const pxH = Math.max(72, Math.min(192, Math.round((pxW * height) / width)))
  const rect = ctx.signs.add(pxW, pxH, signPainter(text, style), `${text}|${style.bg}|${style.fg}|${pxH}`)
  if (board !== null) ctx.b.box(board, [pos[0], pos[1], pos[2] - 0.05], [width + 0.2, height + 0.2, 0.1])
  ctx.b.add('plane', 0xffffff, [pos[0], pos[1], pos[2] + 0.012], [width, height, 1], { mat: 'signAtlas', uv: rect, cast: false })
}

export function windowUnit(ctx: GenContext, s: Spec, x: number, y: number, ww: number, wh: number, style: WindowStyle, lit: boolean) {
  const { b, } = ctx
  const trim = s.pal.trim
  const paneColor = lit ? s.rng.pick(LIT) : s.rng.pick(GLASS)
  const paneMat = lit ? 'glow' : 'glass'
  if (s.far) {
    b.box(paneColor, [x, y, 0.04], [ww, wh, 0.06], { mat: paneMat, cast: false })
    return
  }
  // frame + pane + sill
  b.box(trim, [x, y, 0.03], [ww + 0.18, wh + 0.18, 0.06], { cast: false })
  b.box(paneColor, [x, y, 0.07], [ww, wh, 0.03], { mat: paneMat, cast: false })
  b.box(trim, [x, y - wh / 2 - 0.1, 0.1], [ww + 0.34, 0.1, 0.2], { cast: false })
  if (style === 'arched') {
    b.add('hcyl', trim, [x, y + wh / 2, 0.03], [ww + 0.18, 0.06, ww + 0.18], { rot: [-Math.PI / 2, 0, 0], cast: false })
    b.add('hcyl', paneColor, [x, y + wh / 2, 0.07], [ww, 0.03, ww], { rot: [-Math.PI / 2, 0, 0], mat: paneMat, cast: false })
  }
  // mullions
  if (style === 'pair' || style === 'tall' || style === 'arched' || ww > 1.3) {
    b.box(trim, [x, y, 0.09], [0.07, wh, 0.03], { cast: false })
  }
  if (style === 'grid' || style === 'wide') b.box(trim, [x, y + wh * 0.18, 0.09], [ww, 0.06, 0.03], { cast: false })
  // curtains on some lit windows
  if (lit && s.rng.chance(0.35)) {
    const cc = s.rng.pick([0xf4c3cc, 0xfbf5ea, 0xbfe3cf, 0xf5dd92, 0xbfaee0])
    b.box(cc, [x - ww * 0.34, y, 0.09], [ww * 0.3, wh * 0.96, 0.02], { mat: 'glow', cast: false })
  }
  if (style === 'shuttered') {
    b.box(s.pal.accent, [x - ww / 2 - 0.3, y, 0.06], [0.42, wh + 0.1, 0.06], { cast: false })
    b.box(s.pal.accent, [x + ww / 2 + 0.3, y, 0.06], [0.42, wh + 0.1, 0.06], { cast: false })
  }
  // window box planters
  if (!lit && s.rng.chance(0.18)) {
    b.box(PALETTE.terracotta, [x, y - wh / 2 - 0.3, 0.22], [ww + 0.1, 0.28, 0.3])
    for (let i = 0; i < 4; i++) {
      const fx = x - ww / 2 + (ww / 3.5) * (i + 0.3)
      b.add('ico', s.rng.pick([PALETTE.leafA, PALETTE.leafB]), [fx, y - wh / 2 - 0.12, 0.24], [0.34, 0.3, 0.3], { mat: 'foliage', cast: false })
      if (i % 2 === 0) b.add('sphere', s.rng.pick([0xff8fb1, 0xfff1a8, 0xffffff, 0xef8a78]), [fx + 0.1, y - wh / 2 - 0.02, 0.33], [0.13, 0.13, 0.13], { cast: false })
    }
  }
}

export function balcony(ctx: GenContext, s: Spec, x: number, y: number, width: number) {
  const { b } = ctx
  const rail = s.rng.chance(0.5) ? PALETTE.charcoal : s.pal.trim
  b.box(s.pal.trim, [x, y, 0.5], [width, 0.14, 1.0])
  b.box(rail, [x, y + 0.95, 0.98], [width, 0.06, 0.06], { cast: false })
  b.box(rail, [x - width / 2 + 0.03, y + 0.5, 0.5], [0.06, 0.9, 1.0], { cast: false })
  b.box(rail, [x + width / 2 - 0.03, y + 0.5, 0.5], [0.06, 0.9, 1.0], { cast: false })
  const n = Math.max(3, Math.round(width / 0.28))
  for (let i = 1; i < n; i++) b.box(rail, [x - width / 2 + (width / n) * i, y + 0.5, 0.98], [0.035, 0.9, 0.035], { cast: false })
  // potted plant
  if (s.rng.chance(0.6)) {
    const px = x + s.rng.range(-width / 3, width / 3)
    b.add('cyl8', PALETTE.terracotta, [px, y + 0.25, 0.55], [0.34, 0.36, 0.34], { cast: false })
    b.add('ico', s.rng.pick([PALETTE.leafA, PALETTE.leafB, PALETTE.leafC]), [px, y + 0.62, 0.55], [0.55, 0.6, 0.55], { mat: 'foliage', cast: false })
  }
}

export function awning(ctx: GenContext, _s: Spec, x: number, top: number, width: number, colorA: number, colorB: number, kind: 'stripe' | 'barrel' | 'solid') {
  const { b } = ctx
  if (kind === 'barrel') {
    b.add('hcyl', colorA, [x, top - 0.5, 0], [1.0, width, 1.8], { rot: [0, 0, Math.PI / 2], mat: 'fabric' })
    b.box(colorB, [x, top - 1.0, 0.86], [width, 0.08, 0.1], { cast: false })
    return
  }
  const len = 1.45
  const theta = 0.42
  const n = kind === 'solid' ? 1 : Math.max(3, Math.round(width / 0.5))
  const sw = width / n
  for (let i = 0; i < n; i++) {
    const c = kind === 'solid' ? colorA : i % 2 === 0 ? colorA : colorB
    const cx = x - width / 2 + sw * (i + 0.5)
    b.box(c, [cx, top - (len / 2) * Math.sin(theta), (len / 2) * Math.cos(theta)], [sw + 0.002, 0.05, len], { rot: [theta, 0, 0], mat: 'fabric' })
    // scalloped valance
    const vz = len * Math.cos(theta)
    const vy = top - len * Math.sin(theta)
    b.box(c, [cx, vy - 0.13, vz], [sw + 0.002, 0.26, 0.04], { mat: 'fabric', cast: false })
    b.add('hcyl', c, [cx, vy - 0.26, vz], [sw * 0.98, 0.04, sw * 0.5], { rot: [Math.PI / 2, 0, 0], mat: 'fabric', cast: false })
  }
  // side cheeks
  for (const sx of [-1, 1]) {
    b.box(colorA, [x + sx * (width / 2), top - (len / 2) * Math.sin(theta) - 0.1, (len / 2) * Math.cos(theta)], [0.04, 0.3, len * 0.95], { rot: [theta, 0, 0], mat: 'fabric', cast: false })
  }
}

export function wallLamp(ctx: GenContext, x: number, y: number) {
  const { b } = ctx
  b.box(PALETTE.charcoal, [x, y, 0.1], [0.16, 0.3, 0.16], { cast: false })
  b.box(PALETTE.lamp, [x, y - 0.05, 0.2], [0.18, 0.2, 0.08], { mat: 'emissive', cast: false })
  const [wx, , wz] = b.toWorld(x, 0, 0.9)
  lightPoolAt(ctx, wx, wz, 1.6, 0xffc58a)
}

/** Warm light decal on the sidewalk, authored in world space. */
export function lightPoolAt(ctx: GenContext, wx: number, wz: number, r: number, color = 0xffd4a0) {
  ctx.b.inWorld(() => {
    ctx.b.add('disk', color, [wx, SIDEWALK_Y + 0.02, wz], [r * 2, 1, r * 2], { mat: 'lightPool', cast: false })
  })
}

export function door(ctx: GenContext, s: Spec, x: number, width = 1.25, height = 2.35, canopy = true) {
  const { b } = ctx
  const leaf = s.rng.pick([PALETTE.walnut, s.pal.accent, PALETTE.charcoal, PALETTE.cocoa])
  b.box(PALETTE.charcoal, [x, height / 2 + 0.1, 0.04], [width + 0.34, height + 0.3, 0.08], { cast: false })
  b.box(s.pal.trim, [x, height / 2 + 0.1, 0.07], [width + 0.2, height + 0.16, 0.05], { cast: false })
  b.box(leaf, [x, height / 2 + 0.05, 0.11], [width, height, 0.05], { cast: false })
  b.box(s.rng.pick(LIT), [x, height * 0.72, 0.14], [width * 0.6, height * 0.3, 0.02], { mat: 'glow', cast: false })
  b.box(PALETTE.butter, [x + width * 0.36, height * 0.48, 0.16], [0.06, 0.28, 0.05], { mat: 'metal', cast: false })
  if (canopy) {
    b.box(s.pal.accent, [x, height + 0.45, 0.5], [width + 0.9, 0.12, 1.0])
    b.box(PALETTE.charcoal, [x - width / 2 - 0.35, height + 0.25, 0.5], [0.05, 0.4, 0.05], { rot: [0.9, 0, 0], cast: false })
    b.box(PALETTE.charcoal, [x + width / 2 + 0.35, height + 0.25, 0.5], [0.05, 0.4, 0.05], { rot: [0.9, 0, 0], cast: false })
  }
  wallLamp(ctx, x - width / 2 - 0.5, height * 0.85)
}

function storefront(ctx: GenContext, s: Spec, facadeW: number, withSign: boolean, sideSign = false) {
  const { b, rng } = { b: ctx.b, rng: s.rng }
  const shop = s.shop
  const gH = s.gH
  const frame = rng.pick([PALETTE.charcoal, s.pal.trim, PALETTE.walnut, s.pal.accent])
  const pil = 0.45
  const inner = facadeW - pil * 2
  // pilasters
  b.box(s.pal.trim, [-facadeW / 2 + pil / 2, gH / 2, 0.12], [pil, gH, 0.26])
  b.box(s.pal.trim, [facadeW / 2 - pil / 2, gH / 2, 0.12], [pil, gH, 0.26])
  // bulkhead
  b.box(darken(s.pal.trim, 18), [0, 0.3, 0.1], [inner, 0.6, 0.2], { cast: false })
  // door position
  const doorW = 1.3
  const doorX = rng.chance(0.5) ? inner / 2 - doorW / 2 - 0.25 : -inner / 2 + doorW / 2 + 0.25
  // display window (painted interior)
  const kind = shop?.kind ?? 'lobby'
  const rect = ctx.decor.add(384, 192, interiorPainter(kind, s.def.seed % 2), `int-${kind}-${s.def.seed % 2}`)
  const winTop = gH - 0.9
  const winBottom = 0.6
  const winH = winTop - winBottom
  // interior spans full inner width; the door sits in front of it
  b.add('plane', 0xffffff, [0, winBottom + winH / 2, 0.05], [inner, winH, 1], { mat: 'decorAtlas', uv: rect, cast: false })
  // mullions
  const mullions = Math.max(1, Math.round(inner / 1.8))
  for (let i = 1; i < mullions; i++) {
    const mx = -inner / 2 + (inner / mullions) * i
    if (Math.abs(mx - doorX) < doorW / 2 + 0.1) continue
    b.box(frame, [mx, winBottom + winH / 2, 0.09], [0.08, winH, 0.06], { cast: false })
  }
  b.box(frame, [0, winTop + 0.04, 0.09], [inner, 0.1, 0.07], { cast: false })
  b.box(frame, [0, winBottom, 0.09], [inner, 0.08, 0.07], { cast: false })
  b.box(frame, [0, winTop - winH * 0.22, 0.09], [inner, 0.05, 0.05], { cast: false })
  // door
  b.box(frame, [doorX, 1.25, 0.1], [doorW + 0.14, 2.5, 0.06], { cast: false })
  b.box(rng.pick(LIT), [doorX, 1.2, 0.13], [doorW - 0.16, 2.2, 0.02], { mat: 'glow', cast: false })
  b.box(PALETTE.butter, [doorX + doorW * 0.3, 1.15, 0.16], [0.05, 0.5, 0.05], { mat: 'metal', cast: false })
  // fascia + sign
  const fasciaY = gH - 0.45
  const fasciaColor = rng.chance(0.5) ? s.pal.accent : darken(s.pal.wall, 22)
  b.box(fasciaColor, [0, fasciaY, 0.16], [facadeW + 0.04, 0.8, 0.3])
  if (shop && withSign) {
    const sw = Math.min(inner * 0.8, 5.2)
    addSign(ctx, shop.name, shop.sign, [0, fasciaY, 0.32], sw, 0.62)
  }
  // awning under the fascia
  const awn = rng.next()
  if (awn < 0.55) awning(ctx, s, 0, gH - 0.85, inner, s.pal.accent, PALETTE.ivory, 'stripe')
  else if (awn < 0.75) awning(ctx, s, 0, gH - 0.85, inner, s.pal.accent, s.pal.trim, 'solid')
  else if (awn < 0.9) awning(ctx, s, 0, gH - 0.85, inner * 0.9, s.pal.accent, s.pal.trim, 'barrel')
  // projecting blade sign
  if (shop && (sideSign || rng.chance(0.35))) {
    const bx = facadeW / 2 - 0.2
    b.box(PALETTE.charcoal, [bx, gH + 0.35, 0.45], [0.05, 0.05, 0.9], { cast: false })
    const style = { ...shop.sign, sub: undefined }
    b.push(bx, gH - 0.25, 0.9, Math.PI / 2)
    addSign(ctx, shop.name.split(' ')[0], style, [0, 0, 0.03], 1.2, 0.95, null)
    b.pop()
    b.push(bx, gH - 0.25, 0.9, -Math.PI / 2)
    addSign(ctx, shop.name.split(' ')[0], style, [0, 0, 0.03], 1.2, 0.95, null)
    b.pop()
    b.box(fasciaColor, [bx, gH - 0.25, 0.9], [0.05, 1.05, 1.3], { cast: false })
  }
  // warm light spilling onto the sidewalk
  const [wx, , wz] = b.toWorld(0, 0, 1.4)
  lightPoolAt(ctx, wx, wz, Math.min(3.2, facadeW * 0.35), 0xffc796)
  // sidewalk dressing
  shopDressing(ctx, s, facadeW)
}

function shopDressing(ctx: GenContext, s: Spec, facadeW: number) {
  const { b } = ctx
  const kind = s.shop?.kind
  const rng = s.rng
  const x = rng.chance(0.5) ? -facadeW / 2 + 1.1 : facadeW / 2 - 1.1
  if (kind === 'florist') {
    for (let i = 0; i < 4; i++) {
      const fx = x + (i - 1.5) * 0.55
      b.add('cyl8', PALETTE.slate, [fx, 0.22, 0.75], [0.36, 0.44, 0.36])
      b.add('ico', rng.pick([PALETTE.leafD, 0xfff1a8, 0xffffff, PALETTE.coral]), [fx, 0.6, 0.75], [0.55, 0.45, 0.55], { mat: 'foliage' })
    }
    b.collider([x, 0.4, 0.75], [2.3, 0.8, 0.5])
  } else if (kind === 'grocery' || kind === 'bakery') {
    b.box(PALETTE.walnut, [x, 0.45, 0.8], [1.6, 0.08, 0.7])
    b.box(PALETTE.walnut, [x - 0.7, 0.22, 0.8], [0.08, 0.45, 0.6])
    b.box(PALETTE.walnut, [x + 0.7, 0.22, 0.8], [0.08, 0.45, 0.6])
    for (let i = 0; i < 6; i++) b.add('sphere', rng.pick([0xef8a78, 0xf5dd92, 0x7cbf6a, 0xf39a4a]), [x - 0.6 + i * 0.24, 0.58, 0.8 + (i % 2) * 0.15], [0.2, 0.2, 0.2], { cast: false })
    b.collider([x, 0.35, 0.8], [1.6, 0.7, 0.7])
  } else if (kind === 'cafe' || kind === 'noodle') {
    // A-frame chalkboard
    b.box(PALETTE.charcoal, [x, 0.5, 0.95], [0.62, 0.95, 0.05], { rot: [0.18, 0, 0] })
    b.box(PALETTE.charcoal, [x, 0.5, 0.75], [0.62, 0.95, 0.05], { rot: [-0.18, 0, 0] })
    b.box(PALETTE.ivory, [x, 0.55, 0.99], [0.4, 0.3, 0.01], { rot: [0.18, 0, 0], mat: 'glow', cast: false })
  } else if (kind === 'books') {
    b.box(PALETTE.walnut, [x, 0.5, 0.75], [1.1, 1.0, 0.45])
    for (let i = 0; i < 7; i++) b.box(rng.pick([0x2f3fb8, 0xe0506a, 0x4fb3a9, 0xf5dd92]), [x - 0.45 + i * 0.15, 0.82, 0.8], [0.12, 0.34, 0.3], { cast: false })
    b.collider([x, 0.5, 0.75], [1.1, 1.0, 0.45])
  } else if (kind === 'boutique' && rng.chance(0.6)) {
    // plant pair
    for (const px of [-facadeW / 2 + 0.7, facadeW / 2 - 0.7]) {
      b.add('cyl', PALETTE.ivory, [px, 0.35, 0.6], [0.55, 0.7, 0.55])
      b.add('ico', PALETTE.leafB, [px, 1.05, 0.6], [0.8, 1.0, 0.8], { mat: 'foliage' })
    }
  }
}

function sideDetails(ctx: GenContext, s: Spec, facadeW: number, floorFrom: number) {
  const { b } = ctx
  // AC units hanging under a few side windows
  if (s.far) return
  const count = s.rng.int(0, 2)
  for (let i = 0; i < count; i++) {
    const f = s.rng.int(floorFrom, s.floors - 1)
    const y = s.gH + (f - 1) * s.fH + 0.35
    const x = s.rng.range(-facadeW / 2 + 1, facadeW / 2 - 1)
    b.box(0xe8e4ee, [x, y, 0.28], [0.85, 0.55, 0.5])
    b.add('cyl', 0x8c86a3, [x + 0.12, y, 0.54], [0.38, 0.03, 0.38], { rot: [Math.PI / 2, 0, 0], cast: false })
  }
}

export function facadeWindows(ctx: GenContext, s: Spec, facadeW: number, opts: { groundFloor: boolean; primary: boolean; style: WindowStyle; balconies: boolean }) {
  const { b } = ctx
  const style = opts.style
  const unitW = style === 'pair' ? 2.8 : style === 'wide' ? 3.2 : style === 'tall' ? 2.5 : 2.2
  const n = Math.max(1, Math.floor((facadeW - 0.8) / unitW))
  const spacing = facadeW / n
  const ww = style === 'pair' ? 1.9 : style === 'wide' ? 2.4 : style === 'tall' ? 1.15 : style === 'arched' ? 1.1 : 1.15
  const wh = style === 'tall' ? 2.0 : style === 'wide' ? 1.3 : 1.45
  for (let f = opts.groundFloor ? 0 : 1; f < s.floors; f++) {
    const base = f === 0 ? 0 : s.gH + (f - 1) * s.fH
    const floorH = f === 0 ? s.gH : s.fH
    const y = base + floorH * (style === 'tall' ? 0.45 : 0.52)
    for (let i = 0; i < n; i++) {
      const x = -facadeW / 2 + spacing * (i + 0.5)
      const lit = s.rng.chance(s.litChance)
      windowUnit(ctx, s, x, y, ww, wh, style, lit)
      if (opts.balconies && f > 0 && (i + f) % 2 === 0 && opts.primary) balcony(ctx, s, x, base + 0.05, Math.min(spacing - 0.3, ww + 1.0))
    }
  }
  if (opts.primary && !s.far) {
    // drainpipes at the corners
    b.add('cyl8', darken(s.pal.trim, 30), [facadeW / 2 - 0.12, s.H / 2, 0.12], [0.12, s.H, 0.12], { cast: false })
  }
}

// ────────────────────────────────────────────────────────────────────────────
// Rooftops
// ────────────────────────────────────────────────────────────────────────────

export function flatRoof(ctx: GenContext, s: Spec) {
  const { b, } = ctx
  const { w, d, H, pal, rng } = s
  b.box(pal.trim, [0, H + 0.12, 0], [w + 0.34, 0.24, d + 0.34])
  const ph = 0.55
  const t = 0.24
  b.box(pal.wall, [0, H + 0.24 + ph / 2, d / 2 - t / 2 + 0.1], [w + 0.1, ph, t])
  b.box(pal.wall, [0, H + 0.24 + ph / 2, -d / 2 + t / 2 - 0.1], [w + 0.1, ph, t])
  b.box(pal.wall, [w / 2 - t / 2 + 0.1, H + 0.24 + ph / 2, 0], [t, ph, d])
  b.box(pal.wall, [-w / 2 + t / 2 - 0.1, H + 0.24 + ph / 2, 0], [t, ph, d])
  b.box(pal.trim, [0, H + 0.24 + ph + 0.04, d / 2 - t / 2 + 0.1], [w + 0.2, 0.08, t + 0.08], { cast: false })
  b.box(ROOF_FLAT, [0, H + 0.26, 0], [w - 0.3, 0.05, d - 0.3], { cast: false })
  if (s.far) return
  const props = rng.int(1, 4)
  for (let i = 0; i < props; i++) {
    const px = rng.range(-w / 2 + 1.4, w / 2 - 1.4)
    const pz = rng.range(-d / 2 + 1.4, d / 2 - 1.8)
    const k = rng.next()
    if (k < 0.4) {
      b.box(0xc9c6c0, [px, H + 0.6, pz], [1.2, 0.7, 0.9])
      b.add('cyl', 0x7d7a76, [px, H + 0.97, pz], [0.7, 0.04, 0.7], { cast: false })
    } else if (k < 0.6 && s.floors >= 4) {
      // water tank
      b.add('cyl', PALETTE.cocoa, [px, H + 1.9, pz], [1.5, 1.6, 1.5])
      b.add('cone', PALETTE.walnut, [px, H + 2.95, pz], [1.6, 0.5, 1.6])
      for (const [lx, lz] of [[-0.5, -0.5], [0.5, -0.5], [-0.5, 0.5], [0.5, 0.5]]) b.box(PALETTE.charcoal, [px + lx, H + 0.7, pz + lz], [0.08, 0.9, 0.08], { cast: false })
    } else if (k < 0.75) {
      // stair hut
      b.box(lighten(pal.wall, 10), [px, H + 1.35, pz], [2.0, 2.2, 1.8])
      b.box(pal.trim, [px, H + 2.5, pz], [2.2, 0.12, 2.0])
      b.box(PALETTE.charcoal, [px, H + 1.2, pz + 0.91], [0.8, 1.7, 0.03], { cast: false })
    } else if (k < 0.88) {
      // solar panels
      for (let j = 0; j < 3; j++) b.box(0x2c3544, [px + j * 1.1 - 1.1, H + 0.75, pz], [1.0, 0.05, 1.5], { rot: [-0.45, 0, 0], mat: 'glass' })
    } else {
      // antenna + dish
      b.add('cyl8', PALETTE.slate, [px, H + 1.6, pz], [0.06, 2.6, 0.06], { cast: false })
      b.add('sphere', 0xf6ecdc, [px + 0.5, H + 1.0, pz], [0.8, 0.8, 0.25], { rot: [0.3, 0.6, 0] })
    }
  }
  // rooftop greenery
  if (rng.chance(0.35)) {
    for (let i = 0; i < 3; i++) b.add('ico', rng.pick([PALETTE.leafA, PALETTE.leafB]), [-w / 2 + 1 + i * 0.9, H + 0.7, d / 2 - 0.9], [0.8, 0.7, 0.8], { mat: 'foliage', cast: false })
  }
}

export function gableRoof(ctx: GenContext, s: Spec) {
  const { b } = ctx
  const { w, d, H, pal, rng } = s
  const roofH = Math.min(3.2, d * 0.32)
  b.box(pal.trim, [0, H + 0.1, 0], [w + 0.4, 0.2, d + 0.4])
  // ridge parallel to the facade (along x)
  b.add('prism', pal.roof, [0, H + 0.2 + roofH / 2, 0], [d + 0.8, roofH, w + 0.6], { rot: [0, Math.PI / 2, 0] })
  // chimney
  const cx = rng.range(-w / 3, w / 3)
  b.box(PALETTE.brick, [cx, H + roofH * 0.9, -d * 0.18], [0.7, roofH * 1.1, 0.7])
  b.box(PALETTE.charcoal, [cx, H + roofH * 1.47, -d * 0.18], [0.85, 0.14, 0.85])
  // dormers on the front slope
  if (w > 7 && rng.chance(0.7)) {
    const n = w > 10 ? 2 : 1
    for (let i = 0; i < n; i++) {
      const dx = n === 1 ? 0 : (i - 0.5) * w * 0.45
      const z = d * 0.2
      const y = H + roofH * 0.42
      b.box(pal.wall, [dx, y, z], [1.6, 1.3, 1.4])
      b.add('prism', pal.roof, [dx, y + 0.95, z], [1.9, 0.7, 1.6])
      b.box(pal.trim, [dx, y - 0.05, z + 0.71], [1.0, 0.95, 0.04], { cast: false })
      b.box(rng.chance(0.5) ? rng.pick(LIT) : rng.pick(GLASS), [dx, y - 0.05, z + 0.74], [0.8, 0.8, 0.03], { mat: 'glow', cast: false })
    }
  }
}

// ────────────────────────────────────────────────────────────────────────────
// Building styles
// ────────────────────────────────────────────────────────────────────────────

function withSide(ctx: GenContext, s: Spec, side: 'front' | 'back' | 'left' | 'right', fn: (facadeW: number) => void) {
  const { b } = ctx
  const { w, d } = s
  switch (side) {
    case 'front': b.push(0, 0, d / 2, 0); fn(w); break
    case 'back': b.push(0, 0, -d / 2, Math.PI); fn(w); break
    case 'right': b.push(w / 2, 0, 0, Math.PI / 2); fn(d); break
    case 'left': b.push(-w / 2, 0, 0, -Math.PI / 2); fn(d); break
  }
  b.pop()
}

function body(ctx: GenContext, s: Spec) {
  const { b } = ctx
  const { w, d, H, gH, pal, rng } = s
  b.box(pal.wall, [0, H / 2, 0], [w, H, d])
  const twoTone = !s.far && rng.chance(0.45)
  if (twoTone) {
    const g = rng.pick([pal.trim === PALETTE.ivory ? lighten(pal.wall, 18) : pal.trim, darken(pal.wall, 24), PALETTE.stone])
    b.box(g, [0, gH / 2, 0], [w + 0.06, gH, d + 0.06])
  }
  b.box(darken(pal.wall, 40), [0, 0.18, 0], [w + 0.12, 0.36, d + 0.12], { cast: false })
  // floor cornices
  b.box(pal.trim, [0, gH, 0], [w + 0.18, 0.18, d + 0.18], { cast: false })
  if (!s.far && rng.chance(0.5)) {
    for (let f = 2; f < s.floors; f++) b.box(pal.trim, [0, gH + (f - 1) * s.fH, 0], [w + 0.1, 0.1, d + 0.1], { cast: false })
  }
  // corner quoins / pilasters
  if (!s.far && rng.chance(0.4)) {
    for (const sx of [-1, 1]) b.box(pal.trim, [sx * (w / 2 - 0.15), H / 2 + gH / 2, d / 2 - 0.15], [0.4, H - gH, 0.4], { cast: false })
  }
}

function genericBuilding(ctx: GenContext, s: Spec) {
  const { def } = s
  body(ctx, s)
  const primaryStyle = s.windowStyle
  const hasShop = !!s.shop && def.style !== 'tower'
  // front
  withSide(ctx, s, 'front', (fw) => {
    if (def.style === 'tower') {
      facadeWindows(ctx, s, fw, { groundFloor: false, primary: true, style: 'wide', balconies: false })
      return
    }
    if (hasShop && (def.style === 'shop' || def.style === 'corner')) storefront(ctx, s, fw, true)
    else if (hasShop && fw >= 9) {
      // mixed-use: shop on one side, lobby door on the other
      ctx.b.push(-fw * 0.18, 0, 0)
      storefront(ctx, s, fw * 0.62, true)
      ctx.b.pop()
      door(ctx, s, fw * 0.36, 1.2)
    } else if (hasShop) storefront(ctx, s, fw, true)
    else {
      door(ctx, s, 0, 1.3)
      const side = fw / 2 - 1.8
      if (side > 1.4) {
        windowUnit(ctx, s, -side / 2 - 1.1, s.gH * 0.5, 1.2, 1.5, 'grid', s.rng.chance(0.5))
        windowUnit(ctx, s, side / 2 + 1.1, s.gH * 0.5, 1.2, 1.5, 'grid', s.rng.chance(0.5))
      }
    }
    facadeWindows(ctx, s, fw, { groundFloor: false, primary: true, style: primaryStyle, balconies: def.style === 'apartment' && s.rng.chance(0.55) })
    // bay window on some apartments
    if (def.style === 'apartment' && s.floors >= 4 && !s.far && s.rng.chance(0.4)) {
      const bx = s.rng.chance(0.5) ? -fw / 4 : fw / 4
      const bh = (s.floors - 2) * s.fH
      const by = s.gH + s.fH * 0.1 + bh / 2
      ctx.b.box(lighten(s.pal.wall, 8), [bx, by, 0.35], [2.2, bh, 0.7])
      ctx.b.box(s.pal.trim, [bx, by + bh / 2 + 0.08, 0.38], [2.4, 0.16, 0.8])
      for (let f = 0; f < s.floors - 2; f++) {
        const wy = s.gH + s.fH * 0.1 + f * s.fH + s.fH * 0.5
        ctx.b.push(bx, 0, 0.7)
        windowUnit(ctx, s, 0, wy, 1.5, 1.4, 'pair', s.rng.chance(s.litChance))
        ctx.b.pop()
      }
    }
  })
  // sides
  const sideStyle: WindowStyle = s.windowStyle === 'wide' ? 'wide' : 'grid'
  const rightIsCorner = def.style === 'corner'
  withSide(ctx, s, 'right', (fw) => {
    if (rightIsCorner && s.shop) {
      storefront(ctx, s, fw, false, true)
      facadeWindows(ctx, s, fw, { groundFloor: false, primary: false, style: sideStyle, balconies: false })
    } else {
      facadeWindows(ctx, s, fw, { groundFloor: !s.far, primary: false, style: sideStyle, balconies: false })
      sideDetails(ctx, s, fw, 1)
    }
  })
  withSide(ctx, s, 'left', (fw) => {
    facadeWindows(ctx, s, fw, { groundFloor: !s.far, primary: false, style: sideStyle, balconies: false })
    sideDetails(ctx, s, fw, 1)
  })
  if (!def.backdrop && !s.far) {
    withSide(ctx, s, 'back', (fw) => facadeWindows(ctx, s, fw, { groundFloor: false, primary: false, style: 'grid', balconies: false }))
  }
  // corner turret
  if (def.style === 'corner' && !s.far) {
    const tx = s.w / 2 - 0.9
    const tz = s.d / 2 - 0.9
    const th = s.H - s.gH
    ctx.b.add('cyl', lighten(s.pal.wall, 10), [tx + 0.5, s.gH + th / 2, tz + 0.5], [2.6, th, 2.6])
    ctx.b.add('cone6', s.pal.accent, [tx + 0.5, s.H + 1.2, tz + 0.5], [3.0, 2.2, 3.0])
    ctx.b.add('cyl', s.pal.trim, [tx + 0.5, s.H + 0.08, tz + 0.5], [2.9, 0.16, 2.9], { cast: false })
    for (let f = 1; f < s.floors; f++) {
      const y = s.gH + (f - 1) * s.fH + s.fH * 0.52
      for (const a of [0, Math.PI / 4, Math.PI / 2]) {
        ctx.b.push(tx + 0.5 + Math.sin(a) * 1.3, 0, tz + 0.5 + Math.cos(a) * 1.3, a)
        windowUnit(ctx, s, 0, y, 0.8, 1.3, 'grid', s.rng.chance(s.litChance))
        ctx.b.pop()
      }
    }
  }
  if (def.style === 'townhouse') gableRoof(ctx, s)
  else if (def.style === 'tower') towerCrown(ctx, s)
  else flatRoof(ctx, s)
}

function towerCrown(ctx: GenContext, s: Spec) {
  const { b } = ctx
  const { w, d, H, pal, rng } = s
  b.box(pal.trim, [0, H + 0.2, 0], [w + 0.3, 0.4, d + 0.3])
  const k = rng.next()
  if (k < 0.4) {
    b.box(lighten(pal.wall, 12), [0, H + 1.6, 0], [w * 0.6, 2.8, d * 0.6])
    b.box(pal.accent, [0, H + 3.1, 0], [w * 0.64, 0.25, d * 0.64])
  } else if (k < 0.7) {
    b.add('cyl8', PALETTE.slate, [0, H + 3, 0], [0.2, 6, 0.2], { cast: false })
    b.add('sphere', 0xff6a6a, [0, H + 6.1, 0], [0.35, 0.35, 0.35], { mat: 'emissive', cast: false })
  } else {
    b.add('prism', pal.roof, [0, H + 1.5, 0], [d, 2.6, w], { rot: [0, Math.PI / 2, 0] })
  }
}

// ────────────────────────────────────────────────────────────────────────────

export function buildSpec(def: BuildingDef): Spec {
  const rng = createRng(def.seed)
  const pal = FACADE_SETS[(def.palette ?? def.seed) % FACADE_SETS.length]
  const gH = def.style === 'apartment' ? 3.5 : 3.8
  const fH = def.style === 'tower' ? 3.2 : 3.0
  const styles: WindowStyle[] =
    def.style === 'townhouse' ? ['shuttered', 'arched', 'grid']
      : def.style === 'tower' ? ['wide']
        : def.style === 'shop' ? ['pair', 'arched', 'grid', 'shuttered']
          : ['grid', 'tall', 'pair', 'arched', 'grid']
  return {
    def, w: def.w, d: def.d, floors: def.floors, gH, fH, H: gH + (def.floors - 1) * fH, pal, rng,
    windowStyle: rng.pick(styles),
    litChance: def.backdrop ? 0.12 : 0.14,
    far: !!def.backdrop,
    shop: def.shop ? SHOPS[def.shop] : undefined,
  }
}

export function buildingHeight(def: BuildingDef) {
  const s = buildSpec(def)
  return s.H
}

/** Generate a regular (non-special) building into the part builder. */
export function generateBuilding(ctx: GenContext, def: BuildingDef) {
  const s = buildSpec(def)
  ctx.b.push(def.x, SIDEWALK_Y, def.z, facingYaw(def.facing))
  genericBuilding(ctx, s)
  if (!def.backdrop) ctx.b.collider([0, s.H / 2, 0], [def.w, s.H, def.d])
  ctx.b.pop()
}
