import { spawn, ChildProcess } from 'child_process';
import { app } from 'electron';
import path from 'path';
import { EventEmitter } from 'events';

const BINARY_NAMES: Record<string, string> = {
  darwin: 'audio-engine-mac',
  win32: 'audio-engine-win.exe',
  linux: 'audio-engine-linux',
};

const FORCE_KILL_TIMEOUT_MS = 3000;

export function getAudioEnginePath(): string {
  const binaryName = BINARY_NAMES[process.platform] || 'audio-engine';
  const isDev = !app.isPackaged;

  if (isDev) {
    const executableName =
      process.platform === 'win32' ? 'audio-engine.exe' : 'audio-engine';
    return path.join(
      app.getAppPath(),
      'native',
      'audio-engine',
      'target',
      'release',
      executableName
    );
  }
  return path.join(process.resourcesPath, 'bin', binaryName);
}

export interface AudioEngineEvents {
  data: (chunk: Buffer) => void;
  error: (error: Error) => void;
  exit: (code: number | null, signal: string | null) => void;
  started: () => void;
  stopped: () => void;
}

export interface AudioEngineOptions {
  sampleRate?: number;
  device?: string;
}

export class AudioEngine extends EventEmitter {
  private process: ChildProcess | null = null;
  private isRunning = false;
  private readonly sampleRate: number;
  private readonly device: string;

  constructor(options: AudioEngineOptions = {}) {
    super();
    this.sampleRate = options.sampleRate ?? 16000;
    this.device = options.device ?? 'default';
  }

  start(): void {
    if (this.isRunning) return;

    const binaryPath = getAudioEnginePath();
    this.process = spawn(binaryPath, [
      '--sample-rate',
      this.sampleRate.toString(),
      '--device',
      this.device,
    ]);

    this.isRunning = true;
    this.attachProcessListeners();
    this.emit('started');
  }

  private attachProcessListeners(): void {
    if (!this.process) return;

    this.process.stdout?.on('data', (chunk: Buffer) => {
      this.emit('data', chunk);
    });

    this.process.stderr?.on('data', (data: Buffer) => {
      const message = data.toString().trim();
      console.log(`[AudioEngine] ${message}`);
      if (message.includes('[ERROR]')) {
        this.emit('error', new Error(message));
      }
    });

    this.process.on('error', (error: Error) => {
      console.error('[AudioEngine] Process error:', error.message);
      this.emit('error', error);
      this.cleanup();
    });

    this.process.on('close', (code: number | null, signal: string | null) => {
      console.log(
        `[AudioEngine] Process exited with code ${code}, signal ${signal}`
      );
      this.emit('exit', code, signal);
      this.cleanup();
    });
  }

  stop(): void {
    if (!this.isRunning || !this.process) return;

    this.process.kill('SIGTERM');

    const forceKillTimeout = setTimeout(() => {
      if (this.process && !this.process.killed) {
        this.process.kill('SIGKILL');
      }
    }, FORCE_KILL_TIMEOUT_MS);

    this.process.once('close', () => {
      clearTimeout(forceKillTimeout);
    });
  }

  get running(): boolean {
    return this.isRunning;
  }

  private cleanup(): void {
    this.isRunning = false;
    this.process = null;
    this.emit('stopped');
  }
}

let defaultEngine: AudioEngine | null = null;

export function getDefaultAudioEngine(): AudioEngine {
  if (!defaultEngine) {
    defaultEngine = new AudioEngine();
  }
  return defaultEngine;
}
