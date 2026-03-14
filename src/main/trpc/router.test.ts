import { describe, expect, it, vi } from 'vitest';

vi.mock('../contextBuffer', () => {
  return {
    getDefaultContextBuffer: () => ({
      getStats: () => ({
        segmentCount: 3,
        wordCount: 42,
        estimatedTokens: 56,
        durationMs: 90000,
      }),
      getRecentSegments: () => [],
      getFullContext: () => 'INTERVIEWER: Hello',
      clear: () => undefined,
    }),
  };
});

vi.mock('../deepgram', () => {
  return {
    isDeepgramConfigured: () => true,
  };
});

vi.mock('../settingsStore', () => {
  return {
    isGroqConfiguredFromSettings: () => true,
    getInterviewModeFromSettings: () => 'frontend',
  };
});

import { appRouter, setAnswerData, setLiveModeStatus } from './router';

describe('appRouter status', () => {
  it('exposes the active interview mode in app status', async () => {
    setLiveModeStatus({ state: 'connected', connectedAt: 123 });
    setAnswerData({ state: 'complete', text: 'Sample answer' });

    const caller = appRouter.createCaller({});
    const status = await caller.getStatus();

    expect(status.interviewMode).toBe('frontend');
    expect(status.liveMode.state).toBe('connected');
    expect(status.answer.text).toBe('Sample answer');
    expect(status.context.segmentCount).toBe(3);
  });
});
