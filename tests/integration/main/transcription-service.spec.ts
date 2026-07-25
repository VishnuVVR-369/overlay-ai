import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { startScribeMock, type ScribeMockHandle } from '../../helpers/scribe-mock-server'

vi.mock('ws', async () => {
  const { WebSocket } = await import('mock-socket')
  // mock-socket WebSocket is already CloseEvent-emitting EventTarget; the real `ws` lib uses EventEmitter API.
  // Wrap mock-socket so .on('open'), .on('message'), .on('close') and .send work as expected by elevenlabs-socket.ts
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

async function loadService(): Promise<typeof import('@main/transcription/transcription-service')> {
  vi.resetModules()
  return await import('@main/transcription/transcription-service')
}

function waitFor(predicate: () => boolean, timeoutMs = 1000): Promise<void> {
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

describe('TranscriptionService', () => {
  it('opens both mic and system sockets and emits "open" socket status for each', async () => {
    const { TranscriptionService } = await loadService()
    const svc = new TranscriptionService()
    const states: Array<{ stream: string; state: string }> = []
    svc.on('socketStatus', (e) => states.push({ stream: e.stream, state: e.state }))
    svc.start('test-key')
    await waitFor(() => states.filter((s) => s.state === 'open').length === 2)
    expect(states.filter((s) => s.state === 'open').map((s) => s.stream).sort()).toEqual(['mic', 'system'])
    expect(svc.status().running).toBe(true)
    svc.stop()
  })

  it('routes mic audio chunks to the mic socket only and system chunks to system socket only', async () => {
    const { TranscriptionService } = await loadService()
    const svc = new TranscriptionService()
    svc.start('test-key')
    await waitFor(() => svc.status().micState === 'open' && svc.status().systemState === 'open')
    const seen: { client: number; payload: object }[] = []
    let i = 0
    for (const c of scribe.clients) {
      const idx = i++
      ;(c as unknown as { on: (e: string, f: (data: unknown) => void) => void }).on('message', (data) => {
        seen.push({ client: idx, payload: JSON.parse(data as string) })
      })
    }
    svc.ingest({ stream: 'mic', audioBase64: 'AAAA', sampleRate: 16000 })
    svc.ingest({ stream: 'system', audioBase64: 'BBBB', sampleRate: 16000 })
    await waitFor(() => seen.length >= 2)
    const audios = seen.map((s) => (s.payload as { audio_base_64: string }).audio_base_64).sort()
    expect(audios).toEqual(['AAAA', 'BBBB'])
    svc.stop()
  })

  it('partial messages from each socket emit transcript updates with the correct speaker', async () => {
    const { TranscriptionService } = await loadService()
    const svc = new TranscriptionService()
    const updates: Array<{ speaker: string; kind: string; text: string }> = []
    svc.on('update', (e) => updates.push({ speaker: e.speaker, kind: e.kind, text: e.text }))
    svc.start('test-key')
    await waitFor(() => svc.status().micState === 'open' && svc.status().systemState === 'open')
    scribe.sendPartial('hello partial')
    await waitFor(() => updates.length >= 2)
    expect(updates.filter((u) => u.kind === 'partial').map((u) => u.speaker).sort()).toEqual(['them', 'you'])
    svc.stop()
  })

  it('committed messages with text become committed segments', async () => {
    const { TranscriptionService } = await loadService()
    const svc = new TranscriptionService()
    svc.start('test-key')
    await waitFor(() => svc.status().micState === 'open')
    scribe.sendCommitted('committed text')
    await waitFor(() => svc.snapshot().segments.length >= 2)
    const speakers = svc.snapshot().segments.map((s) => s.speaker).sort()
    expect(speakers).toEqual(['them', 'you'])
    svc.stop()
  })

  it('stop() resets running and tears down both sockets', async () => {
    const { TranscriptionService } = await loadService()
    const svc = new TranscriptionService()
    svc.start('test-key')
    await waitFor(() => svc.status().micState === 'open')
    svc.stop()
    expect(svc.status().running).toBe(false)
  })

  it('start() is idempotent: a second call while running is a no-op', async () => {
    const { TranscriptionService } = await loadService()
    const svc = new TranscriptionService()
    svc.start('k')
    await waitFor(() => svc.status().micState === 'open')
    const beforeCount = scribe.clients.size
    svc.start('k')
    await new Promise((r) => setTimeout(r, 30))
    expect(scribe.clients.size).toBe(beforeCount)
    svc.stop()
  })

  it('clear() empties the transcript snapshot', async () => {
    const { TranscriptionService } = await loadService()
    const svc = new TranscriptionService()
    svc.start('k')
    await waitFor(() => svc.status().micState === 'open')
    scribe.sendCommitted('one')
    await waitFor(() => svc.snapshot().segments.length >= 2)
    svc.clear()
    expect(svc.snapshot().segments).toHaveLength(0)
    svc.stop()
  })

  it('stop() and clear() before start() are no-ops (panic-during-idle is safe)', async () => {
    const { TranscriptionService } = await loadService()
    const svc = new TranscriptionService()
    expect(() => svc.stop()).not.toThrow()
    expect(() => svc.clear()).not.toThrow()
    expect(svc.status().running).toBe(false)
    expect(svc.snapshot().segments).toHaveLength(0)
  })

  it('stop() called twice in a row is safe', async () => {
    const { TranscriptionService } = await loadService()
    const svc = new TranscriptionService()
    svc.start('k')
    await waitFor(() => svc.status().micState === 'open')
    svc.stop()
    expect(() => svc.stop()).not.toThrow()
    expect(svc.status().running).toBe(false)
  })

  it('flattenForPrompt produces the canonical "You: ... / Them: ..." string after committed messages', async () => {
    const { TranscriptionService } = await loadService()
    const svc = new TranscriptionService()
    svc.start('k')
    await waitFor(() => svc.status().micState === 'open' && svc.status().systemState === 'open')
    scribe.sendCommitted('hi')
    await waitFor(() => svc.snapshot().segments.length >= 2)
    const flat = svc.flattenForPrompt()
    expect(flat).toMatch(/You: hi/)
    expect(flat).toMatch(/Them: hi/)
    svc.stop()
  })
})
