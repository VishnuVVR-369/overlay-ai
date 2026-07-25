// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { arrayBufferToBase64 } from '@/audio/encode'

describe('arrayBufferToBase64', () => {
  it('encodes a small buffer to base64 matching Buffer reference', () => {
    const buf = new Uint8Array([1, 2, 3, 4, 5]).buffer
    expect(arrayBufferToBase64(buf)).toBe(Buffer.from(buf).toString('base64'))
  })

  it('handles empty buffers', () => {
    expect(arrayBufferToBase64(new ArrayBuffer(0))).toBe('')
  })

  it('handles buffers larger than the chunk size (32k) without corruption', () => {
    const len = 0x10001 // 1 byte over 64K — exercises the chunked loop twice
    const u8 = new Uint8Array(len)
    for (let i = 0; i < len; i++) u8[i] = i & 0xff
    const got = arrayBufferToBase64(u8.buffer)
    expect(got).toBe(Buffer.from(u8).toString('base64'))
  })

  it('round-trips arbitrary bytes', () => {
    const u8 = new Uint8Array([0, 255, 127, 128, 1])
    const round = Uint8Array.from(Buffer.from(arrayBufferToBase64(u8.buffer), 'base64'))
    expect(Array.from(round)).toEqual(Array.from(u8))
  })
})