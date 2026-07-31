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
    const { service, testable, sent } = makeService()
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
    expect(sent.map((message) => JSON.parse(message))).toContainEqual(expect.objectContaining({
      type: 'response.create',
      response: expect.objectContaining({ output_modalities: ['text'] }),
    }))
  })

  it('requests audio-only interviewer responses with the current Realtime field', () => {
    const { service, sent } = makeService()
    const testable = service as unknown as { requestOpeningQuestion(): void }

    testable.requestOpeningQuestion()

    expect(sent.map((message) => JSON.parse(message))).toContainEqual({
      type: 'response.create',
      response: {
        output_modalities: ['audio'],
        instructions: 'Start the mock interview now. Ask only the first question.',
      },
    })
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
      { dimension: 'starCompleteness', label: 'STAR completeness', score: 4, evidence: 'complete' },
      { dimension: 'structure', label: 'Structure', score: 4, evidence: 'good' },
      { dimension: 'communication', label: 'Communication', score: 3, evidence: 'paced' },
      { dimension: 'clarification', label: 'Clarification', score: 3, evidence: 'scoped' },
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

  it('does not mark a partial rubric graded or include it in the average', async () => {
    const sessions = makeSessions()
    const service = new MockInterviewService({
      grader: makeGrader({
        rubric: [{ dimension: 'structure', label: 'Structure', score: 5, evidence: 'clear' }],
        annotations: [],
        strengths: [],
        gaps: [],
        nextDrills: [],
      }),
      sessions: sessions.store as never,
    })

    await (service as unknown as { persistSession(args: unknown): Promise<void> }).persistSession({
      sessionId: 'partial',
      startedAt: 1,
      endedAt: 2,
      config: { presetId: 'behavioral', durationMinutes: 30 },
      context: { preset: undefined, vault: emptyVault() },
      apiKey: 'oa',
      transcript: [{ id: 'a', speaker: 'you', status: 'committed', text: 'A', startedAt: 1 }],
      legacyFeedback: '',
    })

    expect(sessions.store.save).toHaveBeenCalledWith(expect.objectContaining({
      graded: false,
      averageScore: null,
      graderError: 'Grading returned an incomplete rubric.',
    }))
  })

  it('grades the same transcript window that is persisted', async () => {
    const calls: Array<{ presetId: PresetId; transcript: TranscriptSegment[] }> = []
    const sessions = makeSessions()
    const service = new MockInterviewService({
      grader: makeGrader({ rubric: [], annotations: [], strengths: [], gaps: [], nextDrills: [] }, calls),
      sessions: sessions.store as never,
    })
    const transcript: TranscriptSegment[] = Array.from({ length: 600 }, (_, index) => ({
      id: `turn-${index}`,
      speaker: index % 2 === 0 ? 'them' : 'you',
      status: 'committed',
      text: `turn ${index}`,
      startedAt: index,
    }))

    await (service as unknown as { persistSession(args: unknown): Promise<void> }).persistSession({
      sessionId: 'bounded',
      startedAt: 1,
      endedAt: 2,
      config: { presetId: 'behavioral', durationMinutes: 30 },
      context: { preset: undefined, vault: emptyVault() },
      apiKey: 'oa',
      transcript,
      legacyFeedback: '',
    })

    expect(calls[0].transcript).toHaveLength(500)
    expect(calls[0].transcript[0].id).toBe('turn-100')
    expect(sessions.store.save).toHaveBeenCalledWith(expect.objectContaining({
      transcript: calls[0].transcript,
    }))
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

  it('rejects stop when the durable session write fails', async () => {
    const sessions = makeSessions()
    sessions.store.save = vi.fn(async () => {
      throw new Error('disk full')
    })
    const service = new MockInterviewService({
      grader: makeGrader({ rubric: [], annotations: [], strengths: [], gaps: [], nextDrills: [] }),
      sessions: sessions.store as never,
    })
    const errors: string[] = []
    service.on('error', (message) => errors.push(message))
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
    testable.sessionId = 'sess-save-failure'
    testable.sessionStartedAt = 1000
    testable.sessionConfig = { presetId: 'behavioral', durationMinutes: 30 }
    testable.promptContext = { preset: undefined, vault: emptyVault() }
    testable.sessionApiKey = 'oa'
    transcriptionMock.flattenForPrompt.mockReturnValue('Them: Q')
    transcriptionMock.snapshot.mockReturnValue({
      segments: [{ id: 'q', speaker: 'them', status: 'committed', text: 'Q', startedAt: 1500 }],
      partials: {},
    })

    const stopPromise = service.stop()
    testable.feedbackResolve?.()
    await expect(stopPromise).rejects.toThrow(/Failed to save mock session: disk full/)
    expect(errors).toContain('Failed to save mock session: disk full')
    expect(service.status().state).toBe('idle')
  })

  it('stop() with a transcript dispatches grading + session save', async () => {
    const grader: GraderClient = {
      grade: vi.fn(async () => ({
        rubric: [
          { dimension: 'clarification', label: 'Clarification', score: 4, evidence: 'ok' },
          { dimension: 'correctness', label: 'Correctness', score: 4, evidence: 'ok' },
          { dimension: 'complexity', label: 'Complexity', score: 4, evidence: 'ok' },
          { dimension: 'communication', label: 'Communication', score: 4, evidence: 'ok' },
        ],
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
    testable.feedbackText = 'free-text feedback'
    testable.feedbackResolve?.()
    await stopPromise

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

    expect(grader.grade).toHaveBeenCalledWith(
      'oa',
      'behavioral',
      [expect.objectContaining({ id: 'late', text: 'Final answer' })],
    )
  })

  it('commits buffered audio and waits for its transcription before saving', async () => {
    const grader = makeGrader({
      rubric: [], annotations: [], strengths: [], gaps: [], nextDrills: [],
    })
    const sessions = makeSessions()
    const service = new MockInterviewService({ grader, sessions: sessions.store as never })
    const sent: string[] = []
    const testable = service as unknown as {
      ws: { readyState: number; send: (m: string) => void; close: () => void; terminate: () => void } | null
      statusValue: { state: string; paused: boolean }
      sessionId: string | null
      sessionStartedAt: number
      sessionConfig: unknown
      promptContext: unknown
      sessionApiKey: string | null
      feedbackResolve: (() => void) | null
      feedbackRequestPending: boolean
      inputDrainMarkerId: string | null
      handleMessage(raw: string): void
    }
    testable.ws = { readyState: 1, send: (message) => sent.push(message), close: vi.fn(), terminate: vi.fn() }
    testable.statusValue = { state: 'active', paused: false }
    testable.sessionId = 'sess-final-turn'
    testable.sessionStartedAt = 1000
    testable.sessionConfig = { presetId: 'behavioral', durationMinutes: 30 }
    testable.promptContext = { preset: undefined, vault: emptyVault() }
    testable.sessionApiKey = 'oa'
    transcriptionMock.flattenForPrompt.mockReturnValue('Them: Q\nYou: final answer')
    transcriptionMock.snapshot.mockReturnValue({ segments: [], partials: {} })

    service.ingest({ audioBase64: 'AAAA', sampleRate: 24000 })
    const stopPromise = service.stop()
    expect(sent.map((message) => JSON.parse(message) as { type: string })).toContainEqual(expect.objectContaining({
      type: 'input_audio_buffer.commit',
    }))
    expect(sessions.store.save).not.toHaveBeenCalled()

    testable.handleMessage(JSON.stringify({
      type: 'input_audio_buffer.committed',
      item_id: 'final-item',
    }))
    testable.handleMessage(JSON.stringify({
      type: 'conversation.item.added',
      item: { id: testable.inputDrainMarkerId },
    }))
    transcriptionMock.snapshot.mockReturnValue({
      segments: [
        { id: 'final', speaker: 'you', status: 'committed', text: 'final answer', startedAt: 1500 },
      ],
      partials: {},
    })
    testable.handleMessage(JSON.stringify({
      type: 'conversation.item.input_audio_transcription.completed',
      item_id: 'final-item',
      transcript: 'final answer',
    }))
    await vi.waitFor(() => expect(testable.feedbackRequestPending).toBe(true))
    testable.handleMessage(JSON.stringify({ type: 'response.done' }))
    await stopPromise

    expect(sessions.store.save).toHaveBeenCalledWith(expect.objectContaining({
      transcript: [expect.objectContaining({ id: 'final', text: 'final answer' })],
    }))
  })

  it('waits for the explicit shutdown commit when an earlier VAD commit arrives late', async () => {
    const sessions = makeSessions()
    const service = new MockInterviewService({
      grader: makeGrader({ rubric: [], annotations: [], strengths: [], gaps: [], nextDrills: [] }),
      sessions: sessions.store as never,
    })
    const sent: string[] = []
    const testable = service as unknown as {
      ws: { readyState: number; send: (m: string) => void; close: () => void; terminate: () => void } | null
      statusValue: { state: string; paused: boolean }
      sessionId: string | null
      sessionStartedAt: number
      sessionConfig: unknown
      promptContext: unknown
      sessionApiKey: string | null
      feedbackRequestPending: boolean
      inputDrainMarkerId: string | null
      handleMessage(raw: string): void
    }
    testable.ws = { readyState: 1, send: (message) => sent.push(message), close: vi.fn(), terminate: vi.fn() }
    testable.statusValue = { state: 'active', paused: false }
    testable.sessionId = 'sess-ordered-drain'
    testable.sessionStartedAt = 1000
    testable.sessionConfig = { presetId: 'behavioral', durationMinutes: 30 }
    testable.promptContext = { preset: undefined, vault: emptyVault() }
    testable.sessionApiKey = 'oa'
    transcriptionMock.flattenForPrompt.mockReturnValue('Them: Q\nYou: final answer')
    transcriptionMock.snapshot.mockReturnValue({
      segments: [{ id: 'final', speaker: 'you', status: 'committed', text: 'final answer', startedAt: 1500 }],
      partials: {},
    })

    service.ingest({ audioBase64: 'AAAA', sampleRate: 24000 })
    const stopPromise = service.stop()
    const markerId = testable.inputDrainMarkerId
    expect(markerId).toMatch(/^shutdown-drain-/)

    testable.handleMessage(JSON.stringify({
      type: 'input_audio_buffer.committed',
      item_id: 'earlier-vad-item',
    }))
    testable.handleMessage(JSON.stringify({
      type: 'conversation.item.input_audio_transcription.completed',
      item_id: 'earlier-vad-item',
      transcript: 'earlier answer',
    }))
    expect(testable.feedbackRequestPending).toBe(false)

    testable.handleMessage(JSON.stringify({
      type: 'input_audio_buffer.committed',
      item_id: 'shutdown-item',
    }))
    testable.handleMessage(JSON.stringify({
      type: 'conversation.item.added',
      item: { id: markerId },
    }))
    expect(testable.feedbackRequestPending).toBe(false)

    testable.handleMessage(JSON.stringify({
      type: 'conversation.item.input_audio_transcription.completed',
      item_id: 'shutdown-item',
      transcript: 'final answer',
    }))
    await vi.waitFor(() => expect(testable.feedbackRequestPending).toBe(true))
    testable.handleMessage(JSON.stringify({ type: 'response.done' }))
    await stopPromise

    expect(sent.map((message) => JSON.parse(message) as { type: string })).toContainEqual({
      type: 'conversation.item.delete',
      item_id: markerId,
    })
  })

  it('does not resolve stop until the session write completes', async () => {
    let resolveSave: (value: unknown) => void = () => undefined
    const sessions = makeSessions()
    sessions.store.save = vi.fn((input: Record<string, unknown>) =>
      new Promise((resolve) => {
        resolveSave = () => resolve({ ...input, id: input.id as string })
      }) as never,
    )
    const service = new MockInterviewService({
      grader: makeGrader({ rubric: [], annotations: [], strengths: [], gaps: [], nextDrills: [] }),
      sessions: sessions.store as never,
    })
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
    testable.sessionId = 'sess-durable'
    testable.sessionStartedAt = 1000
    testable.sessionConfig = { presetId: 'behavioral', durationMinutes: 30 }
    testable.promptContext = { preset: undefined, vault: emptyVault() }
    testable.sessionApiKey = 'oa'
    transcriptionMock.flattenForPrompt.mockReturnValue('Them: Q')
    transcriptionMock.snapshot.mockReturnValue({
      segments: [{ id: 'q', speaker: 'them', status: 'committed', text: 'Q', startedAt: 1500 }],
      partials: {},
    })

    let stopped = false
    const stopPromise = service.stop().then(() => {
      stopped = true
    })
    testable.feedbackResolve?.()
    await vi.waitFor(() => expect(sessions.store.save).toHaveBeenCalled())
    expect(stopped).toBe(false)
    expect(service.status().state).toBe('stopping')
    await expect(
      service.start('next-key', { presetId: 'behavioral', durationMinutes: 15 }, {
        preset: undefined,
        vault: emptyVault(),
      }),
    ).rejects.toThrow(/still being saved/)

    resolveSave(undefined)
    await stopPromise
    expect(stopped).toBe(true)
    expect(service.status().state).toBe('idle')
  })

  it('finishes a pending stop and saves the transcript after transport loss', async () => {
    const sessions = makeSessions()
    const service = new MockInterviewService({
      grader: makeGrader({ rubric: [], annotations: [], strengths: [], gaps: [], nextDrills: [] }),
      sessions: sessions.store as never,
    })
    const testable = service as unknown as {
      ws: { readyState: number; send: (m: string) => void; close: () => void; terminate: () => void } | null
      statusValue: { state: string; paused: boolean }
      sessionId: string | null
      sessionStartedAt: number
      sessionConfig: unknown
      promptContext: unknown
      sessionApiKey: string | null
      feedbackRequestPending: boolean
      handleUnexpectedDisconnect(): void
    }
    testable.ws = { readyState: 1, send: vi.fn(), close: vi.fn(), terminate: vi.fn() }
    testable.statusValue = { state: 'active', paused: false }
    testable.sessionId = 'sess-disconnected'
    testable.sessionStartedAt = 1000
    testable.sessionConfig = { presetId: 'behavioral', durationMinutes: 30 }
    testable.promptContext = { preset: undefined, vault: emptyVault() }
    testable.sessionApiKey = 'oa'
    transcriptionMock.flattenForPrompt.mockReturnValue('Them: Q')
    transcriptionMock.snapshot.mockReturnValue({
      segments: [{ id: 'q', speaker: 'them', status: 'committed', text: 'Q', startedAt: 1500 }],
      partials: {},
    })

    const stopPromise = service.stop()
    await vi.waitFor(() => expect(testable.feedbackRequestPending).toBe(true))
    testable.ws = null
    testable.handleUnexpectedDisconnect()
    await stopPromise

    expect(sessions.store.save).toHaveBeenCalledWith(expect.objectContaining({ id: 'sess-disconnected' }))
    expect(service.status().state).toBe('idle')
  })

  it('tears down and persists after a Realtime protocol error', async () => {
    const sessions = makeSessions()
    const service = new MockInterviewService({
      grader: makeGrader({ rubric: [], annotations: [], strengths: [], gaps: [], nextDrills: [] }),
      sessions: sessions.store as never,
    })
    const terminate = vi.fn()
    const testable = service as unknown as {
      ws: { readyState: number; send: (m: string) => void; terminate: () => void } | null
      statusValue: { state: string; paused: boolean }
      sessionId: string | null
      sessionStartedAt: number
      sessionConfig: unknown
      promptContext: unknown
      sessionApiKey: string | null
      handleMessage(raw: string): void
    }
    testable.ws = { readyState: 1, send: vi.fn(), terminate }
    testable.statusValue = { state: 'active', paused: false }
    testable.sessionId = 'sess-error'
    testable.sessionStartedAt = 1000
    testable.sessionConfig = { presetId: 'behavioral', durationMinutes: 30 }
    testable.promptContext = { preset: undefined, vault: emptyVault() }
    testable.sessionApiKey = 'oa'
    transcriptionMock.snapshot.mockReturnValue({
      segments: [{ id: 'q', speaker: 'them', status: 'committed', text: 'Q', startedAt: 1500 }],
      partials: {},
    })
    service.on('error', vi.fn())

    testable.handleMessage(JSON.stringify({ type: 'error', error: { message: 'bad request' } }))
    await vi.waitFor(() => expect(sessions.store.save).toHaveBeenCalled())

    expect(terminate).toHaveBeenCalled()
    expect(testable.ws).toBeNull()
    expect(service.status().state).toBe('idle')
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
