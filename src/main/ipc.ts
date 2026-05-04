import { app, BrowserWindow, ipcMain } from 'electron'
import { randomUUID } from 'node:crypto'
import { IPC } from '@shared/ipc-channels'
import type {
  AudioChunkMessage,
  LlmStartResponse,
  SettingsUpdate,
  ToastEvent,
} from '@shared/types'
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
    const transcript = transcription.flattenForPrompt()
    const requestId = randomUUID()
    void groq.streamAnswer(key, transcript, {
      onToken: (delta) => win.webContents.send(IPC.llmToken, { requestId, delta }),
      onDone: (full, finishReason) => win.webContents.send(IPC.llmDone, { requestId, full, finishReason }),
      onError: (message) => win.webContents.send(IPC.llmError, { requestId, message }),
    })
    return { requestId }
  })

  ipcMain.handle(IPC.llmAbort, () => groq.abort())

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
