/**
 * Traffic loops on road centre-lines. Each loop is offset into the right-hand
 * lane and its corners are rounded, then resampled by arc length so vehicles
 * can move at constant speed without physics.
 */
export interface VehicleDef {
  id: string
  kind: 'car' | 'van' | 'bus'
  color: number
  loop: string
  speed: number
  start: number
}

export const LOOPS: Record<string, [number, number][]> = {
  westLoop: [[0, 50], [0, -50], [-50, -50], [-50, 50]],
  eastLoop: [[0, -50], [0, 50], [50, 50], [50, -50]],
  southLoop: [[-50, 0], [50, 0], [50, 50], [-50, 50]],
  northLoop: [[50, 0], [-50, 0], [-50, -50], [50, -50]],
  bigLoop: [[-50, -50], [50, -50], [50, 50], [-50, 50]],
}

export const VEHICLES: VehicleDef[] = [
  { id: 'car-1', kind: 'car', color: 0xef8a78, loop: 'westLoop', speed: 7.5, start: 0.05 },
  { id: 'car-2', kind: 'car', color: 0x9fb2e6, loop: 'eastLoop', speed: 8, start: 0.4 },
  { id: 'van-1', kind: 'van', color: 0xf6ecdc, loop: 'southLoop', speed: 6.5, start: 0.15 },
  { id: 'car-3', kind: 'car', color: 0xf5dd92, loop: 'northLoop', speed: 7.8, start: 0.6 },
  { id: 'bus-1', kind: 'bus', color: 0x2f3fb8, loop: 'bigLoop', speed: 6, start: 0.3 },
  { id: 'car-4', kind: 'car', color: 0x4fb3a9, loop: 'westLoop', speed: 7.2, start: 0.55 },
  { id: 'car-5', kind: 'car', color: 0xa996d4, loop: 'southLoop', speed: 8.2, start: 0.7 },
]

export const LANE_OFFSET = 2.2
const CORNER_RADIUS = 5.5

export interface SampledPath {
  pts: Float32Array // x,z pairs
  cum: Float32Array
  length: number
}

export function buildLoop(corners: [number, number][]): SampledPath {
  const n = corners.length
  // 1) offset each corner into the right-hand lane
  const off: [number, number][] = []
  for (let i = 0; i < n; i++) {
    const prev = corners[(i - 1 + n) % n]
    const cur = corners[i]
    const next = corners[(i + 1) % n]
    const d1 = norm(cur[0] - prev[0], cur[1] - prev[1])
    const d2 = norm(next[0] - cur[0], next[1] - cur[1])
    // right normal of direction (dx, dz) is (-dz, dx)
    const r1 = [-d1[1], d1[0]]
    const r2 = [-d2[1], d2[0]]
    off.push([cur[0] + (r1[0] + r2[0]) * LANE_OFFSET, cur[1] + (r1[1] + r2[1]) * LANE_OFFSET])
  }
  // 2) round the corners with quadratic curves and densely sample
  const samples: [number, number][] = []
  for (let i = 0; i < n; i++) {
    const prev = off[(i - 1 + n) % n]
    const cur = off[i]
    const next = off[(i + 1) % n]
    const a = norm(prev[0] - cur[0], prev[1] - cur[1])
    const b = norm(next[0] - cur[0], next[1] - cur[1])
    const p0: [number, number] = [cur[0] + a[0] * CORNER_RADIUS, cur[1] + a[1] * CORNER_RADIUS]
    const p2: [number, number] = [cur[0] + b[0] * CORNER_RADIUS, cur[1] + b[1] * CORNER_RADIUS]
    for (let k = 0; k <= 10; k++) {
      const t = k / 10
      const u = 1 - t
      samples.push([u * u * p0[0] + 2 * u * t * cur[0] + t * t * p2[0], u * u * p0[1] + 2 * u * t * cur[1] + t * t * p2[1]])
    }
    // straight run to the next corner
    const nNext = off[(i + 1) % n]
    const c = norm(nNext[0] - cur[0], nNext[1] - cur[1])
    const len = Math.hypot(nNext[0] - cur[0], nNext[1] - cur[1]) - CORNER_RADIUS * 2
    const steps = Math.max(1, Math.floor(len / 2))
    for (let k = 1; k < steps; k++) samples.push([p2[0] + c[0] * (len * k) / steps, p2[1] + c[1] * (len * k) / steps])
  }
  const pts = new Float32Array(samples.length * 2)
  const cum = new Float32Array(samples.length + 1)
  let total = 0
  for (let i = 0; i < samples.length; i++) {
    pts[i * 2] = samples[i][0]
    pts[i * 2 + 1] = samples[i][1]
    const nx = samples[(i + 1) % samples.length]
    cum[i] = total
    total += Math.hypot(nx[0] - samples[i][0], nx[1] - samples[i][1])
  }
  cum[samples.length] = total
  return { pts, cum, length: total }
}

function norm(x: number, z: number): [number, number] {
  const l = Math.hypot(x, z) || 1
  return [x / l, z / l]
}

/** Position + heading at distance s along the loop. */
export function samplePath(path: SampledPath, s: number, out: { x: number; z: number; hx: number; hz: number }) {
  const L = path.length
  s = ((s % L) + L) % L
  const n = path.pts.length / 2
  let lo = 0
  let hi = n - 1
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1
    if (path.cum[mid] <= s) lo = mid
    else hi = mid - 1
  }
  const i = lo
  const j = (i + 1) % n
  const segLen = path.cum[i + 1] - path.cum[i] || 1
  const t = (s - path.cum[i]) / segLen
  const ax = path.pts[i * 2]
  const az = path.pts[i * 2 + 1]
  const bx = path.pts[j * 2]
  const bz = path.pts[j * 2 + 1]
  out.x = ax + (bx - ax) * t
  out.z = az + (bz - az) * t
  const hl = Math.hypot(bx - ax, bz - az) || 1
  out.hx = (bx - ax) / hl
  out.hz = (bz - az) / hl
  return out
}
