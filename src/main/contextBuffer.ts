import { TranscriptSegment, formatSegmentsForContext } from '../lib/transcript';
import { estimateTokens } from '../lib/wordCount';

const MAX_DURATION_MS = 20 * 60 * 1000;

export interface ContextBufferStats {
  segmentCount: number;
  wordCount: number;
  estimatedTokens: number;
  durationMs: number;
  oldestTimestamp: number | null;
  newestTimestamp: number | null;
}

export interface ContextBufferOptions {
  maxDurationMs?: number;
}

export class ContextBuffer {
  private buffer: TranscriptSegment[] = [];
  private readonly maxDurationMs: number;

  constructor(options: ContextBufferOptions = {}) {
    this.maxDurationMs = options.maxDurationMs ?? MAX_DURATION_MS;
  }

  add(segment: TranscriptSegment): void {
    this.buffer.push(segment);
    this.prune();
  }

  private prune(): void {
    const now = Date.now();
    const cutoffTime = now - this.maxDurationMs;

    const cutoffIndex = this.buffer.findIndex(
      (seg) => seg.timestamp >= cutoffTime
    );

    if (cutoffIndex > 0) {
      this.buffer = this.buffer.slice(cutoffIndex);
    } else if (cutoffIndex === -1 && this.buffer.length > 0) {
      const oldestInWindow = this.buffer.find(
        (seg) => now - seg.timestamp < this.maxDurationMs
      );
      if (!oldestInWindow) {
        this.buffer = [];
      }
    }
  }

  getFullContext(): string {
    return formatSegmentsForContext(this.buffer);
  }

  getSegments(): readonly TranscriptSegment[] {
    return this.buffer;
  }

  getRecentSegments(windowMs: number): TranscriptSegment[] {
    const cutoffTime = Date.now() - windowMs;
    return this.buffer.filter((seg) => seg.timestamp >= cutoffTime);
  }

  getTotalWordCount(): number {
    return this.buffer.reduce((sum, seg) => sum + seg.wordCount, 0);
  }

  getEstimatedTokenCount(): number {
    return estimateTokens(this.getTotalWordCount());
  }

  getStats(): ContextBufferStats {
    const now = Date.now();
    const segments = this.buffer;

    if (segments.length === 0) {
      return {
        segmentCount: 0,
        wordCount: 0,
        estimatedTokens: 0,
        durationMs: 0,
        oldestTimestamp: null,
        newestTimestamp: null,
      };
    }

    const oldestTimestamp = segments[0].timestamp;
    const newestTimestamp = segments[segments.length - 1].timestamp;
    const wordCount = this.getTotalWordCount();

    return {
      segmentCount: segments.length,
      wordCount,
      estimatedTokens: estimateTokens(wordCount),
      durationMs: now - oldestTimestamp,
      oldestTimestamp,
      newestTimestamp,
    };
  }

  clear(): void {
    this.buffer = [];
  }

  get length(): number {
    return this.buffer.length;
  }

  get isEmpty(): boolean {
    return this.buffer.length === 0;
  }
}

let defaultBuffer: ContextBuffer | null = null;

export function getDefaultContextBuffer(): ContextBuffer {
  if (!defaultBuffer) {
    defaultBuffer = new ContextBuffer();
  }
  return defaultBuffer;
}

export const CONTEXT_BUFFER_CONFIG = {
  MAX_DURATION_MS,
};
