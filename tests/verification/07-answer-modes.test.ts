import { describe, expect, it } from 'vitest';
import {
  ANSWER_MODE_DEFINITIONS,
  ANSWER_FORMAT_MODES,
  DEFAULT_ANSWER_MODE,
} from '../../src/lib/answerModes';
import { buildUserPrompt } from '../../src/main/llm/systemPrompt';
import { isStaleAnswerRequest } from '../../src/renderer/hooks/answerStateUtils';

describe('Answer Modes - Verification', () => {
  it('should define the six answer modes in the expected order', () => {
    expect(ANSWER_FORMAT_MODES).toEqual([
      'full_answer',
      'short_hint',
      'clarifying_questions',
      'next_best_step',
      'follow_up_response',
      'star_version',
    ]);
    expect(DEFAULT_ANSWER_MODE).toBe('full_answer');
  });

  it('should expose mode labels and hotkeys for the compact UI', () => {
    expect(ANSWER_MODE_DEFINITIONS.map((mode) => mode.shortLabel)).toEqual([
      'Full',
      'Hint',
      'Clarify',
      'Next',
      'Follow-up',
      'STAR',
    ]);
    expect(ANSWER_MODE_DEFINITIONS.map((mode) => mode.hotkeyLetter)).toEqual([
      'X',
      'V',
      'C',
      'B',
      'N',
      'S',
    ]);
  });

  it('should build a different prompt for each mode', () => {
    const context = 'INTERVIEWER: Tell me about a tough project.\nME:';

    const promptAssertions: Record<(typeof ANSWER_FORMAT_MODES)[number], string> =
      {
        full_answer: 'Mode: Full Answer.',
        short_hint: 'Mode: Short Hint.',
        clarifying_questions: 'Mode: Clarifying Questions.',
        next_best_step: 'Mode: Next Best Step.',
        follow_up_response: 'Mode: Follow-up Response.',
        star_version: 'Mode: STAR Version.',
      };

    for (const mode of ANSWER_FORMAT_MODES) {
      const prompt = buildUserPrompt(context, mode);
      expect(prompt).toContain(promptAssertions[mode]);
      expect(prompt).toContain('Selected response format:');
    }
  });

  it('should include STAR fallback guidance for non-behavioral prompts', () => {
    const prompt = buildUserPrompt(
      'INTERVIEWER: Design a rate limiter for a distributed API.',
      'star_version'
    );

    expect(prompt).toContain('If the latest prompt is not clearly behavioral');
    expect(prompt).toContain('suggest Full Answer or Short Hint instead');
  });

  it('should treat older request ids as stale', () => {
    expect(isStaleAnswerRequest(2, 3)).toBe(true);
    expect(isStaleAnswerRequest(3, 3)).toBe(false);
    expect(isStaleAnswerRequest(4, 3)).toBe(false);
  });
});
