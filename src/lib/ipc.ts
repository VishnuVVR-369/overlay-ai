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
}

export interface IPCEvents {
  liveModeChanged: LiveModeStatus;
  transcriptSegment: TranscriptSegment;
  interimTranscript: { text: string; speaker: Speaker };
  answerChunk: { chunk: string; isComplete: boolean };
  answerStateChanged: AnswerData;
  error: { message: string; code?: string };
  minimizeModeChanged: { isMinimized: boolean };
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
} as const;

export type IPCChannel = (typeof IPC_CHANNELS)[keyof typeof IPC_CHANNELS];
