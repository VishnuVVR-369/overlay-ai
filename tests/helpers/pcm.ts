export function makePcm16Sine(samples: number, freq = 440, rate = 16000): Int16Array {
  const out = new Int16Array(samples)
  for (let i = 0; i < samples; i++) {
    out[i] = Math.round(Math.sin((2 * Math.PI * freq * i) / rate) * 0x7fff)
  }
  return out
}

export function pcmToBase64(buf: Int16Array): string {
  return Buffer.from(buf.buffer, buf.byteOffset, buf.byteLength).toString('base64')
}
