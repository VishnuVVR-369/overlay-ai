/**
 * App Component - Cyber-Minimalist HUD Design
 *
 * Main overlay interface with professional HUD aesthetics.
 * Inspired by Linear, Raycast, and Vercel design systems.
 */

import React, { useState, useCallback } from 'react';
import { StatusBadge } from './components/StatusIndicator';
import { LiveTranscript } from './components/LiveTranscript';
import { AnswerCard } from './components/AnswerCard';
import { SettingsModal } from './components/SettingsModal';
import { useOverlayState } from './hooks/useOverlayState';

// ============================================================================
// Icons
// ============================================================================

const LogoIcon = () => (
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
    <polygon points="12 2 2 7 12 12 22 7 12 2" />
    <polyline points="2 17 12 22 22 17" />
    <polyline points="2 12 12 17 22 12" />
  </svg>
);

const SettingsIcon = () => (
  <svg
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

const CloseIcon = () => (
  <svg
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
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
    <div className="hud-warning">
      <div className="hud-warning-icon">!</div>
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
// Keyboard Shortcuts Help
// ============================================================================

function ShortcutsHelp(): React.ReactElement {
  return (
    <div className="hud-shortcuts">
      <div className="hud-shortcut">
        <kbd>Cmd+Shift+L</kbd>
        <span>Live</span>
      </div>
      <div className="hud-shortcut">
        <kbd>Cmd+Shift+X</kbd>
        <span>Answer</span>
      </div>
      <div className="hud-shortcut">
        <kbd>Cmd+Shift+Z</kbd>
        <span>Clear</span>
      </div>
    </div>
  );
}

// ============================================================================
// Loading State
// ============================================================================

function LoadingOverlay(): React.ReactElement {
  return (
    <div className="hud-container flex items-center justify-center">
      <div className="hud-loading">
        <div className="hud-loading-spinner" />
        <p className="hud-loading-text font-mono">INITIALIZING...</p>
      </div>
    </div>
  );
}

// ============================================================================
// HUD Frame Corners
// ============================================================================

function HudCorners(): React.ReactElement {
  return (
    <>
      <div className="hud-corner hud-corner--tl" />
      <div className="hud-corner hud-corner--tr" />
      <div className="hud-corner hud-corner--bl" />
      <div className="hud-corner hud-corner--br" />
    </>
  );
}

// ============================================================================
// Main App Component
// ============================================================================

function App(): React.ReactElement {
  const { state, isLoading, actions } = useOverlayState();
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const handleOpenSettings = useCallback(() => {
    setIsSettingsOpen(true);
  }, []);

  const handleCloseSettings = useCallback(() => {
    setIsSettingsOpen(false);
  }, []);

  const handleSettingsSaved = useCallback(() => {
    actions.refreshStatus();
  }, [actions]);

  // Show loading state while initializing
  if (isLoading) {
    return <LoadingOverlay />;
  }

  return (
    <div className="hud-container hud-scanlines">
      {/* HUD Frame Corners */}
      <HudCorners />

      {/* Header - Draggable region */}
      <header
        className="hud-header draggable"
        style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
      >
        <div className="hud-logo">
          <div className="hud-logo-mark">
            <LogoIcon />
          </div>
          <span className="hud-logo-text">OVERLAY AI</span>
          <StatusBadge state={state.liveMode.state} error={state.liveMode.error} />
        </div>

        <div
          className="flex items-center gap-4 non-draggable"
          style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
        >
          <ShortcutsHelp />

          <div className="flex items-center gap-1">
            <button
              onClick={handleOpenSettings}
              className="hud-btn--icon"
              title="Settings"
              aria-label="Open settings"
            >
              <SettingsIcon />
            </button>
            <button
              onClick={() => window.close()}
              className="hud-btn--icon"
              title="Close"
              aria-label="Close window"
            >
              <CloseIcon />
            </button>
          </div>
        </div>
      </header>

      {/* Configuration Warning */}
      <ConfigWarning
        isDeepgramConfigured={state.isDeepgramConfigured}
        isGroqConfigured={state.isGroqConfigured}
      />

      {/* Main Content */}
      <main className="flex-1 flex flex-col gap-3 p-3 overflow-hidden">
        {/* Live Transcript Panel */}
        <section className="hud-panel">
          <div className="hud-panel-header">
            <h2>Live Transcript</h2>
          </div>
          <div className="hud-panel-content">
            <LiveTranscript
              segments={state.segments}
              interimText={state.interimText}
              interimSpeaker={state.interimSpeaker || undefined}
              maxHeight="140px"
              showTimestamps={false}
            />
          </div>
        </section>

        {/* Answer Section */}
        <section className="flex-1 min-h-0">
          <AnswerCard
            state={state.answerState}
            text={state.answerText}
            error={state.answerError || undefined}
            modelId={state.answerModelId || undefined}
            maxHeight="280px"
          />
        </section>
      </main>

      {/* Error Toast */}
      {state.lastError &&
        state.liveMode.state !== 'error' &&
        state.answerState !== 'error' && (
          <div className="hud-toast">
            <div className="hud-toast-icon">!</div>
            <p className="hud-toast-text">{state.lastError}</p>
          </div>
        )}

      {/* Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={handleCloseSettings}
        onSave={handleSettingsSaved}
      />
    </div>
  );
}

export default App;
