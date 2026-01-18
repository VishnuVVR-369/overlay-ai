/**
 * Groq Provider - Implementation of LLMProvider using Groq SDK
 *
 * Per PLAN.md Phase 5.2:
 * - Client: `groq-sdk`
 * - Streaming response support
 * - Model selection via modelId parameter
 */
import { config } from 'dotenv';
config();

import Groq from 'groq-sdk';
import {
  LLMProvider,
  LLMError,
  LLM_ERROR_CODES,
} from './provider';
import { getSystemPrompt, buildUserPrompt } from './systemPrompt';

// ============================================================================
// Configuration
// ============================================================================

/**
 * Available Groq models
 */
export const GROQ_MODELS = {
  LLAMA_3_3_70B: 'llama-3.3-70b-versatile',
  OPENAI_GPT_OSS_120B: 'openai/gpt-oss-120b',
} as const;

export type GroqModelId = (typeof GROQ_MODELS)[keyof typeof GROQ_MODELS];

/**
 * Default model to use
 */
const DEFAULT_MODEL_ID: GroqModelId = GROQ_MODELS.OPENAI_GPT_OSS_120B;

// ============================================================================
// API Key Handling (from settings or environment)
// ============================================================================

// Import settings store for API key retrieval
import {
  getGroqApiKeyFromSettings,
  isGroqConfiguredFromSettings,
} from '../settingsStore';

/**
 * Get the Groq API key from settings or environment
 */
export function getGroqApiKey(): string | undefined {
  return getGroqApiKeyFromSettings();
}

/**
 * Check if Groq is configured with an API key
 */
export function isGroqConfigured(): boolean {
  return isGroqConfiguredFromSettings();
}

// ============================================================================
// Groq Provider Implementation
// ============================================================================

/**
 * Groq LLM Provider
 *
 * Implements the LLMProvider interface using the Groq SDK
 * for fast inference with Llama and other models.
 */
export class GroqProvider implements LLMProvider {
  readonly name = 'groq';
  private client: Groq | null = null;

  /**
   * Get or create the Groq client
   */
  private getClient(): Groq {
    if (!this.client) {
      const apiKey = getGroqApiKey();
      if (!apiKey) {
        throw new LLMError(
          'GROQ_API_KEY not configured',
          LLM_ERROR_CODES.NOT_CONFIGURED,
          this.name
        );
      }
      this.client = new Groq({ apiKey });
    }
    return this.client;
  }

  /**
   * Check if the provider is configured
   */
  isConfigured(): boolean {
    return isGroqConfigured();
  }

  /**
   * Get the default model ID
   */
  getDefaultModelId(): string {
    return DEFAULT_MODEL_ID;
  }

  /**
   * Get available model IDs
   */
  getAvailableModels(): string[] {
    return Object.values(GROQ_MODELS);
  }

  /**
   * Stream a response from Groq
   *
   * @param context - The conversation transcript context
   * @param modelId - The model to use (defaults to openai/gpt-oss-120b)
   * @yields Token chunks as they are generated
   */
  async *streamResponse(
    context: string,
    modelId: string = DEFAULT_MODEL_ID
  ): AsyncGenerator<string, void, unknown> {
    const client = this.getClient();

    // Validate model ID
    const availableModels = this.getAvailableModels();
    if (!availableModels.includes(modelId)) {
      console.warn(
        `[GroqProvider] Model "${modelId}" not in known models, using anyway`
      );
    }

    try {
      const stream = await client.chat.completions.create({
        model: modelId,
        messages: [
          {
            role: 'system',
            content: getSystemPrompt(),
          },
          {
            role: 'user',
            content: buildUserPrompt(context),
          },
        ],
        stream: true,
        temperature: 0.7,
        max_tokens: 2048,
      });

      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content;
        if (content) {
          yield content;
        }
      }
    } catch (error) {
      // Handle specific Groq errors
      if (error instanceof Error) {
        if (error.message.includes('rate limit')) {
          throw new LLMError(
            'Rate limit exceeded',
            LLM_ERROR_CODES.RATE_LIMITED,
            this.name,
            error
          );
        }
        if (error.message.includes('context length')) {
          throw new LLMError(
            'Context too long for model',
            LLM_ERROR_CODES.CONTEXT_TOO_LONG,
            this.name,
            error
          );
        }
        throw new LLMError(
          error.message,
          LLM_ERROR_CODES.API_ERROR,
          this.name,
          error
        );
      }
      throw new LLMError(
        'Unknown error',
        LLM_ERROR_CODES.API_ERROR,
        this.name
      );
    }
  }

  /**
   * Generate a complete (non-streaming) response
   *
   * Utility method that collects all streamed tokens into a single string.
   *
   * @param context - The conversation transcript context
   * @param modelId - The model to use
   * @returns The complete response text
   */
  async generateResponse(
    context: string,
    modelId: string = DEFAULT_MODEL_ID
  ): Promise<string> {
    const chunks: string[] = [];
    for await (const chunk of this.streamResponse(context, modelId)) {
      chunks.push(chunk);
    }
    return chunks.join('');
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let defaultProvider: GroqProvider | null = null;

/**
 * Get the default Groq provider instance
 */
export function getDefaultGroqProvider(): GroqProvider {
  if (!defaultProvider) {
    defaultProvider = new GroqProvider();
  }
  return defaultProvider;
}

/**
 * Reset the Groq provider instance
 * Call this when API key changes to pick up new credentials
 */
export function resetGroqProvider(): void {
  defaultProvider = null;
}
