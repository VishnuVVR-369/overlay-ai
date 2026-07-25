import { create } from 'zustand'
import type { AnswerStyleDef, AnswerStyleId, AnswerStyleState } from '@shared/types'

interface AnswerStyleStoreState {
  active: AnswerStyleId
  styles: AnswerStyleDef[]
  hydrated: boolean
  setState: (state: AnswerStyleState) => void
}

export const useAnswerStyleStore = create<AnswerStyleStoreState>((set) => ({
  active: 'concise',
  styles: [],
  hydrated: false,
  setState: (state) => set({ active: state.active, styles: state.styles, hydrated: true }),
}))
