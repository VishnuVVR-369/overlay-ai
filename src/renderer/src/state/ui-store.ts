import { create } from 'zustand'

interface UiState {
  compact: boolean
  helpOpen: boolean
  setCompact: (value: boolean) => void
  setHelpOpen: (value: boolean) => void
}

export const useUiStore = create<UiState>((set) => ({
  compact: false,
  helpOpen: false,
  setCompact: (compact) => set({ compact }),
  setHelpOpen: (helpOpen) => set({ helpOpen }),
}))
