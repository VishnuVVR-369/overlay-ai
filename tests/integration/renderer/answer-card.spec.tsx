// @vitest-environment jsdom
import { describe, expect, it, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { AnswerCard } from '@/components/AnswerCard'
import { useStatusStore } from '@/state/status-store'
import { useLlmStore } from '@/state/llm-store'
import { useMockStore } from '@/state/mock-store'
import { useTranscriptStore } from '@/state/transcript-store'

vi.mock('@/components/SeamWaveform', () => ({
  SeamWaveform: () => <div data-testid="waveform" />,
}))

beforeEach(() => {
  useStatusStore.setState({ running: false, startedAt: null, micState: 'idle', systemState: 'idle' })
  useLlmStore.setState({ entries: [] })
  useMockStore.setState({ status: { state: 'idle', paused: false } })
  useTranscriptStore.setState({ segments: [], partials: {} })
})

describe('AnswerCard (compact mode)', () => {
  it('reads "Idle" and prompts for a question when nothing is going on', () => {
    render(<AnswerCard onExpand={() => {}} />)
    expect(screen.getByText('Idle')).toBeTruthy()
    expect(screen.getByText('waiting for a question')).toBeTruthy()
  })

  it('reads "Listening" once transcription is running', () => {
    useStatusStore.setState({ running: true, micState: 'open', systemState: 'open' })
    render(<AnswerCard onExpand={() => {}} />)
    expect(screen.getByText('Listening')).toBeTruthy()
  })

  it('reads "Answering" while the latest entry streams', () => {
    useStatusStore.setState({ running: true })
    useLlmStore.setState({
      entries: [{ requestId: 'r', mode: 'transcript', text: '', chunks: [], status: 'streaming', startedAt: 1 }],
    })
    render(<AnswerCard onExpand={() => {}} />)
    expect(screen.getByText('Answering')).toBeTruthy()
  })

  it('reads "Mock" while a mock interview is live, ahead of listening state', () => {
    useMockStore.setState({ status: { state: 'active', paused: false } })
    render(<AnswerCard onExpand={() => {}} />)
    expect(screen.getByText('Mock')).toBeTruthy()
  })

  it('renders the latest committed "them" question', () => {
    useTranscriptStore.setState({
      segments: [{ id: 'a', speaker: 'them', status: 'committed', text: 'binary search?', startedAt: 1 }],
      partials: {},
    })
    render(<AnswerCard onExpand={() => {}} />)
    expect(screen.getByText('binary search?')).toBeTruthy()
  })

  it('prefers the live "them" partial over the last committed question', () => {
    useTranscriptStore.setState({
      segments: [{ id: 'a', speaker: 'them', status: 'committed', text: 'old', startedAt: 1 }],
      partials: { them: { id: 'p', speaker: 'them', status: 'partial', text: 'newer partial', startedAt: 2 } },
    })
    render(<AnswerCard onExpand={() => {}} />)
    expect(screen.getByText('newer partial')).toBeTruthy()
  })

  it('shows only the latest answer, never the history', () => {
    useLlmStore.setState({
      entries: [
        { requestId: 'r2', mode: 'screen', text: 'Use a two-pointer scan.', chunks: [], status: 'done', startedAt: 2 },
        { requestId: 'r1', mode: 'transcript', text: 'older answer', chunks: [], status: 'done', startedAt: 1 },
      ],
    })
    render(<AnswerCard onExpand={() => {}} />)
    expect(screen.getByText('Use a two-pointer scan.')).toBeTruthy()
    expect(screen.queryByText('older answer')).toBeNull()
  })

  it('exposes expand as the only control, so quit cannot be hit by accident mid-call', () => {
    const onExpand = vi.fn()
    render(<AnswerCard onExpand={onExpand} />)
    fireEvent.click(screen.getByLabelText('Expand overlay'))
    expect(onExpand).toHaveBeenCalled()
    expect(screen.queryByLabelText(/quit/i)).toBeNull()
  })
})
