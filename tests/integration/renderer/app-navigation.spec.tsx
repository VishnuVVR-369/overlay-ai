// @vitest-environment jsdom
import { describe, expect, it, beforeEach, vi } from 'vitest'
import { render, fireEvent, waitFor, act, screen } from '@testing-library/react'
import { App } from '@/App'
import { useUiStore } from '@/state/ui-store'
import { useStatusStore } from '@/state/status-store'
import { useMockStore } from '@/state/mock-store'
import { useLlmStore } from '@/state/llm-store'
import { useTranscriptStore } from '@/state/transcript-store'
import { usePresetStore } from '@/state/preset-store'
import { useAnswerStyleStore } from '@/state/answer-style-store'
import { useVaultStore, emptyVault } from '@/state/vault-store'
import { mockPlayback } from '@/audio/mock-playback'
import { capture } from '@/audio/capture-controller'
import { installFakeApi, createFakeApi, type FakeApi } from '../../helpers/fake-window-api'

vi.mock('@/audio/capture-controller', () => ({
  capture: {
    start: vi.fn(async () => ({ micStarted: true, systemStarted: true, warnings: [] })),
    startMock: vi.fn(async () => ({ micStarted: true, warnings: [] })),
    stop: vi.fn(),
  },
}))

vi.mock('@/audio/mock-playback', () => ({
  mockPlayback: { playPcm16: vi.fn(async () => undefined), stop: vi.fn() },
}))

vi.mock('@/components/SeamWaveform', () => ({
  SeamWaveform: () => <div data-testid="waveform" />,
}))

vi.mock('@/components/Toaster', () => ({ Toaster: () => null }))

vi.mock('@/markdown/MarkdownBody', () => ({
  MarkdownBody: ({ text }: { text: string }) => <div>{text}</div>,
}))
vi.mock('@/markdown/StreamingBody', () => ({
  StreamingBody: ({ chunks }: { chunks: string[] }) => <div>{chunks.join('')}</div>,
}))

const ALL_KEYS = {
  elevenlabsKeySet: true,
  groqKeySet: true,
  openaiKeySet: true,
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
} as const

let api: FakeApi

beforeEach(() => {
  vi.mocked(capture.start).mockReset().mockResolvedValue({ micStarted: true, systemStarted: true, warnings: [] })
  vi.mocked(capture.startMock).mockReset().mockResolvedValue({ micStarted: true, warnings: [] })
  vi.mocked(capture.stop).mockClear()
  vi.mocked(mockPlayback.stop).mockClear()
  vi.mocked(mockPlayback.playPcm16).mockClear()
  useUiStore.setState({
    mode: 'normal',
    consoleTab: null,
    paletteOpen: false,
    transcriptOpen: true,
    focused: true,
    permStatus: { mic: 'granted', screen: 'granted' },
    expandedEntries: {},
    headlineFirst: true,
  })
  useVaultStore.setState({ data: emptyVault(), hydrated: false })
  useStatusStore.setState({ running: false, startedAt: null, micState: 'idle', systemState: 'idle' })
  useMockStore.setState({ status: { state: 'idle', paused: false } })
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
  api = installFakeApi(createFakeApi({ settings: { ...ALL_KEYS } }))
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

describe('command palette', () => {
  it('Cmd+K opens the palette and Cmd+K again closes it', async () => {
    await bootApp()
    press('k', { metaKey: true })
    expect(useUiStore.getState().paletteOpen).toBe(true)
    press('k', { metaKey: true })
    expect(useUiStore.getState().paletteOpen).toBe(false)
  })

  it('Ctrl+K works for the non-mac binding', async () => {
    await bootApp()
    press('k', { ctrlKey: true })
    expect(useUiStore.getState().paletteOpen).toBe(true)
  })

  it('opens even while typing in a field, so the palette is never unreachable', async () => {
    await bootApp()
    const input = document.createElement('input')
    document.body.appendChild(input)
    input.focus()
    fireEvent.keyDown(input, { key: 'k', metaKey: true })
    expect(useUiStore.getState().paletteOpen).toBe(true)
    input.remove()
  })

  it('Escape closes the palette', async () => {
    await bootApp()
    press('k', { metaKey: true })
    press('Escape')
    expect(useUiStore.getState().paletteOpen).toBe(false)
  })

  it('filters by name and runs the highlighted action on Enter', async () => {
    const { getByLabelText } = await bootApp()
    press('k', { metaKey: true })
    const search = getByLabelText('Search actions') as HTMLInputElement
    fireEvent.change(search, { target: { value: 'screen' } })
    expect(screen.getByText('Ask from screen')).toBeTruthy()
    fireEvent.keyDown(search, { key: 'Enter' })
    await waitFor(() => expect(api.vision.start).toHaveBeenCalled())
    expect(useUiStore.getState().paletteOpen).toBe(false)
  })

  it('says so when nothing matches', async () => {
    const { getByLabelText } = await bootApp()
    press('k', { metaKey: true })
    fireEvent.change(getByLabelText('Search actions'), { target: { value: 'zzzznope' } })
    expect(screen.getByText(/No action matches/)).toBeTruthy()
  })

  it('arrow keys move the highlight', async () => {
    const { getByLabelText, container } = await bootApp()
    press('k', { metaKey: true })
    const search = getByLabelText('Search actions')
    const activeLabel = (): string | undefined =>
      container.querySelector('[data-active="true"] .palette-item-label')?.textContent ?? undefined

    const first = activeLabel()
    expect(first).toBeTruthy()
    fireEvent.keyDown(search, { key: 'ArrowDown' })
    expect(activeLabel()).not.toBe(first)
    fireEvent.keyDown(search, { key: 'ArrowUp' })
    expect(activeLabel()).toBe(first)
  })

  it('hides actions that do not apply — clearing needs a transcript to clear', async () => {
    await bootApp()
    press('k', { metaKey: true })
    expect(screen.queryByText('Clear transcript')).toBeNull()

    act(() =>
      useTranscriptStore.setState({
        segments: [{ id: 'a', speaker: 'them', status: 'committed', text: 'x', startedAt: 1 }],
        partials: {},
      }),
    )
    await waitFor(() => expect(screen.getByText('Clear transcript')).toBeTruthy())
  })

  it('clears the transcript through main and resets the renderer store', async () => {
    await bootApp()
    act(() =>
      useTranscriptStore.setState({
        segments: [{ id: 'a', speaker: 'them', status: 'committed', text: 'x', startedAt: 1 }],
        partials: {},
      }),
    )
    press('k', { metaKey: true })
    fireEvent.click(screen.getByText('Clear transcript'))
    await waitFor(() => expect(api.transcription.clear).toHaveBeenCalled())
    expect(useTranscriptStore.getState().segments).toHaveLength(0)
  })

  it('toggles listening, relabelling itself between runs', async () => {
    await bootApp()
    press('k', { metaKey: true })
    fireEvent.click(screen.getByText('Start listening'))
    await waitFor(() => expect(api.transcription.start).toHaveBeenCalled())
    expect(useStatusStore.getState().running).toBe(true)

    press('k', { metaKey: true })
    fireEvent.click(screen.getByText('Stop listening'))
    await waitFor(() => expect(api.transcription.stop).toHaveBeenCalled())
    expect(useStatusStore.getState().running).toBe(false)
  })

  it('marks a failed capture side instead of presenting both streams as healthy', async () => {
    vi.mocked(capture.start).mockResolvedValueOnce({
      micStarted: false,
      systemStarted: true,
      warnings: ['Microphone capture failed: permission denied'],
    })
    await bootApp()
    press('k', { metaKey: true })
    fireEvent.click(screen.getByText('Start listening'))
    await waitFor(() => expect(useStatusStore.getState().running).toBe(true))

    expect(useStatusStore.getState()).toMatchObject({
      micState: 'error',
      micMessage: 'Microphone capture failed: permission denied',
    })

    act(() => api.__emit.socketStatus({ stream: 'mic', state: 'open' }))
    expect(useStatusStore.getState()).toMatchObject({
      micState: 'error',
      micMessage: 'Microphone capture failed: permission denied',
    })
  })

  it('keeps both capture errors visible when stopping unusable sockets', async () => {
    vi.mocked(capture.start).mockResolvedValueOnce({
      micStarted: false,
      systemStarted: false,
      warnings: [
        'Microphone capture failed: permission denied',
        'System audio capture failed: permission denied',
      ],
    })
    await bootApp()
    press('k', { metaKey: true })
    fireEvent.click(screen.getByText('Start listening'))
    await waitFor(() => expect(api.transcription.stop).toHaveBeenCalled())

    act(() => {
      api.__emit.socketStatus({ stream: 'mic', state: 'closed' })
      api.__emit.socketStatus({ stream: 'system', state: 'closed' })
    })
    expect(useStatusStore.getState()).toMatchObject({
      running: false,
      micState: 'error',
      systemState: 'error',
    })
  })

  it('hides the overlay through main rather than faking it in the renderer', async () => {
    await bootApp()
    press('k', { metaKey: true })
    fireEvent.click(screen.getByText('Hide overlay'))
    await waitFor(() => expect(api.window.hide).toHaveBeenCalled())
  })
})

describe('console navigation', () => {
  it('Cmd+, opens Setup', async () => {
    await bootApp()
    press(',', { metaKey: true })
    expect(useUiStore.getState().consoleTab).toBe('setup')
  })

  it('Cmd+, opens Setup while typing in a personal-context field', async () => {
    await bootApp()
    act(() => useUiStore.getState().openConsole('context'))
    const resume = await screen.findByRole('textbox', {
      name: /Resume \/ background/,
    })
    resume.focus()

    fireEvent.keyDown(resume, { key: ',', metaKey: true })

    expect(useUiStore.getState().consoleTab).toBe('setup')
  })

  it('"?" toggles Help', async () => {
    await bootApp()
    press('?')
    expect(useUiStore.getState().consoleTab).toBe('help')
    press('?')
    expect(useUiStore.getState().consoleTab).toBeNull()
  })

  it('Escape closes the console', async () => {
    await bootApp()
    press('?')
    press('Escape')
    expect(useUiStore.getState().consoleTab).toBeNull()
  })

  it('opening a second section replaces the first instead of stacking panels', async () => {
    const { container } = await bootApp()
    press('?')
    await waitFor(() => expect(container.querySelectorAll('.console').length).toBe(1))
    press(',', { metaKey: true })
    await waitFor(() => expect(useUiStore.getState().consoleTab).toBe('setup'))
    expect(container.querySelectorAll('.console').length).toBe(1)
  })

  it('tab strip switches sections in place', async () => {
    const { getByRole } = await bootApp()
    press('?')
    fireEvent.click(getByRole('button', { name: 'Practice' }))
    expect(useUiStore.getState().consoleTab).toBe('practice')
  })

  it('a command that opens the console dismisses the palette behind it', async () => {
    await bootApp()
    press('k', { metaKey: true })
    fireEvent.click(screen.getByText('Mock history & scores'))
    expect(useUiStore.getState().consoleTab).toBe('history')
    expect(useUiStore.getState().paletteOpen).toBe(false)
  })

  it('Escape unwinds the palette before the console when both are open', async () => {
    await bootApp()
    act(() => useUiStore.setState({ consoleTab: 'help', paletteOpen: true }))
    press('Escape')
    expect(useUiStore.getState().paletteOpen).toBe(false)
    expect(useUiStore.getState().consoleTab).toBe('help')
    press('Escape')
    expect(useUiStore.getState().consoleTab).toBeNull()
  })

  it('in-window keys are ignored while typing', async () => {
    await bootApp()
    const input = document.createElement('input')
    document.body.appendChild(input)
    input.focus()
    fireEvent.keyDown(input, { key: '?' })
    expect(useUiStore.getState().consoleTab).toBeNull()
    input.remove()
  })

  it('in-window keys are ignored in textarea and contenteditable targets', async () => {
    const { container } = await bootApp()
    press(',', { metaKey: true })
    await waitFor(() => expect(useUiStore.getState().consoleTab).toBe('setup'))

    const textarea = await waitFor(() => {
      const el = container.querySelector('input')
      expect(el).toBeTruthy()
      return el as HTMLInputElement
    })
    fireEvent.keyDown(textarea, { key: '?' })
    expect(useUiStore.getState().consoleTab).toBe('setup')

    const editable = document.createElement('div')
    editable.setAttribute('contenteditable', 'true')
    document.body.append(editable)
    editable.focus()
    editable.dispatchEvent(new KeyboardEvent('keydown', { key: '?', bubbles: true, cancelable: true }))
    expect(useUiStore.getState().consoleTab).toBe('setup')
    editable.remove()
  })

  it('in-window keys are ignored on auto-repeat', async () => {
    await bootApp()
    press('?', { repeat: true })
    expect(useUiStore.getState().consoleTab).toBeNull()
  })

  it('in-window keys are inert in compact mode', async () => {
    const { container } = await bootApp()
    act(() => api.__emit.modeChanged({ mode: 'compact' }))
    await waitFor(() => expect(container.querySelector('.app-compact')).toBeTruthy())
    press('?')
    expect(useUiStore.getState().consoleTab).toBeNull()
  })
})

describe('destructive actions', () => {
  it('quitting asks first and does nothing until confirmed', async () => {
    await bootApp()
    press('k', { metaKey: true })
    fireEvent.click(screen.getByText('Quit Overlay'))
    await waitFor(() => expect(screen.getByText('Quit Overlay?')).toBeTruthy())
    expect(api.window.quit).not.toHaveBeenCalled()

    fireEvent.click(screen.getByText('Cancel'))
    await waitFor(() => expect(screen.queryByText('Quit Overlay?')).toBeNull())
    expect(api.window.quit).not.toHaveBeenCalled()

    press('k', { metaKey: true })
    fireEvent.click(screen.getByText('Quit Overlay'))
    fireEvent.click(screen.getByRole('button', { name: 'Quit' }))
    await waitFor(() => expect(api.window.quit).toHaveBeenCalled())
  })

  it('Escape backs out of the quit confirmation', async () => {
    await bootApp()
    press('k', { metaKey: true })
    fireEvent.click(screen.getByText('Quit Overlay'))
    await waitFor(() => expect(screen.getByText('Quit Overlay?')).toBeTruthy())
    press('Escape')
    await waitFor(() => expect(screen.queryByText('Quit Overlay?')).toBeNull())
  })

  it('panic is never confirmed — it is the emergency path', async () => {
    await bootApp()
    press('k', { metaKey: true })
    fireEvent.click(screen.getByText('Panic — wipe and hide'))
    await waitFor(() => expect(api.panic.request).toHaveBeenCalled())
  })

  it('Cmd+Shift+Escape requests panic', async () => {
    await bootApp()
    press('Escape', { metaKey: true, shiftKey: true })
    await waitFor(() => expect(api.panic.request).toHaveBeenCalledTimes(1))
  })

  it('Ctrl+Shift+Escape requests panic on Windows', async () => {
    await bootApp()
    press('Escape', { ctrlKey: true, shiftKey: true })
    await waitFor(() => expect(api.panic.request).toHaveBeenCalledTimes(1))
  })

  it('panic fires even while focus is inside an editable target', async () => {
    await bootApp()
    const input = document.createElement('textarea')
    document.body.appendChild(input)
    input.focus()
    fireEvent.keyDown(input, { key: 'Escape', metaKey: true, shiftKey: true })
    await waitFor(() => expect(api.panic.request).toHaveBeenCalledTimes(1))
    input.remove()
  })

  it('panic:trigger from main wipes transcript, answers, mock, and every overlay', async () => {
    await bootApp()
    act(() => {
      useTranscriptStore.setState({
        segments: [{ id: 'a', speaker: 'them', status: 'committed', text: 'q', startedAt: 1 }],
        partials: {},
      })
      useLlmStore.setState({
        entries: [{ requestId: 'r', mode: 'transcript', text: 't', chunks: ['t'], status: 'done', startedAt: 1 }],
      })
      useUiStore.setState({ consoleTab: 'setup', paletteOpen: true })
      useStatusStore.setState({ running: true })
      useMockStore.setState({ status: { state: 'active', paused: false } })
    })

    act(() => api.__emit.panic())

    expect(useTranscriptStore.getState().segments).toHaveLength(0)
    expect(useLlmStore.getState().entries).toHaveLength(0)
    expect(useUiStore.getState().consoleTab).toBeNull()
    expect(useUiStore.getState().paletteOpen).toBe(false)
    expect(useStatusStore.getState().running).toBe(false)
    expect(useMockStore.getState().status.state).toBe('idle')
  })

  it('panic:trigger is idempotent', async () => {
    await bootApp()
    act(() => api.__emit.panic())
    expect(() => act(() => api.__emit.panic())).not.toThrow()
  })
})

describe('main-process events', () => {
  it('the global listen accelerator toggles transcription without the overlay being focused', async () => {
    await bootApp()
    act(() => api.__emit.listenTrigger())
    await waitFor(() => expect(api.transcription.start).toHaveBeenCalled())
    expect(useStatusStore.getState().running).toBe(true)
  })

  it('llm trigger from main starts an entry', async () => {
    await bootApp()
    act(() => api.__emit.llmTrigger())
    await waitFor(() => expect(api.llm.start).toHaveBeenCalled())
    await waitFor(() => expect(useLlmStore.getState().entries.length).toBe(1))
  })

  it('vision trigger from main prepends a screen-mode entry', async () => {
    await bootApp()
    act(() => api.__emit.visionTrigger())
    await waitFor(() => expect(api.vision.start).toHaveBeenCalled())
    await waitFor(() => expect(useLlmStore.getState().entries[0]?.mode).toBe('screen'))
  })

  it('llm token + done events flow into the store', async () => {
    await bootApp()
    act(() => useLlmStore.getState().startEntry('rid-1', 'transcript'))
    act(() => api.__emit.llmToken({ requestId: 'rid-1', delta: 'hi ' }))
    act(() => api.__emit.llmToken({ requestId: 'rid-1', delta: 'there' }))
    act(() => api.__emit.llmDone({ requestId: 'rid-1', full: 'hi there', finishReason: 'stop' }))
    await waitFor(() => expect(useLlmStore.getState().entries[0].status).toBe('done'))
    expect(useLlmStore.getState().entries[0].text).toBe('hi there')
  })

  it('mock playback-stop clears queued interviewer audio', async () => {
    await bootApp()
    act(() => api.__emit.mockPlaybackStop())
    expect(mockPlayback.stop).toHaveBeenCalled()
  })

  it.each(['stopping', 'idle', 'error'] as const)(
    'terminal mock status %s releases capture and playback',
    async (state) => {
      await bootApp()
      vi.mocked(capture.stop).mockClear()
      vi.mocked(mockPlayback.stop).mockClear()

      act(() => api.__emit.mockStatus({
        state,
        paused: false,
        ...(state === 'error' ? { message: 'socket closed' } : {}),
      }))

      expect(capture.stop).toHaveBeenCalledTimes(1)
      expect(mockPlayback.stop).toHaveBeenCalledTimes(1)
    },
  )

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
})

describe('mock interview flow', () => {
  it('starts a mock from the Practice tab', async () => {
    const { getByText } = await bootApp()
    press('k', { metaKey: true })
    fireEvent.click(screen.getByText('Start a mock interview'))
    await waitFor(() => expect(useUiStore.getState().consoleTab).toBe('practice'))

    fireEvent.click(getByText('Start 30-minute mock'))
    await waitFor(() =>
      expect(api.mock.start).toHaveBeenCalledWith({ presetId: 'behavioral', durationMinutes: 30 }),
    )
    expect(useMockStore.getState().status.state).toBe('active')
  })

  it('the palette ends a running mock instead of reopening the setup form', async () => {
    await bootApp()
    act(() => useMockStore.setState({ status: { state: 'active', paused: false } }))
    press('k', { metaKey: true })
    fireEvent.click(screen.getByText('End mock interview'))
    await waitFor(() => expect(api.mock.stop).toHaveBeenCalled())
    expect(useMockStore.getState().status.state).toBe('idle')
  })

  it('pause is only offered while a mock runs, and it reaches main', async () => {
    await bootApp()
    press('k', { metaKey: true })
    expect(screen.queryByText('Pause mock interviewer')).toBeNull()

    act(() => useMockStore.setState({ status: { state: 'active', paused: false } }))
    await waitFor(() => expect(screen.getByText('Pause mock interviewer')).toBeTruthy())
    fireEvent.click(screen.getByText('Pause mock interviewer'))
    await waitFor(() => expect(api.mock.pause).toHaveBeenCalled())
  })

  it('a paused mock offers resume instead', async () => {
    await bootApp()
    act(() => useMockStore.setState({ status: { state: 'paused', paused: true } }))
    press('k', { metaKey: true })
    fireEvent.click(screen.getByText('Resume mock interviewer'))
    await waitFor(() => expect(api.mock.resume).toHaveBeenCalled())
  })
})
