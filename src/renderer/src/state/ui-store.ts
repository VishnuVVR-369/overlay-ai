import { create } from 'zustand'
import type { PermissionStatus, WindowMode } from '@shared/types'

interface UiState {
  mode: WindowMode
  helpOpen: boolean
  settingsOpen: boolean
  focused: boolean
  permStatus: PermissionStatus
  expandedEntries: Record<string, true>
  headlineFirst: boolean
  setMode: (mode: WindowMode) => void
  setHelpOpen: (value: boolean) => void
  setSettingsOpen: (value: boolean) => void
  setFocused: (value: boolean) => void
  setPermStatus: (status: PermissionStatus) => void
  toggleEntryExpanded: (id: string) => void
  setHeadlineFirst: (value: boolean) => void
}

export const useUiStore = create<UiState>((set) => ({
  mode: 'normal',
  helpOpen: false,
  settingsOpen: false,
  focused: true,
  permStatus: { mic: 'unknown', screen: 'unknown' },
  expandedEntries: {},
  headlineFirst: true,
  setMode: (mode) => set({ mode }),
  setHelpOpen: (helpOpen) => set({ helpOpen }),
  setSettingsOpen: (settingsOpen) => set({ settingsOpen }),
  setFocused: (focused) => set({ focused }),
  setPermStatus: (permStatus) => set({ permStatus }),
  toggleEntryExpanded: (id) =>
    set((state) => {
      const next = { ...state.expandedEntries }
      if (next[id]) delete next[id]
      else next[id] = true
      return { expandedEntries: next }
    }),
  setHeadlineFirst: (headlineFirst) => set({ headlineFirst }),
}))
