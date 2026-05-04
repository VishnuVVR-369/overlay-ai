import { create } from 'zustand'
import type { SocketState, StreamTag } from '@shared/types'

interface StatusState {
  running: boolean
  micState: SocketState
  systemState: SocketState
  micMessage?: string
  systemMessage?: string
  setRunning: (running: boolean) => void
  setSocket: (stream: StreamTag, state: SocketState, message?: string) => void
}

export const useStatusStore = create<StatusState>((set) => ({
  running: false,
  micState: 'idle',
  systemState: 'idle',
  setRunning: (running) => set({ running }),
  setSocket: (stream, state, message) =>
    set(
      stream === 'mic'
        ? { micState: state, micMessage: message }
        : { systemState: state, systemMessage: message },
    ),
}))
