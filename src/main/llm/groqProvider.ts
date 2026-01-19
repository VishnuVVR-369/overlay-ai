import { config } from 'dotenv';
config();

import Groq from 'groq-sdk';
import { LLMProvider, LLMError, LLM_ERROR_CODES } from './provider';
import { getSystemPrompt, buildUserPrompt } from './systemPrompt';
import {
  getGroqApiKeyFromSettings,
  isGroqConfiguredFromSettings,
} from '../settingsStore';

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
    const client = this.getClient();

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
