import { create } from 'zustand'
import { MODEL_ASSETS, type ModelKey } from '@/data/assets'
import { probeAsset } from '@/utils/assetProbe'

interface AssetState {
  probed: boolean
  models: Partial<Record<ModelKey, boolean>>
  probeModels: () => Promise<void>
  markFailed: (key: ModelKey) => void
}

export const useAssetStore = create<AssetState>((set, get) => ({
  probed: false,
  models: {},
  probeModels: async () => {
    if (get().probed) return
    const entries = Object.entries(MODEL_ASSETS) as [ModelKey, { url: string }][]
    const results = await Promise.all(entries.map(async ([k, a]) => [k, await probeAsset(a.url, 'model')] as const))
    const models: Partial<Record<ModelKey, boolean>> = {}
    for (const [k, ok] of results) {
      models[k] = ok
      if (import.meta.env.DEV) {
        console.info(ok ? `[assets] ${MODEL_ASSETS[k].url} found — using GLB` : `[assets] ${MODEL_ASSETS[k].url} not found — using procedural placeholder`)
      }
    }
    set({ models, probed: true })
  },
  markFailed: (key) => {
    console.warn(`[assets] Failed to load ${MODEL_ASSETS[key].url}. Using placeholder.`)
    set((s) => ({ models: { ...s.models, [key]: false } }))
  },
}))

export function hasModel(key: ModelKey) {
  return !!useAssetStore.getState().models[key]
}
