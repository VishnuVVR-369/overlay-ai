import { create } from 'zustand'
import type { MockSessionRecord, MockSessionSummary } from '@shared/types'

interface MockSessionsState {
  summaries: MockSessionSummary[]
  loaded: boolean
  selectedId: string | null
  selectedRecord: MockSessionRecord | null
  loadingRecord: boolean
  setSummaries: (summaries: MockSessionSummary[]) => void
  upsertSummary: (summary: MockSessionSummary) => void
  removeSummary: (id: string) => void
  setSelected: (id: string | null) => void
  setSelectedRecord: (record: MockSessionRecord | null) => void
  setLoadingRecord: (loading: boolean) => void
}

export const useMockSessionsStore = create<MockSessionsState>((set) => ({
  summaries: [],
  loaded: false,
  selectedId: null,
  selectedRecord: null,
  loadingRecord: false,
  setSummaries: (summaries) => set({ summaries, loaded: true }),
  upsertSummary: (summary) => set((state) => {
    const filtered = state.summaries.filter((s) => s.id !== summary.id)
    return { summaries: [summary, ...filtered].sort((a, b) => b.startedAt - a.startedAt) }
  }),
  removeSummary: (id) => set((state) => ({
    summaries: state.summaries.filter((s) => s.id !== id),
    selectedId: state.selectedId === id ? null : state.selectedId,
    selectedRecord: state.selectedRecord?.id === id ? null : state.selectedRecord,
  })),
  setSelected: (id) => set({ selectedId: id }),
  setSelectedRecord: (record) => set({ selectedRecord: record }),
  setLoadingRecord: (loading) => set({ loadingRecord: loading }),
}))
