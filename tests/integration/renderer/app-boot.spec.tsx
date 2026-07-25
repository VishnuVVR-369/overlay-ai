// @vitest-environment jsdom
import { describe, expect, it, beforeEach, vi } from 'vitest'
import { render, waitFor, act, fireEvent } from '@testing-library/react'
import { App } from '@/App'
import { useUiStore } from '@/state/ui-store'
import { useStatusStore } from '@/state/status-store'
import { useTranscriptStore } from '@/state/transcript-store'
import { useLlmStore } from '@/state/llm-store'
import { useMockStore } from '@/state/mock-store'
import { usePresetStore } from '@/state/preset-store'
import { useAnswerStyleStore } from '@/state/answer-style-store'
import { installFakeApi, createFakeApi, type FakeApi } from '../../helpers/fake-window-api'

vi.mock('@/audio/capture-controller', () => ({
  capture: {
    start: vi.fn(async () => ({ micStarted: true, systemStarted: true, warnings: [] })),
    startMock: vi.fn(async () => ({ micStarted: true, warnings: [] })),
    stop: vi.fn(),
  },
}))
vi.mock('@/components/SeamWaveform', () => ({ SeamWaveform: () => null }))
vi.mock('@/components/Toaster', () => ({ Toaster: () => null }))
vi.mock('@/markdown/MarkdownBody', () => ({ MarkdownBody: ({ text }: { text: string }) => <div>{text}</div> }))
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

const bootWithAllKeys = (): FakeApi =>
  installFakeApi(createFakeApi({ settings: { ...ALL_KEYS } }))

beforeEach(() => {
  useUiStore.setState({
    mode: 'normal',
    consoleTab: null,
    paletteOpen: false,
    transcriptOpen: true,
    focused: true,
    permStatus: { mic: 'unknown', screen: 'unknown' },
    expandedEntries: {},
  })
  useStatusStore.setState({ running: false, startedAt: null, micState: 'idle', systemState: 'idle' })
  useTranscriptStore.setState({ segments: [], partials: {} })
  useLlmStore.setState({ entries: [] })
  useMockStore.setState({ status: { state: 'idle', paused: false } })
  usePresetStore.setState({ active: 'behavioral', presets: [], hydrated: false, drafts: {} })
  useAnswerStyleStore.setState({ active: 'concise', styles: [], hydrated: false })
})

describe('App boot', () => {
  it('queries settings, presets, answer styles, and permissions on mount', async () => {
    api = bootWithAllKeys()
    render(<App />)
    await waitFor(() => {
      expect(api.settings.get).toHaveBeenCalled()
      expect(api.presets.get).toHaveBeenCalled()
      expect(api.answerStyles.get).toHaveBeenCalled()
      expect(api.permissions.status).toHaveBeenCalled()
    })
  })

  it('lands on the Setup tab at boot when any key is missing', async () => {
    api = installFakeApi(createFakeApi({ settings: { ...ALL_KEYS, groqKeySet: false } }))
    render(<App />)
    await waitFor(() => expect(useUiStore.getState().consoleTab).toBe('setup'))
  })

  it('stays out of the way at boot when all keys are present', async () => {
    api = bootWithAllKeys()
    render(<App />)
    await waitFor(() => expect(api.settings.get).toHaveBeenCalled())
    expect(useUiStore.getState().consoleTab).toBeNull()
  })

  it('main-broadcast onOpenSettings forces the Setup tab open', async () => {
    api = bootWithAllKeys()
    render(<App />)
    await waitFor(() => expect(api.settings.get).toHaveBeenCalled())
    expect(useUiStore.getState().consoleTab).toBeNull()
    act(() => api.__emit.openSettings())
    await waitFor(() => expect(useUiStore.getState().consoleTab).toBe('setup'))
  })

  it('socket status events update the renderer status store', async () => {
    api = bootWithAllKeys()
    render(<App />)
    await waitFor(() => expect(api.permissions.status).toHaveBeenCalled())
    act(() => api.__emit.socketStatus({ stream: 'mic', state: 'open' }))
    expect(useStatusStore.getState().micState).toBe('open')
  })

  it('window:visibility-changed false dismisses the console and the palette', async () => {
    api = bootWithAllKeys()
    render(<App />)
    await waitFor(() => expect(api.settings.get).toHaveBeenCalled())
    act(() => useUiStore.setState({ consoleTab: 'help', paletteOpen: true }))
    act(() => api.__emit.visibilityChanged({ visible: false }))
    await waitFor(() => {
      expect(useUiStore.getState().consoleTab).toBeNull()
      expect(useUiStore.getState().paletteOpen).toBe(false)
    })
  })

  it('window:focus-state false sets focused=false', async () => {
    api = bootWithAllKeys()
    render(<App />)
    await waitFor(() => expect(api.settings.get).toHaveBeenCalled())
    act(() => api.__emit.focus({ focused: false }))
    await waitFor(() => expect(useUiStore.getState().focused).toBe(false))
  })

  it('window:mode-changed compact switches the rendered tree to the compact card', async () => {
    api = bootWithAllKeys()
    const { container } = render(<App />)
    await waitFor(() => expect(api.settings.get).toHaveBeenCalled())
    act(() => api.__emit.modeChanged({ mode: 'compact' }))
    await waitFor(() => expect(container.querySelector('.app-compact')).toBeTruthy())
  })

  it('window:mode-changed dismisses overlays for every mode', async () => {
    api = bootWithAllKeys()
    render(<App />)
    await waitFor(() => expect(api.settings.get).toHaveBeenCalled())

    for (const mode of ['normal', 'wide', 'compact'] as const) {
      act(() => useUiStore.setState({ consoleTab: 'help', paletteOpen: true }))
      act(() => api.__emit.modeChanged({ mode }))
      await waitFor(() => {
        expect(useUiStore.getState().consoleTab).toBeNull()
        expect(useUiStore.getState().paletteOpen).toBe(false)
      })
    }
  })

  it('the console is unmounted rather than hidden when closed', async () => {
    api = bootWithAllKeys()
    const { container } = render(<App />)
    await waitFor(() => expect(api.settings.get).toHaveBeenCalled())

    act(() => useUiStore.setState({ consoleTab: 'help' }))
    await waitFor(() => expect(container.querySelector('.console')).toBeTruthy())
    act(() => useUiStore.setState({ consoleTab: null }))
    await waitFor(() => expect(container.querySelector('.console')).toBeNull())
  })

  it('only one console tab is ever mounted at a time', async () => {
    api = bootWithAllKeys()
    const { container } = render(<App />)
    await waitFor(() => expect(api.settings.get).toHaveBeenCalled())

    act(() => useUiStore.setState({ consoleTab: 'help' }))
    await waitFor(() => expect(container.querySelectorAll('.console').length).toBe(1))
    act(() => useUiStore.setState({ consoleTab: 'setup' }))
    await waitFor(() => expect(container.querySelectorAll('.console').length).toBe(1))
  })

  it('compact expand routes back to normal mode through the window API', async () => {
    api = bootWithAllKeys()
    const { container, getByLabelText } = render(<App />)
    await waitFor(() => expect(api.settings.get).toHaveBeenCalled())
    act(() => api.__emit.modeChanged({ mode: 'compact' }))
    await waitFor(() => expect(container.querySelector('.app-compact')).toBeTruthy())

    fireEvent.click(getByLabelText('Expand overlay'))
    await waitFor(() => expect(api.window.setMode).toHaveBeenCalledWith('normal'))
  })

  it('transcript update events are applied to the renderer transcript store', async () => {
    api = bootWithAllKeys()
    render(<App />)
    await waitFor(() => expect(api.settings.get).toHaveBeenCalled())
    act(() =>
      api.__emit.transcriptUpdate({
        speaker: 'them',
        kind: 'partial',
        segmentId: 'p',
        text: 'live partial',
        startedAt: 1,
      }),
    )
    await waitFor(() => expect(useTranscriptStore.getState().partials.them?.text).toBe('live partial'))
  })

  it('the transcript rail can be collapsed and restored from the HUD bar', async () => {
    api = bootWithAllKeys()
    const { container, getByLabelText } = render(<App />)
    await waitFor(() => expect(api.settings.get).toHaveBeenCalled())
    expect(container.querySelector('.transcript-area')).toBeTruthy()

    fireEvent.click(getByLabelText('Hide transcript'))
    await waitFor(() => expect(container.querySelector('.transcript-area')).toBeNull())

    fireEvent.click(getByLabelText('Show transcript'))
    await waitFor(() => expect(container.querySelector('.transcript-area')).toBeTruthy())
  })

  it('the audio seam stays collapsed until there is something to show', async () => {
    api = bootWithAllKeys()
    const { container } = render(<App />)
    await waitFor(() => expect(api.settings.get).toHaveBeenCalled())
    expect(container.querySelector('.seam.active')).toBeNull()

    act(() => useStatusStore.setState({ running: true }))
    await waitFor(() => expect(container.querySelector('.seam.active')).toBeTruthy())
  })
})
