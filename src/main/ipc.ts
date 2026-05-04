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
} from '@shared/types'
import { isPresetId } from '@shared/prompt'
import { settings } from './settings'
import { getPermissionStatus, openScreenRecordingPrefs, requestMicAccess } from './permissions'
import { transcription } from './transcription/transcription-service'
import { groq } from './llm/groq-client'
import { setCompact, setExpanded } from './window'

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
      win.webContents.send(IPC.llmError, { requestId, message: 'Groq API key not set' })
      return { requestId }
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
    return { requestId }
  })

  ipcMain.handle(IPC.llmAbort, () => groq.abort())

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

  ipcMain.handle(IPC.windowCompact, () => setCompact(win))
  ipcMain.handle(IPC.windowExpand, () => setExpanded(win))
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
