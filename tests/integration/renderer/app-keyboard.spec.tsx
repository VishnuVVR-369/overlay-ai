// @vitest-environment jsdom
import { describe, expect, it, beforeEach, vi } from 'vitest'
import { render, fireEvent, waitFor, act } from '@testing-library/react'
import { App } from '@/App'
import { useUiStore } from '@/state/ui-store'
import { useStatusStore } from '@/state/status-store'
import { useLlmStore } from '@/state/llm-store'
import { useTranscriptStore } from '@/state/transcript-store'
import { usePresetStore } from '@/state/preset-store'
import { useAnswerStyleStore } from '@/state/answer-style-store'
import { useVaultStore, emptyVault } from '@/state/vault-store'
import { installFakeApi, createFakeApi, type FakeApi } from '../../helpers/fake-window-api'

vi.mock('@/audio/capture-controller', () => ({
  capture: { start: vi.fn(async () => ({ micStarted: true, systemStarted: true, warnings: [] })), stop: vi.fn() },
}))

vi.mock('@/components/SeamWaveform', () => ({
  SeamWaveform: () => <div data-testid="waveform" />,
}))

vi.mock('@/components/Toaster', () => ({
  Toaster: () => null,
}))

vi.mock('@/markdown/MarkdownBody', () => ({
  MarkdownBody: ({ text }: { text: string }) => <div>{text}</div>,
}))
vi.mock('@/markdown/StreamingBody', () => ({
  StreamingBody: ({ chunks }: { chunks: string[] }) => <div>{chunks.join('')}</div>,
}))

let api: FakeApi

beforeEach(() => {
  useUiStore.setState({ mode: 'normal', helpOpen: false, settingsOpen: false, focused: true, permStatus: { mic: 'granted', screen: 'granted' }, expandedEntries: {}, headlineFirst: true })
  useVaultStore.setState({ data: emptyVault(), hydrated: false })
  useStatusStore.setState({ running: false, micState: 'idle', systemState: 'idle' })
  useLlmStore.setState({ entries: [] })
  useTranscriptStore.setState({ segments: [], partials: {} })
  usePresetStore.setState({
    active: 'behavioral',
    presets: [
      { id: 'behavioral', label: 'Behavioral', defaultPrompt: 'd', effectivePrompt: 'd', overridden: false },
      { id: 'coding', label: 'Coding', defaultPrompt: 'd', effectivePrompt: 'd', overridden: false },
    ],
    hydrated: true,
  })
  useAnswerStyleStore.setState({
    active: 'concise',
    styles: [
      { id: 'concise', label: 'Concise', instruction: 'short' },
      { id: 'think-aloud', label: 'Think aloud', instruction: 'steps' },
    ],
    hydrated: true,
  })
  api = installFakeApi(createFakeApi({
    settings: {
      elevenlabsKeySet: true,
      groqKeySet: true,
      openaiKeySet: true,
      visionProvider: 'openai',
      visionModel: 'gpt-5.1',
      headlineFirst: true,
      vault: { hasResume: false, hasJobDescription: false, hasCompanyValues: false, hasInterviewerNotes: false, storiesCount: 0 },
    },
  }))
})

async function bootApp(): Promise<ReturnType<typeof render>> {
  const utils = render(<App />)
  await waitFor(() => expect(api.settings.get).toHaveBeenCalled())
  await waitFor(() => expect(api.presets.get).toHaveBeenCalled())
  await waitFor(() => expect(api.answerStyles.get).toHaveBeenCalled())
  await waitFor(() => expect(api.permissions.status).toHaveBeenCalled())
  return utils
}

const press = (key: string, init: KeyboardEventInit = {}): void => {
  act(() => {
    window.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init }))
  })
}

describe('App keyboard shortcuts', () => {
  it('"?" toggles help', async () => {
    await bootApp()
    press('?')
    expect(useUiStore.getState().helpOpen).toBe(true)
    press('?')
    expect(useUiStore.getState().helpOpen).toBe(false)
  })

  it('"S" toggles settings, "Escape" closes it', async () => {
    await bootApp()
    press('s')
    expect(useUiStore.getState().settingsOpen).toBe(true)
    press('Escape')
    expect(useUiStore.getState().settingsOpen).toBe(false)
  })

  it('"S" while help is open closes help', async () => {
    await bootApp()
    press('?')
    expect(useUiStore.getState().helpOpen).toBe(true)
    press('s')
    expect(useUiStore.getState().helpOpen).toBe(false)
    expect(useUiStore.getState().settingsOpen).toBe(true)
  })

  it('Escape closes help before settings when both are open', async () => {
    const { container } = await bootApp()
    act(() => useUiStore.setState({ helpOpen: true, settingsOpen: true }))
    await waitFor(() => expect(container.querySelectorAll('.slide-over').length).toBe(2))
    press('Escape')
    await waitFor(() => expect(useUiStore.getState().helpOpen).toBe(false))
    expect(useUiStore.getState().settingsOpen).toBe(true)
    press('Escape')
    await waitFor(() => expect(useUiStore.getState().settingsOpen).toBe(false))
  })

  it('"-" calls window.api.window.setMode("compact") and updates store mode', async () => {
    await bootApp()
    press('-')
    await waitFor(() => expect(api.window.setMode).toHaveBeenCalledWith('compact'))
    expect(useUiStore.getState().mode).toBe('compact')
  })

  it('"-" toggles compact mode in both directions', async () => {
    await bootApp()
    press('-')
    await waitFor(() => expect(api.window.setMode).toHaveBeenLastCalledWith('compact'))
    expect(useUiStore.getState().mode).toBe('compact')

    press('-')
    await waitFor(() => expect(api.window.setMode).toHaveBeenLastCalledWith('normal'))
    expect(useUiStore.getState().mode).toBe('normal')
  })

  it('compact mode blocks normal-only shortcuts but still allows "-" to expand', async () => {
    const { container } = await bootApp()
    act(() => api.__emit.modeChanged({ mode: 'compact' }))
    await waitFor(() => expect(container.querySelector('.app-compact')).toBeTruthy())

    press('?')
    press('s')
    press(' ')
    press('c')
    press('q')

    expect(useUiStore.getState().helpOpen).toBe(false)
    expect(useUiStore.getState().settingsOpen).toBe(false)
    expect(api.transcription.start).not.toHaveBeenCalled()
    expect(api.transcription.clear).not.toHaveBeenCalled()
    expect(api.window.quit).not.toHaveBeenCalled()

    press('-')
    await waitFor(() => expect(api.window.setMode).toHaveBeenCalledWith('normal'))
    expect(useUiStore.getState().mode).toBe('normal')
  })

  it('"Q" triggers window.api.window.quit', async () => {
    await bootApp()
    press('q')
    await waitFor(() => expect(api.window.quit).toHaveBeenCalled())
  })

  it('"C" calls transcription.clear and resets the renderer transcript store', async () => {
    await bootApp()
    useTranscriptStore.setState({
      segments: [{ id: 'a', speaker: 'them', status: 'committed', text: 'x', startedAt: 1 }],
      partials: {},
    })
    press('c')
    await waitFor(() => expect(api.transcription.clear).toHaveBeenCalled())
    expect(useTranscriptStore.getState().segments).toHaveLength(0)
  })

  it('Space toggles transcription (start when stopped, stop when running)', async () => {
    await bootApp()
    press(' ')
    await waitFor(() => expect(api.transcription.start).toHaveBeenCalled())
    expect(useStatusStore.getState().running).toBe(true)
    press(' ')
    await waitFor(() => expect(api.transcription.stop).toHaveBeenCalled())
    expect(useStatusStore.getState().running).toBe(false)
  })

  it('shortcuts are skipped while focus is in an input', async () => {
    await bootApp()
    const input = document.createElement('input')
    document.body.appendChild(input)
    input.focus()
    fireEvent.keyDown(input, { key: 's' })
    expect(useUiStore.getState().settingsOpen).toBe(false)
  })

  it('shortcuts are skipped while focus is in textarea, select, or contenteditable targets', async () => {
    const { container } = await bootApp()
    press('s')
    await waitFor(() => expect(useUiStore.getState().settingsOpen).toBe(true))

    const textarea = await waitFor(() => container.querySelector('textarea') as HTMLTextAreaElement)
    fireEvent.keyDown(textarea, { key: 's' })
    expect(useUiStore.getState().settingsOpen).toBe(true)

    const select = await waitFor(() => container.querySelector('select') as HTMLSelectElement)
    fireEvent.keyDown(select, { key: 's' })
    expect(useUiStore.getState().settingsOpen).toBe(true)

    press('Escape')
    await waitFor(() => expect(useUiStore.getState().settingsOpen).toBe(false))
    await waitFor(() => expect(container.querySelector('.slide-over')).toBeNull())

    const editable = document.createElement('div')
    editable.setAttribute('contenteditable', 'true')
    document.body.append(editable)
    editable.focus()
    editable.dispatchEvent(new KeyboardEvent('keydown', { key: 's', bubbles: true, cancelable: true }))
    expect(useUiStore.getState().settingsOpen).toBe(false)
  })

  it('shortcuts are skipped while a modifier is held', async () => {
    await bootApp()
    press('s', { metaKey: true })
    expect(useUiStore.getState().settingsOpen).toBe(false)
    press('s', { ctrlKey: true })
    expect(useUiStore.getState().settingsOpen).toBe(false)
  })

  it('shortcuts are skipped on auto-repeat', async () => {
    await bootApp()
    press('s', { repeat: true })
    expect(useUiStore.getState().settingsOpen).toBe(false)
  })

  it('LLM trigger event from main starts an entry', async () => {
    await bootApp()
    act(() => api.__emit.llmTrigger())
    await waitFor(() => expect(api.llm.start).toHaveBeenCalled())
    await waitFor(() => expect(useLlmStore.getState().entries.length).toBe(1))
  })

  it('vision trigger event from main calls vision.start and prepends a screen-mode entry', async () => {
    await bootApp()
    act(() => api.__emit.visionTrigger())
    await waitFor(() => expect(api.vision.start).toHaveBeenCalled())
    await waitFor(() => expect(useLlmStore.getState().entries[0]?.mode).toBe('screen'))
  })

  it('llm token + done events flow into the store', async () => {
    await bootApp()
    useLlmStore.getState().startEntry('rid-1', 'transcript')
    act(() => api.__emit.llmToken({ requestId: 'rid-1', delta: 'hi ' }))
    act(() => api.__emit.llmToken({ requestId: 'rid-1', delta: 'there' }))
    act(() => api.__emit.llmDone({ requestId: 'rid-1', full: 'hi there', finishReason: 'stop' }))
    await waitFor(() => expect(useLlmStore.getState().entries[0].status).toBe('done'))
    expect(useLlmStore.getState().entries[0].text).toBe('hi there')
  })

  it('user-active pulse notifies main and throttles repeated activity', async () => {
    const nowSpy = vi.spyOn(Date, 'now').mockReturnValue(2_000)
    await bootApp()

    fireEvent.keyDown(window, { key: 'a' })
    expect(api.window.notifyUserActive).toHaveBeenCalledTimes(1)

    fireEvent.mouseMove(window)
    expect(api.window.notifyUserActive).toHaveBeenCalledTimes(1)

    nowSpy.mockReturnValue(3_501)
    fireEvent.mouseDown(window)
    expect(api.window.notifyUserActive).toHaveBeenCalledTimes(2)
    nowSpy.mockRestore()
  })

  it('Cmd+Shift+Escape calls window.api.panic.request', async () => {
    await bootApp()
    press('Escape', { metaKey: true, shiftKey: true })
    await waitFor(() => expect(api.panic.request).toHaveBeenCalledTimes(1))
  })

  it('Ctrl+Shift+Escape (Windows) also calls window.api.panic.request', async () => {
    await bootApp()
    press('Escape', { ctrlKey: true, shiftKey: true })
    await waitFor(() => expect(api.panic.request).toHaveBeenCalledTimes(1))
  })

  it('panic shortcut fires even while focus is inside an editable target', async () => {
    await bootApp()
    const input = document.createElement('textarea')
    document.body.appendChild(input)
    input.focus()
    fireEvent.keyDown(input, { key: 'Escape', metaKey: true, shiftKey: true })
    await waitFor(() => expect(api.panic.request).toHaveBeenCalledTimes(1))
  })

  it('panic:trigger event from main resets renderer state (transcript, llm, modals)', async () => {
    await bootApp()
    useTranscriptStore.setState({
      segments: [{ id: 'a', speaker: 'them', status: 'committed', text: 'q', startedAt: 1 }],
      partials: {},
    })
    useLlmStore.setState({ entries: [{ requestId: 'r', mode: 'transcript', text: 't', chunks: ['t'], status: 'done', startedAt: 1 }] })
    useUiStore.setState({ helpOpen: true, settingsOpen: true })
    useStatusStore.setState({ running: true })

    act(() => api.__emit.panic())

    expect(useTranscriptStore.getState().segments).toHaveLength(0)
    expect(useLlmStore.getState().entries).toHaveLength(0)
    expect(useUiStore.getState().helpOpen).toBe(false)
    expect(useUiStore.getState().settingsOpen).toBe(false)
    expect(useStatusStore.getState().running).toBe(false)
  })

  it('panic:trigger handler is idempotent (firing twice does not throw)', async () => {
    await bootApp()
    act(() => api.__emit.panic())
    expect(() => act(() => api.__emit.panic())).not.toThrow()
  })
})
