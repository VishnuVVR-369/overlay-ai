// @vitest-environment jsdom
import { describe, expect, it, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { TranscriptPane } from '@/components/TranscriptPane'
import { useTranscriptStore } from '@/state/transcript-store'

beforeEach(() => {
  useTranscriptStore.setState({ segments: [], partials: {} })
})

describe('TranscriptPane', () => {
  it('renders nothing visible when there are no segments and no partials', () => {
    const { container } = render(<TranscriptPane />)
    expect(container.querySelector('.transcript-hero')).toBeNull()
    expect(container.querySelector('.transcript-rest')).toBeNull()
  })

  it('promotes the latest "them" segment to the hero region', () => {
    useTranscriptStore.setState({
      segments: [
        { id: 'a', speaker: 'you', status: 'committed', text: 'I am ready.', startedAt: 1 },
        { id: 'b', speaker: 'them', status: 'committed', text: 'What is hashing?', startedAt: 2 },
      ],
      partials: {},
    })
    render(<TranscriptPane />)
    expect(screen.getByText('What is hashing?')).toBeTruthy()
  })

  it('renders non-hero segments under the rest section, with You/Them tags', () => {
    useTranscriptStore.setState({
      segments: [
        { id: 'a', speaker: 'you', status: 'committed', text: 'reply.', startedAt: 1 },
        { id: 'b', speaker: 'them', status: 'committed', text: 'follow up?', startedAt: 2 },
      ],
      partials: {},
    })
    const { container } = render(<TranscriptPane />)
    expect(container.querySelectorAll('.segment').length).toBe(1)
    expect(container.querySelector('.segment-you')).toBeTruthy()
    expect(screen.getByText('reply.')).toBeTruthy()
  })

  it('marks partial segments with the partial CSS modifier', () => {
    useTranscriptStore.setState({
      segments: [],
      partials: { them: { id: 'p', speaker: 'them', status: 'partial', text: 'um', startedAt: 1 } },
    })
    const { container } = render(<TranscriptPane />)
    expect(container.querySelector('.transcript-hero-text.partial')).toBeTruthy()
  })

  it('shows ellipsis hero placeholder when partial text is empty', () => {
    useTranscriptStore.setState({
      segments: [],
      partials: { them: { id: 'p', speaker: 'them', status: 'partial', text: '', startedAt: 1 } },
    })
    render(<TranscriptPane />)
    expect(screen.getByText('…')).toBeTruthy()
  })
})