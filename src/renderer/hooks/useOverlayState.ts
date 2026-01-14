/**
 * useOverlayState Hook - UI State Management
 *
 * Per PLAN.md Phase 8:
 * Add minimal state management for listening status, live transcript,
 * and streamed answer text (do not invent advanced architecture).
 *
 * This hook provides a simple React-based state management solution
 * using useState and useEffect to manage the overlay state.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import type { LiveModeStatus, AnswerData, AppStatus } from '../../lib/ipc';
import type { TranscriptSegment, Speaker } from '../../lib/transcript';
import {
  getStatus,
  subscribeToEvents,
  startLiveMode as ipcStartLiveMode,
  stopLiveMode as ipcStopLiveMode,
  triggerAnswer as ipcTriggerAnswer,
  clearOverlay as ipcClearOverlay,
} from '../ipcClient';

// ============================================================================
// Types
// ============================================================================

export interface OverlayState {
  /** Live mode connection status */
  liveMode: LiveModeStatus;
  /** Transcript segments */
  segments: TranscriptSegment[];
  /** Interim (non-final) transcript text */
  interimText: string;
  /** Speaker of interim text */
  interimSpeaker: Speaker | null;
  /** Answer generation state */
  answerState: AnswerData['state'];
  /** Answer text (may be partial during streaming) */
  answerText: string;
  /** Answer error message */
  answerError: string | null;
  /** Model used for answer generation */
  answerModelId: string | null;
  /** Whether API keys are configured */
  isDeepgramConfigured: boolean;
  isGroqConfigured: boolean;
  /** Last error message */
  lastError: string | null;
}

export interface OverlayActions {
  /** Start live mode (audio capture + transcription) */
  startLiveMode: () => Promise<void>;
  /** Stop live mode */
  stopLiveMode: () => Promise<void>;
  /** Toggle live mode */
  toggleLiveMode: () => Promise<void>;
  /** Trigger answer generation */
  triggerAnswer: (modelId?: string) => Promise<void>;
  /** Clear all overlay state */
  clearOverlay: () => Promise<void>;
  /** Refresh status from main process */
  refreshStatus: () => Promise<void>;
}

export interface UseOverlayStateReturn {
  state: OverlayState;
  actions: OverlayActions;
  isLoading: boolean;
}

// ============================================================================
// Initial State
// ============================================================================

const INITIAL_STATE: OverlayState = {
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
  lastError: null,
};

// ============================================================================
// Hook Implementation
// ============================================================================

/**
 * useOverlayState - Manages all overlay UI state
 *
 * @example
 * ```tsx
 * function App() {
 *   const { state, actions, isLoading } = useOverlayState();
 *
 *   return (
 *     <div>
 *       <StatusIndicator state={state.liveMode.state} />
 *       <LiveTranscript segments={state.segments} />
 *       <AnswerCard state={state.answerState} text={state.answerText} />
 *       <button onClick={actions.toggleLiveMode}>Toggle Live</button>
 *     </div>
 *   );
 * }
 * ```
 */
export function useOverlayState(): UseOverlayStateReturn {
  const [state, setState] = useState<OverlayState>(INITIAL_STATE);
  const [isLoading, setIsLoading] = useState(true);

  // Ref for accumulating streaming answer text
  const answerTextRef = useRef('');

  // ============================================================================
  // State Update Helpers
  // ============================================================================

  const updateLiveMode = useCallback((status: LiveModeStatus) => {
    setState((prev) => ({
      ...prev,
      liveMode: status,
      lastError: status.error || prev.lastError,
    }));
  }, []);

  const addSegment = useCallback((segment: TranscriptSegment) => {
    setState((prev) => ({
      ...prev,
      segments: [...prev.segments, segment],
      // Clear interim text when we get a final segment
      interimText: '',
      interimSpeaker: null,
    }));
  }, []);

  const updateInterimTranscript = useCallback((text: string, speaker: Speaker) => {
    setState((prev) => ({
      ...prev,
      interimText: text,
      interimSpeaker: speaker,
    }));
  }, []);

  const handleAnswerChunk = useCallback((chunk: string, isComplete: boolean) => {
    if (isComplete) {
      // Final chunk - answer is complete
      setState((prev) => ({
        ...prev,
        answerState: 'complete',
        answerText: answerTextRef.current,
      }));
    } else {
      // Accumulate chunks
      answerTextRef.current += chunk;
      setState((prev) => ({
        ...prev,
        answerText: answerTextRef.current,
      }));
    }
  }, []);

  const updateAnswerState = useCallback((data: AnswerData) => {
    setState((prev) => ({
      ...prev,
      answerState: data.state,
      answerText: data.text,
      answerError: data.error || null,
      answerModelId: data.modelId || null,
    }));

    // Reset answer text ref when starting new generation
    if (data.state === 'generating') {
      answerTextRef.current = '';
    }
  }, []);

  const handleError = useCallback((message: string) => {
    setState((prev) => ({
      ...prev,
      lastError: message,
    }));
  }, []);

  // ============================================================================
  // Actions
  // ============================================================================

  const startLiveMode = useCallback(async () => {
    try {
      const status = await ipcStartLiveMode();
      updateLiveMode(status);
    } catch (error) {
      handleError(error instanceof Error ? error.message : 'Failed to start live mode');
    }
  }, [updateLiveMode, handleError]);

  const stopLiveMode = useCallback(async () => {
    try {
      const status = await ipcStopLiveMode();
      updateLiveMode(status);
    } catch (error) {
      handleError(error instanceof Error ? error.message : 'Failed to stop live mode');
    }
  }, [updateLiveMode, handleError]);

  const toggleLiveMode = useCallback(async () => {
    if (state.liveMode.state === 'connected') {
      await stopLiveMode();
    } else {
      await startLiveMode();
    }
  }, [state.liveMode.state, startLiveMode, stopLiveMode]);

  const triggerAnswer = useCallback(async (modelId?: string) => {
    try {
      // Reset answer text ref before starting
      answerTextRef.current = '';
      setState((prev) => ({
        ...prev,
        answerState: 'generating',
        answerText: '',
        answerError: null,
      }));

      const data = await ipcTriggerAnswer(modelId);
      // Note: The streaming updates will come via IPC events
      // This just sets the final state if streaming is done
      if (data.state === 'complete' || data.state === 'error') {
        updateAnswerState(data);
      }
    } catch (error) {
      handleError(error instanceof Error ? error.message : 'Failed to trigger answer');
      setState((prev) => ({
        ...prev,
        answerState: 'error',
        answerError: error instanceof Error ? error.message : 'Unknown error',
      }));
    }
  }, [updateAnswerState, handleError]);

  const clearOverlay = useCallback(async () => {
    try {
      await ipcClearOverlay();
      setState((prev) => ({
        ...prev,
        segments: [],
        interimText: '',
        interimSpeaker: null,
        answerState: 'idle',
        answerText: '',
        answerError: null,
        lastError: null,
      }));
      answerTextRef.current = '';
    } catch (error) {
      handleError(error instanceof Error ? error.message : 'Failed to clear overlay');
    }
  }, [handleError]);

  const refreshStatus = useCallback(async () => {
    try {
      const status = await getStatus();
      setState((prev) => ({
        ...prev,
        liveMode: status.liveMode,
        answerState: status.answer.state,
        answerText: status.answer.text,
        answerError: status.answer.error || null,
        isDeepgramConfigured: status.isDeepgramConfigured,
        isGroqConfigured: status.isGroqConfigured,
      }));
    } catch (error) {
      handleError(error instanceof Error ? error.message : 'Failed to get status');
    }
  }, [handleError]);

  // ============================================================================
  // Effects
  // ============================================================================

  // Initial status load
  useEffect(() => {
    const init = async () => {
      setIsLoading(true);
      await refreshStatus();
      setIsLoading(false);
    };
    init();
  }, [refreshStatus]);

  // Subscribe to IPC events
  useEffect(() => {
    const unsubscribe = subscribeToEvents({
      liveModeChanged: updateLiveMode,
      transcriptSegment: addSegment,
      interimTranscript: ({ text, speaker }) => updateInterimTranscript(text, speaker),
      answerChunk: ({ chunk, isComplete }) => handleAnswerChunk(chunk, isComplete),
      answerStateChanged: updateAnswerState,
      error: ({ message }) => handleError(message),
    });

    return unsubscribe;
  }, [
    updateLiveMode,
    addSegment,
    updateInterimTranscript,
    handleAnswerChunk,
    updateAnswerState,
    handleError,
  ]);

  // ============================================================================
  // Return
  // ============================================================================

  return {
    state,
    actions: {
      startLiveMode,
      stopLiveMode,
      toggleLiveMode,
      triggerAnswer,
      clearOverlay,
      refreshStatus,
    },
    isLoading,
  };
}

export default useOverlayState;
