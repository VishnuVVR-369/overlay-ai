/**
 * ChatWindow Component
 *
 * Stealth chat interface for conversational AI interactions.
 */

import React, { useState, useEffect, useRef } from 'react';
import { type ChatState } from '../../lib/chat';
import {
  getChatHistory,
  sendChatMessage,
  clearChatHistory as clearChat,
  closeChatWindow as close,
  onChatStateChanged,
  onChatResponseChunk,
} from '../ipcClient';

const CloseIcon = () => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
  >
    <path d="M18 6L6 18" />
    <path d="M6 6l12 12" />
  </svg>
);

const TrashIcon = () => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
  >
    <path d="M3 6h18" />
    <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
  </svg>
);

const ChatIcon = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
  >
    <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
  </svg>
);

const TranscriptIncludedIcon = () => (
  <svg
    width="10"
    height="10"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
  >
    <path d="M12 19l7-7 3 3-7 7-3-3z" />
    <path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z" />
    <path d="M2 2l7.586 7.586" />
  </svg>
);

export function ChatWindow(): React.ReactElement {
  const [state, setState] = useState<ChatState>({
    messages: [],
    isGenerating: false,
    lastError: null,
  });
  const [input, setInput] = useState('');
  const [includeTranscript, setIncludeTranscript] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const handleMessage = (newState: ChatState) => {
      setState(newState);
    };

    const handleChunk = (data: {
      messageId: string;
      chunk: string;
      isComplete: boolean;
    }) => {
      setState((prev) => ({
        ...prev,
        messages: prev.messages.map((msg) =>
          msg.id === data.messageId
            ? { ...msg, content: msg.content + data.chunk }
            : msg
        ),
        isGenerating: !data.isComplete,
      }));
    };

    const cleanupState = onChatStateChanged(handleMessage);
    const cleanupChunk = onChatResponseChunk(handleChunk);

    getChatHistory().then((history) => {
      setState(history);
    });

    return () => {
      cleanupState();
      cleanupChunk();
    };
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [state.messages]);

  const handleSend = async () => {
    if (!input.trim() || state.isGenerating) return;

    const message = input.trim();
    setInput('');

    await sendChatMessage(message, includeTranscript);
  };

  const handleClear = async () => {
    await clearChat();
  };

  const handleClose = async () => {
    await close();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
  };

  return (
    <div className="chat-container">
      <header className="chat-header">
        <div className="chat-header-title">
          <ChatIcon />
          <span>AI Chat</span>
        </div>
        <div className="chat-header-actions">
          <button
            onClick={handleClear}
            className="chat-header-btn"
            title="Clear chat"
          >
            <TrashIcon />
          </button>
          <button
            onClick={handleClose}
            className="chat-header-btn"
            title="Close chat"
          >
            <CloseIcon />
          </button>
        </div>
      </header>

      <div className="chat-messages">
        {state.messages.length === 0 && !state.isGenerating ? (
          <div className="chat-empty">
            <svg
              className="chat-empty-icon"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
            >
              <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
            </svg>
            <p>Ask me anything about the interview</p>
            <p className="text-[var(--glass-text-subtle)] text-xs mt-2">
              Use Cmd+Shift+C to open/close this window
            </p>
          </div>
        ) : (
          <>
            {state.messages.map((msg) => (
              <div key={msg.id} className={`chat-message ${msg.role}`}>
                <div className="chat-message-bubble">{msg.content}</div>
                <div className="chat-message-meta">
                  {formatTime(msg.timestamp)}
                  {msg.includeTranscript && (
                    <span
                      className="chat-transcript-badge"
                      title="Transcript included"
                    >
                      <TranscriptIncludedIcon />
                    </span>
                  )}
                </div>
              </div>
            ))}
            {state.isGenerating && (
              <div className="chat-message assistant generating">
                <div className="chat-message-bubble">Thinking...</div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {state.lastError && (
        <div className="chat-message error">
          <div className="chat-message-bubble">{state.lastError}</div>
        </div>
      )}

      <div className="chat-input-area">
        <div className="chat-input-options">
          <div className="chat-toggle-container">
            <span className="chat-toggle-label">Include transcript</span>
            <button
              className={`chat-toggle ${includeTranscript ? 'active' : ''}`}
              onClick={() => setIncludeTranscript(!includeTranscript)}
              title="Include last 20 minutes of transcript in message"
            />
          </div>
          <span className="chat-toggle-hint">
            {includeTranscript ? 'On' : 'Off'}
          </span>
        </div>
        <div className="chat-input-wrapper">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type your message... (Enter to send, Shift+Enter for new line)"
            className="chat-textarea"
            disabled={state.isGenerating}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || state.isGenerating}
            className="chat-send-btn"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <line x1="22" y1="2" x2="11" y2="13" />
              <polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
            Send
          </button>
        </div>
      </div>
    </div>
  );
}

export default ChatWindow;
