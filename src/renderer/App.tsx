import React, { useState, useCallback } from 'react';
import { Header } from './components/Header';
import { ConfigWarning } from './components/ConfigWarning';
import { MinimizedView } from './components/MinimizedView';
import { LoadingOverlay } from './components/LoadingOverlay';
import { Toast } from './components/Toast';
import { LiveTranscript } from './components/LiveTranscript';
import { AnswerCard } from './components/AnswerCard';
import { SettingsModal } from './components/SettingsModal';
import { HelpModal } from './components/HelpModal';
import { useOverlayState } from './hooks/useOverlayState';

function App(): React.ReactElement {
  const { state, isLoading, actions } = useOverlayState();
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isHelpOpen, setIsHelpOpen] = useState(false);

  const handleOpenSettings = useCallback(() => setIsSettingsOpen(true), []);
  const handleCloseSettings = useCallback(() => setIsSettingsOpen(false), []);
  const handleSettingsSaved = useCallback(
    () => actions.refreshStatus(),
    [actions]
  );

  const handleOpenHelp = useCallback(() => setIsHelpOpen(true), []);
  const handleCloseHelp = useCallback(() => setIsHelpOpen(false), []);

  const handleToggleMinimize = useCallback(
    () => actions.toggleMinimizeMode(),
    [actions]
  );

  const handleClose = useCallback(() => window.close(), []);

  if (isLoading) {
    return <LoadingOverlay />;
  }

  if (state.isMinimized) {
    return (
      <div className="glass-container minimized">
        <MinimizedView
          liveModeState={state.liveMode.state}
          isGenerating={state.answerState === 'generating'}
          onToggle={handleToggleMinimize}
        />
      </div>
    );
  }

  const showToast =
    state.lastError &&
    state.liveMode.state !== 'error' &&
    state.answerState !== 'error';

  return (
    <div className="glass-container">
      <Header
        liveModeState={state.liveMode.state}
        liveModeError={state.liveMode.error}
        onOpenHelp={handleOpenHelp}
        onOpenSettings={handleOpenSettings}
        onMinimize={handleToggleMinimize}
        onClose={handleClose}
      />

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

      <Toast message={state.lastError} visible={!!showToast} />

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
