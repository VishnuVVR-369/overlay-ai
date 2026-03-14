import React, { useState, useEffect, useCallback } from 'react';
import { Modal } from './Modal';
import { KeyIcon, EyeIcon, EyeOffIcon, MessageIcon } from './Icons';
import { getSettings, saveSettings, getStatus } from '../ipcClient';
import { InterviewModeSelector } from './InterviewModeSelector';
import type { InterviewMode } from '../../lib/interviewModes';

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
    <div className="mb-5">
      <label className="block text-xs font-semibold tracking-wide text-glass-text-secondary mb-2.5">
        <span className="flex items-center gap-2">
          {icon}
          {label}
        </span>
      </label>
      <p className="text-xs text-glass-text-muted mb-2.5 [&_a]:text-glass-accent-light [&_a]:no-underline hover:[&_a]:underline">
        {hint}
      </p>
      <div className="relative">
        <input
          type={showPassword ? 'text' : 'password'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full py-3 px-4 pr-12 bg-glass-bg-primary border border-glass-border-subtle rounded-glass-md font-mono text-[13px] text-glass-text-primary placeholder:text-glass-text-subtle transition-all duration-glass-fast focus:outline-none focus:border-glass-accent focus:shadow-[0_0_0_3px_rgba(155,182,255,0.2)]"
        />
        <button
          type="button"
          onClick={toggleVisibility}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 w-8 h-8 bg-transparent border-none rounded-glass-sm text-glass-text-muted cursor-pointer flex items-center justify-center transition-all duration-glass-fast hover:text-glass-text-primary hover:bg-glass-bg-hover"
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
    <div className="flex flex-col items-center justify-center py-12">
      <div className="w-9 h-9 border-2 border-glass-border-default border-t-glass-accent rounded-full animate-glass-spin mb-4" />
      <p className="text-sm text-glass-text-muted">Loading settings...</p>
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
  const [interviewMode, setInterviewMode] = useState<InterviewMode>('general');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    setIsLoading(true);
    getSettings()
      .then((settings) => {
        setDeepgramKey(settings.deepgramApiKey || '');
        setGroqKey(settings.groqApiKey || '');
        setCustomSystemPrompt(settings.customSystemPrompt || '');
        setInterviewMode(settings.interviewMode || 'general');
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
        customSystemPrompt,
        interviewMode,
      });
      await getStatus();
      onSave?.();
      onClose();
    } catch (error) {
      console.error('Failed to save settings:', error);
    } finally {
      setIsSaving(false);
    }
  }, [deepgramKey, groqKey, customSystemPrompt, interviewMode, onSave, onClose]);

  const footer = (
    <>
      <button
        onClick={onClose}
        className="px-4 py-2.5 rounded-glass-sm font-sans text-[13px] font-medium cursor-pointer transition-all duration-glass-fast inline-flex items-center justify-center gap-2 bg-transparent border border-glass-border-default text-glass-text-secondary hover:bg-glass-bg-hover hover:border-glass-border-strong hover:text-glass-text-primary"
      >
        Cancel
      </button>
      <button
        onClick={handleSave}
        disabled={isSaving || isLoading}
        className="px-4 py-2.5 rounded-glass-sm font-sans text-[13px] font-semibold cursor-pointer transition-all duration-glass-fast inline-flex items-center justify-center gap-2 bg-gradient-to-br from-glass-accent to-glass-accent-dark border-none text-white shadow-[0_2px_10px_rgba(155,182,255,0.35)] hover:from-glass-accent-light hover:to-glass-accent hover:shadow-[0_6px_18px_rgba(155,182,255,0.4)] hover:-translate-y-px active:translate-y-0 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
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
      scrollable={true}
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

          <InterviewModeSelector
            value={interviewMode}
            onChange={setInterviewMode}
            disabled={isSaving}
            showDescription={true}
            hint="Choose the preset that should shape the assistant's structure and priorities before you start the interview."
          />

          <div className="mb-5">
            <label className="block text-xs font-semibold tracking-wide text-glass-text-secondary mb-2.5">
              <span className="flex items-center gap-2">
                <MessageIcon size={14} />
                Custom System Prompt
              </span>
            </label>
            <p className="text-xs text-glass-text-muted mb-2.5">
              Optional extra instructions appended after the selected interview
              mode preset. Leave empty to use the built-in preset behavior.
            </p>
            <textarea
              value={customSystemPrompt}
              onChange={(e) => setCustomSystemPrompt(e.target.value)}
              placeholder="Add any extra instructions for answer tone, format, or focus..."
              className="w-full py-3 px-4 bg-glass-bg-primary border border-glass-border-subtle rounded-glass-md font-mono text-[13px] text-glass-text-primary placeholder:text-glass-text-subtle transition-all duration-glass-fast resize-y min-h-[120px] focus:outline-none focus:border-glass-accent focus:shadow-[0_0_0_3px_rgba(155,182,255,0.2)]"
              rows={6}
            />
          </div>

          <p className="text-[11px] text-glass-text-subtle italic mt-4">
            API keys are stored securely on your device
          </p>
        </>
      )}
    </Modal>
  );
}

export default SettingsModal;
