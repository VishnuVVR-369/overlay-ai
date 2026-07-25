import { create } from 'zustand'
import type { PresetEntry, PresetId, PresetState } from '@shared/types'

interface PresetStoreState {
  active: PresetId
  presets: PresetEntry[]
  hydrated: boolean
  setState: (state: PresetState) => void
}

export const usePresetStore = create<PresetStoreState>((set) => ({
  active: 'behavioral',
  presets: [],
  hydrated: false,
  setState: (state) => set({ active: state.active, presets: state.presets, hydrated: true }),
}))

export function findPreset(presets: PresetEntry[], id: PresetId): PresetEntry | undefined {
  return presets.find((p) => p.id === id)
}
