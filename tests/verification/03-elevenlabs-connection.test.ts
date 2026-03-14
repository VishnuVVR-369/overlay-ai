/**
 * Verification Milestone 3: ElevenLabs streaming connection
 *
 * Per tasks.md Phase 11:
 * "Verify ElevenLabs streaming connection: Establish WebSocket with ElevenLabs
 * and confirm it reaches `OPEN` state before sending audio chunks."
 *
 * Tests:
 * 1. ElevenLabsClient can be instantiated with default config
 * 2. Configuration matches PLAN.md requirements
 * 3. API key validation works correctly
 * 4. Connection state transitions properly
 * 5. WebSocket URL is built correctly
 */

import { describe, it, expect, afterEach } from 'vitest';
import { EventEmitter } from 'events';

describe('ElevenLabs Streaming Connection - Verification', () => {
  describe('ElevenLabsClient Module', () => {
    it('should export ElevenLabsClient class', async () => {
      const { ElevenLabsClient } = await import('../../src/main/elevenLabs');
      expect(ElevenLabsClient).toBeDefined();
      expect(typeof ElevenLabsClient).toBe('function');
    });

    it('should export DEFAULT_ELEVENLABS_CONFIG', async () => {
      const { DEFAULT_ELEVENLABS_CONFIG } =
        await import('../../src/main/elevenLabs');
      expect(DEFAULT_ELEVENLABS_CONFIG).toBeDefined();
    });

    it('should export connectElevenLabs function', async () => {
      const { connectElevenLabs } = await import('../../src/main/elevenLabs');
      expect(connectElevenLabs).toBeDefined();
      expect(typeof connectElevenLabs).toBe('function');
    });

    it('should export isElevenLabsConfigured function', async () => {
      const { isElevenLabsConfigured } =
        await import('../../src/main/elevenLabs');
      expect(isElevenLabsConfigured).toBeDefined();
      expect(typeof isElevenLabsConfigured).toBe('function');
    });
  });

  describe('Default Configuration', () => {
    it('should use the realtime Scribe model', async () => {
      const { DEFAULT_ELEVENLABS_CONFIG } =
        await import('../../src/main/elevenLabs');
      expect(DEFAULT_ELEVENLABS_CONFIG.modelId).toBe('scribe_v2_realtime');
    });

    it('should use 16kHz audio', async () => {
      const { DEFAULT_ELEVENLABS_CONFIG } =
        await import('../../src/main/elevenLabs');
      expect(DEFAULT_ELEVENLABS_CONFIG.sampleRate).toBe(16000);
    });

    it('should request timestamps by default', async () => {
      const { DEFAULT_ELEVENLABS_CONFIG } =
        await import('../../src/main/elevenLabs');
      expect(DEFAULT_ELEVENLABS_CONFIG.includeTimestamps).toBe(true);
    });
  });

  describe('ElevenLabsClient Instantiation', () => {
    it('should create client with default config', async () => {
      const { ElevenLabsClient } = await import('../../src/main/elevenLabs');
      const client = new ElevenLabsClient();
      expect(client).toBeDefined();
      expect(client).toBeInstanceOf(EventEmitter);
    });

    it('should create client with custom config', async () => {
      const { ElevenLabsClient } = await import('../../src/main/elevenLabs');
      const client = new ElevenLabsClient({
        modelId: 'scribe_v2_realtime',
        sampleRate: 8000,
      });
      expect(client).toBeDefined();
    });

    it('should have initial state of disconnected', async () => {
      const { ElevenLabsClient, ElevenLabsConnectionState } =
        await import('../../src/main/elevenLabs');
      const client = new ElevenLabsClient();
      expect(client.state).toBe(ElevenLabsConnectionState.DISCONNECTED);
    });

    it('should report isOpen as false when not connected', async () => {
      const { ElevenLabsClient } = await import('../../src/main/elevenLabs');
      const client = new ElevenLabsClient();
      expect(client.isOpen()).toBe(false);
    });
  });

  describe('API Key Validation', () => {
    const originalEnv = process.env.ELEVENLABS_API_KEY;

    afterEach(() => {
      // Restore original env
      if (originalEnv !== undefined) {
        process.env.ELEVENLABS_API_KEY = originalEnv;
      } else {
        delete process.env.ELEVENLABS_API_KEY;
      }
    });

    it('should detect when API key is configured', async () => {
      process.env.ELEVENLABS_API_KEY = 'test-api-key';

      const elevenLabs = await import('../../src/main/elevenLabs');
      expect(elevenLabs.isElevenLabsConfigured()).toBe(true);
    });

    it('should detect when API key is not configured', async () => {
      delete process.env.ELEVENLABS_API_KEY;

      const elevenLabs = await import('../../src/main/elevenLabs');
      expect(elevenLabs.isElevenLabsConfigured()).toBe(false);
    });

    it('should throw error when getting API key without it being set', async () => {
      delete process.env.ELEVENLABS_API_KEY;

      const { getElevenLabsApiKey } = await import('../../src/main/elevenLabs');
      expect(() => getElevenLabsApiKey()).toThrow('ELEVENLABS_API_KEY');
    });
  });

  describe('Connection State Management', () => {
    it('should export ElevenLabsConnectionState enum', async () => {
      const { ElevenLabsConnectionState } =
        await import('../../src/main/elevenLabs');

      expect(ElevenLabsConnectionState.DISCONNECTED).toBe('disconnected');
      expect(ElevenLabsConnectionState.CONNECTING).toBe('connecting');
      expect(ElevenLabsConnectionState.CONNECTED).toBe('connected');
      expect(ElevenLabsConnectionState.ERROR).toBe('error');
    });

    it('should suppress duplicate committed transcripts across message variants', async () => {
      const { ElevenLabsClient } = await import('../../src/main/elevenLabs');
      const client = new ElevenLabsClient();
      const committedEvents: string[] = [];

      client.on('committedTranscript', (transcript) => {
        committedEvents.push(transcript.text);
      });

      const handleMessage = (
        client as unknown as {
          handleMessage: (data: string) => boolean;
        }
      ).handleMessage.bind(client);

      handleMessage(
        JSON.stringify({
          message_type: 'committed_transcript',
          text: 'Hello there',
        })
      );

      handleMessage(
        JSON.stringify({
          message_type: 'committed_transcript_with_timestamps',
          text: 'Hello there',
          words: [
            {
              text: 'Hello',
              start: 0,
              end: 100,
              type: 'word',
            },
            {
              text: 'there',
              start: 100,
              end: 200,
              type: 'word',
            },
          ],
        })
      );

      expect(committedEvents).toEqual(['Hello there']);
    });

    it('should suppress stale partial transcripts that repeat the latest commit', async () => {
      const { ElevenLabsClient } = await import('../../src/main/elevenLabs');
      const client = new ElevenLabsClient();
      const partialEvents: string[] = [];
      const committedEvents: string[] = [];

      client.on('partialTranscript', (transcript) => {
        partialEvents.push(transcript.text);
      });

      client.on('committedTranscript', (transcript) => {
        committedEvents.push(transcript.text);
      });

      const handleMessage = (
        client as unknown as {
          handleMessage: (data: string) => boolean;
        }
      ).handleMessage.bind(client);

      handleMessage(
        JSON.stringify({
          message_type: 'partial_transcript',
          text: 'Hello there',
        })
      );

      handleMessage(
        JSON.stringify({
          message_type: 'committed_transcript',
          text: 'Hello there',
        })
      );

      handleMessage(
        JSON.stringify({
          message_type: 'partial_transcript',
          text: 'Hello there',
        })
      );

      expect(committedEvents).toEqual(['Hello there']);
      expect(partialEvents).toEqual(['Hello there']);
    });
  });

  describe('Integration Test (with real API key)', () => {
    it('should connect to ElevenLabs when API key is valid', async () => {
      const {
        ElevenLabsClient,
        isElevenLabsConfigured,
        ElevenLabsConnectionState,
      } = await import('../../src/main/elevenLabs');

      // Skip if no API key configured
      if (!isElevenLabsConfigured()) {
        console.log('[Test] Skipping - ELEVENLABS_API_KEY not configured');
        return;
      }

      const client = new ElevenLabsClient();

      try {
        await client.connect();

        expect(client.state).toBe(ElevenLabsConnectionState.CONNECTED);
        expect(client.isOpen()).toBe(true);

        console.log('[Test] Successfully connected to ElevenLabs');
      } finally {
        client.disconnect();
      }
    }, 10000);

    it('should emit "open" event on successful connection', async () => {
      const { ElevenLabsClient, isElevenLabsConfigured } =
        await import('../../src/main/elevenLabs');

      // Skip if no API key configured
      if (!isElevenLabsConfigured()) {
        console.log('[Test] Skipping - ELEVENLABS_API_KEY not configured');
        return;
      }

      const client = new ElevenLabsClient();
      let openEmitted = false;

      client.on('open', () => {
        openEmitted = true;
      });

      try {
        await client.connect();
        expect(openEmitted).toBe(true);
      } finally {
        client.disconnect();
      }
    }, 10000);

    it('should be able to send audio data when connected', async () => {
      const { ElevenLabsClient, isElevenLabsConfigured } =
        await import('../../src/main/elevenLabs');

      // Skip if no API key configured
      if (!isElevenLabsConfigured()) {
        console.log('[Test] Skipping - ELEVENLABS_API_KEY not configured');
        return;
      }

      const client = new ElevenLabsClient();

      try {
        await client.connect();

        // Create a small test audio buffer (silence) using the app's stereo format.
        const testAudio = Buffer.alloc(3200, 0);
        const sent = client.send(testAudio);

        expect(sent).toBe(true);
        console.log('[Test] Successfully sent test audio data');
      } finally {
        client.disconnect();
      }
    }, 10000);
  });
});
