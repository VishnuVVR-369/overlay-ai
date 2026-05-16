import { useCallback, useEffect, useRef, useState } from 'react'
import { TranscriptPane } from './components/TranscriptPane'
import { LLMResponsePane } from './components/LLMResponsePane'
import { SettingsModal } from './components/SettingsModal'
import { StatusBar } from './components/StatusBar'
import { Toaster } from './components/Toaster'
import { HelpPanel } from './components/HelpPanel'
import { AnswerCard } from './components/AnswerCard'
import { PermissionsBanner } from './components/PermissionsBanner'
import { SeamWaveform } from './components/SeamWaveform'
import { MockInterviewPanel } from './components/MockInterviewPanel'
import { capture } from './audio/capture-controller'
import { mockPlayback } from './audio/mock-playback'
import { useTranscriptStore } from './state/transcript-store'
import { useLlmStore } from './state/llm-store'
import { useStatusStore } from './state/status-store'
import { useMockStore } from './state/mock-store'
import { useUiStore } from './state/ui-store'
import { usePresetStore } from './state/preset-store'
import { useAnswerStyleStore } from './state/answer-style-store'
import { useVaultStore } from './state/vault-store'
import type { MockInterviewConfig } from '@shared/types'

export function App(): JSX.Element {
  const [bootChecked, setBootChecked] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [mockPanelOpen, setMockPanelOpen] = useState(false)
  const [mockStarting, setMockStarting] = useState(false)
  const applyTranscript = useTranscriptStore((s) => s.apply)
  const resetTranscript = useTranscriptStore((s) => s.reset)
  const startEntry = useLlmStore((s) => s.startEntry)
  const appendToken = useLlmStore((s) => s.appendToken)
  const finishEntry = useLlmStore((s) => s.finishEntry)
  const errorEntry = useLlmStore((s) => s.errorEntry)
  const setRunning = useStatusStore((s) => s.setRunning)
  const setSocket = useStatusStore((s) => s.setSocket)
  const running = useStatusStore((s) => s.running)
  const mockStatus = useMockStore((s) => s.status)
  const setMockStatus = useMockStore((s) => s.setStatus)
  const mode = useUiStore((s) => s.mode)
  const setMode = useUiStore((s) => s.setMode)
  const helpOpen = useUiStore((s) => s.helpOpen)
  const setHelpOpen = useUiStore((s) => s.setHelpOpen)
  const settingsOpen = useUiStore((s) => s.settingsOpen)
  const setSettingsOpen = useUiStore((s) => s.setSettingsOpen)
  const focused = useUiStore((s) => s.focused)
  const setFocused = useUiStore((s) => s.setFocused)
  const setPermStatus = useUiStore((s) => s.setPermStatus)
  const setHeadlineFirst = useUiStore((s) => s.setHeadlineFirst)
  const setPresetState = usePresetStore((s) => s.setState)
  const setAnswerStyleState = useAnswerStyleStore((s) => s.setState)
  const setVaultState = useVaultStore((s) => s.setState)
  const heroStreaming = useLlmStore((s) => s.entries[0]?.status === 'streaming')
  const isCompact = mode === 'compact'
  const mockActive = mockStatus.state !== 'idle'

  const triggerLlm = useCallback(async () => {
    const { requestId, mode: entryMode, imageDataUrl } = await window.api.llm.start()
    startEntry(requestId, entryMode, imageDataUrl)
  }, [startEntry])

  const triggerVision = useCallback(async () => {
    const { requestId, mode: entryMode, imageDataUrl } = await window.api.vision.start()
    startEntry(requestId, entryMode, imageDataUrl)
  }, [startEntry])

  const openSettings = useCallback(() => {
    setHelpOpen(false)
    setMockPanelOpen(false)
    setSettingsOpen(true)
  }, [setHelpOpen, setSettingsOpen])

  const toggleRunning = useCallback(async () => {
    if (running) {
      capture.stop()
      await window.api.transcription.stop()
      setRunning(false)
      return
    }
    const status = await window.api.settings.get()
    if (!status.elevenlabsKeySet || !status.groqKeySet) {
      openSettings()
      return
    }
    const result = await window.api.transcription.start()
    if (!result.ok) {
      if (result.reason === 'missing_key') openSettings()
      return
    }
    const captureResult = await capture.start()
    if (!captureResult.micStarted && !captureResult.systemStarted) {
      await window.api.transcription.stop()
      return
    }
    setRunning(true)
  }, [openSettings, running, setRunning])

  const startMock = useCallback(async (config: MockInterviewConfig) => {
    setMockStarting(true)
    try {
      if (running) {
        capture.stop()
        await window.api.transcription.stop()
        setRunning(false)
      }
      const status = await window.api.settings.get()
      if (!status.openaiKeySet) {
        openSettings()
        return
      }
      const result = await window.api.mock.start(config)
      if (!result.ok) {
        if (result.reason === 'missing_openai_key') openSettings()
        return
      }
      if (result.status) setMockStatus(result.status)
      const captureResult = await capture.startMock()
      if (!captureResult.micStarted) {
        await window.api.mock.stop()
        return
      }
      setMockPanelOpen(false)
    } finally {
      setMockStarting(false)
    }
  }, [openSettings, running, setMockStatus, setRunning])

  const stopMock = useCallback(async () => {
    capture.stop()
    mockPlayback.stop()
    await window.api.mock.stop()
    setMockStatus({ state: 'idle', paused: false })
  }, [setMockStatus])

  const toggleMock = useCallback(() => {
    if (mockActive) {
      void stopMock()
      return
    }
    setHelpOpen(false)
    setSettingsOpen(false)
    setMockPanelOpen((v) => !v)
  }, [mockActive, setHelpOpen, setSettingsOpen, stopMock])

  const clearTranscript = useCallback(async () => {
    await window.api.transcription.clear()
    resetTranscript()
  }, [resetTranscript])

  const closeSlideOvers = useCallback(() => {
    setHelpOpen(false)
    setSettingsOpen(false)
    setMockPanelOpen(false)
  }, [setHelpOpen, setSettingsOpen])

  const toggleHelp = useCallback(() => {
    setSettingsOpen(false)
    setMockPanelOpen(false)
    setHelpOpen(!helpOpen)
  }, [helpOpen, setHelpOpen, setSettingsOpen])

  const toggleSettings = useCallback(() => {
    setHelpOpen(false)
    setMockPanelOpen(false)
    setSettingsOpen(!settingsOpen)
  }, [settingsOpen, setHelpOpen, setSettingsOpen])

  const goCompact = useCallback(async () => {
    closeSlideOvers()
    await window.api.window.setMode('compact')
    setMode('compact')
  }, [closeSlideOvers, setMode])

  const goNormal = useCallback(async () => {
    closeSlideOvers()
    await window.api.window.setMode('normal')
    setMode('normal')
  }, [closeSlideOvers, setMode])

  const toggleCompact = useCallback(async () => {
    if (isCompact) await goNormal()
    else await goCompact()
  }, [isCompact, goCompact, goNormal])

  const quit = useCallback(async () => {
    await window.api.window.quit()
  }, [])

  const recheckPerms = useCallback(async () => {
    setPermStatus(await window.api.permissions.status())
  }, [setPermStatus])

  const panicReset = useCallback(() => {
    capture.stop()
    mockPlayback.stop()
    useTranscriptStore.getState().reset()
    useLlmStore.getState().clear()
    useMockStore.getState().reset()
    setRunning(false)
    setHelpOpen(false)
    setSettingsOpen(false)
    setMockPanelOpen(false)
  }, [setRunning, setHelpOpen, setSettingsOpen])

  const requestPanic = useCallback(() => {
    void window.api.panic.request()
  }, [])

  // Keyboard shortcuts
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (
        (event.metaKey || event.ctrlKey) &&
        event.shiftKey &&
        (event.key === 'Escape' || event.key === 'Esc')
      ) {
        event.preventDefault()
        requestPanic()
        return
      }
      if (isEditableTarget(event.target)) return

      if (event.key === 'Escape') {
        if (helpOpen) {
          event.preventDefault()
          setHelpOpen(false)
          return
        }
        if (settingsOpen) {
          event.preventDefault()
          setSettingsOpen(false)
          return
        }
        if (mockPanelOpen) {
          event.preventDefault()
          setMockPanelOpen(false)
        }
        return
      }

      if (event.metaKey || event.ctrlKey || event.altKey || event.repeat) return

      if (event.key === '-') {
        event.preventDefault()
        void toggleCompact()
        return
      }

      if (isCompact) return

      switch (event.key) {
        case 'm':
        case 'M':
          event.preventDefault()
          toggleMock()
          break
        case '?':
          event.preventDefault()
          toggleHelp()
          break
        case 's':
        case 'S':
          event.preventDefault()
          toggleSettings()
          break
        case ' ':
          event.preventDefault()
          void toggleRunning()
          break
        case 'c':
        case 'C':
          event.preventDefault()
          void clearTranscript()
          break
        case 'q':
        case 'Q':
          event.preventDefault()
          void quit()
          break
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [
    clearTranscript,
    isCompact,
    helpOpen,
    mockPanelOpen,
    toggleHelp,
    toggleSettings,
    quit,
    requestPanic,
    settingsOpen,
    setHelpOpen,
    setSettingsOpen,
    toggleCompact,
    toggleMock,
    toggleRunning,
  ])

  // Boot: settings + presets + permissions
  useEffect(() => {
    void window.api.settings.get().then((status) => {
      if (!status.elevenlabsKeySet || !status.groqKeySet || !status.openaiKeySet) {
        openSettings()
      }
      setHeadlineFirst(status.headlineFirst)
      setBootChecked(true)
    })
    void window.api.presets.get().then(setPresetState)
    void window.api.answerStyles.get().then(setAnswerStyleState)
    void window.api.vault.get().then(setVaultState)
    void window.api.mock.status().then(setMockStatus)
    void recheckPerms()
    setMounted(true)
  }, [openSettings, recheckPerms, setAnswerStyleState, setPresetState, setHeadlineFirst, setVaultState, setMockStatus])

  // Periodic perm re-check (in case user grants in System Settings)
  useEffect(() => {
    const id = window.setInterval(() => {
      void recheckPerms()
    }, 30_000)
    return () => window.clearInterval(id)
  }, [recheckPerms])

  // Subscriptions
  useEffect(() => {
    const subs = [
      window.api.transcription.onUpdate(applyTranscript),
      window.api.transcription.onSocketStatus((evt) => setSocket(evt.stream, evt.state, evt.message)),
      window.api.mock.onStatus(setMockStatus),
      window.api.mock.onAudioDelta((evt) => {
        void mockPlayback.playPcm16(evt.audioBase64, evt.sampleRate)
      }),
      window.api.mock.onPlaybackStop(() => {
        mockPlayback.stop()
      }),
      window.api.mock.onFeedback((evt) => {
        useLlmStore.getState().startEntry(evt.requestId, 'transcript')
        useLlmStore.getState().finishEntry(evt.requestId, evt.text)
      }),
      window.api.llm.onTrigger(() => {
        void triggerLlm()
      }),
      window.api.vision.onTrigger(() => {
        void triggerVision()
      }),
      window.api.llm.onToken((evt) => appendToken(evt.requestId, evt.delta)),
      window.api.llm.onDone((evt) => finishEntry(evt.requestId, evt.full)),
      window.api.llm.onError((evt) => errorEntry(evt.requestId, evt.message)),
      window.api.presets.onChanged(setPresetState),
      window.api.answerStyles.onChanged(setAnswerStyleState),
      window.api.vault.onChanged(setVaultState),
      window.api.panic.onTrigger(panicReset),
      window.api.ui.onOpenSettings(openSettings),
      window.api.window.onFocusState((evt) => setFocused(evt.focused)),
      window.api.window.onModeChanged((evt) => {
        setMode(evt.mode)
        closeSlideOvers()
      }),
      window.api.window.onVisibilityChanged((evt) => {
        if (!evt.visible) closeSlideOvers()
      }),
    ]
    return () => subs.forEach((unsub) => unsub())
  }, [
    applyTranscript,
    appendToken,
    errorEntry,
    finishEntry,
    setFocused,
    setAnswerStyleState,
    setMode,
    setPresetState,
    setSocket,
    setMockStatus,
    setVaultState,
    panicReset,
    closeSlideOvers,
    openSettings,
    setHelpOpen,
    setSettingsOpen,
    triggerLlm,
    triggerVision,
  ])

  // Renderer-side "user active" pulse — restores 100% opacity if main misses focus on panel windows
  useEffect(() => {
    let last = 0
    const fire = (): void => {
      const now = Date.now()
      if (now - last < 1500) return
      last = now
      window.api.window.notifyUserActive()
    }
    window.addEventListener('mousedown', fire)
    window.addEventListener('keydown', fire)
    window.addEventListener('mousemove', fire, { passive: true })
    return () => {
      window.removeEventListener('mousedown', fire)
      window.removeEventListener('keydown', fire)
      window.removeEventListener('mousemove', fire)
    }
  }, [])

  // Drop the boot fade-up class after first paint so subsequent state changes don't replay it
  const fadeRef = useRef<number | null>(null)
  useEffect(() => {
    if (!mounted) return
    if (fadeRef.current) return
    fadeRef.current = window.setTimeout(() => {
      const el = document.querySelector('.app-root')
      if (el) el.classList.remove('fading-in')
    }, 600)
  }, [mounted])

  if (isCompact) {
    return (
      <div className={`app-root app-compact ${focused ? '' : 'unfocused'}`}>
        <AnswerCard onExpand={() => void goNormal()} onQuit={() => void quit()} />
      </div>
    )
  }

  return (
    <div className={`app-root ${focused ? '' : 'unfocused'} ${mounted ? 'fading-in' : ''}`}>
      <div className="drag-region" style={{ height: 6 }} />
      <PermissionsBanner onRecheck={() => void recheckPerms()} />
      <div className="llm-area">
        <LLMResponsePane />
      </div>
      <div className={`seam ${heroStreaming ? 'streaming' : ''}`}>
        <span className="seam-scanline" aria-hidden />
        <SeamWaveform height={28} />
      </div>
      <div className="transcript-area">
        <TranscriptPane />
      </div>
      <StatusBar
        onToggleSettings={toggleSettings}
        onToggleRunning={() => {
          void toggleRunning()
        }}
        onToggleMock={toggleMock}
        onClearTranscript={() => {
          void clearTranscript()
        }}
        onOpenHelp={toggleHelp}
        onToggleCompact={() => {
          void toggleCompact()
        }}
        onQuit={() => {
          void quit()
        }}
      />
      <SettingsModal
        open={!isCompact && (settingsOpen || !bootChecked)}
        onClose={() => setSettingsOpen(false)}
      />
      <HelpPanel open={!isCompact && helpOpen} onClose={() => setHelpOpen(false)} />
      <MockInterviewPanel
        open={!isCompact && mockPanelOpen}
        starting={mockStarting}
        onClose={() => setMockPanelOpen(false)}
        onStart={(config) => void startMock(config)}
      />
      <Toaster />
    </div>
  )
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  const tagName = target.tagName.toLowerCase()
  return (
    target.isContentEditable ||
    target.closest('[contenteditable]:not([contenteditable="false"])') !== null ||
    tagName === 'input' ||
    tagName === 'textarea' ||
    tagName === 'select'
  )
}
