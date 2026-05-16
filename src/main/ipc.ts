import { app, BrowserWindow, ipcMain } from 'electron'
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
import { groq } from './llm/groq-client'
import { openaiVision } from './llm/openai-vision-client'
import { mockInterview } from './mock/mock-interview-service'
import { sanitizeMockConfig } from './mock/mock-config'
import { captureActiveDisplay } from './vision/screen-capture'
import { setMode } from './window'
import { getShortcutRegistration } from './shortcuts'
import { triggerPanic } from './panic'

export function registerIpc(win: BrowserWindow): void {
  ipcMain.handle(IPC.settingsGet, () => settings.status())

  ipcMain.handle(IPC.settingsSet, async (_evt, update: SettingsUpdate) => {
    await settings.update(update)
    return { ok: true }
  })

  ipcMain.handle(IPC.readinessCheck, (): ReadinessStatus => buildReadinessStatus())

  ipcMain.handle(IPC.permStatus, () => getPermissionStatus())
  ipcMain.handle(IPC.permRequestMic, () => requestMicAccess())
  ipcMain.handle(IPC.permOpenScreenPrefs, () => openScreenRecordingPrefs())

  ipcMain.handle(IPC.transcriptionStart, () => {
    if (mockInterview.status().state !== 'idle') {
      sendToast(win, { level: 'warn', message: 'Stop the mock interview before starting live transcription.' })
      return { ok: false, reason: 'mock_active' }
    }
    const key = settings.getElevenLabsKey()
    if (!key) return { ok: false, reason: 'missing_key' }
    transcription.start(key)
    return { ok: true }
  })

  ipcMain.handle(IPC.transcriptionStop, () => {
    transcription.stop()
    return { ok: true }
  })

  ipcMain.handle(IPC.transcriptionStatus, () => transcription.status())

  ipcMain.on(IPC.audioChunk, (_evt, chunk: AudioChunkMessage) => {
    transcription.ingest(chunk)
  })

  ipcMain.handle(IPC.mockStart, async (_evt, config: MockInterviewConfig) => {
    if (transcription.status().running) {
      sendToast(win, { level: 'warn', message: 'Stop live transcription before starting a mock interview.' })
      return { ok: false, reason: 'transcription_active' }
    }
    const key = settings.getOpenAIKey()
    if (!key) {
      sendToast(win, { level: 'error', message: 'OpenAI API key not set. Open Settings to add it.' })
      openSettings(win)
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
      sendToast(win, { level: 'error', message })
      return { ok: false, reason: message }
    }
  })

  ipcMain.handle(IPC.mockStop, async () => {
    await mockInterview.stop()
    return { ok: true }
  })

  ipcMain.handle(IPC.mockPause, () => {
    mockInterview.pause()
    return { ok: true }
  })

  ipcMain.handle(IPC.mockResume, () => {
    mockInterview.resume()
    return { ok: true }
  })

  ipcMain.handle(IPC.mockStatus, () => mockInterview.status())

  ipcMain.on(IPC.mockAudioChunk, (_evt, chunk: MockAudioChunkMessage) => {
    mockInterview.ingest(chunk)
  })

  ipcMain.handle(IPC.transcriptSnapshot, () => transcription.snapshot())
  ipcMain.handle(IPC.transcriptClear, () => {
    transcription.clear()
    if (mockInterview.status().state !== 'idle') void mockInterview.resetContext()
  })

  ipcMain.handle(IPC.llmStart, async (): Promise<LlmStartResponse> => {
    const key = settings.getGroqKey()
    if (!key) {
      const requestId = randomUUID()
      sendToast(win, { level: 'error', message: 'Groq API key not set. Open Settings to add it.' })
      openSettings(win)
      deferSend(win, IPC.llmError, { requestId, message: 'Groq API key not set' })
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
    void groq.streamAnswer(key, systemPrompt, transcript, {
      onToken: (delta) => win.webContents.send(IPC.llmToken, { requestId, delta }),
      onDone: (full, finishReason) => win.webContents.send(IPC.llmDone, { requestId, full, finishReason }),
      onError: (message) => win.webContents.send(IPC.llmError, { requestId, message }),
    })
    return { requestId, mode: 'transcript' }
  })

  ipcMain.handle(IPC.llmAbort, () => groq.abort())

  ipcMain.handle(IPC.visionStart, async (): Promise<LlmStartResponse> => {
    const requestId = randomUUID()
    const key = settings.getOpenAIKey()
    if (!key) {
      sendToast(win, { level: 'error', message: 'OpenAI API key not set. Open Settings to add it.' })
      openSettings(win)
      deferSend(win, IPC.llmError, { requestId, message: 'OpenAI API key not set' })
      return { requestId, mode: 'screen' }
    }

    const perms = getPermissionStatus()
    if (perms.screen !== 'granted') {
      sendToast(win, { level: 'error', message: 'Screen Recording permission is required for screen ask.' })
      openSettings(win)
      deferSend(win, IPC.llmError, { requestId, message: 'Screen Recording permission is required for screen ask' })
      return { requestId, mode: 'screen' }
    }

    let imageDataUrl = ''
    try {
      imageDataUrl = (await captureActiveDisplay()).dataUrl
    } catch (err: unknown) {
      const message = (err as Error).message ?? 'Screen capture failed'
      sendToast(win, { level: 'error', message })
      deferSend(win, IPC.llmError, { requestId, message })
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
      onToken: (delta) => win.webContents.send(IPC.llmToken, { requestId, delta }),
      onDone: (full, finishReason) => win.webContents.send(IPC.llmDone, { requestId, full, finishReason }),
      onError: (message) => win.webContents.send(IPC.llmError, { requestId, message }),
    })
    return { requestId, mode: 'screen', imageDataUrl }
  })

  ipcMain.handle(IPC.visionAbort, () => openaiVision.abort())

  ipcMain.handle(IPC.presetsGet, () => settings.getPresetState())

  ipcMain.handle(IPC.presetsSetActive, async (_evt, id: PresetId) => {
    if (!isPresetId(id)) return { ok: false }
    await settings.setActivePresetId(id)
    if (!win.isDestroyed()) win.webContents.send(IPC.presetsChanged, settings.getPresetState())
    return { ok: true }
  })

  ipcMain.handle(IPC.presetsSetOverride, async (_evt, update: PresetOverrideUpdate) => {
    if (!update || !isPresetId(update.id)) return { ok: false }
    const prompt = update.prompt === null ? null : String(update.prompt)
    await settings.setPresetOverride(update.id, prompt)
    if (!win.isDestroyed()) win.webContents.send(IPC.presetsChanged, settings.getPresetState())
    return { ok: true }
  })

  ipcMain.handle(IPC.answerStylesGet, () => settings.getAnswerStyleState())

  ipcMain.handle(IPC.answerStylesSetActive, async (_evt, id: AnswerStyleId) => {
    if (!isAnswerStyleId(id)) return { ok: false }
    await settings.setActiveAnswerStyleId(id)
    if (!win.isDestroyed()) win.webContents.send(IPC.answerStylesChanged, settings.getAnswerStyleState())
    return { ok: true }
  })

  ipcMain.handle(IPC.windowSetMode, (_evt, mode: WindowMode) => setMode(win, mode))
  ipcMain.on(IPC.windowUserActive, () => {
    if (!win.isDestroyed()) win.webContents.send(IPC.windowFocusState, { focused: true })
  })
  ipcMain.handle(IPC.windowQuit, () => app.quit())

  ipcMain.handle(IPC.vaultGet, () => settings.getVault())
  ipcMain.handle(IPC.vaultSet, async (_evt, payload: VaultData) => {
    await settings.setVault(payload)
    const next = settings.getVault()
    if (!win.isDestroyed()) win.webContents.send(IPC.vaultChanged, next)
    return { ok: true }
  })

  ipcMain.handle(IPC.panicRequest, () => triggerPanic(win))

  transcription.on('update', (event) => {
    if (!win.isDestroyed()) win.webContents.send(IPC.transcriptUpdate, event)
  })
  transcription.on('socketStatus', (event) => {
    if (!win.isDestroyed()) win.webContents.send(IPC.socketStatus, event)
  })
  mockInterview.on('status', (event) => {
    if (!win.isDestroyed()) win.webContents.send(IPC.mockStatusChanged, event)
  })
  mockInterview.on('audioDelta', (event) => {
    if (!win.isDestroyed()) win.webContents.send(IPC.mockAudioDelta, event)
  })
  mockInterview.on('feedback', (event) => {
    if (!win.isDestroyed()) win.webContents.send(IPC.mockFeedback, event)
  })
  mockInterview.on('playbackStop', () => {
    if (!win.isDestroyed()) win.webContents.send(IPC.mockPlaybackStop)
  })
  mockInterview.on('error', (message) => {
    sendToast(win, { level: 'error', message })
  })
}

function buildReadinessStatus(): ReadinessStatus {
  const status = settings.status()
  const perms = getPermissionStatus()
  const tx = transcription.status()
  const shortcuts = getShortcutRegistration()
  const checks: ReadinessCheck[] = [
    {
      id: 'elevenlabs-key',
      label: 'ElevenLabs key',
      level: status.elevenlabsKeySet ? 'pass' : 'fail',
      detail: status.elevenlabsKeySet ? 'Saved for realtime transcription.' : 'Missing. Add it before starting transcription.',
    },
    {
      id: 'groq-key',
      label: 'Groq key',
      level: status.groqKeySet ? 'pass' : 'fail',
      detail: status.groqKeySet ? 'Saved for transcript answers.' : 'Missing. Transcript answers cannot run.',
    },
    {
      id: 'openai-key',
      label: 'OpenAI key',
      level: status.openaiKeySet ? 'pass' : 'warn',
      detail: status.openaiKeySet ? 'Saved for screen ask.' : 'Missing. Screen ask will be unavailable.',
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

function openSettings(win: BrowserWindow): void {
  if (!win.isDestroyed()) win.webContents.send(IPC.settingsOpen)
}

function deferSend(win: BrowserWindow, channel: string, payload: unknown): void {
  setTimeout(() => {
    if (!win.isDestroyed()) win.webContents.send(channel, payload)
  }, 50)
}
