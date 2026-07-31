import { EventEmitter } from 'node:events'
import { randomUUID } from 'node:crypto'
import WebSocket from 'ws'
import type { SocketState, StreamTag } from '@shared/types'

const MODEL = 'gpt-live-transcribe'
const ENDPOINT = 'wss://api.openai.com/v1/realtime?intent=transcription'
const INPUT_SAMPLE_RATE = 24000
const BYTES_PER_SAMPLE = 2
const COMMIT_INTERVAL_MS = 2000
const COMMIT_INTERVAL_BYTES = INPUT_SAMPLE_RATE * BYTES_PER_SAMPLE * (COMMIT_INTERVAL_MS / 1000)
const MAX_BUFFERED_BYTES = 1_000_000
const MAX_QUEUE = 200
const MAX_RETRIES = 8
const DEFAULT_DRAIN_TIMEOUT_MS = 2000

type TranscriptionResult =
  | { status: 'pending' }
  | { status: 'completed'; transcript: string }
  | { status: 'failed' }

type DrainPhase = 'idle' | 'waiting_final_commit' | 'waiting_transcripts'

interface QueuedAudio {
  payload: string
  byteLength: number
}

export interface RealtimeTranscriptionEvents {
  partial: (text: string, itemId: string) => void
  committed: (text: string, itemId: string) => void
  state: (state: SocketState, message?: string) => void
}

export class OpenAIRealtimeTranscriptionSocket extends EventEmitter {
  private ws: WebSocket | null = null
  private apiKey = ''
  private queue: QueuedAudio[] = []
  private partials = new Map<string, string>()
  private itemOrder: string[] = []
  private itemResults = new Map<string, TranscriptionResult>()
  private retries = 0
  private retryTimer: NodeJS.Timeout | null = null
  private explicitClose = false
  private configured = false
  private acceptingAudio = true
  private audioAppended = false
  private bufferedAudioBytes = 0
  private pendingCommitEventIds: string[] = []
  private draining = false
  private drainPhase: DrainPhase = 'idle'
  private drainCommitEventId: string | null = null
  private drainTimer: NodeJS.Timeout | null = null
  private drainPromise: Promise<void> | null = null
  private resolveDrain: (() => void) | null = null
  private state: SocketState = 'idle'

  constructor(
    public readonly stream: StreamTag,
    private readonly drainTimeoutMs = DEFAULT_DRAIN_TIMEOUT_MS,
  ) {
    super()
  }

  on<K extends keyof RealtimeTranscriptionEvents>(
    event: K,
    listener: RealtimeTranscriptionEvents[K],
  ): this {
    return super.on(event, listener as (...args: unknown[]) => void)
  }

  emit<K extends keyof RealtimeTranscriptionEvents>(
    event: K,
    ...args: Parameters<RealtimeTranscriptionEvents[K]>
  ): boolean {
    return super.emit(event, ...args)
  }

  connect(apiKey: string): void {
    this.apiKey = apiKey
    this.explicitClose = false
    this.acceptingAudio = true
    this.openSocket()
  }

  close(): Promise<void> {
    if (this.drainPromise) return this.drainPromise
    this.explicitClose = true
    this.acceptingAudio = false
    if (this.retryTimer) {
      clearTimeout(this.retryTimer)
      this.retryTimer = null
    }
    if (!this.ws) {
      this.finishClose()
      return Promise.resolve()
    }

    this.draining = true
    const drainPromise = new Promise<void>((resolve) => {
      this.resolveDrain = resolve
    })
    this.drainPromise = drainPromise
    this.drainTimer = setTimeout(() => this.finishClose(), this.drainTimeoutMs)
    if (this.configured && this.ws.readyState === WebSocket.OPEN) this.beginDrain()
    return drainPromise
  }

  closeImmediately(): void {
    this.explicitClose = true
    this.acceptingAudio = false
    if (this.retryTimer) {
      clearTimeout(this.retryTimer)
      this.retryTimer = null
    }
    this.finishClose()
  }

  send(audioBase64: string, sampleRate: number): void {
    if (!this.acceptingAudio) return
    if (sampleRate !== INPUT_SAMPLE_RATE) {
      this.setState('error', `OpenAI transcription requires ${INPUT_SAMPLE_RATE} Hz PCM audio; received ${sampleRate} Hz.`)
      return
    }
    const payload = JSON.stringify({
      type: 'input_audio_buffer.append',
      audio: audioBase64,
    })
    const byteLength = Buffer.from(audioBase64, 'base64').byteLength
    if (this.ws && this.ws.readyState === WebSocket.OPEN && this.configured) {
      if (this.ws.bufferedAmount > MAX_BUFFERED_BYTES) return
      this.sendAudioPayload(payload, byteLength)
    } else if (this.queue.length < MAX_QUEUE) {
      this.queue.push({ payload, byteLength })
    }
  }

  private openSocket(): void {
    this.configured = false
    this.partials.clear()
    this.itemOrder = []
    this.itemResults.clear()
    this.audioAppended = false
    this.bufferedAudioBytes = 0
    this.pendingCommitEventIds = []
    this.setState(this.retries === 0 ? 'connecting' : 'reconnecting')

    const ws = new WebSocket(ENDPOINT, {
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'OpenAI-Safety-Identifier': 'overlay-ai-local-user',
      },
    })
    this.ws = ws

    ws.on('open', () => {
      this.sendSessionUpdate(ws)
    })

    ws.on('message', (raw) => this.handleMessage(raw))

    ws.on('error', (err) => {
      console.warn(`[openai-transcription:${this.stream}] error`, err.message)
    })

    ws.on('close', (code, reasonBuf) => {
      const reason = reasonBuf?.toString() ?? ''
      if (this.ws === ws) this.ws = null
      this.configured = false
      if (this.explicitClose) {
        this.finishClose()
        return
      }
      if (this.state === 'auth_error' || code === 1008 || /auth|unauthorized|forbidden|api key/i.test(reason)) {
        this.setState('auth_error', reason || 'Unauthorized')
        return
      }
      this.scheduleReconnect(reason || `closed (${code})`)
    })
  }

  private handleMessage(raw: WebSocket.RawData): void {
    if (this.explicitClose && !this.draining) return
    let event: Record<string, unknown>
    try {
      event = JSON.parse(raw.toString()) as Record<string, unknown>
    } catch {
      return
    }
    const type = typeof event.type === 'string' ? event.type : ''

    if (type === 'session.updated') {
      this.retries = 0
      this.configured = true
      this.setState('open')
      this.flushQueue()
      if (this.draining) {
        this.beginDrain()
      }
      return
    }

    if (type === 'input_audio_buffer.committed') {
      this.pendingCommitEventIds.shift()
      const itemId = this.eventItemId(event)
      if (!itemId) return
      if (!this.itemResults.has(itemId)) this.itemResults.set(itemId, { status: 'pending' })
      if (!this.itemOrder.includes(itemId)) this.itemOrder.push(itemId)
      if (this.drainPhase === 'waiting_final_commit' && this.pendingCommitEventIds.length === 0) {
        this.drainPhase = 'waiting_transcripts'
        this.drainCommitEventId = null
      }
      this.flushCompletedItems()
      return
    }

    if (type === 'conversation.item.input_audio_transcription.delta') {
      const delta = typeof event.delta === 'string' ? event.delta : ''
      if (!delta) return
      const itemId = this.eventItemId(event)
      if (!itemId) return
      const key = this.itemKey(event)
      const text = `${this.partials.get(key) ?? ''}${delta}`
      this.partials.set(key, text)
      this.emit('partial', text, itemId)
      return
    }

    if (type === 'conversation.item.input_audio_transcription.completed') {
      const transcript = typeof event.transcript === 'string' ? event.transcript.trim() : ''
      const itemId = this.eventItemId(event)
      if (!itemId) return
      this.partials.delete(this.itemKey(event))
      this.itemResults.set(itemId, { status: 'completed', transcript })
      this.flushCompletedItems()
      return
    }

    if (type === 'conversation.item.input_audio_transcription.failed') {
      const itemId = this.eventItemId(event)
      if (!itemId) return
      this.partials.delete(this.itemKey(event))
      this.itemResults.set(itemId, { status: 'failed' })
      const message = this.errorMessage(event) ?? 'OpenAI failed to transcribe an audio turn.'
      console.warn(`[openai-transcription:${this.stream}] ${message}`)
      this.flushCompletedItems()
      return
    }

    if (type === 'error') {
      const message = this.errorMessage(event) ?? 'OpenAI realtime transcription error.'
      const relatedEventId = this.nestedString(event, ['error', 'event_id'])
      if (relatedEventId && this.pendingCommitEventIds.includes(relatedEventId)) {
        this.pendingCommitEventIds = this.pendingCommitEventIds.filter((eventId) => eventId !== relatedEventId)
        if (relatedEventId === this.drainCommitEventId) this.drainCommitEventId = null
        if (this.drainPhase === 'waiting_final_commit' && this.pendingCommitEventIds.length === 0) {
          this.drainPhase = 'waiting_transcripts'
          this.finishDrainIfIdle()
          return
        }
      }
      const code = this.nestedString(event, ['error', 'code']) ?? ''
      const auth = /auth|unauthorized|forbidden|api[_ ]?key/i.test(`${code} ${message}`)
      this.setState(auth ? 'auth_error' : 'error', message)
    }
  }

  private itemKey(event: Record<string, unknown>): string {
    const itemId = this.eventItemId(event) ?? 'unknown'
    const contentIndex = typeof event.content_index === 'number' ? event.content_index : 0
    return `${itemId}:${contentIndex}`
  }

  private eventItemId(event: Record<string, unknown>): string | null {
    return typeof event.item_id === 'string' && event.item_id ? event.item_id : null
  }

  private errorMessage(event: Record<string, unknown>): string | null {
    return this.nestedString(event, ['error', 'message'])
      ?? this.nestedString(event, ['error', 'type'])
      ?? (typeof event.message === 'string' ? event.message : null)
  }

  private nestedString(value: Record<string, unknown>, path: string[]): string | null {
    let current: unknown = value
    for (const key of path) {
      if (!current || typeof current !== 'object') return null
      current = (current as Record<string, unknown>)[key]
    }
    return typeof current === 'string' ? current : null
  }

  private scheduleReconnect(reason: string): void {
    if (this.retries >= MAX_RETRIES) {
      this.setState('error', `Reconnect failed after ${MAX_RETRIES} attempts: ${reason}`)
      return
    }
    const delay = Math.min(30_000, 500 * 2 ** this.retries)
    this.retries += 1
    this.setState('reconnecting', `Retry ${this.retries} in ${delay}ms — ${reason}`)
    this.retryTimer = setTimeout(() => this.openSocket(), delay)
  }

  private flushQueue(): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN || !this.configured) return
    while (this.queue.length > 0) {
      const next = this.queue.shift()
      if (next) {
        this.sendAudioPayload(next.payload, next.byteLength)
      }
    }
  }

  private sendAudioPayload(payload: string, byteLength: number): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return
    this.ws.send(payload)
    this.audioAppended = true
    this.bufferedAudioBytes += byteLength
    if (this.bufferedAudioBytes >= COMMIT_INTERVAL_BYTES) this.sendCommit()
  }

  private beginDrain(): void {
    this.flushQueue()
    if (this.drainPhase !== 'idle') {
      this.finishDrainIfIdle()
      return
    }
    if (this.audioAppended && this.ws?.readyState === WebSocket.OPEN) {
      this.sendFinalCommit()
    } else if (this.pendingCommitEventIds.length > 0) {
      this.drainPhase = 'waiting_final_commit'
    } else {
      this.drainPhase = 'waiting_transcripts'
    }
    this.finishDrainIfIdle()
  }

  private sendFinalCommit(): void {
    if (this.drainPhase !== 'idle' || this.ws?.readyState !== WebSocket.OPEN) return
    this.drainPhase = 'waiting_final_commit'
    this.drainCommitEventId = this.sendCommit('drain_commit')
  }

  private sendCommit(prefix = 'periodic_commit'): string | null {
    if (!this.audioAppended || this.ws?.readyState !== WebSocket.OPEN) return null
    const eventId = `${prefix}_${randomUUID()}`
    this.ws.send(JSON.stringify({ event_id: eventId, type: 'input_audio_buffer.commit' }))
    this.pendingCommitEventIds.push(eventId)
    this.audioAppended = false
    this.bufferedAudioBytes = 0
    return eventId
  }

  private sendSessionUpdate(ws: WebSocket): void {
    ws.send(JSON.stringify({
      type: 'session.update',
      session: {
        type: 'transcription',
        audio: {
          input: {
            format: { type: 'audio/pcm', rate: INPUT_SAMPLE_RATE },
            transcription: {
              model: MODEL,
              prompt: 'A software engineering interview with technical terminology, code, system design, and behavioral questions.',
              keywords: [
                'API',
                'JavaScript',
                'Kubernetes',
                'Node.js',
                'PostgreSQL',
                'React',
                'TypeScript',
              ],
              languages: ['en'],
              delay: 'low',
            },
            turn_detection: null,
          },
        },
      },
    }))
  }

  private flushCompletedItems(): void {
    while (this.itemOrder.length > 0) {
      const itemId = this.itemOrder[0]
      const result = this.itemResults.get(itemId)
      if (!result || result.status === 'pending') break
      this.itemOrder.shift()
      this.itemResults.delete(itemId)
      if (result.status === 'completed' && result.transcript) {
        this.emit('committed', result.transcript, itemId)
      }
    }
    this.finishDrainIfIdle()
  }

  private finishDrainIfIdle(): void {
    if (
      this.draining
      && this.drainPhase === 'waiting_transcripts'
      && this.itemOrder.length === 0
      && this.itemResults.size === 0
    ) {
      this.finishClose()
    }
  }

  private finishClose(): void {
    if (this.drainTimer) {
      clearTimeout(this.drainTimer)
      this.drainTimer = null
    }
    const ws = this.ws
    this.ws = null
    if (ws) {
      try { ws.close() } catch { /* ignore */ }
    }
    this.configured = false
    this.draining = false
    this.drainPhase = 'idle'
    this.drainCommitEventId = null
    this.audioAppended = false
    this.bufferedAudioBytes = 0
    this.pendingCommitEventIds = []
    this.queue = []
    this.partials.clear()
    this.itemOrder = []
    this.itemResults.clear()
    this.setState('closed')
    const resolve = this.resolveDrain
    this.resolveDrain = null
    this.drainPromise = null
    resolve?.()
  }

  private setState(state: SocketState, message?: string): void {
    if (this.state === state && !message) return
    this.state = state
    this.emit('state', state, message)
  }
}
