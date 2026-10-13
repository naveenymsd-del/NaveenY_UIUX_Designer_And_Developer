import { CanvasTexture, RepeatWrapping, SRGBColorSpace, type Texture } from 'three'

/**
 * Every surface texture in the room is painted once on a canvas — no image
 * downloads, nothing to license. Seeded so the room is identical every visit.
 */
function rng(seed: number) {
  let s = seed
  return () => ((s = (s * 16807) % 2147483647) / 2147483647)
}
function canvas(w: number, h: number) {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  return [c, c.getContext('2d')!] as const
}
function tex(c: HTMLCanvasElement, repeat: [number, number] = [1, 1], color = true): Texture {
  const t = new CanvasTexture(c)
  if (color) t.colorSpace = SRGBColorSpace
  t.wrapS = t.wrapT = RepeatWrapping
  t.repeat.set(...repeat)
  t.anisotropy = 8
  return t
}

/** wide-plank oak: per-plank tone, long grain, soft seams */
export function oakFloor(size = 1024) {
  const r = rng(7)
  const [c, g] = canvas(size, size)
  const rows = 8
  const ph = size / rows
  for (let i = 0; i < rows; i++) {
    let x = -r() * size * 0.5
    while (x < size) {
      const len = size * (0.45 + r() * 0.5)
      const tone = 0.86 + r() * 0.2
      const base = [178 * tone, 134 * tone, 92 * tone]
      g.fillStyle = `rgb(${base.map((v) => v | 0).join(',')})`
      g.fillRect(x, i * ph, len, ph)
      // grain: long, slightly wavy strokes
      for (let k = 0; k < 26; k++) {
        const y = i * ph + r() * ph
        const dark = r() < 0.55
        g.strokeStyle = dark ? `rgba(92,58,32,${0.05 + r() * 0.12})` : `rgba(240,210,170,${0.04 + r() * 0.08})`
        g.lineWidth = 0.6 + r() * 1.6
        g.beginPath()
        g.moveTo(x, y)
        const amp = 1 + r() * 3
        for (let s = 0; s <= len; s += 24) g.lineTo(x + s, y + Math.sin((s + k * 40) * 0.012) * amp)
        g.stroke()
      }
      // a knot now and then
      if (r() < 0.25) {
        const kx = x + r() * len, ky = i * ph + ph * (0.3 + r() * 0.4)
        const grd = g.createRadialGradient(kx, ky, 1, kx, ky, 9)
        grd.addColorStop(0, 'rgba(70,42,22,0.55)')
        grd.addColorStop(1, 'rgba(70,42,22,0)')
        g.fillStyle = grd
        g.fillRect(kx - 12, ky - 9, 24, 18)
      }
      g.fillStyle = 'rgba(40,24,12,0.35)'
      g.fillRect(x, i * ph, 1.5, ph)
      x += len
    }
    g.fillStyle = 'rgba(40,24,12,0.32)'
    g.fillRect(0, i * ph, size, 1.5)
  }
  return tex(c, [4.4, 4.4])
}

/** warm limewash plaster — a soft, cloudy tone variation */
export function plaster(base: [number, number, number], seed = 3, size = 512) {
  const r = rng(seed)
  const [c, g] = canvas(size, size)
  g.fillStyle = `rgb(${base.join(',')})`
  g.fillRect(0, 0, size, size)
  for (let i = 0; i < 260; i++) {
    const x = r() * size, y = r() * size, rad = 20 + r() * 90
    const light = r() < 0.5
    const grd = g.createRadialGradient(x, y, 0, x, y, rad)
    grd.addColorStop(0, light ? 'rgba(255,255,255,0.03)' : 'rgba(90,70,50,0.022)')
    grd.addColorStop(1, 'rgba(0,0,0,0)')
    g.fillStyle = grd
    g.fillRect(x - rad, y - rad, rad * 2, rad * 2)
  }
  const img = g.getImageData(0, 0, size, size)
  for (let i = 0; i < img.data.length; i += 4) {
    const n = (r() - 0.5) * 7
    img.data[i] += n
    img.data[i + 1] += n
    img.data[i + 2] += n
  }
  g.putImageData(img, 0, 0)
  return tex(c, [3, 1.5])
}

/** a fine woven fabric (bouclé-like) for the sofa and cushions */
export function fabric(base: [number, number, number], seed = 5, size = 256) {
  const r = rng(seed)
  const [c, g] = canvas(size, size)
  g.fillStyle = `rgb(${base.join(',')})`
  g.fillRect(0, 0, size, size)
  for (let y = 0; y < size; y += 2) {
    for (let x = 0; x < size; x += 2) {
      const n = (r() - 0.5) * 26 + (((x >> 1) + (y >> 1)) % 2 ? 6 : -6)
      g.fillStyle = `rgba(${n > 0 ? 255 : 0},${n > 0 ? 255 : 0},${n > 0 ? 255 : 0},${Math.abs(n) / 255})`
      g.fillRect(x, y, 2, 2)
    }
  }
  return tex(c, [4, 4])
}

/** a hand-knotted wool rug: tonal field, a quiet border, a soft abstract motif */
export function rug(size = 1024) {
  const r = rng(11)
  const [c, g] = canvas(size, size * 0.7)
  const h = size * 0.7
  g.fillStyle = '#d9cdbb'
  g.fillRect(0, 0, size, h)
  // abstract washes
  const washes: [string, number, number, number][] = [['rgba(170,120,86,0.35)', 0.28, 0.4, 0.32], ['rgba(120,128,108,0.28)', 0.7, 0.62, 0.36], ['rgba(196,170,140,0.5)', 0.52, 0.2, 0.3]]
  for (const [col, x, y, rad] of washes) {
    const grd = g.createRadialGradient(x * size, y * h, 0, x * size, y * h, rad * size)
    grd.addColorStop(0, col)
    grd.addColorStop(1, 'rgba(0,0,0,0)')
    g.fillStyle = grd
    g.fillRect(0, 0, size, h)
  }
  // borders
  g.strokeStyle = 'rgba(110,84,62,0.55)'
  g.lineWidth = 10
  g.strokeRect(34, 34, size - 68, h - 68)
  g.strokeStyle = 'rgba(110,84,62,0.25)'
  g.lineWidth = 3
  g.strokeRect(58, 58, size - 116, h - 116)
  // wool fibre noise
  const img = g.getImageData(0, 0, size, h)
  for (let i = 0; i < img.data.length; i += 4) {
    const n = (r() - 0.5) * 22
    img.data[i] += n
    img.data[i + 1] += n
    img.data[i + 2] += n
  }
  g.putImageData(img, 0, 0)
  return tex(c)
}

/** the view out of the window: late-afternoon sky, hazy towers, a few lit windows */
export function cityView(w = 2048, h = 1024) {
  const r = rng(21)
  const [c, g] = canvas(w, h)
  const sky = g.createLinearGradient(0, 0, 0, h)
  sky.addColorStop(0, '#7f9fbf')
  sky.addColorStop(0.45, '#b9c8d4')
  sky.addColorStop(0.72, '#ecd5b8')
  sky.addColorStop(1, '#d9b996')
  g.fillStyle = sky
  g.fillRect(0, 0, w, h)
  // sun glow
  const sun = g.createRadialGradient(w * 0.22, h * 0.6, 0, w * 0.22, h * 0.6, h * 0.7)
  sun.addColorStop(0, 'rgba(255,236,200,0.85)')
  sun.addColorStop(1, 'rgba(255,236,200,0)')
  g.fillStyle = sun
  g.fillRect(0, 0, w, h)
  // three depth layers of towers, hazier with distance
  const layers: [number, number, string, number][] = [[0.5, 0.25, '#9aa8b5', 0.12], [0.62, 0.32, '#7d8a97', 0.24], [0.78, 0.36, '#5d6772', 0.4]]
  for (const [horizon, maxH, col, lit] of layers) {
    let x = -20
    while (x < w) {
      const bw = 40 + r() * 120
      const bh = h * (0.06 + r() * maxH)
      const top = h * horizon - bh + h * 0.2
      g.fillStyle = col
      g.fillRect(x, top, bw, h - top)
      for (let wy = top + 10; wy < h - 6; wy += 14)
        for (let wx = x + 6; wx < x + bw - 6; wx += 10)
          if (r() < lit * 0.25) {
            g.fillStyle = `rgba(255,${200 + ((r() * 40) | 0)},150,${0.35 + r() * 0.4})`
            g.fillRect(wx, wy, 4, 6)
          }
      x += bw + 2 + r() * 8
    }
    const haze = g.createLinearGradient(0, h * (horizon - 0.1), 0, h)
    haze.addColorStop(0, 'rgba(236,214,186,0)')
    haze.addColorStop(1, 'rgba(236,214,186,0.25)')
    g.fillStyle = haze
    g.fillRect(0, 0, w, h)
  }
  return tex(c)
}

/** quiet abstract art for the walls (muted terracotta, sand, sage, ink) */
export function artwork(seed: number, w = 512, h = 640) {
  const r = rng(seed)
  const [c, g] = canvas(w, h)
  g.fillStyle = '#efe7da'
  g.fillRect(0, 0, w, h)
  const cols = ['#b5654a', '#d9b48a', '#8a9a84', '#2d2a28', '#c98b62', '#e8d5bb']
  for (let i = 0; i < 7; i++) {
    g.fillStyle = cols[(r() * cols.length) | 0]
    g.globalAlpha = 0.75 + r() * 0.25
    const x = r() * w, y = r() * h, s = 60 + r() * 170
    if (r() < 0.5) {
      g.beginPath()
      g.arc(x, y, s / 2, 0, Math.PI * (r() < 0.5 ? 1 : 2))
      g.fill()
    } else g.fillRect(x - s / 2, y - s / 4, s, s / 2)
  }
  g.globalAlpha = 1
  return tex(c)
}

/** a row of book spines in muted cloth colours */
export function bookSpines(seed: number, w = 512, h = 128) {
  const r = rng(seed)
  const [c, g] = canvas(w, h)
  const cols = ['#6f5b4b', '#a49580', '#3f4a52', '#b8a48a', '#7a3f33', '#d8cfc0', '#55604f', '#2f2c2a']
  let x = 0
  while (x < w) {
    const bw = 10 + r() * 22
    const bh = h * (0.7 + r() * 0.3)
    g.fillStyle = cols[(r() * cols.length) | 0]
    g.fillRect(x, h - bh, bw, bh)
    g.fillStyle = 'rgba(255,255,255,0.18)'
    g.fillRect(x + bw * 0.2, h - bh * 0.8, bw * 0.6, 2)
    g.fillStyle = 'rgba(0,0,0,0.25)'
    g.fillRect(x + bw - 1, h - bh, 1, bh)
    x += bw + (r() < 0.15 ? 14 : 1)
  }
  const t = tex(c)
  t.wrapS = t.wrapT = 1001 // ClampToEdge
  return t
}
