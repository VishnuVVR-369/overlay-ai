import { create } from 'zustand'
import type { MockInterviewStatus } from '@shared/types'

interface MockState {
  status: MockInterviewStatus
  setStatus: (status: MockInterviewStatus) => void
  reset: () => void
}

const idleStatus: MockInterviewStatus = { state: 'idle', paused: false }

export const useMockStore = create<MockState>((set) => ({
  status: idleStatus,
  setStatus: (status) => set({ status }),
  reset: () => set({ status: idleStatus }),
}))
