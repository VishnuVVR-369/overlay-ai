/**
 * tRPC Router - Type-safe IPC between Main and Renderer
 *
 * Per PLAN.md Phase 5:
 * Use electron-trpc for type-safe IPC communication.
 */
import { initTRPC } from '@trpc/server';
import { z } from 'zod';
import type {
  LiveModeStatus,
  AnswerData,
  AppStatus,
  LiveTranscriptData,
  ContextStats,
} from '../../lib/ipc';
import { getDefaultContextBuffer } from '../contextBuffer';
import { isDeepgramConfigured } from '../deepgram';

// ============================================================================
// tRPC Initialization
// ============================================================================

const t = initTRPC.create({
  isServer: true,
});

export const router = t.router;
export const publicProcedure = t.procedure;

// ============================================================================
// App State (managed by IPC handlers)
// ============================================================================

// These will be set by the IPC module
let liveModeStatus: LiveModeStatus = { state: 'disconnected' };
let answerData: AnswerData = { state: 'idle', text: '' };
let interimTranscript: { text: string; speaker: 'interviewer' | 'me' } | null = null;

// State setters (called from ipc.ts)
export function setLiveModeStatus(status: LiveModeStatus): void {
  liveModeStatus = status;
}

export function setAnswerData(data: AnswerData): void {
  answerData = data;
}

export function setInterimTranscript(data: { text: string; speaker: 'interviewer' | 'me' } | null): void {
  interimTranscript = data;
}

// ============================================================================
// API Key Configuration Check
// ============================================================================

function isGroqConfigured(): boolean {
  return !!process.env.GROQ_API_KEY;
}

// ============================================================================
// tRPC Router Definition
// ============================================================================

export const appRouter = router({
  /**
   * Get current application status
   */
  getStatus: publicProcedure.query((): AppStatus => {
    const buffer = getDefaultContextBuffer();
    const stats = buffer.getStats();

    return {
      liveMode: liveModeStatus,
      answer: answerData,
      context: {
        segmentCount: stats.segmentCount,
        wordCount: stats.wordCount,
        estimatedTokens: stats.estimatedTokens,
        durationMs: stats.durationMs,
      },
      isDeepgramConfigured: isDeepgramConfigured(),
      isGroqConfigured: isGroqConfigured(),
    };
  }),

  /**
   * Get recent transcript for live display
   * Per PLAN.md: ~30 seconds for LiveTranscript component
   */
  getRecentTranscript: publicProcedure
    .input(
      z.object({
        windowMs: z.number().optional().default(30000), // 30 seconds default
      })
    )
    .query(({ input }): LiveTranscriptData => {
      const buffer = getDefaultContextBuffer();
      const segments = buffer.getRecentSegments(input.windowMs);

      return {
        segments,
        interimText: interimTranscript?.text,
        interimSpeaker: interimTranscript?.speaker,
      };
    }),

  /**
   * Get full context (for debugging or manual inspection)
   */
  getFullContext: publicProcedure.query((): { context: string; stats: ContextStats } => {
    const buffer = getDefaultContextBuffer();
    const stats = buffer.getStats();

    return {
      context: buffer.getFullContext(),
      stats: {
        segmentCount: stats.segmentCount,
        wordCount: stats.wordCount,
        estimatedTokens: stats.estimatedTokens,
        durationMs: stats.durationMs,
      },
    };
  }),

  /**
   * Start live mode
   * Note: Actual implementation in ipc.ts - this just returns current status
   */
  startLiveMode: publicProcedure.mutation((): LiveModeStatus => {
    // The actual start logic is handled via IPC events in ipc.ts
    // This endpoint triggers the start and returns the current status
    return liveModeStatus;
  }),

  /**
   * Stop live mode
   * Note: Actual implementation in ipc.ts - this just returns current status
   */
  stopLiveMode: publicProcedure.mutation((): LiveModeStatus => {
    // The actual stop logic is handled via IPC events in ipc.ts
    return liveModeStatus;
  }),

  /**
   * Trigger answer generation
   */
  triggerAnswer: publicProcedure
    .input(
      z.object({
        modelId: z.string().optional(),
      })
    )
    .mutation(({ input }): AnswerData => {
      // The actual generation is handled via IPC events in ipc.ts
      return answerData;
    }),

  /**
   * Clear overlay (transcript and answer)
   */
  clearOverlay: publicProcedure.mutation((): { success: boolean } => {
    const buffer = getDefaultContextBuffer();
    buffer.clear();
    answerData = { state: 'idle', text: '' };
    interimTranscript = null;
    return { success: true };
  }),
});

// Export router type for client
export type AppRouter = typeof appRouter;
