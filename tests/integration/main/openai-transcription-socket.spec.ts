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
      session: { type: string; audio: { input: { format: { rate: number }; transcription: { model: string }; turn_detection: unknown } } }
    }
    expect(realtime.url).toBe('wss://api.openai.com/v1/realtime?intent=transcription')
    expect(update.session.type).toBe('transcription')
    expect(update.session.audio.input.format.rate).toBe(24000)
    expect(update.session.audio.input.transcription.model).toBe('gpt-live-transcribe')
    expect(update.session.audio.input.turn_detection).toBeNull()
    await socket.close()
  })

  it('queues audio until session.updated then sends input_audio_buffer.append', async () => {
    const { OpenAIRealtimeTranscriptionSocket } = await loadSocket()
    const socket = new OpenAIRealtimeTranscriptionSocket('mic')
    socket.send('AAA', 24000)
    socket.connect('key')
    await waitFor(() => realtime.received.some((event) => (event as { type?: string }).type === 'input_audio_buffer.append'))
    expect(realtime.received).toContainEqual({ type: 'input_audio_buffer.append', audio: 'AAA' })
    socket.closeImmediately()
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
    realtime.sendCommitted('item-1')
    realtime.sendDelta('item-1', 'Hello')
    realtime.sendDelta('item-1', ' world')
    realtime.sendCompleted('item-1', 'Hello world.')
    await waitFor(() => committed.length === 1)
    expect(partials).toEqual(['Hello', 'Hello world'])
    expect(committed).toEqual(['Hello world.'])
    await socket.close()
  })

  it('emits completed turns in input commit order with their item identities', async () => {
    const { OpenAIRealtimeTranscriptionSocket } = await loadSocket()
    const socket = new OpenAIRealtimeTranscriptionSocket('system')
    const committed: Array<{ text: string; itemId: string }> = []
    socket.on('committed', (text, itemId) => committed.push({ text, itemId }))
    socket.connect('key')
    await waitFor(() => realtime.received.length > 0)
    realtime.sendCommitted('item-1')
    realtime.sendCommitted('item-2', 'item-1')
    realtime.sendCompleted('item-2', 'Second.')
    await new Promise((resolve) => setTimeout(resolve, 10))
    expect(committed).toEqual([])
    realtime.sendCompleted('item-1', 'First.')
    await waitFor(() => committed.length === 2)
    expect(committed).toEqual([
      { text: 'First.', itemId: 'item-1' },
      { text: 'Second.', itemId: 'item-2' },
    ])
    await socket.close()
  })

  it('commits and drains the final buffered turn before ordinary close', async () => {
    const { OpenAIRealtimeTranscriptionSocket } = await loadSocket()
    const socket = new OpenAIRealtimeTranscriptionSocket('mic')
    const committed: string[] = []
    const states: string[] = []
    socket.on('committed', (text) => committed.push(text))
    socket.on('state', (state) => states.push(state))
    socket.connect('key')
    await waitFor(() => states.includes('open'))
    socket.send('AAAA', 24000)
    await waitFor(() => realtime.received.some((event) => (event as { type?: string }).type === 'input_audio_buffer.append'))
    const closing = socket.close()
    await waitFor(() => realtime.received.some((event) => (event as { type?: string }).type === 'input_audio_buffer.commit'))
    expect(states.at(-1)).toBe('open')
    realtime.sendCommitted('final-item')
    realtime.sendCompleted('final-item', 'Final words.')
    await closing
    expect(committed).toEqual(['Final words.'])
    expect(states.at(-1)).toBe('closed')
  })

  it('commits buffered audio periodically and drains its in-flight transcript on close', async () => {
    const { OpenAIRealtimeTranscriptionSocket } = await loadSocket()
    const socket = new OpenAIRealtimeTranscriptionSocket('mic')
    const committed: string[] = []
    socket.on('committed', (text) => committed.push(text))
    socket.connect('key')
    await waitFor(() => realtime.received.length > 0)
    const frame = Buffer.alloc(12_000).toString('base64')
    for (let i = 0; i < 7; i += 1) socket.send(frame, 24000)
    await waitFor(() => realtime.received.filter((event) => (event as { type?: string }).type === 'input_audio_buffer.append').length === 7)
    expect(realtime.received.some((event) => (event as { type?: string }).type === 'input_audio_buffer.commit')).toBe(false)
    socket.send(frame, 24000)
    await waitFor(() => realtime.received.some((event) => (event as { type?: string }).type === 'input_audio_buffer.commit'))
    let closed = false
    const closing = socket.close().then(() => { closed = true })
    await new Promise((resolve) => setTimeout(resolve, 10))
    expect(closed).toBe(false)
    realtime.sendCommitted('periodic-item')
    realtime.sendCompleted('periodic-item', 'Mid-session words.')
    await closing
    expect(committed).toEqual(['Mid-session words.'])
    expect(realtime.received.filter((event) => (event as { type?: string }).type === 'input_audio_buffer.commit')).toHaveLength(1)
  })

  it('bounds ordinary drain time and keeps panic shutdown immediate', async () => {
    const { OpenAIRealtimeTranscriptionSocket } = await loadSocket()
    const graceful = new OpenAIRealtimeTranscriptionSocket('mic', 25)
    graceful.connect('key')
    await waitFor(() => realtime.received.length > 0)
    graceful.send('AAAA', 24000)
    await graceful.close()

    const immediate = new OpenAIRealtimeTranscriptionSocket('system', 1000)
    immediate.connect('key')
    await waitFor(() => realtime.clients.size > 0)
    immediate.send('BBBB', 24000)
    const commitsBeforePanic = realtime.received.filter((event) => (event as { type?: string }).type === 'input_audio_buffer.commit').length
    immediate.closeImmediately()
    const commitsAfterPanic = realtime.received.filter((event) => (event as { type?: string }).type === 'input_audio_buffer.commit').length
    expect(commitsAfterPanic).toBe(commitsBeforePanic)
  })

  it('keeps simultaneous item delta buffers independent', async () => {
    const { OpenAIRealtimeTranscriptionSocket } = await loadSocket()
    const socket = new OpenAIRealtimeTranscriptionSocket('mic')
    const partials: string[] = []
    socket.on('partial', (text) => partials.push(text))
    socket.connect('key')
    await waitFor(() => realtime.received.length > 0)
    realtime.sendCommitted('a')
    realtime.sendCommitted('b', 'a')
    realtime.sendDelta('a', 'first')
    realtime.sendDelta('b', 'second')
    realtime.sendDelta('a', ' item')
    await waitFor(() => partials.length === 3)
    expect(partials).toEqual(['first', 'second', 'first item'])
    socket.closeImmediately()
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
    await socket.close()
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
    await socket.close()
    await new Promise((resolve) => setTimeout(resolve, 550))
    expect(states.at(-1)).toBe('closed')
  })
})
