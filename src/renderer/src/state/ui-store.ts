import { create } from 'zustand'
import type { PermissionStatus, WindowMode } from '@shared/types'

/**
 * The console is one surface with tabs, not a stack of slide-overs. A single
 * `consoleTab` (null = closed) means opening one section implicitly closes the
 * others, so no caller has to remember to shut three panels before opening a
 * fourth.
 */
export type ConsoleTab = 'setup' | 'context' | 'prompts' | 'practice' | 'history' | 'help'

export const CONSOLE_TABS: ReadonlyArray<{ id: ConsoleTab; label: string }> = [
  { id: 'setup', label: 'Setup' },
  { id: 'context', label: 'Context' },
  { id: 'prompts', label: 'Prompts' },
  { id: 'practice', label: 'Practice' },
  { id: 'history', label: 'History' },
  { id: 'help', label: 'Help' },
]

interface UiState {
  mode: WindowMode
  consoleTab: ConsoleTab | null
  paletteOpen: boolean
  transcriptOpen: boolean
  focused: boolean
  permStatus: PermissionStatus
  expandedEntries: Record<string, true>
  headlineFirst: boolean
  setMode: (mode: WindowMode) => void
  openConsole: (tab: ConsoleTab) => void
  closeConsole: () => void
  toggleConsole: (tab: ConsoleTab) => void
  setPaletteOpen: (value: boolean) => void
  togglePalette: () => void
  closeOverlays: () => void
  setTranscriptOpen: (value: boolean) => void
  toggleTranscript: () => void
  setFocused: (value: boolean) => void
  setPermStatus: (status: PermissionStatus) => void
  toggleEntryExpanded: (id: string) => void
  setHeadlineFirst: (value: boolean) => void
}

export const useUiStore = create<UiState>((set, get) => ({
  mode: 'normal',
  consoleTab: null,
  paletteOpen: false,
  transcriptOpen: true,
  focused: true,
  permStatus: { mic: 'unknown', screen: 'unknown' },
  expandedEntries: {},
  headlineFirst: true,
  setMode: (mode) => set({ mode }),
  // Opening the console always dismisses the palette — the palette is how you
  // got here, and leaving it stacked on top would trap Escape.
  openConsole: (consoleTab) => set({ consoleTab, paletteOpen: false }),
  closeConsole: () => set({ consoleTab: null }),
  toggleConsole: (tab) =>
    set((state) => ({
      consoleTab: state.consoleTab === tab ? null : tab,
      paletteOpen: false,
    })),
  setPaletteOpen: (paletteOpen) => set({ paletteOpen }),
  togglePalette: () => set({ paletteOpen: !get().paletteOpen }),
  closeOverlays: () => set({ consoleTab: null, paletteOpen: false }),
  setTranscriptOpen: (transcriptOpen) => set({ transcriptOpen }),
  toggleTranscript: () => set({ transcriptOpen: !get().transcriptOpen }),
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
