import { Suspense } from 'react'
import type { CharacterAnim } from '@/core/runtime'
import { MODEL_ASSETS } from '@/data/assets'
import { useAssetStore } from '@/stores/assetStore'
import type { CharacterLook } from './characterLook'
import { AssetErrorBoundary } from './ErrorBoundary'
import { GLBCharacter } from './GLBCharacter'
import { ProceduralCharacter } from './ProceduralCharacter'

interface Props {
  anim: CharacterAnim
  look: CharacterLook
  /** which manifest entry to try: the player or the generic NPC model */
  asset?: 'character' | 'npc'
  castShadow?: boolean
}

/**
 * Replaceable character slot. Movement, collision and camera code only ever
 * render <CharacterModel>; whether a GLB or the procedural rig appears is an
 * asset decision made here.
 */
export function CharacterModel({ anim, look, asset = 'character', castShadow = true }: Props) {
  const available = useAssetStore((s) => !!s.models[asset])
  const markFailed = useAssetStore((s) => s.markFailed)
  const fallback = <ProceduralCharacter anim={anim} look={look} castShadow={castShadow} />
  if (!available) return fallback
  return (
    <AssetErrorBoundary fallback={fallback} label={MODEL_ASSETS[asset].url} onError={() => markFailed(asset)}>
      <Suspense fallback={fallback}>
        <GLBCharacter asset={MODEL_ASSETS[asset]} anim={anim} castShadow={castShadow} />
      </Suspense>
    </AssetErrorBoundary>
  )
}
