import { describe, expect, it } from 'vitest';
import {
  SYSTEM_PROMPT,
  LEGACY_DEFAULT_SYSTEM_PROMPT,
  buildSystemPrompt,
  buildUserPrompt,
  getModeInstructions,
  normalizeCustomSystemPrompt,
} from './systemPrompt';

describe('systemPrompt interview modes', () => {
  it('exports a baseline system prompt for compatibility', () => {
    expect(SYSTEM_PROMPT).toContain('senior staff engineer');
    expect(SYSTEM_PROMPT).toContain('live interview');
    expect(SYSTEM_PROMPT).toContain('20 minutes');
  });

  it('includes mode-specific instructions for representative presets', () => {
    expect(getModeInstructions('dsa')).toContain('brute force');
    expect(getModeInstructions('system-design')).toContain('requirements');
    expect(getModeInstructions('behavioral')).toContain('STAR');
    expect(getModeInstructions('debugging')).toContain('reproduction');
  });

  it('appends custom prompt content after the mode instructions', () => {
    const customPrompt = 'Answer in exactly five bullets.';
    const prompt = buildSystemPrompt('dsa', customPrompt);

    expect(prompt).toContain('Active interview mode: DSA');
    expect(prompt).toContain(customPrompt);
    expect(prompt.indexOf(customPrompt)).toBeGreaterThan(
      prompt.indexOf(getModeInstructions('dsa'))
    );
  });

  it('builds a mode-aware user prompt', () => {
    const prompt = buildUserPrompt(
      'INTERVIEWER: Tell me about a tough project.\nME: ...',
      'behavioral'
    );

    expect(prompt).toContain('Interview mode: Behavioral');
    expect(prompt).toContain('STAR');
    expect(prompt).toContain('tough project');
  });

  it('ignores empty and legacy built-in custom prompts', () => {
    expect(normalizeCustomSystemPrompt('   ')).toBeUndefined();
    expect(normalizeCustomSystemPrompt(LEGACY_DEFAULT_SYSTEM_PROMPT)).toBe(
      undefined
    );
  });
});
