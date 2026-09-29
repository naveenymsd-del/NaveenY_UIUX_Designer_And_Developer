import {
  AdditiveBlending, Color, DoubleSide, type Material, MeshBasicMaterial, MeshStandardMaterial, type Texture, Vector3, Vector4,
} from 'three'
import type { MatKind } from './partBuilder'
import { lightPoolTexture } from './textures'

/** Shared uniforms: time (wind, water, screens) and camera position (foliage dissolve). Updated by WorldClock. */
export const worldUniforms = {
  uTime: { value: 0 },
  uCamPos: { value: new Vector3() },
}

/**
 * Night uniforms, driven by the day/night system (core/dayNight + DayNightSystem).
 * uLights: 0 = daylight … 1 = full night. uZones: footprints (x0, z0, x1, z1)
 * with their own window occupancy in uZoneP (home, office, campus…).
 */
export const nightUniforms = {
  uLights: { value: 0 },
  uWindowP: { value: 0.45 },
  uZones: { value: [new Vector4(), new Vector4(), new Vector4(), new Vector4()] },
  uZoneP: { value: [0, 0, 0, 0] },
}

/**
 * Glass that lights up at night. Each pane is an instance, so its world
 * position seeds a stable hash: some windows switch on (warm white → soft
 * amber, some dim), some stay dark, and they come on staggered as the evening
 * deepens. The pattern never changes frame to frame.
 */
function withNightWindows(mat: MeshStandardMaterial) {
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, nightUniforms)
    shader.vertexShader = 'varying vec3 vPane;\n' + shader.vertexShader.replace(
      '#include <project_vertex>',
      `#include <project_vertex>
      #ifdef USE_INSTANCING
        vPane = (modelMatrix * vec4(instanceMatrix[3].xyz, 1.0)).xyz;
      #else
        vPane = (modelMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
      #endif`,
    )
    shader.fragmentShader = `uniform float uLights; uniform float uWindowP; uniform vec4 uZones[4]; uniform float uZoneP[4]; varying vec3 vPane;\n` + shader.fragmentShader.replace(
      '#include <emissivemap_fragment>',
      `#include <emissivemap_fragment>
      if (uLights > 0.001) {
        vec3 q = floor(vPane * 4.0 + 0.5);
        float h1 = fract(sin(dot(q, vec3(12.9898, 78.233, 37.719))) * 43758.5453);
        float h2 = fract(sin(dot(q, vec3(39.346, 11.135, 83.155))) * 24634.6345);
        float p = uWindowP;
        for (int i = 0; i < 4; i++) {
          vec4 z = uZones[i];
          if (uZoneP[i] > 0.0 && vPane.x > z.x && vPane.x < z.z && vPane.z > z.y && vPane.z < z.w) p = uZoneP[i];
        }
        // staggered: each window has its own switch-on moment through the evening
        float on = step(h1, p) * smoothstep(h2 * 0.7, h2 * 0.7 + 0.2, uLights);
        vec3 warm = mix(vec3(1.0, 0.8, 0.52), vec3(1.0, 0.93, 0.8), fract(h2 * 7.13));
        float level = mix(0.35, 1.0, step(0.25, fract(h1 * 17.3)));
        totalEmissiveRadiance += warm * on * level * 1.15;
      }`,
    )
  }
  mat.customProgramCacheKey = () => 'night-windows'
  return mat
}

const WIND_VERTEX = /* glsl */ `
  #ifdef USE_INSTANCING
    vec3 ip = vec3(instanceMatrix[3][0], instanceMatrix[3][1], instanceMatrix[3][2]);
  #else
    vec3 ip = vec3(0.0);
  #endif
  float windH = clamp(position.y + 0.5, 0.0, 1.0);
  float windW = sin(uTime * 1.25 + ip.x * 0.35 + ip.z * 0.21) * 0.045
              + sin(uTime * 2.9 + ip.x * 1.7 + ip.z) * 0.018;
  transformed.x += windW * windH;
  transformed.z += windW * 0.55 * windH;
  transformed.y += sin(uTime * 2.1 + ip.z * 0.9) * 0.01 * windH;
`

/**
 * Foliage: wind sway in the vertex shader, plus a dithered dissolve for
 * fragments close to the camera so canopies never fill the screen when the
 * camera passes through or behind a tree.
 */
function withWind(mat: MeshStandardMaterial) {
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = worldUniforms.uTime
    shader.uniforms.uCamPos = worldUniforms.uCamPos
    shader.vertexShader = 'uniform float uTime;\nvarying vec3 vFadeWorld;\n' + shader.vertexShader
      .replace('#include <begin_vertex>', '#include <begin_vertex>\n' + WIND_VERTEX)
      .replace(
        '#include <project_vertex>',
        `#include <project_vertex>
        #ifdef USE_INSTANCING
          vFadeWorld = (modelMatrix * instanceMatrix * vec4(transformed, 1.0)).xyz;
        #else
          vFadeWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;
        #endif`,
      )
    shader.fragmentShader = 'uniform vec3 uCamPos;\nvarying vec3 vFadeWorld;\n' + shader.fragmentShader.replace(
      'void main() {',
      `void main() {
        float camD = distance(vFadeWorld, uCamPos);
        float keep = smoothstep(1.6, 4.0, camD);
        vec2 px = floor(mod(gl_FragCoord.xy, 4.0));
        float bayer = mod(px.x * 2.0 + px.y * 3.0 + px.x * px.y, 4.0) / 4.0 + 0.125;
        if (keep < bayer) discard;`,
    )
  }
  mat.customProgramCacheKey = () => 'wind-fade'
  return mat
}

/** Remaps map UVs to a per-instance atlas rect (attribute uvRect = [u, v, w, h]). */
export function withAtlas<T extends MeshBasicMaterial | MeshStandardMaterial>(mat: T, key: string): T {
  mat.onBeforeCompile = (shader) => {
    shader.vertexShader = 'attribute vec4 uvRect;\n' + shader.vertexShader.replace(
      '#include <uv_vertex>',
      '#include <uv_vertex>\n#ifdef USE_MAP\n vMapUv = uvRect.xy + vMapUv * uvRect.zw;\n#endif\n',
    )
  }
  mat.customProgramCacheKey = () => 'atlas-' + key
  return mat
}

let cache: Partial<Record<MatKind, Material>> = {}
let atlasTextures: { sign?: Texture; decor?: Texture } = {}

export function setAtlasTextures(sign: Texture, decor: Texture) {
  atlasTextures = { sign, decor }
  // invalidate the atlas materials so they pick up the new textures
  delete cache.signAtlas
  delete cache.decorAtlas
  delete cache.viewAtlas
}

export function getMaterial(kind: MatKind): Material {
  const hit = cache[kind]
  if (hit) return hit
  let m: Material
  switch (kind) {
    case 'matte':
      m = new MeshStandardMaterial({ color: 0xffffff, roughness: 0.86, metalness: 0 })
      break
    case 'paint':
      m = new MeshStandardMaterial({ color: 0xffffff, roughness: 0.7, metalness: 0, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 })
      break
    case 'gloss':
      m = new MeshStandardMaterial({ color: 0xffffff, roughness: 0.32, metalness: 0.05, envMapIntensity: 1.1 })
      break
    case 'metal':
      m = new MeshStandardMaterial({ color: 0xffffff, roughness: 0.38, metalness: 0.65, envMapIntensity: 1.2 })
      break
    case 'glass':
      m = withNightWindows(new MeshStandardMaterial({ color: 0xffffff, roughness: 0.06, metalness: 0.35, envMapIntensity: 1.6 }))
      break
    case 'glow':
      m = new MeshBasicMaterial({ color: 0xffffff, toneMapped: true })
      break
    case 'emissive':
      // brighter than 1.0 so bloom picks it up: lamps, neon, headlights
      m = new MeshBasicMaterial({ color: new Color(1.6, 1.6, 1.6), toneMapped: true })
      break
    case 'foliage':
      m = withWind(new MeshStandardMaterial({ color: 0xffffff, roughness: 0.9, metalness: 0, flatShading: false }))
      break
    case 'fabric':
      m = new MeshStandardMaterial({ color: 0xffffff, roughness: 0.95, metalness: 0, side: DoubleSide })
      break
    case 'water':
      m = new MeshStandardMaterial({ color: 0xffffff, roughness: 0.08, metalness: 0.1, transparent: true, opacity: 0.85, envMapIntensity: 1.8 })
      break
    case 'signAtlas':
      m = withAtlas(new MeshBasicMaterial({ color: new Color(1.08, 1.08, 1.08), map: atlasTextures.sign ?? null, toneMapped: true }), 'sign')
      break
    case 'decorAtlas':
      m = withAtlas(new MeshBasicMaterial({ color: 0xffffff, map: atlasTextures.decor ?? null, toneMapped: true }), 'decor')
      break
    case 'viewAtlas':
      // painted views through interior windows: the same atlas, darkened to dusk/night by the day/night system
      m = withAtlas(new MeshBasicMaterial({ color: 0xffffff, map: atlasTextures.decor ?? null, toneMapped: true }), 'view')
      break
    case 'lightPool':
      m = new MeshBasicMaterial({
        color: 0xffffff, map: lightPoolTexture(), transparent: true, depthWrite: false,
        blending: AdditiveBlending, opacity: 0.16, toneMapped: false,
        polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4,
      })
      break
  }
  cache[kind] = m
  return m
}

export function disposeMaterials() {
  Object.values(cache).forEach((m) => m?.dispose())
  cache = {}
}
