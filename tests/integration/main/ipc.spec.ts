import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { EventEmitter } from 'node:events'
import { makeFakeWindow, makeIpcMainStub, type FakeBrowserWindow } from '../../helpers/electron-mock'
import { IPC } from '@shared/ipc-channels'

const ipcStub = makeIpcMainStub()
const appQuitSpy = vi.fn()

vi.mock('electron', () => ({
  app: { quit: appQuitSpy },
  BrowserWindow: class {},
  ipcMain: ipcStub.ipcMain,
}))

const emptyVault = () => ({
  resume: '',
  jobDescription: '',
  companyValues: '',
  interviewerNotes: '',
  stories: [] as Array<{ id: string; title: string; body: string }>,
})

const settingsState = {
  status: {
    openaiKeySet: false,
    visionProvider: 'openai',
    visionModel: 'gpt-5.1',
    headlineFirst: true,
    vault: { hasResume: false, hasJobDescription: false, hasCompanyValues: false, hasInterviewerNotes: false, storiesCount: 0 },
  },
  openaiKey: null as string | null,
  activePresetId: 'behavioral' as 'behavioral' | 'coding' | 'system-design' | 'negotiation',
  activeAnswerStyleId: 'concise' as 'concise' | 'think-aloud' | 'clarify' | 'edge-cases' | 'complexity',
  effectivePrompt: 'SYSTEM',
  visionModel: 'gpt-5.1',
  headlineFirst: true,
  vault: emptyVault(),
  vaultUpdates: [] as ReturnType<typeof emptyVault>[],
  presetState: {
    active: 'behavioral',
    presets: [
      { id: 'behavioral', label: 'Behavioral', defaultPrompt: 'd', effectivePrompt: 'd', overridden: false },
      { id: 'coding', label: 'Coding', defaultPrompt: 'd', effectivePrompt: 'd', overridden: false },
      { id: 'system-design', label: 'System Design', defaultPrompt: 'd', effectivePrompt: 'd', overridden: false },
      { id: 'negotiation', label: 'Negotiation', defaultPrompt: 'd', effectivePrompt: 'd', overridden: false },
    ],
  },
  answerStyleState: {
    active: 'concise',
    styles: [
      { id: 'concise', label: 'Concise', instruction: 'short' },
      { id: 'think-aloud', label: 'Think aloud', instruction: 'steps' },
    ],
  },
  updates: [] as unknown[],
}

vi.mock('@main/settings', () => ({
  settings: {
    status: () => settingsState.status,
    update: vi.fn(async (u: { headlineFirst?: boolean }) => {
      settingsState.updates.push(u)
      if (u && typeof u.headlineFirst === 'boolean') {
        settingsState.headlineFirst = u.headlineFirst
        settingsState.status.headlineFirst = u.headlineFirst
      }
    }),
    getOpenAIKey: () => settingsState.openaiKey,
    getActivePresetId: () => settingsState.activePresetId,
    getActiveAnswerStyleId: () => settingsState.activeAnswerStyleId,
    getEffectivePrompt: () => settingsState.effectivePrompt,
    getVisionModel: () => settingsState.visionModel,
    getHeadlineFirst: () => settingsState.headlineFirst,
    setHeadlineFirst: vi.fn(async (v: boolean) => {
      settingsState.headlineFirst = v
      settingsState.status.headlineFirst = v
    }),
    getVault: () => settingsState.vault,
    setVault: vi.fn(async (v: typeof settingsState.vault) => {
      settingsState.vaultUpdates.push(v)
      settingsState.vault = v
    }),
    getVaultStatus: () => ({
      hasResume: settingsState.vault.resume.length > 0,
      hasJobDescription: settingsState.vault.jobDescription.length > 0,
      hasCompanyValues: settingsState.vault.companyValues.length > 0,
      hasInterviewerNotes: settingsState.vault.interviewerNotes.length > 0,
      storiesCount: settingsState.vault.stories.length,
    }),
    setActivePresetId: vi.fn(async (id: typeof settingsState.activePresetId) => {
      settingsState.activePresetId = id
    }),
    setActiveAnswerStyleId: vi.fn(async (id: typeof settingsState.activeAnswerStyleId) => {
      settingsState.activeAnswerStyleId = id
      settingsState.answerStyleState = { ...settingsState.answerStyleState, active: id }
    }),
    setPresetOverride: vi.fn(async () => undefined),
    getPresetState: () => settingsState.presetState,
    getAnswerStyleState: () => settingsState.answerStyleState,
    load: async () => undefined,
  },
}))

const triggerPanicSpy = vi.fn()

vi.mock('@main/panic', () => ({
  triggerPanic: (...args: unknown[]) => triggerPanicSpy(...args),
}))

vi.mock('@main/permissions', () => ({
  getPermissionStatus: vi.fn(() => ({ mic: 'granted', screen: 'granted' })),
  requestMicAccess: vi.fn(async () => true),
  openScreenRecordingPrefs: vi.fn(async () => undefined),
}))

class FakeTranscription extends EventEmitter {
  start = vi.fn()
  stop = vi.fn()
  ingest = vi.fn()
  snapshot = vi.fn(() => ({ segments: [], partials: {} }))
  clear = vi.fn()
  flattenForPrompt = vi.fn(() => 'Them: q')
  status = vi.fn(() => ({ running: false, micState: 'idle', systemState: 'idle' }))
}
const transcriptionInstance = new FakeTranscription()

vi.mock('@main/transcription/transcription-service', () => ({
  transcription: transcriptionInstance,
}))

const answerStreamSpy = vi.fn(async (
  _key: string,
  _system: string,
  _transcript: string,
  cb: { onToken: (d: string) => void; onDone: (full: string, fr?: string | null) => void; onError: (m: string) => void },
) => {
  cb.onToken('x')
  cb.onDone('x', 'stop')
  return 'rid'
})
const answerAbortSpy = vi.fn()

vi.mock('@main/llm/openai-answer-client', () => ({
  openaiAnswer: {
    streamAnswer: (...args: Parameters<typeof answerStreamSpy>) => answerStreamSpy(...args),
    abort: () => answerAbortSpy(),
  },
}))

const visionStreamSpy = vi.fn(async () => undefined)
const visionAbortSpy = vi.fn()

vi.mock('@main/llm/openai-vision-client', () => ({
  openaiVision: {
    streamScreenAnswer: (...args: unknown[]) => visionStreamSpy(...args),
    abort: () => visionAbortSpy(),
  },
}))

const mockStartSpy = vi.fn(async () => ({ state: 'active', paused: false, startedAt: 1, endsAt: 2 }))
const mockStopSpy = vi.fn(async () => undefined)
const mockPauseSpy = vi.fn()
const mockResumeSpy = vi.fn()
const mockIngestSpy = vi.fn()
const mockAbortSpy = vi.fn()
const mockResetContextSpy = vi.fn()
const mockStatusSpy = vi.fn(() => ({ state: 'idle', paused: false }))
const mockEmitter = new EventEmitter()

vi.mock('@main/mock/mock-interview-service', () => ({
  mockInterview: Object.assign(mockEmitter, {
    start: (...args: unknown[]) => mockStartSpy(...args),
    stop: () => mockStopSpy(),
    pause: () => mockPauseSpy(),
    resume: () => mockResumeSpy(),
    ingest: (...args: unknown[]) => mockIngestSpy(...args),
    abort: () => mockAbortSpy(),
    resetContext: () => mockResetContextSpy(),
    status: () => mockStatusSpy(),
  }),
}))

const sessionsListSpy = vi.fn(async () => [] as Array<Record<string, unknown>>)
const sessionsGetSpy = vi.fn(async (_id: string) => null as Record<string, unknown> | null)
const sessionsDeleteSpy = vi.fn(async (_id: string) => true)

vi.mock('@main/mock/mock-session-store', () => ({
  mockSessionStore: {
    load: vi.fn(async () => undefined),
    list: (...args: unknown[]) => sessionsListSpy(...args as []),
    get: (id: string) => sessionsGetSpy(id),
    delete: (id: string) => sessionsDeleteSpy(id),
    save: vi.fn(async () => undefined),
  },
}))

const captureSpy = vi.fn(async () => ({ dataUrl: 'data:image/png;base64,xxx', width: 10, height: 10, displayId: '1' }))
vi.mock('@main/vision/screen-capture', () => ({
  captureActiveDisplay: () => captureSpy(),
}))

const setModeSpy = vi.fn()
vi.mock('@main/window', () => ({
  setMode: (...args: unknown[]) => setModeSpy(...args),
}))

vi.mock('@main/shortcuts', () => ({
  getShortcutRegistration: () => ({
    ask: { ok: true, accelerator: 'Cmd+\\' },
    screenAsk: { ok: true, accelerator: 'Cmd+Shift+\\' },
    toggle: { ok: true, accelerator: 'Cmd+B' },
    wide: { ok: true, accelerator: 'Cmd+W' },
    panic: { ok: true, accelerator: 'Cmd+Shift+Escape' },
  }),
}))

let win: FakeBrowserWindow

beforeEach(async () => {
  ipcStub.registered.clear()
  ipcStub.events.clear()
  ipcStub.ipcMain.handle.mockClear()
  ipcStub.ipcMain.on.mockClear()
  appQuitSpy.mockReset()
  settingsState.openaiKey = null
  settingsState.activeAnswerStyleId = 'concise'
  settingsState.answerStyleState = {
    active: 'concise',
    styles: [
      { id: 'concise', label: 'Concise', instruction: 'short' },
      { id: 'think-aloud', label: 'Think aloud', instruction: 'steps' },
    ],
  }
  settingsState.status = {
    openaiKeySet: false,
    visionProvider: 'openai',
    visionModel: 'gpt-5.1',
    headlineFirst: true,
    vault: { hasResume: false, hasJobDescription: false, hasCompanyValues: false, hasInterviewerNotes: false, storiesCount: 0 },
  }
  settingsState.updates = []
  settingsState.headlineFirst = true
  settingsState.vault = emptyVault()
  settingsState.vaultUpdates = []
  triggerPanicSpy.mockClear()
  answerStreamSpy.mockClear()
  answerAbortSpy.mockClear()
  visionStreamSpy.mockClear()
  mockStartSpy.mockClear()
  mockStopSpy.mockReset()
  mockStopSpy.mockResolvedValue(undefined)
  mockPauseSpy.mockClear()
  mockResumeSpy.mockClear()
  mockIngestSpy.mockClear()
  mockAbortSpy.mockClear()
  mockResetContextSpy.mockClear()
  mockStatusSpy.mockClear()
  mockStatusSpy.mockReturnValue({ state: 'idle', paused: false })
  mockEmitter.removeAllListeners()
  sessionsListSpy.mockReset()
  sessionsListSpy.mockResolvedValue([])
  sessionsGetSpy.mockReset()
  sessionsGetSpy.mockResolvedValue(null)
  sessionsDeleteSpy.mockReset()
  sessionsDeleteSpy.mockResolvedValue(true)
  captureSpy.mockClear()
  setModeSpy.mockClear()
  transcriptionInstance.removeAllListeners()
  transcriptionInstance.start.mockClear()
  transcriptionInstance.stop.mockClear()
  transcriptionInstance.clear.mockClear()
  transcriptionInstance.ingest.mockClear()

  win = makeFakeWindow()
  ipcStub.setEvent({ sender: win.webContents, senderFrame: win.webContents.mainFrame })

  vi.resetModules()
  const { registerIpc } = await import('@main/ipc')
  registerIpc(win as unknown as Parameters<typeof registerIpc>[0])
})

afterEach(() => {
  transcriptionInstance.removeAllListeners()
})

describe('IPC handler registration', () => {
  it('registers exactly one handler for every channel in IPC', () => {
    const expected = [
      IPC.settingsGet, IPC.settingsSet, IPC.permStatus, IPC.permRequestMic, IPC.permOpenScreenPrefs,
      IPC.transcriptionStart, IPC.transcriptionStop, IPC.transcriptionStatus,
      IPC.mockStart, IPC.mockStop, IPC.mockPause, IPC.mockResume, IPC.mockStatus,
      IPC.mockSessionsList, IPC.mockSessionsGet, IPC.mockSessionsDelete,
      IPC.transcriptSnapshot, IPC.transcriptClear,
      IPC.llmStart, IPC.llmAbort, IPC.visionStart, IPC.visionAbort,
      IPC.presetsGet, IPC.presetsSetActive, IPC.presetsSetOverride,
      IPC.answerStylesGet, IPC.answerStylesSetActive,
      IPC.readinessCheck,
      IPC.windowSetMode, IPC.windowQuit,
      IPC.vaultGet, IPC.vaultSet, IPC.panicRequest,
    ]
    for (const ch of expected) expect(ipcStub.registered.has(ch)).toBe(true)
    expect(ipcStub.events.has(IPC.audioChunk)).toBe(true)
    expect(ipcStub.events.has(IPC.mockAudioChunk)).toBe(true)
    expect(ipcStub.events.has(IPC.windowUserActive)).toBe(true)
  })

  it('rejects invokes and drops events from untrusted senders', async () => {
    ipcStub.setEvent({ sender: new EventEmitter(), senderFrame: {} })
    await expect(ipcStub.invoke(IPC.settingsGet)).rejects.toThrow('Unauthorized IPC sender')
    ipcStub.send(IPC.audioChunk, { stream: 'mic', audioBase64: 'AAA', sampleRate: 24000 })
    expect(transcriptionInstance.ingest).not.toHaveBeenCalled()
  })

  it('retargets trusted IPC without registering duplicate handlers', async () => {
    const initialRegistrations = ipcStub.ipcMain.handle.mock.calls.length
    const nextWindow = makeFakeWindow()
    const { registerIpc } = await import('@main/ipc')
    registerIpc(nextWindow as unknown as Parameters<typeof registerIpc>[0])
    ipcStub.setEvent({
      sender: nextWindow.webContents,
      senderFrame: nextWindow.webContents.mainFrame,
    })

    expect(ipcStub.ipcMain.handle).toHaveBeenCalledTimes(initialRegistrations)
    await expect(ipcStub.invoke(IPC.settingsGet)).resolves.toMatchObject({ openaiKeySet: false })
  })
})

describe('settings IPC', () => {
  it('settings:get returns the current status', async () => {
    settingsState.status.openaiKeySet = true
    expect(await ipcStub.invoke(IPC.settingsGet)).toMatchObject({ openaiKeySet: true })
  })

  it('settings:set forwards the update to the settings store', async () => {
    await ipcStub.invoke(IPC.settingsSet, { openaiKey: 'sk-openai' })
    expect(settingsState.updates[0]).toEqual({ openaiKey: 'sk-openai' })
  })
})

describe('permissions IPC', () => {
  it('perm:status returns the permissions object', async () => {
    expect(await ipcStub.invoke(IPC.permStatus)).toEqual({ mic: 'granted', screen: 'granted' })
  })
})

describe('readiness IPC', () => {
  it('readiness:check returns local setup checks', async () => {
    settingsState.status = { openaiKeySet: true, visionProvider: 'openai', visionModel: 'gpt-5.1' }
    const result = await ipcStub.invoke(IPC.readinessCheck) as { checks: Array<{ id: string; level: string }> }
    expect(result.checks.find((c) => c.id === 'openai-key')?.level).toBe('pass')
    expect(result.checks.find((c) => c.id === 'global-shortcuts')?.level).toBe('pass')
  })
})

describe('transcription IPC', () => {
  it('transcription:start refuses with reason "missing_openai_key" when the OpenAI key is unset', async () => {
    settingsState.openaiKey = null
    expect(await ipcStub.invoke(IPC.transcriptionStart)).toEqual({ ok: false, reason: 'missing_openai_key' })
    expect(transcriptionInstance.start).not.toHaveBeenCalled()
  })

  it('transcription:start passes the key to the service when set', async () => {
    settingsState.openaiKey = 'sk-openai'
    expect(await ipcStub.invoke(IPC.transcriptionStart)).toEqual({ ok: true })
    expect(transcriptionInstance.start).toHaveBeenCalledWith('sk-openai')
  })

  it('transcription:start refuses while mock interview is active', async () => {
    mockStatusSpy.mockReturnValueOnce({ state: 'active', paused: false })
    settingsState.openaiKey = 'sk-openai'
    expect(await ipcStub.invoke(IPC.transcriptionStart)).toEqual({ ok: false, reason: 'mock_active' })
    expect(transcriptionInstance.start).not.toHaveBeenCalled()
  })

  it('audio:chunk forwards to transcription.ingest with stream tag', () => {
    ipcStub.send(IPC.audioChunk, { stream: 'mic', audioBase64: 'AAA', sampleRate: 24000 })
    expect(transcriptionInstance.ingest).toHaveBeenCalledWith({ stream: 'mic', audioBase64: 'AAA', sampleRate: 24000 })
  })

  it('transcript:clear resets the store', async () => {
    await ipcStub.invoke(IPC.transcriptClear)
    expect(transcriptionInstance.clear).toHaveBeenCalled()
  })

  it('transcript:clear resets mock context when a mock interview is active', async () => {
    mockStatusSpy.mockReturnValueOnce({ state: 'active', paused: false })
    await ipcStub.invoke(IPC.transcriptClear)
    expect(transcriptionInstance.clear).toHaveBeenCalled()
    expect(mockResetContextSpy).toHaveBeenCalled()
  })

  it('transcription "update" events broadcast on transcript:update channel', () => {
    transcriptionInstance.emit('update', { speaker: 'them', kind: 'partial', segmentId: 'a', text: 'x', startedAt: 1 })
    expect(win.webContents.send).toHaveBeenCalledWith(IPC.transcriptUpdate, expect.objectContaining({ text: 'x' }))
  })

  it('transcription "socketStatus" events broadcast on socket:status channel', () => {
    transcriptionInstance.emit('socketStatus', { stream: 'mic', state: 'open' })
    expect(win.webContents.send).toHaveBeenCalledWith(IPC.socketStatus, { stream: 'mic', state: 'open' })
  })
})

describe('mock interview IPC', () => {
  it('mock:start requires an OpenAI key', async () => {
    settingsState.openaiKey = null
    const result = await ipcStub.invoke(IPC.mockStart, { presetId: 'behavioral', durationMinutes: 30 })
    expect(result).toEqual({ ok: false, reason: 'missing_openai_key' })
    expect(mockStartSpy).not.toHaveBeenCalled()
  })

  it('mock:start refuses while live transcription is running', async () => {
    settingsState.openaiKey = 'oa'
    transcriptionInstance.status.mockReturnValueOnce({ running: true, micState: 'open', systemState: 'open' })
    const result = await ipcStub.invoke(IPC.mockStart, { presetId: 'behavioral', durationMinutes: 30 })
    expect(result).toEqual({ ok: false, reason: 'transcription_active' })
    expect(mockStartSpy).not.toHaveBeenCalled()
  })

  it('mock:start starts the service with vault context', async () => {
    settingsState.openaiKey = 'oa'
    settingsState.vault = { ...emptyVault(), resume: 'resume' }
    const result = await ipcStub.invoke(IPC.mockStart, { presetId: 'behavioral', durationMinutes: 30 }) as { ok: boolean }
    expect(result.ok).toBe(true)
    expect(mockStartSpy).toHaveBeenCalledWith('oa', { presetId: 'behavioral', durationMinutes: 30 }, expect.objectContaining({
      vault: expect.objectContaining({ resume: 'resume' }),
    }))
  })

  it('mock audio chunks and controls proxy to the service', async () => {
    ipcStub.send(IPC.mockAudioChunk, { audioBase64: 'AAA', sampleRate: 24000 })
    expect(mockIngestSpy).toHaveBeenCalledWith({ audioBase64: 'AAA', sampleRate: 24000 })
    await ipcStub.invoke(IPC.mockPause)
    await ipcStub.invoke(IPC.mockResume)
    await ipcStub.invoke(IPC.mockStop)
    expect(mockPauseSpy).toHaveBeenCalled()
    expect(mockResumeSpy).toHaveBeenCalled()
    expect(mockStopSpy).toHaveBeenCalled()
  })

  it('mock service events broadcast to renderer channels', () => {
    mockEmitter.emit('status', { state: 'active', paused: false })
    mockEmitter.emit('audioDelta', { audioBase64: 'AAA', sampleRate: 24000 })
    mockEmitter.emit('feedback', { requestId: 'fb', text: 'Good.' })
    mockEmitter.emit('playbackStop')
    expect(win.webContents.send).toHaveBeenCalledWith(IPC.mockStatusChanged, { state: 'active', paused: false })
    expect(win.webContents.send).toHaveBeenCalledWith(IPC.mockAudioDelta, { audioBase64: 'AAA', sampleRate: 24000 })
    expect(win.webContents.send).toHaveBeenCalledWith(IPC.mockFeedback, { requestId: 'fb', text: 'Good.' })
    expect(win.webContents.send).toHaveBeenCalledWith(IPC.mockPlaybackStop)
  })

  it('sessionSaved event broadcasts on mock-sessions:saved', () => {
    const summary = {
      id: 'sess-1', presetId: 'behavioral', presetLabel: 'Behavioral',
      durationMinutes: 30, startedAt: 1, endedAt: 2, averageScore: 4.0, graded: true,
    }
    mockEmitter.emit('sessionSaved', { summary })
    expect(win.webContents.send).toHaveBeenCalledWith(IPC.mockSessionSaved, { summary })
  })
})

describe('mock sessions IPC', () => {
  it('mock-sessions:list proxies to the store', async () => {
    sessionsListSpy.mockResolvedValueOnce([{ id: 'a', startedAt: 1 }])
    const result = await ipcStub.invoke(IPC.mockSessionsList)
    expect(sessionsListSpy).toHaveBeenCalled()
    expect(result).toEqual([{ id: 'a', startedAt: 1 }])
  })

  it('mock-sessions:get fetches a record by id', async () => {
    sessionsGetSpy.mockResolvedValueOnce({ id: 'a', transcript: [] } as never)
    const result = await ipcStub.invoke(IPC.mockSessionsGet, 'a') as { id: string }
    expect(sessionsGetSpy).toHaveBeenCalledWith('a')
    expect(result.id).toBe('a')
  })

  it('mock-sessions:get rejects invalid ids', async () => {
    const result = await ipcStub.invoke(IPC.mockSessionsGet, '')
    expect(result).toBeNull()
    expect(sessionsGetSpy).not.toHaveBeenCalled()
  })

  it('mock-sessions:delete returns ok flag from store result', async () => {
    sessionsDeleteSpy.mockResolvedValueOnce(true)
    expect(await ipcStub.invoke(IPC.mockSessionsDelete, 'a')).toEqual({ ok: true })
    sessionsDeleteSpy.mockResolvedValueOnce(false)
    expect(await ipcStub.invoke(IPC.mockSessionsDelete, 'missing')).toEqual({ ok: false })
  })

  it('mock-sessions:delete rejects non-string ids', async () => {
    expect(await ipcStub.invoke(IPC.mockSessionsDelete, null)).toEqual({ ok: false })
    expect(sessionsDeleteSpy).not.toHaveBeenCalled()
  })
})

describe('llm IPC', () => {
  it('llm:start with no OpenAI key sends a toast, opens settings, and emits a deferred error', async () => {
    vi.useFakeTimers()
    settingsState.openaiKey = null
    const r = await ipcStub.invoke(IPC.llmStart) as { requestId: string; mode: string }
    expect(r.mode).toBe('transcript')
    expect(win.webContents.send).toHaveBeenCalledWith(IPC.toast, expect.objectContaining({ level: 'error' }))
    expect(win.webContents.send).toHaveBeenCalledWith(IPC.settingsOpen)
    expect(answerStreamSpy).not.toHaveBeenCalled()
    vi.advanceTimersByTime(60)
    expect(win.webContents.send).toHaveBeenCalledWith(IPC.llmError, expect.objectContaining({ requestId: r.requestId }))
    vi.useRealTimers()
  })

  it('llm:start with an OpenAI key streams tokens and finishes', async () => {
    settingsState.openaiKey = 'sk-openai'
    const r = await ipcStub.invoke(IPC.llmStart) as { requestId: string }
    expect(answerStreamSpy).toHaveBeenCalled()
    expect(answerStreamSpy.mock.calls[0][1]).toContain('Answer style: Concise')
    // Allow microtasks for sync-ish callback
    await new Promise((r2) => setTimeout(r2, 0))
    expect(win.webContents.send).toHaveBeenCalledWith(IPC.llmToken, expect.objectContaining({ requestId: r.requestId, delta: 'x' }))
    expect(win.webContents.send).toHaveBeenCalledWith(IPC.llmDone, expect.objectContaining({ requestId: r.requestId, full: 'x' }))
  })

  it('llm:abort proxies to the OpenAI answer client', async () => {
    await ipcStub.invoke(IPC.llmAbort)
    expect(answerAbortSpy).toHaveBeenCalled()
  })
})

describe('vision IPC', () => {
  it('vision:start with no OpenAI key sends a toast, opens settings, and emits a deferred error', async () => {
    vi.useFakeTimers()
    settingsState.openaiKey = null
    const r = await ipcStub.invoke(IPC.visionStart) as { requestId: string; mode: string }
    expect(r.mode).toBe('screen')
    expect(win.webContents.send).toHaveBeenCalledWith(IPC.toast, expect.objectContaining({ level: 'error' }))
    expect(win.webContents.send).toHaveBeenCalledWith(IPC.settingsOpen)
    vi.advanceTimersByTime(60)
    expect(win.webContents.send).toHaveBeenCalledWith(IPC.llmError, expect.objectContaining({ requestId: r.requestId }))
    vi.useRealTimers()
    expect(visionStreamSpy).not.toHaveBeenCalled()
  })

  it('vision:start with screen permission denied sends a toast and a deferred error', async () => {
    vi.useFakeTimers()
    settingsState.openaiKey = 'oa'
    const perms = await import('@main/permissions')
    ;(perms.getPermissionStatus as unknown as ReturnType<typeof vi.fn>).mockReturnValueOnce({ mic: 'granted', screen: 'denied' })
    const r = await ipcStub.invoke(IPC.visionStart) as { requestId: string; mode: string }
    expect(r.mode).toBe('screen')
    expect(visionStreamSpy).not.toHaveBeenCalled()
    expect(win.webContents.send).toHaveBeenCalledWith(IPC.toast, expect.objectContaining({ message: expect.stringMatching(/Screen Recording/) }))
    vi.advanceTimersByTime(60)
    expect(win.webContents.send).toHaveBeenCalledWith(IPC.llmError, expect.objectContaining({ requestId: r.requestId }))
    vi.useRealTimers()
  })

  it('vision:start happy path captures the screen and streams to the OpenAI client', async () => {
    settingsState.openaiKey = 'oa'
    const r = await ipcStub.invoke(IPC.visionStart) as { requestId: string; imageDataUrl: string }
    expect(captureSpy).toHaveBeenCalled()
    expect(visionStreamSpy).toHaveBeenCalled()
    expect(visionStreamSpy.mock.calls[0][2]).toContain('Answer style: Concise')
    expect(r.imageDataUrl).toBe('data:image/png;base64,xxx')
  })

  it('vision:start surfaces a screen-capture error via toast + deferred error', async () => {
    vi.useFakeTimers()
    settingsState.openaiKey = 'oa'
    captureSpy.mockRejectedValueOnce(new Error('Captured screen image was empty.'))
    const r = await ipcStub.invoke(IPC.visionStart) as { requestId: string }
    expect(visionStreamSpy).not.toHaveBeenCalled()
    vi.advanceTimersByTime(60)
    expect(win.webContents.send).toHaveBeenCalledWith(IPC.llmError, expect.objectContaining({ requestId: r.requestId, message: expect.stringMatching(/empty/) }))
    vi.useRealTimers()
  })

  it('vision:abort proxies to the vision client', async () => {
    await ipcStub.invoke(IPC.visionAbort)
    expect(visionAbortSpy).toHaveBeenCalled()
  })
})

describe('presets IPC', () => {
  it('presets:get returns current preset state', async () => {
    expect(await ipcStub.invoke(IPC.presetsGet)).toEqual(settingsState.presetState)
  })

  it('presets:set-active rejects unknown ids', async () => {
    expect(await ipcStub.invoke(IPC.presetsSetActive, 'nonsense')).toEqual({ ok: false })
  })

  it('presets:set-active persists and broadcasts the new state on success', async () => {
    expect(await ipcStub.invoke(IPC.presetsSetActive, 'coding')).toEqual({ ok: true })
    expect(win.webContents.send).toHaveBeenCalledWith(IPC.presetsChanged, settingsState.presetState)
  })

  it('presets:set-override rejects bad payload', async () => {
    expect(await ipcStub.invoke(IPC.presetsSetOverride, null)).toEqual({ ok: false })
    expect(await ipcStub.invoke(IPC.presetsSetOverride, { id: 'unknown', prompt: 'x' })).toEqual({ ok: false })
  })

  it('presets:set-override accepts valid payload, broadcasts updated state', async () => {
    expect(await ipcStub.invoke(IPC.presetsSetOverride, { id: 'coding', prompt: 'X' })).toEqual({ ok: true })
    expect(win.webContents.send).toHaveBeenCalledWith(IPC.presetsChanged, settingsState.presetState)
  })
})

describe('answer style IPC', () => {
  it('answer-styles:get returns current answer style state', async () => {
    expect(await ipcStub.invoke(IPC.answerStylesGet)).toEqual(settingsState.answerStyleState)
  })

  it('answer-styles:set-active rejects unknown ids', async () => {
    expect(await ipcStub.invoke(IPC.answerStylesSetActive, 'nonsense')).toEqual({ ok: false })
  })

  it('answer-styles:set-active persists and broadcasts the new state on success', async () => {
    expect(await ipcStub.invoke(IPC.answerStylesSetActive, 'think-aloud')).toEqual({ ok: true })
    expect(settingsState.activeAnswerStyleId).toBe('think-aloud')
    expect(win.webContents.send).toHaveBeenCalledWith(IPC.answerStylesChanged, settingsState.answerStyleState)
  })
})

describe('window IPC', () => {
  it('window:set-mode forwards to setMode helper', async () => {
    await ipcStub.invoke(IPC.windowSetMode, 'compact')
    expect(setModeSpy).toHaveBeenCalledWith(win, 'compact')
  })

  it('window:user-active sends a focus-state event back', () => {
    ipcStub.send(IPC.windowUserActive)
    expect(win.webContents.send).toHaveBeenCalledWith(IPC.windowFocusState, { focused: true })
  })

  it('window:quit calls app.quit()', async () => {
    expect(await ipcStub.invoke(IPC.windowQuit)).toEqual({ ok: true })
    expect(mockStopSpy).toHaveBeenCalled()
    expect(transcriptionInstance.stop).toHaveBeenCalled()
    expect(appQuitSpy).toHaveBeenCalled()
  })

  it('window:quit stays open and reports a failed mock-session save', async () => {
    mockStopSpy.mockRejectedValueOnce(new Error('disk full'))

    expect(await ipcStub.invoke(IPC.windowQuit)).toEqual({ ok: false })
    expect(appQuitSpy).not.toHaveBeenCalled()
    expect(win.webContents.send).toHaveBeenCalledWith(
      IPC.toast,
      expect.objectContaining({ level: 'error', message: expect.stringMatching(/still open.*disk full/) }),
    )
  })
})

describe('vault IPC', () => {
  it('vault:get returns the current vault', async () => {
    settingsState.vault = { ...emptyVault(), resume: 'r' }
    const v = await ipcStub.invoke(IPC.vaultGet) as { resume: string }
    expect(v.resume).toBe('r')
  })

  it('vault:set persists, broadcasts, and returns {ok:true}', async () => {
    const payload = { ...emptyVault(), resume: 'r2', stories: [{ id: 's1', title: 't', body: 'b' }] }
    const r = await ipcStub.invoke(IPC.vaultSet, payload) as { ok: boolean }
    expect(r).toEqual({ ok: true })
    expect(settingsState.vaultUpdates[0]).toEqual(payload)
    expect(win.webContents.send).toHaveBeenCalledWith(IPC.vaultChanged, settingsState.vault)
  })
})

describe('panic IPC', () => {
  it('panic:request delegates to triggerPanic with the window', async () => {
    await ipcStub.invoke(IPC.panicRequest)
    expect(triggerPanicSpy).toHaveBeenCalledWith(win)
  })
})

describe('headline-first + vault prompt injection', () => {
  it('llm:start composes the system prompt with vault contents + headline directive', async () => {
    settingsState.openaiKey = 'sk-openai'
    settingsState.vault = {
      resume: 'My resume',
      jobDescription: '',
      companyValues: '',
      interviewerNotes: '',
      stories: [{ id: 's1', title: 'Stripe migration', body: 'Cut latency 40%' }],
    }
    settingsState.headlineFirst = true
    await ipcStub.invoke(IPC.llmStart)
    expect(answerStreamSpy).toHaveBeenCalled()
    const systemPrompt = answerStreamSpy.mock.calls[0][1] as string
    expect(systemPrompt).toContain('headline answer')
    expect(systemPrompt).toContain('Personal context')
    expect(systemPrompt).toContain('Stripe migration')
    expect(systemPrompt).toContain('My resume')
  })

  it('llm:start omits the headline directive when headlineFirst is false', async () => {
    settingsState.openaiKey = 'sk-openai'
    settingsState.headlineFirst = false
    await ipcStub.invoke(IPC.llmStart)
    const systemPrompt = answerStreamSpy.mock.calls[0][1] as string
    expect(systemPrompt).not.toContain('headline answer')
  })

  it('vision:start composes the system prompt with vault contents + headline directive', async () => {
    settingsState.openaiKey = 'oa'
    settingsState.vault = {
      resume: '',
      jobDescription: 'Staff role',
      companyValues: '',
      interviewerNotes: '',
      stories: [],
    }
    settingsState.headlineFirst = true
    await ipcStub.invoke(IPC.visionStart)
    expect(visionStreamSpy).toHaveBeenCalled()
    const systemPrompt = visionStreamSpy.mock.calls[0][2] as string
    expect(systemPrompt).toContain('headline answer')
    expect(systemPrompt).toContain('Staff role')
  })

  it('settings:set with headlineFirst:false flips the flag and persists', async () => {
    await ipcStub.invoke(IPC.settingsSet, { headlineFirst: false })
    expect(settingsState.updates[0]).toEqual({ headlineFirst: false })
    expect(settingsState.headlineFirst).toBe(false)
  })
})
