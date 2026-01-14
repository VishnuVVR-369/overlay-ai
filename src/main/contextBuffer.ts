/**
 * Context Buffer - Rolling transcript storage for LLM context
 *
 * Per PLAN.md Phase 4:
 * To support the 10-20 minute context requirement, we need a robust buffer.
 *
 * Implementation follows the exact structure from PLAN.md:
 * ```typescript
 * class ContextBuffer {
 *     private buffer: TranscriptSegment[] = [];
 *     private readonly MAX_DURATION_MS = 20 * 60 * 1000; // 20 Minutes
 *
 *     add(segment: TranscriptSegment) { ... }
 *     private prune() { ... }
 *     getFullContext(): string { ... }
 * }
 * ```
 */

import {
  TranscriptSegment,
  formatSegmentsForContext,
} from '../lib/transcript';
import { estimateTokens } from '../lib/wordCount';

// ============================================================================
// Context Buffer Configuration
// ============================================================================

/**
 * Maximum duration to keep in the buffer (20 minutes per PLAN.md)
 */
const MAX_DURATION_MS = 20 * 60 * 1000; // 20 minutes in milliseconds

/**
 * Token estimation per PLAN.md:
 * - 20 minutes ≈ 3,000 words ≈ 4,000 tokens
 * - Most LLMs have 8k-128k context windows, so 4k fits comfortably
 */
const ESTIMATED_MAX_TOKENS = 4000;

// ============================================================================
// Context Buffer Class
// ============================================================================

/**
 * Rolling context buffer for transcript segments
 *
 * Per PLAN.md:
 * - Maintains up to 20 minutes of conversation history
 * - Automatically prunes old segments
 * - Provides formatted context for LLM prompts
 *
 * Usage:
 * ```typescript
 * const buffer = new ContextBuffer();
 *
 * // Add segments from transcript ingestion
 * buffer.add(segment);
 *
 * // Get context for LLM
 * const context = buffer.getFullContext();
 * ```
 */
export class ContextBuffer {
  private buffer: TranscriptSegment[] = [];
  private readonly maxDurationMs: number;

  constructor(options: { maxDurationMs?: number } = {}) {
    this.maxDurationMs = options.maxDurationMs ?? MAX_DURATION_MS;
  }

  /**
   * Add a new transcript segment to the buffer
   *
   * Per PLAN.md:
   * ```typescript
   * add(segment: TranscriptSegment) {
   *     this.buffer.push(segment);
   *     this.prune();
   * }
   * ```
   */
  add(segment: TranscriptSegment): void {
    this.buffer.push(segment);
    this.prune();
  }

  /**
   * Efficiently prune old data from the buffer
   *
   * Per PLAN.md:
   * ```typescript
   * private prune() {
   *     const now = Date.now();
   *     // Binary search or simple findIndex to remove old items
   *     const cutoffIndex = this.buffer.findIndex(
   *         seg => now - seg.timestamp < this.MAX_DURATION_MS
   *     );
   *     if (cutoffIndex > 0) {
   *         this.buffer = this.buffer.slice(cutoffIndex);
   *     }
   * }
   * ```
   */
  private prune(): void {
    const now = Date.now();
    const cutoffTime = now - this.maxDurationMs;

    // Find the first segment that is within the time window
    const cutoffIndex = this.buffer.findIndex(
      (seg) => seg.timestamp >= cutoffTime
    );

    if (cutoffIndex > 0) {
      // Remove all segments before the cutoff
      this.buffer = this.buffer.slice(cutoffIndex);
    } else if (cutoffIndex === -1 && this.buffer.length > 0) {
      // All segments are older than the cutoff - clear the buffer
      // This handles the edge case where no segments are within the time window
      const oldestInWindow = this.buffer.find(
        (seg) => now - seg.timestamp < this.maxDurationMs
      );
      if (!oldestInWindow) {
        this.buffer = [];
      }
    }
  }

  /**
   * Get the full context as a formatted string for LLM prompts
   *
   * Per PLAN.md:
   * ```typescript
   * getFullContext(): string {
   *     return this.buffer.map(s => `${s.speaker.toUpperCase()}: ${s.text}`).join('\n');
   * }
   * ```
   */
  getFullContext(): string {
    return formatSegmentsForContext(this.buffer);
  }

  /**
   * Get all segments in the buffer (for UI display or debugging)
   */
  getSegments(): readonly TranscriptSegment[] {
    return this.buffer;
  }

  /**
   * Get segments from a specific time window (e.g., last 30 seconds for live display)
   *
   * @param windowMs - Time window in milliseconds
   */
  getRecentSegments(windowMs: number): TranscriptSegment[] {
    const now = Date.now();
    const cutoffTime = now - windowMs;
    return this.buffer.filter((seg) => seg.timestamp >= cutoffTime);
  }

  /**
   * Get the total word count in the buffer
   */
  getTotalWordCount(): number {
    return this.buffer.reduce((sum, seg) => sum + seg.wordCount, 0);
  }

  /**
   * Estimate the total token count in the buffer
   *
   * Per PLAN.md: 20 minutes ≈ 3,000 words ≈ 4,000 tokens
   */
  getEstimatedTokenCount(): number {
    return estimateTokens(this.getTotalWordCount());
  }

  /**
   * Get buffer statistics for monitoring
   */
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

  /**
   * Clear all segments from the buffer
   */
  clear(): void {
    this.buffer = [];
  }

  /**
   * Get the number of segments in the buffer
   */
  get length(): number {
    return this.buffer.length;
  }

  /**
   * Check if the buffer is empty
   */
  get isEmpty(): boolean {
    return this.buffer.length === 0;
  }
}

// ============================================================================
// Buffer Statistics Type
// ============================================================================

export interface ContextBufferStats {
  /** Number of segments in the buffer */
  segmentCount: number;
  /** Total word count */
  wordCount: number;
  /** Estimated token count */
  estimatedTokens: number;
  /** Duration from oldest to now in milliseconds */
  durationMs: number;
  /** Timestamp of oldest segment (null if empty) */
  oldestTimestamp: number | null;
  /** Timestamp of newest segment (null if empty) */
  newestTimestamp: number | null;
}

// ============================================================================
// Singleton Instance
// ============================================================================

let defaultBuffer: ContextBuffer | null = null;

/**
 * Get the default context buffer instance
 */
export function getDefaultContextBuffer(): ContextBuffer {
  if (!defaultBuffer) {
    defaultBuffer = new ContextBuffer();
  }
  return defaultBuffer;
}

/**
 * Exported constants for testing and configuration
 */
export const CONTEXT_BUFFER_CONFIG = {
  MAX_DURATION_MS,
  ESTIMATED_MAX_TOKENS,
};
