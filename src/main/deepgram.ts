import { config } from 'dotenv';
config();

import { EventEmitter } from 'events';
import WebSocket from 'ws';
import {
  getDeepgramApiKeyFromSettings,
  isDeepgramConfiguredFromSettings,
} from './settingsStore';

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
  channels: 2,
};

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

export function isDeepgramConfigured(): boolean {
  return isDeepgramConfiguredFromSettings();
}

export interface DeepgramWord {
  word: string;
  start: number;
  end: number;
  confidence: number;
  punctuated_word?: string;
}

export interface DeepgramChannel {
  alternatives: Array<{
    transcript: string;
    confidence: number;
    words: DeepgramWord[];
  }>;
}

export interface DeepgramTranscript {
  type: 'Results';
  channel_index: number[];
  duration: number;
  start: number;
  is_final: boolean;
  speech_final: boolean;
  channel: DeepgramChannel;
}

export interface DeepgramMetadata {
  type: 'Metadata';
  transaction_key: string;
  request_id: string;
  sha256: string;
  created: string;
  duration: number;
  channels: number;
}

export type DeepgramMessage =
  | DeepgramTranscript
  | DeepgramMetadata
  | { type: string };

export interface DeepgramClientEvents {
  open: () => void;
  close: (code: number, reason: string) => void;
  error: (error: Error) => void;
  transcript: (transcript: DeepgramTranscript) => void;
  metadata: (metadata: DeepgramMetadata) => void;
}

export enum DeepgramConnectionState {
  DISCONNECTED = 'disconnected',
  CONNECTING = 'connecting',
  CONNECTED = 'connected',
  ERROR = 'error',
}

export class DeepgramClient extends EventEmitter {
  private ws: WebSocket | null = null;
  private config: DeepgramConfig;
  private _state: DeepgramConnectionState =
    DeepgramConnectionState.DISCONNECTED;

  constructor(config: Partial<DeepgramConfig> = {}) {
    super();
    this.config = { ...DEFAULT_DEEPGRAM_CONFIG, ...config };
  }

  get state(): DeepgramConnectionState {
    return this._state;
  }

  isOpen(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

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

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.ws) {
        resolve();
        return;
      }

      const apiKey = getDeepgramApiKey();
      const url = this.buildUrl();

      this._state = DeepgramConnectionState.CONNECTING;
      this.ws = new WebSocket(url, {
        headers: { Authorization: `Token ${apiKey}` },
      });

      this.ws.on('open', () => {
        this._state = DeepgramConnectionState.CONNECTED;
        this.emit('open');
        resolve();
      });

      this.ws.on('message', (data: WebSocket.Data) => {
        this.handleMessage(data);
      });

      this.ws.on('close', (code: number, reason: Buffer) => {
        this._state = DeepgramConnectionState.DISCONNECTED;
        this.emit('close', code, reason.toString());
        this.ws = null;
      });

      this.ws.on('error', (error: Error) => {
        this._state = DeepgramConnectionState.ERROR;
        this.emit('error', error);
        reject(error);
      });
    });
  }

  send(audioData: Buffer): boolean {
    if (!this.isOpen()) return false;

    try {
      this.ws!.send(audioData);
      return true;
    } catch (error) {
      console.error('[Deepgram] Failed to send audio:', error);
      return false;
    }
  }

  disconnect(): void {
    if (!this.ws) return;

    try {
      this.ws.send(JSON.stringify({ type: 'CloseStream' }));
    } catch {
      // Ignore errors when sending close message
    }

    this.ws.close();
    this.ws = null;
    this._state = DeepgramConnectionState.DISCONNECTED;
  }

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
      }
    } catch (error) {
      console.error('[Deepgram] Failed to parse message:', error);
    }
  }
}

export async function connectDeepgram(
  config: Partial<DeepgramConfig> = {}
): Promise<DeepgramClient> {
  const client = new DeepgramClient(config);
  await client.connect();
  return client;
}
