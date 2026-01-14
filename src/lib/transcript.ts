/**
 * Shared Transcript Types
 *
 * Per PLAN.md Phase 4:
 * Define TranscriptSegment type for use across main and renderer processes.
 */

// ============================================================================
// Speaker Types
// ============================================================================

/**
 * Speaker identifier for transcript segments
 *
 * Per PLAN.md multichannel strategy:
 * - 'interviewer': System audio (Channel 0) - the interviewer's voice
 * - 'me': Microphone audio (Channel 1) - your voice
 */
export type Speaker = 'interviewer' | 'me';

// ============================================================================
// Transcript Segment
// ============================================================================

/**
 * Transcript segment representing a single utterance
 *
 * Per PLAN.md Phase 4:
 * ```typescript
 * interface TranscriptSegment {
 *     timestamp: number;
 *     speaker: 'interviewer' | 'me';
 *     text: string;
 *     wordCount: number;
 * }
 * ```
 */
export interface TranscriptSegment {
  /** Unix timestamp when this segment was received (milliseconds) */
  timestamp: number;

  /** Speaker identifier based on audio channel */
  speaker: Speaker;

  /** Transcribed text content */
  text: string;

  /** Number of words in the text (for token estimation) */
  wordCount: number;
}

// ============================================================================
// Context Output
// ============================================================================

/**
 * Format a transcript segment for LLM context
 *
 * Per PLAN.md:
 * ```typescript
 * getFullContext(): string {
 *     return this.buffer.map(s => `${s.speaker.toUpperCase()}: ${s.text}`).join('\n');
 * }
 * ```
 */
export function formatSegmentForContext(segment: TranscriptSegment): string {
  return `${segment.speaker.toUpperCase()}: ${segment.text}`;
}

/**
 * Format multiple segments for LLM context
 */
export function formatSegmentsForContext(segments: TranscriptSegment[]): string {
  return segments.map(formatSegmentForContext).join('\n');
}

// ============================================================================
// Segment Creation Helper
// ============================================================================

/**
 * Create a new transcript segment with automatic word count
 */
export function createTranscriptSegment(
  text: string,
  speaker: Speaker,
  timestamp?: number
): TranscriptSegment {
  const trimmedText = text.trim();
  return {
    timestamp: timestamp ?? Date.now(),
    speaker,
    text: trimmedText,
    wordCount: countWords(trimmedText),
  };
}

/**
 * Simple word count implementation
 * (Duplicated here for use without circular imports; canonical version in wordCount.ts)
 */
function countWords(text: string): number {
  if (!text || !text.trim()) {
    return 0;
  }
  return text.trim().split(/\s+/).filter(Boolean).length;
}
