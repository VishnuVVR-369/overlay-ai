import { config } from 'dotenv';
config();

import { EventEmitter } from 'events';
import WebSocket from 'ws';
import type { Speaker } from '../lib/transcript';
import {
  getElevenLabsApiKeyFromSettings,
  isElevenLabsConfiguredFromSettings,
} from './settingsStore';

export interface ElevenLabsConfig {
  modelId: string;
  sampleRate: number;
  includeTimestamps: boolean;
  silenceThreshold: number;
  dominanceThreshold: number;
  silenceCommitMs: number;
}

export const DEFAULT_ELEVENLABS_CONFIG: ElevenLabsConfig = {
  modelId: 'scribe_v2_realtime',
  sampleRate: 16000,
  includeTimestamps: true,
  silenceThreshold: 320,
  dominanceThreshold: 1.15,
  silenceCommitMs: 900,
};

export function getElevenLabsApiKey(): string {
  const apiKey = getElevenLabsApiKeyFromSettings();
  if (!apiKey) {
    throw new Error(
      'ELEVENLABS_API_KEY is not configured. ' +
        'Please set it in Settings or as an environment variable. ' +
        'Get one at https://elevenlabs.io/app/settings/api-keys'
    );
  }
  return apiKey;
}

export function isElevenLabsConfigured(): boolean {
  return isElevenLabsConfiguredFromSettings();
}

export interface ElevenLabsWord {
  text: string;
  start: number;
  end: number;
  type: 'word' | 'spacing' | 'audio_event';
  speaker_id?: string;
}

interface ElevenLabsBaseMessage {
  message_type: string;
}

export interface ElevenLabsSessionStarted extends ElevenLabsBaseMessage {
  message_type: 'session_started';
  session_id?: string;
}

export interface ElevenLabsPartialTranscript extends ElevenLabsBaseMessage {
  message_type: 'partial_transcript';
  text: string;
  language_code?: string;
}

export interface ElevenLabsCommittedTranscript extends ElevenLabsBaseMessage {
  message_type: 'committed_transcript' | 'committed_transcript_with_timestamps';
  text: string;
  language_code?: string;
  words?: ElevenLabsWord[];
}

export interface ElevenLabsInputError extends ElevenLabsBaseMessage {
  message_type: 'input_error';
  reason?: string;
  detail?: string;
}

export type ElevenLabsMessage =
  | ElevenLabsSessionStarted
  | ElevenLabsPartialTranscript
  | ElevenLabsCommittedTranscript
  | ElevenLabsInputError
  | ElevenLabsBaseMessage;

export interface ElevenLabsTranscriptEvent {
  text: string;
  speaker: Speaker;
  words?: ElevenLabsWord[];
  languageCode?: string;
}

export interface ElevenLabsClientEvents {
  open: () => void;
  close: (code: number, reason: string) => void;
  error: (error: Error) => void;
  sessionStarted: (session: ElevenLabsSessionStarted) => void;
  partialTranscript: (transcript: ElevenLabsTranscriptEvent) => void;
  committedTranscript: (transcript: ElevenLabsTranscriptEvent) => void;
}

export enum ElevenLabsConnectionState {
  DISCONNECTED = 'disconnected',
  CONNECTING = 'connecting',
  CONNECTED = 'connected',
  ERROR = 'error',
}

interface AudioChunkAnalysis {
  mono: Buffer;
  dominantSpeaker: Speaker | null;
}

function clampToInt16(value: number): number {
  if (value > 32767) return 32767;
  if (value < -32768) return -32768;
  return value;
}

function analyzeStereoChunk(
  chunk: Buffer,
  silenceThreshold: number,
  dominanceThreshold: number,
  fallbackSpeaker: Speaker
): AudioChunkAnalysis {
  if (chunk.length < 4) {
    return {
      mono: Buffer.alloc(0),
      dominantSpeaker: null,
    };
  }

  const frameCount = Math.floor(chunk.length / 4);
  const mono = Buffer.allocUnsafe(frameCount * 2);
  let leftSumSquares = 0;
  let rightSumSquares = 0;

  for (let frameIndex = 0; frameIndex < frameCount; frameIndex += 1) {
    const sourceOffset = frameIndex * 4;
    const left = chunk.readInt16LE(sourceOffset);
    const right = chunk.readInt16LE(sourceOffset + 2);
    const averaged = clampToInt16(Math.round((left + right) / 2));

    mono.writeInt16LE(averaged, frameIndex * 2);
    leftSumSquares += left * left;
    rightSumSquares += right * right;
  }

  const leftRms = Math.sqrt(leftSumSquares / frameCount);
  const rightRms = Math.sqrt(rightSumSquares / frameCount);
  const loudestChannel = Math.max(leftRms, rightRms);

  if (loudestChannel < silenceThreshold) {
    return { mono, dominantSpeaker: null };
  }

  if (leftRms >= rightRms * dominanceThreshold) {
    return { mono, dominantSpeaker: 'interviewer' };
  }

  if (rightRms >= leftRms * dominanceThreshold) {
    return { mono, dominantSpeaker: 'me' };
  }

  return { mono, dominantSpeaker: fallbackSpeaker };
}

class SpeakerTracker {
  private currentSpeaker: Speaker = 'interviewer';
  private counts: Record<Speaker, number> = {
    interviewer: 0,
    me: 0,
  };
  private pendingSpeech = false;

  observeChunk(
    chunk: Buffer,
    silenceThreshold: number,
    dominanceThreshold: number
  ): AudioChunkAnalysis {
    const analysis = analyzeStereoChunk(
      chunk,
      silenceThreshold,
      dominanceThreshold,
      this.currentSpeaker
    );

    if (analysis.dominantSpeaker) {
      this.currentSpeaker = analysis.dominantSpeaker;
      this.counts[analysis.dominantSpeaker] += 1;
      this.pendingSpeech = true;
    }

    return analysis;
  }

  getCurrentSpeaker(): Speaker {
    return this.currentSpeaker;
  }

  hasPendingSpeech(): boolean {
    return this.pendingSpeech;
  }

  finalizeSegment(): Speaker {
    const speaker =
      this.counts.me > this.counts.interviewer ? 'me' : 'interviewer';

    this.counts = {
      interviewer: 0,
      me: 0,
    };
    this.pendingSpeech = false;
    this.currentSpeaker = speaker;

    return speaker;
  }

  reset(): void {
    this.counts = {
      interviewer: 0,
      me: 0,
    };
    this.pendingSpeech = false;
    this.currentSpeaker = 'interviewer';
  }
}

export class ElevenLabsClient extends EventEmitter {
  private ws: WebSocket | null = null;
  private config: ElevenLabsConfig;
  private _state: ElevenLabsConnectionState =
    ElevenLabsConnectionState.DISCONNECTED;
  private speakerTracker = new SpeakerTracker();
  private pendingCommitTimer: NodeJS.Timeout | null = null;
  private lastCommittedFingerprint: string | null = null;
  private lastCommittedAt = 0;

  constructor(config: Partial<ElevenLabsConfig> = {}) {
    super();
    this.config = { ...DEFAULT_ELEVENLABS_CONFIG, ...config };
  }

  get state(): ElevenLabsConnectionState {
    return this._state;
  }

  isOpen(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  private buildUrl(): string {
    const params = new URLSearchParams({
      model_id: this.config.modelId,
    });

    if (this.config.includeTimestamps) {
      params.set('include_timestamps', 'true');
    }

    return `wss://api.elevenlabs.io/v1/speech-to-text/realtime?${params.toString()}`;
  }

  connect(): Promise<void> {
    if (this.ws) {
      return Promise.resolve();
    }

    return new Promise((resolve, reject) => {
      const apiKey = getElevenLabsApiKey();
      const url = this.buildUrl();
      let settled = false;

      const finalize = (callback: () => void): void => {
        if (settled) return;
        settled = true;
        callback();
      };

      this._state = ElevenLabsConnectionState.CONNECTING;
      this.ws = new WebSocket(url, {
        headers: {
          'xi-api-key': apiKey,
        },
      });

      const timeout = setTimeout(() => {
        finalize(() => {
          this._state = ElevenLabsConnectionState.ERROR;
          reject(new Error('Timed out waiting for ElevenLabs session start'));
        });
      }, 10000);

      this.ws.on('open', () => {
        this.emit('open');
      });

      this.ws.on('message', (data: WebSocket.Data) => {
        const sessionStarted = this.handleMessage(data);
        if (sessionStarted) {
          clearTimeout(timeout);
          finalize(() => resolve());
        }
      });

      this.ws.on('close', (code: number, reason: Buffer) => {
        clearTimeout(timeout);
        this.clearPendingCommit();
        this._state = ElevenLabsConnectionState.DISCONNECTED;
        this.ws = null;
        this.emit('close', code, reason.toString());

        if (!settled) {
          finalize(() => {
            reject(
              new Error(
                reason.toString() ||
                  `ElevenLabs connection closed with code ${code}`
              )
            );
          });
        }
      });

      this.ws.on('error', (error: Error) => {
        clearTimeout(timeout);
        this._state = ElevenLabsConnectionState.ERROR;
        this.emit('error', error);

        if (!settled) {
          finalize(() => reject(error));
        }
      });
    });
  }

  send(audioData: Buffer): boolean {
    if (!this.isOpen()) return false;

    const analysis = this.speakerTracker.observeChunk(
      audioData,
      this.config.silenceThreshold,
      this.config.dominanceThreshold
    );

    if (!analysis.mono.length) {
      return false;
    }

    try {
      this.ws!.send(
        JSON.stringify({
          message_type: 'input_audio_chunk',
          audio_base_64: analysis.mono.toString('base64'),
          commit: false,
          sample_rate: this.config.sampleRate,
        })
      );

      if (analysis.dominantSpeaker) {
        this.clearPendingCommit();
      } else if (this.speakerTracker.hasPendingSpeech()) {
        this.scheduleCommit();
      }

      return true;
    } catch (error) {
      console.error('[ElevenLabs] Failed to send audio:', error);
      return false;
    }
  }

  disconnect(): void {
    this.clearPendingCommit();

    if (!this.ws) {
      this.speakerTracker.reset();
      return;
    }

    if (this.speakerTracker.hasPendingSpeech()) {
      this.commitCurrentSegment();
    }

    this.ws.close();
    this.ws = null;
    this._state = ElevenLabsConnectionState.DISCONNECTED;
    this.speakerTracker.reset();
  }

  private scheduleCommit(): void {
    if (this.pendingCommitTimer || !this.isOpen()) {
      return;
    }

    this.pendingCommitTimer = setTimeout(() => {
      this.pendingCommitTimer = null;
      this.commitCurrentSegment();
    }, this.config.silenceCommitMs);
  }

  private clearPendingCommit(): void {
    if (this.pendingCommitTimer) {
      clearTimeout(this.pendingCommitTimer);
      this.pendingCommitTimer = null;
    }
  }

  private commitCurrentSegment(): boolean {
    if (!this.isOpen() || !this.speakerTracker.hasPendingSpeech()) {
      return false;
    }

    try {
      this.ws!.send(
        JSON.stringify({
          message_type: 'input_audio_chunk',
          audio_base_64: '',
          commit: true,
          sample_rate: this.config.sampleRate,
        })
      );
      return true;
    } catch (error) {
      console.error('[ElevenLabs] Failed to commit segment:', error);
      return false;
    }
  }

  private shouldEmitCommitted(message: ElevenLabsCommittedTranscript): boolean {
    const fingerprint = JSON.stringify({
      text: message.text.trim(),
      words: message.words?.length ?? 0,
    });
    const now = Date.now();

    if (
      fingerprint === this.lastCommittedFingerprint &&
      now - this.lastCommittedAt < 1500
    ) {
      return false;
    }

    this.lastCommittedFingerprint = fingerprint;
    this.lastCommittedAt = now;
    return true;
  }

  private handleMessage(data: WebSocket.Data): boolean {
    try {
      const message: ElevenLabsMessage = JSON.parse(data.toString());

      switch (message.message_type) {
        case 'session_started':
          this._state = ElevenLabsConnectionState.CONNECTED;
          this.emit('sessionStarted', message as ElevenLabsSessionStarted);
          return true;
        case 'partial_transcript': {
          const transcript = message as ElevenLabsPartialTranscript;
          if (!transcript.text?.trim()) {
            return false;
          }

          this.emit('partialTranscript', {
            text: transcript.text,
            speaker: this.speakerTracker.getCurrentSpeaker(),
            languageCode: transcript.language_code,
          });
          return false;
        }
        case 'committed_transcript':
        case 'committed_transcript_with_timestamps': {
          const transcript = message as ElevenLabsCommittedTranscript;
          if (
            !transcript.text?.trim() ||
            !this.shouldEmitCommitted(transcript)
          ) {
            return false;
          }

          this.clearPendingCommit();
          this.emit('committedTranscript', {
            text: transcript.text,
            speaker: this.speakerTracker.finalizeSegment(),
            words: transcript.words,
            languageCode: transcript.language_code,
          });
          return false;
        }
        case 'input_error': {
          const inputError = message as ElevenLabsInputError;
          const detail =
            inputError.detail || inputError.reason || 'Unknown input error';
          this.emit('error', new Error(`ElevenLabs input error: ${detail}`));
          return false;
        }
        default:
          return false;
      }
    } catch (error) {
      console.error('[ElevenLabs] Failed to parse message:', error);
      return false;
    }
  }
}

export async function connectElevenLabs(
  config: Partial<ElevenLabsConfig> = {}
): Promise<ElevenLabsClient> {
  const client = new ElevenLabsClient(config);
  await client.connect();
  return client;
}
