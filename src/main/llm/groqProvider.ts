import { config } from 'dotenv';
config();

import Groq from 'groq-sdk';
import { LLMProvider, LLMError, LLM_ERROR_CODES } from './provider';
import { getSystemPrompt, buildUserPrompt } from './systemPrompt';
import {
  getGroqApiKeyFromSettings,
  isGroqConfiguredFromSettings,
} from '../settingsStore';

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
}

export interface StreamResponseResult {
  chunks: AsyncGenerator<string, void, unknown>;
  tokenUsage: Promise<TokenUsage>;
}

export const GROQ_MODELS = {
  LLAMA_3_3_70B: 'llama-3.3-70b-versatile',
  OPENAI_GPT_OSS_120B: 'openai/gpt-oss-120b',
} as const;

export type GroqModelId = (typeof GROQ_MODELS)[keyof typeof GROQ_MODELS];

const DEFAULT_MODEL_ID: GroqModelId = GROQ_MODELS.OPENAI_GPT_OSS_120B;

export function getGroqApiKey(): string | undefined {
  return getGroqApiKeyFromSettings();
}

export function isGroqConfigured(): boolean {
  return isGroqConfiguredFromSettings();
}

export class GroqProvider implements LLMProvider {
  readonly name = 'groq';
  private client: Groq | null = null;

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

  isConfigured(): boolean {
    return isGroqConfigured();
  }

  getDefaultModelId(): string {
    return DEFAULT_MODEL_ID;
  }

  getAvailableModels(): string[] {
    return Object.values(GROQ_MODELS);
  }

  async *streamResponse(
    context: string,
    modelId: string = DEFAULT_MODEL_ID
  ): AsyncGenerator<string, void, unknown> {
    const result = this.streamResponseWithUsage(context, modelId);
    yield* result.chunks;
  }

  streamResponseWithUsage(
    context: string,
    modelId: string = DEFAULT_MODEL_ID
  ): StreamResponseResult {
    const client = this.getClient();
    let resolveTokenUsage: (usage: TokenUsage) => void;
    let rejectTokenUsage: (error: Error) => void;

    const tokenUsagePromise = new Promise<TokenUsage>((resolve, reject) => {
      resolveTokenUsage = resolve;
      rejectTokenUsage = reject;
    });

    const providerName = this.name;

    async function* generateChunks(): AsyncGenerator<string, void, unknown> {
      try {
        const stream = await client.chat.completions.create({
          model: modelId,
          messages: [
            { role: 'system', content: getSystemPrompt() },
            { role: 'user', content: buildUserPrompt(context) },
          ],
          stream: true,
          temperature: 0.7,
          max_tokens: 2048,
        });

        let tokenUsage: TokenUsage = { inputTokens: 0, outputTokens: 0 };

        for await (const chunk of stream) {
          const content = chunk.choices[0]?.delta?.content;
          if (content) {
            yield content;
          }

          // Usage info may be available in the final chunk (type assertion needed)
          const chunkWithUsage = chunk as typeof chunk & {
            usage?: { prompt_tokens?: number; completion_tokens?: number };
          };
          if (chunkWithUsage.usage) {
            tokenUsage = {
              inputTokens: chunkWithUsage.usage.prompt_tokens || 0,
              outputTokens: chunkWithUsage.usage.completion_tokens || 0,
            };
          }
        }

        resolveTokenUsage(tokenUsage);
      } catch (error) {
        if (error instanceof Error) {
          rejectTokenUsage(error);
          if (error.message.includes('rate limit')) {
            throw new LLMError(
              'Rate limit exceeded',
              LLM_ERROR_CODES.RATE_LIMITED,
              providerName,
              error
            );
          }
          if (error.message.includes('context length')) {
            throw new LLMError(
              'Context too long for model',
              LLM_ERROR_CODES.CONTEXT_TOO_LONG,
              providerName,
              error
            );
          }
          throw new LLMError(
            error.message,
            LLM_ERROR_CODES.API_ERROR,
            providerName,
            error
          );
        }
        rejectTokenUsage(new Error('Unknown error'));
        throw new LLMError(
          'Unknown error',
          LLM_ERROR_CODES.API_ERROR,
          providerName
        );
      }
    }

    return {
      chunks: generateChunks(),
      tokenUsage: tokenUsagePromise,
    };
  }

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

  /**
   * Stream a chat response with custom messages
   *
   * This method allows sending custom message arrays for chat interactions,
   * which is useful for maintaining conversation history.
   *
   * @param messages - Array of message objects with role and content
   * @param systemPrompt - Optional system prompt (overrides default)
   * @param modelId - The model to use
   * @yields Token chunks as they are generated
   */
  async *streamChatResponse(
    messages: Array<{ role: string; content: string }>,
    systemPrompt: string | undefined = undefined,
    modelId: string = DEFAULT_MODEL_ID
  ): AsyncGenerator<string, void, unknown> {
    const client = this.getClient();

    const effectiveSystemPrompt = systemPrompt ?? getSystemPrompt();

    const fullMessages = [
      { role: 'system', content: effectiveSystemPrompt },
      ...messages,
    ];

    try {
      const stream = await client.chat.completions.create({
        model: modelId,
        messages: fullMessages as Array<{
          role: 'system' | 'user' | 'assistant';
          content: string;
        }>,
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
      throw new LLMError('Unknown error', LLM_ERROR_CODES.API_ERROR, this.name);
    }
  }
}

let defaultProvider: GroqProvider | null = null;

export function getDefaultGroqProvider(): GroqProvider {
  if (!defaultProvider) {
    defaultProvider = new GroqProvider();
  }
  return defaultProvider;
}

export function resetGroqProvider(): void {
  defaultProvider = null;
}
