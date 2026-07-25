export const PCM16_WORKLET_SOURCE = `
class Pcm16Framer extends AudioWorkletProcessor {
  constructor(options) {
    super()
    this.frameSize = (options && options.processorOptions && options.processorOptions.frameSize) || 4000
    this.targetRate = (options && options.processorOptions && options.processorOptions.targetRate) || 16000
    this.buffer = new Float32Array(this.frameSize)
    this.filled = 0
    this.ratio = sampleRate / this.targetRate
    this.resampleAcc = 0
  }

  process(inputs) {
    const input = inputs[0]
    if (!input || input.length === 0) return true
    // Down-mix to mono.
    const channelCount = input.length
    const frameLen = input[0].length
    const mono = new Float32Array(frameLen)
    for (let c = 0; c < channelCount; c++) {
      const ch = input[c]
      for (let i = 0; i < frameLen; i++) mono[i] += ch[i]
    }
    if (channelCount > 1) {
      for (let i = 0; i < frameLen; i++) mono[i] /= channelCount
    }

    // Decimate from sampleRate -> targetRate by simple linear pickup.
    if (this.ratio === 1) {
      this.append(mono, frameLen)
    } else {
      let i = this.resampleAcc
      while (i < frameLen) {
        const idx = Math.floor(i)
        this.appendSample(mono[idx])
        i += this.ratio
      }
      this.resampleAcc = i - frameLen
    }
    return true
  }

  append(samples, len) {
    let offset = 0
    while (offset < len) {
      const space = this.frameSize - this.filled
      const take = Math.min(space, len - offset)
      this.buffer.set(samples.subarray(offset, offset + take), this.filled)
      this.filled += take
      offset += take
      if (this.filled === this.frameSize) this.flush()
    }
  }

  appendSample(sample) {
    this.buffer[this.filled++] = sample
    if (this.filled === this.frameSize) this.flush()
  }

  flush() {
    const out = new Int16Array(this.frameSize)
    for (let i = 0; i < this.frameSize; i++) {
      let s = this.buffer[i]
      if (s > 1) s = 1
      else if (s < -1) s = -1
      out[i] = s < 0 ? s * 0x8000 : s * 0x7fff
    }
    this.port.postMessage(out.buffer, [out.buffer])
    this.filled = 0
  }
}

registerProcessor('pcm16-framer', Pcm16Framer)
`
