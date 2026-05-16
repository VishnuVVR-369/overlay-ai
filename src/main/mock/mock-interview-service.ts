import { EventEmitter } from 'node:events'
import { randomUUID } from 'node:crypto'
import WebSocket from 'ws'
import type {
  MockAudioChunkMessage,
  MockAudioDeltaEvent,
  MockFeedbackEvent,
  MockInterviewConfig,
  MockInterviewStatus,
  MockStatusEvent,
} from '@shared/types'
import { transcription } from '../transcription/transcription-service'
import {
  buildMockInstructions,
  FEEDBACK_RESPONSE_INSTRUCTIONS,
  FEEDBACK_USER_PROMPT,
  RESET_RESPONSE_INSTRUCTIONS,
  type MockPromptContext,
} from './mock-config'

const REALTIME_MODEL = 'gpt-realtime-2'
const REALTIME_URL = `wss://api.openai.com/v1/realtime?model=${REALTIME_MODEL}`
const SAMPLE_RATE = 24000
const MAX_SESSION_MS = 59 * 60 * 1000
const FEEDBACK_TIMEOUT_MS = 5000

export interface MockInterviewServiceEvents {
  status: (event: MockStatusEvent) => void
  audioDelta: (event: MockAudioDeltaEvent) => void
  feedback: (event: MockFeedbackEvent) => void
  playbackStop: () => void
  error: (message: string) => void
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
    this.resetEventDedupe()
    this.configureSession(config, context)
    this.requestOpeningQuestion()

    this.stopTimer = setTimeout(() => {
      void this.stop()
    }, durationMs)
    this.setStatus({ state: 'active', startedAt, endsAt, paused: false })
    return this.status()
  }

  async stop(): Promise<void> {
    if (!this.ws) {
      this.setStatus({ state: 'idle', paused: false })
      return
    }
    this.setStatus({ ...this.statusValue, state: 'stopping', message: 'Stopping mock interview.' })
    this.cancelCurrentResponse()
    await this.requestFeedback()
    this.close()
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
        modalities: ['audio', 'text'],
        instructions: 'Resume the mock interview with the next appropriate question or follow-up.',
      },
    })
  }

  ingest(chunk: MockAudioChunkMessage): void {
    if (!this.ws || this.statusValue.state !== 'active') return
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
    this.feedbackRequestPending = false
    this.feedbackResolve?.()
    this.feedbackResolve = null
    this.clearFeedbackTimer()
    this.resetEventDedupe()
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

      const onOpen = (): void => {
        ws.off('error', onError)
        resolve()
      }
      const onError = (err: Error): void => {
        ws.off('open', onOpen)
        if (this.ws === ws) this.ws = null
        reject(err)
      }
      ws.once('open', onOpen)
      ws.once('error', onError)
      ws.on('message', (raw) => this.handleMessage(raw.toString()))
      ws.on('close', () => {
        if (this.ws !== ws) return
        this.clearTimer()
        this.clearFeedbackTimer()
        if (this.statusValue.state !== 'idle') this.setStatus({ state: 'idle', paused: false })
        this.ws = null
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
        modalities: ['text'],
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

  private handleMessage(raw: string): void {
    let event: Record<string, unknown>
    try {
      event = JSON.parse(raw) as Record<string, unknown>
    } catch {
      return
    }
    const type = typeof event.type === 'string' ? event.type : ''

    if (type === 'error') {
      const message = readNestedString(event, ['error', 'message']) ?? 'OpenAI realtime error.'
      this.setStatus({ ...this.statusValue, state: 'error', message })
      this.emit('error', message)
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
            format: { type: 'audio/pcm', rate: 16000 },
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
        modalities: ['audio', 'text'],
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

  private close(): void {
    this.clearTimer()
    this.clearFeedbackTimer()
    this.outputTranscript = ''
    this.feedbackText = ''
    this.feedbackRequestPending = false
    this.feedbackResolve?.()
    this.feedbackResolve = null
    this.currentResponseAudio = false
    this.sessionApiKey = null
    this.sessionConfig = null
    this.promptContext = null
    this.resetEventDedupe()
    const ws = this.ws
    this.ws = null
    if (ws && ws.readyState === WebSocket.OPEN) ws.close()
    else if (ws) ws.terminate()
    this.setStatus({ state: 'idle', paused: false })
  }

  private clearTimer(): void {
    if (this.stopTimer) clearTimeout(this.stopTimer)
    this.stopTimer = null
  }

  private clearFeedbackTimer(): void {
    if (this.feedbackTimer) clearTimeout(this.feedbackTimer)
    this.feedbackTimer = null
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
