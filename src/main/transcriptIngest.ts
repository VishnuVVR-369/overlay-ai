import { EventEmitter } from 'events';
import type { ElevenLabsClient, ElevenLabsTranscriptEvent } from './elevenLabs';
import {
  TranscriptSegment,
  Speaker,
  createTranscriptSegment,
} from '../lib/transcript';

export type { TranscriptSegment, Speaker } from '../lib/transcript';

export interface TranscriptIngestEvents {
  segment: (segment: TranscriptSegment) => void;
  interim: (text: string, speaker: Speaker) => void;
}

export class TranscriptIngest extends EventEmitter {
  private client: ElevenLabsClient | null = null;
  private boundHandlePartialTranscript: (
    transcript: ElevenLabsTranscriptEvent
  ) => void;
  private boundHandleCommittedTranscript: (
    transcript: ElevenLabsTranscriptEvent
  ) => void;

  constructor() {
    super();
    this.boundHandlePartialTranscript = this.handlePartialTranscript.bind(this);
    this.boundHandleCommittedTranscript =
      this.handleCommittedTranscript.bind(this);
  }

  attachToTranscriptionClient(client: ElevenLabsClient): void {
    if (this.client) {
      this.detach();
    }
    this.client = client;
    this.client.on('partialTranscript', this.boundHandlePartialTranscript);
    this.client.on('committedTranscript', this.boundHandleCommittedTranscript);
  }

  detach(): void {
    if (this.client) {
      this.client.removeListener(
        'partialTranscript',
        this.boundHandlePartialTranscript
      );
      this.client.removeListener(
        'committedTranscript',
        this.boundHandleCommittedTranscript
      );
      this.client = null;
    }
  }

  private handlePartialTranscript(transcript: ElevenLabsTranscriptEvent): void {
    const text = transcript.text.trim();
    if (!text) return;
    this.emit('interim', text, transcript.speaker);
  }

  private handleCommittedTranscript(
    transcript: ElevenLabsTranscriptEvent
  ): void {
    const text = transcript.text.trim();
    if (!text) return;

    const segment = createTranscriptSegment(text, transcript.speaker);
    this.emit('segment', segment);
  }

  ingestManual(text: string, speaker: Speaker): void {
    const segment = createTranscriptSegment(text, speaker);
    this.emit('segment', segment);
  }
}

let defaultIngest: TranscriptIngest | null = null;

export function getDefaultTranscriptIngest(): TranscriptIngest {
  if (!defaultIngest) {
    defaultIngest = new TranscriptIngest();
  }
  return defaultIngest;
}
