import { countWords } from './wordCount';

export type Speaker = 'interviewer' | 'me';

export interface TranscriptSegment {
  timestamp: number;
  speaker: Speaker;
  text: string;
  wordCount: number;
}

export function formatSegmentForContext(segment: TranscriptSegment): string {
  return `${segment.speaker.toUpperCase()}: ${segment.text}`;
}

export function formatSegmentsForContext(
  segments: TranscriptSegment[]
): string {
  return segments.map(formatSegmentForContext).join('\n');
}

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
