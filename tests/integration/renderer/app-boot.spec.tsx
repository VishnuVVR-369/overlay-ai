// @vitest-environment jsdom
import { describe, expect, it, beforeEach, vi } from 'vitest'
import { render, waitFor, act } from '@testing-library/react'
import { App } from '@/App'
import { useUiStore } from '@/state/ui-store'
import { useStatusStore } from '@/state/status-store'
import { useTranscriptStore } from '@/state/transcript-store'
import { useLlmStore } from '@/state/llm-store'
import { usePresetStore } from '@/state/preset-store'
import { useAnswerStyleStore } from '@/state/answer-style-store'
import { installFakeApi, createFakeApi, type FakeApi } from '../../helpers/fake-window-api'

vi.mock('@/audio/capture-controller', () => ({
  capture: { start: vi.fn(async () => ({ micStarted: true, systemStarted: true, warnings: [] })), stop: vi.fn() },
}))
vi.mock('@/components/SeamWaveform', () => ({ SeamWaveform: () => null }))
vi.mock('@/components/Toaster', () => ({ Toaster: () => null }))
vi.mock('@/markdown/MarkdownBody', () => ({ MarkdownBody: ({ text }: { text: string }) => <div>{text}</div> }))
vi.mock('@/markdown/StreamingBody', () => ({ StreamingBody: ({ chunks }: { chunks: string[] }) => <div>{chunks.join('')}</div> }))

let api: FakeApi

beforeEach(() => {
  useUiStore.setState({ mode: 'normal', helpOpen: false, settingsOpen: false, focused: true, permStatus: { mic: 'unknown', screen: 'unknown' }, expandedEntries: {} })
  useStatusStore.setState({ running: false, micState: 'idle', systemState: 'idle' })
  useTranscriptStore.setState({ segments: [], partials: {} })
  useLlmStore.setState({ entries: [] })
  usePresetStore.setState({ active: 'behavioral', presets: [], hydrated: false })
  useAnswerStyleStore.setState({ active: 'concise', styles: [], hydrated: false })
})

describe('App boot', () => {
  it('queries settings, presets, answer styles, and permissions on mount', async () => {
    api = installFakeApi(createFakeApi({
      settings: { elevenlabsKeySet: true, groqKeySet: true, openaiKeySet: true, visionProvider: 'openai', visionModel: 'gpt-5.1' },
    }))
    render(<App />)
    await waitFor(() => {
      expect(api.settings.get).toHaveBeenCalled()
      expect(api.presets.get).toHaveBeenCalled()
      expect(api.answerStyles.get).toHaveBeenCalled()
      expect(api.permissions.status).toHaveBeenCalled()
    })
  })

  it('opens the settings modal at boot when any key is missing', async () => {
    api = installFakeApi(createFakeApi({
      settings: { elevenlabsKeySet: true, groqKeySet: false, openaiKeySet: true, visionProvider: 'openai', visionModel: 'gpt-5.1' },
    }))
    render(<App />)
    await waitFor(() => expect(useUiStore.getState().settingsOpen).toBe(true))
  })

  it('does not open settings at boot when all keys are present', async () => {
    api = installFakeApi(createFakeApi({
      settings: { elevenlabsKeySet: true, groqKeySet: true, openaiKeySet: true, visionProvider: 'openai', visionModel: 'gpt-5.1' },
    }))
    render(<App />)
    await waitFor(() => expect(api.settings.get).toHaveBeenCalled())
    expect(useUiStore.getState().settingsOpen).toBe(false)
  })

  it('main-broadcast onOpenSettings forces the settings modal open', async () => {
    api = installFakeApi(createFakeApi({
      settings: { elevenlabsKeySet: true, groqKeySet: true, openaiKeySet: true, visionProvider: 'openai', visionModel: 'gpt-5.1' },
    }))
    render(<App />)
    await waitFor(() => expect(api.settings.get).toHaveBeenCalled())
    expect(useUiStore.getState().settingsOpen).toBe(false)
    act(() => api.__emit.openSettings())
    await waitFor(() => expect(useUiStore.getState().settingsOpen).toBe(true))
  })

  it('socket status events update the renderer status store', async () => {
    api = installFakeApi(createFakeApi({
      settings: { elevenlabsKeySet: true, groqKeySet: true, openaiKeySet: true, visionProvider: 'openai', visionModel: 'gpt-5.1' },
    }))
    render(<App />)
    await waitFor(() => expect(api.permissions.status).toHaveBeenCalled())
    act(() => api.__emit.socketStatus({ stream: 'mic', state: 'open' }))
    expect(useStatusStore.getState().micState).toBe('open')
  })

  it('window:visibility-changed false closes any open slide-overs', async () => {
    api = installFakeApi(createFakeApi({
      settings: { elevenlabsKeySet: true, groqKeySet: true, openaiKeySet: true, visionProvider: 'openai', visionModel: 'gpt-5.1' },
    }))
    render(<App />)
    await waitFor(() => expect(api.settings.get).toHaveBeenCalled())
    useUiStore.setState({ helpOpen: true, settingsOpen: true })
    act(() => api.__emit.visibilityChanged({ visible: false }))
    await waitFor(() => {
      expect(useUiStore.getState().helpOpen).toBe(false)
      expect(useUiStore.getState().settingsOpen).toBe(false)
    })
  })

  it('window:focus-state false sets focused=false', async () => {
    api = installFakeApi(createFakeApi({
      settings: { elevenlabsKeySet: true, groqKeySet: true, openaiKeySet: true, visionProvider: 'openai', visionModel: 'gpt-5.1' },
    }))
    render(<App />)
    await waitFor(() => expect(api.settings.get).toHaveBeenCalled())
    act(() => api.__emit.focus({ focused: false }))
    await waitFor(() => expect(useUiStore.getState().focused).toBe(false))
  })

  it('window:mode-changed compact switches the rendered tree to AnswerCard', async () => {
    api = installFakeApi(createFakeApi({
      settings: { elevenlabsKeySet: true, groqKeySet: true, openaiKeySet: true, visionProvider: 'openai', visionModel: 'gpt-5.1' },
    }))
    const { container } = render(<App />)
    await waitFor(() => expect(api.settings.get).toHaveBeenCalled())
    act(() => api.__emit.modeChanged({ mode: 'compact' }))
    await waitFor(() => expect(container.querySelector('.app-compact')).toBeTruthy())
  })

  it('transcript update events are applied to the renderer transcript store', async () => {
    api = installFakeApi(createFakeApi({
      settings: { elevenlabsKeySet: true, groqKeySet: true, openaiKeySet: true, visionProvider: 'openai', visionModel: 'gpt-5.1' },
    }))
    render(<App />)
    await waitFor(() => expect(api.settings.get).toHaveBeenCalled())
    act(() => api.__emit.transcriptUpdate({ speaker: 'them', kind: 'partial', segmentId: 'p', text: 'live partial', startedAt: 1 }))
    await waitFor(() => expect(useTranscriptStore.getState().partials.them?.text).toBe('live partial'))
  })
})
