import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'
import { IPC } from '@shared/ipc-channels'
import type {
  AnswerStyleId,
  AnswerStyleState,
  AudioChunkMessage,
  LlmDoneEvent,
  LlmErrorEvent,
  LlmStartResponse,
  LlmTokenEvent,
  MockAudioChunkMessage,
  MockAudioDeltaEvent,
  MockFeedbackEvent,
  MockInterviewConfig,
  MockInterviewStatus,
  MockSessionRecord,
  MockSessionSavedEvent,
  MockSessionSummary,
  MockStatusEvent,
  OverlayApi,
  PermissionStatus,
  PresetId,
  PresetOverrideUpdate,
  PresetState,
  ReadinessStatus,
  SettingsStatus,
  SettingsUpdate,
  SocketStatusEvent,
  ToastEvent,
  TranscriptionStatus,
  TranscriptSnapshot,
  TranscriptUpdate,
  VaultData,
  WindowFocusState,
  WindowMode,
  WindowModeChangedEvent,
  WindowVisibilityChangedEvent,
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
  vault: {
    get: () => ipcRenderer.invoke(IPC.vaultGet) as Promise<VaultData>,
    set: (value: VaultData) => ipcRenderer.invoke(IPC.vaultSet, value) as Promise<{ ok: boolean }>,
    onChanged: (h) => subscribe<VaultData>(IPC.vaultChanged, h),
  },
  panic: {
    request: () => ipcRenderer.invoke(IPC.panicRequest) as Promise<void>,
    onTrigger: (h) => {
      const listener = (): void => h()
      ipcRenderer.on(IPC.panicTrigger, listener)
      return () => ipcRenderer.removeListener(IPC.panicTrigger, listener)
    },
  },
  readiness: {
    check: () => ipcRenderer.invoke(IPC.readinessCheck) as Promise<ReadinessStatus>,
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
    onListenTrigger: (h) => {
      const listener = (): void => h()
      ipcRenderer.on(IPC.listenTrigger, listener)
      return () => ipcRenderer.removeListener(IPC.listenTrigger, listener)
    },
  },
  mock: {
    start: (config: MockInterviewConfig) =>
      ipcRenderer.invoke(IPC.mockStart, config) as Promise<{ ok: boolean; reason?: string; status?: MockInterviewStatus }>,
    stop: () => ipcRenderer.invoke(IPC.mockStop) as Promise<{ ok: boolean }>,
    pause: () => ipcRenderer.invoke(IPC.mockPause) as Promise<{ ok: boolean }>,
    resume: () => ipcRenderer.invoke(IPC.mockResume) as Promise<{ ok: boolean }>,
    status: () => ipcRenderer.invoke(IPC.mockStatus) as Promise<MockInterviewStatus>,
    sendAudio: (chunk: MockAudioChunkMessage) => ipcRenderer.send(IPC.mockAudioChunk, chunk),
    onStatus: (h) => subscribe<MockStatusEvent>(IPC.mockStatusChanged, h),
    onAudioDelta: (h) => subscribe<MockAudioDeltaEvent>(IPC.mockAudioDelta, h),
    onFeedback: (h) => subscribe<MockFeedbackEvent>(IPC.mockFeedback, h),
    onPlaybackStop: (h) => {
      const listener = (): void => h()
      ipcRenderer.on(IPC.mockPlaybackStop, listener)
      return () => ipcRenderer.removeListener(IPC.mockPlaybackStop, listener)
    },
  },
  mockSessions: {
    list: () => ipcRenderer.invoke(IPC.mockSessionsList) as Promise<MockSessionSummary[]>,
    get: (id: string) => ipcRenderer.invoke(IPC.mockSessionsGet, id) as Promise<MockSessionRecord | null>,
    delete: (id: string) => ipcRenderer.invoke(IPC.mockSessionsDelete, id) as Promise<{ ok: boolean }>,
    onSaved: (h) => subscribe<MockSessionSavedEvent>(IPC.mockSessionSaved, h),
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
  vision: {
    start: () => ipcRenderer.invoke(IPC.visionStart) as Promise<LlmStartResponse>,
    abort: () => ipcRenderer.invoke(IPC.visionAbort) as Promise<void>,
    onTrigger: (h) => {
      const listener = (): void => h()
      ipcRenderer.on(IPC.visionTrigger, listener)
      return () => ipcRenderer.removeListener(IPC.visionTrigger, listener)
    },
  },
  ui: {
    onToast: (h) => subscribe<ToastEvent>(IPC.toast, h),
    onOpenSettings: (h) => {
      const listener = (): void => h()
      ipcRenderer.on(IPC.settingsOpen, listener)
      return () => ipcRenderer.removeListener(IPC.settingsOpen, listener)
    },
  },
  presets: {
    get: () => ipcRenderer.invoke(IPC.presetsGet) as Promise<PresetState>,
    setActive: (id: PresetId) => ipcRenderer.invoke(IPC.presetsSetActive, id) as Promise<void>,
    setOverride: (update: PresetOverrideUpdate) =>
      ipcRenderer.invoke(IPC.presetsSetOverride, update) as Promise<void>,
    onChanged: (h) => subscribe<PresetState>(IPC.presetsChanged, h),
  },
  answerStyles: {
    get: () => ipcRenderer.invoke(IPC.answerStylesGet) as Promise<AnswerStyleState>,
    setActive: (id: AnswerStyleId) => ipcRenderer.invoke(IPC.answerStylesSetActive, id) as Promise<void>,
    onChanged: (h) => subscribe<AnswerStyleState>(IPC.answerStylesChanged, h),
  },
  loopback: {
    enable: () => ipcRenderer.invoke('enable-loopback-audio') as Promise<void>,
    disable: () => ipcRenderer.invoke('disable-loopback-audio') as Promise<void>,
  },
  window: {
    setMode: (mode: WindowMode) => ipcRenderer.invoke(IPC.windowSetMode, mode) as Promise<void>,
    hide: () => ipcRenderer.invoke(IPC.windowHide) as Promise<void>,
    notifyUserActive: () => ipcRenderer.send(IPC.windowUserActive),
    onFocusState: (h) => subscribe<WindowFocusState>(IPC.windowFocusState, h),
    onModeChanged: (h) => subscribe<WindowModeChangedEvent>(IPC.windowModeChanged, h),
    onVisibilityChanged: (h) => subscribe<WindowVisibilityChangedEvent>(IPC.windowVisibilityChanged, h),
    quit: () => ipcRenderer.invoke(IPC.windowQuit) as Promise<{ ok: boolean }>,
  },
}

contextBridge.exposeInMainWorld('api', api)
