import { asset } from '@/utils/basePath'
import type { MoveState } from '@/core/runtime'

/**
 * Replaceable asset manifest. Drop GLB files into /public/models with these
 * names and they are picked up automatically at startup; anything missing
 * falls back to the procedural placeholder. Gameplay code never references
 * these files directly: it talks to CharacterModel / VehicleModel / PropModels.
 */
export type ClipMap = Partial<Record<MoveState | 'sit' | 'talk', string>>

export interface ModelAsset {
  url: string
  /** uniform scale applied to the loaded scene */
  scale?: number
  /** yaw correction if the model's forward is not +Z */
  rotationY?: number
  /** vertical offset so the feet/wheels touch the ground */
  offsetY?: number
  /** animation clip names (case-insensitive substring match is used as a fallback) */
  clips?: ClipMap
  /** metres per second the walk / run clips were authored at, for timeScale matching */
  nativeWalkSpeed?: number
  nativeRunSpeed?: number
}

export const MODEL_ASSETS = {
  character: {
    url: asset('/models/character.glb'), scale: 1, rotationY: 0, offsetY: 0,
    clips: { idle: 'Idle', walk: 'Walk', run: 'Run', jump: 'Jump', fall: 'Fall', land: 'Land' },
    nativeWalkSpeed: 1.7, nativeRunSpeed: 4.8,
  },
  npc: {
    url: asset('/models/npc.glb'), scale: 1,
    clips: { idle: 'Idle', walk: 'Walk', run: 'Run', sit: 'Sit', talk: 'Talk' },
    nativeWalkSpeed: 1.4, nativeRunSpeed: 4,
  },
  car: { url: asset('/models/car.glb'), scale: 1 },
  van: { url: asset('/models/van.glb'), scale: 1 },
  bus: { url: asset('/models/bus.glb'), scale: 1 },
  tree: { url: asset('/models/tree.glb'), scale: 1 },
  bench: { url: asset('/models/bench.glb'), scale: 1 },
  lamp: { url: asset('/models/lamp.glb'), scale: 1 },
} satisfies Record<string, ModelAsset>

export type ModelKey = keyof typeof MODEL_ASSETS

export const AUDIO_ASSETS = {
  ambient: asset('/audio/ambient-city.mp3'),
  music: asset('/audio/music.mp3'),
  birds: asset('/audio/birds.mp3'),
  footstep: asset('/audio/footstep.mp3'),
  jump: asset('/audio/jump.mp3'),
  land: asset('/audio/land.mp3'),
  click: asset('/audio/ui-click.mp3'),
  interact: asset('/audio/interact.mp3'),
  open: asset('/audio/open.mp3'),
  vehicle: asset('/audio/vehicle.mp3'),
} as const

export type AudioKey = keyof typeof AUDIO_ASSETS
