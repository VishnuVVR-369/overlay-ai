import { create } from 'zustand'
import type { SocketState, StreamTag } from '@shared/types'

interface StatusState {
  running: boolean
  /** When the current listening session started, for the HUD elapsed clock. */
  startedAt: number | null
  micState: SocketState
  systemState: SocketState
  micMessage?: string
  systemMessage?: string
  setRunning: (running: boolean) => void
  setSocket: (stream: StreamTag, state: SocketState, message?: string) => void
}

export const useStatusStore = create<StatusState>((set, get) => ({
  running: false,
  startedAt: null,
  micState: 'idle',
  systemState: 'idle',
  setRunning: (running) =>
    set({
      running,
      // Keep the original start time across redundant setRunning(true) calls.
      startedAt: running ? (get().startedAt ?? Date.now()) : null,
    }),
  setSocket: (stream, state, message) =>
    set(
      stream === 'mic'
        ? { micState: state, micMessage: message }
        : { systemState: state, systemMessage: message },
    ),
}))
