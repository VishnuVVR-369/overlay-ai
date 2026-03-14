import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import type { LiveModeStatus, AnswerData, SessionStats } from '../../lib/ipc';
import type { TranscriptSegment, Speaker } from '../../lib/transcript';
import {
  getStatus,
  subscribeToEvents,
  startLiveMode as ipcStartLiveMode,
  stopLiveMode as ipcStopLiveMode,
  triggerAnswer as ipcTriggerAnswer,
  clearOverlay as ipcClearOverlay,
  toggleMinimizeMode as ipcToggleMinimizeMode,
} from '../ipcClient';
import {
  INITIAL_OVERLAY_STATE,
  applyStatusToOverlayState,
  getClearedOverlayState,
  type OverlayState,
} from '../overlayState';

export interface OverlayActions {
  startLiveMode: () => Promise<void>;
  stopLiveMode: () => Promise<void>;
  toggleLiveMode: () => Promise<void>;
  triggerAnswer: (modelId?: string) => Promise<void>;
  clearOverlay: () => Promise<void>;
  refreshStatus: () => Promise<void>;
  toggleMinimizeMode: () => Promise<void>;
}

export interface UseOverlayStateReturn {
  state: OverlayState;
  actions: OverlayActions;
  isLoading: boolean;
}

function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

export function useOverlayState(): UseOverlayStateReturn {
  const [state, setState] = useState<OverlayState>(INITIAL_OVERLAY_STATE);
  const [isLoading, setIsLoading] = useState(true);
  const answerTextRef = useRef('');

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
      interimText: '',
      interimSpeaker: null,
    }));
  }, []);

  const updateInterimTranscript = useCallback(
    (text: string, speaker: Speaker) => {
      setState((prev) => ({
        ...prev,
        interimText: text,
        interimSpeaker: speaker,
      }));
    },
    []
  );

  const handleAnswerChunk = useCallback(
    (chunk: string, isComplete: boolean) => {
      if (isComplete) {
        setState((prev) => ({
          ...prev,
          answerState: 'complete',
          answerText: answerTextRef.current,
        }));
      } else {
        answerTextRef.current += chunk;
        setState((prev) => ({
          ...prev,
          answerText: answerTextRef.current,
        }));
      }
    },
    []
  );

  const updateAnswerState = useCallback((data: AnswerData) => {
    setState((prev) => ({
      ...prev,
      answerState: data.state,
      answerText: data.text,
      answerError: data.error || null,
      answerModelId: data.modelId || null,
    }));

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

  const handleMinimizeModeChanged = useCallback(
    ({ isMinimized }: { isMinimized: boolean }) => {
      setState((prev) => ({
        ...prev,
        isMinimized,
      }));
    },
    []
  );

  const handleSessionStatsUpdated = useCallback((stats: SessionStats) => {
    setState((prev) => ({
      ...prev,
      sessionStats: stats,
    }));
  }, []);

  const startLiveMode = useCallback(async () => {
    try {
      const status = await ipcStartLiveMode();
      updateLiveMode(status);
    } catch (error) {
      handleError(getErrorMessage(error, 'Failed to start live mode'));
    }
  }, [updateLiveMode, handleError]);

  const stopLiveMode = useCallback(async () => {
    try {
      const status = await ipcStopLiveMode();
      updateLiveMode(status);
    } catch (error) {
      handleError(getErrorMessage(error, 'Failed to stop live mode'));
    }
  }, [updateLiveMode, handleError]);

  const toggleLiveMode = useCallback(async () => {
    if (state.liveMode.state === 'connected') {
      await stopLiveMode();
    } else {
      await startLiveMode();
    }
  }, [state.liveMode.state, startLiveMode, stopLiveMode]);

  const triggerAnswer = useCallback(
    async (modelId?: string) => {
      try {
        answerTextRef.current = '';
        setState((prev) => ({
          ...prev,
          answerState: 'generating',
          answerText: '',
          answerError: null,
        }));

        const data = await ipcTriggerAnswer(modelId);
        if (data.state === 'complete' || data.state === 'error') {
          updateAnswerState(data);
        }
      } catch (error) {
        const errorMessage = getErrorMessage(error, 'Unknown error');
        handleError(getErrorMessage(error, 'Failed to trigger answer'));
        setState((prev) => ({
          ...prev,
          answerState: 'error',
          answerError: errorMessage,
        }));
      }
    },
    [updateAnswerState, handleError]
  );

  const clearOverlay = useCallback(async () => {
    try {
      await ipcClearOverlay();
      setState((prev) => getClearedOverlayState(prev));
      answerTextRef.current = '';
    } catch (error) {
      handleError(getErrorMessage(error, 'Failed to clear overlay'));
    }
  }, [handleError]);

  const refreshStatus = useCallback(async () => {
    try {
      const status = await getStatus();
      setState((prev) => applyStatusToOverlayState(prev, status));
    } catch (error) {
      handleError(getErrorMessage(error, 'Failed to get status'));
    }
  }, [handleError]);

  const toggleMinimizeModeAction = useCallback(async () => {
    try {
      const result = await ipcToggleMinimizeMode();
      setState((prev) => ({
        ...prev,
        isMinimized: result.isMinimized,
      }));
    } catch (error) {
      handleError(getErrorMessage(error, 'Failed to toggle minimize mode'));
    }
  }, [handleError]);

  useEffect(() => {
    const init = async () => {
      setIsLoading(true);
      await refreshStatus();
      setIsLoading(false);
    };
    init();
  }, [refreshStatus]);

  useEffect(() => {
    const unsubscribe = subscribeToEvents({
      liveModeChanged: updateLiveMode,
      transcriptSegment: addSegment,
      interimTranscript: ({ text, speaker }) =>
        updateInterimTranscript(text, speaker),
      answerChunk: ({ chunk, isComplete }) =>
        handleAnswerChunk(chunk, isComplete),
      answerStateChanged: updateAnswerState,
      error: ({ message }) => handleError(message),
      minimizeModeChanged: handleMinimizeModeChanged,
      sessionStatsUpdated: handleSessionStatsUpdated,
    });

    return unsubscribe;
  }, [
    updateLiveMode,
    addSegment,
    updateInterimTranscript,
    handleAnswerChunk,
    updateAnswerState,
    handleError,
    handleMinimizeModeChanged,
    handleSessionStatsUpdated,
  ]);

  const actions = useMemo<OverlayActions>(
    () => ({
      startLiveMode,
      stopLiveMode,
      toggleLiveMode,
      triggerAnswer,
      clearOverlay,
      refreshStatus,
      toggleMinimizeMode: toggleMinimizeModeAction,
    }),
    [
      startLiveMode,
      stopLiveMode,
      toggleLiveMode,
      triggerAnswer,
      clearOverlay,
      refreshStatus,
      toggleMinimizeModeAction,
    ]
  );

  return {
    state,
    actions,
    isLoading,
  };
}

export default useOverlayState;
