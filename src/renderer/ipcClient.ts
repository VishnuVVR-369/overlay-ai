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

export const trpc = createTRPCProxyClient<AppRouter>({
  links: [ipcLink()],
});

declare global {
  interface Window {
    electronAPI: {
      invoke: <T>(channel: string, data?: unknown) => Promise<T>;
      on: (channel: string, callback: (...args: unknown[]) => void) => void;
      removeAllListeners: (channel: string) => void;
    };
  }
}

export async function startLiveMode(): Promise<LiveModeStatus> {
  return window.electronAPI.invoke<LiveModeStatus>(
    IPC_CHANNELS.START_LIVE_MODE
  );
}

export async function stopLiveMode(): Promise<LiveModeStatus> {
  return window.electronAPI.invoke<LiveModeStatus>(IPC_CHANNELS.STOP_LIVE_MODE);
}

export async function toggleLiveMode(): Promise<LiveModeStatus> {
  const status = await getStatus();
  if (status.liveMode.state === 'connected') {
    return stopLiveMode();
  } else {
    return startLiveMode();
  }
}

export async function triggerAnswer(modelId?: string): Promise<AnswerData> {
  return window.electronAPI.invoke<AnswerData>(IPC_CHANNELS.TRIGGER_ANSWER, {
    modelId,
  });
}

export async function clearOverlay(): Promise<{ success: boolean }> {
  return window.electronAPI.invoke<{ success: boolean }>(
    IPC_CHANNELS.CLEAR_OVERLAY
  );
}

export async function getStatus(): Promise<AppStatus> {
  return window.electronAPI.invoke<AppStatus>(IPC_CHANNELS.GET_STATUS);
}

export async function closeWindow(): Promise<{ success: boolean }> {
  return window.electronAPI.invoke<{ success: boolean }>(
    IPC_CHANNELS.CLOSE_WINDOW
  );
}

export async function getSettings(): Promise<AppSettings> {
  return window.electronAPI.invoke<AppSettings>(IPC_CHANNELS.GET_SETTINGS);
}

export async function saveSettings(
  settings: Partial<AppSettings>
): Promise<{ success: boolean }> {
  return window.electronAPI.invoke<{ success: boolean }>(
    IPC_CHANNELS.SAVE_SETTINGS,
    settings
  );
}

export async function toggleMinimizeMode(): Promise<{ isMinimized: boolean }> {
  return window.electronAPI.invoke<{ isMinimized: boolean }>(
    IPC_CHANNELS.TOGGLE_MINIMIZE_MODE
  );
}

export async function getRecentTranscript(
  windowMs = 30000
): Promise<LiveTranscriptData> {
  return trpc.getRecentTranscript.query({ windowMs });
}

export async function getFullContext(): Promise<{
  context: string;
  stats: ContextStats;
}> {
  return trpc.getFullContext.query();
}

type EventCallback<K extends keyof IPCEvents> = (data: IPCEvents[K]) => void;

export function onLiveModeChanged(
  callback: EventCallback<'liveModeChanged'>
): () => void {
  window.electronAPI.on(
    IPC_CHANNELS.LIVE_MODE_CHANGED,
    callback as (...args: unknown[]) => void
  );
  return () =>
    window.electronAPI.removeAllListeners(IPC_CHANNELS.LIVE_MODE_CHANGED);
}

export function onTranscriptSegment(
  callback: EventCallback<'transcriptSegment'>
): () => void {
  window.electronAPI.on(
    IPC_CHANNELS.TRANSCRIPT_SEGMENT,
    callback as (...args: unknown[]) => void
  );
  return () =>
    window.electronAPI.removeAllListeners(IPC_CHANNELS.TRANSCRIPT_SEGMENT);
}

export function onInterimTranscript(
  callback: EventCallback<'interimTranscript'>
): () => void {
  window.electronAPI.on(
    IPC_CHANNELS.INTERIM_TRANSCRIPT,
    callback as (...args: unknown[]) => void
  );
  return () =>
    window.electronAPI.removeAllListeners(IPC_CHANNELS.INTERIM_TRANSCRIPT);
}

export function onAnswerChunk(
  callback: EventCallback<'answerChunk'>
): () => void {
  window.electronAPI.on(
    IPC_CHANNELS.ANSWER_CHUNK,
    callback as (...args: unknown[]) => void
  );
  return () => window.electronAPI.removeAllListeners(IPC_CHANNELS.ANSWER_CHUNK);
}

export function onAnswerStateChanged(
  callback: EventCallback<'answerStateChanged'>
): () => void {
  window.electronAPI.on(
    IPC_CHANNELS.ANSWER_STATE_CHANGED,
    callback as (...args: unknown[]) => void
  );
  return () =>
    window.electronAPI.removeAllListeners(IPC_CHANNELS.ANSWER_STATE_CHANGED);
}

export function onError(callback: EventCallback<'error'>): () => void {
  window.electronAPI.on(
    IPC_CHANNELS.ERROR,
    callback as (...args: unknown[]) => void
  );
  return () => window.electronAPI.removeAllListeners(IPC_CHANNELS.ERROR);
}

export function onMinimizeModeChanged(
  callback: EventCallback<'minimizeModeChanged'>
): () => void {
  window.electronAPI.on(
    IPC_CHANNELS.MINIMIZE_MODE_CHANGED,
    callback as (...args: unknown[]) => void
  );
  return () =>
    window.electronAPI.removeAllListeners(IPC_CHANNELS.MINIMIZE_MODE_CHANGED);
}

export interface IPCSubscriptions {
  liveModeChanged?: EventCallback<'liveModeChanged'>;
  transcriptSegment?: EventCallback<'transcriptSegment'>;
  interimTranscript?: EventCallback<'interimTranscript'>;
  answerChunk?: EventCallback<'answerChunk'>;
  answerStateChanged?: EventCallback<'answerStateChanged'>;
  error?: EventCallback<'error'>;
  minimizeModeChanged?: EventCallback<'minimizeModeChanged'>;
}

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
  if (subscriptions.minimizeModeChanged) {
    cleanups.push(onMinimizeModeChanged(subscriptions.minimizeModeChanged));
  }

  return () => {
    cleanups.forEach((cleanup) => cleanup());
  };
}
