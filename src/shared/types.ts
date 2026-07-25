export type Speaker = 'you' | 'them'
export type StreamTag = 'mic' | 'system'

export const speakerForStream = (s: StreamTag): Speaker => (s === 'mic' ? 'you' : 'them')

export interface TranscriptSegment {
  id: string
  speaker: Speaker
  status: 'partial' | 'committed'
  text: string
  startedAt: number
  committedAt?: number
}

export interface TranscriptUpdate {
  speaker: Speaker
  kind: 'partial' | 'committed'
  segmentId: string
  text: string
  startedAt: number
  committedAt?: number
}

export interface TranscriptSnapshot {
  segments: TranscriptSegment[]
  partials: { you?: TranscriptSegment; them?: TranscriptSegment }
}

export type ReadinessLevel = 'pass' | 'warn' | 'fail'

export interface ReadinessCheck {
  id: string
  label: string
  level: ReadinessLevel
  detail: string
}

export interface ReadinessStatus {
  checkedAt: number
  checks: ReadinessCheck[]
}

export interface SettingsStatus {
  elevenlabsKeySet: boolean
  groqKeySet: boolean
  openaiKeySet: boolean
  visionProvider: VisionProvider
  visionModel: string
  headlineFirst: boolean
  vault: VaultStatus
}

export interface SettingsUpdate {
  elevenlabsKey?: string
  groqKey?: string
  openaiKey?: string
  visionProvider?: VisionProvider
  visionModel?: string
  headlineFirst?: boolean
}

export interface VaultStory {
  id: string
  title: string
  body: string
}

export interface VaultData {
  resume: string
  jobDescription: string
  companyValues: string
  interviewerNotes: string
  stories: VaultStory[]
}

export interface VaultStatus {
  hasResume: boolean
  hasJobDescription: boolean
  hasCompanyValues: boolean
  hasInterviewerNotes: boolean
  storiesCount: number
}

export type VisionProvider = 'openai'

export type PresetId = 'behavioral' | 'coding' | 'system-design' | 'negotiation'
export type AnswerStyleId = 'concise' | 'think-aloud' | 'clarify' | 'edge-cases' | 'complexity'
export type MockInterviewState = 'idle' | 'connecting' | 'active' | 'paused' | 'stopping' | 'error'

export interface PresetDef {
  id: PresetId
  label: string
  defaultPrompt: string
}

export interface AnswerStyleDef {
  id: AnswerStyleId
  label: string
  instruction: string
}

export interface PresetEntry {
  id: PresetId
  label: string
  defaultPrompt: string
  effectivePrompt: string
  overridden: boolean
}

export interface PresetState {
  active: PresetId
  presets: PresetEntry[]
}

export interface AnswerStyleState {
  active: AnswerStyleId
  styles: AnswerStyleDef[]
}

export interface PresetOverrideUpdate {
  id: PresetId
  prompt: string | null
}

export interface PermissionStatus {
  mic: 'granted' | 'denied' | 'not-determined' | 'restricted' | 'unknown'
  screen: 'granted' | 'denied' | 'not-determined' | 'restricted' | 'unknown'
}

export interface AudioChunkMessage {
  stream: StreamTag
  audioBase64: string
  sampleRate: number
}

export interface MockAudioChunkMessage {
  audioBase64: string
  sampleRate: number
}

export interface MockInterviewConfig {
  presetId: PresetId
  durationMinutes: 15 | 30 | 45 | 60
}

export interface MockInterviewStatus {
  state: MockInterviewState
  startedAt?: number
  endsAt?: number
  paused: boolean
  message?: string
}

export interface MockStatusEvent extends MockInterviewStatus {}

export interface MockAudioDeltaEvent {
  audioBase64: string
  sampleRate: number
}

export interface MockFeedbackEvent {
  requestId: string
  text: string
}

export type MockRubricDimension =
  | 'clarification'
  | 'structure'
  | 'communication'
  | 'correctness'
  | 'starCompleteness'
  | 'tradeoffs'
  | 'complexity'

export interface MockRubricScore {
  dimension: MockRubricDimension
  label: string
  score: number
  evidence: string
}

export interface MockSessionAnnotation {
  transcriptIndex: number
  severity: 'good' | 'warn' | 'gap'
  note: string
  betterAnswer?: string
}

export interface MockSessionSummary {
  id: string
  presetId: PresetId
  presetLabel: string
  durationMinutes: number
  startedAt: number
  endedAt: number
  averageScore: number | null
  graded: boolean
}

export interface MockSessionRecord extends MockSessionSummary {
  transcript: TranscriptSegment[]
  legacyFeedback: string
  rubric: MockRubricScore[]
  annotations: MockSessionAnnotation[]
  strengths: string[]
  gaps: string[]
  nextDrills: string[]
  graderError?: string
}

export interface MockSessionSavedEvent {
  summary: MockSessionSummary
}

export type SocketState = 'idle' | 'connecting' | 'open' | 'reconnecting' | 'auth_error' | 'error' | 'closed'

export interface SocketStatusEvent {
  stream: StreamTag
  state: SocketState
  message?: string
}

export interface TranscriptionStatus {
  running: boolean
  micState: SocketState
  systemState: SocketState
}

export interface LlmTokenEvent {
  requestId: string
  delta: string
}

export interface LlmDoneEvent {
  requestId: string
  full: string
  finishReason?: string | null
}

export interface LlmErrorEvent {
  requestId: string
  message: string
}

export interface LlmStartResponse {
  requestId: string
  mode?: LlmEntryMode
  imageDataUrl?: string
}

export type LlmEntryMode = 'transcript' | 'screen'

export interface ToastEvent {
  level: 'info' | 'warn' | 'error'
  message: string
}

export type WindowMode = 'compact' | 'normal' | 'wide'

export interface WindowFocusState {
  focused: boolean
}

export interface WindowModeChangedEvent {
  mode: WindowMode
}

export interface WindowVisibilityChangedEvent {
  visible: boolean
}

export interface OverlayApi {
  settings: {
    get(): Promise<SettingsStatus>
    set(update: SettingsUpdate): Promise<{ ok: boolean }>
  }
  vault: {
    get(): Promise<VaultData>
    set(value: VaultData): Promise<{ ok: boolean }>
    onChanged(handler: (value: VaultData) => void): () => void
  }
  panic: {
    request(): Promise<void>
    onTrigger(handler: () => void): () => void
  }
  readiness: {
    check(): Promise<ReadinessStatus>
  }
  permissions: {
    status(): Promise<PermissionStatus>
    requestMic(): Promise<boolean>
    openScreenPrefs(): Promise<void>
  }
  transcription: {
    start(): Promise<{ ok: boolean; reason?: string }>
    stop(): Promise<{ ok: boolean }>
    status(): Promise<TranscriptionStatus>
    sendAudio(chunk: AudioChunkMessage): void
    snapshot(): Promise<TranscriptSnapshot>
    clear(): Promise<void>
    onUpdate(handler: (event: TranscriptUpdate) => void): () => void
    onSocketStatus(handler: (event: SocketStatusEvent) => void): () => void
    /** Global "toggle listening" accelerator, usable while the overlay is unfocused. */
    onListenTrigger(handler: () => void): () => void
  }
  mock: {
    start(config: MockInterviewConfig): Promise<{ ok: boolean; reason?: string; status?: MockInterviewStatus }>
    stop(): Promise<{ ok: boolean }>
    pause(): Promise<{ ok: boolean }>
    resume(): Promise<{ ok: boolean }>
    status(): Promise<MockInterviewStatus>
    sendAudio(chunk: MockAudioChunkMessage): void
    onStatus(handler: (event: MockStatusEvent) => void): () => void
    onAudioDelta(handler: (event: MockAudioDeltaEvent) => void): () => void
    onFeedback(handler: (event: MockFeedbackEvent) => void): () => void
    onPlaybackStop(handler: () => void): () => void
  }
  mockSessions: {
    list(): Promise<MockSessionSummary[]>
    get(id: string): Promise<MockSessionRecord | null>
    delete(id: string): Promise<{ ok: boolean }>
    onSaved(handler: (event: MockSessionSavedEvent) => void): () => void
  }
  llm: {
    start(): Promise<LlmStartResponse>
    abort(): Promise<void>
    onTrigger(handler: () => void): () => void
    onToken(handler: (event: LlmTokenEvent) => void): () => void
    onDone(handler: (event: LlmDoneEvent) => void): () => void
    onError(handler: (event: LlmErrorEvent) => void): () => void
  }
  vision: {
    start(): Promise<LlmStartResponse>
    abort(): Promise<void>
    onTrigger(handler: () => void): () => void
  }
  presets: {
    get(): Promise<PresetState>
    setActive(id: PresetId): Promise<void>
    setOverride(update: PresetOverrideUpdate): Promise<void>
    onChanged(handler: (state: PresetState) => void): () => void
  }
  answerStyles: {
    get(): Promise<AnswerStyleState>
    setActive(id: AnswerStyleId): Promise<void>
    onChanged(handler: (state: AnswerStyleState) => void): () => void
  }
  ui: {
    onToast(handler: (event: ToastEvent) => void): () => void
    onOpenSettings(handler: () => void): () => void
  }
  loopback: {
    enable(): Promise<void>
    disable(): Promise<void>
  }
  window: {
    setMode(mode: WindowMode): Promise<void>
    hide(): Promise<void>
    notifyUserActive(): void
    onFocusState(handler: (event: WindowFocusState) => void): () => void
    onModeChanged(handler: (event: WindowModeChangedEvent) => void): () => void
    onVisibilityChanged(handler: (event: WindowVisibilityChangedEvent) => void): () => void
    quit(): Promise<{ ok: boolean }>
  }
}

declare global {
  interface Window {
    api: OverlayApi
  }
}
