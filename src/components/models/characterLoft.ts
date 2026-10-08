import { type Bone, BufferAttribute, BufferGeometry, Color, Float32BufferAttribute, Vector3 } from 'three'
import type { CharacterDetail, CharacterLook } from './characterLook'
import type { BoneName } from './characterRig'

/**
 * Lofted body: the torso, legs, arms and neck are continuous tubes swept
 * through elliptical cross-sections, with skin weights blended across joints.
 * Knees, elbows, hips and shoulders therefore bend as one surface instead of
 * separate primitives meeting at a seam — the main difference between a
 * believable figure and a mannequin. Cross-section sizes follow real adult
 * measurements (thigh ≈ 55 cm, knee ≈ 37 cm, wrist ≈ 17 cm circumference).
 */
interface Ring {
  /** centre in bind (world) space */
  c: Vector3
  rx: number
  rz: number
  /** up to two bone influences */
  w: [BoneName, number][]
}

interface Loft {
  rings: Ring[]
  /** colour by ring index and angle θ (0 = facing forward, +π/2 = character's left) */
  color: (i: number, theta: number) => number
  capBottom?: boolean
  capTop?: boolean
  /** open surface: the angular range swept at ring i (θ = 0 is the front), e.g. an open overshirt */
  arc?: (i: number) => [number, number]
}

const shade = (c: number, amt: number) => {
  const f = (v: number) => Math.max(0, Math.min(255, v + amt))
  return (f((c >> 16) & 255) << 16) | (f((c >> 8) & 255) << 8) | f(c & 255)
}

export function buildLofts(look: CharacterLook, bones: Record<BoneName, Bone>, index: Map<BoneName, number>, detail: CharacterDetail): BufferGeometry[] {
  const seg = detail === 'low' ? 10 : 18
  const b = look.build
  const wp = (n: BoneName) => new Vector3().setFromMatrixPosition(bones[n].matrixWorld)
  const hips = wp('hips')
  const at = (o: Vector3, dx: number, dy: number, dz = 0) => o.clone().add(new Vector3(dx, dy, dz))

  const skin = look.skin
  const top = look.top
  const bottom = look.bottom
  const skirt = look.bottomStyle === 'skirt'
  const shorts = look.bottomStyle === 'shorts'
  const jeans = look.bottomStyle === 'jeans'
  const open = look.topStyle === 'jacket' || look.topStyle === 'overshirt'
  const belt = !skirt && (look.topStyle === 'shirt' || look.topStyle === 'overshirt' || look.topStyle === 'blouse' || jeans || look.bottomStyle === 'trousers')
  const ease = look.topStyle === 'hoodie' || look.topStyle === 'sweater' ? 0.012 : look.topStyle === 'jacket' || look.topStyle === 'overshirt' ? 0.01 : 0.004
  const lower = bottom
  // under a skirt the legs wear opaque tights, never bare skin
  const tights = 0x2b2a2e
  const lofts: Loft[] = []

  // ── torso: pelvis → waist → chest → shoulders ─────────────────────────
  const tRings: [number, number, number, number, [BoneName, number][]][] = [
    // dy above hips bone, rx, rz, z offset, weights
    [-0.1, 0.13, 0.092, -0.004, [['hips', 1]]],
    [-0.04, 0.16, 0.106, -0.008, [['hips', 1]]],
    [0.02, 0.163, 0.105, -0.004, [['hips', 1]]],
    [0.075, 0.148, 0.096, 0.002, [['hips', 0.6], ['spine', 0.4]]],
    [0.11, 0.142 + ease, 0.094 + ease, 0.004, [['spine', 1]]],
    [0.2, 0.15 + ease, 0.1 + ease, 0.006, [['spine', 1]]],
    [0.27, 0.163 + ease, 0.108 + ease, 0.008, [['spine', 0.5], ['chest', 0.5]]],
    [0.35, 0.172 + ease, 0.113 + ease, 0.01, [['chest', 1]]],
    [0.42, 0.176 + ease, 0.106 + ease, 0.006, [['chest', 1]]],
    [0.465, 0.158 + ease, 0.088 + ease, -0.002, [['chest', 1]]],
    [0.495, 0.1, 0.07, -0.006, [['chest', 1]]],
  ]
  const tr: Ring[] = tRings.map(([dy, rx, rz, oz, w]) => ({ c: at(hips, 0, dy, oz), rx: rx * (dy < 0.1 ? b : 0.9 + 0.1 * b), rz, w }))
  const beltRing = 3
  lofts.push({
    rings: tr,
    capBottom: true,
    capTop: true,
    color: (i) => {
      if (i < beltRing) return lower
      if (i === beltRing) return belt ? 0x3a2c22 : lower
      // under an open overshirt / jacket the torso is the tee or shirt beneath
      return open ? look.topAccent : top
    },
  })
  if (open) {
    // the outer layer: an open shell with crisp front edges, hem just below the belt
    const from = 2
    const shell = tr.slice(from).map((r, k, all) => ({
      ...r,
      c: r.c.clone().add(new Vector3(0, k === 0 ? -0.035 : 0, 0.002)),
      // the top ring closes over the shoulders around the collar
      rx: r.rx + (k === all.length - 1 ? 0.03 : 0.013),
      rz: r.rz + (k === all.length - 1 ? 0.024 : 0.013),
    }))
    const n = shell.length
    lofts.push({
      rings: shell,
      arc: (i) => {
        // fronts hang nearly straight, then spread into the lapels near the collar
        const open = 0.3 + Math.max(0, i - (n - 4)) * 0.09
        return [open, Math.PI * 2 - open]
      },
      color: (i) => (i === 0 ? shade(top, -10) : top),
    })
  }

  // ── legs: hip joint → knee → ankle ────────────────────────────────────
  for (const [leg, knee, foot, side] of [['legL', 'kneeL', 'footL', 1], ['legR', 'kneeR', 'footR', -1]] as const) {
    const h = wp(leg)
    const k = wp(knee)
    const f = wp(foot)
    const loose = jeans ? 0.004 : shorts || skirt ? 0 : 0.012
    const rings: Ring[] = [
      { c: at(h, -side * 0.012, 0.05), rx: 0.08, rz: 0.088, w: [['hips', 1]] },
      { c: at(h, 0, -0.03), rx: 0.084 + loose, rz: 0.09 + loose, w: [['hips', 0.35], [leg, 0.65]] },
      { c: at(h, 0, -0.14), rx: 0.078 + loose, rz: 0.084 + loose, w: [[leg, 1]] },
      { c: at(h, 0, -0.28), rx: 0.066 + loose, rz: 0.071 + loose, w: [[leg, 1]] },
      { c: at(k, 0, 0.06, 0.004), rx: 0.056 + loose, rz: 0.06 + loose, w: [[leg, 0.8], [knee, 0.2]] },
      { c: at(k, 0, 0, 0.008), rx: 0.054 + loose, rz: 0.058 + loose, w: [[leg, 0.5], [knee, 0.5]] },
      { c: at(k, 0, -0.07, -0.006), rx: 0.053 + loose, rz: 0.06 + loose, w: [[knee, 1]] },
      { c: at(k, 0, -0.15, -0.012), rx: 0.054 + loose, rz: 0.062 + loose, w: [[knee, 1]] },
      { c: at(k, 0, -0.27, -0.004), rx: 0.042 + loose, rz: 0.045 + loose, w: [[knee, 1]] },
      { c: at(f, 0, 0.07), rx: 0.034 + loose * 1.3, rz: 0.036 + loose * 1.3, w: [[knee, 0.9], [foot, 0.1]] },
      { c: at(f, 0, 0.012), rx: 0.033 + loose * 1.4, rz: 0.035 + loose * 1.4, w: [[knee, 0.5], [foot, 0.5]] },
    ]
    const shortsEnd = 3
    lofts.push({
      rings,
      capBottom: true,
      color: (i) => {
        if (skirt) return i < 2 ? lower : tights
        if (shorts) return i <= shortsEnd ? bottom : skin
        return i >= rings.length - 1 ? shade(bottom, -12) : bottom
      },
    })
  }

  // ── arms: shoulder → elbow → wrist ────────────────────────────────────
  for (const [arm, elbow, hand, side] of [['armL', 'elbowL', 'handL', 1], ['armR', 'elbowR', 'handR', -1]] as const) {
    const a = wp(arm)
    const e = wp(elbow)
    const hnd = wp(hand)
    const sl = look.longSleeves ? 0.008 + ease * 0.6 : 0
    const rings: Ring[] = [
      { c: at(a, -side * 0.03, 0.02), rx: 0.052, rz: 0.058, w: [['chest', 0.7], [arm, 0.3]] },
      { c: at(a, 0, -0.03), rx: 0.05 + sl, rz: 0.054 + sl, w: [['chest', 0.25], [arm, 0.75]] },
      { c: at(a, 0, -0.12), rx: 0.045 + sl, rz: 0.049 + sl, w: [[arm, 1]] },
      { c: at(a, 0, -0.22), rx: 0.04 + sl, rz: 0.043 + sl, w: [[arm, 1]] },
      { c: at(e, 0, 0.02), rx: 0.036 + sl, rz: 0.038 + sl, w: [[arm, 0.6], [elbow, 0.4]] },
      { c: at(e, 0, -0.04), rx: 0.037 + sl, rz: 0.039 + sl, w: [[elbow, 1]] },
      { c: at(e, 0, -0.12), rx: 0.036 + sl, rz: 0.036 + sl, w: [[elbow, 1]] },
      { c: at(hnd, 0, 0.05), rx: 0.028 + sl, rz: 0.025 + sl, w: [[elbow, 1]] },
      { c: at(hnd, 0, 0.0), rx: 0.026 + sl * 1.3, rz: 0.022 + sl * 1.3, w: [[elbow, 0.5], [hand, 0.5]] },
    ]
    const shortSleeveEnd = 2
    lofts.push({
      rings,
      capBottom: true,
      color: (i) => {
        if (look.longSleeves) return i >= rings.length - 2 ? shade(top, -10) : top
        return i <= shortSleeveEnd ? top : skin
      },
    })
  }

  // ── neck ──────────────────────────────────────────────────────────────
  const n = wp('neck')
  const hd = wp('head')
  lofts.push({
    rings: [
      { c: at(n, 0, -0.07, -0.008), rx: 0.062, rz: 0.058, w: [['chest', 1]] },
      { c: at(n, 0, 0.0, -0.004), rx: 0.054, rz: 0.052, w: [['chest', 0.4], ['neck', 0.6]] },
      { c: at(n, 0, 0.05, 0), rx: 0.05, rz: 0.05, w: [['neck', 1]] },
      { c: at(hd, 0, 0.04, 0.004), rx: 0.052, rz: 0.054, w: [['neck', 0.3], ['head', 0.7]] },
    ],
    capTop: true,
    color: () => skin,
  })

  return lofts.map((l) => loftGeometry(l, seg, index))
}

const _col = new Color()

function loftGeometry(l: Loft, seg: number, index: Map<BoneName, number>) {
  const R = l.rings.length
  // closed tubes wrap around; open surfaces (arc) get one extra column and no seam
  const cols = l.arc ? seg + 1 : seg
  const verts = R * cols + (l.capBottom ? 1 : 0) + (l.capTop ? 1 : 0)
  const pos = new Float32Array(verts * 3)
  const col = new Float32Array(verts * 3)
  const si = new Uint16Array(verts * 4)
  const sw = new Float32Array(verts * 4)
  const setSkin = (v: number, w: [BoneName, number][]) => {
    for (let k = 0; k < 2; k++) {
      const e = w[k]
      si[v * 4 + k] = e ? index.get(e[0])! : 0
      sw[v * 4 + k] = e ? e[1] : 0
    }
  }
  for (let r = 0; r < R; r++) {
    const ring = l.rings[r]
    const [a0, a1] = l.arc ? l.arc(r) : [0, Math.PI * 2]
    for (let s = 0; s < cols; s++) {
      const theta = a0 + (s / seg) * (a1 - a0)
      const v = r * cols + s
      // θ = 0 faces +z (the character's front), +π/2 points to +x (character's left)
      pos[v * 3] = ring.c.x + Math.sin(theta) * ring.rx
      pos[v * 3 + 1] = ring.c.y
      pos[v * 3 + 2] = ring.c.z + Math.cos(theta) * ring.rz
      _col.setHex(l.color(r, theta > Math.PI ? theta - Math.PI * 2 : theta))
      col.set([_col.r, _col.g, _col.b], v * 3)
      setSkin(v, ring.w)
    }
  }
  const idx: number[] = []
  for (let r = 0; r < R - 1; r++)
    for (let s = 0; s < seg; s++) {
      const s1 = l.arc ? s + 1 : (s + 1) % seg
      const a = r * cols + s
      const b = r * cols + s1
      const c = (r + 1) * cols + s
      const d = (r + 1) * cols + s1
      // rings run top → bottom or bottom → top; orient so faces point outward
      const down = l.rings[r + 1].c.y < l.rings[r].c.y
      if (down) idx.push(a, c, b, b, c, d)
      else idx.push(a, b, c, b, d, c)
    }
  let v = R * cols
  const cap = (ring: Ring, r: number, outwardUp: boolean) => {
    pos.set([ring.c.x, ring.c.y + (outwardUp ? 0.01 : -0.01), ring.c.z], v * 3)
    _col.setHex(l.color(r, 0))
    col.set([_col.r, _col.g, _col.b], v * 3)
    setSkin(v, ring.w)
    const base = r * cols
    for (let s = 0; s < seg; s++) {
      const a = base + s
      const b = base + ((s + 1) % seg)
      if (outwardUp) idx.push(v, a, b)
      else idx.push(v, b, a)
    }
    v++
  }
  // which end is lower?
  const firstLow = l.rings[0].c.y < l.rings[R - 1].c.y
  if (l.capBottom) cap(firstLow ? l.rings[0] : l.rings[R - 1], firstLow ? 0 : R - 1, false)
  if (l.capTop) cap(firstLow ? l.rings[R - 1] : l.rings[0], firstLow ? R - 1 : 0, true)

  const g = new BufferGeometry()
  g.setAttribute('position', new BufferAttribute(pos, 3))
  g.setAttribute('color', new Float32BufferAttribute(col, 3))
  g.setAttribute('skinIndex', new BufferAttribute(si, 4))
  g.setAttribute('skinWeight', new BufferAttribute(sw, 4))
  g.setIndex(idx)
  g.computeVertexNormals()
  const out = g.toNonIndexed()
  g.dispose()
  return out
}
