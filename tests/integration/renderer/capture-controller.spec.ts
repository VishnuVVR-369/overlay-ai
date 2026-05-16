// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { installFakeApi, createFakeApi, type FakeApi } from '../../helpers/fake-window-api'
import { useAudioLevelsStore } from '@/state/audio-levels-store'

interface FakeNode {
  port: { onmessage: ((evt: MessageEvent<ArrayBuffer>) => void) | null; close: () => void; postMessage: (data: ArrayBuffer) => void }
  disconnect: () => void
}

interface FakeAnalyser {
  fftSize: number
  smoothingTimeConstant: number
  getFloatTimeDomainData: (buf: Float32Array) => void
  disconnect: () => void
}

interface FakeAudioContext {
  state: string
  sampleRate: number
  audioWorklet: { addModule: (url: string) => Promise<void> }
  createMediaStreamSource: (s: MediaStream) => { connect: (n: unknown) => void; disconnect: () => void }
  createAnalyser: () => FakeAnalyser
  resume: () => Promise<void>
}

const audioCtxState: { instance?: FakeAudioContext } = {}

class StubAudioContext implements FakeAudioContext {
  state = 'running'
  sampleRate = 16000
  audioWorklet = { addModule: vi.fn(async () => {}) }
  resume = vi.fn(async () => {})
  createMediaStreamSource(): { connect: (n: unknown) => void; disconnect: () => void } {
    return { connect: () => {}, disconnect: () => {} }
  }
  createAnalyser(): FakeAnalyser {
    return {
      fftSize: 256,
      smoothingTimeConstant: 0,
      getFloatTimeDomainData: () => {},
      disconnect: () => {},
    }
  }
  constructor(_opts: { sampleRate: number }) {
    audioCtxState.instance = this
  }
}

class StubWorkletNode implements FakeNode {
  port = {
    onmessage: null as ((evt: MessageEvent<ArrayBuffer>) => void) | null,
    postMessage: () => {},
    close: () => {},
  }
  disconnect = vi.fn()
  constructor(_ctx: unknown, _name: string, _opts: unknown) {}
}

let fakeApi: FakeApi

beforeEach(() => {
  fakeApi = installFakeApi(createFakeApi())
  Object.defineProperty(globalThis, 'AudioContext', { configurable: true, value: StubAudioContext })
  Object.defineProperty(globalThis, 'AudioWorkletNode', { configurable: true, value: StubWorkletNode })
  if (!('createObjectURL' in URL)) {
    Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: () => 'blob:fake' })
  }
  if (!('revokeObjectURL' in URL)) {
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: () => undefined })
  }
  const fakeStream = {
    getTracks: () => [{ stop: () => {} }],
    getVideoTracks: () => [{ stop: () => {} }],
    removeTrack: () => {},
  }
  Object.defineProperty(navigator, 'mediaDevices', {
    configurable: true,
    value: {
      getUserMedia: vi.fn(async () => fakeStream),
      getDisplayMedia: vi.fn(async () => fakeStream),
    },
  })
  useAudioLevelsStore.getState().resetAll()
})

import { capture } from '@/audio/capture-controller'

async function loadCapture(): Promise<{ capture: typeof capture }> {
  return { capture }
}

describe('CaptureController', () => {
  it('starts both mic and system streams when both succeed', async () => {
    const { capture } = await loadCapture()
    const r = await capture.start()
    expect(r.micStarted).toBe(true)
    expect(r.systemStarted).toBe(true)
    expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalled()
    expect(navigator.mediaDevices.getDisplayMedia).toHaveBeenCalled()
    expect(fakeApi.loopback.enable).toHaveBeenCalled()
    expect(fakeApi.loopback.disable).toHaveBeenCalled()
    capture.stop()
  })

  it('falls back gracefully when mic is denied', async () => {
    ;(navigator.mediaDevices.getUserMedia as unknown as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('denied'))
    const { capture } = await loadCapture()
    const r = await capture.start()
    expect(r.micStarted).toBe(false)
    expect(r.systemStarted).toBe(true)
    expect(r.warnings.some((w) => /Microphone/.test(w))).toBe(true)
    capture.stop()
  })

  it('falls back gracefully when system audio is denied', async () => {
    ;(navigator.mediaDevices.getDisplayMedia as unknown as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('blocked'))
    const { capture } = await loadCapture()
    const r = await capture.start()
    expect(r.micStarted).toBe(true)
    expect(r.systemStarted).toBe(false)
    expect(r.warnings.some((w) => /System audio/.test(w))).toBe(true)
    capture.stop()
  })

  it('mic worklet messages are forwarded to window.api.transcription.sendAudio with stream:"mic"', async () => {
    const nodes: StubWorkletNode[] = []
    const TrackingNode = class extends StubWorkletNode {
      constructor(c: unknown, n: string, o: unknown) {
        super(c, n, o)
        nodes.push(this)
      }
    }
    Object.defineProperty(globalThis, 'AudioWorkletNode', { configurable: true, value: TrackingNode })
    const { capture } = await loadCapture()
    await capture.start()
    expect(nodes.length).toBeGreaterThanOrEqual(2)
    const buf = new Int16Array([1, 2, 3]).buffer
    nodes[0].port.onmessage?.({ data: buf } as MessageEvent<ArrayBuffer>)
    expect(fakeApi.transcription.sendAudio).toHaveBeenCalledWith(expect.objectContaining({ stream: 'mic', sampleRate: 16000 }))
    capture.stop()
  })

  it('stop() resets the audio levels store', async () => {
    const { capture } = await loadCapture()
    await capture.start()
    useAudioLevelsStore.getState().push('mic', 0.7)
    useAudioLevelsStore.getState().push('system', 0.5)
    capture.stop()
    expect(useAudioLevelsStore.getState().micLatest).toBe(0)
    expect(useAudioLevelsStore.getState().systemLatest).toBe(0)
  })

  it('stop() is idempotent — calling it twice does not throw and leaves levels at zero', async () => {
    const { capture } = await loadCapture()
    await capture.start()
    capture.stop()
    expect(() => capture.stop()).not.toThrow()
    expect(useAudioLevelsStore.getState().micLatest).toBe(0)
    expect(useAudioLevelsStore.getState().systemLatest).toBe(0)
  })

  it('stop() before start() is a no-op (panic-during-idle is safe)', async () => {
    const { capture } = await loadCapture()
    expect(() => capture.stop()).not.toThrow()
    expect(useAudioLevelsStore.getState().micLatest).toBe(0)
  })
})
