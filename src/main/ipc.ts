import { app, BrowserWindow, ipcMain } from 'electron'
import type { IpcMainEvent, IpcMainInvokeEvent } from 'electron'
import { randomUUID } from 'node:crypto'
import { IPC } from '@shared/ipc-channels'
import type {
  AnswerStyleId,
  AudioChunkMessage,
  LlmStartResponse,
  MockAudioChunkMessage,
  MockInterviewConfig,
  PresetId,
  PresetOverrideUpdate,
  ReadinessCheck,
  ReadinessStatus,
  SettingsUpdate,
  ToastEvent,
  VaultData,
  WindowMode,
} from '@shared/types'
import { composeSystemPrompt, isAnswerStyleId, isPresetId } from '@shared/prompt'
import { settings } from './settings'
import { getPermissionStatus, openScreenRecordingPrefs, requestMicAccess } from './permissions'
import { transcription } from './transcription/transcription-service'
import { openaiAnswer } from './llm/openai-answer-client'
import { openaiVision } from './llm/openai-vision-client'
import { mockInterview } from './mock/mock-interview-service'
import { sanitizeMockConfig } from './mock/mock-config'
import { mockSessionStore } from './mock/mock-session-store'
import { captureActiveDisplay } from './vision/screen-capture'
import { hideWindow, setMode } from './window'
import { getShortcutRegistration } from './shortcuts'
import { triggerPanic } from './panic'

let activeWindow: BrowserWindow | null = null
let ipcRegistered = false

export function registerIpc(win: BrowserWindow): void {
  activeWindow = win
  if (ipcRegistered) return
  ipcRegistered = true

  handleTrusted(IPC.settingsGet, () => settings.status())

  handleTrusted(IPC.settingsSet, async (update: SettingsUpdate) => {
    try {
      await settings.update(update)
      return { ok: true }
    } catch (err) {
      sendToastToActive({ level: 'error', message: (err as Error).message })
      return { ok: false }
    }
  })

  handleTrusted(IPC.readinessCheck, (): ReadinessStatus => buildReadinessStatus())

  handleTrusted(IPC.permStatus, () => getPermissionStatus())
  handleTrusted(IPC.permRequestMic, () => requestMicAccess())
  handleTrusted(IPC.permOpenScreenPrefs, () => openScreenRecordingPrefs())

  handleTrusted(IPC.transcriptionStart, () => {
    if (mockInterview.status().state !== 'idle') {
      sendToastToActive({ level: 'warn', message: 'Stop the mock interview before starting live transcription.' })
      return { ok: false, reason: 'mock_active' }
    }
    const key = settings.getOpenAIKey()
    if (!key) return { ok: false, reason: 'missing_openai_key' }
    transcription.start(key)
    return { ok: true }
  })

  handleTrusted(IPC.transcriptionStop, async () => {
    await transcription.stop()
    return { ok: true }
  })

  handleTrusted(IPC.transcriptionStatus, () => transcription.status())

  onTrusted(IPC.audioChunk, (chunk: AudioChunkMessage) => {
    transcription.ingest(chunk)
  })

  handleTrusted(IPC.mockStart, async (config: MockInterviewConfig) => {
    if (transcription.status().running) {
      sendToastToActive({ level: 'warn', message: 'Stop live transcription before starting a mock interview.' })
      return { ok: false, reason: 'transcription_active' }
    }
    const key = settings.getOpenAIKey()
    if (!key) {
      sendToastToActive({ level: 'error', message: 'OpenAI API key not set. Open Settings to add it.' })
      openSettingsForActive()
      return { ok: false, reason: 'missing_openai_key' }
    }
    const presetState = settings.getPresetState()
    const preset = presetState.presets.find((p) => p.id === config.presetId)
    try {
      const status = await mockInterview.start(
        key,
        sanitizeMockConfig(config, { presetId: settings.getActivePresetId() }),
        { preset, vault: settings.getVault() },
      )
      return { ok: true, status }
    } catch (err: unknown) {
      const message = (err as Error).message ?? 'Mock interview failed to start.'
      sendToastToActive({ level: 'error', message })
      return { ok: false, reason: message }
    }
  })

  handleTrusted(IPC.mockStop, async () => {
    try {
      await mockInterview.stop()
      return { ok: true }
    } catch (err) {
      sendToastToActive({ level: 'error', message: (err as Error).message })
      return { ok: false }
    }
  })

  handleTrusted(IPC.mockPause, () => {
    mockInterview.pause()
    return { ok: true }
  })

  handleTrusted(IPC.mockResume, () => {
    mockInterview.resume()
    return { ok: true }
  })

  handleTrusted(IPC.mockStatus, () => mockInterview.status())

  onTrusted(IPC.mockAudioChunk, (chunk: MockAudioChunkMessage) => {
    mockInterview.ingest(chunk)
  })

  handleTrusted(IPC.mockSessionsList, () => mockSessionStore.list())
  handleTrusted(IPC.mockSessionsGet, (id: unknown) => {
    if (typeof id !== 'string' || !id) return null
    return mockSessionStore.get(id)
  })
  handleTrusted(IPC.mockSessionsDelete, async (id: unknown) => {
    if (typeof id !== 'string' || !id) return { ok: false }
    const ok = await mockSessionStore.delete(id)
    return { ok }
  })

  handleTrusted(IPC.transcriptSnapshot, () => transcription.snapshot())
  handleTrusted(IPC.transcriptClear, () => {
    transcription.clear()
    if (mockInterview.status().state !== 'idle') void mockInterview.resetContext()
  })

  handleTrusted(IPC.llmStart, async (): Promise<LlmStartResponse> => {
    const key = settings.getOpenAIKey()
    if (!key) {
      const requestId = randomUUID()
      sendToastToActive({ level: 'error', message: 'OpenAI API key not set. Open Settings to add it.' })
      openSettingsForActive()
      deferSendToActive(IPC.llmError, { requestId, message: 'OpenAI API key not set' })
      return { requestId, mode: 'transcript' }
    }
    const activeId = settings.getActivePresetId()
    const styleId = settings.getActiveAnswerStyleId()
    const systemPrompt = composeSystemPrompt(settings.getEffectivePrompt(activeId), styleId, {
      vault: settings.getVault(),
      headlineFirst: settings.getHeadlineFirst(),
    })
    const transcript = transcription.flattenForPrompt()
    const requestId = randomUUID()
    void openaiAnswer.streamAnswer(key, systemPrompt, transcript, {
      onToken: (delta) => sendToActive(IPC.llmToken, { requestId, delta }),
      onDone: (full, finishReason) => sendToActive(IPC.llmDone, { requestId, full, finishReason }),
      onError: (message) => sendToActive(IPC.llmError, { requestId, message }),
    })
    return { requestId, mode: 'transcript' }
  })

  handleTrusted(IPC.llmAbort, () => openaiAnswer.abort())

  handleTrusted(IPC.visionStart, async (): Promise<LlmStartResponse> => {
    const requestId = randomUUID()
    const key = settings.getOpenAIKey()
    if (!key) {
      sendToastToActive({ level: 'error', message: 'OpenAI API key not set. Open Settings to add it.' })
      openSettingsForActive()
      deferSendToActive(IPC.llmError, { requestId, message: 'OpenAI API key not set' })
      return { requestId, mode: 'screen' }
    }

    const perms = getPermissionStatus()
    if (perms.screen !== 'granted') {
      sendToastToActive({ level: 'error', message: 'Screen Recording permission is required for screen ask.' })
      openSettingsForActive()
      deferSendToActive(IPC.llmError, { requestId, message: 'Screen Recording permission is required for screen ask' })
      return { requestId, mode: 'screen' }
    }

    let imageDataUrl = ''
    try {
      imageDataUrl = (await captureActiveDisplay()).dataUrl
    } catch (err: unknown) {
      const message = (err as Error).message ?? 'Screen capture failed'
      sendToastToActive({ level: 'error', message })
      deferSendToActive(IPC.llmError, { requestId, message })
      return { requestId, mode: 'screen' }
    }

    const activeId = settings.getActivePresetId()
    const styleId = settings.getActiveAnswerStyleId()
    const systemPrompt = composeSystemPrompt(settings.getEffectivePrompt(activeId), styleId, {
      vault: settings.getVault(),
      headlineFirst: settings.getHeadlineFirst(),
    })
    const transcript = transcription.flattenForPrompt()
    const model = settings.getVisionModel()
    void openaiVision.streamScreenAnswer(key, model, systemPrompt, transcript, imageDataUrl, {
      onToken: (delta) => sendToActive(IPC.llmToken, { requestId, delta }),
      onDone: (full, finishReason) => sendToActive(IPC.llmDone, { requestId, full, finishReason }),
      onError: (message) => sendToActive(IPC.llmError, { requestId, message }),
    })
    return { requestId, mode: 'screen', imageDataUrl }
  })

  handleTrusted(IPC.visionAbort, () => openaiVision.abort())

  handleTrusted(IPC.presetsGet, () => settings.getPresetState())

  handleTrusted(IPC.presetsSetActive, async (id: PresetId) => {
    if (!isPresetId(id)) return { ok: false }
    await settings.setActivePresetId(id)
    sendToActive(IPC.presetsChanged, settings.getPresetState())
    return { ok: true }
  })

  handleTrusted(IPC.presetsSetOverride, async (update: PresetOverrideUpdate) => {
    if (!update || !isPresetId(update.id)) return { ok: false }
    const prompt = update.prompt === null ? null : String(update.prompt)
    await settings.setPresetOverride(update.id, prompt)
    sendToActive(IPC.presetsChanged, settings.getPresetState())
    return { ok: true }
  })

  handleTrusted(IPC.answerStylesGet, () => settings.getAnswerStyleState())

  handleTrusted(IPC.answerStylesSetActive, async (id: AnswerStyleId) => {
    if (!isAnswerStyleId(id)) return { ok: false }
    await settings.setActiveAnswerStyleId(id)
    sendToActive(IPC.answerStylesChanged, settings.getAnswerStyleState())
    return { ok: true }
  })

  handleTrusted(IPC.windowSetMode, (mode: WindowMode) => setMode(requireActiveWindow(), mode))
  handleTrusted(IPC.windowHide, () => hideWindow(requireActiveWindow()))
  onTrusted(IPC.windowUserActive, () => {
    sendToActive(IPC.windowFocusState, { focused: true })
  })
  handleTrusted(IPC.windowQuit, async () => {
    await transcription.stop()
    try {
      await mockInterview.stop()
      app.quit()
      return { ok: true }
    } catch (err) {
      sendToastToActive({
        level: 'error',
        message: `Could not save the active mock interview. Overlay AI is still open. ${(err as Error).message}`,
      })
      return { ok: false }
    }
  })

  handleTrusted(IPC.vaultGet, () => settings.getVault())
  handleTrusted(IPC.vaultSet, async (payload: VaultData) => {
    try {
      await settings.setVault(payload)
      const next = settings.getVault()
      sendToActive(IPC.vaultChanged, next)
      return { ok: true }
    } catch (err) {
      sendToastToActive({ level: 'error', message: (err as Error).message })
      return { ok: false }
    }
  })

  handleTrusted(IPC.panicRequest, () => triggerPanic(requireActiveWindow()))

  transcription.on('update', (event) => {
    sendToActive(IPC.transcriptUpdate, event)
  })
  transcription.on('socketStatus', (event) => {
    sendToActive(IPC.socketStatus, event)
  })
  mockInterview.on('status', (event) => {
    sendToActive(IPC.mockStatusChanged, event)
  })
  mockInterview.on('audioDelta', (event) => {
    sendToActive(IPC.mockAudioDelta, event)
  })
  mockInterview.on('feedback', (event) => {
    sendToActive(IPC.mockFeedback, event)
  })
  mockInterview.on('playbackStop', () => {
    sendToActive(IPC.mockPlaybackStop)
  })
  mockInterview.on('sessionSaved', (event) => {
    sendToActive(IPC.mockSessionSaved, event)
  })
  mockInterview.on('error', (message) => {
    sendToastToActive({ level: 'error', message })
  })
}

function buildReadinessStatus(): ReadinessStatus {
  const status = settings.status()
  const perms = getPermissionStatus()
  const tx = transcription.status()
  const shortcuts = getShortcutRegistration()
  const checks: ReadinessCheck[] = [
    {
      id: 'openai-key',
      label: 'OpenAI key',
      level: status.openaiKeySet ? 'pass' : 'fail',
      detail: status.openaiKeySet
        ? 'Saved for realtime transcription, transcript answers, screen ask, and mock interviews.'
        : 'Missing. Add it before using live AI features.',
    },
    {
      id: 'mic-permission',
      label: 'Microphone permission',
      level: perms.mic === 'granted' ? 'pass' : 'fail',
      detail: perms.mic === 'granted' ? 'Granted.' : `Current state: ${perms.mic}. Request access before the call.`,
    },
    {
      id: 'screen-permission',
      label: 'Screen Recording permission',
      level: perms.screen === 'granted' ? 'pass' : 'warn',
      detail: perms.screen === 'granted' ? 'Granted for system audio and screen ask.' : `Current state: ${perms.screen}. System audio and screen ask may fail.`,
    },
    {
      id: 'transcription-status',
      label: 'Transcription sockets',
      level: tx.running && tx.micState === 'open' && tx.systemState === 'open' ? 'pass' : tx.running ? 'warn' : 'warn',
      detail: tx.running
        ? `Mic: ${tx.micState}; system: ${tx.systemState}.`
        : 'Not currently listening. Start once before the interview if you want a live socket check.',
    },
    {
      id: 'global-shortcuts',
      label: 'Global shortcuts',
      level: shortcutLevel(shortcuts),
      detail: shortcutDetail(shortcuts),
    },
  ]

  return { checkedAt: Date.now(), checks }
}

function shortcutLevel(registration: ReturnType<typeof getShortcutRegistration>): ReadinessCheck['level'] {
  if (!registration) return 'warn'
  return Object.values(registration).every((item) => item.ok) ? 'pass' : 'fail'
}

function shortcutDetail(registration: ReturnType<typeof getShortcutRegistration>): string {
  if (!registration) return 'Shortcut registration has not run yet.'
  const failed = Object.values(registration).filter((item) => !item.ok)
  if (failed.length === 0) {
    const labels = Object.values(registration).map((item) => item.accelerator).join(', ')
    return `Registered: ${labels}.`
  }
  return `Failed: ${failed.map((item) => item.accelerator).join(', ')}. Change conflicting app shortcuts.`
}

export function sendToast(win: BrowserWindow, toast: ToastEvent): void {
  if (!win.isDestroyed()) win.webContents.send(IPC.toast, toast)
}

function handleTrusted<Args extends unknown[], Result>(
  channel: string,
  handler: (...args: Args) => Result,
): void {
  ipcMain.handle(channel, (event, ...args) => {
    assertTrustedSender(event)
    return handler(...(args as Args))
  })
}

function onTrusted<Args extends unknown[]>(channel: string, handler: (...args: Args) => void): void {
  ipcMain.on(channel, (event, ...args) => {
    if (!isTrustedSender(event)) return
    handler(...(args as Args))
  })
}

function assertTrustedSender(event: IpcMainInvokeEvent): void {
  if (!isTrustedSender(event)) throw new Error('Unauthorized IPC sender.')
}

function isTrustedSender(event: IpcMainInvokeEvent | IpcMainEvent): boolean {
  const win = activeWindow
  return (
    !!win &&
    !win.isDestroyed() &&
    event.sender === win.webContents &&
    event.senderFrame === win.webContents.mainFrame
  )
}

function requireActiveWindow(): BrowserWindow {
  const win = activeWindow
  if (!win || win.isDestroyed()) throw new Error('Overlay window is unavailable.')
  return win
}

function sendToActive(channel: string, payload?: unknown): void {
  const win = activeWindow
  if (!win || win.isDestroyed()) return
  if (payload === undefined) win.webContents.send(channel)
  else win.webContents.send(channel, payload)
}

function sendToastToActive(toast: ToastEvent): void {
  const win = activeWindow
  if (win) sendToast(win, toast)
}

function openSettingsForActive(): void {
  sendToActive(IPC.settingsOpen)
}

function deferSendToActive(channel: string, payload: unknown): void {
  setTimeout(() => {
    sendToActive(channel, payload)
  }, 50)
}
