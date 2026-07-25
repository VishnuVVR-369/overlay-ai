import { describe, expect, it } from 'vitest'
import { speakerForStream } from '@shared/types'

describe('speakerForStream', () => {
  it('maps mic stream → "you"', () => {
    expect(speakerForStream('mic')).toBe('you')
  })

  it('maps system stream → "them"', () => {
    expect(speakerForStream('system')).toBe('them')
  })
})
