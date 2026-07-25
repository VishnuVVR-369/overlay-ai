import { describe, expect, it } from 'vitest'
import { validateVault, emptyVault } from '@/state/vault-store'
import { VAULT_LIMITS } from '@shared/vault'

const withStories = (stories: Array<{ id: string; title: string; body: string }>) => ({
  ...emptyVault(),
  stories,
})

describe('validateVault', () => {
  it('accepts an empty vault and a complete one', () => {
    expect(validateVault(emptyVault()).ok).toBe(true)
    expect(validateVault(withStories([{ id: 's1', title: 'Migration', body: 'S/T/A/R' }])).ok).toBe(true)
  })

  it('flags stories the main process would drop', () => {
    const missingBody = validateVault(withStories([{ id: 's1', title: 'Migration', body: '  ' }]))
    expect(missingBody.ok).toBe(false)
    expect(missingBody.stories[0]).toEqual({ kind: 'missing-body' })

    const missingTitle = validateVault(withStories([{ id: 's1', title: '', body: 'S/T/A/R' }]))
    expect(missingTitle.stories[0]).toEqual({ kind: 'missing-title' })
  })

  it('flags content the main process would truncate', () => {
    const longField = validateVault({ ...emptyVault(), resume: 'x'.repeat(VAULT_LIMITS.fieldChars + 1) })
    expect(longField.ok).toBe(false)
    expect(longField.fields.resume).toEqual({
      kind: 'too-long',
      limit: VAULT_LIMITS.fieldChars,
      length: VAULT_LIMITS.fieldChars + 1,
    })

    const longTitle = validateVault(
      withStories([{ id: 's1', title: 'x'.repeat(VAULT_LIMITS.storyTitleChars + 1), body: 'S/T/A/R' }]),
    )
    expect(longTitle.stories[0]).toMatchObject({ kind: 'title-too-long' })

    const longBody = validateVault(
      withStories([{ id: 's1', title: 'Migration', body: 'x'.repeat(VAULT_LIMITS.storyBodyChars + 1) }]),
    )
    expect(longBody.stories[0]).toMatchObject({ kind: 'body-too-long' })
  })

  it('flags stories beyond the cap the main process keeps', () => {
    const stories = Array.from({ length: VAULT_LIMITS.storiesMax + 1 }, (_, i) => ({
      id: `s${i}`,
      title: `Story ${i}`,
      body: 'S/T/A/R',
    }))
    const result = validateVault(withStories(stories))
    expect(result.ok).toBe(false)
    expect(result.stories[VAULT_LIMITS.storiesMax]).toEqual({
      kind: 'over-story-limit',
      limit: VAULT_LIMITS.storiesMax,
    })
    expect(result.stories[VAULT_LIMITS.storiesMax - 1]).toBeUndefined()
  })
})
