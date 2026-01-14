/**
 * Live Mode State Machine
 *
 * Per PLAN.md Phase 9:
 * Create src/main/liveMode.ts managing transitions:
 * disconnected → connecting → connected → error
 *
 * Integrates audio sidecar + Deepgram for real-time transcription.
 */

import { EventEmitter } from 'events';
import type { LiveModeStatus, LiveModeState } from '../lib/ipc';
import type { TranscriptSegment, Speaker } from '../lib/transcript';
import { AudioEngine, getDefaultAudioEngine } from './audioEngine';
import { DeepgramClient, connectDeepgram, isDeepgramConfigured } from './deepgram';
import { TranscriptIngest, getDefaultTranscriptIngest } from './transcriptIngest';
import { getDefaultContextBuffer } from './contextBuffer';

// ============================================================================
// Types
// ============================================================================

/**
 * Valid state transitions for the Live Mode state machine
 */
const VALID_TRANSITIONS: Record<LiveModeState, LiveModeState[]> = {
  disconnected: ['connecting'],
  connecting: ['connected', 'error', 'disconnected'],
  connected: ['disconnected', 'error'],
  error: ['disconnected', 'connecting'],
};

/**
 * Events emitted by the LiveModeManager
 */
export interface LiveModeEvents {
  /** State changed */
  stateChanged: (status: LiveModeStatus) => void;
  /** New transcript segment received */
  segment: (segment: TranscriptSegment) => void;
  /** Interim transcript update */
  interim: (text: string, speaker: Speaker) => void;
  /** Error occurred */
  error: (error: Error) => void;
}

// ============================================================================
// Live Mode Manager
// ============================================================================

/**
 * LiveModeManager - State machine for audio capture + transcription
 *
 * Manages the lifecycle of:
 * - Rust audio engine (microphone capture)
 * - Deepgram WebSocket (transcription)
 * - Transcript ingestion (segment processing)
 *
 * State transitions:
 * ```
 * disconnected ──start()──> connecting ──success──> connected
 *      ▲                         │                      │
 *      │                         │                      │
 *      └────────stop()───────────┴──────stop()──────────┘
 *                                │
 *                                └──error──> error ──retry/stop──> disconnected
 * ```
 */
export class LiveModeManager extends EventEmitter {
  private _state: LiveModeState = 'disconnected';
  private _error: string | undefined;
  private _connectedAt: number | undefined;

  private audioEngine: AudioEngine | null = null;
  private deepgramClient: DeepgramClient | null = null;
  private transcriptIngest: TranscriptIngest | null = null;

  // ============================================================================
  // State Management
  // ============================================================================

  /**
   * Get current state
   */
  get state(): LiveModeState {
    return this._state;
  }

  /**
   * Get current status object
   */
  get status(): LiveModeStatus {
    return {
      state: this._state,
      error: this._error,
      connectedAt: this._connectedAt,
    };
  }

  /**
   * Check if currently running (connected)
   */
  get isRunning(): boolean {
    return this._state === 'connected';
  }

  /**
   * Check if currently connecting
   */
  get isConnecting(): boolean {
    return this._state === 'connecting';
  }

  /**
   * Transition to a new state
   */
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

  // ============================================================================
  // Lifecycle Methods
  // ============================================================================

  /**
   * Start live mode - connect audio engine and Deepgram
   */
  async start(): Promise<LiveModeStatus> {
    // Already connected or connecting
    if (this._state === 'connected') {
      return this.status;
    }

    if (this._state === 'connecting') {
      console.warn('[LiveMode] Already connecting');
      return this.status;
    }

    // Check configuration
    if (!isDeepgramConfigured()) {
      this.transition('error', 'DEEPGRAM_API_KEY not configured');
      return this.status;
    }

    this.transition('connecting');

    try {
      // Connect to Deepgram
      this.deepgramClient = await connectDeepgram();
      console.log('[LiveMode] Deepgram connected');

      // Set up transcript ingestion
      this.transcriptIngest = getDefaultTranscriptIngest();
      this.transcriptIngest.attachToDeepgram(this.deepgramClient);

      // Forward transcript events
      this.transcriptIngest.on('segment', (segment: TranscriptSegment) => {
        getDefaultContextBuffer().add(segment);
        this.emit('segment', segment);
      });

      this.transcriptIngest.on('interim', (text: string, speaker: Speaker) => {
        this.emit('interim', text, speaker);
      });

      // Start audio engine
      this.audioEngine = getDefaultAudioEngine();

      // Forward audio to Deepgram
      this.audioEngine.on('data', (chunk: Buffer) => {
        if (this.deepgramClient?.isOpen()) {
          this.deepgramClient.send(chunk);
        }
      });

      this.audioEngine.on('error', (error: Error) => {
        console.error('[LiveMode] Audio engine error:', error);
        this.emit('error', error);
      });

      this.audioEngine.on('exit', (code, signal) => {
        console.log(`[LiveMode] Audio engine exited: code=${code}, signal=${signal}`);
        if (code !== 0 && code !== null && this._state === 'connected') {
          this.transition('error', `Audio engine exited with code ${code}`);
        }
      });

      this.audioEngine.start();
      console.log('[LiveMode] Audio engine started');

      this.transition('connected');
      return this.status;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('[LiveMode] Start failed:', errorMessage);
      this.cleanup();
      this.transition('error', errorMessage);
      return this.status;
    }
  }

  /**
   * Stop live mode - disconnect everything
   */
  stop(): LiveModeStatus {
    if (this._state === 'disconnected') {
      return this.status;
    }

    console.log('[LiveMode] Stopping...');
    this.cleanup();
    this.transition('disconnected');
    return this.status;
  }

  /**
   * Toggle live mode on/off
   */
  async toggle(): Promise<LiveModeStatus> {
    if (this._state === 'connected' || this._state === 'connecting') {
      return this.stop();
    } else {
      return this.start();
    }
  }

  /**
   * Retry after error
   */
  async retry(): Promise<LiveModeStatus> {
    if (this._state !== 'error') {
      console.warn('[LiveMode] Can only retry from error state');
      return this.status;
    }

    this.transition('disconnected');
    return this.start();
  }

  // ============================================================================
  // Cleanup
  // ============================================================================

  /**
   * Clean up all resources
   */
  private cleanup(): void {
    // Stop audio engine
    if (this.audioEngine) {
      if (this.audioEngine.running) {
        this.audioEngine.stop();
      }
      this.audioEngine.removeAllListeners();
      this.audioEngine = null;
    }

    // Disconnect Deepgram
    if (this.deepgramClient) {
      this.deepgramClient.disconnect();
      this.deepgramClient = null;
    }

    // Detach transcript ingestion
    if (this.transcriptIngest) {
      this.transcriptIngest.detach();
      this.transcriptIngest.removeAllListeners();
      this.transcriptIngest = null;
    }
  }

  /**
   * Dispose of the manager (call on app quit)
   */
  dispose(): void {
    this.cleanup();
    this.removeAllListeners();
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let defaultManager: LiveModeManager | null = null;

/**
 * Get the default LiveModeManager instance
 */
export function getDefaultLiveModeManager(): LiveModeManager {
  if (!defaultManager) {
    defaultManager = new LiveModeManager();
  }
  return defaultManager;
}

/**
 * Dispose of the default manager
 */
export function disposeLiveModeManager(): void {
  if (defaultManager) {
    defaultManager.dispose();
    defaultManager = null;
  }
}

// ============================================================================
// Convenience Functions
// ============================================================================

/**
 * Start live mode using the default manager
 */
export async function startLiveMode(): Promise<LiveModeStatus> {
  return getDefaultLiveModeManager().start();
}

/**
 * Stop live mode using the default manager
 */
export function stopLiveMode(): LiveModeStatus {
  return getDefaultLiveModeManager().stop();
}

/**
 * Toggle live mode using the default manager
 */
export async function toggleLiveMode(): Promise<LiveModeStatus> {
  return getDefaultLiveModeManager().toggle();
}

/**
 * Get current live mode status
 */
export function getLiveModeStatus(): LiveModeStatus {
  return getDefaultLiveModeManager().status;
}

/**
 * Check if live mode is running
 */
export function isLiveModeRunning(): boolean {
  return getDefaultLiveModeManager().isRunning;
}
