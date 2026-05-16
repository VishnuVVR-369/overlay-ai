import { describe, expect, it } from 'vitest'
import {
  ANSWER_STYLE_IDS,
  ANSWER_STYLES,
  DEFAULT_ANSWER_STYLE_ID,
  DEFAULT_PRESET_ID,
  PRESETS,
  PRESET_IDS,
  composePromptForAnswerStyle,
  getPresetDef,
  isAnswerStyleId,
  isPresetId,
} from '@shared/prompt'

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
