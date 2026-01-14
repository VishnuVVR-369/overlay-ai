/**
 * Settings Store - Persistent storage for user settings
 *
 * Uses electron-store for secure, persistent key-value storage
 */
import Store from 'electron-store';

// ============================================================================
// Settings Types
// ============================================================================

export interface ApiKeySettings {
  deepgramApiKey?: string;
  groqApiKey?: string;
}

export interface AppSettings extends ApiKeySettings {
  // Future settings can be added here
}

// ============================================================================
// Store Configuration
// ============================================================================

const store = new Store<AppSettings>({
  name: 'overlay-ai-settings',
  defaults: {
    deepgramApiKey: undefined,
    groqApiKey: undefined,
  },
  // Encrypt API keys for security
  encryptionKey: 'overlay-ai-encryption-key-v1',
});

// ============================================================================
// Settings API
// ============================================================================

/**
 * Get all settings
 */
export function getSettings(): AppSettings {
  return {
    deepgramApiKey: store.get('deepgramApiKey'),
    groqApiKey: store.get('groqApiKey'),
  };
}

/**
 * Save settings
 */
export function saveSettings(settings: Partial<AppSettings>): void {
  if (settings.deepgramApiKey !== undefined) {
    if (settings.deepgramApiKey === '') {
      store.delete('deepgramApiKey');
    } else {
      store.set('deepgramApiKey', settings.deepgramApiKey);
    }
  }
  if (settings.groqApiKey !== undefined) {
    if (settings.groqApiKey === '') {
      store.delete('groqApiKey');
    } else {
      store.set('groqApiKey', settings.groqApiKey);
    }
  }
}

/**
 * Get Deepgram API key from settings or environment
 * Settings take precedence over environment variables
 */
export function getDeepgramApiKeyFromSettings(): string | undefined {
  const settingsKey = store.get('deepgramApiKey');
  if (settingsKey && settingsKey.length > 0) {
    return settingsKey;
  }
  return process.env.DEEPGRAM_API_KEY;
}

/**
 * Get Groq API key from settings or environment
 * Settings take precedence over environment variables
 */
export function getGroqApiKeyFromSettings(): string | undefined {
  const settingsKey = store.get('groqApiKey');
  if (settingsKey && settingsKey.length > 0) {
    return settingsKey;
  }
  return process.env.GROQ_API_KEY;
}

/**
 * Check if Deepgram is configured (either via settings or environment)
 */
export function isDeepgramConfiguredFromSettings(): boolean {
  const key = getDeepgramApiKeyFromSettings();
  return !!key && key.length > 0;
}

/**
 * Check if Groq is configured (either via settings or environment)
 */
export function isGroqConfiguredFromSettings(): boolean {
  const key = getGroqApiKeyFromSettings();
  return !!key && key.length > 0;
}

/**
 * Clear all settings
 */
export function clearSettings(): void {
  store.clear();
}
