import { describe, expect, it } from 'vitest'
import { formatClock, formatTime, formatTimeSeconds, remainingMs } from '@/lib/time'

describe('formatClock', () => {
  it('renders m:ss under an hour', () => {
    expect(formatClock(0)).toBe('0:00')
    expect(formatClock(9_000)).toBe('0:09')
    expect(formatClock(65_000)).toBe('1:05')
    expect(formatClock(59 * 60_000 + 59_000)).toBe('59:59')
  })

  it('adds an hours field once it passes an hour', () => {
    expect(formatClock(60 * 60_000)).toBe('1:00:00')
    expect(formatClock(60 * 60_000 + 61_000)).toBe('1:01:01')
  })

  it('clamps negatives to zero rather than showing a minus sign', () => {
    expect(formatClock(-5_000)).toBe('0:00')
  })
})

describe('remainingMs', () => {
  it('returns the gap until endsAt', () => {
    expect(remainingMs(1_000, 400)).toBe(600)
  })

  it('clamps at zero once the deadline passes', () => {
    expect(remainingMs(1_000, 5_000)).toBe(0)
  })

  it('returns null for an open-ended session', () => {
    expect(remainingMs(undefined, 5_000)).toBeNull()
  })
})

describe('wall-clock formatting', () => {
  it('zero-pads hours and minutes', () => {
    const ts = new Date(2026, 0, 5, 9, 7, 3).getTime()
    expect(formatTime(ts)).toBe('09:07')
    expect(formatTimeSeconds(ts)).toBe('09:07:03')
  })
})
