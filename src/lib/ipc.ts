/**
 * IPC Contract Types - Type-safe communication between Main and Renderer
 *
 * Per PLAN.md Phase 5:
 * Define request/response types for:
 * - Start/stop live mode
 * - Trigger answer
 * - Clear overlay
 * - Read current status
 */

import type { TranscriptSegment, Speaker } from './transcript';
import type { ChatMessage, ChatState, SendMessageOptions } from './chat';

// ============================================================================
// Live Mode Types
// ============================================================================

/**
 * Live mode connection states
 * Per PLAN.md Phase 9: disconnected → connecting → connected → error
 */
export type LiveModeState =
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'error';

/**
 * Live mode status information
 */
export interface LiveModeStatus {
  state: LiveModeState;
  error?: string;
  connectedAt?: number;
}

// ============================================================================
// Transcript Types
// ============================================================================

/**
 * Recent transcript for live display
 * Per PLAN.md: Show ~30 seconds of transcript in LiveTranscript component
 */
export interface LiveTranscriptData {
  segments: TranscriptSegment[];
  interimText?: string;
  interimSpeaker?: Speaker;
}

// ============================================================================
// Answer Types
// ============================================================================

/**
 * Answer generation status
 */
export type AnswerState = 'idle' | 'generating' | 'complete' | 'error';

/**
 * Answer response data
 */
export interface AnswerData {
  state: AnswerState;
  text: string;
  error?: string;
  modelId?: string;
  generatedAt?: number;
}

// ============================================================================
// Context Buffer Stats
// ============================================================================

/**
 * Context buffer statistics for UI display
 */
export interface ContextStats {
  segmentCount: number;
  wordCount: number;
  estimatedTokens: number;
  durationMs: number;
}

// ============================================================================
// Overall App Status
// ============================================================================

/**
 * Complete application status
 */
export interface AppStatus {
  liveMode: LiveModeStatus;
  answer: AnswerData;
  context: ContextStats;
  isDeepgramConfigured: boolean;
  isGroqConfigured: boolean;
}

// ============================================================================
// Settings Types
// ============================================================================

/**
 * API key settings for external services
 */
export interface ApiKeySettings {
  deepgramApiKey?: string;
  groqApiKey?: string;
}

/**
 * Complete app settings
 */
export interface AppSettings extends ApiKeySettings {
  customSystemPrompt?: string;
  isMinimized?: boolean;
}

// ============================================================================
// IPC Method Types
// ============================================================================

/**
 * Input types for IPC methods
 */
export interface IPCInputs {
  /** Start live mode (no input required) */
  startLiveMode: void;

  /** Stop live mode (no input required) */
  stopLiveMode: void;

  /** Trigger answer generation */
  triggerAnswer: {
    modelId?: string;
  };

  /** Clear overlay (transcript and answer) */
  clearOverlay: void;

  /** Get current status */
  getStatus: void;

  /** Get recent transcript for live display */
  getRecentTranscript: {
    windowMs?: number; // Default: 30000 (30 seconds)
  };

  /** Get full context (for debugging) */
  getFullContext: void;

  /** Close the window */
  closeWindow: void;

  /** Get settings */
  getSettings: void;

  /** Save settings */
  saveSettings: Partial<AppSettings>;

  /** Toggle minimize mode */
  toggleMinimizeMode: void;

  // Chat methods

  /** Open chat window */
  openChatWindow: void;

  /** Close chat window */
  closeChatWindow: void;

  /** Send chat message */
  sendChatMessage: {
    message: string;
    includeTranscript: boolean;
  };

  /** Get chat history */
  getChatHistory: void;

  /** Clear chat history */
  clearChatHistory: void;
}

/**
 * Output types for IPC methods
 */
export interface IPCOutputs {
  startLiveMode: LiveModeStatus;
  stopLiveMode: LiveModeStatus;
  triggerAnswer: AnswerData;
  clearOverlay: { success: boolean };
  getStatus: AppStatus;
  getRecentTranscript: LiveTranscriptData;
  getFullContext: { context: string; stats: ContextStats };
  closeWindow: { success: boolean };
  getSettings: AppSettings;
  saveSettings: { success: boolean };
  toggleMinimizeMode: { isMinimized: boolean };

  // Chat outputs

  openChatWindow: { success: boolean };
  closeChatWindow: { success: boolean };
  sendChatMessage: { success: boolean };
  getChatHistory: ChatState;
  clearChatHistory: { success: boolean };
}

// ============================================================================
// IPC Event Types (for subscriptions)
// ============================================================================

/**
 * Events pushed from main to renderer
 */
export interface IPCEvents {
  /** Live mode status changed */
  liveModeChanged: LiveModeStatus;

  /** New transcript segment received */
  transcriptSegment: TranscriptSegment;

  /** Interim transcript update */
  interimTranscript: { text: string; speaker: Speaker };

  /** Answer chunk received (streaming) */
  answerChunk: { chunk: string; isComplete: boolean };

  /** Answer state changed */
  answerStateChanged: AnswerData;

  /** Error occurred */
  error: { message: string; code?: string };

  /** Minimize mode changed */
  minimizeModeChanged: { isMinimized: boolean };

  // Chat events

  /** Chat response chunk received (streaming) */
  chatResponseChunk: { messageId: string; chunk: string; isComplete: boolean };

  /** Chat state changed */
  chatStateChanged: ChatState;
}

// ============================================================================
// IPC Channel Names
// ============================================================================

/**
 * IPC channel names for direct ipcRenderer communication
 * Used as fallback or alongside tRPC
 */
export const IPC_CHANNELS = {
  // Commands (renderer → main)
  START_LIVE_MODE: 'overlay:start-live-mode',
  STOP_LIVE_MODE: 'overlay:stop-live-mode',
  TRIGGER_ANSWER: 'overlay:trigger-answer',
  CLEAR_OVERLAY: 'overlay:clear-overlay',
  GET_STATUS: 'overlay:get-status',
  CLOSE_WINDOW: 'overlay:close-window',
  GET_SETTINGS: 'overlay:get-settings',
  SAVE_SETTINGS: 'overlay:save-settings',
  TOGGLE_MINIMIZE_MODE: 'overlay:toggle-minimize-mode',

  // Chat commands

  OPEN_CHAT_WINDOW: 'overlay:open-chat-window',
  CLOSE_CHAT_WINDOW: 'overlay:close-chat-window',
  SEND_CHAT_MESSAGE: 'overlay:send-chat-message',
  GET_CHAT_HISTORY: 'overlay:get-chat-history',
  CLEAR_CHAT_HISTORY: 'overlay:clear-chat-history',

  // Events (main → renderer)
  LIVE_MODE_CHANGED: 'overlay:live-mode-changed',
  TRANSCRIPT_SEGMENT: 'overlay:transcript-segment',
  INTERIM_TRANSCRIPT: 'overlay:interim-transcript',
  ANSWER_CHUNK: 'overlay:answer-chunk',
  ANSWER_STATE_CHANGED: 'overlay:answer-state-changed',
  ERROR: 'overlay:error',
  MINIMIZE_MODE_CHANGED: 'overlay:minimize-mode-changed',

  // Chat events

  CHAT_RESPONSE_CHUNK: 'overlay:chat-response-chunk',
  CHAT_STATE_CHANGED: 'overlay:chat-state-changed',
} as const;

export type IPCChannel = (typeof IPC_CHANNELS)[keyof typeof IPC_CHANNELS];

export type { ChatMessage, ChatState, SendMessageOptions };
