import { ipcMain, BrowserWindow } from 'electron';
import { createIPCHandler } from 'electron-trpc/main';
import {
  IPC_CHANNELS,
  type LiveModeStatus,
  type AnswerData,
  type IPCEvents,
  type AppSettings,
  type SessionStats,
} from '../lib/ipc';
import type { TranscriptSegment, Speaker } from '../lib/transcript';
import {
  appRouter,
  setLiveModeStatus,
  setAnswerData,
  setInterimTranscript,
} from './trpc/router';
import { getDefaultContextBuffer } from './contextBuffer';
import { getDefaultGroqProvider, LLMError, resetGroqProvider } from './llm';
import {
  getDefaultLiveModeManager,
  disposeLiveModeManager,
  type LiveModeManager,
} from './liveMode';
import {
  getSettings,
  saveSettings,
  isDeepgramConfiguredFromSettings,
  isGroqConfiguredFromSettings,
  toggleMinimizeMode as toggleMinimizeModeInStore,
  isMinimizedMode as isMinimizedModeFromStore,
} from './settingsStore';
import { getSessionStatsManager, SessionStatsManager } from './sessionStats';

let mainWindow: BrowserWindow | null = null;
let liveModeManager: LiveModeManager | null = null;
let sessionStatsManager: SessionStatsManager | null = null;
let currentAnswerData: AnswerData = { state: 'idle', text: '' };

const WINDOW_DIMENSIONS = {
  minimized: { width: 280, height: 120 },
  normal: { width: 400, height: 450 },
} as const;

function sendToRenderer<K extends keyof IPCEvents>(
  channel: string,
  data: IPCEvents[K]
): void {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(channel, data);
  }
}

function sendError(message: string, code?: string): void {
  sendToRenderer<'error'>(IPC_CHANNELS.ERROR, { message, code });
}

function sendSessionStats(stats: SessionStats): void {
  sendToRenderer<'sessionStatsUpdated'>(
    IPC_CHANNELS.SESSION_STATS_UPDATED,
    stats
  );
}

function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function sendAnswerChunk(chunk: string, isComplete: boolean): void {
  sendToRenderer<'answerChunk'>(IPC_CHANNELS.ANSWER_CHUNK, {
    chunk,
    isComplete,
  });
}

function updateAnswerData(data: AnswerData): void {
  currentAnswerData = data;
  setAnswerData(data);
  sendToRenderer<'answerStateChanged'>(IPC_CHANNELS.ANSWER_STATE_CHANGED, data);
}

function initializeLiveModeManager(): void {
  liveModeManager = getDefaultLiveModeManager();
  sessionStatsManager = getSessionStatsManager();

  sessionStatsManager.on('statsUpdated', (stats: SessionStats) => {
    sendSessionStats(stats);
  });

  liveModeManager.on('stateChanged', (status: LiveModeStatus) => {
    setLiveModeStatus(status);
    sendToRenderer<'liveModeChanged'>(IPC_CHANNELS.LIVE_MODE_CHANGED, status);

    if (status.state === 'connected') {
      sessionStatsManager?.startSession();
    }
    // Don't end session on disconnect - stats persist until clearOverlay is called
  });

  liveModeManager.on('segment', (segment: TranscriptSegment) => {
    sendToRenderer<'transcriptSegment'>(
      IPC_CHANNELS.TRANSCRIPT_SEGMENT,
      segment
    );

    const wordCount = countWords(segment.text);
    if (wordCount > 0) {
      sessionStatsManager?.addWords(wordCount);
    }
  });

  liveModeManager.on('interim', (text: string, speaker: Speaker) => {
    setInterimTranscript({ text, speaker });
    sendToRenderer<'interimTranscript'>(IPC_CHANNELS.INTERIM_TRANSCRIPT, {
      text,
      speaker,
    });
  });

  liveModeManager.on('error', (error: Error) => {
    sendError(error.message, 'LIVE_MODE_ERROR');
  });
}

async function startLiveMode(): Promise<LiveModeStatus> {
  if (!liveModeManager) {
    initializeLiveModeManager();
  }
  return liveModeManager!.start();
}

function stopLiveMode(): LiveModeStatus {
  if (!liveModeManager) {
    return { state: 'disconnected' };
  }
  const status = liveModeManager.stop();
  setInterimTranscript(null);
  return status;
}

async function toggleLiveMode(): Promise<LiveModeStatus> {
  if (!liveModeManager) {
    initializeLiveModeManager();
  }
  return liveModeManager!.toggle();
}

async function triggerAnswer(modelId?: string): Promise<AnswerData> {
  const buffer = getDefaultContextBuffer();
  const context = buffer.getFullContext();

  if (!context) {
    const data: AnswerData = {
      state: 'error',
      text: '',
      error: 'No transcript context available',
    };
    updateAnswerData(data);
    return data;
  }

  if (!isGroqConfiguredFromSettings()) {
    const data: AnswerData = {
      state: 'error',
      text: '',
      error: 'GROQ_API_KEY not configured',
    };
    updateAnswerData(data);
    return data;
  }

  const provider = getDefaultGroqProvider();
  const effectiveModelId = modelId ?? provider.getDefaultModelId();

  updateAnswerData({
    state: 'generating',
    text: '',
    modelId: effectiveModelId,
  });

  try {
    const chunks: string[] = [];
    const { chunks: chunkGenerator, tokenUsage } =
      provider.streamResponseWithUsage(context, effectiveModelId);

    for await (const chunk of chunkGenerator) {
      chunks.push(chunk);
      sendAnswerChunk(chunk, false);
    }

    sendAnswerChunk('', true);

    try {
      const usage = await tokenUsage;
      sessionStatsManager?.addTokens(usage.inputTokens, usage.outputTokens);
    } catch {
      console.warn('[IPC] Failed to get token usage');
    }

    const data: AnswerData = {
      state: 'complete',
      text: chunks.join(''),
      modelId: effectiveModelId,
      generatedAt: Date.now(),
    };
    updateAnswerData(data);
    return data;
  } catch (error) {
    console.error('[IPC] LLM error:', error);

    let errorMessage = 'Unknown error';
    let errorCode: string | undefined;

    if (error instanceof LLMError) {
      errorMessage = error.message;
      errorCode = error.code;
    } else if (error instanceof Error) {
      errorMessage = error.message;
    }

    sendError(errorMessage, errorCode);

    const data: AnswerData = {
      state: 'error',
      text: '',
      error: errorMessage,
      modelId: effectiveModelId,
    };
    updateAnswerData(data);
    return data;
  }
}

function clearOverlay(): { success: boolean } {
  getDefaultContextBuffer().clear();
  setInterimTranscript(null);
  updateAnswerData({ state: 'idle', text: '' });
  sessionStatsManager?.reset();
  return { success: true };
}

function closeWindow(): { success: boolean } {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.close();
    return { success: true };
  }
  return { success: false };
}

function getAppStatus() {
  const buffer = getDefaultContextBuffer();
  const stats = buffer.getStats();

  return {
    liveMode: liveModeManager?.status ?? { state: 'disconnected' as const },
    answer: currentAnswerData,
    context: {
      segmentCount: stats.segmentCount,
      wordCount: stats.wordCount,
      estimatedTokens: stats.estimatedTokens,
      durationMs: stats.durationMs,
    },
    isDeepgramConfigured: isDeepgramConfiguredFromSettings(),
    isGroqConfigured: isGroqConfiguredFromSettings(),
    interviewMode: getSettings().interviewMode!,
  };
}

export function applyMinimizeMode(isMinimized: boolean): void {
  if (!mainWindow || mainWindow.isDestroyed()) return;

  const dimensions = isMinimized
    ? WINDOW_DIMENSIONS.minimized
    : WINDOW_DIMENSIONS.normal;
  mainWindow.setSize(dimensions.width, dimensions.height);
  mainWindow.center();
}

async function toggleMinimizeMode(): Promise<{ isMinimized: boolean }> {
  const isMinimized = toggleMinimizeModeInStore();
  applyMinimizeMode(isMinimized);
  sendToRenderer<'minimizeModeChanged'>(IPC_CHANNELS.MINIMIZE_MODE_CHANGED, {
    isMinimized,
  });
  return { isMinimized };
}

function handleSaveSettings(settings: Partial<AppSettings>): {
  success: boolean;
} {
  saveSettings(settings);
  resetGroqProvider();
  return { success: true };
}

export function initializeIPC(window: BrowserWindow): void {
  mainWindow = window;

  createIPCHandler({ router: appRouter, windows: [window] });

  ipcMain.handle(IPC_CHANNELS.START_LIVE_MODE, () => startLiveMode());
  ipcMain.handle(IPC_CHANNELS.STOP_LIVE_MODE, () => stopLiveMode());
  ipcMain.handle(
    IPC_CHANNELS.TRIGGER_ANSWER,
    (_event, { modelId }: { modelId?: string }) => triggerAnswer(modelId)
  );
  ipcMain.handle(IPC_CHANNELS.CLEAR_OVERLAY, () => clearOverlay());
  ipcMain.handle(IPC_CHANNELS.GET_STATUS, () => getAppStatus());
  ipcMain.handle(IPC_CHANNELS.CLOSE_WINDOW, () => closeWindow());
  ipcMain.handle(IPC_CHANNELS.GET_SETTINGS, (): AppSettings => getSettings());
  ipcMain.handle(
    IPC_CHANNELS.SAVE_SETTINGS,
    (_event, settings: Partial<AppSettings>) => handleSaveSettings(settings)
  );
  ipcMain.handle(IPC_CHANNELS.TOGGLE_MINIMIZE_MODE, () => toggleMinimizeMode());
}

export function cleanupIPC(): void {
  stopLiveMode();
  disposeLiveModeManager();
  liveModeManager = null;

  const handlers = [
    IPC_CHANNELS.START_LIVE_MODE,
    IPC_CHANNELS.STOP_LIVE_MODE,
    IPC_CHANNELS.TRIGGER_ANSWER,
    IPC_CHANNELS.CLEAR_OVERLAY,
    IPC_CHANNELS.GET_STATUS,
    IPC_CHANNELS.CLOSE_WINDOW,
    IPC_CHANNELS.GET_SETTINGS,
    IPC_CHANNELS.SAVE_SETTINGS,
    IPC_CHANNELS.TOGGLE_MINIMIZE_MODE,
  ];
  handlers.forEach((channel) => ipcMain.removeHandler(channel));

  mainWindow = null;
}

export {
  startLiveMode,
  stopLiveMode,
  toggleLiveMode,
  triggerAnswer,
  clearOverlay,
  closeWindow,
  toggleMinimizeMode,
  isMinimizedModeFromStore as isMinimized,
};
