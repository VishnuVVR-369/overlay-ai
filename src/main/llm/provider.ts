export interface LLMProvider {
  readonly name: string;
  streamResponse(
    context: string,
    modelId: string
  ): AsyncGenerator<string, void, unknown>;
  isConfigured(): boolean;
  getDefaultModelId(): string;
  getAvailableModels(): string[];
}

export interface LLMResponseMetadata {
  modelId: string;
  provider: string;
  inputTokens?: number;
  outputTokens?: number;
  durationMs?: number;
}

export interface LLMResponse {
  text: string;
  metadata: LLMResponseMetadata;
}

export class LLMError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly provider: string,
    public readonly cause?: Error
  ) {
    super(message);
    this.name = 'LLMError';
  }
}

export const LLM_ERROR_CODES = {
  NOT_CONFIGURED: 'NOT_CONFIGURED',
  RATE_LIMITED: 'RATE_LIMITED',
  INVALID_MODEL: 'INVALID_MODEL',
  CONTEXT_TOO_LONG: 'CONTEXT_TOO_LONG',
  API_ERROR: 'API_ERROR',
  NETWORK_ERROR: 'NETWORK_ERROR',
  STREAM_ERROR: 'STREAM_ERROR',
} as const;

export type LLMErrorCode =
  (typeof LLM_ERROR_CODES)[keyof typeof LLM_ERROR_CODES];
