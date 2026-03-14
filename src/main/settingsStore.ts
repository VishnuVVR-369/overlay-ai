import Store from 'electron-store';
import {
  DEFAULT_INTERVIEW_MODE,
  normalizeInterviewMode,
  type InterviewMode,
} from '../lib/interviewModes';

export interface ApiKeySettings {
  deepgramApiKey?: string;
  groqApiKey?: string;
}

export interface MinimizeModeSettings {
  isMinimized: boolean;
}

export interface AppSettings extends ApiKeySettings, MinimizeModeSettings {
  customSystemPrompt?: string;
  interviewMode?: InterviewMode;
}

const store = new Store<AppSettings>({
  name: 'overlay-ai-settings',
  defaults: {
    deepgramApiKey: undefined,
    groqApiKey: undefined,
    customSystemPrompt: undefined,
    interviewMode: DEFAULT_INTERVIEW_MODE,
    isMinimized: false,
  },
  encryptionKey: 'overlay-ai-encryption-key-v1',
});

export function getSettings(): AppSettings {
  return {
    deepgramApiKey: store.get('deepgramApiKey'),
    groqApiKey: store.get('groqApiKey'),
    customSystemPrompt: store.get('customSystemPrompt'),
    interviewMode: normalizeInterviewMode(store.get('interviewMode')),
    isMinimized: store.get('isMinimized'),
  };
}

export function saveSettings(settings: Partial<AppSettings>): void {
  const settingKeys: (keyof Omit<AppSettings, 'isMinimized'>)[] = [
    'deepgramApiKey',
    'groqApiKey',
    'customSystemPrompt',
    'interviewMode',
  ];

  for (const key of settingKeys) {
    if (settings[key] !== undefined) {
      if (key === 'interviewMode') {
        store.set(key, normalizeInterviewMode(settings[key]));
      } else if (settings[key] === '') {
        store.delete(key);
      } else {
        store.set(key, settings[key]!);
      }
    }
  }
}

export function getDeepgramApiKeyFromSettings(): string | undefined {
  const settingsKey = store.get('deepgramApiKey');
  return settingsKey?.length ? settingsKey : process.env.DEEPGRAM_API_KEY;
}

export function getGroqApiKeyFromSettings(): string | undefined {
  const settingsKey = store.get('groqApiKey');
  return settingsKey?.length ? settingsKey : process.env.GROQ_API_KEY;
}

export function isDeepgramConfiguredFromSettings(): boolean {
  const key = getDeepgramApiKeyFromSettings();
  return !!key && key.length > 0;
}

export function isGroqConfiguredFromSettings(): boolean {
  const key = getGroqApiKeyFromSettings();
  return !!key && key.length > 0;
}

export function getInterviewModeFromSettings(): InterviewMode {
  return normalizeInterviewMode(store.get('interviewMode'));
}

export function clearSettings(): void {
  store.clear();
}

export function toggleMinimizeMode(): boolean {
  const current = store.get('isMinimized') || false;
  const newValue = !current;
  store.set('isMinimized', newValue);
  return newValue;
}

export function isMinimizedMode(): boolean {
  return store.get('isMinimized') || false;
}
