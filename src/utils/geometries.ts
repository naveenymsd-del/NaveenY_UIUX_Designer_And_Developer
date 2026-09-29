import {
  BoxGeometry, BufferGeometry, CircleGeometry, ConeGeometry, CylinderGeometry, DodecahedronGeometry,
  ExtrudeGeometry, IcosahedronGeometry, PlaneGeometry, Shape, SphereGeometry, TorusGeometry,
} from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import type { GeoKind } from './partBuilder'

/** Unit-sized shared geometries. Every part scales one of these. */
function prism() {
  const s = new Shape()
  s.moveTo(-0.5, -0.5)
  s.lineTo(0.5, -0.5)
  s.lineTo(0, 0.5)
  s.closePath()
  const g = new ExtrudeGeometry(s, { depth: 1, bevelEnabled: false })
  g.translate(0, 0, -0.5)
  return g
}

let cache: Record<GeoKind, BufferGeometry> | null = null

export function getGeometries(): Record<GeoKind, BufferGeometry> {
  if (cache) return cache
  const ico = new IcosahedronGeometry(0.5, 1)
  const dodeca = new DodecahedronGeometry(0.5, 0)
  const disk = new CircleGeometry(0.5, 24)
  disk.rotateX(-Math.PI / 2)
  cache = {
    box: new BoxGeometry(1, 1, 1),
    rbox: new RoundedBoxGeometry(1, 1, 1, 1, 0.14),
    cyl: new CylinderGeometry(0.5, 0.5, 1, 18),
    cyl8: new CylinderGeometry(0.5, 0.5, 1, 8),
    sphere: new SphereGeometry(0.5, 10, 8),
    sphereLo: new SphereGeometry(0.5, 6, 4),
    icoLo: new IcosahedronGeometry(0.5, 0),
    ico,
    dodeca,
    cone: new ConeGeometry(0.5, 1, 16),
    cone6: new ConeGeometry(0.5, 1, 6),
    prism: prism(),
    hcyl: new CylinderGeometry(0.5, 0.5, 1, 14, 1, false, -Math.PI / 2, Math.PI),
    torus: new TorusGeometry(0.5, 0.1, 6, 20),
    plane: new PlaneGeometry(1, 1),
    disk,
  }
  return cache
}
