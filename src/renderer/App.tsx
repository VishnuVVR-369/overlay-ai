/**
 * App Component - Glassmorphic Design System
 *
 * Main overlay interface with modern frosted glass aesthetics.
 * Features translucent panels, subtle gradients, and elegant depth.
 */

import React, { useState, useCallback } from 'react';
import { StatusBadge } from './components/StatusIndicator';
import { LiveTranscript } from './components/LiveTranscript';
import { AnswerCard } from './components/AnswerCard';
import { SettingsModal } from './components/SettingsModal';
import { HelpModal } from './components/HelpModal';
import { useOverlayState } from './hooks/useOverlayState';

// ============================================================================
// Icons
// ============================================================================

const LogoIcon = () => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <polygon points="12 2 2 7 12 12 22 7 12 2" />
    <polyline points="2 17 12 22 22 17" />
    <polyline points="2 12 12 17 22 12" />
  </svg>
);

const SettingsIcon = () => (
  <svg
    width="15"
    height="15"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 0 0 1.59 1.54" />
    <path d="M18 9a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2h-4a2 2 0 0 1-2-2V11a2 2 0 0 1 2-2h2a2 2 0 0 1 2-2V9z" />
  </svg>
);

const HelpIcon = () => (
  <svg
    width="15"
    height="15"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <circle cx="12" cy="12" r="10" />
    <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
    <path d="M12 17h.01" />
  </svg>
);

const CloseIcon = () => (
  <svg
    width="15"
    height="15"
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

// ============================================================================
// Configuration Warning Component
// ============================================================================

interface ConfigWarningProps {
  isDeepgramConfigured: boolean;
  isGroqConfigured: boolean;
}

function ConfigWarning({
  isDeepgramConfigured,
  isGroqConfigured,
}: ConfigWarningProps): React.ReactElement | null {
  if (isDeepgramConfigured && isGroqConfigured) {
    return null;
  }

  return (
    <div className="glass-warning">
      <div className="glass-warning-icon">!</div>
      <div>
        <h4>Configuration Required</h4>
        <ul>
          {!isDeepgramConfigured && (
            <li>Set DEEPGRAM_API_KEY for transcription</li>
          )}
          {!isGroqConfigured && <li>Set GROQ_API_KEY for LLM answers</li>}
        </ul>
      </div>
    </div>
  );
}

// ============================================================================
// Loading State
// ============================================================================

function LoadingOverlay(): React.ReactElement {
  return (
    <div className="glass-container flex items-center justify-center">
      <div className="glass-loading">
        <div className="glass-loading-spinner" />
        <p className="glass-loading-text font-mono">INITIALIZING...</p>
      </div>
    </div>
  );
}

// ============================================================================
// Minimized View Component
// ============================================================================

interface MinimizedViewProps {
  liveModeState: string;
  isGenerating: boolean;
  onToggle: () => void;
}

function MinimizedView({
  liveModeState,
  isGenerating,
  onToggle,
}: MinimizedViewProps): React.ReactElement {
  const statusColor =
    liveModeState === 'connected'
      ? 'var(--glass-success)'
      : liveModeState === 'connecting'
        ? 'var(--glass-warning)'
        : liveModeState === 'error'
          ? 'var(--glass-error)'
          : 'var(--glass-neutral)';

  const statusLabel =
    liveModeState === 'connected'
      ? 'LIVE'
      : liveModeState === 'connecting'
        ? 'CONNECTING'
        : liveModeState === 'error'
          ? 'ERROR'
          : 'IDLE';

  return (
    <div className="minimized-container">
      <div className="minimized-content">
        <div className="minimized-status" style={{ color: statusColor }}>
          <span className="minimized-status-dot" />
          <span className="minimized-status-label">{statusLabel}</span>
        </div>
        {isGenerating && (
          <div className="minimized-generating">
            <span className="minimized-generating-dot" />
            <span>GENERATING</span>
          </div>
        )}
      </div>
      <button
        onClick={onToggle}
        className="minimized-toggle"
        title="Press Cmd+Shift+M to expand"
        aria-label="Expand overlay"
      >
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
          <polyline points="4 14 12 20 20 12" />
          <line x1="12" x2="20" y1="14" y2="2" />
        </svg>
      </button>
    </div>
  );
}

// ============================================================================
// Main App Component
// ============================================================================

function App(): React.ReactElement {
  const { state, isLoading, actions } = useOverlayState();
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isHelpOpen, setIsHelpOpen] = useState(false);

  const handleOpenSettings = useCallback(() => {
    setIsSettingsOpen(true);
  }, []);

  const handleCloseSettings = useCallback(() => {
    setIsSettingsOpen(false);
  }, []);

  const handleSettingsSaved = useCallback(() => {
    actions.refreshStatus();
  }, [actions]);

  const handleOpenHelp = useCallback(() => {
    setIsHelpOpen(true);
  }, []);

  const handleCloseHelp = useCallback(() => {
    setIsHelpOpen(false);
  }, []);

  const handleToggleMinimizeMode = useCallback(() => {
    actions.toggleMinimizeMode();
  }, [actions]);

  // Show loading state while initializing
  if (isLoading) {
    return <LoadingOverlay />;
  }

  if (state.isMinimized) {
    return (
      <div className="glass-container minimized">
        <MinimizedView
          liveModeState={state.liveMode.state}
          isGenerating={state.answerState === 'generating'}
          onToggle={handleToggleMinimizeMode}
        />
      </div>
    );
  }

  return (
    <div className="glass-container">
      <header
        className="glass-header draggable"
        style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
      >
        <div className="glass-header-left">
          <div className="glass-logo-mark">
            <LogoIcon />
          </div>
          <span className="glass-logo-text">Overlay AI</span>
          <StatusBadge
            state={state.liveMode.state}
            error={state.liveMode.error}
          />
        </div>

        <div
          className="glass-header-right non-draggable"
          style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
        >
          <button
            onClick={handleOpenHelp}
            className="glass-header-btn"
            title="Help and Instructions"
            aria-label="Open help"
          >
            <HelpIcon />
          </button>
          <button
            onClick={handleOpenSettings}
            className="glass-header-btn"
            title="Settings"
            aria-label="Open settings"
          >
            <SettingsIcon />
          </button>
          <button
            onClick={handleToggleMinimizeMode}
            className="glass-header-btn"
            title="Minimize (Cmd+Shift+M)"
            aria-label="Minimize overlay"
          >
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
              <polyline points="4 14 12 20 20 12" />
              <line x1="12" x2="20" y1="14" y2="2" />
            </svg>
          </button>
          <button
            onClick={() => window.close()}
            className="glass-header-btn"
            title="Close"
            aria-label="Close window"
          >
            <CloseIcon />
          </button>
        </div>
      </header>

      <ConfigWarning
        isDeepgramConfigured={state.isDeepgramConfigured}
        isGroqConfigured={state.isGroqConfigured}
      />

      <main className="glass-main glass-scrollbar">
        <section className="glass-transcript-section">
          <LiveTranscript
            segments={state.segments}
            interimText={state.interimText}
            interimSpeaker={state.interimSpeaker || undefined}
            showTimestamps={false}
          />
        </section>

        <section className="glass-answer-section">
          <AnswerCard
            state={state.answerState}
            text={state.answerText}
            error={state.answerError || undefined}
            modelId={state.answerModelId || undefined}
          />
        </section>
      </main>

      {state.lastError &&
        state.liveMode.state !== 'error' &&
        state.answerState !== 'error' && (
          <div className="glass-toast">
            <div className="glass-toast-icon">!</div>
            <p className="glass-toast-text">{state.lastError}</p>
          </div>
        )}

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={handleCloseSettings}
        onSave={handleSettingsSaved}
      />

      <HelpModal isOpen={isHelpOpen} onClose={handleCloseHelp} />
    </div>
  );
}

export default App;
