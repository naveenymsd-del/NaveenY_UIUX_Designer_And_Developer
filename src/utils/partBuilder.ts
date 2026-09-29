import { Euler, Matrix4, Quaternion, Vector3 } from 'three'

/**
 * The procedural city is authored as thousands of small "parts" (a window
 * frame, an awning stripe, a bench slat...). Parts are never rendered one by
 * one: InstancedParts batches them by geometry + material + spatial chunk, so
 * the whole neighbourhood renders in a few dozen draw calls.
 */
export type GeoKind =
  | 'box' | 'rbox' | 'cyl' | 'cyl8' | 'sphere' | 'sphereLo' | 'ico' | 'icoLo' | 'dodeca' | 'cone' | 'cone6'
  | 'prism' | 'hcyl' | 'torus' | 'plane' | 'disk'

export type MatKind =
  | 'matte' | 'gloss' | 'metal' | 'glass' | 'glow' | 'foliage' | 'fabric' | 'paint'
  | 'water' | 'signAtlas' | 'decorAtlas' | 'viewAtlas' | 'lightPool' | 'emissive'

export interface Part {
  geo: GeoKind
  mat: MatKind
  matrix: Matrix4
  color: number
  cast: boolean
  /** atlas sub-rect [u, v, w, h] for atlas materials */
  uv?: [number, number, number, number]
}

export interface BoxColliderDef {
  center: [number, number, number]
  half: [number, number, number]
  rotY: number
  /** optional rotation around local X (ramps) */
  rotX?: number
}

export interface CylColliderDef {
  center: [number, number, number]
  halfHeight: number
  radius: number
}

type Vec3 = [number, number, number]

interface Frame {
  x: number
  y: number
  z: number
  ry: number
  cos: number
  sin: number
}

export interface AddOptions {
  mat?: MatKind
  rot?: Vec3
  cast?: boolean
  uv?: [number, number, number, number]
}

/** Materials that get ±3% brightness variation per instance (avoids flat, plastic repetition). */
const JITTER = new Set<MatKind>(['matte', 'fabric', 'gloss', 'foliage'])
function jitter(color: number, seed: number) {
  const h = Math.sin(seed * 12.9898) * 43758.5453
  const k = 1 + ((h - Math.floor(h)) - 0.5) * 0.07
  const ch = (v: number) => Math.max(0, Math.min(255, Math.round(v * k)))
  return (ch((color >> 16) & 255) << 16) | (ch((color >> 8) & 255) << 8) | ch(color & 255)
}

const _q = new Quaternion()
const _qf = new Quaternion()
const _e = new Euler()
const _p = new Vector3()
const _s = new Vector3()
const _up = new Vector3(0, 1, 0)

export class PartBuilder {
  parts: Part[] = []
  colliders: BoxColliderDef[] = []
  cylColliders: CylColliderDef[] = []
  private frames: Frame[] = [{ x: 0, y: 0, z: 0, ry: 0, cos: 1, sin: 0 }]

  private get f() {
    return this.frames[this.frames.length - 1]
  }

  /** Push a local frame (translation + yaw). Nested frames compose. */
  push(x: number, y: number, z: number, ry = 0) {
    const [wx, wy, wz] = this.toWorld(x, y, z)
    const nry = this.f.ry + ry
    this.frames.push({ x: wx, y: wy, z: wz, ry: nry, cos: Math.cos(nry), sin: Math.sin(nry) })
    return this
  }

  pop() {
    if (this.frames.length > 1) this.frames.pop()
    return this
  }

  /** Run fn with the root (world) frame active, then restore the current frame stack. */
  inWorld(fn: () => void) {
    const saved = this.frames
    this.frames = saved.slice(0, 1)
    fn()
    this.frames = saved
    return this
  }

  toWorld(lx: number, ly: number, lz: number): Vec3 {
    const f = this.f
    return [f.x + lx * f.cos + lz * f.sin, f.y + ly, f.z - lx * f.sin + lz * f.cos]
  }

  get yaw() {
    return this.f.ry
  }

  add(geo: GeoKind, color: number, pos: Vec3, scale: Vec3, opts: AddOptions = {}) {
    // automatic LOD for small props: flowers and shrubs don't need dense meshes
    const big = Math.max(scale[0], scale[1], scale[2])
    if (geo === 'sphere' && big < 0.3) geo = 'sphereLo'
    else if (geo === 'ico' && big < 0.75) geo = 'icoLo'
    const [wx, wy, wz] = this.toWorld(pos[0], pos[1], pos[2])
    _qf.setFromAxisAngle(_up, this.f.ry)
    if (opts.rot) {
      _e.set(opts.rot[0], opts.rot[1], opts.rot[2], 'YXZ')
      _q.setFromEuler(_e)
      _qf.multiply(_q)
    }
    const m = new Matrix4().compose(_p.set(wx, wy, wz), _qf, _s.set(scale[0], scale[1], scale[2]))
    const mat = opts.mat ?? 'matte'
    this.parts.push({
      geo,
      mat,
      matrix: m,
      color: JITTER.has(mat) ? jitter(color, this.parts.length) : color,
      // small details never cast shadows: keeps the shadow pass lean
      cast: opts.cast ?? big >= 0.9,
      uv: opts.uv,
    })
    return this
  }

  /** Axis-aligned (in local frame) box given center and full size. */
  box(color: number, pos: Vec3, size: Vec3, opts: AddOptions = {}) {
    return this.add('box', color, pos, size, opts)
  }

  /** Box whose bottom sits at pos[1]. */
  boxOn(color: number, pos: Vec3, size: Vec3, opts: AddOptions = {}) {
    return this.add('box', color, [pos[0], pos[1] + size[1] / 2, pos[2]], size, opts)
  }

  /** Static cuboid collider in the local frame (center + full size). */
  collider(pos: Vec3, size: Vec3, extraRotY = 0, rotX?: number) {
    this.colliders.push({
      center: this.toWorld(pos[0], pos[1], pos[2]),
      half: [size[0] / 2, size[1] / 2, size[2] / 2],
      rotY: this.f.ry + extraRotY,
      rotX,
    })
    return this
  }

  cylCollider(pos: Vec3, radius: number, height: number) {
    const c = this.toWorld(pos[0], pos[1] + height / 2, pos[2])
    this.cylColliders.push({ center: c, halfHeight: height / 2, radius })
    return this
  }
}
