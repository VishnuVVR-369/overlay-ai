// @vitest-environment jsdom
import { describe, expect, it, beforeEach, vi } from 'vitest'
import { render, fireEvent, waitFor, act } from '@testing-library/react'
import { App } from '@/App'
import { useUiStore } from '@/state/ui-store'
import { useStatusStore } from '@/state/status-store'
import { useMockStore } from '@/state/mock-store'
import { useMockSessionsStore } from '@/state/mock-sessions-store'
import { useLlmStore } from '@/state/llm-store'
import { useTranscriptStore } from '@/state/transcript-store'
import { usePresetStore } from '@/state/preset-store'
import { useAnswerStyleStore } from '@/state/answer-style-store'
import { useVaultStore, emptyVault } from '@/state/vault-store'
import { installFakeApi, createFakeApi, type FakeApi } from '../../helpers/fake-window-api'
import type { MockSessionRecord, MockSessionSummary } from '@shared/types'

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
vi.mock('@/markdown/MarkdownBody', () => ({ MarkdownBody: ({ text }: { text: string }) => <div>{text}</div> }))
vi.mock('@/markdown/StreamingBody', () => ({ StreamingBody: ({ chunks }: { chunks: string[] }) => <div>{chunks.join('')}</div> }))

const summary = (over: Partial<MockSessionSummary> = {}): MockSessionSummary => ({
  id: 'sess-1',
  presetId: 'behavioral',
  presetLabel: 'Behavioral',
  durationMinutes: 30,
  startedAt: 1_700_000_000_000,
  endedAt: 1_700_000_180_000,
  averageScore: 3.8,
  graded: true,
  ...over,
})

const record = (over: Partial<MockSessionRecord> = {}): MockSessionRecord => ({
  ...summary(),
  transcript: [
    { id: 't1', speaker: 'them', status: 'committed', text: 'Tell me about a time you fixed a hard bug.', startedAt: 1_700_000_000_500 },
    { id: 't2', speaker: 'you', status: 'committed', text: 'I traced a memory leak in our auth service.', startedAt: 1_700_000_020_000 },
  ],
  legacyFeedback: 'Strong technical depth. Could be more concise.',
  rubric: [
    { dimension: 'starCompleteness', label: 'STAR completeness', score: 3, evidence: 'No measured result.' },
    { dimension: 'structure', label: 'Structure', score: 4, evidence: 'Clear S/T/A.' },
  ],
  annotations: [
    { transcriptIndex: 1, severity: 'gap', note: 'No metric attached to the outcome.', betterAnswer: 'Cut auth p99 by 60%.' },
  ],
  strengths: ['Owned the diagnosis'],
  gaps: ['Result was vague'],
  nextDrills: ['Re-tell with one number per story'],
  ...over,
})

let api: FakeApi

beforeEach(() => {
  useUiStore.setState({ mode: 'normal', consoleTab: null, paletteOpen: false, transcriptOpen: true, focused: true, permStatus: { mic: 'granted', screen: 'granted' }, expandedEntries: {}, headlineFirst: true })
  useVaultStore.setState({ data: emptyVault(), draft: null, hydrated: false })
  useStatusStore.setState({ running: false, startedAt: null, micState: 'idle', systemState: 'idle' })
  useMockStore.setState({ status: { state: 'idle', paused: false } })
  useMockSessionsStore.setState({ summaries: [], loaded: false, selectedId: null, selectedRecord: null, loadingRecord: false })
  useLlmStore.setState({ entries: [] })
  useTranscriptStore.setState({ segments: [], partials: {} })
  usePresetStore.setState({
    active: 'behavioral',
    presets: [
      { id: 'behavioral', label: 'Behavioral', defaultPrompt: 'd', effectivePrompt: 'd', overridden: false },
    ],
    hydrated: true,
    drafts: {},
  })
  useAnswerStyleStore.setState({
    active: 'concise',
    styles: [{ id: 'concise', label: 'Concise', instruction: 'short' }],
    hydrated: true,
  })
  api = installFakeApi(createFakeApi({
    settings: {
      elevenlabsKeySet: true, groqKeySet: true, openaiKeySet: true,
      visionProvider: 'openai', visionModel: 'gpt-5.1', headlineFirst: true,
      vault: { hasResume: false, hasJobDescription: false, hasCompanyValues: false, hasInterviewerNotes: false, storiesCount: 0 },
    },
  }))
})

async function bootApp(): Promise<ReturnType<typeof render>> {
  const utils = render(<App />)
  await waitFor(() => expect(api.settings.get).toHaveBeenCalled())
  return utils
}

const openHistory = (): void => {
  act(() => useUiStore.getState().openConsole('history'))
}

describe('History tab', () => {
  it('lists summaries from the main process', async () => {
    api.__state.mockSessionSummaries = [summary({ id: 's1', presetLabel: 'Behavioral', averageScore: 4.2 })]
    const { container, getByText } = await bootApp()
    openHistory()
    await waitFor(() => expect(api.mockSessions.list).toHaveBeenCalled())
    expect(getByText('Sessions')).toBeTruthy()
    expect(getByText('1 total')).toBeTruthy()
    await waitFor(() => expect(container.querySelector('.session-row')).toBeTruthy())
    expect(container.querySelector('.score')?.textContent).toBe('4.2')
    expect(container.querySelector('.session-row-title')?.textContent).toBe('Behavioral')
  })

  it('clicking a row loads and renders the full session detail', async () => {
    api.__state.mockSessionSummaries = [summary({ id: 's1' })]
    api.__state.mockSessionRecords = { s1: record({ id: 's1' }) }
    const { container, getByText } = await bootApp()
    openHistory()
    const row = await waitFor(() => {
      const el = container.querySelector('.session-row')
      if (!el) throw new Error('no row')
      return el as HTMLElement
    })
    fireEvent.click(row)
    await waitFor(() => expect(api.mockSessions.get).toHaveBeenCalledWith('s1'))
    await waitFor(() => expect(getByText('Rubric')).toBeTruthy())
    expect(getByText('STAR completeness')).toBeTruthy()
    // annotation rendered next to the candidate turn
    expect(getByText(/No metric attached/)).toBeTruthy()
    expect(getByText(/Cut auth p99 by 60%/)).toBeTruthy()
    // strengths / gaps / drills
    expect(getByText('Owned the diagnosis')).toBeTruthy()
    expect(getByText('Result was vague')).toBeTruthy()
    expect(getByText('Re-tell with one number per story')).toBeTruthy()
  })

  it('ignores a stale session detail response after another session is selected', async () => {
    api.__state.mockSessionSummaries = [
      summary({ id: 's1', presetLabel: 'First', startedAt: 2 }),
      summary({ id: 's2', presetLabel: 'Second', startedAt: 1 }),
    ]
    let resolveFirst: (value: MockSessionRecord | null) => void = () => undefined
    api.mockSessions.get = vi.fn((id: string) => {
      if (id === 's1') {
        return new Promise<MockSessionRecord | null>((resolve) => {
          resolveFirst = resolve
        })
      }
      return Promise.resolve(record({ id: 's2', presetLabel: 'Second' }))
    })

    const { container } = await bootApp()
    openHistory()
    const firstRow = await waitFor(() => {
      const el = container.querySelector('.session-row')
      if (!el) throw new Error('no row')
      return el as HTMLElement
    })
    fireEvent.click(firstRow)
    await waitFor(() => expect(api.mockSessions.get).toHaveBeenCalledWith('s1'))

    act(() => useMockSessionsStore.getState().setSelected('s2'))
    await waitFor(() => expect(useMockSessionsStore.getState().selectedRecord?.id).toBe('s2'))

    await act(async () => {
      resolveFirst(record({ id: 's1', presetLabel: 'First' }))
      await Promise.resolve()
    })
    expect(useMockSessionsStore.getState().selectedRecord?.id).toBe('s2')
  })

  it('falls back to legacy feedback when rubric is empty', async () => {
    api.__state.mockSessionSummaries = [summary({ id: 's1', graded: false, averageScore: null })]
    api.__state.mockSessionRecords = {
      s1: record({
        id: 's1', graded: false, averageScore: null, rubric: [], annotations: [],
        strengths: [], gaps: [], nextDrills: [],
        legacyFeedback: 'Strengths: clarity. Gaps: depth. Next drill: edge cases.',
      }),
    }
    const { container, getByText, queryByText } = await bootApp()
    openHistory()
    const row = await waitFor(() => {
      const el = container.querySelector('.session-row')
      if (!el) throw new Error('no row')
      return el as HTMLElement
    })
    fireEvent.click(row)
    await waitFor(() => expect(getByText(/Strengths: clarity/)).toBeTruthy())
    expect(queryByText('Rubric')).toBeNull()
  })

  it('shows grader error when grading failed for the session', async () => {
    api.__state.mockSessionSummaries = [summary({ id: 's1' })]
    api.__state.mockSessionRecords = {
      s1: record({ id: 's1', graderError: 'API key rejected', rubric: [], annotations: [] }),
    }
    const { container, getByText } = await bootApp()
    openHistory()
    const row = await waitFor(() => {
      const el = container.querySelector('.session-row')
      if (!el) throw new Error('no row')
      return el as HTMLElement
    })
    fireEvent.click(row)
    await waitFor(() => expect(getByText(/Grading unavailable: API key rejected/)).toBeTruthy())
  })

  it('delete removes the session from the list', async () => {
    api.__state.mockSessionSummaries = [summary({ id: 's1' })]
    api.__state.mockSessionRecords = { s1: record({ id: 's1' }) }
    const { container, getByText } = await bootApp()
    openHistory()
    const row = await waitFor(() => {
      const el = container.querySelector('.session-row')
      if (!el) throw new Error('no row')
      return el as HTMLElement
    })
    fireEvent.click(row)
    await waitFor(() => expect(getByText('Delete session')).toBeTruthy())
    fireEvent.click(getByText('Delete session'))
    await waitFor(() => expect(api.mockSessions.delete).toHaveBeenCalledWith('s1'))
    await waitFor(() => expect(container.querySelector('.session-row')).toBeNull())
  })

  it('sessionSaved event prepends a new summary in the store', async () => {
    api.__state.mockSessionSummaries = [summary({ id: 's-old', startedAt: 1_000 })]
    await bootApp()
    act(() => api.__emit.mockSessionSaved({
      summary: summary({ id: 's-new', startedAt: 9_000_000_000_000 }),
    }))
    await waitFor(() => {
      const ids = useMockSessionsStore.getState().summaries.map((s) => s.id)
      expect(ids[0]).toBe('s-new')
    })
  })

  it('merges sessionSaved updates that arrive while the initial list is pending', async () => {
    let resolveList: (value: MockSessionSummary[]) => void = () => undefined
    api.mockSessions.list = vi.fn(() => new Promise((resolve) => {
      resolveList = resolve
    }))
    await bootApp()
    openHistory()
    await waitFor(() => expect(api.mockSessions.list).toHaveBeenCalled())

    act(() => api.__emit.mockSessionSaved({
      summary: summary({ id: 's-new', startedAt: 9_000 }),
    }))
    await act(async () => {
      resolveList([summary({ id: 's-old', startedAt: 1_000 })])
      await Promise.resolve()
    })

    expect(useMockSessionsStore.getState().summaries.map((item) => item.id)).toEqual(['s-new', 's-old'])
  })

  it('does not resurrect a deletion when a pending list response finishes', async () => {
    useMockSessionsStore.setState({
      summaries: [summary({ id: 's-delete', startedAt: 2_000 })],
      loaded: true,
    })
    let resolveList: (value: MockSessionSummary[]) => void = () => undefined
    api.mockSessions.list = vi.fn(() => new Promise((resolve) => {
      resolveList = resolve
    }))
    await bootApp()
    openHistory()
    await waitFor(() => expect(api.mockSessions.list).toHaveBeenCalled())

    act(() => useMockSessionsStore.getState().removeSummary('s-delete'))
    await act(async () => {
      resolveList([summary({ id: 's-delete', startedAt: 2_000 })])
      await Promise.resolve()
    })

    expect(useMockSessionsStore.getState().summaries).toEqual([])
  })

  it('Escape closes the console from the history tab', async () => {
    const { container } = await bootApp()
    openHistory()
    await waitFor(() => expect(container.querySelector('.console')).toBeTruthy())
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }))
    })
    await waitFor(() => expect(container.querySelector('.console')).toBeNull())
  })

  it('deleting the open session returns to the list instead of a dead detail view', async () => {
    api.__state.mockSessionSummaries = [summary({ id: 's1' })]
    api.__state.mockSessionRecords = { s1: record({ id: 's1' }) }
    const { container, getByText } = await bootApp()
    openHistory()
    const row = await waitFor(() => {
      const el = container.querySelector('.session-row')
      if (!el) throw new Error('no row')
      return el as HTMLElement
    })
    fireEvent.click(row)
    await waitFor(() => expect(getByText('Delete session')).toBeTruthy())
    fireEvent.click(getByText('Delete session'))
    await waitFor(() => expect(useMockSessionsStore.getState().selectedId).toBeNull())
    await waitFor(() => expect(getByText(/No mock sessions yet/)).toBeTruthy())
  })
})
