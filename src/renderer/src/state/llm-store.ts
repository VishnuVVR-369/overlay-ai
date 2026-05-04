import { create } from 'zustand'

export interface LlmEntry {
  requestId: string
  text: string
  status: 'streaming' | 'done' | 'error'
  error?: string
  startedAt: number
  finishedAt?: number
}

interface LlmState {
  entries: LlmEntry[]
  startEntry: (requestId: string) => void
  appendToken: (requestId: string, delta: string) => void
  finishEntry: (requestId: string, full: string) => void
  errorEntry: (requestId: string, message: string) => void
  clear: () => void
}

export const useLlmStore = create<LlmState>((set) => ({
  entries: [],
  startEntry: (requestId) =>
    set((state) => ({
      entries: [{ requestId, text: '', status: 'streaming', startedAt: Date.now() }, ...state.entries],
    })),
  appendToken: (requestId, delta) =>
    set((state) => ({
      entries: state.entries.map((e) =>
        e.requestId === requestId ? { ...e, text: e.text + delta } : e,
      ),
    })),
  finishEntry: (requestId, full) =>
    set((state) => ({
      entries: state.entries.map((e) =>
        e.requestId === requestId ? { ...e, text: full || e.text, status: 'done', finishedAt: Date.now() } : e,
      ),
    })),
  errorEntry: (requestId, message) =>
    set((state) => ({
      entries: state.entries.map((e) =>
        e.requestId === requestId ? { ...e, status: 'error', error: message, finishedAt: Date.now() } : e,
      ),
    })),
  clear: () => set({ entries: [] }),
}))
