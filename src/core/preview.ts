import { Vector3 } from 'three'
import { WORLD_STOPS, type StopId } from '@/data/world'

/**
 * The welcome screen's city preview. It is not a second scene: while the
 * welcome screen is open, the real city's camera takes an overview shot
 * (GameCamera, shot "preview") and the destination markers are projected
 * from the real stop positions every frame (PreviewProjector). This object is
 * how the DOM and the render loop talk, without React re-rendering per frame.
 */
export const previewRuntime = {
  /** the welcome screen is open (the camera frames the overview) */
  active: false,
  /** where the city should appear on screen (the stage region, CSS px) */
  stage: { x: 0, y: 0, w: 0, h: 0 },
  /** marker elements, by stop id — positioned by the projector */
  markers: new Map<StopId, HTMLElement>(),
  /** the route line (an SVG polyline) drawn through the markers */
  route: null as SVGPolylineElement | null,
}

/**
 * Where each destination sits in the city. The stops' `point` (where the
 * companion points) is the building; Projects is the studio inside the NFC
 * office, so its marker sits on the upper floor of the same building.
 */
export const PREVIEW_POINTS: Record<StopId, Vector3> = Object.fromEntries(
  WORLD_STOPS.map((s) => {
    const [x, y, z] = s.point
    return [s.id, s.id === 'projects' ? new Vector3(x, y + 7, z) : new Vector3(x, Math.max(y, 3), z)]
  }),
) as Record<StopId, Vector3>

/** the story order the route line follows */
export const ROUTE: StopId[] = ['start', 'home', 'education', 'nfcSolutions', 'projects', 'gallery', 'contactCafe']

/** the middle of the destinations — what the overview looks at — and how far they spread (x: west–east, z: north–south) */
export const CITY_CENTER = new Vector3(0, 0, 6)
export const CITY_SPAN = { x: 46, z: 136 }
