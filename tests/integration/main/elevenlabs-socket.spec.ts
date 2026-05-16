import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { startScribeMock, type ScribeMockHandle } from '../../helpers/scribe-mock-server'

vi.mock('ws', async () => {
  const { WebSocket } = await import('mock-socket')
  class CompatSocket {
    private inner: InstanceType<typeof WebSocket>
    public bufferedAmount = 0
    public OPEN = 1
    public readyState = 0
    constructor(url: string, _opts?: unknown) {
      this.inner = new WebSocket(url)
      this.inner.addEventListener('open', () => {
        this.readyState = 1
        this.handlers.open?.forEach((f) => f())
      })
      this.inner.addEventListener('message', (evt: MessageEvent) => {
        const raw = typeof evt.data === 'string' ? Buffer.from(evt.data) : Buffer.from(evt.data as ArrayBuffer)
        this.handlers.message?.forEach((f) => f(raw))
      })
      this.inner.addEventListener('close', (evt: CloseEvent) => {
        this.readyState = 3
        this.handlers.close?.forEach((f) => f(evt.code, Buffer.from(evt.reason ?? '')))
      })
      this.inner.addEventListener('error', () => {
        this.handlers.error?.forEach((f) => f(new Error('error')))
      })
    }
    private handlers: Record<string, Array<(...args: unknown[]) => void>> = {}
    on(event: string, fn: (...args: unknown[]) => void): this {
      ;(this.handlers[event] ??= []).push(fn)
      return this
    }
    send(data: string): void {
      this.inner.send(data)
    }
    close(): void {
      this.inner.close()
    }
  }
  Object.assign(CompatSocket, { OPEN: 1 })
  return { default: CompatSocket, WebSocket: CompatSocket }
})

let scribe: ScribeMockHandle

beforeEach(() => {
  scribe = startScribeMock()
})

afterEach(async () => {
  scribe.stop()
  await new Promise((r) => setTimeout(r, 5))
})

async function loadSocket(): Promise<typeof import('@main/transcription/elevenlabs-socket')> {
  vi.resetModules()
  return await import('@main/transcription/elevenlabs-socket')
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

describe('ScribeRealtimeSocket', () => {
  it('transitions idle → connecting → open on a successful upgrade', async () => {
    const { ScribeRealtimeSocket } = await loadSocket()
    const sock = new ScribeRealtimeSocket('mic')
    const states: string[] = []
    sock.on('state', (s) => states.push(s))
    sock.connect('key')
    await waitFor(() => states.includes('open'))
    expect(states[0]).toBe('connecting')
    expect(states.includes('open')).toBe(true)
    sock.close()
  })

  it('queues sends before open and flushes them after open', async () => {
    const { ScribeRealtimeSocket } = await loadSocket()
    const sock = new ScribeRealtimeSocket('mic')
    sock.send('AAA', 16000)
    sock.connect('key')
    const seen: object[] = []
    scribe.server.on('connection', (s) => {
      ;(s as unknown as { on: (e: string, f: (d: unknown) => void) => void }).on('message', (data) => {
        seen.push(JSON.parse(data as string))
      })
    })
    await waitFor(() => seen.length >= 1, 1500)
    expect((seen[0] as { audio_base_64: string }).audio_base_64).toBe('AAA')
    sock.close()
  })

  it('emits "partial" for partial_transcript messages and "committed" for committed_transcript', async () => {
    const { ScribeRealtimeSocket } = await loadSocket()
    const sock = new ScribeRealtimeSocket('system')
    const partials: string[] = []
    const committed: string[] = []
    sock.on('partial', (t) => partials.push(t))
    sock.on('committed', (t) => committed.push(t))
    sock.connect('k')
    const states: string[] = []
    sock.on('state', (s) => states.push(s))
    await waitFor(() => states.includes('open'))
    scribe.sendPartial('p1')
    scribe.sendCommitted('c1')
    await waitFor(() => committed.includes('c1') && partials.includes('p1'))
    sock.close()
  })

  it('extracts text from "transcripts[0].text" payload shape', async () => {
    const { ScribeRealtimeSocket } = await loadSocket()
    const sock = new ScribeRealtimeSocket('mic')
    const partials: string[] = []
    sock.on('partial', (t) => partials.push(t))
    sock.connect('k')
    const states: string[] = []
    sock.on('state', (s) => states.push(s))
    await waitFor(() => states.includes('open'))
    scribe.sendRaw({ message_type: 'partial_transcript', transcripts: [{ text: 'array form' }] })
    await waitFor(() => partials.includes('array form'))
    sock.close()
  })

  it('close code 1008 transitions to auth_error and does not retry', async () => {
    const { ScribeRealtimeSocket } = await loadSocket()
    const sock = new ScribeRealtimeSocket('mic')
    const states: string[] = []
    sock.on('state', (s) => states.push(s))
    sock.connect('k')
    await waitFor(() => states.includes('open'))
    scribe.closeWithCode(1008, 'invalid token')
    await waitFor(() => states.includes('auth_error'))
    expect(states.includes('reconnecting')).toBe(false)
    sock.close()
  })

  it('close with reason matching /auth/ transitions to auth_error', async () => {
    const { ScribeRealtimeSocket } = await loadSocket()
    const sock = new ScribeRealtimeSocket('mic')
    const states: string[] = []
    sock.on('state', (s) => states.push(s))
    sock.connect('k')
    await waitFor(() => states.includes('open'))
    scribe.closeWithCode(4000, 'unauthorized')
    await waitFor(() => states.includes('auth_error'))
    sock.close()
  })

  it('non-auth close schedules reconnect (state: reconnecting)', async () => {
    const { ScribeRealtimeSocket } = await loadSocket()
    const sock = new ScribeRealtimeSocket('mic')
    const states: string[] = []
    sock.on('state', (s) => states.push(s))
    sock.connect('k')
    await waitFor(() => states.includes('open'))
    scribe.closeWithCode(1011, 'server hiccup')
    await waitFor(() => states.includes('reconnecting'))
    sock.close()
  })

  it('explicit close transitions to "closed" without retrying', async () => {
    const { ScribeRealtimeSocket } = await loadSocket()
    const sock = new ScribeRealtimeSocket('mic')
    const states: string[] = []
    sock.on('state', (s) => states.push(s))
    sock.connect('k')
    await waitFor(() => states.includes('open'))
    sock.close()
    await waitFor(() => states.includes('closed'))
    expect(states.includes('reconnecting')).toBe(false)
  })
})
