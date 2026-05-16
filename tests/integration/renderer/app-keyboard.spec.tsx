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
  useUiStore.setState({ mode: 'normal', helpOpen: false, settingsOpen: false, focused: true, permStatus: { mic: 'granted', screen: 'granted' }, expandedEntries: {} })
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
    settings: { elevenlabsKeySet: true, groqKeySet: true, openaiKeySet: true, visionProvider: 'openai', visionModel: 'gpt-5.1' },
  }))
})

async function bootApp(): Promise<void> {
  render(<App />)
  await waitFor(() => expect(api.settings.get).toHaveBeenCalled())
  await waitFor(() => expect(api.presets.get).toHaveBeenCalled())
  await waitFor(() => expect(api.answerStyles.get).toHaveBeenCalled())
  await waitFor(() => expect(api.permissions.status).toHaveBeenCalled())
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

  it('"-" calls window.api.window.setMode("compact") and updates store mode', async () => {
    await bootApp()
    press('-')
    await waitFor(() => expect(api.window.setMode).toHaveBeenCalledWith('compact'))
    expect(useUiStore.getState().mode).toBe('compact')
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
})
