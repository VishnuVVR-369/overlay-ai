import { app, BrowserWindow, ipcMain } from 'electron'
import { randomUUID } from 'node:crypto'
import { IPC } from '@shared/ipc-channels'
import type {
  AudioChunkMessage,
  LlmStartResponse,
  PresetId,
  PresetOverrideUpdate,
  SettingsUpdate,
  ToastEvent,
  WindowMode,
} from '@shared/types'
import { isPresetId } from '@shared/prompt'
import { settings } from './settings'
import { getPermissionStatus, openScreenRecordingPrefs, requestMicAccess } from './permissions'
import { transcription } from './transcription/transcription-service'
import { groq } from './llm/groq-client'
import { openaiVision } from './llm/openai-vision-client'
import { captureActiveDisplay } from './vision/screen-capture'
import { setMode } from './window'

export function registerIpc(win: BrowserWindow): void {
  ipcMain.handle(IPC.settingsGet, () => settings.status())

  ipcMain.handle(IPC.settingsSet, async (_evt, update: SettingsUpdate) => {
    await settings.update(update)
    return { ok: true }
  })

  ipcMain.handle(IPC.permStatus, () => getPermissionStatus())
  ipcMain.handle(IPC.permRequestMic, () => requestMicAccess())
  ipcMain.handle(IPC.permOpenScreenPrefs, () => openScreenRecordingPrefs())

  ipcMain.handle(IPC.transcriptionStart, () => {
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

  ipcMain.handle(IPC.transcriptSnapshot, () => transcription.snapshot())
  ipcMain.handle(IPC.transcriptClear, () => {
    transcription.clear()
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
    const systemPrompt = settings.getEffectivePrompt(activeId)
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
    const systemPrompt = settings.getEffectivePrompt(activeId)
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

  ipcMain.handle(IPC.windowSetMode, (_evt, mode: WindowMode) => setMode(win, mode))
  ipcMain.on(IPC.windowUserActive, () => {
    if (!win.isDestroyed()) win.webContents.send(IPC.windowFocusState, { focused: true })
  })
  ipcMain.handle(IPC.windowQuit, () => app.quit())

  transcription.on('update', (event) => {
    if (!win.isDestroyed()) win.webContents.send(IPC.transcriptUpdate, event)
  })
  transcription.on('socketStatus', (event) => {
    if (!win.isDestroyed()) win.webContents.send(IPC.socketStatus, event)
  })
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
