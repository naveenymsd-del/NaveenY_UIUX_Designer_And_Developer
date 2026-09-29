export type Quality = 'low' | 'medium' | 'high'

export function isTouchDevice(): boolean {
  if (typeof window === 'undefined') return false
  const params = new URLSearchParams(window.location.search)
  if (params.has('touch')) return true
  if (params.has('desktop')) return false
  return window.matchMedia?.('(pointer: coarse)').matches || navigator.maxTouchPoints > 1
}

/** Reads the unmasked GPU name (when the browser exposes it). */
export function gpuName(): string {
  try {
    const gl = document.createElement('canvas').getContext('webgl2') ?? document.createElement('canvas').getContext('webgl')
    if (!gl) return ''
    const ext = gl.getExtension('WEBGL_debug_renderer_info')
    const name = ext ? String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)) : String(gl.getParameter(gl.RENDERER))
    gl.getExtension('WEBGL_lose_context')?.loseContext()
    return name
  } catch {
    return ''
  }
}

/**
 * Picks a starting quality tier from device class and GPU. The runtime
 * PerformanceMonitor then fine-tunes resolution and can step the tier down.
 */
export function detectQuality(): Quality {
  if (typeof window === 'undefined') return 'medium'
  const params = new URLSearchParams(window.location.search)
  const forced = params.get('quality')
  if (forced === 'low' || forced === 'medium' || forced === 'high') return forced
  const touch = isTouchDevice()
  const cores = navigator.hardwareConcurrency ?? 4
  const mem = (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 8
  const gpu = gpuName()
  const software = /swiftshader|llvmpipe|software|basic render/i.test(gpu)
  const integrated = /intel|uhd|iris|hd graphics|mali|adreno|powervr|videocore/i.test(gpu)
  if (software) return 'low'
  if (touch) return cores >= 8 && mem >= 6 && !/mali|powervr/i.test(gpu) ? 'medium' : 'low'
  if (integrated || cores <= 4 || mem <= 4) return 'medium'
  return 'high'
}

export interface QualitySettings {
  dpr: [number, number]
  shadows: boolean
  softShadows: boolean
  shadowMapSize: number
  postprocessing: boolean
  multisampling: number
  fxaa: boolean
  npcShadowDistance: number
  particleCount: number
  antialias: boolean
}

export function qualitySettings(q: Quality): QualitySettings {
  switch (q) {
    case 'low':
      return { dpr: [0.75, 1.25], shadows: true, softShadows: false, shadowMapSize: 1024, postprocessing: false, multisampling: 0, fxaa: false, npcShadowDistance: 0, particleCount: 60, antialias: true }
    case 'medium':
      return { dpr: [0.85, 1.35], shadows: true, softShadows: false, shadowMapSize: 2048, postprocessing: true, multisampling: 0, fxaa: true, npcShadowDistance: 0, particleCount: 120, antialias: false }
    default:
      return { dpr: [1, 1.75], shadows: true, softShadows: true, shadowMapSize: 2048, postprocessing: true, multisampling: 4, fxaa: false, npcShadowDistance: 18, particleCount: 200, antialias: false }
  }
}

/** ?off=shadows,npc,traffic,parts,env,particles,sky — debug switches for profiling subsystems. */
export function offFlags(): Set<string> {
  if (typeof window === 'undefined') return new Set()
  const v = new URLSearchParams(window.location.search).get('off')
  return new Set(v ? v.split(',') : [])
}
