/**
 * Deepgram WebSocket Client - Real-time speech-to-text streaming
 *
 * Per PLAN.md:
 * - Connect to Deepgram WebSocket API
 * - Stream raw PCM audio for transcription
 * - Use multichannel mode for speaker diarization
 */
import { config } from 'dotenv';
config();

import { EventEmitter } from 'events';
import WebSocket from 'ws';

// ============================================================================
// Deepgram Configuration (per PLAN.md)
// ============================================================================

/**
 * Deepgram streaming configuration
 * Per PLAN.md Section 3.2:
 * - model: 'nova-2-general'
 * - multichannel: true (Channel 0 is interviewer, Channel 1 is you)
 * - smart_format: true
 * - encoding: 'linear16'
 * - sample_rate: 16000
 */
export interface DeepgramConfig {
  model: string;
  multichannel: boolean;
  smart_format: boolean;
  encoding: string;
  sample_rate: number;
  channels: number;
}

export const DEFAULT_DEEPGRAM_CONFIG: DeepgramConfig = {
  model: 'nova-2-general',
  multichannel: true,
  smart_format: true,
  encoding: 'linear16',
  sample_rate: 16000,
  channels: 2, // Stereo: Channel 0 = System/Interviewer, Channel 1 = Mic/You
};

// ============================================================================
// API Key Handling (from settings or environment)
// ============================================================================

import {
  getDeepgramApiKeyFromSettings,
  isDeepgramConfiguredFromSettings,
} from './settingsStore';

/**
 * Get Deepgram API key from settings or environment variable
 *
 * Per PLAN.md: Add DEEPGRAM_API_KEY as a required environment variable
 * Extended: Settings take precedence over environment variables
 *
 * @throws Error if DEEPGRAM_API_KEY is not set
 */
export function getDeepgramApiKey(): string {
  const apiKey = getDeepgramApiKeyFromSettings();

  if (!apiKey) {
    throw new Error(
      'DEEPGRAM_API_KEY is not configured. ' +
        'Please set it in Settings or as an environment variable. ' +
        'Get one at https://console.deepgram.com/'
    );
  }

  return apiKey;
}

/**
 * Check if Deepgram API key is configured (without throwing)
 */
export function isDeepgramConfigured(): boolean {
  return isDeepgramConfiguredFromSettings();
}

// ============================================================================
// Deepgram Transcript Types
// ============================================================================

/**
 * Word-level timing information from Deepgram
 */
export interface DeepgramWord {
  word: string;
  start: number;
  end: number;
  confidence: number;
  punctuated_word?: string;
}

/**
 * Channel-specific transcript from Deepgram
 */
export interface DeepgramChannel {
  alternatives: Array<{
    transcript: string;
    confidence: number;
    words: DeepgramWord[];
  }>;
}

/**
 * Deepgram transcript message
 */
export interface DeepgramTranscript {
  type: 'Results';
  channel_index: number[];
  duration: number;
  start: number;
  is_final: boolean;
  speech_final: boolean;
  channel: DeepgramChannel;
}

/**
 * Deepgram metadata message
 */
export interface DeepgramMetadata {
  type: 'Metadata';
  transaction_key: string;
  request_id: string;
  sha256: string;
  created: string;
  duration: number;
  channels: number;
}

/**
 * Union type for all Deepgram messages
 */
export type DeepgramMessage =
  | DeepgramTranscript
  | DeepgramMetadata
  | { type: string };

// ============================================================================
// Deepgram Events
// ============================================================================

export interface DeepgramClientEvents {
  /** Connection opened */
  open: () => void;
  /** Connection closed */
  close: (code: number, reason: string) => void;
  /** Connection error */
  error: (error: Error) => void;
  /** Transcript received */
  transcript: (transcript: DeepgramTranscript) => void;
  /** Metadata received */
  metadata: (metadata: DeepgramMetadata) => void;
}

// ============================================================================
// Connection State
// ============================================================================

export enum DeepgramConnectionState {
  DISCONNECTED = 'disconnected',
  CONNECTING = 'connecting',
  CONNECTED = 'connected',
  ERROR = 'error',
}

// ============================================================================
// Deepgram Client
// ============================================================================

/**
 * Deepgram WebSocket client for real-time transcription
 *
 * Usage per PLAN.md:
 * ```typescript
 * const deepgram = new DeepgramClient();
 * await deepgram.connect();
 *
 * audioProcess.stdout.on('data', (chunk) => {
 *     if (deepgram.isOpen()) {
 *         deepgram.send(chunk);
 *     }
 * });
 *
 * deepgram.on('transcript', (transcript) => {
 *     // Handle transcript
 * });
 * ```
 */
export class DeepgramClient extends EventEmitter {
  private ws: WebSocket | null = null;
  private config: DeepgramConfig;
  private _state: DeepgramConnectionState =
    DeepgramConnectionState.DISCONNECTED;

  constructor(config: Partial<DeepgramConfig> = {}) {
    super();
    this.config = { ...DEFAULT_DEEPGRAM_CONFIG, ...config };
  }

  /**
   * Get current connection state
   */
  get state(): DeepgramConnectionState {
    return this._state;
  }

  /**
   * Check if WebSocket is open and ready to receive audio
   */
  isOpen(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  /**
   * Build the Deepgram WebSocket URL with query parameters
   */
  private buildUrl(): string {
    const params = new URLSearchParams({
      model: this.config.model,
      multichannel: this.config.multichannel.toString(),
      smart_format: this.config.smart_format.toString(),
      encoding: this.config.encoding,
      sample_rate: this.config.sample_rate.toString(),
      channels: this.config.channels.toString(),
    });

    return `wss://api.deepgram.com/v1/listen?${params.toString()}`;
  }

  /**
   * Connect to Deepgram WebSocket API
   */
  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.ws) {
        console.warn('[Deepgram] Already connected or connecting');
        resolve();
        return;
      }

      const apiKey = getDeepgramApiKey();
      const url = this.buildUrl();

      console.log('[Deepgram] Connecting to:', url);
      this._state = DeepgramConnectionState.CONNECTING;

      this.ws = new WebSocket(url, {
        headers: {
          Authorization: `Token ${apiKey}`,
        },
      });

      this.ws.on('open', () => {
        console.log('[Deepgram] Connected');
        this._state = DeepgramConnectionState.CONNECTED;
        this.emit('open');
        resolve();
      });

      this.ws.on('message', (data: WebSocket.Data) => {
        this.handleMessage(data);
      });

      this.ws.on('close', (code: number, reason: Buffer) => {
        const reasonStr = reason.toString();
        console.log(`[Deepgram] Disconnected: ${code} - ${reasonStr}`);
        this._state = DeepgramConnectionState.DISCONNECTED;
        this.emit('close', code, reasonStr);
        this.ws = null;
      });

      this.ws.on('error', (error: Error) => {
        console.error('[Deepgram] WebSocket error:', error.message);
        this._state = DeepgramConnectionState.ERROR;
        this.emit('error', error);
        reject(error);
      });
    });
  }

  /**
   * Send audio data to Deepgram
   *
   * Per PLAN.md: Only send when readyState === WebSocket.OPEN
   */
  send(audioData: Buffer): boolean {
    if (!this.isOpen()) {
      return false;
    }

    try {
      this.ws!.send(audioData);
      return true;
    } catch (error) {
      console.error('[Deepgram] Failed to send audio:', error);
      return false;
    }
  }

  /**
   * Close the Deepgram connection
   */
  disconnect(): void {
    if (!this.ws) {
      return;
    }

    console.log('[Deepgram] Disconnecting...');

    // Send close message to signal end of audio
    try {
      this.ws.send(JSON.stringify({ type: 'CloseStream' }));
    } catch {
      // Ignore errors when sending close message
    }

    this.ws.close();
    this.ws = null;
    this._state = DeepgramConnectionState.DISCONNECTED;
  }

  /**
   * Handle incoming WebSocket messages
   */
  private handleMessage(data: WebSocket.Data): void {
    try {
      const message: DeepgramMessage = JSON.parse(data.toString());

      switch (message.type) {
        case 'Results':
          this.emit('transcript', message as DeepgramTranscript);
          break;
        case 'Metadata':
          this.emit('metadata', message as DeepgramMetadata);
          break;
        default:
          // Unknown message type - log for debugging
          console.log('[Deepgram] Unknown message type:', message.type);
      }
    } catch (error) {
      console.error('[Deepgram] Failed to parse message:', error);
    }
  }
}

/**
 * Create and connect a Deepgram client
 *
 * Convenience function per PLAN.md:
 * "Create `src/main/deepgram.ts` exposing `connectDeepgram()` returning
 * a WebSocket instance and connection state callbacks"
 */
export async function connectDeepgram(
  config: Partial<DeepgramConfig> = {}
): Promise<DeepgramClient> {
  const client = new DeepgramClient(config);
  await client.connect();
  return client;
}
