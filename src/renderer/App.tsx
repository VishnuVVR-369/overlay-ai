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
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
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

  // Show loading state while initializing
  if (isLoading) {
    return <LoadingOverlay />;
  }

  return (
    <div className="glass-container">
      {/* Header - Draggable region */}
      <header
        className="glass-header draggable"
        style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
      >
        {/* Left side - Logo and Status */}
        <div className="glass-header-left">
          <div className="glass-logo-mark">
            <LogoIcon />
          </div>
          <span className="glass-logo-text">Overlay AI</span>
          <StatusBadge state={state.liveMode.state} error={state.liveMode.error} />
        </div>

        {/* Right side - Actions */}
        <div
          className="glass-header-right non-draggable"
          style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
        >
          <button
            onClick={handleOpenHelp}
            className="glass-header-btn"
            title="Help & Instructions"
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
            onClick={() => window.close()}
            className="glass-header-btn"
            title="Close"
            aria-label="Close window"
          >
            <CloseIcon />
          </button>
        </div>
      </header>

      {/* Configuration Warning */}
      <ConfigWarning
        isDeepgramConfigured={state.isDeepgramConfigured}
        isGroqConfigured={state.isGroqConfigured}
      />

      {/* Main Content - Scrollable area */}
      <main className="glass-main glass-scrollbar">
        {/* Live Transcript Panel - Collapsible */}
        <section className="glass-transcript-section">
          <LiveTranscript
            segments={state.segments}
            interimText={state.interimText}
            interimSpeaker={state.interimSpeaker || undefined}
            showTimestamps={false}
          />
        </section>

        {/* Answer Section - Flexible */}
        <section className="glass-answer-section">
          <AnswerCard
            state={state.answerState}
            text={state.answerText}
            error={state.answerError || undefined}
            modelId={state.answerModelId || undefined}
          />
        </section>
      </main>

      {/* Error Toast */}
      {state.lastError &&
        state.liveMode.state !== 'error' &&
        state.answerState !== 'error' && (
          <div className="glass-toast">
            <div className="glass-toast-icon">!</div>
            <p className="glass-toast-text">{state.lastError}</p>
          </div>
        )}

      {/* Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={handleCloseSettings}
        onSave={handleSettingsSaved}
      />

      {/* Help Modal */}
      <HelpModal
        isOpen={isHelpOpen}
        onClose={handleCloseHelp}
      />
    </div>
  );
}

export default App;
