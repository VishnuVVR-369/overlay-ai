import { vi } from 'vitest'
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

type Listener<T> = (event: T) => void

export interface FakeApi extends OverlayApi {
  __emit: {
    transcriptUpdate: (e: TranscriptUpdate) => void
    socketStatus: (e: SocketStatusEvent) => void
    llmTrigger: () => void
    llmToken: (e: LlmTokenEvent) => void
    llmDone: (e: LlmDoneEvent) => void
    llmError: (e: LlmErrorEvent) => void
    visionTrigger: () => void
    mockStatus: (e: MockStatusEvent) => void
    mockAudioDelta: (e: MockAudioDeltaEvent) => void
    mockFeedback: (e: MockFeedbackEvent) => void
    mockPlaybackStop: () => void
    mockSessionSaved: (e: MockSessionSavedEvent) => void
    listenTrigger: () => void
    presetsChanged: (e: PresetState) => void
    toast: (e: ToastEvent) => void
    openSettings: () => void
    focus: (e: WindowFocusState) => void
    modeChanged: (e: WindowModeChangedEvent) => void
    visibilityChanged: (e: WindowVisibilityChangedEvent) => void
    answerStylesChanged: (e: AnswerStyleState) => void
    vaultChanged: (v: VaultData) => void
    panic: () => void
  }
  __state: {
    settings: SettingsStatus
    perms: PermissionStatus
    presets: PresetState
    answerStyles: AnswerStyleState
    readiness: ReadinessStatus
    transcriptionStartResult: { ok: boolean; reason?: string }
    transcriptionStatus: TranscriptionStatus
    snapshot: TranscriptSnapshot
    audioChunks: AudioChunkMessage[]
    settingsUpdates: SettingsUpdate[]
    presetOverrides: PresetOverrideUpdate[]
    activePresets: PresetId[]
    activeAnswerStyles: AnswerStyleId[]
    visionStartResponse: LlmStartResponse
    llmStartResponse: LlmStartResponse
    mockStatus: MockInterviewStatus
    mockStartResult: { ok: boolean; reason?: string; status?: MockInterviewStatus }
    mockAudioChunks: MockAudioChunkMessage[]
    mockConfigs: MockInterviewConfig[]
    mockSessionSummaries: MockSessionSummary[]
    mockSessionRecords: Record<string, MockSessionRecord>
    mockSessionDeletes: string[]
    vault: VaultData
    vaultUpdates: VaultData[]
    panicRequests: number
  }
}

export function createFakeApi(overrides?: Partial<FakeApi['__state']>): FakeApi {
  const listeners = {
    transcriptUpdate: new Set<Listener<TranscriptUpdate>>(),
    socketStatus: new Set<Listener<SocketStatusEvent>>(),
    llmTrigger: new Set<() => void>(),
    llmToken: new Set<Listener<LlmTokenEvent>>(),
    llmDone: new Set<Listener<LlmDoneEvent>>(),
    llmError: new Set<Listener<LlmErrorEvent>>(),
    visionTrigger: new Set<() => void>(),
    mockStatus: new Set<Listener<MockStatusEvent>>(),
    mockAudioDelta: new Set<Listener<MockAudioDeltaEvent>>(),
    mockFeedback: new Set<Listener<MockFeedbackEvent>>(),
    mockPlaybackStop: new Set<() => void>(),
    mockSessionSaved: new Set<Listener<MockSessionSavedEvent>>(),
    listenTrigger: new Set<() => void>(),
    presetsChanged: new Set<Listener<PresetState>>(),
    toast: new Set<Listener<ToastEvent>>(),
    openSettings: new Set<() => void>(),
    focus: new Set<Listener<WindowFocusState>>(),
    modeChanged: new Set<Listener<WindowModeChangedEvent>>(),
    visibilityChanged: new Set<Listener<WindowVisibilityChangedEvent>>(),
    answerStylesChanged: new Set<Listener<AnswerStyleState>>(),
    vaultChanged: new Set<Listener<VaultData>>(),
    panic: new Set<() => void>(),
  }

  const state: FakeApi['__state'] = {
    settings: {
      elevenlabsKeySet: false,
      groqKeySet: false,
      openaiKeySet: false,
      visionProvider: 'openai',
      visionModel: 'gpt-5.1',
      headlineFirst: true,
      vault: {
        hasResume: false,
        hasJobDescription: false,
        hasCompanyValues: false,
        hasInterviewerNotes: false,
        storiesCount: 0,
      },
    },
    perms: { mic: 'granted', screen: 'granted' },
    presets: {
      active: 'behavioral',
      presets: [
        { id: 'behavioral', label: 'Behavioral', defaultPrompt: 'd', effectivePrompt: 'd', overridden: false },
        { id: 'coding', label: 'Coding', defaultPrompt: 'd', effectivePrompt: 'd', overridden: false },
        { id: 'system-design', label: 'System Design', defaultPrompt: 'd', effectivePrompt: 'd', overridden: false },
        { id: 'negotiation', label: 'Negotiation', defaultPrompt: 'd', effectivePrompt: 'd', overridden: false },
      ],
    },
    answerStyles: {
      active: 'concise',
      styles: [
        { id: 'concise', label: 'Concise', instruction: 'short' },
        { id: 'think-aloud', label: 'Think aloud', instruction: 'steps' },
        { id: 'clarify', label: 'Clarify', instruction: 'question' },
        { id: 'edge-cases', label: 'Edge cases', instruction: 'cases' },
        { id: 'complexity', label: 'Complexity', instruction: 'cost' },
      ],
    },
    readiness: {
      checkedAt: 1,
      checks: [
        { id: 'groq-key', label: 'Groq key', level: 'fail', detail: 'Missing.' },
      ],
    },
    transcriptionStartResult: { ok: true },
    transcriptionStatus: { running: false, micState: 'idle', systemState: 'idle' },
    snapshot: { segments: [], partials: {} },
    audioChunks: [],
    settingsUpdates: [],
    presetOverrides: [],
    activePresets: [],
    activeAnswerStyles: [],
    visionStartResponse: { requestId: 'vis-1', mode: 'screen' },
    llmStartResponse: { requestId: 'llm-1', mode: 'transcript' },
    mockStatus: { state: 'idle', paused: false },
    mockStartResult: { ok: true, status: { state: 'active', paused: false, startedAt: 1, endsAt: 2 } },
    mockAudioChunks: [],
    mockConfigs: [],
    mockSessionSummaries: [],
    mockSessionRecords: {},
    mockSessionDeletes: [],
    vault: {
      resume: '',
      jobDescription: '',
      companyValues: '',
      interviewerNotes: '',
      stories: [],
    },
    vaultUpdates: [],
    panicRequests: 0,
    ...overrides,
  }

  const subscribe = <T>(set: Set<Listener<T>>, h: Listener<T>): (() => void) => {
    set.add(h)
    return () => {
      set.delete(h)
    }
  }
  const subscribeNoArg = (set: Set<() => void>, h: () => void): (() => void) => {
    set.add(h)
    return () => {
      set.delete(h)
    }
  }

  const api: FakeApi = {
    settings: {
      get: vi.fn(async () => state.settings),
      set: vi.fn(async (u: SettingsUpdate) => {
        state.settingsUpdates.push(u)
        if (u.elevenlabsKey !== undefined) state.settings.elevenlabsKeySet = !!u.elevenlabsKey
        if (u.groqKey !== undefined) state.settings.groqKeySet = !!u.groqKey
        if (u.openaiKey !== undefined) state.settings.openaiKeySet = !!u.openaiKey
        if (u.visionModel !== undefined && u.visionModel.trim()) state.settings.visionModel = u.visionModel.trim()
        if (u.headlineFirst !== undefined) state.settings.headlineFirst = !!u.headlineFirst
        return { ok: true }
      }),
    },
    vault: {
      get: vi.fn(async () => state.vault),
      set: vi.fn(async (v: VaultData) => {
        state.vaultUpdates.push(v)
        const stored = sanitizeVaultLikeMain(v)
        state.vault = stored
        state.settings.vault = {
          hasResume: stored.resume.length > 0,
          hasJobDescription: stored.jobDescription.length > 0,
          hasCompanyValues: stored.companyValues.length > 0,
          hasInterviewerNotes: stored.interviewerNotes.length > 0,
          storiesCount: stored.stories.length,
        }
        listeners.vaultChanged.forEach((l) => l(stored))
        return { ok: true }
      }),
      onChanged: (h) => subscribe<VaultData>(listeners.vaultChanged, h),
    },
    panic: {
      request: vi.fn(async () => {
        state.panicRequests += 1
      }),
      onTrigger: (h) => subscribeNoArg(listeners.panic, h),
    },
    readiness: {
      check: vi.fn(async () => state.readiness),
    },
    permissions: {
      status: vi.fn(async () => state.perms),
      requestMic: vi.fn(async () => true),
      openScreenPrefs: vi.fn(async () => undefined),
    },
    transcription: {
      start: vi.fn(async () => state.transcriptionStartResult),
      stop: vi.fn(async () => ({ ok: true })),
      status: vi.fn(async () => state.transcriptionStatus),
      sendAudio: vi.fn((chunk: AudioChunkMessage) => {
        state.audioChunks.push(chunk)
      }),
      snapshot: vi.fn(async () => state.snapshot),
      clear: vi.fn(async () => undefined),
      onUpdate: (h) => subscribe<TranscriptUpdate>(listeners.transcriptUpdate, h),
      onSocketStatus: (h) => subscribe<SocketStatusEvent>(listeners.socketStatus, h),
      onListenTrigger: (h) => subscribeNoArg(listeners.listenTrigger, h),
    },
    llm: {
      start: vi.fn(async () => state.llmStartResponse),
      abort: vi.fn(async () => undefined),
      onTrigger: (h) => subscribeNoArg(listeners.llmTrigger, h),
      onToken: (h) => subscribe<LlmTokenEvent>(listeners.llmToken, h),
      onDone: (h) => subscribe<LlmDoneEvent>(listeners.llmDone, h),
      onError: (h) => subscribe<LlmErrorEvent>(listeners.llmError, h),
    },
    mock: {
      start: vi.fn(async (config: MockInterviewConfig) => {
        state.mockConfigs.push(config)
        if (state.mockStartResult.status) state.mockStatus = state.mockStartResult.status
        return state.mockStartResult
      }),
      stop: vi.fn(async () => {
        state.mockStatus = { state: 'idle', paused: false }
        return { ok: true }
      }),
      pause: vi.fn(async () => ({ ok: true })),
      resume: vi.fn(async () => ({ ok: true })),
      status: vi.fn(async () => state.mockStatus),
      sendAudio: vi.fn((chunk: MockAudioChunkMessage) => {
        state.mockAudioChunks.push(chunk)
      }),
      onStatus: (h) => subscribe<MockStatusEvent>(listeners.mockStatus, h),
      onAudioDelta: (h) => subscribe<MockAudioDeltaEvent>(listeners.mockAudioDelta, h),
      onFeedback: (h) => subscribe<MockFeedbackEvent>(listeners.mockFeedback, h),
      onPlaybackStop: (h) => subscribeNoArg(listeners.mockPlaybackStop, h),
    },
    mockSessions: {
      list: vi.fn(async () => state.mockSessionSummaries),
      get: vi.fn(async (id: string) => state.mockSessionRecords[id] ?? null),
      delete: vi.fn(async (id: string) => {
        state.mockSessionDeletes.push(id)
        const idx = state.mockSessionSummaries.findIndex((s) => s.id === id)
        if (idx >= 0) state.mockSessionSummaries.splice(idx, 1)
        delete state.mockSessionRecords[id]
        return { ok: true }
      }),
      onSaved: (h) => subscribe<MockSessionSavedEvent>(listeners.mockSessionSaved, h),
    },
    vision: {
      start: vi.fn(async () => state.visionStartResponse),
      abort: vi.fn(async () => undefined),
      onTrigger: (h) => subscribeNoArg(listeners.visionTrigger, h),
    },
    presets: {
      get: vi.fn(async () => state.presets),
      setActive: vi.fn(async (id: PresetId) => {
        state.activePresets.push(id)
        state.presets = { ...state.presets, active: id }
      }),
      setOverride: vi.fn(async (u: PresetOverrideUpdate) => {
        state.presetOverrides.push(u)
      }),
      onChanged: (h) => subscribe<PresetState>(listeners.presetsChanged, h),
    },
    answerStyles: {
      get: vi.fn(async () => state.answerStyles),
      setActive: vi.fn(async (id: AnswerStyleId) => {
        state.activeAnswerStyles.push(id)
        state.answerStyles = { ...state.answerStyles, active: id }
      }),
      onChanged: (h) => subscribe<AnswerStyleState>(listeners.answerStylesChanged, h),
    },
    ui: {
      onToast: (h) => subscribe<ToastEvent>(listeners.toast, h),
      onOpenSettings: (h) => subscribeNoArg(listeners.openSettings, h),
    },
    loopback: {
      enable: vi.fn(async () => undefined),
      disable: vi.fn(async () => undefined),
    },
    window: {
      setMode: vi.fn(async (_m: WindowMode) => undefined),
      hide: vi.fn(async () => undefined),
      notifyUserActive: vi.fn(),
      onFocusState: (h) => subscribe<WindowFocusState>(listeners.focus, h),
      onModeChanged: (h) => subscribe<WindowModeChangedEvent>(listeners.modeChanged, h),
      onVisibilityChanged: (h) => subscribe<WindowVisibilityChangedEvent>(listeners.visibilityChanged, h),
      quit: vi.fn(async () => ({ ok: true })),
    },
    __emit: {
      transcriptUpdate: (e) => listeners.transcriptUpdate.forEach((l) => l(e)),
      socketStatus: (e) => listeners.socketStatus.forEach((l) => l(e)),
      llmTrigger: () => listeners.llmTrigger.forEach((l) => l()),
      llmToken: (e) => listeners.llmToken.forEach((l) => l(e)),
      llmDone: (e) => listeners.llmDone.forEach((l) => l(e)),
      llmError: (e) => listeners.llmError.forEach((l) => l(e)),
      visionTrigger: () => listeners.visionTrigger.forEach((l) => l()),
      mockStatus: (e) => listeners.mockStatus.forEach((l) => l(e)),
      mockAudioDelta: (e) => listeners.mockAudioDelta.forEach((l) => l(e)),
      mockFeedback: (e) => listeners.mockFeedback.forEach((l) => l(e)),
      mockPlaybackStop: () => listeners.mockPlaybackStop.forEach((l) => l()),
      mockSessionSaved: (e) => listeners.mockSessionSaved.forEach((l) => l(e)),
      listenTrigger: () => listeners.listenTrigger.forEach((l) => l()),
      presetsChanged: (e) => listeners.presetsChanged.forEach((l) => l(e)),
      toast: (e) => listeners.toast.forEach((l) => l(e)),
      openSettings: () => listeners.openSettings.forEach((l) => l()),
      focus: (e) => listeners.focus.forEach((l) => l(e)),
      modeChanged: (e) => listeners.modeChanged.forEach((l) => l(e)),
      visibilityChanged: (e) => listeners.visibilityChanged.forEach((l) => l(e)),
      answerStylesChanged: (e) => listeners.answerStylesChanged.forEach((l) => l(e)),
      vaultChanged: (v) => listeners.vaultChanged.forEach((l) => l(v)),
      panic: () => listeners.panic.forEach((l) => l()),
    },
    __state: state,
  }
  return api
}

// Mirrors the trimming and story-dropping that src/main/settings.ts does on write,
// so the renderer sees the same stored value the real main process would hand back.
function sanitizeVaultLikeMain(v: VaultData): VaultData {
  return {
    resume: v.resume.trim(),
    jobDescription: v.jobDescription.trim(),
    companyValues: v.companyValues.trim(),
    interviewerNotes: v.interviewerNotes.trim(),
    stories: v.stories
      .map((s) => ({ id: s.id, title: s.title.trim(), body: s.body.trim() }))
      .filter((s) => s.title.length > 0 && s.body.length > 0),
  }
}

export function installFakeApi(api?: FakeApi): FakeApi {
  const next = api ?? createFakeApi()
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: globalThis.window ?? {},
  })
  ;(globalThis as { window: { api: FakeApi } }).window.api = next
  return next
}
