import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'
import { IPC } from '@shared/ipc-channels'
import type {
  AudioChunkMessage,
  LlmDoneEvent,
  LlmErrorEvent,
  LlmStartResponse,
  LlmTokenEvent,
  OverlayApi,
  PermissionStatus,
  SettingsStatus,
  SettingsUpdate,
  SocketStatusEvent,
  ToastEvent,
  TranscriptionStatus,
  TranscriptSnapshot,
  TranscriptUpdate,
} from '@shared/types'

function subscribe<T>(channel: string, handler: (event: T) => void): () => void {
  const listener = (_evt: IpcRendererEvent, payload: T): void => handler(payload)
  ipcRenderer.on(channel, listener)
  return () => ipcRenderer.removeListener(channel, listener)
}

const api: OverlayApi = {
  settings: {
    get: () => ipcRenderer.invoke(IPC.settingsGet) as Promise<SettingsStatus>,
    set: (update: SettingsUpdate) => ipcRenderer.invoke(IPC.settingsSet, update) as Promise<{ ok: boolean }>,
  },
  permissions: {
    status: () => ipcRenderer.invoke(IPC.permStatus) as Promise<PermissionStatus>,
    requestMic: () => ipcRenderer.invoke(IPC.permRequestMic) as Promise<boolean>,
    openScreenPrefs: () => ipcRenderer.invoke(IPC.permOpenScreenPrefs) as Promise<void>,
  },
  transcription: {
    start: () => ipcRenderer.invoke(IPC.transcriptionStart) as Promise<{ ok: boolean; reason?: string }>,
    stop: () => ipcRenderer.invoke(IPC.transcriptionStop) as Promise<{ ok: boolean }>,
    status: () => ipcRenderer.invoke(IPC.transcriptionStatus) as Promise<TranscriptionStatus>,
    sendAudio: (chunk: AudioChunkMessage) => ipcRenderer.send(IPC.audioChunk, chunk),
    snapshot: () => ipcRenderer.invoke(IPC.transcriptSnapshot) as Promise<TranscriptSnapshot>,
    clear: () => ipcRenderer.invoke(IPC.transcriptClear) as Promise<void>,
    onUpdate: (h) => subscribe<TranscriptUpdate>(IPC.transcriptUpdate, h),
    onSocketStatus: (h) => subscribe<SocketStatusEvent>(IPC.socketStatus, h),
  },
  llm: {
    start: () => ipcRenderer.invoke(IPC.llmStart) as Promise<LlmStartResponse>,
    abort: () => ipcRenderer.invoke(IPC.llmAbort) as Promise<void>,
    onTrigger: (h) => {
      const listener = (): void => h()
      ipcRenderer.on(IPC.llmTrigger, listener)
      return () => ipcRenderer.removeListener(IPC.llmTrigger, listener)
    },
    onToken: (h) => subscribe<LlmTokenEvent>(IPC.llmToken, h),
    onDone: (h) => subscribe<LlmDoneEvent>(IPC.llmDone, h),
    onError: (h) => subscribe<LlmErrorEvent>(IPC.llmError, h),
  },
  ui: {
    onToast: (h) => subscribe<ToastEvent>(IPC.toast, h),
  },
  loopback: {
    enable: () => ipcRenderer.invoke('enable-loopback-audio') as Promise<void>,
    disable: () => ipcRenderer.invoke('disable-loopback-audio') as Promise<void>,
  },
  window: {
    compact: () => ipcRenderer.invoke(IPC.windowCompact) as Promise<void>,
    expand: () => ipcRenderer.invoke(IPC.windowExpand) as Promise<void>,
    quit: () => ipcRenderer.invoke(IPC.windowQuit) as Promise<void>,
  },
}

contextBridge.exposeInMainWorld('api', api)
