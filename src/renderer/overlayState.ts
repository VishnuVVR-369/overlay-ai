import type { AppSettings, AppStatus, AnswerData, SessionStats } from '../lib/ipc';
import type { InterviewMode } from '../lib/interviewModes';
import type { TranscriptSegment, Speaker } from '../lib/transcript';

export interface OverlayState {
  liveMode: AppStatus['liveMode'];
  segments: TranscriptSegment[];
  interimText: string;
  interimSpeaker: Speaker | null;
  answerState: AnswerData['state'];
  answerText: string;
  answerError: string | null;
  answerModelId: string | null;
  isDeepgramConfigured: boolean;
  isGroqConfigured: boolean;
  isMinimized: boolean;
  interviewMode: InterviewMode;
  lastError: string | null;
  sessionStats: SessionStats;
}

export const INITIAL_SESSION_STATS: SessionStats = {
  sessionStartedAt: null,
  totalWordsTranscribed: 0,
  totalInputTokens: 0,
  totalOutputTokens: 0,
};

export const INITIAL_OVERLAY_STATE: OverlayState = {
  liveMode: { state: 'disconnected' },
  segments: [],
  interimText: '',
  interimSpeaker: null,
  answerState: 'idle',
  answerText: '',
  answerError: null,
  answerModelId: null,
  isDeepgramConfigured: false,
  isGroqConfigured: false,
  isMinimized: false,
  interviewMode: 'general',
  lastError: null,
  sessionStats: INITIAL_SESSION_STATS,
};

export function applyStatusToOverlayState(
  previousState: OverlayState,
  status: AppStatus
): OverlayState {
  return {
    ...previousState,
    liveMode: status.liveMode,
    answerState: status.answer.state,
    answerText: status.answer.text,
    answerError: status.answer.error || null,
    answerModelId: status.answer.modelId || null,
    isDeepgramConfigured: status.isDeepgramConfigured,
    isGroqConfigured: status.isGroqConfigured,
    interviewMode: status.interviewMode,
  };
}

export function applySettingsToOverlayState(
  previousState: OverlayState,
  settings: Pick<AppSettings, 'interviewMode'>
): OverlayState {
  return {
    ...previousState,
    interviewMode: settings.interviewMode ?? previousState.interviewMode,
  };
}

export function getClearedOverlayState(
  previousState: OverlayState
): OverlayState {
  return {
    ...previousState,
    segments: [],
    interimText: '',
    interimSpeaker: null,
    answerState: 'idle',
    answerText: '',
    answerError: null,
    lastError: null,
    sessionStats: { ...INITIAL_SESSION_STATS },
  };
}
