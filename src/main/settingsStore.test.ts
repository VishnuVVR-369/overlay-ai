import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockStore = vi.hoisted(() => ({
  state: new Map<string, unknown>(),
  defaults: {} as Record<string, unknown>,
}));

vi.mock('electron-store', () => {
  return {
    default: class MockStore<T extends Record<string, unknown>> {
      constructor(options?: { defaults?: Record<string, unknown> }) {
        mockStore.defaults = options?.defaults ?? {};
      }

      get(key: keyof T): T[keyof T] | undefined {
        if (mockStore.state.has(String(key))) {
          return mockStore.state.get(String(key)) as T[keyof T];
        }
        return mockStore.defaults[String(key)] as T[keyof T] | undefined;
      }

      set(key: keyof T, value: T[keyof T]): void {
        mockStore.state.set(String(key), value);
      }

      delete(key: keyof T): void {
        mockStore.state.delete(String(key));
      }

      clear(): void {
        mockStore.state.clear();
      }
    },
  };
});

import {
  clearSettings,
  getInterviewModeFromSettings,
  getSettings,
  saveSettings,
} from './settingsStore';

describe('settingsStore interview mode persistence', () => {
  beforeEach(() => {
    clearSettings();
  });

  it('defaults interview mode to general', () => {
    expect(getSettings().interviewMode).toBe('general');
    expect(getInterviewModeFromSettings()).toBe('general');
  });

  it('persists valid interview modes', () => {
    saveSettings({ interviewMode: 'ml' });

    expect(getSettings().interviewMode).toBe('ml');
    expect(getInterviewModeFromSettings()).toBe('ml');
  });

  it('normalizes invalid stored values to general', () => {
    mockStore.state.set('interviewMode', 'totally-invalid');

    expect(getSettings().interviewMode).toBe('general');
    expect(getInterviewModeFromSettings()).toBe('general');
  });
});
