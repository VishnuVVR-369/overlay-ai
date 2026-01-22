import { EventEmitter } from 'events';
import type { SessionStats } from '../lib/ipc';

export class SessionStatsManager extends EventEmitter {
  private sessionStartedAt: number | null = null;
  private totalWordsTranscribed = 0;
  private totalInputTokens = 0;
  private totalOutputTokens = 0;

  startSession(): void {
    if (this.sessionStartedAt === null) {
      this.sessionStartedAt = Date.now();
      this.emitUpdate();
    }
  }

  endSession(): void {
    this.sessionStartedAt = null;
    this.emitUpdate();
  }

  addWords(wordCount: number): void {
    this.totalWordsTranscribed += wordCount;
    this.emitUpdate();
  }

  addTokens(inputTokens: number, outputTokens: number): void {
    this.totalInputTokens += inputTokens;
    this.totalOutputTokens += outputTokens;
    this.emitUpdate();
  }

  getStats(): SessionStats {
    return {
      sessionStartedAt: this.sessionStartedAt,
      totalWordsTranscribed: this.totalWordsTranscribed,
      totalInputTokens: this.totalInputTokens,
      totalOutputTokens: this.totalOutputTokens,
    };
  }

  reset(): void {
    this.sessionStartedAt = null;
    this.totalWordsTranscribed = 0;
    this.totalInputTokens = 0;
    this.totalOutputTokens = 0;
    this.emitUpdate();
  }

  private emitUpdate(): void {
    this.emit('statsUpdated', this.getStats());
  }
}

let instance: SessionStatsManager | null = null;

export function getSessionStatsManager(): SessionStatsManager {
  if (!instance) {
    instance = new SessionStatsManager();
  }
  return instance;
}

export function resetSessionStatsManager(): void {
  instance = null;
}
