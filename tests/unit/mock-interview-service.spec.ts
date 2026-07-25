import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { GraderClient, GraderResult } from '@main/mock/mock-grader'
import type { MockRubricScore, PresetId, TranscriptSegment } from '@shared/types'

const transcriptionMock = vi.hoisted(() => ({
  injectPartial: vi.fn(),
  injectCommitted: vi.fn(),
  flattenForPrompt: vi.fn(() => 'Them: question\nYou: answer'),
  snapshot: vi.fn(() => ({ segments: [] as TranscriptSegment[], partials: {} })),
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
    transcriptionMock.snapshot.mockClear()
    transcriptionMock.snapshot.mockReturnValue({ segments: [], partials: {} })
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

describe('MockInterviewService session persistence', () => {
  beforeEach(() => {
    transcriptionMock.snapshot.mockReturnValue({ segments: [], partials: {} })
  })

  function makeGrader(result: GraderResult, calls: Array<{ presetId: PresetId; transcript: TranscriptSegment[] }> = []): GraderClient {
    return {
      grade: vi.fn(async (_key: string, presetId: PresetId, transcript: TranscriptSegment[]) => {
        calls.push({ presetId, transcript })
        return result
      }),
    }
  }

  function makeSessions() {
    const saved: unknown[] = []
    return {
      saved,
      store: {
        load: vi.fn(async () => undefined),
        save: vi.fn(async (input: Record<string, unknown>) => {
          saved.push(input)
          return { ...(input as object), id: (input.id as string) ?? 'rec-id' } as never
        }),
        list: vi.fn(async () => []),
        get: vi.fn(async () => null),
        delete: vi.fn(async () => false),
      },
    }
  }

  it('persistSession composes a record with grader output and emits sessionSaved', async () => {
    const rubric: MockRubricScore[] = [
      { dimension: 'structure', label: 'Structure', score: 4, evidence: 'good' },
      { dimension: 'communication', label: 'Communication', score: 3, evidence: 'paced' },
    ]
    const graderCalls: Array<{ presetId: PresetId; transcript: TranscriptSegment[] }> = []
    const grader = makeGrader({
      rubric, annotations: [], strengths: ['s'], gaps: ['g'], nextDrills: ['d'],
    }, graderCalls)
    const sessions = makeSessions()
    const service = new MockInterviewService({ grader, sessions: sessions.store as never })

    const sessionSaved = vi.fn()
    service.on('sessionSaved', sessionSaved)

    const transcript: TranscriptSegment[] = [
      { id: 'a', speaker: 'them', status: 'committed', text: 'Q', startedAt: 1, committedAt: 5 },
    ]
    await (service as unknown as { persistSession(args: unknown): Promise<void> }).persistSession({
      sessionId: 'sess-1',
      startedAt: 1000,
      endedAt: 2000,
      config: { presetId: 'behavioral', durationMinutes: 30 },
      context: { preset: { id: 'behavioral', label: 'Behavioral', defaultPrompt: 'd', effectivePrompt: 'd', overridden: false }, vault: emptyVault() },
      apiKey: 'oa-key',
      transcript,
      legacyFeedback: 'free text',
    })

    expect(graderCalls[0].presetId).toBe('behavioral')
    expect(sessions.store.save).toHaveBeenCalledTimes(1)
    const savedArg = sessions.store.save.mock.calls[0][0] as Record<string, unknown>
    expect(savedArg).toMatchObject({
      id: 'sess-1',
      presetId: 'behavioral',
      presetLabel: 'Behavioral',
      durationMinutes: 30,
      startedAt: 1000,
      endedAt: 2000,
      legacyFeedback: 'free text',
      graded: true,
      averageScore: 3.5,
    })
    expect(savedArg.rubric).toEqual(rubric)
    expect(sessionSaved).toHaveBeenCalledTimes(1)
    expect((sessionSaved.mock.calls[0][0] as { summary: { id: string } }).summary.id).toBe('sess-1')
  })

  it('records graderError and still saves the session when grading throws', async () => {
    const grader: GraderClient = {
      grade: vi.fn(async () => { throw new Error('network down') }),
    }
    const sessions = makeSessions()
    const service = new MockInterviewService({ grader, sessions: sessions.store as never })
    const sessionSaved = vi.fn()
    service.on('sessionSaved', sessionSaved)

    await (service as unknown as { persistSession(args: unknown): Promise<void> }).persistSession({
      sessionId: 'sess-2',
      startedAt: 1, endedAt: 2,
      config: { presetId: 'coding', durationMinutes: 30 },
      context: { preset: undefined, vault: emptyVault() },
      apiKey: 'oa',
      transcript: [{ id: 'a', speaker: 'them', status: 'committed', text: 'Q', startedAt: 1 }],
      legacyFeedback: '',
    })

    const savedArg = sessions.store.save.mock.calls[0][0] as Record<string, unknown>
    expect(savedArg.graded).toBe(false)
    expect(savedArg.averageScore).toBeNull()
    expect(savedArg.graderError).toContain('network down')
    expect(savedArg.presetLabel).toBe('coding') // falls back to presetId when preset is missing
    expect(sessionSaved).toHaveBeenCalledTimes(1)
  })

  it('records graderError when API key is missing and skips grading entirely', async () => {
    const grader: GraderClient = { grade: vi.fn(async () => ({ rubric: [], annotations: [], strengths: [], gaps: [], nextDrills: [] })) }
    const sessions = makeSessions()
    const service = new MockInterviewService({ grader, sessions: sessions.store as never })

    await (service as unknown as { persistSession(args: unknown): Promise<void> }).persistSession({
      sessionId: 'sess-3',
      startedAt: 1, endedAt: 2,
      config: { presetId: 'behavioral', durationMinutes: 30 },
      context: { preset: undefined, vault: emptyVault() },
      apiKey: null,
      transcript: [{ id: 'a', speaker: 'them', status: 'committed', text: 'Q', startedAt: 1 }],
      legacyFeedback: '',
    })

    expect(grader.grade).not.toHaveBeenCalled()
    const savedArg = sessions.store.save.mock.calls[0][0] as Record<string, unknown>
    expect(savedArg.graded).toBe(false)
    expect(savedArg.graderError).toContain('OpenAI key not available')
  })

  it('stop() with no transcript skips persistence entirely', async () => {
    const grader: GraderClient = { grade: vi.fn() }
    const sessions = makeSessions()
    const service = new MockInterviewService({ grader, sessions: sessions.store as never })
    const sessionSaved = vi.fn()
    service.on('sessionSaved', sessionSaved)
    const testable = service as unknown as {
      ws: { readyState: number; send: (m: string) => void } | null
      statusValue: { state: string; paused: boolean }
      sessionId: string | null
      sessionStartedAt: number
      sessionConfig: unknown
      promptContext: unknown
      sessionApiKey: string | null
    }
    testable.ws = { readyState: 1, send: vi.fn(), close: vi.fn(), terminate: vi.fn() } as never
    testable.statusValue = { state: 'active', paused: false }
    testable.sessionId = 'sess-empty'
    testable.sessionStartedAt = 1000
    testable.sessionConfig = { presetId: 'behavioral', durationMinutes: 30 }
    testable.promptContext = { vault: emptyVault() }
    testable.sessionApiKey = 'oa'

    transcriptionMock.snapshot.mockReturnValue({ segments: [], partials: {} })
    transcriptionMock.flattenForPrompt.mockReturnValueOnce('')

    await service.stop()
    expect(sessions.store.save).not.toHaveBeenCalled()
    expect(grader.grade).not.toHaveBeenCalled()
    expect(sessionSaved).not.toHaveBeenCalled()
  })

  it('stop() with a transcript dispatches grading + session save', async () => {
    const grader: GraderClient = {
      grade: vi.fn(async () => ({
        rubric: [{ dimension: 'structure', label: 'Structure', score: 4, evidence: 'ok' }],
        annotations: [], strengths: [], gaps: [], nextDrills: [],
      })),
    }
    const sessions = makeSessions()
    const service = new MockInterviewService({ grader, sessions: sessions.store as never })
    const sessionSaved = vi.fn()
    service.on('sessionSaved', sessionSaved)

    const testable = service as unknown as {
      ws: { readyState: number; send: (m: string) => void; close: () => void; terminate: () => void } | null
      statusValue: { state: string; paused: boolean }
      sessionId: string | null
      sessionStartedAt: number
      sessionConfig: unknown
      promptContext: unknown
      sessionApiKey: string | null
      feedbackText: string
      feedbackRequestPending: boolean
      feedbackResolve: (() => void) | null
    }
    testable.ws = { readyState: 1, send: vi.fn(), close: vi.fn(), terminate: vi.fn() }
    testable.statusValue = { state: 'active', paused: false }
    testable.sessionId = 'sess-happy'
    testable.sessionStartedAt = 1000
    testable.sessionConfig = { presetId: 'coding', durationMinutes: 30 }
    testable.promptContext = { preset: { id: 'coding', label: 'Coding', defaultPrompt: 'd', effectivePrompt: 'd', overridden: false }, vault: emptyVault() }
    testable.sessionApiKey = 'oa-real'

    transcriptionMock.snapshot.mockReturnValue({
      segments: [
        { id: 'a', speaker: 'them', status: 'committed', text: 'Q', startedAt: 1500 },
        { id: 'b', speaker: 'you', status: 'committed', text: 'A', startedAt: 1600 },
      ],
      partials: {},
    })
    transcriptionMock.flattenForPrompt.mockReturnValue('Them: Q\nYou: A')

    const stopPromise = service.stop()
    // Resolve the feedback request immediately (response.done arrives).
    // The service stores feedback delta in feedbackText; we set it directly then resolve.
    testable.feedbackText = 'free-text feedback'
    testable.feedbackResolve?.()
    await stopPromise
    await new Promise((r) => setTimeout(r, 0))

    expect(grader.grade).toHaveBeenCalledWith('oa-real', 'coding', expect.arrayContaining([
      expect.objectContaining({ id: 'a' }),
      expect.objectContaining({ id: 'b' }),
    ]))
    expect(sessions.store.save).toHaveBeenCalledTimes(1)
    const savedArg = sessions.store.save.mock.calls[0][0] as Record<string, unknown>
    expect(savedArg).toMatchObject({
      id: 'sess-happy',
      presetId: 'coding',
      presetLabel: 'Coding',
      legacyFeedback: 'free-text feedback',
      graded: true,
    })
    expect(sessionSaved).toHaveBeenCalledTimes(1)
  })

  it('captures transcript turns that finish while stop feedback is pending', async () => {
    const grader: GraderClient = {
      grade: vi.fn(async () => ({
        rubric: [{ dimension: 'communication', label: 'Communication', score: 4, evidence: 'clear' }],
        annotations: [], strengths: [], gaps: [], nextDrills: [],
      })),
    }
    const sessions = makeSessions()
    const service = new MockInterviewService({ grader, sessions: sessions.store as never })
    const testable = service as unknown as {
      ws: { readyState: number; send: (m: string) => void; close: () => void; terminate: () => void } | null
      statusValue: { state: string; paused: boolean }
      sessionId: string | null
      sessionStartedAt: number
      sessionConfig: unknown
      promptContext: unknown
      sessionApiKey: string | null
      feedbackResolve: (() => void) | null
    }
    testable.ws = { readyState: 1, send: vi.fn(), close: vi.fn(), terminate: vi.fn() }
    testable.statusValue = { state: 'active', paused: false }
    testable.sessionId = 'sess-late-turn'
    testable.sessionStartedAt = 1000
    testable.sessionConfig = { presetId: 'behavioral', durationMinutes: 30 }
    testable.promptContext = { preset: undefined, vault: emptyVault() }
    testable.sessionApiKey = 'oa'
    transcriptionMock.flattenForPrompt.mockReturnValue('Them: Q')
    transcriptionMock.snapshot.mockReturnValue({ segments: [], partials: {} })

    const stopPromise = service.stop()
    transcriptionMock.snapshot.mockReturnValue({
      segments: [
        { id: 'late', speaker: 'you', status: 'committed', text: 'Final answer', startedAt: 1500 },
      ],
      partials: {},
    })
    testable.feedbackResolve?.()
    await stopPromise
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(grader.grade).toHaveBeenCalledWith(
      'oa',
      'behavioral',
      [expect.objectContaining({ id: 'late', text: 'Final answer' })],
    )
  })

  it('captureTranscriptSnapshot filters segments older than sessionStartedAt', () => {
    const grader: GraderClient = { grade: vi.fn() }
    const sessions = makeSessions()
    const service = new MockInterviewService({ grader, sessions: sessions.store as never })
    const testable = service as unknown as { sessionStartedAt: number }
    testable.sessionStartedAt = 1500
    transcriptionMock.snapshot.mockReturnValue({
      segments: [
        { id: 'old', speaker: 'them', status: 'committed', text: 'pre-mock', startedAt: 100 },
        { id: 'new', speaker: 'you', status: 'committed', text: 'in-mock', startedAt: 2000 },
      ],
      partials: {},
    })
    const captured = (service as unknown as { captureTranscriptSnapshot(): TranscriptSegment[] }).captureTranscriptSnapshot()
    expect(captured.map((s) => s.id)).toEqual(['new'])
  })
})

function emptyVault() {
  return { resume: '', jobDescription: '', companyValues: '', interviewerNotes: '', stories: [] }
}
