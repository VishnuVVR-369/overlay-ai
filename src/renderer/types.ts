/**
 * Renderer-specific type definitions
 * Re-exports common types from lib for convenience
 */

// Re-export common types from lib
export type {
  LiveModeStatus,
  LiveModeState,
  AnswerState,
  AnswerData,
  AppStatus,
  AppSettings,
  LiveTranscriptData,
  ContextStats,
  IPCEvents,
} from '../lib/ipc';

export type { AnswerFormatMode } from '../lib/answerModes';

export {
  ANSWER_MODE_DEFINITIONS,
  ANSWER_MODE_MAP,
  DEFAULT_ANSWER_MODE,
} from '../lib/answerModes';

export type { TranscriptSegment, Speaker } from '../lib/transcript';

// Renderer-specific types

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export interface ConfigWarningState {
  isDeepgramConfigured: boolean;
  isGroqConfigured: boolean;
}
