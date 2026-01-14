/**
 * Verification Milestone 4: Transcription events reach transcript pipeline
 *
 * Per tasks.md Phase 11:
 * "Verify transcription events reach transcript pipeline: Confirm Deepgram
 * transcript messages are received and routed into `transcriptIngest` placeholder."
 *
 * Tests:
 * 1. TranscriptIngest can be instantiated
 * 2. Speaker mapping works correctly (Channel 0 = interviewer, Channel 1 = me)
 * 3. TranscriptIngest emits 'segment' events for final transcripts
 * 4. TranscriptIngest emits 'interim' events for non-final transcripts
 * 5. TranscriptSegment format matches PLAN.md spec
 */

import { describe, it, expect } from 'vitest';
import { EventEmitter } from 'events';

describe('Transcript Pipeline - Verification', () => {
  describe('TranscriptIngest Module', () => {
    it('should export TranscriptIngest class', async () => {
      const { TranscriptIngest } = await import('../../src/main/transcriptIngest');
      expect(TranscriptIngest).toBeDefined();
      expect(typeof TranscriptIngest).toBe('function');
    });

    it('should export getDefaultTranscriptIngest function', async () => {
      const { getDefaultTranscriptIngest } = await import('../../src/main/transcriptIngest');
      expect(getDefaultTranscriptIngest).toBeDefined();
      expect(typeof getDefaultTranscriptIngest).toBe('function');
    });

    it('TranscriptIngest should extend EventEmitter', async () => {
      const { TranscriptIngest } = await import('../../src/main/transcriptIngest');
      const ingest = new TranscriptIngest();
      expect(ingest).toBeInstanceOf(EventEmitter);
    });
  });

  describe('TranscriptSegment Type', () => {
    it('should export TranscriptSegment type components', async () => {
      const transcript = await import('../../src/lib/transcript');

      expect(transcript.createTranscriptSegment).toBeDefined();
      expect(transcript.formatSegmentForContext).toBeDefined();
      expect(transcript.formatSegmentsForContext).toBeDefined();
    });

    it('createTranscriptSegment should create valid segment', async () => {
      const { createTranscriptSegment } = await import('../../src/lib/transcript');

      const segment = createTranscriptSegment('Hello world', 'interviewer');

      expect(segment.text).toBe('Hello world');
      expect(segment.speaker).toBe('interviewer');
      expect(segment.timestamp).toBeGreaterThan(0);
      expect(segment.wordCount).toBe(2);
    });

    it('should format segments for LLM context', async () => {
      const { createTranscriptSegment, formatSegmentsForContext } = await import('../../src/lib/transcript');

      const segments = [
        createTranscriptSegment('How are you?', 'interviewer'),
        createTranscriptSegment('I am fine.', 'me'),
      ];

      const context = formatSegmentsForContext(segments);

      expect(context).toContain('INTERVIEWER: How are you?');
      expect(context).toContain('ME: I am fine.');
    });
  });

  describe('Speaker Mapping', () => {
    it('should map Channel 0 to "interviewer"', async () => {
      const { TranscriptIngest } = await import('../../src/main/transcriptIngest');

      const ingest = new TranscriptIngest();
      const segments: { speaker: string }[] = [];

      ingest.on('segment', (segment: { speaker: string }) => {
        segments.push(segment);
      });

      // Simulate a Deepgram transcript from Channel 0
      const mockDeepgram = new EventEmitter();
      ingest.attachToDeepgram(mockDeepgram as any);

      mockDeepgram.emit('transcript', {
        type: 'Results',
        channel_index: [0],
        is_final: true,
        channel: {
          alternatives: [
            { transcript: 'Test message', confidence: 0.99, words: [] },
          ],
        },
      });

      expect(segments.length).toBe(1);
      expect(segments[0].speaker).toBe('interviewer');
    });

    it('should map Channel 1 to "me"', async () => {
      const { TranscriptIngest } = await import('../../src/main/transcriptIngest');

      const ingest = new TranscriptIngest();
      const segments: { speaker: string }[] = [];

      ingest.on('segment', (segment: { speaker: string }) => {
        segments.push(segment);
      });

      // Simulate a Deepgram transcript from Channel 1
      const mockDeepgram = new EventEmitter();
      ingest.attachToDeepgram(mockDeepgram as any);

      mockDeepgram.emit('transcript', {
        type: 'Results',
        channel_index: [1],
        is_final: true,
        channel: {
          alternatives: [
            { transcript: 'My response', confidence: 0.99, words: [] },
          ],
        },
      });

      expect(segments.length).toBe(1);
      expect(segments[0].speaker).toBe('me');
    });
  });

  describe('Event Emission', () => {
    it('should emit "segment" for final transcripts', async () => {
      const { TranscriptIngest } = await import('../../src/main/transcriptIngest');

      const ingest = new TranscriptIngest();
      const segments: unknown[] = [];

      ingest.on('segment', (segment) => {
        segments.push(segment);
      });

      const mockDeepgram = new EventEmitter();
      ingest.attachToDeepgram(mockDeepgram as any);

      mockDeepgram.emit('transcript', {
        type: 'Results',
        channel_index: [0],
        is_final: true,
        channel: {
          alternatives: [
            { transcript: 'Final message', confidence: 0.99, words: [] },
          ],
        },
      });

      expect(segments.length).toBe(1);
    });

    it('should emit "interim" for non-final transcripts', async () => {
      const { TranscriptIngest } = await import('../../src/main/transcriptIngest');

      const ingest = new TranscriptIngest();
      const interims: { text: string; speaker: string }[] = [];

      ingest.on('interim', (text: string, speaker: string) => {
        interims.push({ text, speaker });
      });

      const mockDeepgram = new EventEmitter();
      ingest.attachToDeepgram(mockDeepgram as any);

      mockDeepgram.emit('transcript', {
        type: 'Results',
        channel_index: [0],
        is_final: false,
        channel: {
          alternatives: [
            { transcript: 'Partial message...', confidence: 0.8, words: [] },
          ],
        },
      });

      expect(interims.length).toBe(1);
      expect(interims[0].text).toBe('Partial message...');
      expect(interims[0].speaker).toBe('interviewer');
    });

    it('should not emit for empty transcripts', async () => {
      const { TranscriptIngest } = await import('../../src/main/transcriptIngest');

      const ingest = new TranscriptIngest();
      const segments: unknown[] = [];
      const interims: unknown[] = [];

      ingest.on('segment', (segment) => segments.push(segment));
      ingest.on('interim', (text, speaker) => interims.push({ text, speaker }));

      const mockDeepgram = new EventEmitter();
      ingest.attachToDeepgram(mockDeepgram as any);

      mockDeepgram.emit('transcript', {
        type: 'Results',
        channel_index: [0],
        is_final: true,
        channel: {
          alternatives: [
            { transcript: '', confidence: 0.99, words: [] },
          ],
        },
      });

      mockDeepgram.emit('transcript', {
        type: 'Results',
        channel_index: [0],
        is_final: true,
        channel: {
          alternatives: [
            { transcript: '   ', confidence: 0.99, words: [] },
          ],
        },
      });

      expect(segments.length).toBe(0);
      expect(interims.length).toBe(0);
    });
  });

  describe('Manual Ingestion', () => {
    it('should support manual segment injection', async () => {
      const { TranscriptIngest } = await import('../../src/main/transcriptIngest');

      const ingest = new TranscriptIngest();
      const segments: { text: string; speaker: string }[] = [];

      ingest.on('segment', (segment: { text: string; speaker: string }) => {
        segments.push(segment);
      });

      ingest.ingestManual('Manual test message', 'me');

      expect(segments.length).toBe(1);
      expect(segments[0].text).toBe('Manual test message');
      expect(segments[0].speaker).toBe('me');
    });
  });

  describe('Attachment/Detachment', () => {
    it('should attach to Deepgram client', async () => {
      const { TranscriptIngest } = await import('../../src/main/transcriptIngest');

      const ingest = new TranscriptIngest();
      const mockDeepgram = new EventEmitter();

      ingest.attachToDeepgram(mockDeepgram as any);

      // Should have listener attached
      expect(mockDeepgram.listenerCount('transcript')).toBe(1);
    });

    it('should detach from Deepgram client', async () => {
      const { TranscriptIngest } = await import('../../src/main/transcriptIngest');

      const ingest = new TranscriptIngest();
      const mockDeepgram = new EventEmitter();

      ingest.attachToDeepgram(mockDeepgram as any);
      expect(mockDeepgram.listenerCount('transcript')).toBe(1);

      ingest.detach();
      expect(mockDeepgram.listenerCount('transcript')).toBe(0);
    });

    it('should handle re-attachment', async () => {
      const { TranscriptIngest } = await import('../../src/main/transcriptIngest');

      const ingest = new TranscriptIngest();
      const mockDeepgram1 = new EventEmitter();
      const mockDeepgram2 = new EventEmitter();

      ingest.attachToDeepgram(mockDeepgram1 as any);
      ingest.attachToDeepgram(mockDeepgram2 as any);

      // First should be detached
      expect(mockDeepgram1.listenerCount('transcript')).toBe(0);
      // Second should be attached
      expect(mockDeepgram2.listenerCount('transcript')).toBe(1);
    });
  });
});
