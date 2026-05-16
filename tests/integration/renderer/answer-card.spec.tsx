// @vitest-environment jsdom
import { describe, expect, it, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { AnswerCard } from '@/components/AnswerCard'
import { useStatusStore } from '@/state/status-store'
import { useLlmStore } from '@/state/llm-store'
import { useTranscriptStore } from '@/state/transcript-store'

vi.mock('@/components/SeamWaveform', () => ({
  SeamWaveform: () => <div data-testid="waveform" />,
}))

beforeEach(() => {
  useStatusStore.setState({ running: false, micState: 'idle', systemState: 'idle' })
  useLlmStore.setState({ entries: [] })
  useTranscriptStore.setState({ segments: [], partials: {} })
})

describe('AnswerCard', () => {
  it('shows "idle" + "awaiting question" when nothing is going on', () => {
    render(<AnswerCard onExpand={() => {}} onQuit={() => {}} />)
    expect(screen.getByText('idle')).toBeTruthy()
    expect(screen.getByText('awaiting question')).toBeTruthy()
  })

  it('shows "live" when transcription is running', () => {
    useStatusStore.setState({ running: true, micState: 'open', systemState: 'open' })
    render(<AnswerCard onExpand={() => {}} onQuit={() => {}} />)
    expect(screen.getByText(/live/)).toBeTruthy()
  })

  it('shows " · answering" suffix while the latest entry is streaming', () => {
    useLlmStore.setState({ entries: [{ requestId: 'r', mode: 'transcript', text: '', chunks: [], status: 'streaming', startedAt: 1 }] })
    render(<AnswerCard onExpand={() => {}} onQuit={() => {}} />)
    expect(screen.getByText(/answering/)).toBeTruthy()
  })

  it('renders the latest "them" question or partial as Q · …', () => {
    useTranscriptStore.setState({
      segments: [
        { id: 'a', speaker: 'them', status: 'committed', text: 'binary search?', startedAt: 1 },
      ],
      partials: {},
    })
    render(<AnswerCard onExpand={() => {}} onQuit={() => {}} />)
    expect(screen.getByText(/binary search\?/)).toBeTruthy()
  })

  it('uses the most recent "them" partial when available', () => {
    useTranscriptStore.setState({
      segments: [{ id: 'a', speaker: 'them', status: 'committed', text: 'old', startedAt: 1 }],
      partials: { them: { id: 'p', speaker: 'them', status: 'partial', text: 'newer partial', startedAt: 2 } },
    })
    render(<AnswerCard onExpand={() => {}} onQuit={() => {}} />)
    expect(screen.getByText(/newer partial/)).toBeTruthy()
  })

  it('expand and quit buttons fire their callbacks', () => {
    const onExpand = vi.fn()
    const onQuit = vi.fn()
    render(<AnswerCard onExpand={onExpand} onQuit={onQuit} />)
    fireEvent.click(screen.getByLabelText('Expand'))
    fireEvent.click(screen.getByLabelText('Quit'))
    expect(onExpand).toHaveBeenCalled()
    expect(onQuit).toHaveBeenCalled()
  })
})
