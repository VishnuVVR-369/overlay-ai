import { create } from 'zustand'
import type { VaultData } from '@shared/types'
import { VAULT_LIMITS } from '@shared/vault'

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

export type VaultFieldKey = keyof Omit<VaultData, 'stories'>

export const VAULT_FIELD_KEYS: readonly VaultFieldKey[] = [
  'resume',
  'jobDescription',
  'companyValues',
  'interviewerNotes',
]

export type VaultIssue =
  | { kind: 'too-long'; limit: number; length: number }
  | { kind: 'missing-title' }
  | { kind: 'missing-body' }
  | { kind: 'title-too-long'; limit: number; length: number }
  | { kind: 'body-too-long'; limit: number; length: number }
  | { kind: 'over-story-limit'; limit: number }

export interface VaultValidation {
  fields: Partial<Record<VaultFieldKey, VaultIssue>>
  stories: Record<number, VaultIssue>
  ok: boolean
}

/**
 * Mirrors what `sanitizeVault` in the main process would drop or truncate, so
 * the editor can flag it while the text is still on screen.
 */
export function validateVault(vault: VaultData): VaultValidation {
  const fields: Partial<Record<VaultFieldKey, VaultIssue>> = {}
  for (const key of VAULT_FIELD_KEYS) {
    const length = vault[key].trim().length
    if (length > VAULT_LIMITS.fieldChars) {
      fields[key] = { kind: 'too-long', limit: VAULT_LIMITS.fieldChars, length }
    }
  }

  const stories: Record<number, VaultIssue> = {}
  vault.stories.forEach((story, index) => {
    const title = story.title.trim()
    const body = story.body.trim()
    if (index >= VAULT_LIMITS.storiesMax) {
      stories[index] = { kind: 'over-story-limit', limit: VAULT_LIMITS.storiesMax }
    } else if (title.length === 0) {
      stories[index] = { kind: 'missing-title' }
    } else if (body.length === 0) {
      stories[index] = { kind: 'missing-body' }
    } else if (title.length > VAULT_LIMITS.storyTitleChars) {
      stories[index] = { kind: 'title-too-long', limit: VAULT_LIMITS.storyTitleChars, length: title.length }
    } else if (body.length > VAULT_LIMITS.storyBodyChars) {
      stories[index] = { kind: 'body-too-long', limit: VAULT_LIMITS.storyBodyChars, length: body.length }
    }
  })

  return {
    fields,
    stories,
    ok: Object.keys(fields).length === 0 && Object.keys(stories).length === 0,
  }
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
