import { create } from 'zustand'
import type { Speaker, TranscriptSegment, TranscriptUpdate } from '@shared/types'

interface TranscriptState {
  segments: TranscriptSegment[]
  partials: { you?: TranscriptSegment; them?: TranscriptSegment }
  apply: (update: TranscriptUpdate) => void
  reset: () => void
  setSnapshot: (snap: { segments: TranscriptSegment[]; partials: { you?: TranscriptSegment; them?: TranscriptSegment } }) => void
}

export const useTranscriptStore = create<TranscriptState>((set) => ({
  segments: [],
  partials: {},
  apply: (update) =>
    set((state) => {
      const speaker: Speaker = update.speaker
      if (update.kind === 'partial') {
        return {
          partials: {
            ...state.partials,
            [speaker]: {
              id: update.segmentId,
              speaker,
              status: 'partial' as const,
              text: update.text,
              startedAt: update.startedAt,
            },
          },
        }
      }
      const segment: TranscriptSegment = {
        id: update.segmentId,
        speaker,
        status: 'committed',
        text: update.text,
        startedAt: update.startedAt,
        committedAt: update.committedAt,
      }
      const partials = { ...state.partials }
      if (partials[speaker]?.id === update.segmentId) partials[speaker] = undefined
      return {
        segments: [...state.segments, segment],
        partials,
      }
    }),
  reset: () => set({ segments: [], partials: {} }),
  setSnapshot: (snap) => set({ segments: snap.segments, partials: snap.partials }),
}))
