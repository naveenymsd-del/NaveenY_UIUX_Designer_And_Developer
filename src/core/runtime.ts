import { Vector3 } from 'three'

/**
 * Hot-path mutable runtime state. Values here change every frame and are read
 * inside useFrame loops, so they deliberately live outside React/Zustand to
 * avoid re-renders. Zustand stores hold only low-frequency, UI-facing state.
 */
export type MoveState = 'idle' | 'walk' | 'run' | 'jump' | 'fall' | 'land'
export type SpecialPose = 'none' | 'sit' | 'talk' | 'look' | 'phone'

export interface CharacterAnim {
  state: MoveState
  /** horizontal speed in m/s */
  speed: number
  /** gait phase in radians, advanced by distance travelled so feet never skate */
  phase: number
  /** yaw rate in rad/s (positive = turning left); drives lean */
  turnRate: number
  /** lateral velocity relative to facing (strafe component), m/s */
  strafe: number
  /** vertical velocity */
  vy: number
  grounded: boolean
  /** 0..1 impulse that decays after landing */
  landImpact: number
  /** special poses for NPCs */
  pose: SpecialPose
  /** false freezes animation updates (distance culling) */
  active: boolean
  walkSpeed: number
  runSpeed: number
  /** stride length (metres per full gait cycle) at walk / run */
  walkStride: number
  runStride: number
}

export function createAnim(overrides: Partial<CharacterAnim> = {}): CharacterAnim {
  return {
    state: 'idle', speed: 0, phase: 0, turnRate: 0, strafe: 0, vy: 0, grounded: true,
    landImpact: 0, pose: 'none', active: true, walkSpeed: 3.4, runSpeed: 6.8,
    walkStride: 1.35, runStride: 2.3,
    ...overrides,
  }
}

export const SPAWN = new Vector3(0, 0.16, 72.5)
export const SPAWN_YAW = Math.PI // facing north (-z)

export const playerRuntime = {
  position: SPAWN.clone(),
  velocity: new Vector3(),
  yaw: SPAWN_YAW,
  grounded: true,
  anim: createAnim(),
  lastSafe: SPAWN.clone(),
  teleportRequest: null as null | { position: Vector3; yaw?: number },
  onFootstep: new Set<(run: boolean) => void>(),
  onJump: new Set<() => void>(),
  onLand: new Set<(impact: number) => void>(),
}

export const CAMERA_DEFAULTS = {
  distance: 7.0,
  pitch: 0.36,
  minPitch: -0.18,
  maxPitch: 1.15,
  minDistance: 3.2,
  maxDistance: 11,
  targetHeight: 1.7,
}

export const cameraRuntime = {
  /** actual (smoothed) yaw/pitch used for rendering and movement direction */
  yaw: 0,
  pitch: CAMERA_DEFAULTS.pitch,
  /** input-driven targets the actual values ease toward */
  targetYaw: 0,
  targetPitch: CAMERA_DEFAULTS.pitch,
  distance: CAMERA_DEFAULTS.distance,
  dragging: false,
  /** performance.now() of the last manual camera input */
  lastUserInput: -1e9,
  /** set by teleports: the camera jumps instead of blending */
  snap: false,
  /** world-space camera position (audio listener, culling) */
  position: new Vector3(0, 60, 120),
}

/** A subtle, player-controllable reveal when entering a landmark zone for the first time. */
export const cinematicRuntime = {
  active: false,
  start: 0,
  reveal: new Vector3(),
}

/** Screen-space anchors written by the canvas, read by DOM overlays without React re-renders. */
export const screenAnchors = {
  prompt: { x: 0, y: 0, visible: false },
}

/** Pedestrians register positions here so vehicles can yield to them. */
export const agentPositions = new Map<string, Vector3>()
/** Vehicles register positions here for audio and NPC awareness. */
export const vehiclePositions = new Map<string, Vector3>()

export function requestTeleport(position: Vector3, yaw?: number) {
  playerRuntime.teleportRequest = { position: position.clone(), yaw }
}
