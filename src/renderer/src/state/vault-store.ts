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
  hydrated: boolean
  setState: (data: VaultData) => void
}

export const useVaultStore = create<VaultStoreState>((set) => ({
  data: EMPTY_VAULT,
  hydrated: false,
  setState: (data) => set({ data, hydrated: true }),
}))

export function emptyVault(): VaultData {
  return { ...EMPTY_VAULT, stories: [] }
}
