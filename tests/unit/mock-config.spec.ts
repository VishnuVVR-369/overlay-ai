import { describe, expect, it } from 'vitest'
import {
  buildMockInstructions,
  FEEDBACK_RESPONSE_INSTRUCTIONS,
  FEEDBACK_USER_PROMPT,
  RESET_RESPONSE_INSTRUCTIONS,
  sanitizeMockConfig,
} from '@main/mock/mock-config'
import type { MockInterviewConfig, VaultData } from '@shared/types'

const emptyVault = (): VaultData => ({
  resume: '',
  jobDescription: '',
  companyValues: '',
  interviewerNotes: '',
  stories: [],
})

describe('mock interview config', () => {
  it('sanitizes invalid preset and duration with safe defaults', () => {
    expect(sanitizeMockConfig(
      { presetId: 'unknown', durationMinutes: 999 } as unknown as Partial<MockInterviewConfig>,
      { presetId: 'coding' },
    )).toEqual({ presetId: 'coding', durationMinutes: 30 })
  })

  it('accepts supported presets and durations', () => {
    expect(sanitizeMockConfig({ presetId: 'system-design', durationMinutes: 45 }, { presetId: 'behavioral' }))
      .toEqual({ presetId: 'system-design', durationMinutes: 45 })
  })

  it('builds interviewer instructions from preset and vault context', () => {
    const instructions = buildMockInstructions(
      { presetId: 'behavioral', durationMinutes: 30 },
      {
        preset: { id: 'behavioral', label: 'Behavioral', defaultPrompt: 'd', effectivePrompt: 'd', overridden: false },
        vault: {
          ...emptyVault(),
          resume: 'Backend engineer',
          jobDescription: 'Staff platform role',
          companyValues: 'Customer focus',
          interviewerNotes: 'Hiring manager likes tradeoffs',
          stories: [{ id: 's1', title: 'Migration', body: 'Cut latency 40%' }],
        },
      },
    )

    expect(instructions).toContain('Interview type: Behavioral')
    expect(instructions).toContain('Duration target: 30 minutes')
    expect(instructions).toContain('Backend engineer')
    expect(instructions).toContain('Staff platform role')
    expect(instructions).toContain('Customer focus')
    expect(instructions).toContain('Hiring manager likes tradeoffs')
    expect(instructions).toContain('Migration: Cut latency 40%')
    expect(instructions).toContain('Do not give the candidate a model answer')
  })

  it('keeps feedback and reset prompts constrained', () => {
    expect(FEEDBACK_USER_PROMPT).toContain('Strengths')
    expect(FEEDBACK_USER_PROMPT).toContain('Gaps')
    expect(FEEDBACK_USER_PROMPT).toContain('Next drill')
    expect(FEEDBACK_RESPONSE_INSTRUCTIONS).toContain('only concise post-interview feedback')
    expect(RESET_RESPONSE_INSTRUCTIONS).toContain('fresh opening question')
  })
})
