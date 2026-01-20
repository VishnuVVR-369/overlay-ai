/**
 * IPC Handlers - Main process IPC implementation
 *
 * Per PLAN.md Phase 5:
 * Register handlers for audio start/stop, context retrieval, LLM trigger, and clear state.
 */

import { ipcMain, BrowserWindow } from 'electron';
import { createIPCHandler } from 'electron-trpc/main';
import {
  IPC_CHANNELS,
  type LiveModeStatus,
  type AnswerData,
  type IPCEvents,
  type AppSettings,
  type ChatState,
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
  toggleMinimizeMode,
  isMinimizedMode as isMinimizedModeFromStore,
} from './settingsStore';
import { getChatWindowManager } from './chatWindow';
import { getChatManager, destroyChatManager } from './chatManager';

// ============================================================================
// State Management
// ============================================================================

let mainWindow: BrowserWindow | null = null;
let liveModeManager: LiveModeManager | null = null;
let chatManagerInitialized = false;

// ============================================================================
// Event Emitters (Main → Renderer)
// ============================================================================

/**
 * Send event to renderer process
 */
function sendToRenderer<K extends keyof IPCEvents>(
  channel: string,
  data: IPCEvents[K]
): void {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(channel, data);
  }
}

/**
 * Update and broadcast answer data
 */
function updateAnswerData(data: AnswerData): void {
  setAnswerData(data);
  sendToRenderer<'answerStateChanged'>(IPC_CHANNELS.ANSWER_STATE_CHANGED, data);
}

/**
 * Send error to renderer
 */
function sendError(message: string, code?: string): void {
  sendToRenderer<'error'>(IPC_CHANNELS.ERROR, { message, code });
}

/**
 * Send streaming answer chunk to renderer
 */
function sendAnswerChunk(chunk: string, isComplete: boolean): void {
  sendToRenderer<'answerChunk'>(IPC_CHANNELS.ANSWER_CHUNK, {
    chunk,
    isComplete,
  });
}

// ============================================================================
// Chat Management
// ============================================================================

function initializeChatManager(): void {
  if (chatManagerInitialized) {
    return;
  }

  const chatManager = getChatManager();
  const chatWindowManager = getChatWindowManager();

  chatManager.on('stateChanged', (state: unknown) => {
    chatWindowManager.sendToRenderer(
      IPC_CHANNELS.CHAT_STATE_CHANGED,
      state as ChatState
    );
  });

  chatManager.on('responseChunk', (...args: unknown[]) => {
    const [messageId, chunk, isComplete] = args as [string, string, boolean];
    chatWindowManager.sendToRenderer(IPC_CHANNELS.CHAT_RESPONSE_CHUNK, {
      messageId,
      chunk,
      isComplete,
    });
  });

  chatManager.on(
    'responseChunk',
    (messageId: string, chunk: string, isComplete: boolean) => {
      chatWindowManager.sendToRenderer(IPC_CHANNELS.CHAT_RESPONSE_CHUNK, {
        messageId,
        chunk,
        isComplete,
      });
    }
  );

  chatManagerInitialized = true;
  console.log('[IPC] ChatManager initialized');
}

async function openChatWindow(): Promise<{ success: boolean }> {
  const chatWindowManager = getChatWindowManager();
  const { isOpen } = chatWindowManager.toggle();
  console.log('[IPC] Chat window toggled, isOpen:', isOpen);
  return { success: isOpen };
}

function closeChatWindow(): { success: boolean } {
  const chatWindowManager = getChatWindowManager();
  chatWindowManager.close();
  return { success: true };
}

async function sendChatMessage(
  message: string,
  includeTranscript: boolean
): Promise<{ success: boolean }> {
  initializeChatManager();
  const chatManager = getChatManager();
  const chatWindowManager = getChatWindowManager();

  const result = await chatManager.sendMessage(
    message,
    { includeTranscript },
    (channel, data) => chatWindowManager.sendToRenderer(channel, data)
  );

  return result;
}

function getChatHistory() {
  initializeChatManager();
  const chatManager = getChatManager();
  return chatManager.getHistory();
}

function clearChatHistory(): { success: boolean } {
  const chatManager = getChatManager();
  return chatManager.clearHistory();
}

// ============================================================================
// Live Mode Management (using LiveModeManager state machine)
// ============================================================================

/**
 * Initialize the LiveModeManager and wire up events
 */
function initializeLiveModeManager(): void {
  liveModeManager = getDefaultLiveModeManager();

  // Forward state changes to renderer
  liveModeManager.on('stateChanged', (status: LiveModeStatus) => {
    setLiveModeStatus(status);
    sendToRenderer<'liveModeChanged'>(IPC_CHANNELS.LIVE_MODE_CHANGED, status);
  });

  // Forward transcript segments to renderer
  liveModeManager.on('segment', (segment: TranscriptSegment) => {
    sendToRenderer<'transcriptSegment'>(
      IPC_CHANNELS.TRANSCRIPT_SEGMENT,
      segment
    );
  });

  // Forward interim transcripts to renderer
  liveModeManager.on('interim', (text: string, speaker: Speaker) => {
    setInterimTranscript({ text, speaker });
    sendToRenderer<'interimTranscript'>(IPC_CHANNELS.INTERIM_TRANSCRIPT, {
      text,
      speaker,
    });
  });

  // Forward errors to renderer
  liveModeManager.on('error', (error: Error) => {
    sendError(error.message, 'LIVE_MODE_ERROR');
  });

  console.log('[IPC] LiveModeManager initialized');
}

/**
 * Start live mode - connects audio engine and Deepgram
 * Uses the LiveModeManager state machine
 */
async function startLiveMode(): Promise<LiveModeStatus> {
  if (!liveModeManager) {
    initializeLiveModeManager();
  }
  return liveModeManager!.start();
}

/**
 * Stop live mode - disconnects audio engine and Deepgram
 * Uses the LiveModeManager state machine
 */
function stopLiveMode(): LiveModeStatus {
  if (!liveModeManager) {
    return { state: 'disconnected' };
  }

  const status = liveModeManager.stop();
  // Clear interim transcript when stopping
  setInterimTranscript(null);
  return status;
}

/**
 * Toggle live mode
 * Uses the LiveModeManager state machine
 */
async function toggleLiveMode(): Promise<LiveModeStatus> {
  if (!liveModeManager) {
    initializeLiveModeManager();
  }
  return liveModeManager!.toggle();
}

// ============================================================================
// Answer Generation
// ============================================================================

/**
 * Trigger answer generation using the LLM provider
 *
 * Per PLAN.md Phase 6:
 * - Calls ContextBuffer.getFullContext()
 * - Passes context to LLMProvider.streamResponse()
 * - Forwards streaming chunks to renderer via IPC
 */
async function triggerAnswer(modelId?: string): Promise<AnswerData> {
  const buffer = getDefaultContextBuffer();
  const context = buffer.getFullContext();

  // Validate context
  if (!context) {
    const data: AnswerData = {
      state: 'error',
      text: '',
      error: 'No transcript context available',
    };
    updateAnswerData(data);
    return data;
  }

  // Check Groq configuration
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

  console.log(`[IPC] Answer requested with model: ${effectiveModelId}`);
  console.log(`[IPC] Context length: ${context.length} chars`);

  // Update state to generating
  updateAnswerData({
    state: 'generating',
    text: '',
    modelId: effectiveModelId,
  });

  try {
    const chunks: string[] = [];

    // Stream response from LLM
    for await (const chunk of provider.streamResponse(
      context,
      effectiveModelId
    )) {
      chunks.push(chunk);
      // Send each chunk to renderer for real-time display
      sendAnswerChunk(chunk, false);
    }

    // Send final completion signal
    sendAnswerChunk('', true);

    const fullText = chunks.join('');
    const data: AnswerData = {
      state: 'complete',
      text: fullText,
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

// ============================================================================
// Clear Overlay
// ============================================================================

/**
 * Clear all overlay state
 */
function clearOverlay(): { success: boolean } {
  getDefaultContextBuffer().clear();
  setInterimTranscript(null);
  updateAnswerData({ state: 'idle', text: '' });
  return { success: true };
}

/**
 * Close the window
 */
function closeWindow(): { success: boolean } {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.close();
    return { success: true };
  }
  return { success: false };
}

// ============================================================================
// Minimize Mode
// ============================================================================

/**
 * Dimensions for minimized mode
 */
const MINIMIZED_DIMENSIONS = {
  width: 280,
  height: 120,
};

const NORMAL_DIMENSIONS = {
  width: 500,
  height: 500,
};

/**
 * Apply minimized or normal window size
 */
function applyMinimizeMode(isMinimized: boolean): void {
  if (!mainWindow || mainWindow.isDestroyed()) {
    return;
  }

  const dimensions = isMinimized ? MINIMIZED_DIMENSIONS : NORMAL_DIMENSIONS;

  mainWindow.setSize(dimensions.width, dimensions.height);
  mainWindow.center();
}

/**
 * Toggle minimize mode
 */
async function toggleMinimizeModeWrapper(): Promise<{ isMinimized: boolean }> {
  const isMinimized = toggleMinimizeMode();
  applyMinimizeMode(isMinimized);

  sendToRenderer<'minimizeModeChanged'>(IPC_CHANNELS.MINIMIZE_MODE_CHANGED, {
    isMinimized,
  });

  return { isMinimized };
}

// ============================================================================
// IPC Registration
// ============================================================================

/**
 * Initialize IPC handlers
 * Call this from the main process after creating the BrowserWindow
 */
export function initializeIPC(window: BrowserWindow): void {
  mainWindow = window;

  // Set up electron-trpc handler
  createIPCHandler({
    router: appRouter,
    windows: [window],
  });

  // Register direct IPC handlers for commands that need async handling
  ipcMain.handle(IPC_CHANNELS.START_LIVE_MODE, async () => {
    return startLiveMode();
  });

  ipcMain.handle(IPC_CHANNELS.STOP_LIVE_MODE, () => {
    return stopLiveMode();
  });

  ipcMain.handle(
    IPC_CHANNELS.TRIGGER_ANSWER,
    async (_event, { modelId }: { modelId?: string }) => {
      return triggerAnswer(modelId);
    }
  );

  ipcMain.handle(IPC_CHANNELS.CLEAR_OVERLAY, () => {
    return clearOverlay();
  });

  ipcMain.handle(IPC_CHANNELS.GET_STATUS, () => {
    const buffer = getDefaultContextBuffer();
    const stats = buffer.getStats();

    return {
      liveMode: liveModeManager?.status ?? { state: 'disconnected' },
      answer: { state: 'idle', text: '' },
      context: {
        segmentCount: stats.segmentCount,
        wordCount: stats.wordCount,
        estimatedTokens: stats.estimatedTokens,
        durationMs: stats.durationMs,
      },
      isDeepgramConfigured: isDeepgramConfiguredFromSettings(),
      isGroqConfigured: isGroqConfiguredFromSettings(),
    };
  });

  ipcMain.handle(IPC_CHANNELS.CLOSE_WINDOW, () => {
    return closeWindow();
  });

  ipcMain.handle(IPC_CHANNELS.GET_SETTINGS, (): AppSettings => {
    return getSettings();
  });

  ipcMain.handle(
    IPC_CHANNELS.SAVE_SETTINGS,
    (_event, settings: Partial<AppSettings>) => {
      saveSettings(settings);
      // Reset Groq provider to pick up new API key
      resetGroqProvider();
      return { success: true };
    }
  );

  ipcMain.handle(IPC_CHANNELS.TOGGLE_MINIMIZE_MODE, async () => {
    return toggleMinimizeModeWrapper();
  });

  // Chat handlers

  ipcMain.handle(IPC_CHANNELS.OPEN_CHAT_WINDOW, async () => {
    return openChatWindow();
  });

  ipcMain.handle(IPC_CHANNELS.CLOSE_CHAT_WINDOW, () => {
    return closeChatWindow();
  });

  ipcMain.handle(
    IPC_CHANNELS.SEND_CHAT_MESSAGE,
    async (_event, { message, includeTranscript }) => {
      return sendChatMessage(message, includeTranscript);
    }
  );

  ipcMain.handle(IPC_CHANNELS.GET_CHAT_HISTORY, () => {
    return getChatHistory();
  });

  ipcMain.handle(IPC_CHANNELS.CLEAR_CHAT_HISTORY, () => {
    return clearChatHistory();
  });

  console.log('[IPC] Handlers initialized');
}

/**
 * Clean up IPC handlers
 * Call this when the app is closing
 */
export function cleanupIPC(): void {
  // Stop and dispose LiveModeManager
  stopLiveMode();
  disposeLiveModeManager();
  liveModeManager = null;

  // Clean up chat
  destroyChatManager();
  chatManagerInitialized = false;

  ipcMain.removeHandler(IPC_CHANNELS.START_LIVE_MODE);
  ipcMain.removeHandler(IPC_CHANNELS.STOP_LIVE_MODE);
  ipcMain.removeHandler(IPC_CHANNELS.TRIGGER_ANSWER);
  ipcMain.removeHandler(IPC_CHANNELS.CLEAR_OVERLAY);
  ipcMain.removeHandler(IPC_CHANNELS.GET_STATUS);
  ipcMain.removeHandler(IPC_CHANNELS.CLOSE_WINDOW);
  ipcMain.removeHandler(IPC_CHANNELS.GET_SETTINGS);
  ipcMain.removeHandler(IPC_CHANNELS.SAVE_SETTINGS);
  ipcMain.removeHandler(IPC_CHANNELS.TOGGLE_MINIMIZE_MODE);
  ipcMain.removeHandler(IPC_CHANNELS.OPEN_CHAT_WINDOW);
  ipcMain.removeHandler(IPC_CHANNELS.CLOSE_CHAT_WINDOW);
  ipcMain.removeHandler(IPC_CHANNELS.SEND_CHAT_MESSAGE);
  ipcMain.removeHandler(IPC_CHANNELS.GET_CHAT_HISTORY);
  ipcMain.removeHandler(IPC_CHANNELS.CLEAR_CHAT_HISTORY);

  mainWindow = null;
  console.log('[IPC] Handlers cleaned up');
}

// Export for use in main process
export {
  startLiveMode,
  stopLiveMode,
  toggleLiveMode,
  triggerAnswer,
  clearOverlay,
  closeWindow,
  toggleMinimizeModeWrapper as toggleMinimizeMode,
  applyMinimizeMode,
  isMinimizedModeFromStore as isMinimized,
  openChatWindow,
};
