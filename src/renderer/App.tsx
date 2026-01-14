/**
 * App Component - Main Overlay UI
 *
 * Per PLAN.md Phase 7.1:
 * - StatusIndicator: Green dot (Listening), Red dot (Error)
 * - LiveTranscript: Scrolling text of the last 30s
 * - AnswerCard: Markdown-rendered response from the LLM
 *
 * Visuals: Dark mode, high contrast text, subtle dark background
 */

import React, { useState, useCallback } from 'react';
import { StatusBadge } from './components/StatusIndicator';
import { LiveTranscript } from './components/LiveTranscript';
import { AnswerCard } from './components/AnswerCard';
import { SettingsModal } from './components/SettingsModal';
import { useOverlayState } from './hooks/useOverlayState';

// ============================================================================
// Configuration Warning Component
// ============================================================================

interface ConfigWarningProps {
  isDeepgramConfigured: boolean;
  isGroqConfigured: boolean;
}

function ConfigWarning({ isDeepgramConfigured, isGroqConfigured }: ConfigWarningProps): React.ReactElement | null {
  if (isDeepgramConfigured && isGroqConfigured) {
    return null;
  }

  return (
    <div className="mb-4 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
      <p className="text-sm font-medium text-yellow-400 mb-1">Configuration Required</p>
      <ul className="text-xs text-yellow-300/80 space-y-1">
        {!isDeepgramConfigured && (
          <li>Set DEEPGRAM_API_KEY environment variable for transcription</li>
        )}
        {!isGroqConfigured && (
          <li>Set GROQ_API_KEY environment variable for LLM answers</li>
        )}
      </ul>
    </div>
  );
}

// ============================================================================
// Keyboard Shortcuts Help
// ============================================================================

function ShortcutsHelp(): React.ReactElement {
  return (
    <div className="flex items-center gap-4 text-xs text-gray-500">
      <span>
        <kbd className="px-1 py-0.5 bg-gray-800 rounded font-mono">Cmd+Shift+L</kbd> Live Mode
      </span>
      <span>
        <kbd className="px-1 py-0.5 bg-gray-800 rounded font-mono">Cmd+Shift+X</kbd> Answer
      </span>
      <span>
        <kbd className="px-1 py-0.5 bg-gray-800 rounded font-mono">Cmd+Shift+Z</kbd> Clear
      </span>
    </div>
  );
}

// ============================================================================
// Loading State
// ============================================================================

function LoadingOverlay(): React.ReactElement {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <div className="flex gap-1 justify-center mb-3">
          <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
          <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
          <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
        </div>
        <p className="text-sm text-gray-400">Loading Overlay AI...</p>
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

  const handleOpenSettings = useCallback(() => {
    setIsSettingsOpen(true);
  }, []);

  const handleCloseSettings = useCallback(() => {
    setIsSettingsOpen(false);
  }, []);

  const handleSettingsSaved = useCallback(() => {
    // Refresh status to update configuration indicators
    actions.refreshStatus();
  }, [actions]);

  // Show loading state while initializing
  if (isLoading) {
    return <LoadingOverlay />;
  }

  return (
    <div className="min-h-screen text-white p-4 flex flex-col">
      {/* Header - Draggable region */}
      <header className="flex items-center justify-between mb-4" style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}>
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-bold text-gray-200">Overlay AI</h1>
          <StatusBadge
            state={state.liveMode.state}
            error={state.liveMode.error}
          />
        </div>
        <div className="flex items-center gap-4" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
          <ShortcutsHelp />
          <button
            onClick={handleOpenSettings}
            className="p-1.5 hover:bg-gray-700/50 rounded transition-colors"
            title="Settings"
            aria-label="Open settings"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5 text-gray-400 hover:text-gray-200"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </button>
          <button
            onClick={() => window.close()}
            className="p-1.5 hover:bg-gray-700/50 rounded transition-colors"
            title="Close window"
            aria-label="Close window"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5 text-gray-400 hover:text-gray-200"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </header>

      {/* Configuration Warning */}
      <ConfigWarning
        isDeepgramConfigured={state.isDeepgramConfigured}
        isGroqConfigured={state.isGroqConfigured}
      />

      {/* Main Content */}
      <div className="flex-1 flex flex-col gap-4">
        {/* Live Transcript Section */}
        <section className="bg-gray-900/60 backdrop-blur-sm rounded-xl border border-gray-700/50 overflow-hidden">
          <div className="px-4 py-2 border-b border-gray-700/50 bg-gray-800/50">
            <h2 className="text-sm font-medium text-gray-300">Live Transcript</h2>
          </div>
          <div className="p-4">
            <LiveTranscript
              segments={state.segments}
              interimText={state.interimText}
              interimSpeaker={state.interimSpeaker || undefined}
              maxHeight="150px"
              showTimestamps={false}
            />
          </div>
        </section>

        {/* Answer Section */}
        <section className="flex-1">
          <AnswerCard
            state={state.answerState}
            text={state.answerText}
            error={state.answerError || undefined}
            modelId={state.answerModelId || undefined}
            maxHeight="300px"
          />
        </section>
      </div>

      {/* Error Toast (if any) */}
      {state.lastError && state.liveMode.state !== 'error' && state.answerState !== 'error' && (
        <div className="fixed bottom-4 right-4 p-3 bg-red-500/90 text-white rounded-lg shadow-lg max-w-sm">
          <p className="text-sm">{state.lastError}</p>
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
