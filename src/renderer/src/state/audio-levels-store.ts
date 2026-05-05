import { create } from 'zustand'
import type { StreamTag } from '@shared/types'

const HISTORY = 160 // ~5.3s at 30Hz

interface AudioLevelsState {
  mic: Float32Array
  system: Float32Array
  micLatest: number
  systemLatest: number
  push: (stream: StreamTag, rms: number) => void
  resetStream: (stream: StreamTag) => void
  resetAll: () => void
}

const empty = (): Float32Array => new Float32Array(HISTORY)

export const useAudioLevelsStore = create<AudioLevelsState>((set) => ({
  mic: empty(),
  system: empty(),
  micLatest: 0,
  systemLatest: 0,
  push: (stream, rms) =>
    set((state) => {
      const key = stream === 'mic' ? 'mic' : 'system'
      const buf = state[key]
      const next = new Float32Array(HISTORY)
      next.set(buf.subarray(1))
      next[HISTORY - 1] = rms
      return key === 'mic'
        ? { mic: next, micLatest: rms }
        : { system: next, systemLatest: rms }
    }),
  resetStream: (stream) =>
    set(() =>
      stream === 'mic'
        ? { mic: empty(), micLatest: 0 }
        : { system: empty(), systemLatest: 0 },
    ),
  resetAll: () => set({ mic: empty(), system: empty(), micLatest: 0, systemLatest: 0 }),
}))

export const AUDIO_HISTORY = HISTORY
