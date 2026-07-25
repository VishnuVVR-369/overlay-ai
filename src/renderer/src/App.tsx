import { useCallback, useEffect, useRef, useState } from 'react'
import { TranscriptPane } from './components/TranscriptPane'
import { LLMResponsePane } from './components/LLMResponsePane'
import { HudBar } from './components/HudBar'
import { Toaster } from './components/Toaster'
import { AnswerCard } from './components/AnswerCard'
import { PermissionsBanner } from './components/PermissionsBanner'
import { SeamWaveform } from './components/SeamWaveform'
import { Console } from './components/Console'
import { CommandPalette } from './components/CommandPalette'
import { ConfirmDialog } from './components/ConfirmDialog'
import { capture } from './audio/capture-controller'
import { mockPlayback } from './audio/mock-playback'
import { useTranscriptStore } from './state/transcript-store'
import { useLlmStore } from './state/llm-store'
import { useStatusStore } from './state/status-store'
import { useMockStore } from './state/mock-store'
import { useMockSessionsStore } from './state/mock-sessions-store'
import { useUiStore, type ConsoleTab } from './state/ui-store'
import { usePresetStore } from './state/preset-store'
import { useAnswerStyleStore } from './state/answer-style-store'
import { useVaultStore } from './state/vault-store'
import type { CommandId } from './commands'
import type { MockInterviewConfig, WindowMode } from '@shared/types'

/** Commands that map straight onto a console tab. */
const TAB_FOR_COMMAND: Partial<Record<CommandId, ConsoleTab>> = {
  setup: 'setup',
  context: 'context',
  prompts: 'prompts',
  history: 'history',
  help: 'help',
}

export function App(): JSX.Element {
  const [bootChecked, setBootChecked] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [mockStarting, setMockStarting] = useState(false)
  const [confirmingQuit, setConfirmingQuit] = useState(false)

  const upsertSessionSummary = useMockSessionsStore((s) => s.upsertSummary)
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
  const consoleTab = useUiStore((s) => s.consoleTab)
  const openConsole = useUiStore((s) => s.openConsole)
  const closeConsole = useUiStore((s) => s.closeConsole)
  const toggleConsole = useUiStore((s) => s.toggleConsole)
  const paletteOpen = useUiStore((s) => s.paletteOpen)
  const setPaletteOpen = useUiStore((s) => s.setPaletteOpen)
  const togglePalette = useUiStore((s) => s.togglePalette)
  const closeOverlays = useUiStore((s) => s.closeOverlays)
  const transcriptOpen = useUiStore((s) => s.transcriptOpen)
  const focused = useUiStore((s) => s.focused)
  const setFocused = useUiStore((s) => s.setFocused)
  const setPermStatus = useUiStore((s) => s.setPermStatus)
  const setHeadlineFirst = useUiStore((s) => s.setHeadlineFirst)

  const setPresetState = usePresetStore((s) => s.setState)
  const setAnswerStyleState = useAnswerStyleStore((s) => s.setState)
  const setVaultState = useVaultStore((s) => s.setState)

  const heroStreaming = useLlmStore((s) => s.entries[0]?.status === 'streaming')
  const isCompact = mode === 'compact'
  const mockActive = mockStatus.state !== 'idle' && mockStatus.state !== 'error'

  const triggerLlm = useCallback(async () => {
    const { requestId, mode: entryMode, imageDataUrl } = await window.api.llm.start()
    startEntry(requestId, entryMode, imageDataUrl)
  }, [startEntry])

  const triggerVision = useCallback(async () => {
    const { requestId, mode: entryMode, imageDataUrl } = await window.api.vision.start()
    startEntry(requestId, entryMode, imageDataUrl)
  }, [startEntry])

  const openSetup = useCallback(() => openConsole('setup'), [openConsole])

  const toggleRunning = useCallback(async () => {
    if (running) {
      capture.stop()
      await window.api.transcription.stop()
      setRunning(false)
      return
    }
    const status = await window.api.settings.get()
    if (!status.elevenlabsKeySet || !status.groqKeySet) {
      openSetup()
      return
    }
    const result = await window.api.transcription.start()
    if (!result.ok) {
      if (result.reason === 'missing_key') openSetup()
      return
    }
    const captureResult = await capture.start()
    if (!captureResult.micStarted && !captureResult.systemStarted) {
      await window.api.transcription.stop()
      return
    }
    setRunning(true)
  }, [openSetup, running, setRunning])

  const startMock = useCallback(
    async (config: MockInterviewConfig) => {
      setMockStarting(true)
      try {
        if (running) {
          capture.stop()
          await window.api.transcription.stop()
          setRunning(false)
        }
        const status = await window.api.settings.get()
        if (!status.openaiKeySet) {
          openSetup()
          return
        }
        const result = await window.api.mock.start(config)
        if (!result.ok) {
          if (result.reason === 'missing_openai_key') openSetup()
          return
        }
        if (result.status) setMockStatus(result.status)
        const captureResult = await capture.startMock()
        if (!captureResult.micStarted) {
          await window.api.mock.stop()
          return
        }
      } finally {
        setMockStarting(false)
      }
    },
    [openSetup, running, setMockStatus, setRunning],
  )

  const stopMock = useCallback(async () => {
    capture.stop()
    mockPlayback.stop()
    await window.api.mock.stop()
    setMockStatus({ state: 'idle', paused: false })
  }, [setMockStatus])

  const clearTranscript = useCallback(async () => {
    await window.api.transcription.clear()
    resetTranscript()
  }, [resetTranscript])

  const applyMode = useCallback(
    async (next: WindowMode) => {
      closeOverlays()
      await window.api.window.setMode(next)
      setMode(next)
    },
    [closeOverlays, setMode],
  )

  const cycleSize = useCallback(async () => {
    const order: WindowMode[] = ['compact', 'normal', 'wide']
    await applyMode(order[(order.indexOf(mode) + 1) % order.length])
  }, [applyMode, mode])

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
    setConfirmingQuit(false)
    closeOverlays()
  }, [closeOverlays, setRunning])

  const runCommand = useCallback(
    (id: CommandId): void => {
      const tab = TAB_FOR_COMMAND[id]
      if (tab) {
        openConsole(tab)
        return
      }
      setPaletteOpen(false)
      switch (id) {
        case 'ask':
          void triggerLlm()
          break
        case 'screenAsk':
          void triggerVision()
          break
        case 'listen':
          void toggleRunning()
          break
        case 'clearTranscript':
          void clearTranscript()
          break
        case 'copyAnswer': {
          const latest = useLlmStore.getState().entries[0]
          if (latest?.text) void navigator.clipboard?.writeText(latest.text)
          break
        }
        case 'mock':
          if (mockActive) void stopMock()
          else openConsole('practice')
          break
        case 'mockPause':
          if (mockStatus.paused) void window.api.mock.resume()
          else void window.api.mock.pause()
          break
        case 'cycleSize':
          void cycleSize()
          break
        case 'hide':
          void window.api.window.hide()
          break
        case 'panic':
          void window.api.panic.request()
          break
        case 'quit':
          // Quitting drops the transcript and both sockets, so it always asks.
          setConfirmingQuit(true)
          break
      }
    },
    [
      clearTranscript,
      cycleSize,
      mockActive,
      mockStatus.paused,
      openConsole,
      setPaletteOpen,
      stopMock,
      toggleRunning,
      triggerLlm,
      triggerVision,
    ],
  )

  // Keyboard. In-window keys only fire while the overlay has focus, which during
  // a real call it does not — that is why every live action also has a global
  // accelerator registered in the main process.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      const mod = event.metaKey || event.ctrlKey

      // Panic must work even from inside a text field.
      if (mod && event.shiftKey && (event.key === 'Escape' || event.key === 'Esc')) {
        event.preventDefault()
        void window.api.panic.request()
        return
      }

      if (mod && !event.shiftKey && !event.altKey && (event.key === 'k' || event.key === 'K')) {
        event.preventDefault()
        togglePalette()
        return
      }

      if (event.key === 'Escape') {
        if (confirmingQuit) {
          event.preventDefault()
          setConfirmingQuit(false)
          return
        }
        if (paletteOpen) {
          event.preventDefault()
          setPaletteOpen(false)
          return
        }
        if (consoleTab) {
          event.preventDefault()
          closeConsole()
        }
        return
      }

      if (isEditableTarget(event.target)) return

      if (mod && !event.shiftKey && !event.altKey && event.key === ',') {
        event.preventDefault()
        openSetup()
        return
      }

      if (mod || event.altKey || event.repeat || isCompact) return

      if (event.key === '?') {
        event.preventDefault()
        toggleConsole('help')
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [
    closeConsole,
    confirmingQuit,
    consoleTab,
    isCompact,
    openSetup,
    paletteOpen,
    setPaletteOpen,
    toggleConsole,
    togglePalette,
  ])

  // Boot: settings + presets + permissions
  useEffect(() => {
    void window.api.settings.get().then((status) => {
      if (!status.elevenlabsKeySet || !status.groqKeySet || !status.openaiKeySet) {
        openSetup()
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
  }, [
    openSetup,
    recheckPerms,
    setAnswerStyleState,
    setPresetState,
    setHeadlineFirst,
    setVaultState,
    setMockStatus,
  ])

  // Periodic perm re-check (in case the user grants in System Settings)
  useEffect(() => {
    const id = window.setInterval(() => void recheckPerms(), 30_000)
    return () => window.clearInterval(id)
  }, [recheckPerms])

  useEffect(() => {
    const subs = [
      window.api.transcription.onUpdate(applyTranscript),
      window.api.transcription.onSocketStatus((evt) => setSocket(evt.stream, evt.state, evt.message)),
      window.api.transcription.onListenTrigger(() => void toggleRunning()),
      window.api.mock.onStatus((status) => {
        setMockStatus(status)
        if (status.state === 'stopping' || status.state === 'idle' || status.state === 'error') {
          capture.stop()
          mockPlayback.stop()
        }
      }),
      window.api.mock.onAudioDelta((evt) => {
        void mockPlayback.playPcm16(evt.audioBase64, evt.sampleRate)
      }),
      window.api.mock.onPlaybackStop(() => mockPlayback.stop()),
      window.api.mock.onFeedback((evt) => {
        useLlmStore.getState().startEntry(evt.requestId, 'transcript')
        useLlmStore.getState().finishEntry(evt.requestId, evt.text)
      }),
      window.api.mockSessions.onSaved((evt) => upsertSessionSummary(evt.summary)),
      window.api.llm.onTrigger(() => void triggerLlm()),
      window.api.vision.onTrigger(() => void triggerVision()),
      window.api.llm.onToken((evt) => appendToken(evt.requestId, evt.delta)),
      window.api.llm.onDone((evt) => finishEntry(evt.requestId, evt.full)),
      window.api.llm.onError((evt) => errorEntry(evt.requestId, evt.message)),
      window.api.presets.onChanged(setPresetState),
      window.api.answerStyles.onChanged(setAnswerStyleState),
      window.api.vault.onChanged(setVaultState),
      window.api.panic.onTrigger(panicReset),
      window.api.ui.onOpenSettings(openSetup),
      window.api.window.onFocusState((evt) => setFocused(evt.focused)),
      window.api.window.onModeChanged((evt) => {
        setMode(evt.mode)
        closeOverlays()
      }),
      window.api.window.onVisibilityChanged((evt) => {
        if (!evt.visible) closeOverlays()
      }),
    ]
    return () => subs.forEach((unsub) => unsub())
  }, [
    applyTranscript,
    appendToken,
    closeOverlays,
    errorEntry,
    finishEntry,
    openSetup,
    panicReset,
    setAnswerStyleState,
    setFocused,
    setMockStatus,
    setMode,
    setPresetState,
    setSocket,
    setVaultState,
    toggleRunning,
    triggerLlm,
    triggerVision,
    upsertSessionSummary,
  ])

  // Renderer-side "user active" pulse — restores full opacity if main misses focus
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

  // Drop the boot fade-up class after first paint so later state changes don't replay it
  const fadeRef = useRef<number | null>(null)
  useEffect(() => {
    if (!mounted || fadeRef.current) return
    fadeRef.current = window.setTimeout(() => {
      document.querySelector('.app-root')?.classList.remove('fading-in')
    }, 600)
  }, [mounted])

  if (isCompact) {
    return (
      <div className={`app-root app-compact ${focused ? '' : 'unfocused'}`}>
        <AnswerCard onExpand={() => void applyMode('normal')} />
      </div>
    )
  }

  const showSeam = running || mockActive || heroStreaming

  // Until the key check comes back, hold on Setup rather than flashing an empty
  // HUD that the user is about to be pulled out of anyway.
  const visibleTab = bootChecked ? consoleTab : 'setup'

  return (
    <div
      className={`app-root ${focused ? '' : 'unfocused'} ${mounted ? 'fading-in' : ''} ${
        visibleTab ? 'console-open' : ''
      }`}
    >
      <HudBar
        onToggleListening={() => void toggleRunning()}
        onOpenPalette={() => setPaletteOpen(true)}
        onOpenPrompts={() => openConsole('prompts')}
        onOpenSetup={() => toggleConsole('setup')}
      />
      <PermissionsBanner onRecheck={() => void recheckPerms()} />

      <main className="hud-main">
        <LLMResponsePane />
      </main>

      <div className={`seam ${showSeam ? 'active' : ''} ${heroStreaming ? 'streaming' : ''}`}>
        <span className="seam-scanline" aria-hidden />
        <SeamWaveform height={22} />
      </div>

      {transcriptOpen && (
        <section className="transcript-area" aria-label="Transcript">
          <TranscriptPane />
        </section>
      )}

      <Console
        tab={bootChecked ? consoleTab : 'setup'}
        starting={mockStarting}
        onSelect={openConsole}
        onClose={closeConsole}
        onStartMock={(config) => void startMock(config)}
        onStopMock={() => void stopMock()}
      />
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} onRun={runCommand} />
      <ConfirmDialog
        open={confirmingQuit}
        title="Quit Overlay?"
        body="This closes both transcription sockets, releases the global shortcuts, and drops the current transcript."
        confirmLabel="Quit"
        onCancel={() => setConfirmingQuit(false)}
        onConfirm={() => void window.api.window.quit()}
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
