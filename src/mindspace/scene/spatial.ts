import { Scene, Vector3 } from 'three'
import { CSS3DObject, CSS3DRenderer } from 'three/examples/jsm/renderers/CSS3DRenderer.js'

/**
 * Spatial HTML: the launcher's icons are real DOM elements placed IN the room.
 * Each icon is a CSS3DObject — a world-space object with a position and a
 * fixed orientation — and the CSS3D renderer draws them with the same
 * perspective camera as the WebGL room, so they move, shrink and turn exactly
 * like the furniture when the visitor looks around. They are not re-aimed at
 * the camera every frame (no HUD behaviour).
 */
export const cssScene = new Scene()
let renderer: CSS3DRenderer | null = null

/** the renderer, attached once to the overlay layer above the canvas */
export function cssRenderer(host: HTMLElement) {
  if (!renderer) {
    renderer = new CSS3DRenderer()
    renderer.domElement.className = 'ms-css3d'
  }
  if (renderer.domElement.parentElement !== host) host.appendChild(renderer.domElement)
  return renderer
}
export function disposeCssRenderer() {
  renderer?.domElement.remove()
  renderer = null
}

/** 1 CSS pixel of an icon = this many metres in the room */
export const PX = 0.0026

/** where the visitor stands by default; the launcher curves around this point */
export const VIEW_POINT = new Vector3(0, 1.58, 3.15)

/**
 * The launcher as a gentle arc around the viewing point (like a spatial OS):
 * every icon is the same distance from the visitor and faces them from where
 * it stands. Desktop: 5 × 2 at ~2.6 m. Narrow screens: 3 × 3.
 */
export function launcherLayout(count: number, cols: number) {
  const radius = 2.6
  const colStep = cols === 5 ? 0.47 : 0.45
  const rowStep = cols === 5 ? 0.52 : 0.5
  const rows = Math.ceil(count / cols)
  const midY = cols === 5 ? 1.45 : 1.42
  return Array.from({ length: count }, (_, i) => {
    const row = Math.floor(i / cols)
    // centre each row (a shorter last row sits in the middle)
    const inRow = Math.min(cols, count - row * cols)
    const col = (i % cols) - (inRow - 1) / 2
    const theta = (col * colStep) / radius
    return {
      position: new Vector3(VIEW_POINT.x + Math.sin(theta) * radius, midY + ((rows - 1) / 2 - row) * rowStep, VIEW_POINT.z - Math.cos(theta) * radius),
      yaw: -theta,
    }
  })
}

export function makeIconObject(el: HTMLElement) {
  const o = new CSS3DObject(el)
  o.scale.setScalar(PX)
  return o
}

/**
 * A drag that starts on an icon turns the view and must not also open the app:
 * the camera rig marks a pointer gesture as a drag once it moves a few pixels,
 * and the icons ignore the click that ends it.
 */
export const gesture = { dragged: false }
