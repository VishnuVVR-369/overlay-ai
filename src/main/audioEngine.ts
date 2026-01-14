/**
 * Audio Engine - Spawns and manages the Rust audio sidecar binary
 *
 * Per PLAN.md:
 * - Spawn the Rust binary as a child process
 * - Read PCM audio from stdout
 * - Forward to Deepgram WebSocket when connection is open
 */

import { spawn, ChildProcess } from 'child_process';
import { app } from 'electron';
import path from 'path';
import { EventEmitter } from 'events';

// ============================================================================
// Binary Path Strategy
// ============================================================================

/**
 * Platform-specific binary names per PLAN.md
 */
const BINARY_NAMES: Record<string, string> = {
  darwin: 'audio-engine-mac',
  win32: 'audio-engine-win.exe',
  linux: 'audio-engine-linux',
};

/**
 * Resolve the path to the audio-engine binary based on platform and environment
 *
 * In development: Uses the local cargo build output
 * In production: Uses the packaged binary in resources/bin/
 */
export function getAudioEnginePath(): string {
  const binaryName = BINARY_NAMES[process.platform] || 'audio-engine';
  const isDev = !app.isPackaged;

  if (isDev) {
    // Development: Use cargo build output
    // Path: native/audio-engine/target/release/audio-engine
    const devPath = path.join(
      app.getAppPath(),
      'native',
      'audio-engine',
      'target',
      'release',
      process.platform === 'win32' ? 'audio-engine.exe' : 'audio-engine'
    );
    return devPath;
  } else {
    // Production: Use packaged binary
    // Path: resources/bin/audio-engine-mac (per electron-builder config)
    const prodPath = path.join(process.resourcesPath, 'bin', binaryName);
    return prodPath;
  }
}

// ============================================================================
// Audio Engine Events
// ============================================================================

export interface AudioEngineEvents {
  /** Raw PCM audio data chunk from stdout */
  data: (chunk: Buffer) => void;
  /** Error message from stderr or process error */
  error: (error: Error) => void;
  /** Process exited */
  exit: (code: number | null, signal: string | null) => void;
  /** Engine started successfully */
  started: () => void;
  /** Engine stopped */
  stopped: () => void;
}

// ============================================================================
// Audio Engine Manager
// ============================================================================

/**
 * Manages the Rust audio-engine sidecar process
 *
 * Usage per PLAN.md:
 * ```typescript
 * const audioProcess = spawn('./resources/bin/audio-engine-mac', ['--sample-rate', '16000']);
 * audioProcess.stdout.on('data', (chunk) => {
 *     if (deepgramWs.readyState === WebSocket.OPEN) {
 *         deepgramWs.send(chunk);
 *     }
 * });
 * ```
 */
export class AudioEngine extends EventEmitter {
  private process: ChildProcess | null = null;
  private isRunning = false;

  /** Default sample rate for Deepgram (per PLAN.md) */
  private readonly sampleRate: number;

  /** Audio input device name */
  private readonly device: string;

  constructor(options: { sampleRate?: number; device?: string } = {}) {
    super();
    this.sampleRate = options.sampleRate ?? 16000;
    this.device = options.device ?? 'default';
  }

  /**
   * Start the audio engine process
   */
  start(): void {
    if (this.isRunning) {
      console.warn('[AudioEngine] Already running');
      return;
    }

    const binaryPath = getAudioEnginePath();
    console.log(`[AudioEngine] Starting: ${binaryPath}`);
    console.log(`[AudioEngine] Args: --sample-rate ${this.sampleRate} --device ${this.device}`);

    try {
      // Spawn the Rust binary per PLAN.md pseudocode
      this.process = spawn(binaryPath, [
        '--sample-rate',
        this.sampleRate.toString(),
        '--device',
        this.device,
      ]);

      this.isRunning = true;

      // Handle stdout - raw PCM audio data
      this.process.stdout?.on('data', (chunk: Buffer) => {
        this.emit('data', chunk);
      });

      // Handle stderr - logging and errors
      this.process.stderr?.on('data', (data: Buffer) => {
        const message = data.toString().trim();
        // Log stderr messages (info, warnings, errors from Rust binary)
        console.log(`[AudioEngine] ${message}`);

        // Emit error event for actual errors
        if (message.includes('[ERROR]')) {
          this.emit('error', new Error(message));
        }
      });

      // Handle process errors
      this.process.on('error', (error: Error) => {
        console.error('[AudioEngine] Process error:', error.message);
        this.emit('error', error);
        this.cleanup();
      });

      // Handle process exit
      this.process.on('close', (code: number | null, signal: string | null) => {
        console.log(`[AudioEngine] Process exited with code ${code}, signal ${signal}`);
        this.emit('exit', code, signal);
        this.cleanup();
      });

      this.emit('started');
      console.log('[AudioEngine] Started successfully');
    } catch (error) {
      console.error('[AudioEngine] Failed to start:', error);
      this.emit('error', error as Error);
      this.cleanup();
    }
  }

  /**
   * Stop the audio engine process
   */
  stop(): void {
    if (!this.isRunning || !this.process) {
      console.warn('[AudioEngine] Not running');
      return;
    }

    console.log('[AudioEngine] Stopping...');

    // Send SIGTERM to gracefully stop the process
    this.process.kill('SIGTERM');

    // Force kill after timeout if still running
    const forceKillTimeout = setTimeout(() => {
      if (this.process && !this.process.killed) {
        console.warn('[AudioEngine] Force killing process');
        this.process.kill('SIGKILL');
      }
    }, 3000);

    this.process.once('close', () => {
      clearTimeout(forceKillTimeout);
    });
  }

  /**
   * Check if the engine is currently running
   */
  get running(): boolean {
    return this.isRunning;
  }

  /**
   * Clean up process references
   */
  private cleanup(): void {
    this.isRunning = false;
    this.process = null;
    this.emit('stopped');
  }
}

// Export singleton instance for convenience
let defaultEngine: AudioEngine | null = null;

export function getDefaultAudioEngine(): AudioEngine {
  if (!defaultEngine) {
    defaultEngine = new AudioEngine();
  }
  return defaultEngine;
}
