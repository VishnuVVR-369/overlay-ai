/**
 * IPC Client - Renderer process communication with Main
 *
 * Per PLAN.md Phase 5:
 * Call main-process routes and subscribe to updates.
 */

import { createTRPCProxyClient } from '@trpc/client';
import { ipcLink } from 'electron-trpc/renderer';
import type { AppRouter } from '../main/trpc/router';
import {
  IPC_CHANNELS,
  type LiveModeStatus,
  type AnswerData,
  type AppStatus,
  type AppSettings,
  type LiveTranscriptData,
  type ContextStats,
  type IPCEvents,
} from '../lib/ipc';

// ============================================================================
// tRPC Client
// ============================================================================

/**
 * Type-safe tRPC client for calling main process
 */
export const trpc = createTRPCProxyClient<AppRouter>({
  links: [ipcLink()],
});

// ============================================================================
// Direct IPC Methods
// ============================================================================

// Type declaration for Electron's contextBridge exposed API
declare global {
  interface Window {
    electronAPI: {
      invoke: <T>(channel: string, data?: unknown) => Promise<T>;
      on: (channel: string, callback: (...args: unknown[]) => void) => void;
      removeAllListeners: (channel: string) => void;
    };
  }
}

/**
 * Start live mode (audio capture + Deepgram)
 */
export async function startLiveMode(): Promise<LiveModeStatus> {
  return window.electronAPI.invoke<LiveModeStatus>(IPC_CHANNELS.START_LIVE_MODE);
}

/**
 * Stop live mode
 */
export async function stopLiveMode(): Promise<LiveModeStatus> {
  return window.electronAPI.invoke<LiveModeStatus>(IPC_CHANNELS.STOP_LIVE_MODE);
}

/**
 * Toggle live mode
 */
export async function toggleLiveMode(): Promise<LiveModeStatus> {
  const status = await getStatus();
  if (status.liveMode.state === 'connected') {
    return stopLiveMode();
  } else {
    return startLiveMode();
  }
}

/**
 * Trigger answer generation
 */
export async function triggerAnswer(modelId?: string): Promise<AnswerData> {
  return window.electronAPI.invoke<AnswerData>(IPC_CHANNELS.TRIGGER_ANSWER, { modelId });
}

/**
 * Clear overlay (transcript and answer)
 */
export async function clearOverlay(): Promise<{ success: boolean }> {
  return window.electronAPI.invoke<{ success: boolean }>(IPC_CHANNELS.CLEAR_OVERLAY);
}

/**
 * Get current application status
 */
export async function getStatus(): Promise<AppStatus> {
  return window.electronAPI.invoke<AppStatus>(IPC_CHANNELS.GET_STATUS);
}

/**
 * Close the window
 */
export async function closeWindow(): Promise<{ success: boolean }> {
  return window.electronAPI.invoke<{ success: boolean }>(IPC_CHANNELS.CLOSE_WINDOW);
}

/**
 * Get current settings
 */
export async function getSettings(): Promise<AppSettings> {
  return window.electronAPI.invoke<AppSettings>(IPC_CHANNELS.GET_SETTINGS);
}

/**
 * Save settings
 */
export async function saveSettings(settings: Partial<AppSettings>): Promise<{ success: boolean }> {
  return window.electronAPI.invoke<{ success: boolean }>(IPC_CHANNELS.SAVE_SETTINGS, settings);
}

// ============================================================================
// tRPC Query Methods
// ============================================================================

/**
 * Get recent transcript via tRPC
 */
export async function getRecentTranscript(windowMs = 30000): Promise<LiveTranscriptData> {
  return trpc.getRecentTranscript.query({ windowMs });
}

/**
 * Get full context via tRPC
 */
export async function getFullContext(): Promise<{ context: string; stats: ContextStats }> {
  return trpc.getFullContext.query();
}

// ============================================================================
// Event Subscriptions
// ============================================================================

type EventCallback<K extends keyof IPCEvents> = (data: IPCEvents[K]) => void;

/**
 * Subscribe to live mode status changes
 */
export function onLiveModeChanged(callback: EventCallback<'liveModeChanged'>): () => void {
  window.electronAPI.on(IPC_CHANNELS.LIVE_MODE_CHANGED, callback as (...args: unknown[]) => void);
  return () => window.electronAPI.removeAllListeners(IPC_CHANNELS.LIVE_MODE_CHANGED);
}

/**
 * Subscribe to transcript segments
 */
export function onTranscriptSegment(callback: EventCallback<'transcriptSegment'>): () => void {
  window.electronAPI.on(IPC_CHANNELS.TRANSCRIPT_SEGMENT, callback as (...args: unknown[]) => void);
  return () => window.electronAPI.removeAllListeners(IPC_CHANNELS.TRANSCRIPT_SEGMENT);
}

/**
 * Subscribe to interim transcript updates
 */
export function onInterimTranscript(callback: EventCallback<'interimTranscript'>): () => void {
  window.electronAPI.on(IPC_CHANNELS.INTERIM_TRANSCRIPT, callback as (...args: unknown[]) => void);
  return () => window.electronAPI.removeAllListeners(IPC_CHANNELS.INTERIM_TRANSCRIPT);
}

/**
 * Subscribe to answer chunks (streaming)
 */
export function onAnswerChunk(callback: EventCallback<'answerChunk'>): () => void {
  window.electronAPI.on(IPC_CHANNELS.ANSWER_CHUNK, callback as (...args: unknown[]) => void);
  return () => window.electronAPI.removeAllListeners(IPC_CHANNELS.ANSWER_CHUNK);
}

/**
 * Subscribe to answer state changes
 */
export function onAnswerStateChanged(callback: EventCallback<'answerStateChanged'>): () => void {
  window.electronAPI.on(IPC_CHANNELS.ANSWER_STATE_CHANGED, callback as (...args: unknown[]) => void);
  return () => window.electronAPI.removeAllListeners(IPC_CHANNELS.ANSWER_STATE_CHANGED);
}

/**
 * Subscribe to errors
 */
export function onError(callback: EventCallback<'error'>): () => void {
  window.electronAPI.on(IPC_CHANNELS.ERROR, callback as (...args: unknown[]) => void);
  return () => window.electronAPI.removeAllListeners(IPC_CHANNELS.ERROR);
}

// ============================================================================
// Combined Subscription Helper
// ============================================================================

export interface IPCSubscriptions {
  liveModeChanged?: EventCallback<'liveModeChanged'>;
  transcriptSegment?: EventCallback<'transcriptSegment'>;
  interimTranscript?: EventCallback<'interimTranscript'>;
  answerChunk?: EventCallback<'answerChunk'>;
  answerStateChanged?: EventCallback<'answerStateChanged'>;
  error?: EventCallback<'error'>;
}

/**
 * Subscribe to multiple events at once
 * Returns cleanup function that removes all listeners
 */
export function subscribeToEvents(subscriptions: IPCSubscriptions): () => void {
  const cleanups: (() => void)[] = [];

  if (subscriptions.liveModeChanged) {
    cleanups.push(onLiveModeChanged(subscriptions.liveModeChanged));
  }
  if (subscriptions.transcriptSegment) {
    cleanups.push(onTranscriptSegment(subscriptions.transcriptSegment));
  }
  if (subscriptions.interimTranscript) {
    cleanups.push(onInterimTranscript(subscriptions.interimTranscript));
  }
  if (subscriptions.answerChunk) {
    cleanups.push(onAnswerChunk(subscriptions.answerChunk));
  }
  if (subscriptions.answerStateChanged) {
    cleanups.push(onAnswerStateChanged(subscriptions.answerStateChanged));
  }
  if (subscriptions.error) {
    cleanups.push(onError(subscriptions.error));
  }

  return () => {
    cleanups.forEach((cleanup) => cleanup());
  };
}
