import type { ContextBuffer } from './contextBuffer';
import {
  createTranscriptSegment,
  formatSegmentForContext,
  type Speaker,
} from '../lib/transcript';

export interface InterimTranscript {
  text: string;
  speaker: Speaker;
}

function normalizeInterimTranscript(
  interimTranscript: InterimTranscript | null
): InterimTranscript | null {
  if (!interimTranscript) {
    return null;
  }

  const text = interimTranscript.text.trim();
  if (!text) {
    return null;
  }

  return {
    text,
    speaker: interimTranscript.speaker,
  };
}

export function formatInterimTranscriptForContext(
  interimTranscript: InterimTranscript | null
): string {
  const normalizedTranscript = normalizeInterimTranscript(interimTranscript);
  if (!normalizedTranscript) {
    return '';
  }

  return formatSegmentForContext(
    createTranscriptSegment(
      normalizedTranscript.text,
      normalizedTranscript.speaker
    )
  );
}

export function buildAnswerContext(
  buffer: Pick<ContextBuffer, 'getFullContext'>,
  interimTranscript: InterimTranscript | null
): string {
  const committedContext = buffer.getFullContext();
  const interimContext = formatInterimTranscriptForContext(interimTranscript);

  return [committedContext, interimContext].filter(Boolean).join('\n');
}

export class InterimTranscriptTracker {
  private currentInterimTranscript: InterimTranscript | null = null;

  update(text: string, speaker: Speaker): void {
    this.currentInterimTranscript = normalizeInterimTranscript({
      text,
      speaker,
    });
  }

  clear(): void {
    this.currentInterimTranscript = null;
  }

  getCurrent(): InterimTranscript | null {
    return this.currentInterimTranscript;
  }

  buildAnswerContext(buffer: Pick<ContextBuffer, 'getFullContext'>): string {
    return buildAnswerContext(buffer, this.currentInterimTranscript);
  }
}
