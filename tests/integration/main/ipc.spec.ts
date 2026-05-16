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

const settingsState = {
  status: { elevenlabsKeySet: false, groqKeySet: false, openaiKeySet: false, visionProvider: 'openai', visionModel: 'gpt-5.1' },
  elevenlabsKey: null as string | null,
  groqKey: null as string | null,
  openaiKey: null as string | null,
  activePresetId: 'behavioral' as 'behavioral' | 'coding' | 'system-design' | 'negotiation',
  activeAnswerStyleId: 'concise' as 'concise' | 'think-aloud' | 'clarify' | 'edge-cases' | 'complexity',
  effectivePrompt: 'SYSTEM',
  visionModel: 'gpt-5.1',
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
    update: vi.fn(async (u: unknown) => {
      settingsState.updates.push(u)
    }),
    getElevenLabsKey: () => settingsState.elevenlabsKey,
    getGroqKey: () => settingsState.groqKey,
    getOpenAIKey: () => settingsState.openaiKey,
    getActivePresetId: () => settingsState.activePresetId,
    getActiveAnswerStyleId: () => settingsState.activeAnswerStyleId,
    getEffectivePrompt: () => settingsState.effectivePrompt,
    getVisionModel: () => settingsState.visionModel,
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

const groqStreamSpy = vi.fn(async (
  _key: string,
  _system: string,
  _transcript: string,
  cb: { onToken: (d: string) => void; onDone: (full: string, fr?: string | null) => void; onError: (m: string) => void },
) => {
  cb.onToken('x')
  cb.onDone('x', 'stop')
  return 'rid'
})
const groqAbortSpy = vi.fn()

vi.mock('@main/llm/groq-client', () => ({
  groq: {
    streamAnswer: (...args: Parameters<typeof groqStreamSpy>) => groqStreamSpy(...args),
    abort: () => groqAbortSpy(),
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
  }),
}))

let win: FakeBrowserWindow

beforeEach(async () => {
  ipcStub.registered.clear()
  ipcStub.events.clear()
  ipcStub.ipcMain.handle.mockClear()
  ipcStub.ipcMain.on.mockClear()
  appQuitSpy.mockReset()
  settingsState.elevenlabsKey = null
  settingsState.groqKey = null
  settingsState.openaiKey = null
  settingsState.activeAnswerStyleId = 'concise'
  settingsState.answerStyleState = {
    active: 'concise',
    styles: [
      { id: 'concise', label: 'Concise', instruction: 'short' },
      { id: 'think-aloud', label: 'Think aloud', instruction: 'steps' },
    ],
  }
  settingsState.status = { elevenlabsKeySet: false, groqKeySet: false, openaiKeySet: false, visionProvider: 'openai', visionModel: 'gpt-5.1' }
  settingsState.updates = []
  groqStreamSpy.mockClear()
  visionStreamSpy.mockClear()
  captureSpy.mockClear()
  setModeSpy.mockClear()
  transcriptionInstance.removeAllListeners()
  transcriptionInstance.start.mockClear()
  transcriptionInstance.stop.mockClear()
  transcriptionInstance.clear.mockClear()
  transcriptionInstance.ingest.mockClear()

  win = makeFakeWindow()

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
      IPC.transcriptSnapshot, IPC.transcriptClear,
      IPC.llmStart, IPC.llmAbort, IPC.visionStart, IPC.visionAbort,
      IPC.presetsGet, IPC.presetsSetActive, IPC.presetsSetOverride,
      IPC.answerStylesGet, IPC.answerStylesSetActive,
      IPC.readinessCheck,
      IPC.windowSetMode, IPC.windowQuit,
    ]
    for (const ch of expected) expect(ipcStub.registered.has(ch)).toBe(true)
    expect(ipcStub.events.has(IPC.audioChunk)).toBe(true)
    expect(ipcStub.events.has(IPC.windowUserActive)).toBe(true)
  })
})

describe('settings IPC', () => {
  it('settings:get returns the current status', async () => {
    settingsState.status.groqKeySet = true
    expect(await ipcStub.invoke(IPC.settingsGet)).toMatchObject({ groqKeySet: true })
  })

  it('settings:set forwards the update to the settings store', async () => {
    await ipcStub.invoke(IPC.settingsSet, { groqKey: 'gk' })
    expect(settingsState.updates[0]).toEqual({ groqKey: 'gk' })
  })
})

describe('permissions IPC', () => {
  it('perm:status returns the permissions object', async () => {
    expect(await ipcStub.invoke(IPC.permStatus)).toEqual({ mic: 'granted', screen: 'granted' })
  })
})

describe('readiness IPC', () => {
  it('readiness:check returns local setup checks', async () => {
    settingsState.status = { elevenlabsKeySet: true, groqKeySet: true, openaiKeySet: false, visionProvider: 'openai', visionModel: 'gpt-5.1' }
    const result = await ipcStub.invoke(IPC.readinessCheck) as { checks: Array<{ id: string; level: string }> }
    expect(result.checks.find((c) => c.id === 'elevenlabs-key')?.level).toBe('pass')
    expect(result.checks.find((c) => c.id === 'openai-key')?.level).toBe('warn')
    expect(result.checks.find((c) => c.id === 'global-shortcuts')?.level).toBe('pass')
  })
})

describe('transcription IPC', () => {
  it('transcription:start refuses with reason "missing_key" when ElevenLabs key is unset', async () => {
    settingsState.elevenlabsKey = null
    expect(await ipcStub.invoke(IPC.transcriptionStart)).toEqual({ ok: false, reason: 'missing_key' })
    expect(transcriptionInstance.start).not.toHaveBeenCalled()
  })

  it('transcription:start passes the key to the service when set', async () => {
    settingsState.elevenlabsKey = 'el-key'
    expect(await ipcStub.invoke(IPC.transcriptionStart)).toEqual({ ok: true })
    expect(transcriptionInstance.start).toHaveBeenCalledWith('el-key')
  })

  it('audio:chunk forwards to transcription.ingest with stream tag', () => {
    ipcStub.send(IPC.audioChunk, { stream: 'mic', audioBase64: 'AAA', sampleRate: 16000 })
    expect(transcriptionInstance.ingest).toHaveBeenCalledWith({ stream: 'mic', audioBase64: 'AAA', sampleRate: 16000 })
  })

  it('transcript:clear resets the store', async () => {
    await ipcStub.invoke(IPC.transcriptClear)
    expect(transcriptionInstance.clear).toHaveBeenCalled()
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

describe('llm IPC', () => {
  it('llm:start with no Groq key sends a toast, opens settings, and emits a deferred error', async () => {
    vi.useFakeTimers()
    settingsState.groqKey = null
    const r = await ipcStub.invoke(IPC.llmStart) as { requestId: string; mode: string }
    expect(r.mode).toBe('transcript')
    expect(win.webContents.send).toHaveBeenCalledWith(IPC.toast, expect.objectContaining({ level: 'error' }))
    expect(win.webContents.send).toHaveBeenCalledWith(IPC.settingsOpen)
    expect(groqStreamSpy).not.toHaveBeenCalled()
    vi.advanceTimersByTime(60)
    expect(win.webContents.send).toHaveBeenCalledWith(IPC.llmError, expect.objectContaining({ requestId: r.requestId }))
    vi.useRealTimers()
  })

  it('llm:start with Groq key streams tokens and finishes', async () => {
    settingsState.groqKey = 'gr'
    const r = await ipcStub.invoke(IPC.llmStart) as { requestId: string }
    expect(groqStreamSpy).toHaveBeenCalled()
    expect(groqStreamSpy.mock.calls[0][1]).toContain('Answer style: Concise')
    // Allow microtasks for sync-ish callback
    await new Promise((r2) => setTimeout(r2, 0))
    expect(win.webContents.send).toHaveBeenCalledWith(IPC.llmToken, expect.objectContaining({ requestId: r.requestId, delta: 'x' }))
    expect(win.webContents.send).toHaveBeenCalledWith(IPC.llmDone, expect.objectContaining({ requestId: r.requestId, full: 'x' }))
  })

  it('llm:abort proxies to the Groq client', async () => {
    await ipcStub.invoke(IPC.llmAbort)
    expect(groqAbortSpy).toHaveBeenCalled()
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
    await ipcStub.invoke(IPC.windowQuit)
    expect(appQuitSpy).toHaveBeenCalled()
  })
})
