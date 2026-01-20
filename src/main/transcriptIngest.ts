import { EventEmitter } from 'events';
import { DeepgramTranscript, DeepgramClient } from './deepgram';
import {
  TranscriptSegment,
  Speaker,
  createTranscriptSegment,
} from '../lib/transcript';

export type { TranscriptSegment, Speaker } from '../lib/transcript';

function channelToSpeaker(channelIndex: number): Speaker {
  return channelIndex === 0 ? 'interviewer' : 'me';
}

export interface TranscriptIngestEvents {
  segment: (segment: TranscriptSegment) => void;
  interim: (text: string, speaker: Speaker) => void;
}

export class TranscriptIngest extends EventEmitter {
  private deepgram: DeepgramClient | null = null;
  private boundHandleTranscript: (transcript: DeepgramTranscript) => void;

  constructor() {
    super();
    this.boundHandleTranscript = this.handleTranscript.bind(this);
  }

  attachToDeepgram(client: DeepgramClient): void {
    if (this.deepgram) {
      this.detach();
    }
    this.deepgram = client;
    this.deepgram.on('transcript', this.boundHandleTranscript);
  }

  detach(): void {
    if (this.deepgram) {
      this.deepgram.removeListener('transcript', this.boundHandleTranscript);
      this.deepgram = null;
    }
  }

  private handleTranscript(transcript: DeepgramTranscript): void {
    const channelIndex = transcript.channel_index?.[0] ?? 0;
    const speaker = channelToSpeaker(channelIndex);

    const alternative = transcript.channel?.alternatives?.[0];
    if (!alternative?.transcript) return;

    const text = alternative.transcript.trim();
    if (!text) return;

    if (!transcript.is_final) {
      this.emit('interim', text, speaker);
      return;
    }

    const segment = createTranscriptSegment(text, speaker);
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
