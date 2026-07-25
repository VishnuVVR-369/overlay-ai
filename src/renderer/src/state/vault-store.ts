import { create } from 'zustand'
import type { VaultData } from '@shared/types'

const EMPTY_VAULT: VaultData = {
  resume: '',
  jobDescription: '',
  companyValues: '',
  interviewerNotes: '',
  stories: [],
}

interface VaultStoreState {
  data: VaultData
  draft: VaultData | null
  hydrated: boolean
  setState: (data: VaultData) => void
  setDraft: (draft: VaultData) => void
}

export const useVaultStore = create<VaultStoreState>((set) => ({
  data: EMPTY_VAULT,
  draft: null,
  hydrated: false,
  setState: (data) =>
    set((state) => ({
      data,
      draft:
        state.draft === null || !state.hydrated || vaultEquals(state.draft, state.data)
          ? data
          : state.draft,
      hydrated: true,
    })),
  setDraft: (draft) => set({ draft }),
}))

export function emptyVault(): VaultData {
  return { ...EMPTY_VAULT, stories: [] }
}

export function vaultEquals(a: VaultData, b: VaultData): boolean {
  if (a.resume !== b.resume) return false
  if (a.jobDescription !== b.jobDescription) return false
  if (a.companyValues !== b.companyValues) return false
  if (a.interviewerNotes !== b.interviewerNotes) return false
  if (a.stories.length !== b.stories.length) return false
  return a.stories.every((story, index) => {
    const other = b.stories[index]
    return story.id === other.id && story.title === other.title && story.body === other.body
  })
}
