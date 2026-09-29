import { CanvasTexture, LinearMipmapLinearFilter, RepeatWrapping, SRGBColorSpace, type Texture } from 'three'
import { createRng } from './rng'

/** All surface textures are painted procedurally on canvases — no downloads required. */

function canvas(w: number, h: number) {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const ctx = c.getContext('2d')!
  return { c, ctx }
}

function toTexture(c: HTMLCanvasElement, repeat = true): CanvasTexture {
  const t = new CanvasTexture(c)
  t.colorSpace = SRGBColorSpace
  t.anisotropy = 8
  t.minFilter = LinearMipmapLinearFilter
  if (repeat) t.wrapS = t.wrapT = RepeatWrapping
  t.needsUpdate = true
  return t
}

const memo = new Map<string, CanvasTexture>()
function once(key: string, make: () => CanvasTexture) {
  let t = memo.get(key)
  if (!t) {
    t = make()
    memo.set(key, t)
  }
  return t
}

function hex(n: number) {
  return '#' + n.toString(16).padStart(6, '0')
}

function shade(color: string, amt: number) {
  const n = parseInt(color.slice(1), 16)
  const r = Math.max(0, Math.min(255, ((n >> 16) & 255) + amt))
  const g = Math.max(0, Math.min(255, ((n >> 8) & 255) + amt))
  const b = Math.max(0, Math.min(255, (n & 255) + amt))
  return `rgb(${r},${g},${b})`
}

/** Herringbone sidewalk pavers in soft pink/lavender. One tile = 2 m. */
export function paverTexture() {
  return once('paver', () => {
    const S = 512
    const { c, ctx } = canvas(S, S)
    const rng = createRng(7)
    ctx.fillStyle = '#b89fbe'
    ctx.fillRect(0, 0, S, S)
    // seamless basket-weave: 2u x 2u cells alternating two horizontal / two vertical bricks
    const u = S / 16
    const tones = ['#dcc3dc', '#d4bad6', '#e2cde0', '#cfb5d2', '#dbc1d8', '#e6d2e3']
    const cells = S / (2 * u)
    for (let i = 0; i < cells; i++) {
      for (let j = 0; j < cells; j++) {
        const x = i * 2 * u
        const y = j * 2 * u
        const horiz = (i + j) % 2 === 0
        for (let k = 0; k < 2; k++) {
          ctx.fillStyle = tones[Math.floor(rng.next() * tones.length)]
          if (horiz) ctx.fillRect(x + 2, y + k * u + 2, 2 * u - 4, u - 4)
          else ctx.fillRect(x + k * u + 2, y + 2, u - 4, 2 * u - 4)
        }
      }
    }
    // subtle grain
    for (let k = 0; k < 3500; k++) {
      ctx.fillStyle = `rgba(90,60,110,${rng.range(0.02, 0.07)})`
      ctx.fillRect(rng.next() * S, rng.next() * S, 2, 2)
    }
    return toTexture(c)
  })
}

/** Square stone tiles for plazas and the promenade. One tile = 4 m. */
export function tileTexture() {
  return once('tile', () => {
    const S = 512
    const { c, ctx } = canvas(S, S)
    const rng = createRng(11)
    ctx.fillStyle = '#b7a4c6'
    ctx.fillRect(0, 0, S, S)
    const n = 4
    const t = S / n
    const tones = ['#e8d8e6', '#e0cfe4', '#eedcdc', '#dccde6', '#e6d6e0']
    for (let i = 0; i < n; i++)
      for (let j = 0; j < n; j++) {
        ctx.fillStyle = (i + j) % 3 === 0 ? '#cfc0e6' : tones[Math.floor(rng.next() * tones.length)]
        ctx.fillRect(i * t + 3, j * t + 3, t - 6, t - 6)
      }
    for (let k = 0; k < 2500; k++) {
      ctx.fillStyle = `rgba(110,80,130,${rng.range(0.02, 0.06)})`
      ctx.fillRect(rng.next() * S, rng.next() * S, 2, 2)
    }
    return toTexture(c)
  })
}

/** Blue mosaic used for the park stream and fountain basins. */
export function mosaicTexture() {
  return once('mosaic', () => {
    const S = 256
    const { c, ctx } = canvas(S, S)
    const rng = createRng(5)
    ctx.fillStyle = '#6f98d6'
    ctx.fillRect(0, 0, S, S)
    const n = 12
    const t = S / n
    const tones = ['#9cc4f0', '#b9d8f7', '#7fb0e8', '#d6e8fb', '#8fb8ee', '#a7cbf2']
    for (let i = 0; i < n; i++)
      for (let j = 0; j < n; j++) {
        ctx.fillStyle = tones[Math.floor(rng.next() * tones.length)]
        ctx.fillRect(i * t + 1.5, j * t + 1.5, t - 3, t - 3)
      }
    return toTexture(c)
  })
}

export function asphaltTexture() {
  return once('asphalt', () => {
    const S = 512
    const { c, ctx } = canvas(S, S)
    const rng = createRng(3)
    ctx.fillStyle = '#655d7d'
    ctx.fillRect(0, 0, S, S)
    for (let k = 0; k < 16000; k++) {
      const v = rng.next()
      ctx.fillStyle = v > 0.5 ? `rgba(255,240,255,${rng.range(0.02, 0.08)})` : `rgba(30,20,50,${rng.range(0.03, 0.1)})`
      const s = rng.range(1, 3)
      ctx.fillRect(rng.next() * S, rng.next() * S, s, s)
    }
    // soft patches
    for (let k = 0; k < 14; k++) {
      const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 1)
      g.addColorStop(0, 'rgba(40,30,60,0.10)')
      g.addColorStop(1, 'rgba(40,30,60,0)')
      ctx.save()
      ctx.translate(rng.next() * S, rng.next() * S)
      ctx.scale(rng.range(30, 90), rng.range(20, 60))
      ctx.fillStyle = g
      ctx.beginPath()
      ctx.arc(0, 0, 1, 0, Math.PI * 2)
      ctx.fill()
      ctx.restore()
    }
    return toTexture(c)
  })
}

export function grassTexture() {
  return once('grass', () => {
    const S = 512
    const { c, ctx } = canvas(S, S)
    const rng = createRng(9)
    ctx.fillStyle = '#93c47d'
    ctx.fillRect(0, 0, S, S)
    for (let k = 0; k < 9000; k++) {
      const v = rng.next()
      ctx.strokeStyle = v > 0.5 ? `rgba(200,240,160,${rng.range(0.08, 0.2)})` : `rgba(50,110,60,${rng.range(0.08, 0.2)})`
      ctx.lineWidth = 1.4
      const x = rng.next() * S
      const y = rng.next() * S
      ctx.beginPath()
      ctx.moveTo(x, y)
      ctx.lineTo(x + rng.range(-2, 2), y - rng.range(3, 7))
      ctx.stroke()
    }
    for (let k = 0; k < 40; k++) {
      ctx.fillStyle = ['#ffffff', '#ffd6e4', '#fff1a8'][k % 3]
      ctx.beginPath()
      ctx.arc(rng.next() * S, rng.next() * S, 2.2, 0, Math.PI * 2)
      ctx.fill()
    }
    return toTexture(c)
  })
}

export function lightPoolTexture() {
  return once('lightpool', () => {
    const S = 128
    const { c, ctx } = canvas(S, S)
    const g = ctx.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2)
    g.addColorStop(0, 'rgba(255,214,160,0.9)')
    g.addColorStop(0.35, 'rgba(255,196,140,0.45)')
    g.addColorStop(1, 'rgba(255,180,130,0)')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, S, S)
    return toTexture(c, false)
  })
}

export function blobShadowTexture() {
  return once('blob', () => {
    const S = 128
    const { c, ctx } = canvas(S, S)
    const g = ctx.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2)
    g.addColorStop(0, 'rgba(40,20,70,0.55)')
    g.addColorStop(0.6, 'rgba(40,20,70,0.22)')
    g.addColorStop(1, 'rgba(40,20,70,0)')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, S, S)
    return toTexture(c, false)
  })
}

export function softDotTexture() {
  return once('dot', () => {
    const S = 64
    const { c, ctx } = canvas(S, S)
    const g = ctx.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2)
    g.addColorStop(0, 'rgba(255,255,255,1)')
    g.addColorStop(0.4, 'rgba(255,255,255,0.5)')
    g.addColorStop(1, 'rgba(255,255,255,0)')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, S, S)
    return toTexture(c, false)
  })
}

// ---------------------------------------------------------------------------
// Atlas builder: packs many small canvases (signs, shop interiors, artworks)
// into one texture so they can share a single instanced draw call.
// ---------------------------------------------------------------------------

export type AtlasRect = [number, number, number, number]
type DrawFn = (ctx: CanvasRenderingContext2D, w: number, h: number) => void

export class AtlasBuilder {
  private items: { w: number; h: number; draw: DrawFn; rect: AtlasRect; key?: string }[] = []
  private keyed = new Map<string, AtlasRect>()
  readonly size: [number, number]
  constructor(width: number, height: number) {
    this.size = [width, height]
  }

  /** Reserve a region; returns a rect filled in during build(). Reuses rects for identical keys. */
  add(w: number, h: number, draw: DrawFn, key?: string): AtlasRect {
    if (key && this.keyed.has(key)) return this.keyed.get(key)!
    const rect: AtlasRect = [0, 0, 0, 0]
    this.items.push({ w, h, draw, rect, key })
    if (key) this.keyed.set(key, rect)
    return rect
  }

  build(): Texture {
    const [W, H] = this.size
    const { c, ctx } = canvas(W, H)
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, W, H)
    // shelf packing, tallest first
    const sorted = [...this.items].sort((a, b) => b.h - a.h)
    let x = 0
    let y = 0
    let rowH = 0
    const pad = 4
    for (const it of sorted) {
      let w = it.w
      let h = it.h
      if (x + w + pad > W) {
        x = 0
        y += rowH + pad
        rowH = 0
      }
      if (y + h + pad > H) {
        // out of space: shrink into a tiny fallback slot rather than crash
        console.warn(`[atlas] ${W}x${H} out of space, item scaled down`)
        w = Math.min(w, 64)
        h = Math.min(h, 32)
        x = W - w - 1
        y = H - h - 1
      }
      ctx.save()
      ctx.translate(x, y)
      ctx.beginPath()
      ctx.rect(0, 0, w, h)
      ctx.clip()
      it.draw(ctx, w, h)
      ctx.restore()
      // uv origin bottom-left (flipY texture)
      it.rect[0] = (x + 0.5) / W
      it.rect[1] = 1 - (y + h - 0.5) / H
      it.rect[2] = (w - 1) / W
      it.rect[3] = (h - 1) / H
      x += w + pad
      rowH = Math.max(rowH, h)
    }
    const t = toTexture(c, false)
    t.anisotropy = 8
    return t
  }
}

// ---------------------------------------------------------------------------
// Painters used by the city generator
// ---------------------------------------------------------------------------

export const UI_FONT = '"Outfit Variable", "Outfit", "Inter Variable", system-ui, sans-serif'
export const GREEK_FONT = '"Inter Variable", "Inter", system-ui, sans-serif'

export interface SignStyle {
  bg: string
  fg: string
  border?: string
  font?: string
  weight?: number
  italic?: boolean
  icon?: 'cup' | 'leaf' | 'star' | 'heart' | 'moon' | 'bolt' | 'note' | 'none'
  shape?: 'rect' | 'pill' | 'round'
  sub?: string
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

function drawIcon(ctx: CanvasRenderingContext2D, icon: SignStyle['icon'], cx: number, cy: number, s: number, color: string) {
  ctx.save()
  ctx.fillStyle = color
  ctx.strokeStyle = color
  ctx.lineWidth = s * 0.12
  ctx.translate(cx, cy)
  switch (icon) {
    case 'cup':
      roundRect(ctx, -s * 0.4, -s * 0.25, s * 0.65, s * 0.6, s * 0.12)
      ctx.fill()
      ctx.beginPath()
      ctx.arc(s * 0.32, s * 0.05, s * 0.16, -Math.PI / 2, Math.PI / 2)
      ctx.stroke()
      ctx.beginPath()
      ctx.moveTo(-s * 0.2, -s * 0.4)
      ctx.quadraticCurveTo(-s * 0.05, -s * 0.55, -s * 0.15, -s * 0.7)
      ctx.stroke()
      break
    case 'leaf':
      ctx.beginPath()
      ctx.ellipse(0, 0, s * 0.22, s * 0.45, Math.PI / 5, 0, Math.PI * 2)
      ctx.fill()
      break
    case 'star':
      ctx.beginPath()
      for (let i = 0; i < 10; i++) {
        const r = i % 2 ? s * 0.2 : s * 0.46
        const a = (i / 10) * Math.PI * 2 - Math.PI / 2
        ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r)
      }
      ctx.fill()
      break
    case 'heart':
      ctx.beginPath()
      ctx.moveTo(0, s * 0.35)
      ctx.bezierCurveTo(-s * 0.6, -s * 0.05, -s * 0.25, -s * 0.5, 0, -s * 0.18)
      ctx.bezierCurveTo(s * 0.25, -s * 0.5, s * 0.6, -s * 0.05, 0, s * 0.35)
      ctx.fill()
      break
    case 'moon':
      ctx.beginPath()
      ctx.arc(0, 0, s * 0.4, 0, Math.PI * 2)
      ctx.fill()
      ctx.globalCompositeOperation = 'destination-out'
      ctx.beginPath()
      ctx.arc(s * 0.18, -s * 0.12, s * 0.34, 0, Math.PI * 2)
      ctx.fill()
      break
    case 'bolt':
      ctx.beginPath()
      ctx.moveTo(s * 0.1, -s * 0.5)
      ctx.lineTo(-s * 0.25, s * 0.05)
      ctx.lineTo(0, s * 0.05)
      ctx.lineTo(-s * 0.1, s * 0.5)
      ctx.lineTo(s * 0.25, -s * 0.05)
      ctx.lineTo(0, -s * 0.05)
      ctx.closePath()
      ctx.fill()
      break
    case 'note':
      ctx.beginPath()
      ctx.ellipse(-s * 0.15, s * 0.28, s * 0.16, s * 0.12, -0.4, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillRect(-s * 0.02, -s * 0.45, s * 0.08, s * 0.75)
      ctx.fillRect(-s * 0.02, -s * 0.45, s * 0.3, s * 0.1)
      break
    default:
      break
  }
  ctx.restore()
}

export function signPainter(text: string, style: SignStyle): DrawFn {
  return (ctx, w, h) => {
    const r = style.shape === 'pill' ? h / 2 : style.shape === 'round' ? h * 0.22 : h * 0.08
    ctx.clearRect(0, 0, w, h)
    ctx.fillStyle = style.border ?? style.bg
    roundRect(ctx, 0, 0, w, h, r)
    ctx.fill()
    ctx.fillStyle = style.bg
    const b = style.border ? h * 0.06 : 0
    roundRect(ctx, b, b, w - b * 2, h - b * 2, Math.max(0, r - b))
    ctx.fill()
    const hasIcon = style.icon && style.icon !== 'none'
    const iconSize = h * 0.62
    const weight = style.weight ?? 700
    let size = h * (style.sub ? 0.46 : 0.56)
    const font = style.font ?? UI_FONT
    ctx.font = `${style.italic ? 'italic ' : ''}${weight} ${size}px ${font}`
    let tw = ctx.measureText(text).width
    const maxW = w * 0.86 - (hasIcon ? iconSize : 0)
    if (tw > maxW) {
      size *= maxW / tw
      ctx.font = `${style.italic ? 'italic ' : ''}${weight} ${size}px ${font}`
      tw = ctx.measureText(text).width
    }
    const total = tw + (hasIcon ? iconSize * 1.05 : 0)
    const startX = (w - total) / 2
    if (hasIcon) drawIcon(ctx, style.icon, startX + iconSize / 2, h / 2, iconSize, style.fg)
    ctx.fillStyle = style.fg
    ctx.textBaseline = 'middle'
    ctx.textAlign = 'left'
    const ty = style.sub ? h * 0.42 : h * 0.53
    ctx.fillText(text, startX + (hasIcon ? iconSize * 1.05 : 0), ty)
    if (style.sub) {
      ctx.font = `600 ${h * 0.18}px ${font}`
      ctx.textAlign = 'center'
      ctx.globalAlpha = 0.8
      ctx.fillText(style.sub.toUpperCase(), w / 2, h * 0.78)
      ctx.globalAlpha = 1
    }
  }
}

export type InteriorKind =
  | 'grocery' | 'bakery' | 'books' | 'florist' | 'records' | 'noodle' | 'boutique' | 'ceramics'
  | 'lobby' | 'studio' | 'cafe' | 'pharmacy' | 'arcade' | 'laundry' | 'gallery'

const INTERIOR_THEME: Record<InteriorKind, { wall: string; floor: string; items: string[]; shelf: string }> = {
  grocery: { wall: '#fff6e0', floor: '#e9d9c5', items: ['#ef8a78', '#4fb3a9', '#f5dd92', '#9fb2e6', '#e0506a', '#7cbf6a'], shelf: '#ffffff' },
  bakery: { wall: '#ffe9d2', floor: '#d9b48f', items: ['#e0a060', '#c9765e', '#f5dd92', '#fff1d6', '#b86a5c'], shelf: '#8a5f4d' },
  books: { wall: '#f6e4c8', floor: '#9b6b4e', items: ['#2f3fb8', '#e0506a', '#4fb3a9', '#f5dd92', '#6e4a3b', '#a996d4'], shelf: '#6e4a3b' },
  florist: { wall: '#f1fbef', floor: '#cfe3c8', items: ['#e6a0b8', '#f39a4a', '#f5dd92', '#7cbf6a', '#e0506a', '#ffffff'], shelf: '#9cc3a0' },
  records: { wall: '#2b2350', floor: '#3b3650', items: ['#ef8a78', '#f5dd92', '#4fb3a9', '#a996d4', '#e0506a'], shelf: '#4a4468' },
  noodle: { wall: '#ffe3c8', floor: '#c9765e', items: ['#e0506a', '#f5dd92', '#ffffff', '#ef8a78'], shelf: '#6e4a3b' },
  boutique: { wall: '#fbeff4', floor: '#e8d3e0', items: ['#f4c3cc', '#9fb2e6', '#f6ecdc', '#a996d4', '#3b3650'], shelf: '#e89aab' },
  ceramics: { wall: '#f6ecdc', floor: '#c9b39a', items: ['#c9765e', '#f6ecdc', '#9fb2e6', '#bfe3cf', '#e9b949'], shelf: '#8a5f4d' },
  lobby: { wall: '#fdf3e2', floor: '#d8c6b3', items: ['#7cbf6a', '#f5dd92'], shelf: '#c9b39a' },
  studio: { wall: '#f4f1fb', floor: '#cfc8e0', items: ['#ef8a78', '#4fb3a9', '#f5dd92', '#9fb2e6', '#a996d4', '#ffffff'], shelf: '#3b3650' },
  cafe: { wall: '#ffe6cc', floor: '#9b6b4e', items: ['#6e4a3b', '#f6ecdc', '#ef8a78', '#f5dd92'], shelf: '#6e4a3b' },
  pharmacy: { wall: '#effaf6', floor: '#d4e8e2', items: ['#4fb3a9', '#ffffff', '#9fb2e6', '#e0506a', '#bfe3cf'], shelf: '#ffffff' },
  arcade: { wall: '#3b2a6b', floor: '#2b2350', items: ['#ff6fb1', '#6ff0ff', '#f5dd92', '#a996d4', '#7cff9a'], shelf: '#1d1a36' },
  laundry: { wall: '#eaf4ff', floor: '#cfe0f2', items: ['#ffffff', '#cfe0f2', '#9fb2e6'], shelf: '#ffffff' },
  gallery: { wall: '#ffffff', floor: '#e9e4ef', items: ['#ef8a78', '#2f3fb8', '#f5dd92', '#4fb3a9'], shelf: '#ffffff' },
}

/** A shop interior painted with fake perspective: back wall, shelves, ceiling lights, floor. */
export function interiorPainter(kind: InteriorKind, seed: number): DrawFn {
  return (ctx, w, h) => {
    const th = INTERIOR_THEME[kind]
    const rng = createRng(seed)
    // back wall with warm gradient light
    const g = ctx.createLinearGradient(0, 0, 0, h)
    g.addColorStop(0, shade(th.wall, 18))
    g.addColorStop(1, shade(th.wall, -18))
    ctx.fillStyle = g
    ctx.fillRect(0, 0, w, h)
    // floor band
    ctx.fillStyle = th.floor
    ctx.beginPath()
    ctx.moveTo(0, h)
    ctx.lineTo(w, h)
    ctx.lineTo(w * 0.86, h * 0.8)
    ctx.lineTo(w * 0.14, h * 0.8)
    ctx.closePath()
    ctx.fill()
    // side walls (perspective)
    ctx.fillStyle = shade(th.wall, -26)
    ctx.beginPath()
    ctx.moveTo(0, 0)
    ctx.lineTo(w * 0.14, h * 0.12)
    ctx.lineTo(w * 0.14, h * 0.8)
    ctx.lineTo(0, h)
    ctx.fill()
    ctx.beginPath()
    ctx.moveTo(w, 0)
    ctx.lineTo(w * 0.86, h * 0.12)
    ctx.lineTo(w * 0.86, h * 0.8)
    ctx.lineTo(w, h)
    ctx.fill()
    // ceiling lights
    for (let i = 0; i < 3; i++) {
      const lx = w * (0.28 + i * 0.22)
      ctx.fillStyle = 'rgba(255,250,230,0.95)'
      ctx.fillRect(lx - w * 0.06, h * 0.06, w * 0.12, h * 0.03)
      const lg = ctx.createRadialGradient(lx, h * 0.1, 0, lx, h * 0.1, h * 0.5)
      lg.addColorStop(0, 'rgba(255,240,200,0.45)')
      lg.addColorStop(1, 'rgba(255,240,200,0)')
      ctx.fillStyle = lg
      ctx.fillRect(0, 0, w, h)
    }
    if (kind === 'lobby') {
      ctx.fillStyle = '#8a5f4d'
      ctx.fillRect(w * 0.4, h * 0.25, w * 0.2, h * 0.55)
      ctx.fillStyle = '#f5dd92'
      ctx.fillRect(w * 0.47, h * 0.5, w * 0.02, h * 0.06)
      ctx.fillStyle = '#7cbf6a'
      ctx.beginPath()
      ctx.arc(w * 0.22, h * 0.62, h * 0.12, 0, Math.PI * 2)
      ctx.arc(w * 0.78, h * 0.62, h * 0.12, 0, Math.PI * 2)
      ctx.fill()
      return
    }
    if (kind === 'gallery') {
      for (let i = 0; i < 3; i++) {
        ctx.fillStyle = '#3b3650'
        ctx.fillRect(w * (0.2 + i * 0.22), h * 0.28, w * 0.16, h * 0.3)
        ctx.fillStyle = th.items[i]
        ctx.fillRect(w * (0.2 + i * 0.22) + 3, h * 0.28 + 3, w * 0.16 - 6, h * 0.3 - 6)
      }
      return
    }
    if (kind === 'laundry') {
      for (let i = 0; i < 4; i++) {
        const cx = w * (0.24 + i * 0.17)
        ctx.fillStyle = '#ffffff'
        ctx.fillRect(cx - w * 0.07, h * 0.42, w * 0.14, h * 0.38)
        ctx.fillStyle = '#9fb2e6'
        ctx.beginPath()
        ctx.arc(cx, h * 0.62, w * 0.045, 0, Math.PI * 2)
        ctx.fill()
      }
      return
    }
    // shelves with products
    const shelves = kind === 'noodle' || kind === 'cafe' ? 2 : 4
    for (let s = 0; s < shelves; s++) {
      const y = h * (0.26 + s * (0.5 / shelves))
      ctx.fillStyle = th.shelf
      ctx.fillRect(w * 0.16, y + h * 0.1, w * 0.68, h * 0.025)
      let x = w * 0.17
      while (x < w * 0.82) {
        const iw = w * rng.range(0.018, 0.045)
        const ih = h * rng.range(0.05, 0.1)
        ctx.fillStyle = rng.pick(th.items)
        if (kind === 'florist' || kind === 'bakery') {
          ctx.beginPath()
          ctx.arc(x + iw / 2, y + h * 0.1 - ih / 2, iw * 0.7, 0, Math.PI * 2)
          ctx.fill()
        } else {
          ctx.fillRect(x, y + h * 0.1 - ih, iw, ih)
        }
        x += iw + w * 0.006
      }
    }
    if (kind === 'noodle' || kind === 'cafe') {
      // counter with stools
      ctx.fillStyle = shade(th.shelf, 20)
      ctx.fillRect(w * 0.1, h * 0.66, w * 0.8, h * 0.08)
      for (let i = 0; i < 5; i++) {
        ctx.fillStyle = '#e0506a'
        ctx.beginPath()
        ctx.arc(w * (0.2 + i * 0.15), h * 0.8, h * 0.04, 0, Math.PI * 2)
        ctx.fill()
      }
      // hanging lamps
      for (let i = 0; i < 4; i++) {
        const lx = w * (0.22 + i * 0.19)
        ctx.strokeStyle = '#3b3650'
        ctx.lineWidth = 2
        ctx.beginPath()
        ctx.moveTo(lx, 0)
        ctx.lineTo(lx, h * 0.3)
        ctx.stroke()
        ctx.fillStyle = '#ffd98a'
        ctx.beginPath()
        ctx.arc(lx, h * 0.32, h * 0.04, 0, Math.PI * 2)
        ctx.fill()
      }
    }
    if (kind === 'arcade') {
      for (let i = 0; i < 4; i++) {
        ctx.fillStyle = rng.pick(th.items)
        ctx.fillRect(w * (0.2 + i * 0.16), h * 0.4, w * 0.1, h * 0.4)
        ctx.fillStyle = '#ffffff'
        ctx.fillRect(w * (0.21 + i * 0.16), h * 0.44, w * 0.08, h * 0.12)
      }
    }
  }
}

/** Generative artwork for the gallery and posters. */
export function artPainter(seed: number, palette: string[]): DrawFn {
  return (ctx, w, h) => {
    const rng = createRng(seed)
    ctx.fillStyle = palette[0]
    ctx.fillRect(0, 0, w, h)
    const mode = seed % 4
    if (mode === 0) {
      for (let i = 0; i < 7; i++) {
        ctx.fillStyle = palette[1 + (i % (palette.length - 1))]
        ctx.globalAlpha = 0.85
        ctx.beginPath()
        ctx.arc(rng.range(0, w), rng.range(0, h), rng.range(w * 0.1, w * 0.4), 0, Math.PI * 2)
        ctx.fill()
      }
    } else if (mode === 1) {
      const bands = 6
      for (let i = 0; i < bands; i++) {
        ctx.fillStyle = palette[i % palette.length]
        ctx.fillRect(0, (i * h) / bands, w, h / bands + 1)
      }
      ctx.fillStyle = palette[palette.length - 1]
      ctx.beginPath()
      ctx.arc(w / 2, h / 2, w * 0.28, 0, Math.PI * 2)
      ctx.fill()
    } else if (mode === 2) {
      for (let i = 0; i < 14; i++) {
        ctx.strokeStyle = palette[1 + (i % (palette.length - 1))]
        ctx.lineWidth = rng.range(4, 16)
        ctx.beginPath()
        ctx.moveTo(rng.range(0, w), rng.range(0, h))
        ctx.bezierCurveTo(rng.range(0, w), rng.range(0, h), rng.range(0, w), rng.range(0, h), rng.range(0, w), rng.range(0, h))
        ctx.stroke()
      }
    } else {
      const n = 5
      for (let i = 0; i < n; i++)
        for (let j = 0; j < n; j++) {
          ctx.fillStyle = palette[Math.floor(rng.next() * palette.length)]
          const s = w / n
          if (rng.chance(0.5)) ctx.fillRect(i * s, j * (h / n), s, h / n)
          else {
            ctx.beginPath()
            ctx.arc(i * s + s / 2, j * (h / n) + h / n / 2, s * 0.45, 0, Math.PI * 2)
            ctx.fill()
          }
        }
    }
    ctx.globalAlpha = 1
  }
}

/** A tiny neighbourhood map for the information kiosk board. */
export function mapBoardPainter(): DrawFn {
  return (ctx, w, h) => {
    ctx.fillStyle = '#2f3fb8'
    ctx.fillRect(0, 0, w, h)
    ctx.fillStyle = '#ffffff'
    ctx.font = `800 ${h * 0.09}px ${UI_FONT}`
    ctx.textAlign = 'center'
    ctx.fillText('YOU ARE HERE', w / 2, h * 0.12)
    const pad = w * 0.1
    const mw = w - pad * 2
    const mh = h * 0.72
    const top = h * 0.2
    ctx.fillStyle = '#e8e3ff'
    ctx.fillRect(pad, top, mw, mh)
    ctx.fillStyle = '#9fb2e6'
    // avenue + streets
    ctx.fillRect(pad + mw * 0.47, top, mw * 0.06, mh)
    for (const t of [0.22, 0.5, 0.78]) ctx.fillRect(pad, top + mh * t, mw, mh * 0.04)
    const pins: [number, number, string][] = [
      [0.5, 0.1, '#e0506a'], [0.25, 0.12, '#ef8a78'], [0.66, 0.36, '#a996d4'], [0.3, 0.38, '#4fb3a9'],
      [0.62, 0.6, '#ef8a78'], [0.3, 0.62, '#7cbf6a'],
    ]
    for (const [px, py, c] of pins) {
      ctx.fillStyle = c
      ctx.beginPath()
      ctx.arc(pad + mw * px, top + mh * py, w * 0.035, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.fillStyle = '#ff4f86'
    ctx.beginPath()
    ctx.arc(pad + mw * 0.5, top + mh * 0.9, w * 0.05, 0, Math.PI * 2)
    ctx.fill()
  }
}

export { hex }
