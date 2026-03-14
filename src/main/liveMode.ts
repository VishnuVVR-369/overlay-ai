import { EventEmitter } from 'events';
import type { LiveModeStatus, LiveModeState } from '../lib/ipc';
import type { TranscriptSegment, Speaker } from '../lib/transcript';
import { AudioEngine, getDefaultAudioEngine } from './audioEngine';
import {
  ElevenLabsClient,
  connectElevenLabs,
  isElevenLabsConfigured,
} from './elevenLabs';
import {
  TranscriptIngest,
  getDefaultTranscriptIngest,
} from './transcriptIngest';
import { getDefaultContextBuffer } from './contextBuffer';

const VALID_TRANSITIONS: Record<LiveModeState, LiveModeState[]> = {
  disconnected: ['connecting'],
  connecting: ['connected', 'error', 'disconnected'],
  connected: ['disconnected', 'error'],
  error: ['disconnected', 'connecting'],
};

export interface LiveModeEvents {
  stateChanged: (status: LiveModeStatus) => void;
  segment: (segment: TranscriptSegment) => void;
  interim: (text: string, speaker: Speaker) => void;
  error: (error: Error) => void;
}

export class LiveModeManager extends EventEmitter {
  private _state: LiveModeState = 'disconnected';
  private _error: string | undefined;
  private _connectedAt: number | undefined;
  private audioEngine: AudioEngine | null = null;
  private transcriptionClient: ElevenLabsClient | null = null;
  private transcriptIngest: TranscriptIngest | null = null;

  get state(): LiveModeState {
    return this._state;
  }

  get status(): LiveModeStatus {
    return {
      state: this._state,
      error: this._error,
      connectedAt: this._connectedAt,
    };
  }

  get isRunning(): boolean {
    return this._state === 'connected';
  }

  get isConnecting(): boolean {
    return this._state === 'connecting';
  }

  private transition(newState: LiveModeState, error?: string): void {
    const validTargets = VALID_TRANSITIONS[this._state];

    if (!validTargets.includes(newState)) {
      console.warn(
        `[LiveMode] Invalid transition: ${this._state} → ${newState}`
      );
      return;
    }

    const oldState = this._state;
    this._state = newState;
    this._error = error;

    if (newState === 'connected') {
      this._connectedAt = Date.now();
    } else if (newState === 'disconnected') {
      this._connectedAt = undefined;
    }

    console.log(`[LiveMode] State: ${oldState} → ${newState}`);
    this.emit('stateChanged', this.status);
  }

  async start(): Promise<LiveModeStatus> {
    if (this._state === 'connected' || this._state === 'connecting') {
      return this.status;
    }

    if (!isElevenLabsConfigured()) {
      this.transition('error', 'ELEVENLABS_API_KEY not configured');
      return this.status;
    }

    this.transition('connecting');

    try {
      this.transcriptionClient = await connectElevenLabs();
      this.setupTranscriptIngest();
      this.setupAudioEngine();
      this.audioEngine!.start();
      this.transition('connected');
      return this.status;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      console.error('[LiveMode] Start failed:', errorMessage);
      this.cleanup();
      this.transition('error', errorMessage);
      return this.status;
    }
  }

  private setupTranscriptIngest(): void {
    this.transcriptIngest = getDefaultTranscriptIngest();
    this.transcriptIngest.attachToTranscriptionClient(
      this.transcriptionClient!
    );

    this.transcriptIngest.on('segment', (segment: TranscriptSegment) => {
      getDefaultContextBuffer().add(segment);
      this.emit('segment', segment);
    });

    this.transcriptIngest.on('interim', (text: string, speaker: Speaker) => {
      this.emit('interim', text, speaker);
    });
  }

  private setupAudioEngine(): void {
    this.audioEngine = getDefaultAudioEngine();

    this.audioEngine.on('data', (chunk: Buffer) => {
      if (this.transcriptionClient?.isOpen()) {
        this.transcriptionClient.send(chunk);
      }
    });

    this.audioEngine.on('error', (error: Error) => {
      console.error('[LiveMode] Audio engine error:', error);
      this.emit('error', error);
    });

    this.audioEngine.on('exit', (code, signal) => {
      console.log(
        `[LiveMode] Audio engine exited: code=${code}, signal=${signal}`
      );
      if (code !== 0 && code !== null && this._state === 'connected') {
        this.transition('error', `Audio engine exited with code ${code}`);
      }
    });
  }

  stop(): LiveModeStatus {
    if (this._state === 'disconnected') {
      return this.status;
    }
    this.cleanup();
    this.transition('disconnected');
    return this.status;
  }

  async toggle(): Promise<LiveModeStatus> {
    if (this._state === 'connected' || this._state === 'connecting') {
      return this.stop();
    }
    return this.start();
  }

  async retry(): Promise<LiveModeStatus> {
    if (this._state !== 'error') {
      return this.status;
    }
    this.transition('disconnected');
    return this.start();
  }

  private cleanup(): void {
    if (this.audioEngine) {
      if (this.audioEngine.running) {
        this.audioEngine.stop();
      }
      this.audioEngine.removeAllListeners();
      this.audioEngine = null;
    }

    if (this.transcriptionClient) {
      this.transcriptionClient.disconnect();
      this.transcriptionClient = null;
    }

    if (this.transcriptIngest) {
      this.transcriptIngest.detach();
      this.transcriptIngest.removeAllListeners();
      this.transcriptIngest = null;
    }
  }

  dispose(): void {
    this.cleanup();
    this.removeAllListeners();
  }
}

let defaultManager: LiveModeManager | null = null;

export function getDefaultLiveModeManager(): LiveModeManager {
  if (!defaultManager) {
    defaultManager = new LiveModeManager();
  }
  return defaultManager;
}

export function disposeLiveModeManager(): void {
  if (defaultManager) {
    defaultManager.dispose();
    defaultManager = null;
  }
}

export function startLiveMode(): Promise<LiveModeStatus> {
  return getDefaultLiveModeManager().start();
}

export function stopLiveMode(): LiveModeStatus {
  return getDefaultLiveModeManager().stop();
}

export function toggleLiveMode(): Promise<LiveModeStatus> {
  return getDefaultLiveModeManager().toggle();
}

export function getLiveModeStatus(): LiveModeStatus {
  return getDefaultLiveModeManager().status;
}

export function isLiveModeRunning(): boolean {
  return getDefaultLiveModeManager().isRunning;
}
