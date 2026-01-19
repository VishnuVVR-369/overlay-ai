import React, { useState, useEffect, useCallback } from 'react';
import { Modal } from './Modal';
import { KeyIcon, EyeIcon, EyeOffIcon, MessageIcon } from './Icons';
import { getSettings, saveSettings, getStatus } from '../ipcClient';

const DEFAULT_SYSTEM_PROMPT = `You are a senior staff engineer assisting in a live interview. You have access to last 20 minutes of conversation. The user just asked a specific question or interviewer posed a problem.
1. Identify the core question.
2. If it is a Coding question: Provide Python code, time complexity, and brief explanation.
3. If it is System Design: Outline high-level components and trade-offs.
4. Ignore small talk in the transcript.`;

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave?: () => void;
}

interface PasswordInputProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  hint: React.ReactNode;
  icon: React.ReactNode;
}

function PasswordInput({
  label,
  value,
  onChange,
  placeholder,
  hint,
  icon,
}: PasswordInputProps): React.ReactElement {
  const [showPassword, setShowPassword] = useState(false);

  const toggleVisibility = useCallback(() => {
    setShowPassword((prev) => !prev);
  }, []);

  return (
    <div className="glass-input-group">
      <label className="glass-label">
        <span className="flex items-center gap-2">
          {icon}
          {label}
        </span>
      </label>
      <p className="glass-input-hint">{hint}</p>
      <div className="glass-input-wrapper">
        <input
          type={showPassword ? 'text' : 'password'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="glass-input"
        />
        <button
          type="button"
          onClick={toggleVisibility}
          className="glass-input-toggle"
          aria-label={showPassword ? 'Hide API key' : 'Show API key'}
        >
          {showPassword ? <EyeOffIcon size={16} /> : <EyeIcon size={16} />}
        </button>
      </div>
    </div>
  );
}

function LoadingState(): React.ReactElement {
  return (
    <div className="glass-loading">
      <div className="glass-loading-spinner" />
      <p className="glass-loading-text">Loading settings...</p>
    </div>
  );
}

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

  useEffect(() => {
    if (!isOpen) return;

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
  }, [isOpen]);

  const handleSave = useCallback(async () => {
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
  }, [deepgramKey, groqKey, customSystemPrompt, onSave, onClose]);

  const footer = (
    <>
      <button onClick={onClose} className="glass-btn glass-btn--ghost">
        Cancel
      </button>
      <button
        onClick={handleSave}
        disabled={isSaving || isLoading}
        className="glass-btn glass-btn--primary"
      >
        {isSaving ? 'Saving...' : 'Save'}
      </button>
    </>
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Configuration"
      footer={footer}
      scrollable={false}
    >
      {isLoading ? (
        <LoadingState />
      ) : (
        <>
          <PasswordInput
            label="Deepgram API Key"
            value={deepgramKey}
            onChange={setDeepgramKey}
            placeholder="Enter your Deepgram API key"
            icon={<KeyIcon size={14} />}
            hint={
              <>
                Used for real-time speech transcription.{' '}
                <a
                  href="https://console.deepgram.com/"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Get one here
                </a>
              </>
            }
          />

          <PasswordInput
            label="Groq API Key"
            value={groqKey}
            onChange={setGroqKey}
            placeholder="Enter your Groq API key"
            icon={<KeyIcon size={14} />}
            hint={
              <>
                Used for AI-powered answer generation.{' '}
                <a
                  href="https://console.groq.com/"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Get one here
                </a>
              </>
            }
          />

          <div className="glass-input-group">
            <label className="glass-label">
              <span className="flex items-center gap-2">
                <MessageIcon size={14} />
                Custom System Prompt
              </span>
            </label>
            <p className="glass-input-hint">
              Customize how AI assistant behaves. Leave empty to use default
              interview assistant prompt.
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
            API keys are stored securely on your device and take precedence over
            environment variables.
          </p>
        </>
      )}
    </Modal>
  );
}

export default SettingsModal;
