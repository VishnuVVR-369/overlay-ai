import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  startOpenAITranscriptionMock,
  type OpenAITranscriptionMockHandle,
} from '../../helpers/openai-transcription-mock-server'

vi.mock('ws', async () => {
  const { WebSocket } = await import('mock-socket')
  class CompatSocket {
    private inner: InstanceType<typeof WebSocket>
    public bufferedAmount = 0
    public readyState = 0
    constructor(url: string, _opts?: unknown) {
      this.inner = new WebSocket(url)
      this.inner.addEventListener('open', () => {
        this.readyState = 1
        this.handlers.open?.forEach((handler) => handler())
      })
      this.inner.addEventListener('message', (event: MessageEvent) => {
        const raw = typeof event.data === 'string' ? Buffer.from(event.data) : Buffer.from(event.data as ArrayBuffer)
        this.handlers.message?.forEach((handler) => handler(raw))
      })
      this.inner.addEventListener('close', (event: CloseEvent) => {
        this.readyState = 3
        this.handlers.close?.forEach((handler) => handler(event.code, Buffer.from(event.reason ?? '')))
      })
      this.inner.addEventListener('error', () => {
        this.handlers.error?.forEach((handler) => handler(new Error('error')))
      })
    }
    private handlers: Record<string, Array<(...args: unknown[]) => void>> = {}
    on(event: string, handler: (...args: unknown[]) => void): this {
      ;(this.handlers[event] ??= []).push(handler)
      return this
    }
    send(data: string): void { this.inner.send(data) }
    close(): void { this.inner.close() }
  }
  Object.assign(CompatSocket, { OPEN: 1 })
  return { default: CompatSocket, WebSocket: CompatSocket }
})

let realtime: OpenAITranscriptionMockHandle

beforeEach(() => {
  realtime = startOpenAITranscriptionMock()
})

afterEach(async () => {
  realtime.stop()
  await new Promise((resolve) => setTimeout(resolve, 5))
})

async function loadSocket(): Promise<typeof import('@main/transcription/openai-transcription-socket')> {
  vi.resetModules()
  return await import('@main/transcription/openai-transcription-socket')
}

function waitFor(predicate: () => boolean, timeoutMs = 1500): Promise<void> {
  return new Promise((resolve, reject) => {
    const start = Date.now()
    const tick = (): void => {
      if (predicate()) return resolve()
      if (Date.now() - start > timeoutMs) return reject(new Error('waitFor timed out'))
      setTimeout(tick, 5)
    }
    tick()
  })
}

describe('OpenAIRealtimeTranscriptionSocket', () => {
  it('becomes open only after configuring a transcription session', async () => {
    const { OpenAIRealtimeTranscriptionSocket } = await loadSocket()
    const socket = new OpenAIRealtimeTranscriptionSocket('mic')
    const states: string[] = []
    socket.on('state', (state) => states.push(state))
    socket.connect('key')
    await waitFor(() => states.includes('open'))
    expect(states[0]).toBe('connecting')
    const update = realtime.received.find((event) => (event as { type?: string }).type === 'session.update') as {
      session: { type: string; audio: { input: { format: { rate: number }; transcription: { model: string } } } }
    }
    expect(update.session.type).toBe('transcription')
    expect(update.session.audio.input.format.rate).toBe(24000)
    expect(update.session.audio.input.transcription.model).toBe('gpt-live-transcribe')
    socket.close()
  })

  it('queues audio until session.updated then sends input_audio_buffer.append', async () => {
    const { OpenAIRealtimeTranscriptionSocket } = await loadSocket()
    const socket = new OpenAIRealtimeTranscriptionSocket('mic')
    socket.send('AAA', 24000)
    socket.connect('key')
    await waitFor(() => realtime.received.some((event) => (event as { type?: string }).type === 'input_audio_buffer.append'))
    expect(realtime.received).toContainEqual({ type: 'input_audio_buffer.append', audio: 'AAA' })
    socket.close()
  })

  it('accumulates delta fragments per item before committing the final transcript', async () => {
    const { OpenAIRealtimeTranscriptionSocket } = await loadSocket()
    const socket = new OpenAIRealtimeTranscriptionSocket('system')
    const partials: string[] = []
    const committed: string[] = []
    socket.on('partial', (text) => partials.push(text))
    socket.on('committed', (text) => committed.push(text))
    socket.connect('key')
    await waitFor(() => realtime.received.length > 0)
    realtime.sendDelta('item-1', 'Hello')
    realtime.sendDelta('item-1', ' world')
    realtime.sendCompleted('item-1', 'Hello world.')
    await waitFor(() => committed.length === 1)
    expect(partials).toEqual(['Hello', 'Hello world'])
    expect(committed).toEqual(['Hello world.'])
    socket.close()
  })

  it('keeps simultaneous item delta buffers independent', async () => {
    const { OpenAIRealtimeTranscriptionSocket } = await loadSocket()
    const socket = new OpenAIRealtimeTranscriptionSocket('mic')
    const partials: string[] = []
    socket.on('partial', (text) => partials.push(text))
    socket.connect('key')
    await waitFor(() => realtime.received.length > 0)
    realtime.sendDelta('a', 'first')
    realtime.sendDelta('b', 'second')
    realtime.sendDelta('a', ' item')
    await waitFor(() => partials.length === 3)
    expect(partials).toEqual(['first', 'second', 'first item'])
    socket.close()
  })

  it('rejects incorrectly labelled PCM sample rates', async () => {
    const { OpenAIRealtimeTranscriptionSocket } = await loadSocket()
    const socket = new OpenAIRealtimeTranscriptionSocket('mic')
    const states: Array<{ state: string; message?: string }> = []
    socket.on('state', (state, message) => states.push({ state, message }))
    socket.send('AAA', 16000)
    expect(states.at(-1)).toMatchObject({ state: 'error' })
    expect(states.at(-1)?.message).toMatch(/24000 Hz/)
  })

  it('maps OpenAI authentication errors to auth_error', async () => {
    const { OpenAIRealtimeTranscriptionSocket } = await loadSocket()
    const socket = new OpenAIRealtimeTranscriptionSocket('mic')
    const states: string[] = []
    socket.on('state', (state) => states.push(state))
    socket.connect('key')
    await waitFor(() => states.includes('open'))
    realtime.sendRaw({
      type: 'error',
      error: { code: 'invalid_api_key', message: 'Incorrect API key provided' },
    })
    await waitFor(() => states.includes('auth_error'))
    socket.close()
  })

  it('reconnects after a non-auth close and explicit close never retries', async () => {
    const { OpenAIRealtimeTranscriptionSocket } = await loadSocket()
    const socket = new OpenAIRealtimeTranscriptionSocket('mic')
    const states: string[] = []
    socket.on('state', (state) => states.push(state))
    socket.connect('key')
    await waitFor(() => states.includes('open'))
    realtime.closeWithCode(1011, 'server hiccup')
    await waitFor(() => states.includes('reconnecting'))
    socket.close()
    await new Promise((resolve) => setTimeout(resolve, 550))
    expect(states.at(-1)).toBe('closed')
  })
})
