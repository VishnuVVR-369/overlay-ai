import { describe, expect, it } from 'vitest';
import {
  INITIAL_OVERLAY_STATE,
  applySettingsToOverlayState,
  applyStatusToOverlayState,
  getClearedOverlayState,
} from './overlayState';

describe('overlayState helpers', () => {
  it('initializes from app status including interview mode', () => {
    const nextState = applyStatusToOverlayState(INITIAL_OVERLAY_STATE, {
      liveMode: { state: 'connected', connectedAt: 123 },
      answer: { state: 'complete', text: 'Use a queue', modelId: 'test-model' },
      context: {
        segmentCount: 2,
        wordCount: 12,
        estimatedTokens: 16,
        durationMs: 5000,
      },
      isDeepgramConfigured: true,
      isGroqConfigured: true,
      interviewMode: 'backend',
    });

    expect(nextState.liveMode.state).toBe('connected');
    expect(nextState.answerText).toBe('Use a queue');
    expect(nextState.answerModelId).toBe('test-model');
    expect(nextState.interviewMode).toBe('backend');
  });

  it('updates mode without clearing transcript or answer state', () => {
    const previousState = {
      ...INITIAL_OVERLAY_STATE,
      interviewMode: 'general' as const,
      segments: [
        {
          timestamp: 1,
          speaker: 'interviewer' as const,
          text: 'Design a cache',
          wordCount: 4,
        },
      ],
      answerText: 'Start with requirements',
      answerState: 'complete' as const,
    };

    const nextState = applySettingsToOverlayState(previousState, {
      interviewMode: 'system-design',
    });

    expect(nextState.interviewMode).toBe('system-design');
    expect(nextState.segments).toEqual(previousState.segments);
    expect(nextState.answerText).toBe(previousState.answerText);
    expect(nextState.answerState).toBe('complete');
  });

  it('clears overlay content while preserving the selected mode', () => {
    const previousState = {
      ...INITIAL_OVERLAY_STATE,
      interviewMode: 'ml' as const,
      segments: [
        {
          timestamp: 1,
          speaker: 'interviewer' as const,
          text: 'How would you evaluate this model?',
          wordCount: 6,
        },
      ],
      interimText: 'Partial',
      answerState: 'complete' as const,
      answerText: 'Track offline and online metrics',
      lastError: 'temporary',
      sessionStats: {
        sessionStartedAt: 123,
        totalWordsTranscribed: 120,
        totalInputTokens: 50,
        totalOutputTokens: 75,
      },
    };

    const clearedState = getClearedOverlayState(previousState);

    expect(clearedState.interviewMode).toBe('ml');
    expect(clearedState.segments).toEqual([]);
    expect(clearedState.answerState).toBe('idle');
    expect(clearedState.answerText).toBe('');
    expect(clearedState.lastError).toBeNull();
    expect(clearedState.sessionStats.totalWordsTranscribed).toBe(0);
  });
});
