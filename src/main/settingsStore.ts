import Store from 'electron-store';

export interface ApiKeySettings {
  elevenLabsApiKey?: string;
  groqApiKey?: string;
}

export interface MinimizeModeSettings {
  isMinimized: boolean;
}

export interface AppSettings extends ApiKeySettings, MinimizeModeSettings {
  customSystemPrompt?: string;
}

const store = new Store<AppSettings>({
  name: 'overlay-ai-settings',
  defaults: {
    elevenLabsApiKey: undefined,
    groqApiKey: undefined,
    customSystemPrompt: undefined,
    isMinimized: false,
  },
  encryptionKey: 'overlay-ai-encryption-key-v1',
});

export function getSettings(): AppSettings {
  return {
    elevenLabsApiKey: store.get('elevenLabsApiKey'),
    groqApiKey: store.get('groqApiKey'),
    customSystemPrompt: store.get('customSystemPrompt'),
    isMinimized: store.get('isMinimized'),
  };
}

export function saveSettings(settings: Partial<AppSettings>): void {
  const settingKeys: (keyof Omit<AppSettings, 'isMinimized'>)[] = [
    'elevenLabsApiKey',
    'groqApiKey',
    'customSystemPrompt',
  ];

  for (const key of settingKeys) {
    if (settings[key] !== undefined) {
      if (settings[key] === '') {
        store.delete(key);
      } else {
        store.set(key, settings[key]!);
      }
    }
  }
}

export function getElevenLabsApiKeyFromSettings(): string | undefined {
  const settingsKey = store.get('elevenLabsApiKey');
  return settingsKey?.length ? settingsKey : process.env.ELEVENLABS_API_KEY;
}

export function getGroqApiKeyFromSettings(): string | undefined {
  const settingsKey = store.get('groqApiKey');
  return settingsKey?.length ? settingsKey : process.env.GROQ_API_KEY;
}

export function isElevenLabsConfiguredFromSettings(): boolean {
  const key = getElevenLabsApiKeyFromSettings();
  return !!key && key.length > 0;
}

export function isGroqConfiguredFromSettings(): boolean {
  const key = getGroqApiKeyFromSettings();
  return !!key && key.length > 0;
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
