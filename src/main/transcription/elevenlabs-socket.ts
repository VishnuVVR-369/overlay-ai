import { EventEmitter } from 'node:events'
import WebSocket from 'ws'
import type { SocketState, StreamTag } from '@shared/types'

const ENDPOINT = 'wss://api.elevenlabs.io/v1/speech-to-text/realtime'
const MAX_BUFFERED_BYTES = 1_000_000
const MAX_QUEUE = 200
const MAX_RETRIES = 8

export interface ScribeEvents {
  partial: (text: string) => void
  committed: (text: string) => void
  state: (state: SocketState, message?: string) => void
}

export class ScribeRealtimeSocket extends EventEmitter {
  private ws: WebSocket | null = null
  private apiKey = ''
  private queue: string[] = []
  private retries = 0
  private retryTimer: NodeJS.Timeout | null = null
  private explicitClose = false
  private state: SocketState = 'idle'

  constructor(public readonly stream: StreamTag) {
    super()
  }

  on<K extends keyof ScribeEvents>(event: K, listener: ScribeEvents[K]): this {
    return super.on(event, listener as (...args: unknown[]) => void)
  }

  emit<K extends keyof ScribeEvents>(event: K, ...args: Parameters<ScribeEvents[K]>): boolean {
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
    this.queue = []
    this.setState('closed')
  }

  send(audioBase64: string, sampleRate: number): void {
    const payload = JSON.stringify({
      message_type: 'input_audio_chunk',
      audio_base_64: audioBase64,
      commit: false,
      sample_rate: sampleRate,
    })
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      if (this.ws.bufferedAmount > MAX_BUFFERED_BYTES) {
        return
      }
      this.ws.send(payload)
    } else if (this.queue.length < MAX_QUEUE) {
      this.queue.push(payload)
    }
  }

  private openSocket(): void {
    const url = new URL(ENDPOINT)
    url.searchParams.set('model_id', 'scribe_v2_realtime')
    url.searchParams.set('audio_format', 'pcm_16000')
    url.searchParams.set('commit_strategy', 'vad')
    url.searchParams.set('language_code', 'en')

    this.setState(this.retries === 0 ? 'connecting' : 'reconnecting')

    const ws = new WebSocket(url.toString(), {
      headers: { 'xi-api-key': this.apiKey },
    })
    this.ws = ws

    ws.on('open', () => {
      this.retries = 0
      this.setState('open')
      this.flushQueue()
    })

    ws.on('message', (raw) => this.handleMessage(raw))

    ws.on('error', (err) => {
      console.warn(`[scribe:${this.stream}] error`, err.message)
    })

    ws.on('close', (code, reasonBuf) => {
      const reason = reasonBuf?.toString() ?? ''
      if (this.explicitClose) {
        this.setState('closed')
        return
      }
      if (code === 1008 || /auth|unauthorized|forbidden/i.test(reason)) {
        this.setState('auth_error', reason || 'Unauthorized')
        return
      }
      this.scheduleReconnect(reason || `closed (${code})`)
    })
  }

  private handleMessage(raw: WebSocket.RawData): void {
    let data: { [key: string]: unknown }
    try {
      data = JSON.parse(raw.toString())
    } catch {
      return
    }
    const type = (data['message_type'] ?? data['type']) as string | undefined
    const text = this.extractText(data)
    if (!type) return
    if (/partial/i.test(type)) {
      if (text !== null) this.emit('partial', text)
      return
    }
    if (/committed|final/i.test(type)) {
      if (text !== null && text.length > 0) this.emit('committed', text)
      return
    }
    if (/error|auth|quota|rate/i.test(type)) {
      const msg = (data['message'] as string | undefined) ?? type
      const isAuth = /auth|unauthorized|forbidden/i.test(type) || /auth|unauthorized|forbidden/i.test(msg)
      this.setState(isAuth ? 'auth_error' : 'error', msg)
    }
  }

  private extractText(data: { [key: string]: unknown }): string | null {
    if (typeof data['text'] === 'string') return data['text'] as string
    if (typeof data['transcript'] === 'string') return data['transcript'] as string
    const transcripts = data['transcripts']
    if (Array.isArray(transcripts) && transcripts.length > 0) {
      const first = transcripts[0] as { text?: string }
      if (typeof first?.text === 'string') return first.text
    }
    return null
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
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return
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
