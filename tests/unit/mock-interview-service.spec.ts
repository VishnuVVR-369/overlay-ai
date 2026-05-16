import { beforeEach, describe, expect, it, vi } from 'vitest'

const transcriptionMock = vi.hoisted(() => ({
  injectPartial: vi.fn(),
  injectCommitted: vi.fn(),
  flattenForPrompt: vi.fn(() => 'Them: question\nYou: answer'),
}))

vi.mock('@main/transcription/transcription-service', () => ({
  transcription: transcriptionMock,
}))

import { MockInterviewService } from '@main/mock/mock-interview-service'

interface TestableMockInterviewService extends MockInterviewService {
  handleMessage(raw: string): void
  ws: { readyState: number; send: (message: string) => void } | null
  statusValue: { state: string; paused: boolean }
}

function makeService(): { service: MockInterviewService; testable: TestableMockInterviewService; sent: string[] } {
  const service = new MockInterviewService()
  const testable = service as TestableMockInterviewService
  const sent: string[] = []
  testable.ws = {
    readyState: 1,
    send: (message: string) => sent.push(message),
  }
  return { service, testable, sent }
}

describe('MockInterviewService event handling', () => {
  beforeEach(() => {
    transcriptionMock.injectPartial.mockClear()
    transcriptionMock.injectCommitted.mockClear()
    transcriptionMock.flattenForPrompt.mockClear()
  })

  it('maps interviewer transcript deltas and commits to Them', () => {
    const { testable } = makeService()

    testable.handleMessage(JSON.stringify({ type: 'response.audio_transcript.delta', delta: 'What is ' }))
    testable.handleMessage(JSON.stringify({ type: 'response.audio_transcript.delta', delta: 'caching?' }))
    testable.handleMessage(JSON.stringify({
      type: 'response.audio_transcript.done',
      item_id: 'assistant-1',
      transcript: 'What is caching?',
    }))

    expect(transcriptionMock.injectPartial).toHaveBeenLastCalledWith('them', 'What is caching?')
    expect(transcriptionMock.injectCommitted).toHaveBeenCalledWith('them', 'What is caching?')
  })

  it('maps user input transcription commits to You', () => {
    const { testable } = makeService()

    testable.handleMessage(JSON.stringify({
      type: 'conversation.item.input_audio_transcription.completed',
      item_id: 'user-1',
      transcript: 'Caching stores reusable data.',
    }))

    expect(transcriptionMock.injectCommitted).toHaveBeenCalledWith('you', 'Caching stores reusable data.')
  })

  it('deduplicates repeated committed transcript events', () => {
    const { testable } = makeService()
    const event = {
      type: 'conversation.item.input_audio_transcription.completed',
      item_id: 'user-1',
      transcript: 'Same answer.',
    }

    testable.handleMessage(JSON.stringify(event))
    testable.handleMessage(JSON.stringify(event))

    expect(transcriptionMock.injectCommitted).toHaveBeenCalledTimes(1)
  })

  it('stops queued playback and cancels model output on barge-in', () => {
    const { service, testable, sent } = makeService()
    const playbackStop = vi.fn()
    service.on('playbackStop', playbackStop)

    testable.handleMessage(JSON.stringify({ type: 'response.audio.delta', delta: 'AAAA' }))
    testable.handleMessage(JSON.stringify({ type: 'input_audio_buffer.speech_started' }))

    expect(playbackStop).toHaveBeenCalledTimes(1)
    expect(sent.map((msg) => JSON.parse(msg) as { type: string })).toContainEqual({ type: 'response.cancel' })
  })

  it('pause stops queued playback even when no audio delta is currently open', () => {
    const { service, testable, sent } = makeService()
    const playbackStop = vi.fn()
    service.on('playbackStop', playbackStop)
    testable.statusValue = { state: 'active', paused: false }

    service.pause()

    expect(playbackStop).toHaveBeenCalledTimes(1)
    expect(sent.map((msg) => JSON.parse(msg) as { type: string })).toContainEqual({ type: 'response.cancel' })
    expect(service.status().state).toBe('paused')
  })

  it('collects feedback text and emits it when the response is done', async () => {
    const { service, testable } = makeService()
    const feedback = vi.fn()
    service.on('feedback', feedback)

    const pending = (service as unknown as { requestFeedback(): Promise<void> }).requestFeedback()
    testable.handleMessage(JSON.stringify({ type: 'response.output_text.delta', delta: 'Strengths: clear. ' }))
    testable.handleMessage(JSON.stringify({ type: 'response.output_text.delta', delta: 'Gaps: depth.' }))
    testable.handleMessage(JSON.stringify({ type: 'response.done' }))
    await pending

    expect(feedback).toHaveBeenCalledWith(expect.objectContaining({
      text: 'Strengths: clear. Gaps: depth.',
    }))
  })
})
