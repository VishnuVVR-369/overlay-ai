/**
 * LLM Module - Export all LLM-related functionality
 */

// Provider interface and types
export {
  type LLMProvider,
  type LLMResponse,
  type LLMResponseMetadata,
  LLMError,
  LLM_ERROR_CODES,
  type LLMErrorCode,
} from './provider';

// System prompt
export {
  BASE_SYSTEM_PROMPT,
  SYSTEM_PROMPT,
  DEFAULT_SYSTEM_PROMPT,
  LEGACY_DEFAULT_SYSTEM_PROMPT,
  buildSystemPrompt,
  getModeInstructions,
  getSystemPrompt,
  buildUserPrompt,
  normalizeCustomSystemPrompt,
} from './systemPrompt';

// Groq provider
export {
  GroqProvider,
  getDefaultGroqProvider,
  resetGroqProvider,
  isGroqConfigured,
  getGroqApiKey,
  GROQ_MODELS,
  type GroqModelId,
  type TokenUsage,
  type StreamResponseResult,
} from './groqProvider';
