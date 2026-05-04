import { useCallback, useEffect, useState } from 'react'
import { TranscriptPane } from './components/TranscriptPane'
import { LLMResponsePane } from './components/LLMResponsePane'
import { SettingsModal } from './components/SettingsModal'
import { StatusBar } from './components/StatusBar'
import { Toaster } from './components/Toaster'
import { HelpPanel } from './components/HelpPanel'
import { capture } from './audio/capture-controller'
import { useTranscriptStore } from './state/transcript-store'
import { useLlmStore } from './state/llm-store'
import { useStatusStore } from './state/status-store'
import { useUiStore } from './state/ui-store'
import { usePresetStore } from './state/preset-store'

export function App(): JSX.Element {
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [bootChecked, setBootChecked] = useState(false)
  const applyTranscript = useTranscriptStore((s) => s.apply)
  const resetTranscript = useTranscriptStore((s) => s.reset)
  const startEntry = useLlmStore((s) => s.startEntry)
  const appendToken = useLlmStore((s) => s.appendToken)
  const finishEntry = useLlmStore((s) => s.finishEntry)
  const errorEntry = useLlmStore((s) => s.errorEntry)
  const setRunning = useStatusStore((s) => s.setRunning)
  const setSocket = useStatusStore((s) => s.setSocket)
  const running = useStatusStore((s) => s.running)
  const compact = useUiStore((s) => s.compact)
  const setCompact = useUiStore((s) => s.setCompact)
  const helpOpen = useUiStore((s) => s.helpOpen)
  const setHelpOpen = useUiStore((s) => s.setHelpOpen)
  const setPresetState = usePresetStore((s) => s.setState)

  const triggerLlm = useCallback(async () => {
    const { requestId } = await window.api.llm.start()
    startEntry(requestId)
  }, [startEntry])

  const toggleRunning = useCallback(async () => {
    if (running) {
      capture.stop()
      await window.api.transcription.stop()
      setRunning(false)
      return
    }
    const status = await window.api.settings.get()
    if (!status.elevenlabsKeySet || !status.groqKeySet) {
      setSettingsOpen(true)
      return
    }
    const result = await window.api.transcription.start()
    if (!result.ok) {
      setSettingsOpen(true)
      return
    }
    const captureResult = await capture.start()
    if (!captureResult.micStarted && !captureResult.systemStarted) {
      await window.api.transcription.stop()
      return
    }
    setRunning(true)
  }, [running, setRunning])

  const clearTranscript = useCallback(async () => {
    await window.api.transcription.clear()
    resetTranscript()
  }, [resetTranscript])

  const minimize = useCallback(async () => {
    await window.api.window.compact()
    setCompact(true)
  }, [setCompact])

  const expand = useCallback(async () => {
    await window.api.window.expand()
    setCompact(false)
  }, [setCompact])

  const toggleCompact = useCallback(async () => {
    if (compact) {
      await expand()
      return
    }
    setHelpOpen(false)
    await minimize()
  }, [compact, expand, minimize, setHelpOpen])

  const quit = useCallback(async () => {
    await window.api.window.quit()
  }, [])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
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
        }
        return
      }

      if (event.metaKey || event.ctrlKey || event.altKey || event.repeat) return

      if (event.key === '-') {
        event.preventDefault()
        void toggleCompact()
        return
      }

      if (compact) return

      switch (event.key) {
        case '?':
          event.preventDefault()
          setHelpOpen(true)
          break
        case 's':
        case 'S':
          event.preventDefault()
          setHelpOpen(false)
          setSettingsOpen(true)
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
    compact,
    helpOpen,
    quit,
    settingsOpen,
    setHelpOpen,
    toggleCompact,
    toggleRunning,
  ])

  useEffect(() => {
    void window.api.settings.get().then((status) => {
      if (!status.elevenlabsKeySet || !status.groqKeySet) setSettingsOpen(true)
      setBootChecked(true)
    })
    void window.api.presets.get().then(setPresetState)
  }, [setPresetState])

  useEffect(() => {
    const subs = [
      window.api.transcription.onUpdate(applyTranscript),
      window.api.transcription.onSocketStatus((evt) => setSocket(evt.stream, evt.state, evt.message)),
      window.api.llm.onTrigger(() => { void triggerLlm() }),
      window.api.llm.onToken((evt) => appendToken(evt.requestId, evt.delta)),
      window.api.llm.onDone((evt) => finishEntry(evt.requestId, evt.full)),
      window.api.llm.onError((evt) => errorEntry(evt.requestId, evt.message)),
      window.api.presets.onChanged(setPresetState),
    ]
    return () => subs.forEach((unsub) => unsub())
  }, [applyTranscript, appendToken, errorEntry, finishEntry, setPresetState, setSocket, triggerLlm])

  return (
    <div className={`app-root ${compact ? 'app-compact' : ''}`}>
      <div className="drag-region" />
      <StatusBar
        compact={compact}
        onToggleSettings={() => setSettingsOpen((v) => !v)}
        onToggleRunning={() => { void toggleRunning() }}
        onClearTranscript={() => { void clearTranscript() }}
        onOpenHelp={() => setHelpOpen(true)}
        onToggleCompact={() => { void toggleCompact() }}
        onQuit={() => { void quit() }}
      />
      {!compact && (
        <>
          <div className="transcript-area">
            <TranscriptPane />
          </div>
          <div className="llm-area">
            <LLMResponsePane />
          </div>
        </>
      )}
      <SettingsModal open={!compact && (settingsOpen || !bootChecked)} onClose={() => setSettingsOpen(false)} />
      <HelpPanel open={!compact && helpOpen} onClose={() => setHelpOpen(false)} />
      <Toaster />
    </div>
  )
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  const tagName = target.tagName.toLowerCase()
  return (
    target.isContentEditable ||
    tagName === 'input' ||
    tagName === 'textarea' ||
    tagName === 'select'
  )
}
