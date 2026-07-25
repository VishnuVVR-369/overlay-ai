import { create } from 'zustand'
import type { PresetEntry, PresetId, PresetState } from '@shared/types'

interface PresetStoreState {
  active: PresetId
  presets: PresetEntry[]
  hydrated: boolean
  /**
   * Unsaved system-prompt edits, kept out of the component so switching console
   * tabs (which unmounts the editor) does not throw the text away.
   */
  drafts: Partial<Record<PresetId, string>>
  setState: (state: PresetState) => void
  setDraft: (id: PresetId, prompt: string) => void
  clearDraft: (id: PresetId) => void
}

export const usePresetStore = create<PresetStoreState>((set) => ({
  active: 'behavioral',
  presets: [],
  hydrated: false,
  drafts: {},
  setState: (state) => set({ active: state.active, presets: state.presets, hydrated: true }),
  setDraft: (id, prompt) => set((state) => ({ drafts: { ...state.drafts, [id]: prompt } })),
  clearDraft: (id) =>
    set((state) => {
      if (!(id in state.drafts)) return state
      const drafts = { ...state.drafts }
      delete drafts[id]
      return { drafts }
    }),
}))

export function findPreset(presets: PresetEntry[], id: PresetId): PresetEntry | undefined {
  return presets.find((p) => p.id === id)
}
