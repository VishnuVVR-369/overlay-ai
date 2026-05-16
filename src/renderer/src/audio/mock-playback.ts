export class MockAudioPlayback {
  private ctx: AudioContext | null = null
  private nextTime = 0
  private sources: AudioBufferSourceNode[] = []

  async playPcm16(base64: string, sampleRate: number): Promise<void> {
    if (!base64) return
    if (!this.ctx) this.ctx = new AudioContext({ sampleRate })
    if (this.ctx.state === 'suspended') await this.ctx.resume()

    const pcm = decodePcm16(base64)
    const buffer = this.ctx.createBuffer(1, pcm.length, sampleRate)
    buffer.copyToChannel(pcm as Float32Array<ArrayBuffer>, 0)

    const source = this.ctx.createBufferSource()
    source.buffer = buffer
    source.connect(this.ctx.destination)
    source.onended = () => {
      this.sources = this.sources.filter((s) => s !== source)
    }
    const now = this.ctx.currentTime
    const startAt = Math.max(now, this.nextTime)
    source.start(startAt)
    this.nextTime = startAt + buffer.duration
    this.sources.push(source)
  }

  stop(): void {
    for (const source of this.sources) {
      try { source.stop() } catch { /* ignore */ }
      try { source.disconnect() } catch { /* ignore */ }
    }
    this.sources = []
    this.nextTime = this.ctx?.currentTime ?? 0
  }
}

function decodePcm16(base64: string): Float32Array {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  const view = new DataView(bytes.buffer)
  const samples = new Float32Array(bytes.byteLength / 2)
  for (let i = 0; i < samples.length; i++) {
    samples[i] = view.getInt16(i * 2, true) / 0x8000
  }
  return samples
}

export const mockPlayback = new MockAudioPlayback()
