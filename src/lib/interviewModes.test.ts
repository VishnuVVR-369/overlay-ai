import { describe, expect, it } from 'vitest';
import {
  DEFAULT_INTERVIEW_MODE,
  INTERVIEW_MODE_OPTIONS,
  getInterviewModeLabel,
  normalizeInterviewMode,
} from './interviewModes';

describe('interviewModes', () => {
  it('defaults invalid values to general', () => {
    expect(normalizeInterviewMode('not-a-real-mode')).toBe(
      DEFAULT_INTERVIEW_MODE
    );
    expect(normalizeInterviewMode(undefined)).toBe(DEFAULT_INTERVIEW_MODE);
  });

  it('keeps the supported mode order stable for the UI', () => {
    expect(INTERVIEW_MODE_OPTIONS.map((option) => option.id)).toEqual([
      'general',
      'dsa',
      'system-design',
      'behavioral',
      'frontend',
      'backend',
      'ml',
      'debugging',
    ]);
  });

  it('returns human-readable labels', () => {
    expect(getInterviewModeLabel('system-design')).toBe('System Design');
    expect(getInterviewModeLabel('ml')).toBe('ML');
  });
});
