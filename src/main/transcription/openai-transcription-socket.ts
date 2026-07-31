import { EventEmitter } from 'node:events'
import WebSocket from 'ws'
import type { SocketState, StreamTag } from '@shared/types'

const MODEL = 'gpt-live-transcribe'
const ENDPOINT = `wss://api.openai.com/v1/realtime?model=${MODEL}`
const INPUT_SAMPLE_RATE = 24000
const MAX_BUFFERED_BYTES = 1_000_000
const MAX_QUEUE = 200
const MAX_RETRIES = 8

export interface RealtimeTranscriptionEvents {
  partial: (text: string) => void
  committed: (text: string) => void
  state: (state: SocketState, message?: string) => void
}

export class OpenAIRealtimeTranscriptionSocket extends EventEmitter {
  private ws: WebSocket | null = null
  private apiKey = ''
  private queue: string[] = []
  private partials = new Map<string, string>()
  private retries = 0
  private retryTimer: NodeJS.Timeout | null = null
  private explicitClose = false
  private configured = false
  private state: SocketState = 'idle'

  constructor(public readonly stream: StreamTag) {
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
    this.openSocket()
  }

  close(): void {
    this.explicitClose = true
    if (this.retryTimer) {
      clearTimeout(this.retryTimer)
      this.retryTimer = null
    }
    if (this.ws) {
      try { this.ws.close() } catch { /* ignore */ }
      this.ws = null
    }
    this.configured = false
    this.queue = []
    this.partials.clear()
    this.setState('closed')
  }

  send(audioBase64: string, sampleRate: number): void {
    if (sampleRate !== INPUT_SAMPLE_RATE) {
      this.setState('error', `OpenAI transcription requires ${INPUT_SAMPLE_RATE} Hz PCM audio; received ${sampleRate} Hz.`)
      return
    }
    const payload = JSON.stringify({
      type: 'input_audio_buffer.append',
      audio: audioBase64,
    })
    if (this.ws && this.ws.readyState === WebSocket.OPEN && this.configured) {
      if (this.ws.bufferedAmount > MAX_BUFFERED_BYTES) return
      this.ws.send(payload)
    } else if (this.queue.length < MAX_QUEUE) {
      this.queue.push(payload)
    }
  }

  private openSocket(): void {
    this.configured = false
    this.partials.clear()
    this.setState(this.retries === 0 ? 'connecting' : 'reconnecting')

    const ws = new WebSocket(ENDPOINT, {
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'OpenAI-Safety-Identifier': 'overlay-ai-local-user',
      },
    })
    this.ws = ws

    ws.on('open', () => {
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
              turn_detection: {
                type: 'server_vad',
                threshold: 0.5,
                prefix_padding_ms: 300,
                silence_duration_ms: 500,
              },
            },
          },
        },
      }))
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
        this.setState('closed')
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
      return
    }

    if (type === 'conversation.item.input_audio_transcription.delta') {
      const delta = typeof event.delta === 'string' ? event.delta : ''
      if (!delta) return
      const key = this.itemKey(event)
      const text = `${this.partials.get(key) ?? ''}${delta}`
      this.partials.set(key, text)
      this.emit('partial', text)
      return
    }

    if (type === 'conversation.item.input_audio_transcription.completed') {
      const transcript = typeof event.transcript === 'string' ? event.transcript.trim() : ''
      this.partials.delete(this.itemKey(event))
      if (transcript) this.emit('committed', transcript)
      return
    }

    if (type === 'conversation.item.input_audio_transcription.failed') {
      this.partials.delete(this.itemKey(event))
      const message = this.errorMessage(event) ?? 'OpenAI failed to transcribe an audio turn.'
      console.warn(`[openai-transcription:${this.stream}] ${message}`)
      return
    }

    if (type === 'error') {
      const message = this.errorMessage(event) ?? 'OpenAI realtime transcription error.'
      const code = this.nestedString(event, ['error', 'code']) ?? ''
      const auth = /auth|unauthorized|forbidden|api[_ ]?key/i.test(`${code} ${message}`)
      this.setState(auth ? 'auth_error' : 'error', message)
    }
  }

  private itemKey(event: Record<string, unknown>): string {
    const itemId = typeof event.item_id === 'string' ? event.item_id : 'unknown'
    const contentIndex = typeof event.content_index === 'number' ? event.content_index : 0
    return `${itemId}:${contentIndex}`
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
      if (next) this.ws.send(next)
    }
  }

  private setState(state: SocketState, message?: string): void {
    if (this.state === state && !message) return
    this.state = state
    this.emit('state', state, message)
  }
}
