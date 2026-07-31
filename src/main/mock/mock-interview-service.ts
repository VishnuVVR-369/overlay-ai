import { EventEmitter } from 'node:events'
import { randomUUID } from 'node:crypto'
import WebSocket from 'ws'
import type {
  MockAudioChunkMessage,
  MockAudioDeltaEvent,
  MockFeedbackEvent,
  MockInterviewConfig,
  MockInterviewStatus,
  MockSessionRecord,
  MockSessionSavedEvent,
  MockStatusEvent,
  TranscriptSegment,
} from '@shared/types'
import { transcription } from '../transcription/transcription-service'
import {
  buildMockInstructions,
  FEEDBACK_RESPONSE_INSTRUCTIONS,
  FEEDBACK_USER_PROMPT,
  RESET_RESPONSE_INSTRUCTIONS,
  type MockPromptContext,
} from './mock-config'
import { mockGrader, averageRubricScore, type GraderClient, type GraderResult } from './mock-grader'
import { rubricDimensionsForPreset } from '@shared/mock-rubric'
import { mockSessionStore, truncateMockTranscript, type MockSessionStore } from './mock-session-store'

const REALTIME_MODEL = 'gpt-realtime-2.1'
const REALTIME_URL = `wss://api.openai.com/v1/realtime?model=${REALTIME_MODEL}`
const SAMPLE_RATE = 24000
const MAX_SESSION_MS = 59 * 60 * 1000
const FEEDBACK_TIMEOUT_MS = 5000
const INPUT_TRANSCRIPT_TIMEOUT_MS = 5000

export interface MockInterviewServiceEvents {
  status: (event: MockStatusEvent) => void
  audioDelta: (event: MockAudioDeltaEvent) => void
  feedback: (event: MockFeedbackEvent) => void
  playbackStop: () => void
  error: (message: string) => void
  sessionSaved: (event: MockSessionSavedEvent) => void
}

export interface MockInterviewServiceDeps {
  grader?: GraderClient
  sessions?: MockSessionStore
}

export class MockInterviewService extends EventEmitter {
  private ws: WebSocket | null = null
  private statusValue: MockInterviewStatus = { state: 'idle', paused: false }
  private sessionApiKey: string | null = null
  private sessionConfig: MockInterviewConfig | null = null
  private promptContext: MockPromptContext | null = null
  private stopTimer: NodeJS.Timeout | null = null
  private outputTranscript = ''
  private feedbackText = ''
  private feedbackRequestPending = false
  private feedbackResolve: (() => void) | null = null
  private feedbackTimer: NodeJS.Timeout | null = null
  private currentResponseAudio = false
  private committedInputKeys = new Set<string>()
  private committedOutputKeys = new Set<string>()
  private inputBufferHasAudio = false
  private pendingInputTranscriptions = new Set<string>()
  private inputTranscriptResolve: (() => void) | null = null
  private inputTranscriptTimer: NodeJS.Timeout | null = null
  private inputDrainMarkerId: string | null = null
  private shutdownCommitEventId: string | null = null
  private sessionId: string | null = null
  private sessionStartedAt = 0
  private stopPromise: Promise<void> | null = null
  private grader: GraderClient
  private sessions: MockSessionStore

  constructor(deps: MockInterviewServiceDeps = {}) {
    super()
    this.grader = deps.grader ?? mockGrader
    this.sessions = deps.sessions ?? mockSessionStore
  }

  on<K extends keyof MockInterviewServiceEvents>(event: K, listener: MockInterviewServiceEvents[K]): this {
    return super.on(event, listener as (...args: unknown[]) => void)
  }

  emit<K extends keyof MockInterviewServiceEvents>(event: K, ...args: Parameters<MockInterviewServiceEvents[K]>): boolean {
    return super.emit(event, ...args)
  }

  status(): MockInterviewStatus {
    return { ...this.statusValue }
  }

  async start(apiKey: string, config: MockInterviewConfig, context: MockPromptContext): Promise<MockInterviewStatus> {
    if (this.stopPromise) throw new Error('The previous mock interview is still being saved.')
    if (this.ws && this.statusValue.state !== 'idle') return this.status()
    this.setStatus({ state: 'connecting', paused: false, message: 'Connecting mock interviewer.' })

    const startedAt = Date.now()
    const durationMs = Math.min(config.durationMinutes * 60 * 1000, MAX_SESSION_MS)
    const endsAt = startedAt + durationMs

    try {
      await this.openSocket(apiKey)
    } catch (err) {
      this.setStatus({ state: 'idle', paused: false })
      throw err
    }

    this.sessionApiKey = apiKey
    this.sessionConfig = config
    this.promptContext = context
    this.sessionId = randomUUID()
    this.sessionStartedAt = startedAt
    this.resetEventDedupe()
    this.resetInputTracking()
    this.configureSession(config, context)
    this.requestOpeningQuestion()

    this.stopTimer = setTimeout(() => {
      void this.stop()
    }, durationMs)
    this.setStatus({ state: 'active', startedAt, endsAt, paused: false })
    return this.status()
  }

  stop(): Promise<void> {
    if (this.stopPromise) return this.stopPromise
    const operation = this.performStop()
    const tracked = operation.finally(() => {
      if (this.stopPromise === tracked) {
        this.stopPromise = null
        this.setStatus({ state: 'idle', paused: false })
      }
    })
    this.stopPromise = tracked
    return tracked
  }

  private async performStop(): Promise<void> {
    if (!this.sessionId || !this.sessionConfig || !this.promptContext) {
      this.setStatus({ state: 'idle', paused: false })
      return
    }
    this.setStatus({ ...this.statusValue, state: 'stopping', message: 'Stopping mock interview.' })
    const sessionId = this.sessionId
    const startedAt = this.sessionStartedAt
    const config = this.sessionConfig
    const context = this.promptContext
    const apiKey = this.sessionApiKey
    if (this.ws) {
      this.cancelCurrentResponse()
      const inputTranscript = this.flushInputTranscript()
      if (inputTranscript) await inputTranscript
      await this.requestFeedback()
    }
    const legacyFeedback = this.feedbackText.trim()
    const transcriptSnapshot = this.captureTranscriptSnapshot()
    this.close(false)
    if (transcriptSnapshot.length > 0) {
      await this.persistSession({
        sessionId,
        startedAt,
        endedAt: Date.now(),
        config,
        context,
        apiKey,
        transcript: transcriptSnapshot,
        legacyFeedback,
      })
    }
  }

  pause(): void {
    if (!this.ws || this.statusValue.state !== 'active') return
    this.cancelCurrentResponse()
    this.setStatus({ ...this.statusValue, state: 'paused', paused: true, message: 'Mock interview paused.' })
  }

  resume(): void {
    if (!this.ws || this.statusValue.state !== 'paused') return
    this.setStatus({ ...this.statusValue, state: 'active', paused: false, message: undefined })
    this.send({
      type: 'response.create',
      response: {
        output_modalities: ['audio'],
        instructions: 'Resume the mock interview with the next appropriate question or follow-up.',
      },
    })
  }

  ingest(chunk: MockAudioChunkMessage): void {
    if (!this.ws || this.statusValue.state !== 'active') return
    this.inputBufferHasAudio = true
    this.send({ type: 'input_audio_buffer.append', audio: chunk.audioBase64 })
  }

  abort(): void {
    this.close()
  }

  async resetContext(): Promise<void> {
    if (!this.ws || (this.statusValue.state !== 'active' && this.statusValue.state !== 'paused')) return
    if (!this.sessionApiKey || !this.sessionConfig || !this.promptContext) return
    const previous = this.status()
    this.cancelCurrentResponse()
    this.outputTranscript = ''
    this.feedbackText = ''
    this.finishFeedbackWait()
    this.resetEventDedupe()
    this.resetInputTracking()
    this.setStatus({ ...previous, state: 'connecting', message: 'Resetting mock interview context.' })

    const old = this.ws
    this.ws = null
    if (old && old.readyState === WebSocket.OPEN) old.close()
    else if (old) old.terminate()

    try {
      await this.openSocket(this.sessionApiKey)
      this.configureSession(this.sessionConfig, this.promptContext)
      if (previous.state === 'paused') {
        this.setStatus({ ...previous, state: 'paused', paused: true, message: 'Mock interview paused.' })
      } else {
        this.requestOpeningQuestion(RESET_RESPONSE_INSTRUCTIONS)
        this.setStatus({ ...previous, state: 'active', paused: false, message: undefined })
      }
    } catch (err) {
      const message = (err as Error).message ?? 'Mock interview reset failed.'
      this.setStatus({ ...previous, state: 'error', paused: false, message })
      this.emit('error', message)
    }
  }

  private async openSocket(apiKey: string): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      const ws = new WebSocket(REALTIME_URL, {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'OpenAI-Safety-Identifier': 'overlay-ai-local-user',
        },
      })
      this.ws = ws
      let opened = false
      let settled = false

      const onOpen = (): void => {
        opened = true
        settled = true
        resolve()
      }
      const onError = (err: Error): void => {
        if (!opened) {
          settled = true
          ws.off('open', onOpen)
          if (this.ws === ws) this.ws = null
          reject(err)
          return
        }
        this.handleTransportFailure(ws, err.message || 'OpenAI realtime connection failed.')
      }
      ws.once('open', onOpen)
      ws.on('error', onError)
      ws.on('message', (raw) => this.handleMessage(raw.toString()))
      ws.on('close', () => {
        if (!settled) {
          settled = true
          ws.off('open', onOpen)
          reject(new Error('OpenAI realtime connection closed before it opened.'))
        }
        if (this.ws !== ws) return
        this.ws = null
        this.handleUnexpectedDisconnect()
      })
    })
  }

  private async requestFeedback(): Promise<void> {
    if (!this.ws || this.feedbackRequestPending) return
    const transcript = transcription.flattenForPrompt().trim()
    if (!transcript) return
    this.feedbackRequestPending = true
    this.feedbackText = ''
    const itemId = `feedback-${randomUUID()}`
    this.send({
      type: 'conversation.item.create',
      item: {
        id: itemId,
        type: 'message',
        role: 'user',
        content: [{ type: 'input_text', text: FEEDBACK_USER_PROMPT }],
      },
    })
    this.send({
      type: 'response.create',
      response: {
        output_modalities: ['text'],
        instructions: FEEDBACK_RESPONSE_INSTRUCTIONS,
      },
    })

    await new Promise<void>((resolve) => {
      this.feedbackResolve = resolve
      this.feedbackTimer = setTimeout(resolve, FEEDBACK_TIMEOUT_MS)
    })
    this.clearFeedbackTimer()
    this.feedbackResolve = null
    this.feedbackRequestPending = false
    const text = this.feedbackText.trim()
    if (text) this.emit('feedback', { requestId: randomUUID(), text })
  }

  private captureTranscriptSnapshot(): TranscriptSegment[] {
    const snap = transcription.snapshot()
    return snap.segments.filter((seg) => seg.startedAt >= this.sessionStartedAt)
  }

  private flushInputTranscript(): Promise<void> | null {
    if (!this.ws || (!this.inputBufferHasAudio && this.pendingInputTranscriptions.size === 0)) return null
    if (this.inputBufferHasAudio) {
      this.shutdownCommitEventId = `shutdown-commit-${randomUUID()}`
      this.inputDrainMarkerId = `shutdown-drain-${randomUUID()}`
      this.send({
        event_id: this.shutdownCommitEventId,
        type: 'input_audio_buffer.commit',
      })
      // Server events are ordered on the WebSocket. Once this marker item is
      // acknowledged, the preceding explicit commit event has been observed,
      // so its item id is present in pendingInputTranscriptions. Delete the
      // marker before feedback is requested so it never enters model context.
      this.send({
        type: 'conversation.item.create',
        item: {
          id: this.inputDrainMarkerId,
          type: 'message',
          role: 'system',
          content: [{ type: 'input_text', text: 'Mock interview shutdown barrier.' }],
        },
      })
    }
    return new Promise<void>((resolve) => {
      this.inputTranscriptResolve = resolve
      this.inputTranscriptTimer = setTimeout(resolve, INPUT_TRANSCRIPT_TIMEOUT_MS)
      this.resolveInputTranscriptIfDrained()
    }).finally(() => {
      this.clearInputTranscriptTimer()
      this.inputTranscriptResolve = null
    })
  }

  private async persistSession(args: {
    sessionId: string
    startedAt: number
    endedAt: number
    config: MockInterviewConfig
    context: MockPromptContext
    apiKey: string | null
    transcript: TranscriptSegment[]
    legacyFeedback: string
  }): Promise<void> {
    const transcript = truncateMockTranscript(args.transcript)
    let grade: GraderResult = { rubric: [], annotations: [], strengths: [], gaps: [], nextDrills: [] }
    let graded = false
    let graderError: string | undefined
    if (args.apiKey) {
      try {
        grade = await this.grader.grade(args.apiKey, args.config.presetId, transcript)
        graded = hasCompleteRubric(args.config.presetId, grade.rubric)
        if (!graded) graderError = 'Grading returned an incomplete rubric.'
      } catch (err) {
        graderError = (err as Error)?.message ?? 'Grading failed.'
      }
    } else {
      graderError = 'OpenAI key not available for grading.'
    }

    try {
      const record: MockSessionRecord = await this.sessions.save({
        id: args.sessionId,
        presetId: args.config.presetId,
        presetLabel: args.context.preset?.label ?? args.config.presetId,
        durationMinutes: args.config.durationMinutes,
        startedAt: args.startedAt,
        endedAt: args.endedAt,
        transcript,
        legacyFeedback: args.legacyFeedback,
        rubric: grade.rubric,
        annotations: grade.annotations,
        strengths: grade.strengths,
        gaps: grade.gaps,
        nextDrills: grade.nextDrills,
        averageScore: graded ? averageRubricScore(grade.rubric) : null,
        graded,
        ...(graderError ? { graderError } : {}),
      })
      this.emit('sessionSaved', {
        summary: {
          id: record.id,
          presetId: record.presetId,
          presetLabel: record.presetLabel,
          durationMinutes: record.durationMinutes,
          startedAt: record.startedAt,
          endedAt: record.endedAt,
          averageScore: record.averageScore,
          graded: record.graded,
        },
      })
    } catch (err) {
      const message = `Failed to save mock session: ${(err as Error)?.message ?? 'unknown'}`
      this.emit('error', message)
      throw new Error(message, { cause: err })
    }
  }

  private handleMessage(raw: string): void {
    let event: Record<string, unknown>
    try {
      event = JSON.parse(raw) as Record<string, unknown>
    } catch {
      return
    }
    const type = typeof event.type === 'string' ? event.type : ''

    if (type === 'error') {
      const clientEventId = readNestedString(event, ['error', 'event_id'])
      if (clientEventId && clientEventId === this.shutdownCommitEventId) {
        // Server VAD may have committed the buffer just before our explicit
        // shutdown commit arrived. The ordered marker still guarantees that
        // every resulting transcription item is tracked before we snapshot.
        this.shutdownCommitEventId = null
        return
      }
      const message = readNestedString(event, ['error', 'message']) ?? 'OpenAI realtime error.'
      const ws = this.ws
      if (ws) {
        this.handleTransportFailure(ws, message)
      } else {
        this.setStatus({ ...this.statusValue, state: 'error', message })
        this.emit('error', message)
      }
      return
    }

    if (type === 'input_audio_buffer.committed') {
      this.inputBufferHasAudio = false
      const itemId = typeof event.item_id === 'string' ? event.item_id : ''
      if (itemId) this.pendingInputTranscriptions.add(itemId)
      this.resolveInputTranscriptIfDrained()
      return
    }

    if (type === 'conversation.item.added' || type === 'conversation.item.created') {
      const itemId = readNestedString(event, ['item', 'id'])
      if (itemId && itemId === this.inputDrainMarkerId) {
        this.send({ type: 'conversation.item.delete', item_id: itemId })
        this.inputDrainMarkerId = null
        this.shutdownCommitEventId = null
        this.resolveInputTranscriptIfDrained()
      }
      return
    }

    if (type === 'input_audio_buffer.speech_started' && this.currentResponseAudio) {
      this.cancelCurrentResponse()
      return
    }

    if (type === 'response.audio.delta' || type === 'response.output_audio.delta') {
      const delta = typeof event.delta === 'string' ? event.delta : ''
      if (delta) {
        this.currentResponseAudio = true
        this.emit('audioDelta', { audioBase64: delta, sampleRate: SAMPLE_RATE })
      }
      return
    }

    if (type === 'response.audio.done' || type === 'response.output_audio.done') {
      this.currentResponseAudio = false
      return
    }

    if (type === 'response.audio_transcript.delta' || type === 'response.output_audio_transcript.delta') {
      const delta = typeof event.delta === 'string' ? event.delta : ''
      if (!delta) return
      this.outputTranscript += delta
      transcription.injectPartial('them', this.outputTranscript.trim())
      return
    }

    if (type === 'response.audio_transcript.done' || type === 'response.output_audio_transcript.done') {
      const transcript = (typeof event.transcript === 'string' ? event.transcript : this.outputTranscript).trim()
      this.outputTranscript = ''
      if (transcript && this.markCommitted(this.committedOutputKeys, event, transcript)) {
        transcription.injectCommitted('them', transcript)
      }
      return
    }

    if (type === 'conversation.item.input_audio_transcription.completed') {
      const transcript = typeof event.transcript === 'string' ? event.transcript.trim() : ''
      if (transcript && this.markCommitted(this.committedInputKeys, event, transcript)) {
        transcription.injectCommitted('you', transcript)
      }
      const itemId = typeof event.item_id === 'string' ? event.item_id : ''
      if (itemId) this.pendingInputTranscriptions.delete(itemId)
      this.resolveInputTranscriptIfDrained()
      return
    }

    if (type === 'conversation.item.input_audio_transcription.failed') {
      const itemId = typeof event.item_id === 'string' ? event.item_id : ''
      if (itemId) this.pendingInputTranscriptions.delete(itemId)
      this.resolveInputTranscriptIfDrained()
      return
    }

    if (type === 'conversation.item.input_audio_transcription.delta') {
      const delta = typeof event.delta === 'string' ? event.delta.trim() : ''
      if (delta) transcription.injectPartial('you', delta)
      return
    }

    if (this.feedbackRequestPending && (type === 'response.output_text.delta' || type === 'response.text.delta')) {
      const delta = typeof event.delta === 'string' ? event.delta : ''
      this.feedbackText += delta
      return
    }

    if (type === 'response.done') {
      if (this.feedbackRequestPending) this.feedbackResolve?.()
    }
  }

  private cancelCurrentResponse(): void {
    if (!this.ws) return
    this.send({ type: 'response.cancel' })
    this.currentResponseAudio = false
    this.emit('playbackStop')
  }

  private configureSession(config: MockInterviewConfig, context: MockPromptContext): void {
    this.send({
      type: 'session.update',
      session: {
        type: 'realtime',
        instructions: buildMockInstructions(config, context),
        audio: {
          input: {
            format: { type: 'audio/pcm', rate: SAMPLE_RATE },
            transcription: {
              model: 'gpt-realtime-whisper',
              language: 'en',
            },
            turn_detection: { type: 'server_vad' },
          },
          output: {
            format: { type: 'audio/pcm', rate: SAMPLE_RATE },
            voice: 'marin',
          },
        },
        reasoning: { effort: 'medium' },
      },
    })
  }

  private requestOpeningQuestion(instructions = 'Start the mock interview now. Ask only the first question.'): void {
    this.send({
      type: 'response.create',
      response: {
        output_modalities: ['audio'],
        instructions,
      },
    })
  }

  private markCommitted(keys: Set<string>, event: Record<string, unknown>, transcript: string): boolean {
    const key = transcriptEventKey(event, transcript)
    if (keys.has(key)) return false
    keys.add(key)
    return true
  }

  private resetEventDedupe(): void {
    this.committedInputKeys.clear()
    this.committedOutputKeys.clear()
  }

  private send(payload: Record<string, unknown>): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return
    this.ws.send(JSON.stringify(payload))
  }

  private close(publishIdle = true): void {
    this.clearTimer()
    this.finishFeedbackWait()
    this.outputTranscript = ''
    this.feedbackText = ''
    this.feedbackRequestPending = false
    this.finishInputTranscriptWait()
    this.currentResponseAudio = false
    this.sessionApiKey = null
    this.sessionConfig = null
    this.promptContext = null
    this.sessionId = null
    this.sessionStartedAt = 0
    this.resetEventDedupe()
    this.resetInputTracking()
    const ws = this.ws
    this.ws = null
    if (ws && ws.readyState === WebSocket.OPEN) ws.close()
    else if (ws) ws.terminate()
    if (publishIdle) this.setStatus({ state: 'idle', paused: false })
  }

  private clearTimer(): void {
    if (this.stopTimer) clearTimeout(this.stopTimer)
    this.stopTimer = null
  }

  private clearFeedbackTimer(): void {
    if (this.feedbackTimer) clearTimeout(this.feedbackTimer)
    this.feedbackTimer = null
  }

  private finishFeedbackWait(): void {
    this.feedbackResolve?.()
    this.feedbackResolve = null
    this.clearFeedbackTimer()
    this.feedbackRequestPending = false
  }

  private handleTransportFailure(ws: WebSocket, message: string): void {
    if (this.ws !== ws) return
    this.ws = null
    if (ws.readyState !== WebSocket.CLOSED) ws.terminate()
    this.setStatus({ ...this.statusValue, state: 'error', paused: false, message })
    this.emit('error', message)
    this.handleUnexpectedDisconnect()
  }

  private handleUnexpectedDisconnect(): void {
    this.clearTimer()
    this.finishFeedbackWait()
    this.finishInputTranscriptWait()
    if (this.sessionId) {
      void this.stop()
      return
    }
    this.setStatus({ state: 'idle', paused: false })
  }

  private resolveInputTranscriptIfDrained(): void {
    if (this.inputDrainMarkerId || this.pendingInputTranscriptions.size > 0) return
    this.inputTranscriptResolve?.()
  }

  private finishInputTranscriptWait(): void {
    this.inputTranscriptResolve?.()
    this.inputTranscriptResolve = null
    this.clearInputTranscriptTimer()
  }

  private clearInputTranscriptTimer(): void {
    if (this.inputTranscriptTimer) clearTimeout(this.inputTranscriptTimer)
    this.inputTranscriptTimer = null
  }

  private resetInputTracking(): void {
    this.inputBufferHasAudio = false
    this.pendingInputTranscriptions.clear()
    this.inputDrainMarkerId = null
    this.shutdownCommitEventId = null
  }

  private setStatus(next: MockInterviewStatus): void {
    this.statusValue = next
    this.emit('status', this.status())
  }
}

function readNestedString(obj: Record<string, unknown>, path: string[]): string | null {
  let cur: unknown = obj
  for (const key of path) {
    if (!cur || typeof cur !== 'object') return null
    cur = (cur as Record<string, unknown>)[key]
  }
  return typeof cur === 'string' ? cur : null
}

function transcriptEventKey(event: Record<string, unknown>, transcript: string): string {
  const ids = ['item_id', 'itemId', 'response_id', 'responseId', 'event_id', 'eventId']
    .map((key) => event[key])
    .filter((value): value is string => typeof value === 'string' && value.length > 0)
  const contentIndex = typeof event.content_index === 'number' ? `content:${event.content_index}` : ''
  if (ids.length > 0 || contentIndex) return [...ids, contentIndex].filter(Boolean).join(':')
  return `text:${transcript}`
}

export const mockInterview = new MockInterviewService()

function hasCompleteRubric(presetId: MockInterviewConfig['presetId'], rubric: GraderResult['rubric']): boolean {
  const expected = rubricDimensionsForPreset(presetId).map((item) => item.dimension)
  const actual = new Set(rubric.map((item) => item.dimension))
  return rubric.length === expected.length && expected.every((dimension) => actual.has(dimension))
}
