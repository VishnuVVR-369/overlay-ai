import { EventEmitter } from 'node:events'
import { speakerForStream, type AudioChunkMessage, type SocketState, type SocketStatusEvent, type Speaker, type StreamTag, type TranscriptSnapshot, type TranscriptUpdate } from '@shared/types'
import { ScribeRealtimeSocket } from './elevenlabs-socket'
import { TranscriptStore } from './transcript-store'

export interface TranscriptionServiceEvents {
  update: (event: TranscriptUpdate) => void
  socketStatus: (event: SocketStatusEvent) => void
}

export class TranscriptionService extends EventEmitter {
  private mic: ScribeRealtimeSocket | null = null
  private system: ScribeRealtimeSocket | null = null
  private store = new TranscriptStore()
  private running = false
  private micState: SocketState = 'idle'
  private systemState: SocketState = 'idle'

  on<K extends keyof TranscriptionServiceEvents>(event: K, listener: TranscriptionServiceEvents[K]): this {
    return super.on(event, listener as (...args: unknown[]) => void)
  }

  emit<K extends keyof TranscriptionServiceEvents>(event: K, ...args: Parameters<TranscriptionServiceEvents[K]>): boolean {
    return super.emit(event, ...args)
  }

  start(apiKey: string): void {
    if (this.running) return
    this.running = true
    this.mic = this.makeSocket('mic', apiKey)
    this.system = this.makeSocket('system', apiKey)
    this.mic.connect(apiKey)
    this.system.connect(apiKey)
  }

  stop(): void {
    this.running = false
    this.mic?.close()
    this.system?.close()
    this.mic = null
    this.system = null
  }

  ingest(chunk: AudioChunkMessage): void {
    const target = chunk.stream === 'mic' ? this.mic : this.system
    target?.send(chunk.audioBase64, chunk.sampleRate)
  }

  injectPartial(speaker: Speaker, text: string): void {
    const update = this.store.applyPartial(speaker, text)
    this.emit('update', update)
  }

  injectCommitted(speaker: Speaker, text: string): void {
    const update = this.store.applyCommitted(speaker, text)
    this.emit('update', update)
  }

  snapshot(): TranscriptSnapshot {
    return this.store.snapshot()
  }

  clear(): void {
    this.store.clear()
  }

  flattenForPrompt(): string {
    return this.store.flattenForPrompt()
  }

  status(): { running: boolean; micState: SocketState; systemState: SocketState } {
    return { running: this.running, micState: this.micState, systemState: this.systemState }
  }

  private makeSocket(stream: StreamTag, _apiKey: string): ScribeRealtimeSocket {
    const sock = new ScribeRealtimeSocket(stream)
    const speaker = speakerForStream(stream)

    sock.on('partial', (text) => {
      const update = this.store.applyPartial(speaker, text)
      this.emit('update', update)
    })

    sock.on('committed', (text) => {
      const update = this.store.applyCommitted(speaker, text)
      this.emit('update', update)
    })

    sock.on('state', (state, message) => {
      if (stream === 'mic') this.micState = state
      else this.systemState = state
      this.emit('socketStatus', { stream, state, message })
    })

    return sock
  }
}

export const transcription = new TranscriptionService()
