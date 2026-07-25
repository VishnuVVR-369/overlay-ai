// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { PCM16_WORKLET_SOURCE } from '@/audio/pcm16-worklet'

interface FakePort {
  postMessage: (data: ArrayBuffer, transfer: ArrayBuffer[]) => void
}

interface FakeProcessor {
  process: (inputs: Float32Array[][]) => boolean
  port: FakePort
}

interface ProcessorHandle {
  proc: FakeProcessor
  flushed: ArrayBuffer[]
}

function makeProcessor(opts: { sampleRate: number; frameSize?: number; targetRate?: number }): ProcessorHandle {
  const flushed: ArrayBuffer[] = []
  let captured: FakeProcessor | undefined

  const fakePort: FakePort = {
    postMessage(buf: ArrayBuffer) {
      flushed.push(buf)
    },
  }
  class AudioWorkletProcessorStub {
    port: FakePort = fakePort
  }

  // eslint-disable-next-line @typescript-eslint/no-implied-eval
  const fn = new Function(
    'AudioWorkletProcessor',
    'sampleRate',
    'registerProcessor',
    `${PCM16_WORKLET_SOURCE}`,
  )

  const registerProcessor = (_: string, ctor: new (o: unknown) => FakeProcessor): void => {
    captured = new ctor({
      processorOptions: { frameSize: opts.frameSize ?? 4000, targetRate: opts.targetRate ?? 16000 },
    })
  }

  fn(AudioWorkletProcessorStub, opts.sampleRate, registerProcessor)
  if (!captured) throw new Error('processor was not registered')
  return { proc: captured, flushed }
}

function silence(channels: number, frame: number): Float32Array[] {
  return Array.from({ length: channels }, () => new Float32Array(frame))
}

describe('pcm16-framer worklet', () => {
  it('emits a 4000-sample Int16 frame after enough silent input at native rate', () => {
    const { proc, flushed } = makeProcessor({ sampleRate: 16000 })
    const frame = 128
    let total = 0
    while (total < 4000) {
      proc.process([silence(1, frame)])
      total += frame
    }
    expect(flushed.length).toBeGreaterThanOrEqual(1)
    expect(flushed[0].byteLength).toBe(4000 * 2)
    const view = new Int16Array(flushed[0])
    expect(view.every((v) => v === 0)).toBe(true)
  })

  it('downmixes stereo to mono by averaging channels', () => {
    const { proc, flushed } = makeProcessor({ sampleRate: 16000 })
    const left = new Float32Array(4000).fill(0.5)
    const right = new Float32Array(4000).fill(-0.5)
    proc.process([[left, right]])
    expect(flushed.length).toBe(1)
    const view = new Int16Array(flushed[0])
    expect(view.every((v) => Math.abs(v) <= 1)).toBe(true)
  })

  it('clips samples beyond ±1 to ±32767/-32768', () => {
    const { proc, flushed } = makeProcessor({ sampleRate: 16000 })
    const buf = new Float32Array(4000)
    for (let i = 0; i < buf.length; i++) buf[i] = i % 2 === 0 ? 2 : -2
    proc.process([[buf]])
    const view = new Int16Array(flushed[0])
    expect(view[0]).toBe(0x7fff)
    expect(view[1]).toBe(-0x8000)
  })

  it('decimates from 48 kHz to 16 kHz down to one 4000-sample frame', () => {
    const { proc, flushed } = makeProcessor({ sampleRate: 48000 })
    const big = new Float32Array(12000)
    proc.process([[big]])
    expect(flushed.length).toBeGreaterThanOrEqual(1)
    expect(flushed[0].byteLength).toBe(4000 * 2)
  })
})