/**
 * SettingsModal Component - Glassmorphic Design System
 *
 * Modal dialog for configuring API keys with elegant frosted glass styling.
 * Keys are stored securely using electron-store.
 */

import React, { useState, useEffect } from 'react';
import { getSettings, saveSettings, getStatus } from '../ipcClient';

// ============================================================================
// Default System Prompt
// ============================================================================

const DEFAULT_SYSTEM_PROMPT = `You are a senior staff engineer assisting in a live interview. You have access to the last 20 minutes of conversation. The user just asked a specific question or the interviewer posed a problem.
1. Identify the core question.
2. If it is a Coding question: Provide Python code, time complexity, and brief explanation.
3. If it is System Design: Outline high-level components and trade-offs.
4. Ignore small talk in the transcript.`;

// ============================================================================
// Types
// ============================================================================

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave?: () => void;
}

// ============================================================================
// Icons
// ============================================================================

const CloseIcon = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M18 6 6 18" />
    <path d="m6 6 12 12" />
  </svg>
);

const EyeIcon = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

const EyeOffIcon = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" />
    <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" />
    <path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" />
    <line x1="2" x2="22" y1="2" y2="22" />
  </svg>
);

const KeyIcon = () => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <circle cx="7.5" cy="15.5" r="5.5" />
    <path d="m21 2-9.6 9.6" />
    <path d="m15.5 7.5 3 3L22 7l-3-3" />
  </svg>
);

// ============================================================================
// Component
// ============================================================================

export function SettingsModal({
  isOpen,
  onClose,
  onSave,
}: SettingsModalProps): React.ReactElement | null {
  const [deepgramKey, setDeepgramKey] = useState('');
  const [groqKey, setGroqKey] = useState('');
  const [customSystemPrompt, setCustomSystemPrompt] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [showDeepgramKey, setShowDeepgramKey] = useState(false);
  const [showGroqKey, setShowGroqKey] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setIsLoading(true);
      getSettings()
        .then((settings) => {
          setDeepgramKey(settings.deepgramApiKey || '');
          setGroqKey(settings.groqApiKey || '');
          setCustomSystemPrompt(
            settings.customSystemPrompt || DEFAULT_SYSTEM_PROMPT
          );
        })
        .catch((error) => {
          console.error('Failed to load settings:', error);
        })
        .finally(() => {
          setIsLoading(false);
        });
    }
  }, [isOpen]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await saveSettings({
        deepgramApiKey: deepgramKey,
        groqApiKey: groqKey,
        customSystemPrompt: customSystemPrompt,
      });
      await getStatus();
      onSave?.();
      onClose();
    } catch (error) {
      console.error('Failed to save settings:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    onClose();
  };

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) {
    return null;
  }

  return (
    <div className="glass-modal-backdrop" onClick={handleCancel}>
      <div
        className="glass-modal glass-animate-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="glass-modal-header">
          <h2 className="glass-modal-title">Configuration</h2>
          <button
            onClick={handleCancel}
            className="glass-modal-close"
            aria-label="Close settings"
          >
            <CloseIcon />
          </button>
        </div>

        {/* Body */}
        <div className="glass-modal-body">
          {isLoading ? (
            <div className="glass-loading">
              <div className="glass-loading-spinner" />
              <p className="glass-loading-text">Loading settings...</p>
            </div>
          ) : (
            <>
              {/* Deepgram API Key */}
              <div className="glass-input-group">
                <label className="glass-label">
                  <span className="flex items-center gap-2">
                    <KeyIcon />
                    Deepgram API Key
                  </span>
                </label>
                <p className="glass-input-hint">
                  Used for real-time speech transcription.{' '}
                  <a
                    href="https://console.deepgram.com/"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Get one here
                  </a>
                </p>
                <div className="glass-input-wrapper">
                  <input
                    type={showDeepgramKey ? 'text' : 'password'}
                    value={deepgramKey}
                    onChange={(e) => setDeepgramKey(e.target.value)}
                    placeholder="Enter your Deepgram API key"
                    className="glass-input"
                  />
                  <button
                    type="button"
                    onClick={() => setShowDeepgramKey(!showDeepgramKey)}
                    className="glass-input-toggle"
                    aria-label={
                      showDeepgramKey ? 'Hide API key' : 'Show API key'
                    }
                  >
                    {showDeepgramKey ? <EyeOffIcon /> : <EyeIcon />}
                  </button>
                </div>
              </div>

              {/* Groq API Key */}
              <div className="glass-input-group">
                <label className="glass-label">
                  <span className="flex items-center gap-2">
                    <KeyIcon />
                    Groq API Key
                  </span>
                </label>
                <p className="glass-input-hint">
                  Used for AI-powered answer generation.{' '}
                  <a
                    href="https://console.groq.com/"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Get one here
                  </a>
                </p>
                <div className="glass-input-wrapper">
                  <input
                    type={showGroqKey ? 'text' : 'password'}
                    value={groqKey}
                    onChange={(e) => setGroqKey(e.target.value)}
                    placeholder="Enter your Groq API key"
                    className="glass-input"
                  />
                  <button
                    type="button"
                    onClick={() => setShowGroqKey(!showGroqKey)}
                    className="glass-input-toggle"
                    aria-label={showGroqKey ? 'Hide API key' : 'Show API key'}
                  >
                    {showGroqKey ? <EyeOffIcon /> : <EyeIcon />}
                  </button>
                </div>
              </div>

              {/* Custom System Prompt */}
              <div className="glass-input-group">
                <label className="glass-label">
                  <span className="flex items-center gap-2">
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                    </svg>
                    Custom System Prompt
                  </span>
                </label>
                <p className="glass-input-hint">
                  Customize how the AI assistant behaves. Leave empty to use the
                  default interview assistant prompt.
                </p>
                <textarea
                  value={customSystemPrompt}
                  onChange={(e) => setCustomSystemPrompt(e.target.value)}
                  placeholder="Enter your custom system prompt..."
                  className="glass-textarea"
                  rows={6}
                />
              </div>

              <p className="text-[11px] text-[var(--glass-text-subtle)] italic mt-4">
                API keys are stored securely on your device and take precedence
                over environment variables.
              </p>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="glass-modal-footer">
          <button onClick={handleCancel} className="glass-btn glass-btn--ghost">
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving || isLoading}
            className="glass-btn glass-btn--primary"
          >
            {isSaving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default SettingsModal;
