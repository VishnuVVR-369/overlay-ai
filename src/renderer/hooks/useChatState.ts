import { useState, useEffect, useCallback, useMemo } from 'react';
import type { ChatState } from '../../lib/chat';
import {
  getChatHistory,
  sendChatMessage as ipcSendChatMessage,
  clearChatHistory as ipcClearChatHistory,
  closeChatWindow as ipcCloseChatWindow,
  onChatStateChanged,
  onChatResponseChunk,
} from '../ipcClient';

export interface ChatActions {
  sendMessage: (message: string, includeTranscript: boolean) => Promise<void>;
  clearHistory: () => Promise<void>;
  closeWindow: () => Promise<void>;
}

export interface UseChatStateReturn {
  state: ChatState;
  actions: ChatActions;
  isLoading: boolean;
}

const INITIAL_STATE: ChatState = {
  messages: [],
  isGenerating: false,
  lastError: null,
};

function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

export function useChatState(): UseChatStateReturn {
  const [state, setState] = useState<ChatState>(INITIAL_STATE);
  const [isLoading, setIsLoading] = useState(true);

  const handleStateChanged = useCallback((newState: ChatState) => {
    setState(newState);
  }, []);

  const handleResponseChunk = useCallback(
    (data: { messageId: string; chunk: string; isComplete: boolean }) => {
      setState((prev) => ({
        ...prev,
        messages: prev.messages.map((msg) =>
          msg.id === data.messageId
            ? { ...msg, content: msg.content + data.chunk }
            : msg
        ),
        isGenerating: !data.isComplete,
      }));
    },
    []
  );

  const sendMessage = useCallback(
    async (message: string, includeTranscript: boolean) => {
      if (!message.trim() || state.isGenerating) return;

      try {
        await ipcSendChatMessage(message.trim(), includeTranscript);
      } catch (error) {
        setState((prev) => ({
          ...prev,
          lastError: getErrorMessage(error, 'Failed to send message'),
          isGenerating: false,
        }));
      }
    },
    [state.isGenerating]
  );

  const clearHistory = useCallback(async () => {
    try {
      await ipcClearChatHistory();
    } catch (error) {
      setState((prev) => ({
        ...prev,
        lastError: getErrorMessage(error, 'Failed to clear chat history'),
      }));
    }
  }, []);

  const closeWindow = useCallback(async () => {
    try {
      await ipcCloseChatWindow();
    } catch (error) {
      console.error('Failed to close chat window:', error);
    }
  }, []);

  useEffect(() => {
    const init = async () => {
      setIsLoading(true);
      try {
        const history = await getChatHistory();
        setState(history);
      } catch (error) {
        console.error('Failed to get chat history:', error);
      }
      setIsLoading(false);
    };
    init();
  }, []);

  useEffect(() => {
    const cleanupState = onChatStateChanged(handleStateChanged);
    const cleanupChunk = onChatResponseChunk(handleResponseChunk);

    return () => {
      cleanupState();
      cleanupChunk();
    };
  }, [handleStateChanged, handleResponseChunk]);

  const actions = useMemo<ChatActions>(
    () => ({
      sendMessage,
      clearHistory,
      closeWindow,
    }),
    [sendMessage, clearHistory, closeWindow]
  );

  return {
    state,
    actions,
    isLoading,
  };
}

export default useChatState;
