import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import type { LiveModeStatus, AnswerData, SessionStats } from '../../lib/ipc';
import type { TranscriptSegment, Speaker } from '../../lib/transcript';
import {
  DEFAULT_ANSWER_MODE,
  type AnswerFormatMode,
} from '../../lib/answerModes';
import { isStaleAnswerRequest } from './answerStateUtils';
import {
  getStatus,
  subscribeToEvents,
  startLiveMode as ipcStartLiveMode,
  stopLiveMode as ipcStopLiveMode,
  triggerAnswer as ipcTriggerAnswer,
  clearOverlay as ipcClearOverlay,
  toggleMinimizeMode as ipcToggleMinimizeMode,
} from '../ipcClient';

export interface OverlayState {
  liveMode: LiveModeStatus;
  segments: TranscriptSegment[];
  interimText: string;
  interimSpeaker: Speaker | null;
  answerState: AnswerData['state'];
  answerText: string;
  answerError: string | null;
  answerModelId: string | null;
  answerMode: AnswerFormatMode;
  answerRequestId: number;
  isDeepgramConfigured: boolean;
  isGroqConfigured: boolean;
  isMinimized: boolean;
  lastError: string | null;
  sessionStats: SessionStats;
}

export interface OverlayActions {
  startLiveMode: () => Promise<void>;
  stopLiveMode: () => Promise<void>;
  toggleLiveMode: () => Promise<void>;
  triggerAnswer: (mode?: AnswerFormatMode, modelId?: string) => Promise<void>;
  clearOverlay: () => Promise<void>;
  refreshStatus: () => Promise<void>;
  toggleMinimizeMode: () => Promise<void>;
}

export interface UseOverlayStateReturn {
  state: OverlayState;
  actions: OverlayActions;
  isLoading: boolean;
}

const INITIAL_STATE: OverlayState = {
  liveMode: { state: 'disconnected' },
  segments: [],
  interimText: '',
  interimSpeaker: null,
  answerState: 'idle',
  answerText: '',
  answerError: null,
  answerModelId: null,
  answerMode: DEFAULT_ANSWER_MODE,
  answerRequestId: 0,
  isDeepgramConfigured: false,
  isGroqConfigured: false,
  isMinimized: false,
  lastError: null,
  sessionStats: {
    sessionStartedAt: null,
    totalWordsTranscribed: 0,
    totalInputTokens: 0,
    totalOutputTokens: 0,
  },
};

function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

export function useOverlayState(): UseOverlayStateReturn {
  const [state, setState] = useState<OverlayState>(INITIAL_STATE);
  const [isLoading, setIsLoading] = useState(true);
  const answerTextRef = useRef('');
  const activeAnswerRequestIdRef = useRef(0);

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
    (
      chunk: string,
      isComplete: boolean,
      mode: AnswerFormatMode,
      requestId: number
    ) => {
      if (isStaleAnswerRequest(requestId, activeAnswerRequestIdRef.current)) {
        return;
      }

      activeAnswerRequestIdRef.current = requestId;

      if (isComplete) {
        setState((prev) => ({
          ...prev,
          answerState: 'complete',
          answerText: answerTextRef.current,
          answerMode: mode,
          answerRequestId: requestId,
        }));
      } else {
        answerTextRef.current += chunk;
        setState((prev) => ({
          ...prev,
          answerText: answerTextRef.current,
          answerMode: mode,
          answerRequestId: requestId,
        }));
      }
    },
    []
  );

  const updateAnswerState = useCallback((data: AnswerData) => {
    if (isStaleAnswerRequest(data.requestId, activeAnswerRequestIdRef.current)) {
      return;
    }

    activeAnswerRequestIdRef.current = data.requestId;
    setState((prev) => ({
      ...prev,
      answerState: data.state,
      answerText: data.text,
      answerError: data.error || null,
      answerModelId: data.modelId || null,
      answerMode: data.mode,
      answerRequestId: data.requestId,
    }));

    if (data.state === 'generating') {
      answerTextRef.current = '';
    } else {
      answerTextRef.current = data.text;
    }

    if (data.state === 'idle') {
      activeAnswerRequestIdRef.current = 0;
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
    async (mode: AnswerFormatMode = DEFAULT_ANSWER_MODE, modelId?: string) => {
      try {
        answerTextRef.current = '';
        setState((prev) => ({
          ...prev,
          answerState: 'generating',
          answerText: '',
          answerError: null,
          answerMode: mode,
        }));

        const data = await ipcTriggerAnswer(modelId, mode);
        if (
          (data.state === 'complete' || data.state === 'error') &&
          !isStaleAnswerRequest(data.requestId, activeAnswerRequestIdRef.current)
        ) {
          updateAnswerState(data);
        }
      } catch (error) {
        const errorMessage = getErrorMessage(error, 'Unknown error');
        handleError(getErrorMessage(error, 'Failed to trigger answer'));
        setState((prev) => ({
          ...prev,
          answerState: 'error',
          answerError: errorMessage,
          answerMode: mode,
        }));
      }
    },
    [updateAnswerState, handleError]
  );

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
        answerModelId: null,
        answerMode: DEFAULT_ANSWER_MODE,
        answerRequestId: 0,
        lastError: null,
        sessionStats: {
          sessionStartedAt: null,
          totalWordsTranscribed: 0,
          totalInputTokens: 0,
          totalOutputTokens: 0,
        },
      }));
      answerTextRef.current = '';
      activeAnswerRequestIdRef.current = 0;
    } catch (error) {
      handleError(getErrorMessage(error, 'Failed to clear overlay'));
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
        answerModelId: status.answer.modelId || null,
        answerMode: status.answer.mode,
        answerRequestId: status.answer.requestId,
        isDeepgramConfigured: status.isDeepgramConfigured,
        isGroqConfigured: status.isGroqConfigured,
      }));
      answerTextRef.current = status.answer.text;
      activeAnswerRequestIdRef.current = status.answer.requestId;
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
      answerChunk: ({ chunk, isComplete, mode, requestId }) =>
        handleAnswerChunk(chunk, isComplete, mode, requestId),
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
