import type { StreamTag } from '@shared/types'
import { PCM16_WORKLET_SOURCE } from './pcm16-worklet'
import { arrayBufferToBase64 } from './encode'
import { useAudioLevelsStore } from '../state/audio-levels-store'

const TARGET_RATE = 16000
const FRAME_SIZE = 4000 // 250 ms @ 16 kHz
const ANALYSER_FFT = 256
const LEVEL_TICK_MS = 33 // ~30 Hz

interface StreamHandle {
  source: MediaStreamAudioSourceNode
  node: AudioWorkletNode
  analyser: AnalyserNode
  buf: Float32Array
  stream: MediaStream
}

export class CaptureController {
  private audioCtx: AudioContext | null = null
  private workletReady = false
  private mic: StreamHandle | null = null
  private system: StreamHandle | null = null
  private workletUrl: string | null = null
  private levelTimer: number | null = null

  async start(): Promise<{ micStarted: boolean; systemStarted: boolean; warnings: string[] }> {
    const warnings: string[] = []
    if (!this.audioCtx) {
      this.audioCtx = new AudioContext({ sampleRate: TARGET_RATE })
    }
    if (this.audioCtx.state === 'suspended') {
      await this.audioCtx.resume()
    }
    if (!this.workletReady) {
      if (!this.workletUrl) {
        const blob = new Blob([PCM16_WORKLET_SOURCE], { type: 'application/javascript' })
        this.workletUrl = URL.createObjectURL(blob)
      }
      await this.audioCtx.audioWorklet.addModule(this.workletUrl)
      this.workletReady = true
    }

    let micStarted = false
    let systemStarted = false

    try {
      const micStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      })
      this.mic = this.attachStream(micStream, 'mic')
      micStarted = true
    } catch (err) {
      warnings.push(`Microphone capture failed: ${(err as Error).message}`)
    }

    try {
      const sysStream = await getSystemAudioStream()
      this.system = this.attachStream(sysStream, 'system')
      systemStarted = true
    } catch (err) {
      warnings.push(`System audio capture failed: ${(err as Error).message}`)
    }

    if (micStarted || systemStarted) {
      this.startLevelLoop()
    }

    return { micStarted, systemStarted, warnings }
  }

  stop(): void {
    this.stopLevelLoop()
    this.detach(this.mic)
    this.detach(this.system)
    this.mic = null
    this.system = null
    useAudioLevelsStore.getState().resetAll()
  }

  private attachStream(stream: MediaStream, tag: StreamTag): StreamHandle {
    const ctx = this.audioCtx
    if (!ctx) throw new Error('AudioContext not initialised')
    const source = ctx.createMediaStreamSource(stream)
    const node = new AudioWorkletNode(ctx, 'pcm16-framer', {
      numberOfInputs: 1,
      numberOfOutputs: 0,
      processorOptions: { frameSize: FRAME_SIZE, targetRate: TARGET_RATE },
    })
    node.port.onmessage = (evt) => {
      const buf = evt.data as ArrayBuffer
      const audioBase64 = arrayBufferToBase64(buf)
      window.api.transcription.sendAudio({ stream: tag, audioBase64, sampleRate: TARGET_RATE })
    }
    const analyser = ctx.createAnalyser()
    analyser.fftSize = ANALYSER_FFT
    analyser.smoothingTimeConstant = 0.55
    const buf = new Float32Array(analyser.fftSize)
    source.connect(node)
    source.connect(analyser)
    return { source, node, analyser, buf, stream }
  }

  private detach(handle: StreamHandle | null): void {
    if (!handle) return
    try { handle.source.disconnect() } catch { /* ignore */ }
    try { handle.node.disconnect() } catch { /* ignore */ }
    try { handle.analyser.disconnect() } catch { /* ignore */ }
    try { handle.node.port.close() } catch { /* ignore */ }
    handle.stream.getTracks().forEach((t) => t.stop())
  }

  private startLevelLoop(): void {
    if (this.levelTimer !== null) return
    const push = useAudioLevelsStore.getState().push
    const tick = (): void => {
      if (this.mic) push('mic', readRms(this.mic))
      else push('mic', 0)
      if (this.system) push('system', readRms(this.system))
      else push('system', 0)
    }
    this.levelTimer = window.setInterval(tick, LEVEL_TICK_MS)
  }

  private stopLevelLoop(): void {
    if (this.levelTimer !== null) {
      window.clearInterval(this.levelTimer)
      this.levelTimer = null
    }
  }
}

function readRms(handle: StreamHandle): number {
  // Cast: TS lib type expects Float32Array<ArrayBuffer>, our buffer satisfies it but
  // narrows to ArrayBufferLike under strict mode.
  handle.analyser.getFloatTimeDomainData(handle.buf as Float32Array<ArrayBuffer>)
  let sum = 0
  for (let i = 0; i < handle.buf.length; i++) sum += handle.buf[i] * handle.buf[i]
  const rms = Math.sqrt(sum / handle.buf.length)
  // soft compress: emphasise speech-band amplitude, clamp to [0,1]
  return Math.min(1, rms * 2.4)
}

export const capture = new CaptureController()

async function getSystemAudioStream(): Promise<MediaStream> {
  await window.api.loopback.enable()
  try {
    const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true })
    stream.getVideoTracks().forEach((track) => {
      track.stop()
      stream.removeTrack(track)
    })
    return stream
  } finally {
    await window.api.loopback.disable()
  }
}
