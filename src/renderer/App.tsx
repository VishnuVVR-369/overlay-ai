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
import { SessionStatsFooter } from './components/SessionStatsFooter';
import { useOverlayState } from './hooks/useOverlayState';
import { ANSWER_MODE_DEFINITIONS } from '../lib/answerModes';

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
      <div className="glass-container relative flex flex-col max-h-screen overflow-hidden bg-glass-bg-deep backdrop-blur-glass-xl w-[280px] h-[120px]">
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
    <div className="glass-container relative flex flex-col h-screen max-h-screen overflow-hidden bg-glass-bg-deep backdrop-blur-glass-2xl text-glass-text-primary">
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

      <main className="flex-1 min-h-0 overflow-y-auto flex flex-col gap-3 p-3 glass-scrollbar">
        <section className="shrink min-h-[60px] max-h-[35%] overflow-hidden [&>div]:h-full [&>div]:flex [&>div]:flex-col [&>div>div:last-child]:flex-1 [&>div>div:last-child]:min-h-0 [&>div>div:last-child]:overflow-y-auto">
          <LiveTranscript
            segments={state.segments}
            interimText={state.interimText}
            interimSpeaker={state.interimSpeaker || undefined}
            showTimestamps={false}
          />
        </section>

        <section className="flex-1 min-h-[50px] overflow-hidden [&>div]:h-full [&>div]:flex [&>div]:flex-col [&>div>div:last-child]:flex-1 [&>div>div:last-child]:min-h-0 [&>div>div:last-child]:max-h-none [&>div>div:last-child]:overflow-y-auto">
          <AnswerCard
            state={state.answerState}
            text={state.answerText}
            error={state.answerError || undefined}
            modelId={state.answerModelId || undefined}
            mode={state.answerMode}
            availableModes={ANSWER_MODE_DEFINITIONS}
            onTriggerMode={(mode) => actions.triggerAnswer(mode)}
          />
        </section>
      </main>

      <SessionStatsFooter
        sessionStartedAt={state.sessionStats.sessionStartedAt}
        wordsTranscribed={state.sessionStats.totalWordsTranscribed}
        inputTokens={state.sessionStats.totalInputTokens}
        outputTokens={state.sessionStats.totalOutputTokens}
        isConnected={state.liveMode.state === 'connected'}
      />

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
