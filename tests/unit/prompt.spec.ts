import { describe, expect, it } from 'vitest'
import {
  ANSWER_STYLE_IDS,
  ANSWER_STYLES,
  DEFAULT_ANSWER_STYLE_ID,
  DEFAULT_PRESET_ID,
  EMPTY_VAULT,
  HEADLINE_DIRECTIVE,
  PRESETS,
  PRESET_IDS,
  composePromptForAnswerStyle,
  composeSystemPrompt,
  formatVault,
  getPresetDef,
  isAnswerStyleId,
  isPresetId,
} from '@shared/prompt'
import type { VaultData } from '@shared/types'

function fullVault(over: Partial<VaultData> = {}): VaultData {
  return {
    resume: 'Senior engineer at Stripe, built payments migration.',
    jobDescription: 'Staff engineer, payments platform.',
    companyValues: 'Move with urgency.',
    interviewerNotes: 'Sara — ex-Square.',
    stories: [
      { id: 's1', title: 'Stripe payments migration', body: 'Cut latency 40% by introducing read-replicas.' },
      { id: 's2', title: 'Mentored 3 juniors', body: 'Weekly 1:1s, shipped two features each.' },
    ],
    ...over,
  }
}

describe('prompt presets', () => {
  it('ships exactly four preset ids in fixed order', () => {
    expect(PRESET_IDS).toEqual(['behavioral', 'coding', 'system-design', 'negotiation'])
    expect(PRESETS).toHaveLength(4)
  })

  it('default preset is behavioral', () => {
    expect(DEFAULT_PRESET_ID).toBe('behavioral')
  })

  it('every preset has a non-empty default prompt and label', () => {
    for (const p of PRESETS) {
      expect(p.label.length).toBeGreaterThan(0)
      expect(p.defaultPrompt.length).toBeGreaterThan(20)
    }
  })

  it('every preset prompt mentions first-person framing', () => {
    for (const p of PRESETS) {
      expect(p.defaultPrompt.toLowerCase()).toContain('first person')
    }
  })

  it('getPresetDef returns the matching def, or behavioral as fallback', () => {
    expect(getPresetDef('coding').id).toBe('coding')
    // @ts-expect-error: deliberately invalid id
    expect(getPresetDef('nonsense').id).toBe('behavioral')
  })

  it('isPresetId accepts known ids and rejects everything else', () => {
    for (const id of PRESET_IDS) expect(isPresetId(id)).toBe(true)
    expect(isPresetId('not-a-preset')).toBe(false)
    expect(isPresetId(undefined)).toBe(false)
    expect(isPresetId(null)).toBe(false)
    expect(isPresetId(7)).toBe(false)
  })

  it('ships the fixed answer styles and validates ids', () => {
    expect(ANSWER_STYLE_IDS).toEqual(['concise', 'think-aloud', 'clarify', 'edge-cases', 'complexity'])
    expect(ANSWER_STYLES).toHaveLength(5)
    expect(DEFAULT_ANSWER_STYLE_ID).toBe('concise')
    expect(isAnswerStyleId('think-aloud')).toBe(true)
    expect(isAnswerStyleId('not-a-style')).toBe(false)
  })

  it('composePromptForAnswerStyle appends style instructions without replacing the base prompt', () => {
    const composed = composePromptForAnswerStyle('BASE PROMPT', 'edge-cases')
    expect(composed).toContain('BASE PROMPT')
    expect(composed).toContain('Answer style: Edge cases')
    expect(composed.toLowerCase()).toContain('edge cases')
  })
})

describe('composeSystemPrompt', () => {
  it('with no opts produces the same output as composePromptForAnswerStyle', () => {
    expect(composeSystemPrompt('BASE', 'concise')).toBe(composePromptForAnswerStyle('BASE', 'concise'))
  })

  it('appends the headline directive when headlineFirst is true and omits it when false', () => {
    const on = composeSystemPrompt('BASE', 'concise', { headlineFirst: true })
    const off = composeSystemPrompt('BASE', 'concise', { headlineFirst: false })
    expect(on).toContain(HEADLINE_DIRECTIVE)
    expect(off).not.toContain(HEADLINE_DIRECTIVE)
  })

  it('does not include the personal-context section for an empty vault', () => {
    expect(composeSystemPrompt('BASE', 'concise', { vault: EMPTY_VAULT })).not.toContain('Personal context')
  })

  it('includes only non-empty vault sections', () => {
    const partial = composeSystemPrompt('BASE', 'concise', { vault: fullVault({ jobDescription: '', companyValues: '', interviewerNotes: '', stories: [] }) })
    expect(partial).toContain('Resume / background')
    expect(partial).not.toContain('Role / job description')
    expect(partial).not.toContain('Company values')
    expect(partial).not.toContain('Interviewer notes')
    expect(partial).not.toContain('STAR stories')
  })

  it('lists STAR stories with title and body in order', () => {
    const out = composeSystemPrompt('BASE', 'concise', { vault: fullVault() })
    const idxA = out.indexOf('Stripe payments migration')
    const idxB = out.indexOf('Mentored 3 juniors')
    expect(idxA).toBeGreaterThan(0)
    expect(idxB).toBeGreaterThan(idxA)
    expect(out).toContain('Cut latency 40%')
  })

  it('is deterministic for the same input (pure function)', () => {
    const a = composeSystemPrompt('BASE', 'coding', { vault: fullVault(), headlineFirst: true })
    const b = composeSystemPrompt('BASE', 'coding', { vault: fullVault(), headlineFirst: true })
    expect(a).toBe(b)
  })
})

describe('formatVault', () => {
  it('truncates over-long story bodies to a stable cap with an ellipsis', () => {
    const big = 'x'.repeat(2000)
    const out = formatVault({
      ...EMPTY_VAULT,
      stories: [{ id: 's1', title: 'big', body: big }],
    })
    expect(out).toMatch(/big: x{600}…/)
    expect(out).not.toContain('x'.repeat(601))
  })

  it('drops stories that have no title and no body', () => {
    const out = formatVault({
      ...EMPTY_VAULT,
      stories: [
        { id: 's1', title: '', body: '' },
        { id: 's2', title: 'Real', body: 'content' },
      ],
    })
    expect(out).toContain('Real: content')
    expect(out.match(/\n- /g)?.length).toBe(1)
  })

  it('returns empty string when the vault is fully blank', () => {
    expect(formatVault(EMPTY_VAULT)).toBe('')
  })
})
