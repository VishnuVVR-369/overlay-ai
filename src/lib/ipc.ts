import { ChatState } from './chat';
import type { TranscriptSegment, Speaker } from './transcript';

export type LiveModeState =
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'error';

export interface LiveModeStatus {
  state: LiveModeState;
  error?: string;
  connectedAt?: number;
}

export interface LiveTranscriptData {
  segments: TranscriptSegment[];
  interimText?: string;
  interimSpeaker?: Speaker;
}

export type AnswerState = 'idle' | 'generating' | 'complete' | 'error';

export interface AnswerData {
  state: AnswerState;
  text: string;
  error?: string;
  modelId?: string;
  generatedAt?: number;
}

export interface ContextStats {
  segmentCount: number;
  wordCount: number;
  estimatedTokens: number;
  durationMs: number;
}

export interface SessionStats {
  sessionStartedAt: number | null;
  totalWordsTranscribed: number;
  totalInputTokens: number;
  totalOutputTokens: number;
}

export interface AppStatus {
  liveMode: LiveModeStatus;
  answer: AnswerData;
  context: ContextStats;
  isDeepgramConfigured: boolean;
  isGroqConfigured: boolean;
}

export interface ApiKeySettings {
  deepgramApiKey?: string;
  groqApiKey?: string;
}

export interface AppSettings extends ApiKeySettings {
  customSystemPrompt?: string;
  isMinimized?: boolean;
}

export interface IPCInputs {
  startLiveMode: void;
  stopLiveMode: void;
  triggerAnswer: {
    modelId?: string;
  };
  clearOverlay: void;
  getStatus: void;
  getRecentTranscript: {
    windowMs?: number;
  };
  getFullContext: void;
  closeWindow: void;
  getSettings: void;
  saveSettings: Partial<AppSettings>;
  toggleMinimizeMode: void;
  openChatWindow: void;
  closeChatWindow: void;
  sendChatMessage: {
    message: string;
    includeTranscript: boolean;
  };
  getChatHistory: void;
  clearChatHistory: void;
}

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
  openChatWindow: { success: boolean };
  closeChatWindow: { success: boolean };
  sendChatMessage: { success: boolean };
  getChatHistory: ChatState;
  clearChatHistory: { success: boolean };
}

export interface IPCEvents {
  liveModeChanged: LiveModeStatus;
  transcriptSegment: TranscriptSegment;
  interimTranscript: { text: string; speaker: Speaker };
  answerChunk: { chunk: string; isComplete: boolean };
  answerStateChanged: AnswerData;
  error: { message: string; code?: string };
  minimizeModeChanged: { isMinimized: boolean };
  sessionStatsUpdated: SessionStats;
  chatResponseChunk: { messageId: string; chunk: string; isComplete: boolean };
  chatStateChanged: ChatState;
}

export const IPC_CHANNELS = {
  START_LIVE_MODE: 'overlay:start-live-mode',
  STOP_LIVE_MODE: 'overlay:stop-live-mode',
  TRIGGER_ANSWER: 'overlay:trigger-answer',
  CLEAR_OVERLAY: 'overlay:clear-overlay',
  GET_STATUS: 'overlay:get-status',
  CLOSE_WINDOW: 'overlay:close-window',
  GET_SETTINGS: 'overlay:get-settings',
  SAVE_SETTINGS: 'overlay:save-settings',
  TOGGLE_MINIMIZE_MODE: 'overlay:toggle-minimize-mode',
  LIVE_MODE_CHANGED: 'overlay:live-mode-changed',
  TRANSCRIPT_SEGMENT: 'overlay:transcript-segment',
  INTERIM_TRANSCRIPT: 'overlay:interim-transcript',
  ANSWER_CHUNK: 'overlay:answer-chunk',
  ANSWER_STATE_CHANGED: 'overlay:answer-state-changed',
  ERROR: 'overlay:error',
  MINIMIZE_MODE_CHANGED: 'overlay:minimize-mode-changed',
  SESSION_STATS_UPDATED: 'overlay:session-stats-updated',
  OPEN_CHAT_WINDOW: 'overlay:open-chat-window',
  CLOSE_CHAT_WINDOW: 'overlay:close-chat-window',
  SEND_CHAT_MESSAGE: 'overlay:send-chat-message',
  GET_CHAT_HISTORY: 'overlay:get-chat-history',
  CLEAR_CHAT_HISTORY: 'overlay:clear-chat-history',
  CHAT_RESPONSE_CHUNK: 'overlay:chat-response-chunk',
  CHAT_STATE_CHANGED: 'overlay:chat-state-changed',
} as const;

export type IPCChannel = (typeof IPC_CHANNELS)[keyof typeof IPC_CHANNELS];
