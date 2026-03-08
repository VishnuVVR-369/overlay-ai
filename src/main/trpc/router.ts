import { initTRPC } from '@trpc/server';
import { z } from 'zod';
import type {
  LiveModeStatus,
  AnswerData,
  AppStatus,
  LiveTranscriptData,
  ContextStats,
} from '../../lib/ipc';
import { createIdleAnswerData } from '../../lib/ipc';
import { ANSWER_FORMAT_MODES } from '../../lib/answerModes';
import { getDefaultContextBuffer } from '../contextBuffer';
import { isDeepgramConfigured } from '../deepgram';
import { isGroqConfiguredFromSettings } from '../settingsStore';

const t = initTRPC.create({ isServer: true });
export const router = t.router;
export const publicProcedure = t.procedure;

type InterimTranscript = { text: string; speaker: 'interviewer' | 'me' } | null;

let liveModeStatus: LiveModeStatus = { state: 'disconnected' };
let answerData: AnswerData = createIdleAnswerData();
let interimTranscript: InterimTranscript = null;

export function setLiveModeStatus(status: LiveModeStatus): void {
  liveModeStatus = status;
}

export function setAnswerData(data: AnswerData): void {
  answerData = data;
}

export function getAnswerData(): AnswerData {
  return answerData;
}

export function setInterimTranscript(data: InterimTranscript): void {
  interimTranscript = data;
}

export const appRouter = router({
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
      isGroqConfigured: isGroqConfiguredFromSettings(),
    };
  }),

  getRecentTranscript: publicProcedure
    .input(
      z.object({
        windowMs: z.number().optional().default(30000),
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

  getFullContext: publicProcedure.query(
    (): { context: string; stats: ContextStats } => {
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
    }
  ),

  startLiveMode: publicProcedure.mutation((): LiveModeStatus => {
    return liveModeStatus;
  }),

  stopLiveMode: publicProcedure.mutation((): LiveModeStatus => {
    return liveModeStatus;
  }),

  triggerAnswer: publicProcedure
    .input(
      z.object({
        modelId: z.string().optional(),
        mode: z.enum(ANSWER_FORMAT_MODES).optional(),
      })
    )
    .mutation((): AnswerData => {
      return answerData;
    }),

  clearOverlay: publicProcedure.mutation((): { success: boolean } => {
    const buffer = getDefaultContextBuffer();
    buffer.clear();
    answerData = createIdleAnswerData();
    interimTranscript = null;
    return { success: true };
  }),
});

export type AppRouter = typeof appRouter;
