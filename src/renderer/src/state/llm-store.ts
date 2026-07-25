import { create } from 'zustand'
import type { LlmEntryMode } from '@shared/types'

export interface LlmEntry {
  requestId: string
  mode: LlmEntryMode
  imageDataUrl?: string
  text: string
  /** Each entry is a single rAF flush worth of new text. Used for streaming reveal animation. */
  chunks: string[]
  status: 'streaming' | 'done' | 'error'
  error?: string
  startedAt: number
  finishedAt?: number
}

interface LlmState {
  entries: LlmEntry[]
  startEntry: (requestId: string, mode?: LlmEntryMode, imageDataUrl?: string) => void
  appendToken: (requestId: string, delta: string) => void
  finishEntry: (requestId: string, full: string) => void
  errorEntry: (requestId: string, message: string) => void
  clear: () => void
}

const pendingDeltas = new Map<string, string>()
const MAX_RETAINED_SCREENSHOTS = 3
let rafHandle: number | null = null

function flushDeltas(set: (fn: (s: LlmState) => Partial<LlmState>) => void): void {
  rafHandle = null
  if (pendingDeltas.size === 0) return
  const deltas = new Map(pendingDeltas)
  pendingDeltas.clear()
  set((state) => ({
    entries: state.entries.map((e) => {
      const delta = deltas.get(e.requestId)
      if (!delta) return e
      return { ...e, text: e.text + delta, chunks: [...e.chunks, delta] }
    }),
  }))
}

export const useLlmStore = create<LlmState>((set) => ({
  entries: [],
  startEntry: (requestId, mode = 'transcript', imageDataUrl) =>
    set((state) => {
      let retainedScreenshots = imageDataUrl ? 1 : 0
      const priorEntries = state.entries.map((entry) => {
        if (!entry.imageDataUrl) return entry
        retainedScreenshots += 1
        return retainedScreenshots <= MAX_RETAINED_SCREENSHOTS
          ? entry
          : { ...entry, imageDataUrl: undefined }
      })
      return {
        entries: [
          { requestId, mode, imageDataUrl, text: '', chunks: [], status: 'streaming', startedAt: Date.now() },
          ...priorEntries,
        ],
      }
    }),
  appendToken: (requestId, delta) => {
    pendingDeltas.set(requestId, (pendingDeltas.get(requestId) ?? '') + delta)
    if (rafHandle === null) {
      rafHandle = requestAnimationFrame(() => flushDeltas(set))
    }
  },
  finishEntry: (requestId, full) => {
    pendingDeltas.delete(requestId)
    set((state) => ({
      entries: state.entries.map((e) =>
        e.requestId === requestId
          ? { ...e, text: full || e.text, status: 'done', finishedAt: Date.now() }
          : e,
      ),
    }))
  },
  errorEntry: (requestId, message) => {
    pendingDeltas.delete(requestId)
    set((state) => ({
      entries: state.entries.map((e) =>
        e.requestId === requestId ? { ...e, status: 'error', error: message, finishedAt: Date.now() } : e,
      ),
    }))
  },
  clear: () => {
    pendingDeltas.clear()
    set({ entries: [] })
  },
}))
