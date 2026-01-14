/**
 * Transcript Ingestion - Maps Deepgram messages to internal transcript format
 *
 * Per PLAN.md:
 * - Receive transcript messages from Deepgram
 * - Map them into TranscriptSegment instances
 * - Forward to the ContextBuffer for storage
 *
 * Note: Speaker mapping is not fully specified in the plan.
 * Using channel index for diarization:
 * - Channel 0 = System Audio = Interviewer
 * - Channel 1 = Microphone = Me (You)
 */

import { EventEmitter } from 'events';
import { DeepgramTranscript, DeepgramClient } from './deepgram';
import {
  TranscriptSegment,
  Speaker,
  createTranscriptSegment,
} from '../lib/transcript';
import { countWords } from '../lib/wordCount';

// Re-export TranscriptSegment for convenience
export type { TranscriptSegment, Speaker } from '../lib/transcript';

// ============================================================================
// Speaker Mapping
// ============================================================================

/**
 * Map Deepgram channel index to speaker identifier
 *
 * Per PLAN.md mixing strategy:
 * - Channel 0: System Audio (Interviewer)
 * - Channel 1: Microphone (You/Me)
 */
function channelToSpeaker(channelIndex: number): Speaker {
  return channelIndex === 0 ? 'interviewer' : 'me';
}

// ============================================================================
// Transcript Ingest Events
// ============================================================================

export interface TranscriptIngestEvents {
  /** New transcript segment received */
  segment: (segment: TranscriptSegment) => void;
  /** Interim (non-final) transcript received */
  interim: (text: string, speaker: Speaker) => void;
}

// ============================================================================
// Transcript Ingest Handler
// ============================================================================

/**
 * Handles ingestion of Deepgram transcripts into internal format
 *
 * Usage:
 * ```typescript
 * const ingest = new TranscriptIngest();
 * ingest.attachToDeepgram(deepgramClient);
 *
 * ingest.on('segment', (segment) => {
 *   contextBuffer.add(segment);
 * });
 * ```
 */
export class TranscriptIngest extends EventEmitter {
  private deepgram: DeepgramClient | null = null;
  private boundHandleTranscript: (transcript: DeepgramTranscript) => void;

  constructor() {
    super();
    // Bind the handler once for proper add/remove listener
    this.boundHandleTranscript = this.handleTranscript.bind(this);
  }

  /**
   * Attach to a Deepgram client to receive transcript events
   */
  attachToDeepgram(client: DeepgramClient): void {
    if (this.deepgram) {
      this.detach();
    }

    this.deepgram = client;
    this.deepgram.on('transcript', this.boundHandleTranscript);

    console.log('[TranscriptIngest] Attached to Deepgram client');
  }

  /**
   * Detach from the current Deepgram client
   */
  detach(): void {
    if (this.deepgram) {
      this.deepgram.removeListener('transcript', this.boundHandleTranscript);
      this.deepgram = null;
      console.log('[TranscriptIngest] Detached from Deepgram client');
    }
  }

  /**
   * Handle incoming Deepgram transcript message
   */
  private handleTranscript(transcript: DeepgramTranscript): void {
    // Get the channel index (for multichannel diarization)
    const channelIndex = transcript.channel_index?.[0] ?? 0;
    const speaker = channelToSpeaker(channelIndex);

    // Get the best alternative
    const alternative = transcript.channel?.alternatives?.[0];
    if (!alternative || !alternative.transcript) {
      return;
    }

    const text = alternative.transcript.trim();
    if (!text) {
      return;
    }

    // Emit interim transcripts for live display
    if (!transcript.is_final) {
      this.emit('interim', text, speaker);
      return;
    }

    // Create transcript segment for final transcripts using shared helper
    const segment = createTranscriptSegment(text, speaker);

    console.log(`[TranscriptIngest] ${speaker.toUpperCase()}: ${text}`);
    this.emit('segment', segment);
  }

  /**
   * Manually ingest a transcript (for testing or manual input)
   */
  ingestManual(text: string, speaker: Speaker): void {
    const segment = createTranscriptSegment(text, speaker);
    this.emit('segment', segment);
  }
}

// Export singleton instance
let defaultIngest: TranscriptIngest | null = null;

export function getDefaultTranscriptIngest(): TranscriptIngest {
  if (!defaultIngest) {
    defaultIngest = new TranscriptIngest();
  }
  return defaultIngest;
}
