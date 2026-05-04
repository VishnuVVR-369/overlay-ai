import type { StreamTag } from '@shared/types'
import { PCM16_WORKLET_SOURCE } from './pcm16-worklet'
import { arrayBufferToBase64 } from './encode'

const TARGET_RATE = 16000
const FRAME_SIZE = 4000 // 250 ms @ 16 kHz

interface StreamHandle {
  source: MediaStreamAudioSourceNode
  node: AudioWorkletNode
  stream: MediaStream
}

export class CaptureController {
  private audioCtx: AudioContext | null = null
  private workletReady = false
  private mic: StreamHandle | null = null
  private system: StreamHandle | null = null
  private workletUrl: string | null = null

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

    return { micStarted, systemStarted, warnings }
  }

  stop(): void {
    this.detach(this.mic)
    this.detach(this.system)
    this.mic = null
    this.system = null
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
    source.connect(node)
    return { source, node, stream }
  }

  private detach(handle: StreamHandle | null): void {
    if (!handle) return
    try { handle.source.disconnect() } catch { /* ignore */ }
    try { handle.node.disconnect() } catch { /* ignore */ }
    try { handle.node.port.close() } catch { /* ignore */ }
    handle.stream.getTracks().forEach((t) => t.stop())
  }
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
